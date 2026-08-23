# Runtime environment

This report records the machine and runtime used for the final M9 checks on August 23, 2026. Values were queried from the machine; they are not estimates.

## Hardware and software

| Setting | Measured value |
|---|---|
| CPU | AMD Ryzen 7 7730U with Radeon Graphics |
| RAM | 13.8 GiB |
| OS | Microsoft Windows 11 Pro 10.0.26200, 64-bit |
| Node.js | v24.15.0 |
| npm | 12.0.2 |
| CI Node.js | 22 |

## QVAC runtime

| Setting | Value |
|---|---|
| Runtime | QVAC |
| Alias | `veta-local` |
| Model | `QWEN3_600M_INST_Q4` |
| Quantization | Q4 |
| Context size | 4096 |
| Endpoint | `http://127.0.0.1:11434/v1` |

`GET /v1/models` returned `veta-local`. Product inference used the localhost endpoint; no cloud model provider was configured or called.

## M9 live validation

Three fresh structured extraction calls completed with schema `PASS`:

| Call | Latency |
|---:|---:|
| 1 | 5,583 ms |
| 2 | 8,609 ms |
| 3 | 5,534 ms |

| Statistic | Latency |
|---|---:|
| Minimum | 5,534 ms |
| Median | 5,583 ms |
| Mean | 6,575 ms |
| Maximum | 8,609 ms |

A separate one-run real-QVAC orchestration probe received five model responses, of which three were valid structured actions. Two malformed responses and an incomplete chain caused `TOOL_ORCHESTRATION_FAILED` and final `REVIEW`. The safe scenario did not reach `APPROVE`; no authorization was granted.

## M7 measured latency

The versioned balanced artifact reports 29,817 ms average latency across 10 `REAL_QVAC` scenarios. This artifact value is authoritative for M7 and differs from earlier approximate notes.

Real QVAC latency is hardware, model, and runtime dependent.
