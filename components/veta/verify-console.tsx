"use client";

import { useState } from "react";
import type { DemoScenario } from "../../src/ui/demo-data";
import { ModeHealth } from "./mode-health";
import { VerdictCard } from "./verdict-card";

const featuredLabels: Record<string, string> = { A1: "Recipient Attack", G1: "Exact Match", A2: "Amount Mutation", B4: "Conflicting Authority", C1: "Prompt Injection", G7: "T3 Noise / T1 Wins" };
const short = (value: string) => value.length > 22 ? `${value.slice(0, 10)}…${value.slice(-8)}` : value;

export function VerifyConsole({ scenarios }: { scenarios: DemoScenario[] }) {
  const [selected, setSelected] = useState("A1");
  const scenario = scenarios.find((item) => item.id === selected) ?? scenarios[0];
  if (!scenario) return <div className="empty-state">Scenario data unavailable.</div>;
  return <>
    <div className="mode-strip"><span className="mode-pill demo">DEMO</span><span>Recorded / reproducible scenario</span><span className="mode-separator" /><ModeHealth /><span className="live-note">LOCAL LIVE is status-only; no browser tool execution.</span></div>
    <section className="hero-copy">
      <div><p className="kicker">TRANSACTION VERIFICATION INFRASTRUCTURE</p><h1>Verify before<br /><em>execution.</em></h1><p className="hero-sub">Local AI interprets. Evidence establishes authority. Deterministic code decides.</p></div>
      <div className="hero-aside"><span className="signal-line" />The model can fail.<br /><strong>The transaction should not.</strong></div>
    </section>
    <section className="scenario-picker" aria-label="Scenario selector">
      <div className="section-label">SELECT A RECORDED CASE <span>{scenarios.length} featured</span></div>
      <div className="scenario-buttons">{scenarios.map((item) => <button key={item.id} className={item.id === selected ? "scenario-button selected" : "scenario-button"} onClick={() => setSelected(item.id)}><span className="scenario-id">{item.id}</span><span>{featuredLabels[item.id] ?? item.title}</span><strong className={`mini-verdict ${item.actualVerdict.toLowerCase()}`}>{item.actualVerdict}</strong></button>)}</div>
    </section>
    <section className="comparison-grid">
      <div className="comparison-column authority-column"><div className="column-heading"><span className="column-index">01</span><div><p className="eyebrow">AUTHORITY / EVIDENCE</p><h2>What was authorized?</h2></div><span className="tier-chip t1">T1</span></div><div className="field-stack"><CompareField label="Recipient" value={scenario.authority.recipient} source="organizational evidence" /><CompareField label="Amount" value={`${scenario.authority.amount} ${scenario.authority.asset}`} source="expected value" /><CompareField label="Asset" value={scenario.authority.asset} source="field authority" /></div></div>
      <div className="comparison-column onchain-column"><div className="column-heading"><span className="column-index">02</span><div><p className="eyebrow">ONCHAIN EXECUTION</p><h2>What would execute?</h2></div><span className="tier-chip t0">T0</span></div><div className="field-stack"><CompareField label="Recipient" value={scenario.onchain.recipient} source="observed transaction" /><CompareField label="Amount" value={`${scenario.onchain.amount} ${scenario.onchain.asset}`} source="decoded calldata" /><CompareField label="Asset" value={scenario.onchain.asset} source="token metadata" /></div></div>
    </section>
    <section className="trace-panel"><div className="section-label">EVIDENCE TRACE <span>provenance preserved</span></div><div className="trace-list">{scenario.evidence.length ? scenario.evidence.map((item, index) => <div className="trace-item" key={`${item.sourceId}-${item.field}-${index}`}><span className={`trace-tier ${item.trustTier.slice(0, 2).toLowerCase()}`}>{item.trustTier.slice(0, 2)}</span><div className="trace-content"><strong>{item.sourceId}</strong><span>{item.field}: {short(item.value)}</span></div><span className="trace-role">{item.role === "UNTRUSTED" ? "not eligible for authorization" : item.role.toLowerCase()}</span></div>) : <div className="trace-empty">No evidence nodes available for this case.</div>}{scenario.ignored.map((id) => <div className="trace-item ignored" key={`ignored-${id}`}><span className="trace-tier t3">T3</span><div className="trace-content"><strong>{id}</strong><span>lower-trust evidence</span></div><span className="trace-role">ignored for authorization</span></div>)}<div className="trace-item"><span className="trace-tier t0">T0</span><div className="trace-content"><strong>TX-{scenario.id}</strong><span>decoded transaction</span></div><span className="trace-role">observed execution</span></div></div></section>
    <section className="checks-panel"><div className="section-label">DETERMINISTIC CHECKS <span>Safety Kernel output</span></div><div className="checks-list">{scenario.checks.map((check) => <div className="check-row" key={check.label}><span className={`check-icon ${check.status.toLowerCase()}`}>{check.status === "PASS" ? "✓" : check.status === "FAIL" ? "×" : "!"}</span><strong>{check.label}</strong><span className="check-detail">{check.detail}</span><span className={`check-status ${check.status.toLowerCase()}`}>{check.status}</span></div>)}</div></section>
    <div className="decision-layout"><VerdictCard scenario={scenario} /><aside className="scenario-context"><p className="eyebrow">CASE {scenario.id} · {scenario.executionMode}</p><h3>{scenario.description}</h3><p>Expected <strong>{scenario.expectedVerdict}</strong> · Recorded result <strong>{scenario.actualVerdict}</strong></p>{scenario.modelFailure && <p className="failure-note">Model/orchestration failure contained. No authorization granted.</p>}</aside></div>
  </>;
}

function CompareField({ label, value, source }: { label: string; value: string; source: string }) { return <div className="compare-field"><span className="field-label">{label}</span><strong className={label === "Recipient" ? "mono address" : "mono"}>{value}</strong><span className="field-source">{source}</span></div>; }
