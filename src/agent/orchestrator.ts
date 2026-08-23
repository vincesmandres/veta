import { agentActionSchema, type AgentAction, type ExecutionStep, type ToolResult, type ToolName } from "./action-schema";
import { executeTool, type EvidenceStore, createEvidenceStore } from "./tool-registry";
import { QvacError } from "../qvac/extract-payment";
import { checkWorkflowGuard } from "./workflow-guard";

export const MAX_TOOL_STEPS = 8;
export const MAX_RETRIES = 1;

const TRANSIENT_ERRORS = new Set(["RPC_UNAVAILABLE", "QVAC_UNAVAILABLE", "QVAC_HTTP_ERROR", "QVAC_EMPTY_RESPONSE", "MALFORMED_JSON"]);

export function isTransientError(code: string): boolean { return TRANSIENT_ERRORS.has(code); }

export type OrchestratorContext = {
  task: string;
  txHash?: string;
  sourceId?: string;
  toolResults: Array<{ tool: ToolName; result: ToolResult<unknown> }>;
  step: number;
};

const AGENT_SYSTEM_PROMPT = `VETA local router. Never authorize.
Output exactly one JSON object only. No Markdown, prose, reasoning, XML, or thinking tags.
The only valid call format is {"action":"call_tool","tool":"get_evidence","arguments":{"sourceId":"REQ-001"}}.
The only valid finish format is {"action":"finish"}.
Allowed tools: get_evidence, get_transaction, decode_transaction, verify_transaction. Never invent values.`;

function debugQvac(label: string, value: unknown): void {
  if (process.env.VETA_DEBUG_QVAC === "1") {
    console.error(`[QVAC DEBUG] ${label}:`, typeof value === "string" ? value : JSON.stringify(value, (_, item) => typeof item === "bigint" ? item.toString() : item, 2));
  }
}

function normalizeJsonResponse(raw: string): string {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return (fenced?.[1] ?? trimmed).trim();
}

export function parseTask(task: string): { txHash?: string; sourceId?: string } {
  const txMatch = task.match(/0x[a-fA-F0-9]{64}/);
  const sourceMatch = task.match(/(?:REQ|TXT|INV)-[A-Z0-9-]+/i);
  return { txHash: txMatch?.[0]?.toLowerCase(), sourceId: sourceMatch?.[0] };
}

