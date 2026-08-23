import { SiteHeader } from "../../components/veta/site-header";
import { ReliabilityLab } from "../../components/veta/reliability-lab";
import { loadM7Artifact } from "../../src/ui/m7-artifact";

export default function ReliabilityPage() {
  const artifact = loadM7Artifact();
  return <main className="app-shell"><SiteHeader active="reliability" /><div className="content-shell">{artifact ? <ReliabilityLab artifact={artifact} /> : <div className="empty-state"><h1>Reliability data unavailable</h1><p>The M7 artifact could not be validated.</p></div>}</div></main>;
}
