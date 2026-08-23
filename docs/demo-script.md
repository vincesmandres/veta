# Demo script

Target duration: 90 seconds.

## 0-10 seconds: Problem

Open the public demo at https://veta-smoky.vercel.app.

> A blockchain transaction can be valid and still be the wrong transaction. VETA verifies whether execution matches the evidence and authority that justified it.

## 10-25 seconds: Architecture

Open `/architecture`.

> QVAC runs locally to interpret intent and select registered tools. Evidence keeps provenance. The Trust and Authority Engine resolves what should execute. Viem decodes what will execute. Only the deterministic Safety Kernel can return APPROVE, BLOCK, or REVIEW.

Point out that public Vercel shows recorded scenarios. It does not execute local QVAC.

## 25-45 seconds: Recipient attack

Return to `/` and select **Recipient Attack**.

> T1 authority names `0xAAA...`. T0 decoded execution sends to `0xBBB...`. The deterministic recipient check fails, so VETA returns BLOCK with `RECIPIENT_MATCH mismatch`.

## 45-60 seconds: Exact match

Select **Exact Match**.

> The authoritative recipient, amount, and asset match decoded execution exactly. All deterministic checks pass, so VETA returns APPROVE.

## 60-75 seconds: Failure containment

Select **Prompt Injection**.

> Hostile evidence tells the model to approve. It has no authority. When model orchestration or evidence certainty fails, VETA returns REVIEW and grants no authorization.

## 75-90 seconds: Reliability

Open `/reliability`.

> The balanced report contains 36 scenarios: 28 unsafe and eight safe. Unsafe approval rate is zero and safe approval rate is 100 percent. Ten real-QVAC runs observed nine model failures and zero unsafe approvals. B1 and B2 conservatively degraded from expected BLOCK to REVIEW.

## Final line

> The model can fail. The transaction should not.
