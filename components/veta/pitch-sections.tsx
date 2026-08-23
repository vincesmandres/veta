import Link from "next/link";
import type { DemoScenario } from "../../src/ui/demo-data";
import type { M7Artifact } from "../../src/ui/m7-artifact";

const percent = (value: number | null) => value === null ? "N/A" : `${(value * 100).toFixed(2)}%`;
const latency = (value: number | null) => value === null ? "N/A" : `${(value / 1000).toFixed(1)} s`;

export function Hero() {
  return (
    <section className="hero" aria-labelledby="hero-title">
      <div className="container hero-grid">
        <div>
          <h1 className="hero-title" id="hero-title">VETA</h1>
          <p className="hero-name">Verificacion de Evidencia y Transacciones Autonomas</p>
          <p className="hero-copy">A local-first verification layer for autonomous onchain transactions.</p>
          <p className="hero-tagline">Interpret with AI.<br />Verify with evidence.<br />Trust with code.</p>
          <div className="hero-actions">
            <a className="button primary" href="#demo">See VETA catch a bad transaction</a>
            <a className="button secondary" href="#reliability">View reliability results</a>
          </div>
        </div>
        <aside className="hero-side" aria-label="VETA runtime properties">
          <span className="hero-status">DEMO MODE</span>
          <div className="hero-signal"><strong>LOCAL FIRST</strong><span>QVAC interprets on the local runtime.</span></div>
          <div className="hero-signal"><strong>EVM + EVIDENCE</strong><span>Execution is compared with authorized expectations.</span></div>
          <div className="hero-signal"><strong>FAIL CLOSED</strong><span>Incomplete verification cannot approve.</span></div>
        </aside>
      </div>
    </section>
  );
}

export function Problem({ scenario }: { scenario: DemoScenario }) {
  return (
    <section className="section" aria-labelledby="problem-title">
      <div className="container problem-layout">
        <div>
          <p className="section-kicker">01 / The problem</p>
          <h2 className="problem-statement" id="problem-title">A VALID TRANSACTION<br />CAN STILL BE<br /><span>THE WRONG TRANSACTION.</span></h2>
        </div>
        <div className="problem-proof" aria-label="Authorized and onchain recipient mismatch">
          <div className="problem-compare">
            <div className="problem-cell">
              <p className="mini-label">Authorized</p>
              <strong className="problem-value">{scenario.authority.amount} {scenario.authority.asset}</strong>
              <span className="problem-address">to {shortAddress(scenario.authority.recipient)}</span>
            </div>
            <div className="problem-cell">
              <p className="mini-label">Onchain</p>
              <strong className="problem-value">{scenario.onchain.amount} {scenario.onchain.asset}</strong>
              <span className="problem-address">to {shortAddress(scenario.onchain.recipient)}</span>
            </div>
          </div>
          <div className="problem-summary">
            <div><span className="mini-label">Blockchain validation</span><strong>PASS</strong></div>
            <div><span className="mini-label">Human intent</span><strong>FAIL</strong></div>
            <div><span className="mini-label">VETA</span><strong>{scenario.actualVerdict}</strong></div>
          </div>
        </div>
      </div>
    </section>
  );
}

export function HowVetaWorks() {
  return (
    <section className="section" id="architecture" aria-labelledby="architecture-title">
      <div className="container">
        <p className="section-kicker">02 / How VETA works</p>
        <h2 className="section-title" id="architecture-title">Local interpretation.<br />Deterministic verification.</h2>
        <p className="section-lead">QVAC can interpret intent and select registered tools. It cannot authorize the transaction or override evidence.</p>

        <div className="architecture-layout">
          <div className="flow-board" aria-label="VETA verification flow">
            <div className="flow-columns">
              <div className="flow-stack">
                <div className="flow-node">INTENT / EVIDENCE</div><div className="flow-arrow">↓</div>
                <div className="flow-node">QVAC LOCAL</div><div className="flow-arrow">↓</div>
                <div className="flow-node">PROVENANCE</div><div className="flow-arrow">↓</div>
                <div className="flow-node authority">AUTHORITY ENGINE</div>
              </div>
              <div className="flow-stack">
                <div className="flow-node">PROPOSED TX</div><div className="flow-arrow">↓</div>
                <div className="flow-node">EVM DECODER</div><div className="flow-arrow">↓</div>
                <div className="flow-node onchain">T0 ONCHAIN</div>
              </div>
            </div>
            <div className="flow-merge">
              <span className="mini-label">Authority + T0</span>
              <div className="flow-arrow">↓</div>
              <div className="flow-node">SAFETY KERNEL</div>
              <div className="flow-arrow">↓</div>
              <div className="verdict-row"><span className="verdict-token approve">APPROVE</span><span className="verdict-token block">BLOCK</span><span className="verdict-token review">REVIEW</span></div>
            </div>
          </div>
          <aside className="role-card">
            <p className="mini-label">QVAC role</p>
            <h3>QVAC interprets.<br />VETA verifies.<br />Code authorizes.</h3>
            <ul className="role-list">
              <li className="role-ok">+ intent extraction</li>
              <li className="role-ok">+ tool orchestration</li>
              <li className="role-no">- transaction authorization</li>
              <li className="role-no">- authority override</li>
              <li className="role-no">- blockchain override</li>
            </ul>
          </aside>
        </div>
        <p className="architecture-thesis">AI may interpret. AI may orchestrate. AI may fail. <span className="mono">AI cannot authorize.</span></p>
      </div>
    </section>
  );
}