export async function callQvacForAction(task: string, context: OrchestratorContext, options?: { baseUrl?: string; model?: string; fetchImpl?: typeof fetch; retryMessage?: string }): Promise<AgentAction> {
  const model = options?.model ?? process.env.VETA_QVAC_MODEL ?? "veta-local";
  const baseUrl = (options?.baseUrl ?? process.env.VETA_QVAC_URL ?? "http://127.0.0.1:11434/v1").replace(/\/$/, "");
  const fetchImpl = options?.fetchImpl ?? fetch;
  const completedTools = context.toolResults.filter((entry) => entry.result.ok).map((entry) => entry.tool);
  const allowedNextTools = completedTools.includes("verify_transaction")
    ? []
    : completedTools.includes("decode_transaction")
      ? ["verify_transaction"]
      : completedTools.includes("get_transaction")
        ? ["decode_transaction"]
        : completedTools.includes("get_evidence")
          ? ["get_transaction"]
          : ["get_evidence"];
  const relevantTools = allowedNextTools[0] === "decode_transaction"
    ? new Set(["get_transaction"])
    : allowedNextTools[0] === "verify_transaction"
      ? new Set(["get_evidence", "decode_transaction"])
      : new Set(context.toolResults.map((entry) => entry.tool));
  const toolResults = context.toolResults.filter((entry) => relevantTools.has(entry.tool)).map((entry) => {
    if (!entry.result.ok) return { tool: entry.tool, ok: false, error: entry.result.error };
    const data = entry.result.data as any;
    if (entry.tool === "get_transaction") return { tool: entry.tool, ok: true, data: { hash: data.hash, to: data.to, input: data.input, blockNumber: data.blockNumber?.toString() } };
    if (entry.tool === "get_evidence") return { tool: entry.tool, ok: true, data: data.evidence };
    if (entry.tool === "decode_transaction") return { tool: entry.tool, ok: true, data };
    return { tool: entry.tool, ok: true, data: { verdict: data.verdict, reasons: data.reasons, checks: data.checks } };
  });
  const contextSummary = { task, txHash: context.txHash, sourceId: context.sourceId, completedTools, allowedNextTools, toolResults };
  const allowedText = allowedNextTools.length > 0 ? allowedNextTools.join(", ") : "finish";
  const nextInstruction = allowedNextTools.length > 0 ? "Choose ONLY one allowed next tool; do not finish early." : "All tools are complete; return {\"action\":\"finish\"}.";
  const transactionResult = context.toolResults.find((entry) => entry.tool === "get_transaction" && entry.result.ok)?.result as { ok: true; data: any } | undefined;
  const evidenceResult = context.toolResults.find((entry) => entry.tool === "get_evidence" && entry.result.ok)?.result as { ok: true; data: any } | undefined;
  const decodedResult = context.toolResults.find((entry) => entry.tool === "decode_transaction" && entry.result.ok)?.result as { ok: true; data: any } | undefined;
  const metadataMatch = task.match(/metadata:\s*([A-Za-z0-9_-]+),\s*decimals\s*(\d+)/i);
  const tokenMetadata = { symbol: metadataMatch?.[1] ?? "USDT", decimals: Number(metadataMatch?.[2] ?? 6) };
  const toolExample = allowedNextTools[0] === "get_evidence"
    ? `{"action":"call_tool","tool":"get_evidence","arguments":{"sourceId":"${context.sourceId ?? "REQ-001"}"}}`
    : allowedNextTools[0] === "get_transaction"
      ? `{"action":"call_tool","tool":"get_transaction","arguments":{"txHash":"${context.txHash ?? "0x..."}"}}`
      : allowedNextTools[0] === "decode_transaction" && transactionResult
        ? JSON.stringify({ action: "call_tool", tool: "decode_transaction", arguments: { transaction: { id: transactionResult.data.hash, chain: "evm", tokenAddress: transactionResult.data.to, calldata: transactionResult.data.input, decimals: tokenMetadata.decimals, symbol: tokenMetadata.symbol } } })
      : allowedNextTools[0] === "verify_transaction" && evidenceResult && decodedResult
        ? JSON.stringify({ action: "call_tool", tool: "verify_transaction", arguments: { authorityEvidence: evidenceResult.data.evidence ?? evidenceResult.data, onchainEvidence: decodedResult.data.onchainEvidence ?? [] } })
      : `{"action":"call_tool","tool":"${allowedNextTools[0] ?? "verify_transaction"}","arguments":{}}`;
  let response: Response;
  try {
    response = await fetchImpl(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        temperature: 0,
        max_tokens: 2048,
        chat_template_kwargs: { enable_thinking: false },
        messages: [
          { role: "system", content: AGENT_SYSTEM_PROMPT },
          { role: "user", content: `Task: ${task}\nAllowed next: ${allowedText}. ${nextInstruction}\nReturn exactly this envelope shape: ${toolExample}\nState: ${JSON.stringify(contextSummary)}${options?.retryMessage ? `\nINVALID PREVIOUS RESPONSE: ${options.retryMessage}\nReturn exactly the required envelope. Do not use a tool name as the action.` : ""}` },
        ],
      }),
    });
  } catch (error) {
    throw new QvacError("QVAC_UNAVAILABLE", error instanceof Error ? error.message : "QVAC request failed");
  }
  if (!response.ok) throw new QvacError("QVAC_HTTP_ERROR", `QVAC returned HTTP ${response.status}`);
  const payload = await response.json() as { choices?: Array<{ message?: { content?: unknown }; reasoning_content?: unknown }> };
  debugQvac("model", model);
  debugQvac("step", context.step);
  debugQvac("tool history", context.toolResults.map((entry) => ({ tool: entry.tool, ok: entry.result.ok })));
  debugQvac("raw response payload", payload);
  const raw = payload.choices?.[0]?.message?.content;
  debugQvac("raw model response", raw);
  if (typeof raw !== "string" || !raw.trim()) throw new QvacError("QVAC_EMPTY_RESPONSE", "QVAC returned an empty model response");
  let parsed: unknown;
  const normalizedRaw = normalizeJsonResponse(raw);
  try { parsed = JSON.parse(normalizedRaw); } catch { debugQvac("parsed candidate", "JSON.parse failed"); throw new QvacError("MALFORMED_JSON", "QVAC returned malformed JSON"); }
  debugQvac("parsed candidate", parsed);
  const validated = agentActionSchema.safeParse(parsed);
  if (!validated.success) { debugQvac("schema validation errors", validated.error.issues); throw new QvacError("SCHEMA_VALIDATION_FAILED", `Invalid agent action: ${validated.error.message}`); }
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

