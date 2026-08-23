# VETA

**Verificación de Evidencia y Transacciones Autónomas**

A local-first verification layer for autonomous onchain transactions.

**Interpret with AI. Verify with evidence. Trust with code.**

Blockchain can verify that a transaction is valid. VETA verifies whether that transaction matches the evidence and authority that justified it.

## What problem does VETA solve?

Autonomous agents can misunderstand instructions, call tools incorrectly, or be manipulated by hostile text. A valid blockchain transaction can still send the wrong asset, amount, or recipient. VETA adds a fail-closed verification boundary between model interpretation and transaction authorization.

## Core idea

QVAC interprets intent and orchestrates tools locally. Deterministic code resolves authority, decodes EVM calldata, and returns one of three outcomes:

- `APPROVE`: authoritative expectations and observed execution match.
- `BLOCK`: a known critical contradiction exists.
- `REVIEW`: evidence or execution certainty is insufficient.

The security invariant is simple: **AI may interpret and orchestrate, but AI cannot authorize.**

## Architecture

```mermaid
flowchart TD
  A[Human Intent / Evidence]
  B[QVAC Local Model]
  C[Evidence + Provenance]
  D[Trust & Authority Engine]
  E[Proposed EVM Transaction]
  F[Viem Decoder]
  G[T0 Onchain Evidence]
  H[Deterministic Safety Kernel]
  I{Verdict}

  A --> B
  B --> C
  C --> D
  E --> F
  F --> G
  D --> H
  G --> H
  H --> I
  I -->|Match| APPROVE
  I -->|Critical mismatch| BLOCK
  I -->|Insufficient certainty| REVIEW
```

## How VETA works

1. QVAC converts payment language into a validated schema.
2. VETA stores evidence with source provenance and trust tier.
3. The Trust & Authority Engine resolves field-specific expectations for `recipient`, `amount`, and `asset`.
4. Viem decodes ERC-20 `transfer(address,uint256)` calldata into T0 execution evidence.
5. The Safety Kernel compares expected authority with execution reality using canonical addresses and exact amounts.
6. The workflow guard refuses approval if required tools fail or the chain is incomplete.

## QVAC role

The checked-in `qvac.config.json` defines the local runtime:

| Setting | Value |
|---|---|
| Alias | `veta-local` |
| Runtime | QVAC |
| Model | `QWEN3_600M_INST_Q4` |
| Quantization | Q4 |
| Context | 4096 |

QVAC handles semantic interpretation and tool orchestration. **QVAC does not approve transactions. Authorization is deterministic.** No cloud model is used by the product runtime.

## Deterministic security boundary

Approval requires successful evidence retrieval, transaction retrieval, deterministic decoding, authority resolution, and Safety Kernel verification. Model prose, model confidence, fake tool output, failed tools, and incomplete workflows cannot produce `APPROVE`.

## Trust and authority model

| Trust tier | Meaning |
|---|---|
| `T0_ONCHAIN` | Execution reality: what the transaction will execute |
| `T1_AUTHORITY` | Organizational evidence and approved requests |
| `T2_SUPPORTING` | Supporting evidence such as invoices |
| `T3_UNTRUSTED` | Free-form or hostile context |

**Trust is not authority.** M5 adds source- and field-specific authority. For example, a vendor registry can authorize a recipient but not an amount, while an invoice can corroborate values without overriding authoritative evidence. T0 describes execution; it never becomes organizational authority.

## Real Sepolia validation

M3.5 performed a controlled read-only experiment against a public Sepolia transaction:

| Field | Value |
|---|---|
| Network | Sepolia |
| Transaction | `0x3518fd656c282cb7f9aaf8ab1e61b86f0344d43980d7b0da730a4a22efaeea91` |
| Block | `10668431` |
| Token contract | `0x779877a7b0d9e8603169ddbd7836e478b4624789` |
| Function | `transfer(address,uint256)` |
| Recipient | `0x3eB227Fd628cCB18DAa2fb2bB28034D3B8c1C967` |
| AmountRaw | `25000000000000000000` |
| Amount | `25 LINK` |

Matching **controlled authority** produced `APPROVE`; a controlled recipient mismatch produced `BLOCK`. The controlled authority is test evidence and is not claimed to be the historical request that originated the public transaction. See [`docs/reality-check.md`](docs/reality-check.md).

## Adversarial evaluation

M6 attempts to break QVAC, orchestration, authority resolution, and transaction verification with transaction mutations, prompt injection, malformed model output, tool failures, missing evidence, and semantic ambiguity.

The measured M6 artifact contains **28 adversarial unsafe scenarios**:

| Metric | Result |
|---|---:|
| Verdict Accuracy | 92.86% |
| Unsafe Approval Rate | 0.00% |
| Model Failure Containment | 100% |
| Prompt Injection Containment | 100% |

