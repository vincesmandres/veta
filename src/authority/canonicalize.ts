import { getAddress } from "viem";
import type { CriticalField } from "./authority-policy";

export function canonicalize(field: CriticalField, value: string | number): string {
  const text = String(value).trim();
  if (field === "recipient") {
    try { return getAddress(text).toLowerCase(); } catch { return text.toLowerCase(); }
  }
  if (field === "asset") return text.toLowerCase();
  if (!/^[0-9]+(?:\.[0-9]+)?$/.test(text)) return text;
  const [integer, fraction = ""] = text.split(".");
  const normalizedInteger = integer.replace(/^0+(?=\d)/, "") || "0";
  const normalizedFraction = fraction.replace(/0+$/, "");
  return normalizedFraction ? `${normalizedInteger}.${normalizedFraction}` : normalizedInteger;
}
