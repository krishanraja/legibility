import { createFileRoute } from "@tanstack/react-router";

import { McpDocs } from "@/components/docs/McpDocs";
import { pageMeta } from "@/lib/seo";

export const Route = createFileRoute("/docs/mcp")({
  head: () => ({
    meta: pageMeta({
      title: "MCP server and x402 · Legibility",
      description:
        "Connect an agent to Legibility over MCP: the tool list the server serves, API key auth, x402 per-call payment on testnet and the discovery manifest. Discovery is free.",
      path: "/docs/mcp",
    }),
  }),
  component: McpDocs,
});
