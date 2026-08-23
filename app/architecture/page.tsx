import { FinalCta, HowVetaWorks, SepoliaProof } from "../../components/veta/pitch-sections";
import { SiteHeader } from "../../components/veta/site-header";

export default function ArchitecturePage() {
  return (
    <main className="page-shell">
      <SiteHeader active="architecture" />
      <HowVetaWorks />
      <SepoliaProof />
      <FinalCta />
      <footer className="footer">VETA / INTERPRET WITH AI / VERIFY WITH EVIDENCE / TRUST WITH CODE</footer>
    </main>
  );
}
