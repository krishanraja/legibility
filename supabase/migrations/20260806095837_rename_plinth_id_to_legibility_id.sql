-- Rebrand Plinth to Legibility. Both tables are empty (0 rows) at time of rename,
-- so this is a free operation with no data migration and no backfill.
-- No function body references plinth_id, verified against pg_proc before applying.
--
-- NOTE: the minted identity VALUE prefix is still `pl_`, because the worker
-- (a separate repo) mints it. Changing that prefix is a worker-side change.

ALTER TABLE public.product_cache   RENAME COLUMN plinth_id TO legibility_id;
ALTER TABLE public.outcome_reports RENAME COLUMN plinth_id TO legibility_id;

ALTER INDEX IF EXISTS public.product_cache_plinth_id_idx  RENAME TO product_cache_legibility_id_idx;
ALTER INDEX IF EXISTS public.outcome_reports_plinth_idx   RENAME TO outcome_reports_legibility_idx;

COMMENT ON COLUMN public.product_cache.legibility_id IS
  'Opaque minted product identity, stable across re-reads, never derived from URL or GTIN. The moat anchor for longitudinal history.';
