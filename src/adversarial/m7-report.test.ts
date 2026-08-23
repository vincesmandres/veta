import { describe, expect, it } from "vitest";
import { createM7Report } from "./m7-report";
import { JUDGE_READINESS_SCENARIOS, M6_SCENARIOS, SAFE_CONTROL_SCENARIOS, type AdversarialScenario } from "./scenarios";
import type { ScenarioResult } from "./runner";
import { readFileSync } from "node:fs";

function result(scenario: AdversarialScenario, actualVerdict = scenario.expectedVerdict, overrides: Partial<ScenarioResult> = {}): ScenarioResult {
  return {
    scenarioId: scenario.id,
    category: scenario.category,
    executionMode: scenario.executionMode,
    expectedVerdict: scenario.expectedVerdict,
    actualVerdict,
    expectedReasons: scenario.expectedReasons,
    observedReasons: [],
    passed: actualVerdict === scenario.expectedVerdict,
    qvacUsed: scenario.executionMode === "REAL_QVAC",
    qvacFailure: null,
    rawQvacBehavior: [],
    toolChainComplete: true,
    toolFailures: [],
    safetyKernelVerdict: actualVerdict,
    finalVerdict: actualVerdict,
    unsafeApproval: scenario.unsafe && actualVerdict === "APPROVE",
    authorityResolution: null,
    latencyMs: 10,
    ...overrides,
  };
}

describe("M7 balanced reliability reporting", () => {
  it("partitions the predeclared dataset into 28 unsafe and 8 safe scenarios", () => {
    expect(JUDGE_READINESS_SCENARIOS).toHaveLength(36);
    expect(M6_SCENARIOS).toHaveLength(28);
    expect(SAFE_CONTROL_SCENARIOS).toHaveLength(8);
    expect(JUDGE_READINESS_SCENARIOS.filter((scenario) => scenario.unsafe)).toHaveLength(28);
    expect(JUDGE_READINESS_SCENARIOS.filter((scenario) => !scenario.unsafe)).toHaveLength(8);
  });

  it("calculates balanced rates, degradation, category, and mode aggregates", () => {
    const scenarios = [M6_SCENARIOS[0], M6_SCENARIOS[1], SAFE_CONTROL_SCENARIOS[0], SAFE_CONTROL_SCENARIOS[1], M6_SCENARIOS[5]];
    const results = [
      result(scenarios[0], "BLOCK"),
      result(scenarios[1], "REVIEW"),
      result(scenarios[2], "APPROVE"),
      result(scenarios[3], "REVIEW"),
      result(scenarios[4], "REVIEW", { toolChainComplete: false, qvacFailure: "MALFORMED_JSON" }),
    ];
    const report = createM7Report(scenarios, results, "2026-01-01T00:00:00.000Z");

    expect(report.dataset).toMatchObject({ total: 5, unsafe: 3, safe: 2 });
    expect(report.counts).toMatchObject({ approvals: 1, blocks: 1, reviews: 3, correctVerdicts: 2, incorrectVerdicts: 3, unsafeApprovals: 0, safeApprovals: 1, conservativeDegradations: 2, modelFailures: 1 });
    expect(report.metrics).toMatchObject({ verdictAccuracy: 0.4, unsafeApprovalRate: 0, safeApprovalRate: 0.5, reviewRate: 0.6, blockRecall: 1 / 3, approvalPrecision: 1, modelFailureContainmentRate: 1, promptInjectionContainmentRate: 1 });
    expect(report.conservativeDegradations.map((entry) => entry.scenarioId)).toEqual(["A2", "B1"]);
    expect(report.unsafeApprovalCases).toEqual([]);
    expect(report.safeControlFailures.map((entry) => entry.scenarioId)).toEqual(["G2"]);
    expect(report.byCategory.safe_control).toMatchObject({ scenarios: 2, approvals: 1, reviews: 1, safeApprovals: 1 });
    expect(report.byExecutionMode.DETERMINISTIC).toMatchObject({ scenarios: 4, approvals: 1, blocks: 1, reviews: 2 });
    expect(report.byExecutionMode.REAL_QVAC).toMatchObject({ scenarios: 1, reviews: 1, modelFailures: 1, toolChainFailures: 1 });
    expect(report.failureTaxonomy.MODEL_PARSE_FAILURE).toBe(1);
    expect(report.failureTaxonomy.TOOL_CHAIN_LIMIT_EXCEEDED).toBeUndefined();
  });

  it("returns null for metrics with zero denominators", () => {
    const scenario = SAFE_CONTROL_SCENARIOS[0];
    const report = createM7Report([scenario], [result(scenario)]);
    expect(report.metrics.unsafeApprovalRate).toBeNull();
    expect(report.metrics.blockRecall).toBeNull();
    expect(report.metrics.modelFailureContainmentRate).toBeNull();
  });

  it("preserves the historical M6 artifact as the original 28 unsafe-scenario benchmark", () => {
    const artifact = JSON.parse(readFileSync("artifacts/m6-adversarial-results.json", "utf8")) as { metrics: { totalScenarios: number; unsafeScenarios: number; unsafeApprovals: number; verdictAccuracy: number } };
    expect(artifact.metrics).toEqual(expect.objectContaining({ totalScenarios: 28, unsafeScenarios: 28, unsafeApprovals: 0, verdictAccuracy: 26 / 28 }));
  });
});
