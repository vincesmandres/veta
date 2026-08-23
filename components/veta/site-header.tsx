import Link from "next/link";

export function SiteHeader({ active }: { active: "verify" | "reliability" | "architecture" }) {
  return (
    <header className="site-header">
      <Link className="brand" href="/" aria-label="VETA home"><span className="brand-mark">V</span><span>VETA</span></Link>
      <nav aria-label="Main navigation">
        <Link className={active === "verify" ? "nav-link active" : "nav-link"} href="/">Verify</Link>
        <Link className={active === "reliability" ? "nav-link active" : "nav-link"} href="/reliability">Reliability</Link>
        <Link className={active === "architecture" ? "nav-link active" : "nav-link"} href="/architecture">How it works</Link>
      </nav>
      <div className="header-status"><span className="status-dot" /> DEMO MODE</div>
    </header>
  );
}
