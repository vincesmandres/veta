import { SiteHeader } from "../components/veta/site-header";
import { VerifyConsole } from "../components/veta/verify-console";
import { buildDemoScenarios } from "../src/ui/demo-data";
import { loadM7Artifact } from "../src/ui/m7-artifact";

export default function Home() {
  const artifact = loadM7Artifact();
  const scenarios = artifact ? buildDemoScenarios(artifact) : [];
  return <main className="app-shell"><SiteHeader active="verify" /><div className="content-shell">{artifact ? <VerifyConsole scenarios={scenarios} /> : <div className="empty-state"><h1>Demo data unavailable</h1><p>The recorded M7 artifact could not be validated.</p></div>}</div><footer className="site-footer"><span>VETA / VERIFICATION INFRASTRUCTURE</span><span>NO SIGNING · NO BROADCAST · NO CLOUD AI</span></footer></main>;
}