Two expected `BLOCK` cases degraded conservatively to `REVIEW` because real QVAC did not complete orchestration. This is an availability/precision degradation, not unsafe authorization.

### Methodological limitation

M6 focused only on adversarial unsafe scenarios; it remains the historical unsafe benchmark. M7 measures the same 28 unsafe cases together with eight predeclared safe controls. The two reports are intentionally preserved separately.

## Balanced Reliability

M7 executed a fresh balanced evaluation with 36 predeclared scenarios: 28 unsafe cases and 8 safe controls.

| Metric | Result |
|---|---:|
| Verdict Accuracy | 94.44% |
| Unsafe Approval Rate | 0.00% |
| Safe Approval Rate | 100.00% |
| Review Rate | 61.11% |
| Block Recall | 75.00% |
| Approval Precision | 100.00% |
| Model Failure Containment | 100.00% |
| Prompt Injection Containment | 100.00% |

All eight safe controls reached `APPROVE`. The same two real-QVAC authority attacks, `B1` and `B2`, degraded from expected `BLOCK` to `REVIEW`; they are counted as conservative degradations, not unsafe approvals. See `artifacts/m7-balanced-reliability.{json,md}` for scenario-level traces and `docs/benchmark-methodology.md` for definitions.

## Current status

M0 through M7 are complete. M8 is next. See [`docs/status.md`](docs/status.md) for milestone purposes and status.

## Quickstart

Requirements: Node.js 22 LTS or another Node version supported by Next.js 16, npm, and optionally a local QVAC runtime.

```bash
git clone https://github.com/vincesmandres/veta.git
cd veta
npm ci
npm run check
```

Run the development server without changing the current placeholder UI:

```bash
npm run dev
```

## QVAC setup

1. Install and start QVAC for your platform.
2. Load `qvac.config.json`; it exposes the `veta-local` alias.
3. Confirm the OpenAI-compatible local endpoint is available. VETA defaults to `http://127.0.0.1:11434/v1`.
4. Override the URL or model only through environment variables when needed.

## Demo commands

```bash
npm run veta:m0
npm run veta:m1
npm run veta:m2
npm run veta:m3
npm run veta:m4
npm run veta:m5
npm run veta:m6
npm run veta:m7
```

`veta:m0`, `veta:m1`, and real-QVAC portions of `veta:m6` require QVAC. Deterministic tests and CI do not. M3.5 additionally requires a Sepolia RPC URL.

## Repository structure

```text
app/                  Current Next.js shell; M8 UI is not implemented
artifacts/            Generated benchmark evidence and methodology notes
docs/                 Architecture, methodology, reality check, status
scripts/              Milestone demonstrations and benchmark entrypoints
src/adversarial/      M6 scenarios, safe controls, runner, metrics
src/agent/            Tool orchestration and fail-closed workflow guard
src/authority/        Field-level Trust & Authority Engine
src/evidence/         Evidence schemas, provenance, trust tiers
src/qvac/             Local QVAC extraction client and schemas
src/safety/           Deterministic M3 Safety Kernel
src/web3/             Viem ERC-20 decoding and read-only RPC integration
```

## Environment variables

| Variable | Purpose | Required |
|---|---|---|
| `VETA_QVAC_URL` | Local OpenAI-compatible QVAC endpoint | Optional; defaults locally |
| `VETA_QVAC_MODEL` | QVAC model alias | Optional; defaults to `veta-local` |
| `VETA_DEBUG_QVAC` | Set to `1` for local inference diagnostics | Optional |
| `VETA_RPC_URL` | Read-only Sepolia RPC endpoint | M3.5 only |
| `VETA_TOKEN_SYMBOL` | Token metadata for M3.5 decoding | M3.5 only |
| `VETA_TOKEN_DECIMALS` | Token decimals for M3.5 decoding | M3.5 only |
| `VETA_BENCHMARK_RUNS` | M4 benchmark run count | Optional |

Never commit `.env` files, RPC credentials, private keys, or mnemonics. VETA requires no private key because it does not sign or broadcast transactions.

## Test and validation commands

```bash
npm test
npx tsc --noEmit
npm run build
npm run check
```

GitHub Actions runs `npm ci`, tests, TypeScript, and production build. It deliberately excludes real QVAC and live RPC calls.

## Limitations

- Only ERC-20 `transfer(address,uint256)` on EVM is decoded.
- No signing, wallet execution, transaction broadcast, or private-key handling exists.
- Real QVAC behavior can vary by model/runtime/hardware.
- M6 is adversarial and unsafe-only; safe controls have not yet been consolidated into M7 metrics.
- This is a hackathon security prototype, not a production compliance system.
- The verification UI and reliability lab are reserved for M8.

## Hackathon track

Built for the **Aleph Hackathon 2026 QVAC Reliability Track**. VETA tests the thesis that small-model failure does not need to become unsafe transaction approval.
