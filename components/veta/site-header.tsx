"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type ActiveRoute = "demo" | "reliability" | "architecture";

export function SiteHeader({ active }: { active: ActiveRoute }) {
  const [localQvac, setLocalQvac] = useState<"checking" | "available" | "offline" | "demo">("demo");
  const [model, setModel] = useState<string>();

  useEffect(() => {
    const isLocal = ["localhost", "127.0.0.1", "::1"].includes(window.location.hostname);
    if (!isLocal) return;

    let mounted = true;
    setLocalQvac("checking");
    fetch("/api/local/qvac/status")
      .then((response) => response.json())
      .then((data: { available?: boolean; model?: string }) => {
        if (!mounted) return;
        setLocalQvac(data.available ? "available" : "offline");
        setModel(data.model);
      })
      .catch(() => mounted && setLocalQvac("offline"));

    return () => {
      mounted = false;
    };
  }, []);

  const status = localQvac === "available"
    ? `LOCAL QVAC: ${model ?? "detected"}`
    : localQvac === "offline"
      ? "LOCAL QVAC: unavailable"
      : localQvac === "checking"
        ? "LOCAL QVAC: checking"
        : "DEMO MODE: recorded scenarios";

  return (
    <header className="site-header">
      <div className="nav-inner">
        <Link className="brand" href="/" aria-label="VETA home">
          <span className="brand-mark">V</span>
          <span>VETA</span>
        </Link>
        <nav className="nav-links" aria-label="Primary navigation">
          <Link className={`nav-link ${active === "demo" ? "active" : ""}`} href="/#demo">Demo</Link>
          <Link className={`nav-link ${active === "reliability" ? "active" : ""}`} href="/reliability">Reliability</Link>
          <Link className={`nav-link ${active === "architecture" ? "active" : ""}`} href="/architecture">Architecture</Link>
          <a className="nav-link" href="https://github.com/vincesmandres/veta" target="_blank" rel="noreferrer">GitHub</a>
        </nav>
        <div className="runtime-status">
          <span className={`status-dot ${localQvac === "available" ? "" : localQvac === "demo" ? "demo" : "offline"}`} />
          {status}
        </div>
      </div>
    </header>
  );
}
