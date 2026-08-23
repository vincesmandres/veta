This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

This project uses `next/font` to automatically optimize and load Geist, a font family from Vercel.

## Learn More

To learn more about Next.js, take a look at the [Next.js documentation](https://nextjs.org/docs).

## Deploy on Vercel

The easiest way to deploy this project is through [Vercel](https://vercel.com/new).

## M3.5 Reality Check

The read-only reality check fetches an external Sepolia transaction through viem, reuses the M2 ERC-20 decoder, and sends T0 evidence through the M3 Safety Kernel.

```powershell
$env:VETA_RPC_URL="https://your-sepolia-rpc.example"
$env:VETA_TOKEN_SYMBOL="TEST_TOKEN"
$env:VETA_TOKEN_DECIMALS="18"
npm run veta:m3.5 -- --tx 0xTRANSACTION_HASH
```

`VETA_RPC_URL` and the transaction hash are external inputs. No private key, signing, or broadcasting is used.

## M4 Tool Reliability

M4 uses the local QVAC endpoint to propose structured tool actions. Only the registered VETA tools can execute, and `APPROVE` requires successful evidence retrieval, transaction retrieval, decoding, and deterministic verification.

```powershell
npm run veta:m4
npm run veta:m4:benchmark -- --runs=10
```

The benchmark records real local-QVAC output validity, tool-chain completion, retries, tool failures, and unsafe approvals. It does not use cloud inference.
