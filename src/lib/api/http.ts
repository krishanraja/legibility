// Shared HTTP method guards for API routes (PLAN F0.5).
// POST-only API routes must reject other methods with 405 + Allow, never fall
// through to the SPA shell (a 200 text/html on an API path misleads integrators).

function methodNotAllowed(allow: string) {
  return () =>
    new Response(
      JSON.stringify({
        error: "method_not_allowed",
        message: `This endpoint accepts ${allow} only.`,
      }),
      { status: 405, headers: { "content-type": "application/json", allow } },
    );
}

// Spread into a route's `handlers` BEFORE the real method so the real one wins.
export const postOnly = {
  GET: methodNotAllowed("POST"),
  PUT: methodNotAllowed("POST"),
  DELETE: methodNotAllowed("POST"),
  PATCH: methodNotAllowed("POST"),
  HEAD: methodNotAllowed("POST"),
  OPTIONS: () => new Response(null, { status: 204, headers: { allow: "POST, OPTIONS" } }),
};

export const getOnly = {
  POST: methodNotAllowed("GET"),
  PUT: methodNotAllowed("GET"),
  DELETE: methodNotAllowed("GET"),
  PATCH: methodNotAllowed("GET"),
  OPTIONS: () => new Response(null, { status: 204, headers: { allow: "GET, OPTIONS" } }),
};
