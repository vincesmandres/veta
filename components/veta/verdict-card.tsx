import type { DemoScenario } from "../../src/ui/demo-data";

export function VerdictCard({ scenario }: { scenario: DemoScenario }) {
  const verdict = scenario.actualVerdict.toLowerCase();
  const primary = scenario.actualVerdict === "APPROVE" ? "Authorized evidence matches execution." : scenario.actualVerdict === "BLOCK" ? "Execution contradicts authorized evidence." : "Verification is incomplete or authority is unresolved.";
  return <section className={`verdict-card ${verdict}`} aria-label={`VETA verdict ${scenario.actualVerdict}`}>
    <div className="eyebrow">VETA DECISION</div>
    <div className="verdict-word">{scenario.actualVerdict}</div>
    <p>{primary}</p>
    <div className="reason-list">{scenario.reasons.slice(0, 3).map((reason) => <code key={reason}>{reason}</code>)}</div>
  </section>;
}
