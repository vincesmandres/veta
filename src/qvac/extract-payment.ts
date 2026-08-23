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

export async function extractPayment(
  input: string,
  options: ExtractOptions = {},
): Promise<ExtractionResult> {
  const model = options.model ?? process.env.VETA_QVAC_MODEL ?? DEFAULT_MODEL;
  const baseUrl = (options.baseUrl ?? process.env.VETA_QVAC_URL ?? DEFAULT_BASE_URL).replace(/\/$/, "");
  const fetchImpl = options.fetchImpl ?? fetch;
  const startedAt = Date.now();
  let raw = "";

  try {
    const response = await fetchImpl(`${baseUrl}/chat/completions`, {
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

    if (!response.ok) {
      throw new QvacError("QVAC_HTTP_ERROR", `QVAC returned HTTP ${response.status}: ${response.statusText || "request failed"}`);
    }

    let payload: ChatCompletionResponse;
    try {
      payload = await response.json() as ChatCompletionResponse;
    } catch {
      throw new QvacError("QVAC_HTTP_ERROR", "QVAC returned an invalid JSON response");
    }

    if (typeof payload.choices?.[0]?.message?.content !== "string") {
      throw new QvacError("QVAC_EMPTY_RESPONSE", "QVAC returned an empty model response");
    }
    raw = payload.choices[0].message.content;
    if (!raw.trim()) {
      throw new QvacError("QVAC_EMPTY_RESPONSE", "QVAC returned an empty model response");
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new QvacError("MALFORMED_JSON", "QVAC returned malformed JSON");
    }

    const validated = paymentIntentSchema.safeParse(parsed);
    if (!validated.success) {
      const details = validated.error.issues
        .map((issue) => `${issue.path.join(".")} ${issue.message}`)
        .join("; ");
      throw new QvacError("SCHEMA_VALIDATION_FAILED", `Payment intent failed validation: ${details}`);
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
  } catch (error) {
    const qvacError = error instanceof QvacError
      ? error
      : new QvacError("QVAC_UNAVAILABLE", "QVAC local server is unavailable");
    const observation: InferenceObservation = {
      model,
      input,
      latencyMs: Date.now() - startedAt,
      schemaResult: "FAIL",
      success: false,
      errorReason: qvacError.code,
    };
    console.error(`${qvacError.code}: ${qvacError.message}`);
    throw Object.assign(qvacError, { observation, raw });
  }
}
