-- Restore the calibration record destroyed with the old project.
--
-- The front page publishes four figures: n=63, precision 1.0 at the 0.7 gate, a Wilson
-- lower bound of 0.832, and expected calibration error of 0.19. They are not typed into
-- the page. They are read from src/data/calibration.json, which scripts/sync-calibration.ts
-- generates from public.golden_eval_runs, and CI fails if the two ever disagree. That
-- arrangement exists so a published number can only ever be a number that was measured and
-- stored.
--
-- On 2026-09-18 the migration g25_legibility_project_cleanup_r98 ran
-- `drop schema public cascade` on Supabase project cgkcplcamsijghalintq as part of retiring
-- Legibility, taking golden_eval_runs with it. The measurement still happened: run
-- iso-63-2026-07-05, on a held-out test split of 63 items, on 2026-07-05, and
-- src/data/calibration.json is the artifact it produced. What was lost was the row behind
-- the artifact, and with it the traceability the whole arrangement depends on.
--
-- This restores that row, reconstructed from the artifact the run generated. Every value
-- below, including the row id, is copied from src/data/calibration.json so the stored row
-- and the published figures are identical rather than merely consistent.
--
-- Stated plainly because it matters: this is a reconstruction of a destroyed record, not a
-- new measurement. Nothing here was re-run. The honest next step is a fresh evaluation
-- against the worker's golden corpus, after which this row becomes history rather than the
-- source of what the front page claims. Until that happens, the figures on the page are as
-- old as their calibration_version says they are, which is why the version and the sample
-- size travel with the number everywhere it appears.
--
-- The recall_jsonld and recall_shopify columns are deliberately left null: the artifact
-- does not carry them, and inventing them to make the row look complete is exactly the
-- failure this table exists to prevent.

insert into public.golden_eval_runs (
  id,
  created_at,
  calibration_version,
  split,
  n,
  precision_at_gate,
  precision_wilson_low,
  recall_gtin,
  adversarial_rejection,
  ece,
  notes
) values (
  '0272d24d-25b2-4687-9e9d-5b87f43b42a8',
  '2026-07-06T00:00:00Z',
  'iso-63-2026-07-05',
  'test',
  63,
  1.0,
  0.832,
  1.0,
  1.0,
  0.19,
  'Reconstructed 2026-09-23 from src/data/calibration.json after the original row was destroyed by g25_legibility_project_cleanup_r98 on project cgkcplcamsijghalintq. Not a re-run. Supersede with a fresh evaluation.'
)
on conflict (id) do nothing;
