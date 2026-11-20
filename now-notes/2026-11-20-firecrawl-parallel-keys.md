# Firecrawl and Parallel keys: where they may help legibility

Status: A page-reading key (Firecrawl) and a web-search key (Parallel) were added on 2026-11-20 to the edge function secrets of the Supabase project this repository runs on. Checked by name only; no value was read. Nothing uses them yet and no spend has happened.

Where they are readable: from that project's edge functions. They are NOT readable from GitHub Actions, a Vercel function or Python code unless mirrored there, which is a secret write and needs Krish's approval first. Control Center's API gateway has no adapter for either yet.

Rules that still apply: measure before adopting, record the cost of every call, never block on no evidence, and a site that refuses an automated reader is an answer, not an obstacle to route around.

## Map for legibility

Candidate: the real extraction lives in the separate worker deploy, so a page-reading fallback belongs there, not in this app. Compare against the worker's own extractor on a sample first and keep the 100 percent coverage rule for anything added under `src/lib/api`.

Next: none until the worker's weak pages are listed.
North Star check (2026-11-20): holds, no movement.
