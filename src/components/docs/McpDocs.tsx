import { APP_ORIGIN, MCP_URL } from "@/config/product";
import { TOOLS } from "@/lib/api/mcp-tools";

/**
 * The /docs/mcp page body. The manifest at /.well-known/mcp.json gives this page to directory
 * reviewers as its documentation, so it renders the tool list the server serves (TOOLS, the
 * same list tools/list returns), says how a key authenticates, and links the manifest. It
 * claims nothing past what runs today: x402 settles on Base Sepolia, a testnet.
 */

const pre =
  "rounded-md border border-hairline bg-surface p-5 font-mono text-sm overflow-x-auto whitespace-pre";

export const MANIFEST_PATH = "/.well-known/mcp.json";

export function McpDocs() {
  return (
    <article className="space-y-6">
      <h1 className="font-display text-5xl">MCP server + x402</h1>
      <p className="text-lg text-muted-foreground">
        Legibility serves its product tools over the Model Context Protocol. Discovery is free. A
        tool call is paid with a Legibility API key, or per call in USDC over x402 on Base Sepolia,
        a testnet.
      </p>

      <h2 className="font-display text-2xl mt-6">Endpoint</h2>
      <pre className={pre}>
        {`POST ${MCP_URL}
Content-Type: application/json
Accept: application/json, text/event-stream`}
      </pre>
      <p className="text-muted-foreground">
        JSON-RPC 2.0 over HTTP POST. <span className="font-mono">initialize</span>,{" "}
        <span className="font-mono">tools/list</span> and <span className="font-mono">ping</span>{" "}
        need no key and cost nothing.
      </p>

      <h2 className="font-display text-2xl mt-6">Tools</h2>
      <p className="text-muted-foreground">
        This is the list <span className="font-mono">tools/list</span> returns. Each tool also
        carries an input schema, an output schema and read-only annotations.
      </p>
      <ul className="space-y-4">
        {TOOLS.map((t) => (
          <li key={t.name} className="rounded-md border border-hairline bg-surface p-5">
            <p>
              <span className="font-mono">{t.name}</span>{" "}
              <span className="text-muted-foreground">({t.title})</span>
            </p>
            <p className="mt-2 text-sm text-muted-foreground">{t.description}</p>
          </li>
        ))}
      </ul>
      <p className="text-muted-foreground">
        <span className="font-mono">compare_products</span> and{" "}
        <span className="font-mono">brief_product</span> are available over REST only, not yet on
        the MCP tool list.
      </p>

      <h2 className="font-display text-2xl mt-6">Authenticate with an API key</h2>
      <p className="text-muted-foreground">
        Create a key in the dashboard at {APP_ORIGIN}. Keys start with{" "}
        <span className="font-mono">lgk_</span> and are shown once. Send it as a bearer token on
        every request. A keyed call is rate limited and counted against your plan, and a read that
        returns no product is never charged.
      </p>
      <pre className={pre}>
        {`{
  "mcpServers": {
    "legibility": {
      "url": "${MCP_URL}",
      "headers": { "Authorization": "Bearer lgk_your_key" }
    }
  }
}`}
      </pre>

      <h2 className="font-display text-2xl mt-6">Pay per call (x402)</h2>
      <p className="text-muted-foreground">
        A <span className="font-mono">tools/call</span> with no valid key and no{" "}
        <span className="font-mono">X-PAYMENT</span> header returns{" "}
        <span className="font-mono">402 Payment Required</span> with the payment requirements.
        Payments settle on <strong>Base Sepolia</strong> (testnet), 0.01 test USDC a call. No
        mainnet settlement yet.
      </p>
      <pre className={pre}>
        {`402 Payment Required
{
  "x402Version": 1,
  "accepts": [{
    "scheme": "exact",
    "network": "base-sepolia",
    "maxAmountRequired": "10000",
    "asset": "<USDC contract on Base Sepolia>",
    "payTo": "<the Legibility recipient>"
  }]
}`}
      </pre>

      <h2 className="font-display text-2xl mt-6">Manifest</h2>
      <p className="text-muted-foreground">
        The discovery document, built from the same tool list:{" "}
        <a className="underline" href={MANIFEST_PATH}>
          {`${APP_ORIGIN}${MANIFEST_PATH}`}
        </a>
        .
      </p>
    </article>
  );
}
