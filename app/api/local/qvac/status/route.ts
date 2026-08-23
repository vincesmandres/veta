import { NextResponse } from "next/server";
import { qvacHealthResponseSchema } from "../../../../../src/ui/qvac-health";

export async function GET() {
  const endpoint = process.env.VETA_QVAC_URL ?? "http://127.0.0.1:11434/v1";
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 900);
  try {
    const response = await fetch(`${endpoint.replace(/\/$/, "")}/models`, { signal: controller.signal, cache: "no-store" });
    if (!response.ok) return NextResponse.json(qvacHealthResponseSchema.parse({ available: false }));
    const data = await response.json() as { data?: Array<{ id?: string }> };
    return NextResponse.json(qvacHealthResponseSchema.parse({ available: true, model: data.data?.[0]?.id }));
  } catch {
    return NextResponse.json(qvacHealthResponseSchema.parse({ available: false }));
  } finally { clearTimeout(timeout); }
}
