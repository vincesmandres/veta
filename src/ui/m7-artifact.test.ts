import { describe, expect, it } from "vitest";
import artifact from "../../artifacts/m7-balanced-reliability.json";
import { buildDemoScenarios } from "./demo-data";
import { parseM7Artifact } from "./m7-artifact";
import { qvacHealthResponseSchema } from "./qvac-health";

describe("M8 data boundary", () => {
  it("accepts the versioned M7 artifact", () => {
    expect(parseM7Artifact(artifact).dataset).toMatchObject({ total: 36, unsafe: 28, safe: 8 });
  });

  it("rejects malformed metrics instead of rendering unvalidated data", () => {
    expect(() => parseM7Artifact({ ...artifact, metrics: { ...artifact.metrics, safeApprovalRate: 4 } })).toThrow();
  });

  it("maps recorded scenarios without changing expected or actual verdicts", () => {
    const parsed = parseM7Artifact(artifact);
    const scenarios = buildDemoScenarios(parsed);
    expect(scenarios.map((scenario) => scenario.id)).toEqual(["A1", "G1", "A2", "B4", "C1", "G7"]);
    expect(scenarios.map((scenario) => [scenario.id, scenario.expectedVerdict, scenario.actualVerdict])).toEqual([
      ["A1", "BLOCK", "BLOCK"], ["G1", "APPROVE", "APPROVE"], ["A2", "BLOCK", "BLOCK"],
      ["B4", "REVIEW", "REVIEW"], ["C1", "REVIEW", "REVIEW"], ["G7", "APPROVE", "APPROVE"],
    ]);
    expect(scenarios.find((scenario) => scenario.id === "G7")?.checks.every((check) => check.status === "PASS")).toBe(true);
    expect(scenarios.find((scenario) => scenario.id === "A1")?.checks.find((check) => check.label === "Recipient")?.status).toBe("FAIL");
    expect(scenarios.find((scenario) => scenario.id === "B4")?.checks.find((check) => check.label === "Recipient")?.status).toBe("CONFLICT");
  });

  it("validates the local QVAC health contract", () => {
    expect(qvacHealthResponseSchema.parse({ available: true, model: "veta-local" })).toEqual({ available: true, model: "veta-local" });
    expect(qvacHealthResponseSchema.parse({ available: false })).toEqual({ available: false });
    expect(() => qvacHealthResponseSchema.parse({ available: "yes" })).toThrow();
  });
});
