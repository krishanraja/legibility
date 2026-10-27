import { createFileRoute } from "@tanstack/react-router";

import { contactFrom, mcpManifest } from "@/lib/api/mcp-tools";

// A6: /.well-known/mcp.json, the MCP discovery document. It used to be a static file in
// public/ with a person's own address as the contact; it is now built from the same tool list
// /api/mcp serves, and its contact is a role address on the legibility.io domain read from
// configuration (MCP_CONTACT_EMAIL). With none configured, the contact is left out.
export const Route = createFileRoute("/.well-known/mcp.json")({
  server: {
    handlers: {
      GET: async () =>
        new Response(JSON.stringify(mcpManifest(contactFrom(process.env)), null, 2), {
          headers: {
            "content-type": "application/json; charset=utf-8",
            "cache-control": "public, max-age=3600",
            "access-control-allow-origin": "*",
          },
        }),
    },
  },
});
