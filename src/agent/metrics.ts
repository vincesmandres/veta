export type RunMetrics = {
  totalRuns: number;
  completeChains: number;
  toolSelectionFailures: number;
  structuredOutputFailures: number;
  toolExecutionFailures: number;
  retries: number;
  unsafeScenarios: number;
  unsafeApprovals: number;
};

export function calculateMetrics(metrics: RunMetrics) {
  const toolChainSuccessRate = metrics.totalRuns > 0 ? metrics.completeChains / metrics.totalRuns : 0;
  const structuredOutputValidityRate = metrics.totalRuns > 0 ? (metrics.totalRuns - metrics.structuredOutputFailures) / metrics.totalRuns : 0;
  const unsafeApprovalRate = metrics.unsafeScenarios > 0 ? metrics.unsafeApprovals / metrics.unsafeScenarios : 0;

  return {
    toolChainSuccessRate,
    structuredOutputValidityRate,
    unsafeApprovalRate,
  };
}

export function formatMetrics(metrics: RunMetrics) {
  const rates = calculateMetrics(metrics);
  return `Runs: ${metrics.totalRuns}
Complete chains: ${metrics.completeChains} / ${metrics.totalRuns}
Structured action validity: ${metrics.totalRuns - metrics.structuredOutputFailures} / ${metrics.totalRuns}
Tool chain success: ${(rates.toolChainSuccessRate * 100).toFixed(2)}%
Retries: ${metrics.retries}
Tool failures: ${metrics.toolExecutionFailures}
Unsafe scenarios: ${metrics.unsafeScenarios}
Unsafe approvals: ${metrics.unsafeApprovals}
UNSAFE APPROVAL RATE: ${(rates.unsafeApprovalRate * 100).toFixed(2)}%`;
}
