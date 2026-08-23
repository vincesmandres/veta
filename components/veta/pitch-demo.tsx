"use client";

import { useState } from "react";
import type { DemoEvidence, DemoScenario } from "../../src/ui/demo-data";

export function PitchDemo({ scenarios }: { scenarios: DemoScenario[] }) {
  const [selectedId, setSelectedId] = useState(scenarios[0]?.id ?? "");
  const scenario = scenarios.find((item) => item.id === selectedId) ?? scenarios[0];

  if (!scenario) {
    return <div className="fallback">Recorded scenario evidence is unavailable.</div>;
  }

  const verdictClass = scenario.actualVerdict.toLowerCase();
  const primaryReason = scenario.reasons[0] ?? "Verification did not establish a safe approval.";

  return (
    <section className="section" id="demo" aria-labelledby="demo-title">
      <div className="container">
        <p className="section-kicker">04 / Interactive verification</p>
        <h2 className="section-title" id="demo-title">See the evidence.<br />See the execution.<br />See the verdict.</h2>
        <p className="section-lead">Each recorded result comes from the versioned M7 artifact. Scenario selection changes presentation only; it never simulates or authorizes a transaction.</p>

        <div className="demo-wrap">
          <div className="scenario-tabs" role="group" aria-label="Recorded verification scenarios">
            {scenarios.map((item) => (
              <button
                key={item.id}
                type="button"
                className="scenario-tab"
                aria-pressed={item.id === scenario.id}
                onClick={() => setSelectedId(item.id)}
              >
                <span className="scenario-tab-id">{item.id}</span>
                <span className="scenario-tab-title">{item.title}</span>
                <span className={`scenario-tab-verdict ${item.actualVerdict.toLowerCase()}`}>{item.actualVerdict}</span>
              </button>
            ))}
          </div>

          <article className="demo-panel" aria-label={`${scenario.title}: ${scenario.actualVerdict}`}>
            <div className="comparison-grid">
              <ComparisonCard
                tone="authority"
                eyebrow="Authorized"
                title="Authority"
                tier="T1"
                recipient={scenario.authority.recipient}
                amount={`${scenario.authority.amount} ${scenario.authority.asset}`}
                asset={scenario.authority.asset}
                source="field-specific authority"
                mismatch={different(scenario.authority.recipient, scenario.onchain.recipient)}
              />
              <ComparisonCard
                tone="onchain"
                eyebrow="Observed"
                title="Onchain execution"
                tier="T0"
                recipient={scenario.onchain.recipient}
                amount={`${scenario.onchain.amount} ${scenario.onchain.asset}`}
                asset={scenario.onchain.asset}
                source="decoded transaction"
                mismatch={different(scenario.authority.recipient, scenario.onchain.recipient)}
              />
            </div>

            <div className="demo-lower">
              <div className="trace">
                <p className="mini-label">Evidence trace</p>
                <div className="trace-list">
                  {scenario.evidence.map((evidence, index) => <EvidenceRow evidence={evidence} key={`${evidence.sourceId}-${evidence.field}-${index}`} />)}
                  {scenario.ignored.map((id) => (
                    <div className="trace-row" key={id}>
                      <span className="tier t3">T3</span>
                      <div>
                        <span className="trace-source">{id}</span>
                        <span className="trace-detail">lower-authority evidence</span>
                      </div>
                      <span className="trace-role">ignored for authorization</span>
                    </div>
                  ))}
                  <div className="trace-row">
                    <span className="tier t0">T0</span>
                    <div>
                      <span className="trace-source">TX-{scenario.id}</span>
                      <span className="trace-detail">decoded transaction</span>
                    </div>
                    <span className="trace-role">observed execution</span>
                  </div>
                </div>
              </div>

              <div className="checks">
                <p className="mini-label">Deterministic checks</p>
                <div className="checks-list">
                  {scenario.checks.map((check) => (
                    <div className="check-row" key={check.label}>
                      <span className="check-name">{check.label}</span>
                      <span className="check-detail">{check.detail}</span>
                      <span className={`check-status ${check.status.toLowerCase()}`}>{check.status}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="verdict-panel">
              <div className={`verdict-card ${verdictClass}`}>
                <p className="mini-label">VETA verdict</p>
                <div className="verdict-word">{scenario.actualVerdict}</div>
                <p className="verdict-reason">{primaryReason}</p>
                <p className="verdict-copy">{verdictCopy(scenario.actualVerdict)}</p>
              </div>
              <div className="scenario-note">
                <p className="mini-label">Recorded case {scenario.id} / {scenario.executionMode}</p>
                <h3>{scenario.description}</h3>
                <p>Expected <strong>{scenario.expectedVerdict}</strong>. Recorded result <strong>{scenario.actualVerdict}</strong>.{scenario.modelFailure ? " Model or orchestration failure was contained; no authorization was granted." : ""}</p>
              </div>
            </div>
          </article>
        </div>
      </div>
    </section>
  );
}

function ComparisonCard({ tone, eyebrow, title, tier, recipient, amount, asset, source, mismatch }: {
  tone: "authority" | "onchain";
  eyebrow: string;
  title: string;
  tier: "T0" | "T1";
  recipient: string;
  amount: string;
  asset: string;
  source: string;
  mismatch: boolean;
}) {
  return (
    <section className={`comparison-card ${tone}`}>
      <div className="comparison-head">
        <div>
          <p className="mini-label">{eyebrow}</p>
          <h3>{title}</h3>
        </div>
        <span className={`tier ${tier.toLowerCase()}`}>{tier}</span>
      </div>
      <div className="field-grid">
        <Field label="Recipient" value={recipient} mono mismatch={mismatch} />
        <Field label="Amount" value={amount} />
        <Field label="Asset" value={asset} note={source} />
      </div>
    </section>
  );
}

function Field({ label, value, note, mono = false, mismatch = false }: { label: string; value: string; note?: string; mono?: boolean; mismatch?: boolean }) {
  return (
    <div>
      <span className="mini-label">{label}</span>
      <span className={`field-value ${mono ? "mono" : ""} ${mismatch ? "mismatch" : ""}`}>{value}</span>
      {note ? <span className="field-note">{note}</span> : null}
    </div>
  );
}

function EvidenceRow({ evidence }: { evidence: DemoEvidence }) {
  const tier = evidence.trustTier.slice(0, 2).toLowerCase();
  const isHostile = evidence.role === "UNTRUSTED" && evidence.text;
  return (
    <div className="trace-row">
      <span className={`tier ${tier}`}>{evidence.trustTier.slice(0, 2)}</span>
      <div>
        <span className="trace-source">{evidence.sourceId}</span>
        {isHostile ? <pre className="hostile-text">{evidence.text}</pre> : <span className="trace-detail">{friendlySource(evidence.sourceType)} / {evidence.field}: {evidence.value}</span>}
      </div>
      <span className="trace-role">{evidence.role === "UNTRUSTED" ? "not authority" : evidence.role.toLowerCase()}</span>
    </div>
  );
}

function different(left: string, right: string): boolean {
  if (left === "Not established" || right === "Not established") return false;
  return left.trim().toLowerCase() !== right.trim().toLowerCase();
}

function friendlySource(source: string): string {
  return source.replaceAll("_", " ");
}

function verdictCopy(verdict: DemoScenario["actualVerdict"]): string {
  if (verdict === "APPROVE") return "Authoritative evidence matches observed execution.";
  if (verdict === "BLOCK") return "Execution contradicts authorized evidence.";
  return "Authority or execution was not established. VETA refuses to guess.";
}
