"use client";

import { useEffect, useState } from "react";

export function ModeHealth() {
  const [state, setState] = useState<"checking" | "available" | "offline">("checking");
  const [model, setModel] = useState<string>();
  useEffect(() => {
    let active = true;
    fetch("/api/local/qvac/status").then((response) => response.json()).then((data: { available?: boolean; model?: string }) => {
      if (active) { setState(data.available ? "available" : "offline"); setModel(data.model); }
    }).catch(() => { if (active) setState("offline"); });
    return () => { active = false; };
  }, []);
  return <div className="health-line"><span className={`health-dot ${state}`} /> Local QVAC: {state === "checking" ? "checking" : state === "available" ? `${model ?? "available"} detected` : "unavailable · DEMO continues"}</div>;
}
