import { createFileRoute } from "@tanstack/react-router";
import { MCP_URL } from "@/config/product";
export const Route = createFileRoute("/docs/mcp")({
  component: () => (
    <article className="space-y-6">
      <h1 className="font-display text-5xl">MCP server + x402</h1>
      <p className="text-lg text-muted-foreground">
        Legibility exposes the same tools over the Model Context Protocol. Agents discover the server,
        call <span className="font-mono">read_product</span>, and pay per call in USDC on Base.
      </p>
      <h2 className="font-display text-2xl mt-6">Endpoint</h2>
      <pre className="rounded-md border border-hairline bg-surface p-5 font-mono text-sm overflow-x-auto">
{`POST ${MCP_URL}
Accept: application/json, text/event-stream`}
      </pre>
      <h2 className="font-display text-2xl mt-6">Payment (x402)</h2>
      <p className="text-muted-foreground">
        Tool calls without a valid payment header return <span className="font-mono">402 Payment Required</span> with payment instructions.
        Currently settled on <strong>Base Sepolia</strong> (testnet). Mainnet flip on GA.
      </p>
      <pre className="rounded-md border border-hairline bg-surface p-5 font-mono text-sm overflow-x-auto">
{`402 Payment Required
{
  "x402Version": 1,
  "accepts": [{
    "scheme": "exact",
    "network": "base-sepolia",
    "maxAmountRequired": "10000",   // 0.01 USDC (6 decimals)
    "asset": "USDC",
    "payTo": "0x… (the Legibility recipient)"
  }]
}`}
      </pre>
    </article>
  ),
});
