---
title: "How do I connect an AI agent to a remote MCP server over HTTP?"
description: "The three JSON-RPC calls an agent makes to a remote MCP server, shown against Legibility's live endpoint, with the errors and auth you will meet."
published: "2026-10-21"
updated: "2026-10-21"
tags: [MCP, agents, JSON-RPC, discovery]
related:
  [
    how-can-an-ai-agent-pay-per-api-call-in-usdc,
    how-can-an-ai-agent-get-typed-product-data-from-a-url-or-barcode,
  ]
---

Send JSON-RPC 2.0 requests by HTTP POST to the server's endpoint: `initialize` first, then `tools/list` to read the tool schemas, then `tools/call` to run one. Legibility's MCP server is at `https://legibility.io/api/mcp`, speaks protocol version `2025-06-18`, and describes itself at `/.well-known/mcp.json`. Discovery is free.

The Model Context Protocol gives an agent one way to find out what a server can do and then do it. Over HTTP that is ordinary POST requests carrying JSON-RPC messages, so any client that can make an HTTP request can use it.

## The three calls

Start the session. The server echoes the protocol version you send, or answers with `2025-06-18`:

```bash
curl -X POST https://legibility.io/api/mcp \
  -H "content-type: application/json" \
  -H "accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18"}}'
```

List the tools and their input schemas:

```bash
curl -X POST https://legibility.io/api/mcp \
  -H "content-type: application/json" \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/list"}'
```

Call one. This needs an API key or an x402 payment:

```bash
curl -X POST https://legibility.io/api/mcp \
  -H "authorization: Bearer lgk_your_key" \
  -H "content-type: application/json" \
  -d '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"read_product","arguments":{"gtin":"8076800195057"}}}'
```

The tool result arrives as JSON-RPC `result.content`, a list with one text item holding the JSON response envelope.

## What the server does with each message

- `initialize` returns `capabilities: { tools: {} }` and `serverInfo` naming the server.
- `notifications/initialized` is accepted with HTTP 202 and no body.
- `ping` returns an empty result, and `tools/list` returns the tools with their JSON Schemas.
- An unknown method returns JSON-RPC error `-32601`; an unknown tool name returns `-32602`; a body that is not JSON returns `-32700`.
- Bad tool arguments come back as a normal result with `isError: true`, so the agent sees why without the call failing at the transport level.
- Each POST gets one JSON response. A GET to the endpoint returns HTTP 405 with `allow: POST`.

## Which tools are on the MCP server

Two, today: `read_product` (exactly one of `url` or `gtin`, plus an optional `min_confidence`) and `resolve_product` (a `name` of two or more characters). `compare_products` and `brief_product` exist over REST at `/api/v1` but are not yet on the MCP tool list, and that is stated rather than implied.

## Authentication and limits

A `tools/call` needs one of two things. Either an API key sent as `Authorization: Bearer lgk_...`, or an x402 payment in USDC sent as an `X-PAYMENT` header, which is explained in [how an agent pays per call](/answers/how-can-an-ai-agent-pay-per-api-call-in-usdc). Keyed calls are rate limited per plan: over the limit returns HTTP 429 with `retry-after` and JSON-RPC error `-32099`. A free account past its monthly quota receives HTTP 402 with error `-32098` before any work is done.

## Finding the server in the first place

An agent or a registry can read `https://legibility.io/.well-known/mcp.json`, which states the endpoint, the transport, that discovery is free, both auth methods, and the tool list. The same facts are in plain text at [llms.txt](/llms.txt), and the reference page is [MCP and x402](/docs/mcp).

## FAQ

### Is listing the tools free?

Yes. `initialize`, `tools/list` and `ping` need no key and no payment. Only `tools/call` is paid.

### Can I use a streaming or GET connection?

No. The endpoint accepts POST only and answers each request with a single JSON response. A GET returns 405.

### Why is compare_products missing from tools/list?

It is REST only for now, as is `brief_product`. Both are available at `/api/v1` with an API key.
