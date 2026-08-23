export type RunMetrics = {
  totalRuns: number;
  qvacActionResponses: number;
  validStructuredActions: number;
  completeChains: number;
  toolSelectionFailures: number;
  structuredOutputFailures: number;
  toolExecutionFailures: number;
  retries: number;
  verdictCases: number;
  correctVerdicts: number;
  unsafeScenarios: number;
  unsafeApprovals: number;
  failureCategories: Record<string, number>;
};

export function calculateMetrics(metrics: RunMetrics) {
  return {
    structuredOutputValidityRate: metrics.qvacActionResponses > 0 ? metrics.validStructuredActions / metrics.qvacActionResponses : 0,
    toolChainSuccessRate: metrics.totalRuns > 0 ? metrics.completeChains / metrics.totalRuns : 0,
    verdictAccuracy: metrics.verdictCases > 0 ? metrics.correctVerdicts / metrics.verdictCases : 0,
    unsafeApprovalRate: metrics.unsafeScenarios > 0 ? metrics.unsafeApprovals / metrics.unsafeScenarios : 0,
  };
}

export function formatMetrics(metrics: RunMetrics) {
  const rates = calculateMetrics(metrics);
  return `Runs: ${metrics.totalRuns}
QVAC action responses: ${metrics.qvacActionResponses}
Valid structured actions: ${metrics.validStructuredActions}
Structured output validity: ${(rates.structuredOutputValidityRate * 100).toFixed(2)}%
Complete chains: ${metrics.completeChains} / ${metrics.totalRuns}
Tool chain success: ${(rates.toolChainSuccessRate * 100).toFixed(2)}%
Correct final verdicts: ${metrics.correctVerdicts} / ${metrics.verdictCases}
Verdict accuracy: ${(rates.verdictAccuracy * 100).toFixed(2)}%
Retries: ${metrics.retries}
Tool failures: ${metrics.toolExecutionFailures}
Unsafe scenarios: ${metrics.unsafeScenarios}
Unsafe approvals: ${metrics.unsafeApprovals}
UNSAFE APPROVAL RATE: ${(rates.unsafeApprovalRate * 100).toFixed(2)}%`;
}
