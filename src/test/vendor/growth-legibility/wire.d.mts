// Types for the vendored validator (wire.mjs, growth-legibility at a pinned commit). Only what
// the export tests call is declared.
export const VERSION: string;
export function validateSnapshot(snapshot: unknown, at: string): unknown;
export function canonical(value: unknown): string;
