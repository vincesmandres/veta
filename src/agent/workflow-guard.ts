import type { ExecutionStep } from "./action-schema";
import type { OrchestratorResult } from "./orchestrator";

const REQUIRED_TOOLS = ["get_evidence", "get_transaction", "decode_transaction", "verify_transaction"] as const;

export function checkWorkflowGuard(result: OrchestratorResult): OrchestratorResult {
  if (result.steps.some((step) => step.error?.includes("UNKNOWN_TOOL") || step.error?.includes("Invalid agent action"))) {
    return { ...result, finalVerdict: "REVIEW", reason: "TOOL_ORCHESTRATION_FAILED" };
  }

  const calledTools = new Set<string>();
  for (const step of result.steps) {
    if (step.toolResult?.ok && step.action.action === "call_tool") {
      calledTools.add(step.action.tool);
    }
  }
  const missingRequired = REQUIRED_TOOLS.filter((tool) => !calledTools.has(tool));

  if (result.verificationVerdict === "BLOCK") {
    return { ...result, finalVerdict: "BLOCK", reason: result.reason || "Deterministic safety kernel blocked transaction" };
  }
  if (result.verificationVerdict === "REVIEW") {
    return { ...result, finalVerdict: "REVIEW", reason: result.reason || "Deterministic safety kernel returned REVIEW" };
  }
  if (result.verificationVerdict === "APPROVE") {
    if (missingRequired.length > 0) {
      return { ...result, finalVerdict: "REVIEW", reason: `INCOMPLETE_TOOL_CHAIN: missing ${missingRequired.join(", ")}` };
    }
    return { ...result, finalVerdict: "APPROVE", reason: result.reason || "All verification checks passed" };
  }
  if (result.reason === "TOOL_CHAIN_LIMIT_EXCEEDED") return result;
  if (result.reason === "TOOL_ORCHESTRATION_FAILED") return result;
  return {
    ...result,
    finalVerdict: "REVIEW",
    reason: `INCOMPLETE_TOOL_CHAIN: missing ${missingRequired.join(", ")}`,
  };
}

export function formatTrace(steps: ExecutionStep[]): string {
  const lines: string[] = [];
  for (const step of steps) {
    lines.push(`STEP ${step.step}`);
    if (step.action.action === "call_tool") {
      lines.push(`QVAC selected: ${step.action.tool}`);
      lines.push(`Arguments: ${JSON.stringify(step.action.arguments)}`);
    } else {
      lines.push("QVAC selected: finish");
      if (step.action.summary) lines.push(`Summary: ${step.action.summary}`);
    }
    lines.push(`Validation: ${step.validation}`);
    if (step.error) lines.push(`Error: ${step.error}`);
    if (step.toolResult) {
      lines.push(step.toolResult.ok ? "Tool result: PASS" : `Tool result: FAIL - ${step.toolResult.error}`);
      if (!step.toolResult.ok && step.toolResult.message) lines.push(`Message: ${step.toolResult.message}`);
    }
    lines.push(`Latency: ${step.latencyMs}ms`);
    if (step.retries > 0) lines.push(`Retries: ${step.retries}`);
    lines.push("");
  }
  return lines.join("\n");
}
