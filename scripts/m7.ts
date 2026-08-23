import { mkdirSync, writeFileSync } from "node:fs";
import {
  JUDGE_READINESS_SCENARIOS,
  createM7Report,
  renderM7Markdown,
  runAdversarialSuite,
} from "../src/adversarial";

function percent(value: number | null): string {
  return value === null ? "N/A" : `${(value * 100).toFixed(2)}%`;
}

async function main(): Promise<void> {
  console.log("VETA — M7 BALANCED RELIABILITY REPORT\n");
  const { results } = await runAdversarialSuite(JUDGE_READINESS_SCENARIOS);
  const report = createM7Report(JUDGE_READINESS_SCENARIOS, results);
  const markdown = renderM7Markdown(report);

  mkdirSync("artifacts", { recursive: true });
  writeFileSync("artifacts/m7-balanced-reliability.json", JSON.stringify(report, null, 2));
  writeFileSync("artifacts/m7-balanced-reliability.md", markdown);

  console.log("DATASET");
  console.log(`Total: ${report.dataset.total}`);
  console.log(`Unsafe: ${report.dataset.unsafe}`);
  console.log(`Safe: ${report.dataset.safe}\n`);

  console.log("OUTCOMES");
  console.log(`APPROVE: ${report.counts.approvals}`);
  console.log(`BLOCK: ${report.counts.blocks}`);
  console.log(`REVIEW: ${report.counts.reviews}\n`);

  console.log("METRICS");
  console.log(`Verdict Accuracy: ${percent(report.metrics.verdictAccuracy)}`);
  console.log(`Unsafe Approval Rate: ${percent(report.metrics.unsafeApprovalRate)}`);
  console.log(`Safe Approval Rate: ${percent(report.metrics.safeApprovalRate)}`);
  console.log(`Review Rate: ${percent(report.metrics.reviewRate)}`);
  console.log(`Block Recall: ${percent(report.metrics.blockRecall)}`);
  console.log(`Approval Precision: ${percent(report.metrics.approvalPrecision)}`);
  console.log(`Model Failure Containment: ${percent(report.metrics.modelFailureContainmentRate)}`);
  console.log(`Prompt Injection Containment: ${percent(report.metrics.promptInjectionContainmentRate)}\n`);

  console.log("CONSERVATIVE DEGRADATIONS");
  console.log(report.counts.conservativeDegradations);
  for (const result of report.conservativeDegradations) console.log(`- ${result.scenarioId}: expected BLOCK -> REVIEW`);
  console.log(`\nSTATUS: ${report.status}`);
  console.log("ARTIFACTS");
  console.log("artifacts/m7-balanced-reliability.json");
  console.log("artifacts/m7-balanced-reliability.md");

  if (report.status === "FAIL") {
    console.error("\nM7 FAILED: unsafe approval or safe-control utility failure detected.");
    process.exitCode = 1;
  } else if (report.status === "PARTIAL") {
    console.warn("\nM7 PARTIAL: local QVAC was unavailable for every real-QVAC run.");
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
