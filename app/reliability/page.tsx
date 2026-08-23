import qvacConfig from "../../qvac.config.json";
import { FinalCta, ModelFailureProof, QvacProof, ReliabilitySnapshot } from "../../components/veta/pitch-sections";
import { SiteHeader } from "../../components/veta/site-header";
import { loadM7Artifact } from "../../src/ui/m7-artifact";

export default function ReliabilityPage() {
  const artifact = loadM7Artifact();
  const localRuntime = qvacConfig.serve.models["veta-local"];

  if (!artifact || !localRuntime) {
    return <main className="page-shell"><SiteHeader active="reliability" /><div className="container fallback"><h1>Reliability artifact unavailable</h1><p>The checked-in M7 artifact could not be validated.</p></div></main>;
  }

  return (
    <main className="page-shell">
      <SiteHeader active="reliability" />
      <ReliabilitySnapshot artifact={artifact} />
      <ModelFailureProof artifact={artifact} />
      <QvacProof artifact={artifact} model={localRuntime.model} ctxSize={localRuntime.config.ctx_size} />
      <FinalCta />
      <footer className="footer">VETA / M7 BALANCED RELIABILITY ARTIFACT / RECORDED RESULTS</footer>
    </main>
  );
}