export async function runAgent(task: string, options: { evidenceStore?: EvidenceStore; rpcUrl?: string; transactionClient?: any; baseUrl?: string; model?: string; fetchImpl?: typeof fetch; maxSteps?: number; maxRetries?: number; mockQvacAction?: () => unknown } = {}): Promise<OrchestratorResult> {
  const maxSteps = options.maxSteps ?? MAX_TOOL_STEPS;
  const maxRetries = options.maxRetries ?? MAX_RETRIES;
  const evidenceStore = options.evidenceStore ?? createEvidenceStore();
  const context: OrchestratorContext = { task, ...parseTask(task), toolResults: [], step: 0 };
  const steps: ExecutionStep[] = [];
  let retryCount = 0;
  let verificationPerformed = false;
  let verificationVerdict: "APPROVE" | "BLOCK" | "REVIEW" | undefined;
  let verificationReasons: string[] = [];
  let retryMessage: string | undefined;

  while (context.step < maxSteps) {
    context.step += 1;
    const startedAt = Date.now();
    let action: unknown;
    try {
      action = options.mockQvacAction ? options.mockQvacAction() : await callQvacForAction(task, context, { baseUrl: options.baseUrl, model: options.model, fetchImpl: options.fetchImpl, retryMessage });
    } catch (error) {
      const code = error instanceof QvacError ? error.code : "QVAC_UNAVAILABLE";
      const message = error instanceof Error ? error.message : "QVAC action failed";
      steps.push({ step: context.step, action: { action: "finish", summary: "" }, validation: "FAIL", error: `${code}: ${message}`, latencyMs: Date.now() - startedAt, retries: retryCount });
      retryMessage = `${code}: ${message}`;
      if (retryCount < maxRetries && isTransientError(code)) { retryCount += 1; continue; }
      break;
    }
    const validated = agentActionSchema.safeParse(action);
    if (!validated.success) {
      steps.push({ step: context.step, action: { action: "finish", summary: "" }, validation: "FAIL", error: `Invalid agent action: ${validated.error.message}`, latencyMs: Date.now() - startedAt, retries: retryCount });
      retryMessage = validated.error.message;
      if (retryCount < maxRetries) { retryCount += 1; continue; }
      break;
    }
    const validAction = validated.data;
    retryMessage = undefined;
    if (validAction.action === "finish") {
      steps.push({ step: context.step, action: validAction, validation: "PASS", latencyMs: Date.now() - startedAt, retries: retryCount });
      break;
    }
    let toolResult: ToolResult<unknown>;
    try {
      toolResult = await executeTool(validAction.tool, validAction.arguments, { evidenceStore, rpcUrl: options.rpcUrl, transactionClient: options.transactionClient });
    } catch (error) {
      toolResult = { ok: false, error: "TOOL_EXECUTION_FAILED", message: error instanceof Error ? error.message : "Tool execution failed" };
    }
    steps.push({ step: context.step, action: validAction, validation: "PASS", toolResult, latencyMs: Date.now() - startedAt, retries: retryCount });
    if (!toolResult.ok && retryCount < maxRetries && isTransientError(toolResult.error)) { retryCount += 1; continue; }
    context.toolResults.push({ tool: validAction.tool, result: toolResult });
    if (validAction.tool === "verify_transaction" && toolResult.ok) {
      const data = toolResult.data as { verdict: "APPROVE" | "BLOCK" | "REVIEW"; reasons?: string[] };
      verificationPerformed = true;
      verificationVerdict = data.verdict;
      verificationReasons = data.reasons ?? [];
    }
  }

  const exceededLimit = context.step >= maxSteps;
  const hasOrchestrationFailure = steps.some((step) => step.validation === "FAIL");
  let finalVerdict: "APPROVE" | "BLOCK" | "REVIEW";
  let reason: string;
  if (verificationPerformed && verificationVerdict) { finalVerdict = verificationVerdict; reason = verificationReasons.length > 0 ? verificationReasons.join(", ") : "Deterministic safety verdict"; }
  else if (exceededLimit) { finalVerdict = "REVIEW"; reason = "TOOL_CHAIN_LIMIT_EXCEEDED"; }
  else if (hasOrchestrationFailure) { finalVerdict = "REVIEW"; reason = "TOOL_ORCHESTRATION_FAILED"; }
  else { finalVerdict = "REVIEW"; reason = "INCOMPLETE_TOOL_CHAIN"; }
  const unsafeApproval = finalVerdict === "APPROVE" && (!verificationPerformed || verificationVerdict !== "APPROVE");
  return checkWorkflowGuard({ finalVerdict, reason, steps, verificationPerformed, verificationVerdict, unsafeApproval });
}
