import { z } from "zod";
import artifactJson from "../../artifacts/m7-balanced-reliability.json";
import type { M7ScenarioResult as ReportScenarioResult } from "../adversarial/m7-report";

const verdictSchema = z.enum(["APPROVE", "BLOCK", "REVIEW"]);
const modeSchema = z.enum(["DETERMINISTIC", "MOCK_QVAC", "REAL_QVAC", "REAL_NETWORK"]);

const metricSchema = z.number().min(0).max(1).nullable();
const scenarioResultSchema = z.object({
  scenarioId: z.string(),
  category: z.string(),
  executionMode: modeSchema,
  expectedVerdict: verdictSchema,
  actualVerdict: verdictSchema,
  description: z.string(),
  unsafe: z.boolean(),
  promptInjection: z.boolean(),
  modelCorrect: z.boolean().nullable(),
  systemSafe: z.boolean(),
  observedModelFailure: z.boolean(),
  rawQvacBehavior: z.array(z.string()),
  toolFailures: z.array(z.string()),
  toolChainComplete: z.boolean(),
  latencyMs: z.number().nonnegative(),
  safetyKernelVerdict: verdictSchema.nullable(),
  unsafeApproval: z.boolean(),
  failureCodes: z.array(z.string()),
}).passthrough();

export const m7ArtifactSchema = z.object({
  reportVersion: z.string(),
  generatedAt: z.string(),
  status: z.enum(["PASS", "PARTIAL", "FAIL"]),
  runtime: z.object({
    qvacModel: z.string(),
    qvacEndpoint: z.string(),
    hardware: z.object({ cpu: z.string().nullable(), ramGiB: z.number().nullable(), os: z.string() }),
  }),
  dataset: z.object({
    total: z.number().int().nonnegative(),
    unsafe: z.number().int().nonnegative(),
    safe: z.number().int().nonnegative(),
    byCategory: z.record(z.string(), z.number().int().nonnegative()),
    byExecutionMode: z.record(modeSchema, z.number().int().nonnegative()),
  }),
  metrics: z.object({
    verdictAccuracy: metricSchema,
    unsafeApprovalRate: metricSchema,
    safeApprovalRate: metricSchema,
    reviewRate: metricSchema,
    unsafeReviewRate: metricSchema,
    safeReviewRate: metricSchema,
    blockRecall: metricSchema,
    approvalPrecision: metricSchema,
    modelFailureContainmentRate: metricSchema,
    promptInjectionContainmentRate: metricSchema,
  }),
  counts: z.object({
    approvals: z.number().int().nonnegative(),
    blocks: z.number().int().nonnegative(),
    reviews: z.number().int().nonnegative(),
    correctVerdicts: z.number().int().nonnegative(),
    incorrectVerdicts: z.number().int().nonnegative(),
    unsafeApprovals: z.number().int().nonnegative(),
    safeApprovals: z.number().int().nonnegative(),
    conservativeDegradations: z.number().int().nonnegative(),
    modelFailures: z.number().int().nonnegative(),
    toolFailures: z.number().int().nonnegative(),
    promptInjectionScenarios: z.number().int().nonnegative(),
  }),
  conservativeDegradations: z.array(scenarioResultSchema),
  unsafeApprovalCases: z.array(scenarioResultSchema),
  safeControlFailures: z.array(scenarioResultSchema),
  failureTaxonomy: z.record(z.string(), z.number().int().nonnegative()),
  byCategory: z.record(z.string(), z.object({
    scenarios: z.number().int().nonnegative(), unsafe: z.number().int().nonnegative(), safe: z.number().int().nonnegative(),
    correct: z.number().int().nonnegative(), accuracy: metricSchema, approvals: z.number().int().nonnegative(),
    blocks: z.number().int().nonnegative(), reviews: z.number().int().nonnegative(), unsafeApprovals: z.number().int().nonnegative(), safeApprovals: z.number().int().nonnegative(),
  })),
  byExecutionMode: z.record(modeSchema, z.object({
    scenarios: z.number().int().nonnegative(), accuracy: metricSchema, approvals: z.number().int().nonnegative(),
    blocks: z.number().int().nonnegative(), reviews: z.number().int().nonnegative(), failures: z.number().int().nonnegative(),
    modelFailures: z.number().int().nonnegative(), toolChainFailures: z.number().int().nonnegative(), averageLatencyMs: z.number().nonnegative().nullable(),
  })),
  scenarios: z.array(scenarioResultSchema),
});

export type M7ScenarioResult = ReportScenarioResult;
type ParsedArtifact = z.infer<typeof m7ArtifactSchema>;
export type M7Artifact = Omit<ParsedArtifact, "scenarios" | "conservativeDegradations" | "unsafeApprovalCases" | "safeControlFailures"> & {
  scenarios: M7ScenarioResult[];
  conservativeDegradations: M7ScenarioResult[];
  unsafeApprovalCases: M7ScenarioResult[];
  safeControlFailures: M7ScenarioResult[];
};

export function parseM7Artifact(input: unknown): M7Artifact {
  return m7ArtifactSchema.parse(input) as M7Artifact;
}

export function loadM7Artifact(): M7Artifact | null {
  const parsed = m7ArtifactSchema.safeParse(artifactJson);
  return parsed.success ? parsed.data as M7Artifact : null;
}
