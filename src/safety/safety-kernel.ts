import { getAddress } from "viem";
import type { EvidenceNode } from "../evidence/evidence-schema";
import type {
  VerificationCheck,
  VerificationResult,
  VerificationSeverity,
  Verdict,
} from "./verification-schema";
import { verificationResultSchema } from "./verification-schema";
import { getAuthoritativeEvidence, getExpectedValue, getOnchainEvidence, hasConflictingValues } from "./evidence-selector";

const CRITICAL: VerificationSeverity = "CRITICAL";
const WARNING: VerificationSeverity = "WARNING";
const INFO: VerificationSeverity = "INFO";

function normalizeAddress(value: string | null): string | null {
  if (!value) {
    return null;
  }
  try {
    return getAddress(value);
  } catch {
    return value.toLowerCase();
  }
}

function normalizeText(value: string | null): string | null {
  if (!value) {
    return null;
  }
  return value.trim().toLowerCase();
}

function makeCheck(
  type: VerificationCheck["type"],
  status: VerificationCheck["status"],
  severity: VerificationSeverity,
  reason: string,
  expected?: string,
  observed?: string,
): VerificationCheck {
  const check: VerificationCheck = { type, status, severity, reason };
  if (expected !== undefined) {
    check.expected = expected;
  }
  if (observed !== undefined) {
    check.observed = observed;
  }
  return check;
}

function findCriticalFailure(checks: VerificationCheck[]): VerificationCheck | undefined {
  return checks.find((check) => check.severity === CRITICAL && check.status === "FAIL");
}

export function runSafetyKernel(evidence: EvidenceNode[]): VerificationResult {
  const checks: VerificationCheck[] = [];
  const reasons: string[] = [];
  const evidenceUsed: string[] = [];

  const recipientAuthority = getAuthoritativeEvidence(evidence, "recipient");
  const recipientOnchain = getOnchainEvidence(evidence, "recipient");
  const recipientExpected = getExpectedValue(recipientAuthority);
  const recipientObserved = getExpectedValue(recipientOnchain);

  const amountAuthority = getAuthoritativeEvidence(evidence, "amount");
  const amountOnchain = getOnchainEvidence(evidence, "amount");
  const amountExpected = getExpectedValue(amountAuthority);
  const amountObserved = getExpectedValue(amountOnchain);

  const assetAuthority = getAuthoritativeEvidence(evidence, "asset");
  const assetOnchain = getOnchainEvidence(evidence, "asset");
  const assetExpected = getExpectedValue(assetAuthority);
  const assetObserved = getExpectedValue(assetOnchain);

  const recipientCheck = verifyField(
    "RECIPIENT_MATCH",
    recipientExpected,
    recipientObserved,
    normalizeAddress,
    hasConflictingValues(recipientAuthority),
  );
  checks.push(recipientCheck);
  collectEvidence(evidenceUsed, recipientAuthority, recipientOnchain);

  const amountCheck = verifyField(
    "AMOUNT_MATCH",
    amountExpected,
    amountObserved,
    normalizeText,
    hasConflictingValues(amountAuthority),
  );
  checks.push(amountCheck);
  collectEvidence(evidenceUsed, amountAuthority, amountOnchain);

  const assetCheck = verifyField(
    "ASSET_MATCH",
    assetExpected,
    assetObserved,
    normalizeText,
    hasConflictingValues(assetAuthority),
  );
  checks.push(assetCheck);
  collectEvidence(evidenceUsed, assetAuthority, assetOnchain);

  const evidenceComplete = hasAuthoritativeValue(recipientExpected)
    && hasAuthoritativeValue(amountExpected)
    && hasAuthoritativeValue(assetExpected)
    && hasOnchainValue(recipientObserved)
    && hasOnchainValue(amountObserved)
    && hasOnchainValue(assetObserved);

  checks.push(
    makeCheck(
      "EVIDENCE_COMPLETE",
      evidenceComplete ? "PASS" : "FAIL",
      evidenceComplete ? INFO : WARNING,
      evidenceComplete
        ? "Authoritative and onchain evidence available for recipient, amount and asset"
        : "Missing authoritative or onchain evidence for one or more critical fields",
    ),
  );

  const verdict = determineVerdict(checks);
  if (verdict === "BLOCK") {
    for (const failed of checks.filter((check) => check.status === "FAIL" && check.severity === CRITICAL)) {
      if (failed.reason) reasons.push(failed.reason);
    }
  } else if (verdict === "REVIEW") {
    if (!evidenceComplete) {
      reasons.push("INSUFFICIENT_EVIDENCE");
    }
    const unknown = checks.find((check) => check.status === "UNKNOWN");
    if (unknown?.reason) {
      reasons.push(unknown.reason);
    }
  }

  return verificationResultSchema.parse({
    verdict,
    checks,
    reasons,
    evidenceUsed: Array.from(new Set(evidenceUsed)),
  });
}

function verifyField(
  type: VerificationCheck["type"],
  expected: string | null,
  observed: string | null,
  normalize: (value: string | null) => string | null,
  conflictingAuthority = false,
): VerificationCheck {
  if (conflictingAuthority) {
    return makeCheck(type, "UNKNOWN", WARNING, "CONFLICTING_AUTHORITY", undefined, observed ?? undefined);
  }
  if (!expected && !observed) {
    return makeCheck(type, "UNKNOWN", WARNING, `No evidence available for ${type}`, expected ?? undefined, observed ?? undefined);
  }
  if (!expected) {
    return makeCheck(type, "UNKNOWN", WARNING, `No authoritative evidence for ${type}`, undefined, observed ?? undefined);
  }
  if (!observed) {
    return makeCheck(type, "UNKNOWN", WARNING, `No onchain evidence for ${type}`, expected ?? undefined, undefined);
  }

  const normalizedExpected = normalize(expected);
  const normalizedObserved = normalize(observed);

  if (normalizedExpected === normalizedObserved) {
    return makeCheck(type, "PASS", INFO, `${type} matches`, expected, observed);
  }

  return makeCheck(type, "FAIL", CRITICAL, `${type} mismatch`, expected, observed);
}

function determineVerdict(checks: VerificationCheck[]): Verdict {
  if (findCriticalFailure(checks)) {
    return "BLOCK";
  }

  const hasUnknown = checks.some((check) => check.status === "UNKNOWN");
  if (hasUnknown) {
    return "REVIEW";
  }

  return "APPROVE";
}

function hasAuthoritativeValue(value: string | null): boolean {
  return typeof value === "string" && value.length > 0;
}

function hasOnchainValue(value: string | null): boolean {
  return typeof value === "string" && value.length > 0;
}

function collectEvidence(evidenceUsed: string[], ...groups: EvidenceNode[][]): void {
  for (const group of groups) {
    for (const node of group) {
      if (node.sourceId && !evidenceUsed.includes(node.sourceId)) {
        evidenceUsed.push(node.sourceId);
      }
    }
  }
}
