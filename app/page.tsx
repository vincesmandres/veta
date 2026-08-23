import qvacConfig from "../qvac.config.json";
import { PitchDemo } from "../components/veta/pitch-demo";
import {
  FinalCta,
  Hero,
  HowVetaWorks,
  ModelFailureProof,
  Problem,
  QvacProof,
  ReliabilitySnapshot,
  SepoliaProof,
} from "../components/veta/pitch-sections";
import { SiteHeader } from "../components/veta/site-header";
import { buildDemoScenarios } from "../src/ui/demo-data";
import { loadM7Artifact } from "../src/ui/m7-artifact";

export default function Home() {
  const artifact = loadM7Artifact();
  const scenarios = artifact ? buildDemoScenarios(artifact) : [];
  const recipientAttack = scenarios.find((scenario) => scenario.id === "A1") ?? scenarios[0];
  const localRuntime = qvacConfig.serve.models["veta-local"];

  if (!artifact || !recipientAttack || !localRuntime) {
    return <main className="page-shell"><SiteHeader active="demo" /><div className="container fallback"><h1>Recorded demo evidence unavailable</h1><p>VETA could not validate the checked-in M7 artifact.</p></div></main>;
  }

  return (
    <main className="page-shell">
      <SiteHeader active="demo" />
      <Hero />
      <Problem scenario={recipientAttack} />
      <HowVetaWorks />
      <PitchDemo scenarios={scenarios} />
      <ModelFailureProof artifact={artifact} />
      <ReliabilitySnapshot artifact={artifact} />
      <QvacProof artifact={artifact} model={localRuntime.model} ctxSize={localRuntime.config.ctx_size} />
      <SepoliaProof />
      <FinalCta />
      <footer className="footer">VETA / RECORDED DEMO EVIDENCE / NO SIGNING / NO BROADCAST / NO CLOUD AI</footer>
    </main>
  );
}
