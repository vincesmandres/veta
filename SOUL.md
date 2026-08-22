# SOUL.md — VETA

## Identity

**VETA — Verificación de Evidencia y Transacciones Autónomas**

VETA follows the *veta* of evidence from human intent to onchain execution.

```text
INTENCIÓN
   ↓
EVIDENCIA
   ↓
QVAC
   ↓
VETA
   ↓
TRANSACCIÓN
```

## Mission

Build a **small, working, measurable security primitive** for autonomous financial operations.

VETA must determine whether an onchain transaction matches:

1. human intent,
2. organizational policy,
3. authoritative evidence,
4. actual blockchain execution data.

The model interprets. **Code authorizes.**

## Non-negotiable architecture

```text
Intent + Evidence + Policy + Onchain Reality
                    ↓
               QVAC Local
                    ↓
          Structured Evidence
                    ↓
                VETA
                    ↓
            Trust Engine
                    ↓
       Deterministic Safety Gate
                    ↓
        APPROVE / BLOCK / REVIEW
```

## QVAC must be core

QVAC is the runtime inference layer.

Use it for:
- intent extraction,
- tool selection,
- ambiguity detection,
- structured semantic output.

Do **not** use QVAC to:
- authorize a transaction,
- override blockchain state,
- decide exact address/amount equality,
- replace missing evidence with guesses.

No cloud model is part of the product runtime.

## Trust model

Evidence has authority levels:

- **T0 — Onchain truth:** calldata, contract state, events, receipts.
- **T1 — Organizational truth:** policies, approved counterparties, signed requests.
- **T2 — Supporting evidence:** invoices, purchase orders.
- **T3 — Untrusted context:** free text, notes, emails, model output.

**Lower-trust evidence cannot overwrite higher-trust financial authority.**

## Safety rules

- Missing evidence → `REVIEW`
- Critical mismatch → `BLOCK`
- Model confidence never authorizes execution.
- Tool failure never becomes an inferred answer.
- The system must fail closed.
- Every verdict must expose the evidence used.

## MVP scope

Build only:

1. QVAC local inference.
2. Structured schemas.
3. Real EVM calldata decoding.
4. Deterministic validators.
5. Trust hierarchy.
6. Multi-step tool workflow.
7. Adversarial benchmark.
8. Minimal demo UI.

## Explicitly out of scope

Do not build:

- custom smart contracts,
- ZK proofs,
- wallet execution,
- WDK integration,
- multi-chain support,
- authentication,
- Supabase,
- cloud AI,
- graph databases,
- multi-agent orchestration,
- production compliance claims.

## Success metric

Primary metric:

**Unsafe Approval Rate**

The hackathon demo should prove:

> The local model can fail. VETA keeps the unsafe transaction blocked.

## Scope discipline

Every new feature must answer at least one of these questions:

- Does it improve evidence quality?
- Does it improve transaction verification?
- Does it improve small-model reliability?
- Does it improve measurable safety?

If the answer is no, it is outside the hackathon scope.
