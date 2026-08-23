"use client";

import { useEffect, useState } from "react";

export function ModeHealth() {
  const [state, setState] = useState<"checking" | "available" | "offline" | "not-local">("checking");
  const [model, setModel] = useState<string>();
  useEffect(() => {
    const hostname = window.location.hostname;
    if (hostname !== "localhost" && hostname !== "127.0.0.1" && hostname !== "::1") {
      setState("not-local");
      return;
    }
    let active = true;
    fetch("/api/local/qvac/status").then((response) => response.json()).then((data: { available?: boolean; model?: string }) => {
      if (active) { setState(data.available ? "available" : "offline"); setModel(data.model); }
    }).catch(() => { if (active) setState("offline"); });
    return () => { active = false; };
  }, []);
  return <div className="health-line"><span className={`health-dot ${state}`} /> Local QVAC: {state === "checking" ? "checking" : state === "available" ? `${model ?? "available"} detected` : state === "not-local" ? "local-only · DEMO continues" : "unavailable · DEMO continues"}</div>;
}
