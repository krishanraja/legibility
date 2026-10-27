import { createFileRoute } from "@tanstack/react-router";

import { registryAuthBody } from "@/lib/api/mcp-tools";

// A7: the MCP Registry's HTTP domain check for io.legibility/mcp. Serves only the public half
// of the publishing key (MCP_REGISTRY_AUTH_PUBLIC_KEY); 404 until Krish sets it to publish.
export const Route = createFileRoute("/.well-known/mcp-registry-auth")({
  server: {
    handlers: {
      GET: async () => {
        const body = registryAuthBody(process.env);
        return body
          ? new Response(body, {
              headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" },
            })
          : new Response("Not found", { status: 404, headers: { "cache-control": "no-store" } });
      },
    },
  },
});
