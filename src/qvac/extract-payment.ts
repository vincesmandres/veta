import { paymentIntentSchema, type PaymentIntent } from "./payment-schema";

const DEFAULT_BASE_URL = "http://127.0.0.1:11434/v1";
const DEFAULT_MODEL = "veta-local";

const SYSTEM_PROMPT = `You extract structured payment information.
Return ONLY one valid JSON object. No thinking, tags, Markdown, or explanation.
Always include exactly these keys: operation, invoiceId, amount, asset, counterparty.
Use operation "payment", a JSON number for amount, and null for invoiceId when absent.
Copy an invoice ID explicitly present after the word invoice. Do not invent information.`;

export type InferenceObservation = {
  model: string;
  input: string;
  latencyMs: number;
  schemaResult: "PASS" | "FAIL";
  success: boolean;
  errorReason: string | null;
};

export type ExtractionResult = {
  paymentIntent: PaymentIntent;
  raw: string;
  observation: InferenceObservation;
};

export class QvacError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
    this.name = "QvacError";
  }
}

type ExtractOptions = {
  baseUrl?: string;
  model?: string;
  fetchImpl?: typeof fetch;
};

type ChatCompletionResponse = {
  choices?: Array<{ message?: { content?: unknown } }>;
};

function debugQvac(label: string, value: unknown): void {
  if (process.env.VETA_DEBUG_QVAC === "1") {
    console.error(`[QVAC DEBUG] ${label}:`, typeof value === "string" ? value : JSON.stringify(value, null, 2));
  }
}

function isFetchConnectionError(error: unknown): boolean {
  return error instanceof TypeError;
}

export async function extractPayment(
  input: string,
  options: ExtractOptions = {},
): Promise<ExtractionResult> {
  const model = options.model ?? process.env.VETA_QVAC_MODEL ?? DEFAULT_MODEL;
  const baseUrl = (options.baseUrl ?? process.env.VETA_QVAC_URL ?? DEFAULT_BASE_URL).replace(/\/$/, "");
  const fetchImpl = options.fetchImpl ?? fetch;
  const startedAt = Date.now();
  let raw = "";
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
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: input },
        ],
      }),
    });
  } catch (error) {
    if (isFetchConnectionError(error)) {
      throwInferenceError(new QvacError("QVAC_UNAVAILABLE", "QVAC local server is unavailable"), model, input, startedAt, raw);
    }
    throwInferenceError(new QvacError("UNEXPECTED_QVAC_ERROR", error instanceof Error ? error.message : "Unexpected QVAC request error"), model, input, startedAt, raw);
  }

  debugQvac("HTTP status", response.status);

  if (!response.ok) {
    throwInferenceError(new QvacError("QVAC_HTTP_ERROR", `QVAC returned HTTP ${response.status}: ${response.statusText || "request failed"}`), model, input, startedAt, raw);
  }

  let payload: ChatCompletionResponse;
  try {
    payload = await response.json() as ChatCompletionResponse;
  } catch (error) {
    throwInferenceError(new QvacError("QVAC_HTTP_ERROR", error instanceof Error ? `QVAC returned an invalid JSON response: ${error.message}` : "QVAC returned an invalid JSON response"), model, input, startedAt, raw);
  }

  debugQvac("response payload", payload);
  debugQvac("choices[0]", payload.choices?.[0]);
  debugQvac("message", payload.choices?.[0]?.message);
  debugQvac("message.content", payload.choices?.[0]?.message?.content);

  if (typeof payload.choices?.[0]?.message?.content !== "string") {
    throwInferenceError(new QvacError("QVAC_EMPTY_RESPONSE", "QVAC returned an empty model response"), model, input, startedAt, raw);
  }
  raw = payload.choices[0].message.content;
  if (!raw.trim()) {
    throwInferenceError(new QvacError("QVAC_EMPTY_RESPONSE", "QVAC returned an empty model response"), model, input, startedAt, raw);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throwInferenceError(new QvacError("MALFORMED_JSON", "QVAC returned malformed JSON"), model, input, startedAt, raw);
  }

  const validated = paymentIntentSchema.safeParse(parsed);
  if (!validated.success) {
    const details = validated.error.issues
      .map((issue) => `${issue.path.join(".")} ${issue.message}`)
      .join("; ");
    throwInferenceError(new QvacError("SCHEMA_VALIDATION_FAILED", `Payment intent failed validation: ${details}`), model, input, startedAt, raw);
  }

  return {
    paymentIntent: validated.data,
    raw,
    observation: {
      model,
      input,
      latencyMs: Date.now() - startedAt,
      schemaResult: "PASS",
      success: true,
      errorReason: null,
    },
  };
}

function throwInferenceError(
  error: QvacError,
  model: string,
  input: string,
  startedAt: number,
  raw: string,
): never {
  const observation: InferenceObservation = {
    model,
    input,
    latencyMs: Date.now() - startedAt,
    schemaResult: "FAIL",
    success: false,
    errorReason: error.code,
  };
  console.error(`${error.code}: ${error.message}`);
  throw Object.assign(error, { observation, raw });
}
