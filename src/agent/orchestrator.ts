import { agentActionSchema, type AgentAction, type ExecutionStep, type ToolResult, type ToolName } from "./action-schema";
import { executeTool, type EvidenceStore, createEvidenceStore } from "./tool-registry";
import { QvacError } from "../qvac/extract-payment";
import { checkWorkflowGuard } from "./workflow-guard";

export const MAX_TOOL_STEPS = 8;
export const MAX_RETRIES = 1;

const TRANSIENT_ERRORS = new Set([
  "RPC_UNAVAILABLE",
  "QVAC_UNAVAILABLE",
  "QVAC_HTTP_ERROR",
  "QVAC_EMPTY_RESPONSE",
  "MALFORMED_JSON",
]);

export function isTransientError(code: string): boolean {
  return TRANSIENT_ERRORS.has(code);
}

export type OrchestratorContext = {
  task: string;
  txHash?: string;
  sourceId?: string;
  toolResults: Array<{ tool: ToolName; result: ToolResult<unknown> }>;
  step: number;
};

const AGENT_SYSTEM_PROMPT = `You are VETA's local tool orchestrator. You may only select registered VETA tools.
Available tools:
- get_evidence: {"sourceId":"REQ-001"}
- get_transaction: {"txHash":"0x..."}
- decode_transaction: {"transaction":{"id":"...","tokenAddress":"0x...","calldata":"0x...","decimals":6,"symbol":"USDT"}}
- verify_transaction: {"authorityEvidence":[...],"onchainEvidence":[...]}

Return ONLY JSON. Either call one tool:
{"action":"call_tool","tool":"get_evidence|get_transaction|decode_transaction|verify_transaction","arguments":{}}
or finish:
{"action":"finish","summary":"..."}

For payment verification, retrieve evidence, retrieve the transaction, decode it, then run verify_transaction. Never invent evidence and never decide authorization yourself.`;

export function parseTask(task: string): { txHash?: string; sourceId?: string } {
  const txMatch = task.match(/0x[a-fA-F0-9]{64}/);
  const sourceMatch = task.match(/(?:REQ|TXT|INV)-[A-Z0-9-]+/i);
  return {
    txHash: txMatch?.[0]?.toLowerCase(),
    sourceId: sourceMatch?.[0],
  };
}

export async function callQvacForAction(
  task: string,
  context: OrchestratorContext,
  options?: { baseUrl?: string; model?: string; fetchImpl?: typeof fetch },
): Promise<AgentAction> {
  const model = options?.model ?? process.env.VETA_QVAC_MODEL ?? "veta-local";
  const baseUrl = (options?.baseUrl ?? process.env.VETA_QVAC_URL ?? "http://127.0.0.1:11434/v1").replace(/\/$/, "");
  const fetchImpl = options?.fetchImpl ?? fetch;
  const contextSummary = {
    task,
    txHash: context.txHash,
    sourceId: context.sourceId,
    step: context.step,
    toolResults: context.toolResults.map((entry) => ({ tool: entry.tool, result: entry.result })),
  };

  let response: Response;
  try {
    response = await fetchImpl(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        temperature: 0,
        max_tokens: 512,
        chat_template_kwargs: { enable_thinking: false },
        messages: [
          { role: "system", content: AGENT_SYSTEM_PROMPT },
          { role: "user", content: `Task: ${task}\nContext: ${JSON.stringify(contextSummary, (_, value) => typeof value === "bigint" ? value.toString() : value)}` },
        ],
      }),
    });
  } catch (error) {
    throw new QvacError("QVAC_UNAVAILABLE", error instanceof Error ? error.message : "QVAC request failed");
  }

  if (!response.ok) {
    throw new QvacError("QVAC_HTTP_ERROR", `QVAC returned HTTP ${response.status}`);
  }

  const payload = await response.json() as { choices?: Array<{ message?: { content?: unknown } }> };
  const raw = payload.choices?.[0]?.message?.content;
  if (typeof raw !== "string" || !raw.trim()) {
    throw new QvacError("QVAC_EMPTY_RESPONSE", "QVAC returned an empty response");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new QvacError("MALFORMED_JSON", "QVAC returned malformed JSON");
  }

  const validated = agentActionSchema.safeParse(parsed);
  if (!validated.success) {
    throw new QvacError("SCHEMA_VALIDATION_FAILED", `Invalid agent action: ${validated.error.message}`);
  }
  return validated.data;
}

export type OrchestratorResult = {
  finalVerdict: "APPROVE" | "BLOCK" | "REVIEW";
  reason: string;
  steps: ExecutionStep[];
  verificationPerformed: boolean;
  verificationVerdict?: "APPROVE" | "BLOCK" | "REVIEW";
  unsafeApproval: boolean;
};