export function ModelFailureProof({ artifact }: { artifact: M7Artifact }) {
  const failures = Object.keys(artifact.failureTaxonomy)
    .filter((code) => code.includes("MODEL") || code.includes("TOOL") || code.includes("INCOMPLETE"))
    .slice(0, 5);

  return (
    <section className="section" aria-labelledby="failure-title">
      <div className="container failure-layout">
        <div>
          <p className="section-kicker">05 / Real model failure proof</p>
          <h2 className="failure-number" id="failure-title">{artifact.counts.modelFailures} OBSERVED<br />MODEL FAILURES<br /><span>{artifact.counts.unsafeApprovals} UNSAFE APPROVALS</span></h2>
          <p className="failure-copy">QVAC did not behave perfectly. VETA did not require it to. A model or tool-chain failure is contained as an incomplete verification result.</p>
          <div className="failure-tags" aria-label="Observed failure categories">
            {failures.map((failure) => <span className="failure-tag" key={failure}>{humanizeCode(failure)}</span>)}
          </div>
        </div>
        <div className="failure-flow" aria-label="Fail closed path">
          <span>MODEL FAILURE</span><em>↓</em><span>INCOMPLETE VERIFICATION</span><em>↓</em><strong>REVIEW</strong><em>↓</em><span>NO AUTHORIZATION</span>
          <p className="section-lead">Small model failure does not equal unsafe financial approval.</p>
        </div>
      </div>
    </section>
  );
}

