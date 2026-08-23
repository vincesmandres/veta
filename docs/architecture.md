# Architecture

VETA separates probabilistic interpretation from deterministic authorization.

```text
Human intent and evidence
        |
        v
QVAC local interpretation and tool selection
        |
        v
Evidence schemas, provenance, trust, field authority
        |
        +----------------------+
                               v
Proposed EVM transaction -> viem decoder -> T0 execution evidence
                               |
                               v
                    Deterministic Safety Kernel
                               |
                    APPROVE / BLOCK / REVIEW
```

## Milestone layers

- **M0 — QVAC interpretation:** local structured payment extraction with strict schema validation.
- **M1 — Provenance:** evidence nodes preserve source, extraction state, and trust tier.
- **M2 — EVM decoding:** viem decodes ERC-20 transfer calldata without model involvement.
- **M3 — Safety Kernel:** exact recipient, amount, and asset comparison owns the transaction verdict.
- **M3.5 — Real network source:** a read-only Sepolia RPC pipeline supplies real T0 evidence.
- **M4 — Tool reliability:** registered tools, bounded retries, required workflow, and fail-closed finalization.
- **M5 — Trust & Authority:** deterministic field-level authority resolves what should execute; T0 remains what will execute.
- **M6 — Adversarial validation:** unsafe mutations, prompt injection, malformed output, ambiguity, and infrastructure failures test containment.

## Security invariant

```text
AI may interpret.
AI may orchestrate.
AI may fail.

AI cannot authorize.
```

`APPROVE` is reachable only through successful deterministic verification. Missing evidence or incomplete execution knowledge produces `REVIEW`; known critical contradictions produce `BLOCK`.