export async function runAgent(
  task: string,
  options: {
    evidenceStore?: EvidenceStore;
    rpcUrl?: string;
    transactionClient?: any;
    baseUrl?: string;
    model?: string;
    fetchImpl?: typeof fetch;
    maxSteps?: number;
    maxRetries?: number;
    mockQvacAction?: () => unknown;
  } = {},
): Promise<OrchestratorResult> {
  const maxSteps = options.maxSteps ?? MAX_TOOL_STEPS;
  const maxRetries = options.maxRetries ?? MAX_RETRIES;
  const evidenceStore = options.evidenceStore ?? createEvidenceStore();
  const context: OrchestratorContext = { task, ...parseTask(task), toolResults: [], step: 0 };
  const steps: ExecutionStep[] = [];
  let retryCount = 0;
  let verificationPerformed = false;
  let verificationVerdict: "APPROVE" | "BLOCK" | "REVIEW" | undefined;
  let verificationReasons: string[] = [];

  while (context.step < maxSteps) {
    context.step += 1;
    const startedAt = Date.now();
    let action: unknown;

    try {
      action = options.mockQvacAction
        ? options.mockQvacAction()
        : await callQvacForAction(task, context, {
            baseUrl: options.baseUrl,
            model: options.model,
            fetchImpl: options.fetchImpl,
          });
    } catch (error) {
      const code = error instanceof QvacError ? error.code : "QVAC_UNAVAILABLE";
      const message = error instanceof Error ? error.message : "QVAC action failed";
      steps.push({
        step: context.step,
        action: { action: "finish", summary: "" },
        validation: "FAIL",
        error: `${code}: ${message}`,
        latencyMs: Date.now() - startedAt,
        retries: retryCount,
      });
      if (retryCount < maxRetries && isTransientError(code)) {
        retryCount += 1;
        continue;
      }
      break;
    }

    const validated = agentActionSchema.safeParse(action);
    if (!validated.success) {
      const error = `Invalid agent action: ${validated.error.message}`;
      steps.push({
        step: context.step,
        action: { action: "finish", summary: "" },
        validation: "FAIL",
        error,
        latencyMs: Date.now() - startedAt,
        retries: retryCount,
      });
      if (retryCount < maxRetries) {
        retryCount += 1;
        continue;
      }
      break;
    }

    const validAction = validated.data;
    if (validAction.action === "finish") {
      steps.push({ step: context.step, action: validAction, validation: "PASS", latencyMs: Date.now() - startedAt, retries: retryCount });
      break;
    }

    let toolResult: ToolResult<unknown>;
    try {
      toolResult = await executeTool(validAction.tool, validAction.arguments, {
        evidenceStore,
        rpcUrl: options.rpcUrl,
        transactionClient: options.transactionClient,
      });
    } catch (error) {
      toolResult = {
        ok: false,
        error: "TOOL_EXECUTION_FAILED",
        message: error instanceof Error ? error.message : "Tool execution failed",
      };
    }

    steps.push({
      step: context.step,
      action: validAction,
      validation: "PASS",
      toolResult,
      latencyMs: Date.now() - startedAt,
      retries: retryCount,
    });

    if (!toolResult.ok && retryCount < maxRetries && isTransientError(toolResult.error)) {
      retryCount += 1;
      continue;
    }

    context.toolResults.push({ tool: validAction.tool, result: toolResult });
    if (validAction.tool === "verify_transaction" && toolResult.ok) {
      const data = toolResult.data as { verdict: "APPROVE" | "BLOCK" | "REVIEW"; reasons?: string[] };
      verificationPerformed = true;
      verificationVerdict = data.verdict;
      verificationReasons = data.reasons ?? [];
    }
  }

  const exceededLimit = context.step >= maxSteps;
  const hasOrchestrationFailure = steps.some((step) => step.error?.includes("UNKNOWN_TOOL") || step.error?.includes("Invalid agent action") || step.error?.includes("QVAC_"));
  let finalVerdict: "APPROVE" | "BLOCK" | "REVIEW";
  let reason: string;

  if (verificationPerformed && verificationVerdict) {
    finalVerdict = verificationVerdict;
    reason = verificationReasons.length > 0 ? verificationReasons.join(", ") : "Deterministic safety verdict";
  } else if (exceededLimit) {
    finalVerdict = "REVIEW";
    reason = "TOOL_CHAIN_LIMIT_EXCEEDED";
  } else if (hasOrchestrationFailure) {
    finalVerdict = "REVIEW";
    reason = "TOOL_ORCHESTRATION_FAILED";
  } else {
    finalVerdict = "REVIEW";
    reason = "INCOMPLETE_TOOL_CHAIN";
  }

  const unsafeApproval = finalVerdict === "APPROVE" && (!verificationPerformed || verificationVerdict !== "APPROVE");
  return checkWorkflowGuard({
    finalVerdict,
    reason,
    steps,
    verificationPerformed,
    verificationVerdict,
    unsafeApproval,
  });
}