export function ReliabilitySnapshot({ artifact }: { artifact: M7Artifact }) {
  const total = artifact.dataset.total;
  const outcomes = [
    ["APPROVE", artifact.counts.approvals, "approve"],
    ["BLOCK", artifact.counts.blocks, "block"],
    ["REVIEW", artifact.counts.reviews, "review"],
  ] as const;
  const metrics = [
    [String(total), "total scenarios", "purple"],
    [percent(artifact.metrics.unsafeApprovalRate), "unsafe approval rate", "red"],
    [percent(artifact.metrics.safeApprovalRate), "safe approval rate", "green"],
    [percent(artifact.metrics.verdictAccuracy), "verdict accuracy", "purple"],
    [percent(artifact.metrics.modelFailureContainmentRate), "model failure containment", "amber"],
  ] as const;

  return (
    <section className="section" id="reliability" aria-labelledby="reliability-title">
      <div className="container">
        <p className="section-kicker">06 / Balanced reliability</p>
        <h2 className="section-title" id="reliability-title">Proof, not a promise.</h2>
        <p className="section-lead">The versioned M7 artifact measures {artifact.dataset.unsafe} unsafe scenarios and {artifact.dataset.safe} safe controls. The UI reads these recorded results directly.</p>

        <div className="metric-grid">
          {metrics.map(([value, label, tone]) => <div className={`metric ${tone}`} key={label}><span className="mini-label">{label}</span><strong>{value}</strong></div>)}
        </div>

        <div className="reliability-lower">
          <div>
            <p className="mini-label">Outcome distribution</p>
            <div className="outcome-list">
              {outcomes.map(([label, count, tone]) => <div className="outcome-row" key={label}><span>{label}</span><span className="outcome-track"><i className={`outcome-fill ${tone}`} style={{ width: `${(count / total) * 100}%` }} /></span><strong>{count}</strong></div>)}
            </div>
            <div className="secondary-metrics">
              <div><span>Block recall</span><strong>{percent(artifact.metrics.blockRecall)}</strong></div>
              <div><span>Approval precision</span><strong>{percent(artifact.metrics.approvalPrecision)}</strong></div>
              <div><span>Prompt injection containment</span><strong>{percent(artifact.metrics.promptInjectionContainmentRate)}</strong></div>
            </div>
          </div>
          <div>
            <div className="fail-closed"><strong>VETA fails closed.</strong><p>When authority or execution cannot be established, the system refuses to guess. REVIEW grants no authorization.</p></div>
            <div className="degradations" aria-label="Conservative degradations">
              {artifact.conservativeDegradations.map((item) => <div className="degradation" key={item.scenarioId}><span className="mini-label">Conservative degradation</span><strong>{item.scenarioId}</strong><p>Expected BLOCK. Actual <b>REVIEW</b>. The model did not finish verification, so VETA did not approve.</p></div>)}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export function QvacProof({ artifact, model, ctxSize }: { artifact: M7Artifact; model: string; ctxSize: number }) {
  const realQvac = artifact.byExecutionMode.REAL_QVAC;
  const quantization = model.match(/Q\d+/)?.[0] ?? "Q4";
  return (
    <section className="section" aria-labelledby="qvac-title">
      <div className="container qvac-layout">
        <div className="local-machine">
          <p className="mini-label">QVAC / Local</p>
          <h2 className="section-title" id="qvac-title">Local machine.<br />Local inference.</h2>
          <div className="machine-flow"><span>LOCAL MACHINE</span><b>↓</b><span>QVAC</span><b>↓</b><span>VETA</span></div>
        </div>
        <div>
          <p className="section-kicker">07 / Real QVAC</p>
          <div className="qvac-grid">
            <QvacItem label="Model" value={model} />
            <QvacItem label="Quantization" value={quantization} />
            <QvacItem label="Context" value={String(ctxSize)} />
            <QvacItem label="Hardware" value={`${artifact.runtime.hardware.cpu ?? "not recorded"} / ${artifact.runtime.hardware.ramGiB ?? "?"} GiB`} />
            <QvacItem label="Real QVAC" value={`${realQvac.scenarios} runs / ${percent(realQvac.accuracy)} accuracy`} />
            <QvacItem label="Average latency" value={latency(realQvac.averageLatencyMs)} />
            <div className="qvac-note">{artifact.counts.modelFailures} observed model failures. {artifact.counts.unsafeApprovals} unsafe approvals. No cloud model API is used by the product runtime.</div>
          </div>
        </div>
      </div>
    </section>
  );
}

export function SepoliaProof() {
  return (
    <section className="section" aria-labelledby="sepolia-title">
      <div className="container">
        <p className="section-kicker">08 / Real network proof</p>
        <div className="sepolia-card">
          <div className="sepolia-intro">
            <p className="mini-label">Controlled authority experiment</p>
            <h2 id="sepolia-title">Sepolia<br />read-only proof.</h2>
            <p>VETA fetched and decoded a public ERC-20 transfer. The authority fixture is controlled test evidence, not a claim about the historical transaction request.</p>
            <a className="evidence-link" href="https://github.com/vincesmandres/veta/blob/main/docs/reality-check.md" target="_blank" rel="noreferrer">VIEW REALITY CHECK ↗</a>
          </div>
          <div className="sepolia-data">
            <DataItem label="Network" value="Sepolia" />
            <DataItem label="Block" value="10668431" />
            <DataItem label="Function" value="transfer(address,uint256)" />
            <DataItem label="Token / Amount" value="LINK / 25 LINK" />
            <DataItem label="Transaction" value="0x3518fd656c282cb7f9aaf8ab1e61b86f0344d43980d7b0da730a4a22efaeea91" full />
            <DataItem label="Recipient" value="0x3eB227Fd628cCB18DAa2fb2bB28034D3B8c1C967" full />
            <div className="sepolia-verdicts"><div className="approve">Controlled authority match → APPROVE</div><div className="block">Controlled recipient mismatch → BLOCK</div></div>
          </div>
        </div>
      </div>
    </section>
  );
}

export function FinalCta() {
  return (
    <section className="final-section">
      <div className="container">
        <h2 className="final-title">THE MODEL CAN FAIL.<br /><span>THE TRANSACTION SHOULD NOT.</span></h2>
        <p className="final-copy">VETA<br />Interpret with AI. Verify with evidence. Trust with code.</p>
        <div className="final-links">
          <a className="button primary" href="https://github.com/vincesmandres/veta" target="_blank" rel="noreferrer">GitHub</a>
          <Link className="button secondary" href="/reliability">Reliability</Link>
          <Link className="button secondary" href="/architecture">Architecture</Link>
        </div>
      </div>
    </section>
  );
}

function QvacItem({ label, value }: { label: string; value: string }) {
  return <div className="qvac-item"><span className="mini-label">{label}</span><strong>{value}</strong></div>;
}

function DataItem({ label, value, full = false }: { label: string; value: string; full?: boolean }) {
  return <div className={`sepolia-item ${full ? "full" : ""}`}><span className="mini-label">{label}</span><span className="sepolia-value">{value}</span></div>;
}

function shortAddress(value: string): string {
  return value.length > 18 ? `${value.slice(0, 8)}...${value.slice(-6)}` : value;
}

function humanizeCode(code: string): string {
  return code.replaceAll("_", " ").toLowerCase();
}
