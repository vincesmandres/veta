import { authorityLevelForNode, type AuthorityLevel, type CriticalField } from "../authority";
import { JUDGE_READINESS_SCENARIOS, type AdversarialScenario } from "../adversarial/scenarios";
import type { EvidenceSourceType } from "../evidence/source-schema";
import type { TrustTier } from "../evidence/trust";
import type { M7ScenarioResult } from "./m7-artifact";

export type DemoEvidence = {
  sourceId: string;
  sourceType: string;
  trustTier: string;
  field: string;
  value: string;
  role: AuthorityLevel;
  text?: string;
};

export type DemoCheck = { label: string; status: "PASS" | "FAIL" | "MISSING" | "CONFLICT"; detail: string };
export type DemoScenario = {
  id: string;
  title: string;
  category: string;
  description: string;
  expectedVerdict: M7ScenarioResult["expectedVerdict"];
  actualVerdict: M7ScenarioResult["actualVerdict"];
  executionMode: string;
  authority: { recipient: string; amount: string; asset: string };
  onchain: { recipient: string; amount: string; asset: string };
  evidence: DemoEvidence[];
  checks: DemoCheck[];
  reasons: string[];
  ignored: string[];
  modelFailure: boolean;
  systemSafe: boolean;
};

const FEATURED = ["A1", "G1", "A2", "B4", "C1", "G7"];
const titles: Record<string, string> = { A1: "Recipient Attack", G1: "Exact Match", A2: "Amount Mutation", B4: "Conflicting Authority", C1: "Prompt Injection", G7: "Lower-Trust Override" };

export function buildDemoScenarios(artifact: { scenarios: M7ScenarioResult[] }): DemoScenario[] {
  return FEATURED.flatMap((id) => {
    const result = artifact.scenarios.find((entry) => entry.scenarioId === id);
    const definition = JUDGE_READINESS_SCENARIOS.find((scenario) => scenario.id === id);
    const verificationDefinition = definition?.input.kind === "verification" ? definition : undefined;
    return result && verificationDefinition ? [toDemoScenario(result, verificationDefinition)] : [];
  });
}

function toDemoScenario(result: M7ScenarioResult, definition: AdversarialScenario): DemoScenario {
  if (definition.input.kind !== "verification") throw new Error(`Demo scenario ${definition.id} is not a verification scenario`);
  const input = definition.input;
  const authority = { recipient: "Not established", amount: "Not established", asset: "Not established" };
  for (const field of ["recipient", "amount", "asset"] as const) {
    const resolution = result.authorityResolution?.fields[field];
    if (resolution?.value) authority[field] = resolution.value;
  }
  const onchain = {
    recipient: input.observed.recipient,
    amount: formatUnits(input.observed.amountRaw, input.observed.decimals),
    asset: input.observed.asset,
  };
  const allEvidence = input.evidence.flatMap((spec) => Object.entries(spec.values).map(([field, value]) => ({
    sourceId: spec.sourceId, sourceType: spec.sourceType, trustTier: spec.trustTier, field, value: String(value), role: authorityRole(spec, field as CriticalField), text: spec.evidenceText,
  })));
  const reasons = result.observedReasons.filter((reason) => !reason.startsWith("AUTHORITATIVE evidence"));
  return {
    id: result.scenarioId,
    title: titles[result.scenarioId] ?? result.scenarioId,
    category: result.category,
    description: definition.description,
    expectedVerdict: result.expectedVerdict,
    actualVerdict: result.actualVerdict,
    executionMode: result.executionMode,
    authority,
    onchain,
    evidence: allEvidence,
    checks: ["recipient", "amount", "asset"].map((field) => checkFor(field as CriticalField, result)),
    reasons: reasons.length ? reasons : result.actualVerdict === "APPROVE" ? ["Authoritative evidence matches observed execution."] : ["Verification did not establish a safe approval."],
    ignored: result.authorityResolution ? Object.values(result.authorityResolution.fields).flatMap((field) => field.ignoredEvidenceIds ?? []) : [],
    modelFailure: result.observedModelFailure,
    systemSafe: result.systemSafe,
  };
}

function authorityRole(spec: { sourceId: string; sourceType: EvidenceSourceType; trustTier: TrustTier }, field: CriticalField): AuthorityLevel {
  const node = { field, sourceType: spec.sourceType, trustTier: spec.trustTier, value: "", id: spec.sourceId, sourceId: spec.sourceId, extraction: "explicit" as const };
  return authorityLevelForNode(node, field);
}

function checkFor(field: CriticalField, result: M7ScenarioResult): DemoCheck {
  const mismatch = result.observedReasons.find((reason) => reason.toUpperCase().includes(`${field.toUpperCase()}_MATCH MISMATCH`));
  if (mismatch) return { label: titleCase(field), status: "FAIL", detail: mismatch };
  const resolution = result.authorityResolution?.fields[field];
  if (resolution?.status === "CONFLICT") return { label: titleCase(field), status: "CONFLICT", detail: "Equal authority disagreement" };
  if (resolution?.status === "UNRESOLVED") return { label: titleCase(field), status: "MISSING", detail: "No sufficient authority" };
  return { label: titleCase(field), status: "PASS", detail: "Canonical values match" };
}

function titleCase(value: string): string { return `${value[0].toUpperCase()}${value.slice(1)}`; }
function formatUnits(raw: string, decimals: number): string {
  const value = BigInt(raw);
  const base = BigInt(10) ** BigInt(decimals);
  const whole = value / base;
  const fraction = (value % base).toString().padStart(decimals, "0").replace(/0+$/, "");
  return fraction ? `${whole}.${fraction}` : whole.toString();
}
