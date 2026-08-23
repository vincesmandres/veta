import type { VerificationResult } from "./verification-schema";

export function explainVerdict(result: VerificationResult): string {
  const lines: string[] = [];
  lines.push(`VERDICT: ${result.verdict}`);
  lines.push("");
  lines.push("REASONS:");
  for (const reason of result.reasons) {
    lines.push(`- ${reason}`);
  }
  if (result.reasons.length === 0) {
    lines.push("- No blocking issues identified");
  }
  lines.push("");
  lines.push("CHECKS:");
  for (const check of result.checks) {
    lines.push(`- ${check.type}: ${check.status} (${check.severity})`);
    if (check.expected !== undefined) {
      lines.push(`  expected: ${check.expected}`);
    }
    if (check.observed !== undefined) {
      lines.push(`  observed: ${check.observed}`);
    }
    lines.push(`  reason: ${check.reason}`);
  }
  lines.push("");
  lines.push("EVIDENCE USED:");
  for (const id of result.evidenceUsed) {
    lines.push(`- ${id}`);
  }
  return lines.join("\n");
}
