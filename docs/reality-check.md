# M3.5 Reality Check

M3.5 validates that VETA can fetch a real public transaction through an externally configured Sepolia RPC endpoint, decode it with the same deterministic M2 decoder, and compare T0 execution evidence with controlled organizational authority.

## Public transaction

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

## Controlled experiment

- Controlled authority matching the decoded recipient, amount, and asset produced `APPROVE`.
- Controlled authority with a different recipient produced `BLOCK` and a recipient mismatch reason.

The controlled authority is purpose-built test evidence. It is not represented as the historical real-world request that caused the public transaction.

## Reproduce

```powershell
$env:VETA_RPC_URL="https://your-sepolia-rpc.example"
$env:VETA_TOKEN_SYMBOL="LINK"
$env:VETA_TOKEN_DECIMALS="18"

npm run veta:m3.5 -- --tx 0x3518fd656c282cb7f9aaf8ab1e61b86f0344d43980d7b0da730a4a22efaeea91
```

The RPC endpoint is externally configurable. No private key is required. VETA performs no signing and no broadcast.
