---
title: "How can an AI agent pay per API call in USDC?"
description: "The x402 flow an agent uses to pay per call in USDC with no account: the 402 quote, the signed authorization, the X-PAYMENT header and settlement."
published: "2026-10-21"
updated: "2026-10-21"
tags: [x402, payments, USDC, MCP]
related:
  [
    how-do-i-connect-an-ai-agent-to-a-remote-mcp-server,
    how-can-an-ai-agent-get-typed-product-data-from-a-url-or-barcode,
  ]
---

An agent pays per call in USDC with x402: it calls the API without a key, receives HTTP 402 with payment requirements, signs a USDC transfer authorization for the quoted amount, and resends the request with an `X-PAYMENT` header. Legibility's MCP server works this way today on Base Sepolia, a testnet, with no mainnet settlement yet.

x402 puts payment inside HTTP itself. There is no signup, no API key and no invoice: the payment header is the credential, and the server proves settlement in its response. That is what lets an agent find a tool and pay for it on its own.

## How the flow works, step by step

1. **Discover for free.** On Legibility's MCP server, `initialize`, `tools/list` and `ping` cost nothing, so an agent can read the tools and their input schemas before deciding to pay.
2. **Call without a key.** A `tools/call` with no `Authorization` header and no `X-PAYMENT` header returns HTTP 402 with a JSON body: `x402Version`, an `error` string, and an `accepts` array of payment requirements.
3. **Read the requirements.** Each entry names the `scheme` (`exact`), the `network` (`base-sepolia`), `maxAmountRequired` in atomic USDC units (USDC has 6 decimals), the `asset` contract, the `payTo` address and `maxTimeoutSeconds`.
4. **Sign and resend.** The agent signs an ERC-3009 `TransferWithAuthorization` for that amount, which is gasless for the buyer, base64-encodes the payment payload and resends the same request with it in the `X-PAYMENT` header.
5. **Settlement and result.** Legibility verifies and then settles the payment through an x402 facilitator (by default `https://x402.org/facilitator`), runs the tool, and returns the result with an `X-PAYMENT-RESPONSE` header carrying the settlement proof.

## What the 402 looks like

The first, unpaid call:

```bash
curl -i -X POST https://legibility.io/api/mcp \
  -H "content-type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"read_product","arguments":{"gtin":"8076800195057"}}}'
```

The response is HTTP 402 with a body shaped like this:

```json
{
  "x402Version": 1,
  "error": "Payment required: provide a lgk_ API key (Bearer) or a settled X-PAYMENT header.",
  "accepts": [
    {
      "scheme": "exact",
      "network": "base-sepolia",
      "maxAmountRequired": "10000",
      "resource": "https://legibility.io/api/mcp",
      "description": "Legibility read_product",
      "mimeType": "application/json",
      "payTo": "0x...",
      "maxTimeoutSeconds": 120,
      "asset": "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
      "extra": { "name": "USDC", "version": "2" }
    }
  ]
}
```

Treat the quote you receive as authoritative rather than a number from documentation. The amount is server configuration; the default in Legibility's code is `10000` atomic units, which is 0.01 USDC. The asset shown is USDC on Base Sepolia.

## What to know before relying on it

- **Testnet only today.** Settlement runs on Base Sepolia. The on-chain path is wired and testable, but no mainnet settlement is live yet.
- **Payment settles before the read runs.** On the x402 path the payment is verified and settled first, so a paid call that returns `product: null` has still been paid for. The rule that misses are free applies to API key billing, where only trusted reads count.
- **Input validation is free.** Malformed arguments, such as passing both `url` and `gtin`, come back as a tool error before any payment is requested.
- **MCP only.** x402 is accepted on the MCP endpoint at `https://legibility.io/api/mcp`. The REST endpoints under `/api/v1` take an API key.
- **No account metering.** x402 calls are paid on-chain, so they skip account rate limiting and monthly quota. A settlement failure returns 402 again with a `settle_error` field.

## The API key alternative

If a human sets the agent up, an API key may be simpler. Create an `lgk_` key in the dashboard and send it as `Authorization: Bearer lgk_...`. The free plan includes 1,000 trusted reads a month with a hard stop, and a call that returns nothing trusted is not billed. Plans are listed on the [home page](/#pricing), and the payment protocol is documented at [MCP and x402](/docs/mcp).

## FAQ

### Does an agent need an account to pay per call?

No. With x402 the signed payment in the `X-PAYMENT` header is the credential. Discovery calls are free, and a paid `tools/call` needs no key and no signup.

### Which network and token does Legibility accept?

USDC on Base Sepolia, which is a testnet. The asset address is `0x036CbD53842c5426634e7929541eC2318f3dCF7e`. Mainnet settlement is not live yet.

### Is an x402 call charged when the read returns nothing?

Yes. The payment settles before the read runs. With an API key the answer is different: only a trusted read, meaning a product returned at confidence 0.7 or higher, is billed.
