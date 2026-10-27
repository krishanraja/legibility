import type { FormEvent, ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  COPY,
  curlFor,
  mcpConfigFor,
  type FoundingInput,
  type FoundingReport,
} from "@/lib/api/founding";

/**
 * A3: the Founding 200 page's views. Pure: each takes props and renders, so every state the
 * page can show is rendered and checked in the tests (no booking link, no em dash, no promise
 * beyond the offer). The route (src/routes/founding-200.tsx) holds the state and calls the
 * server.
 */

export function Intro() {
  return (
    <header>
      <h1 className="font-display text-5xl">{COPY.title}</h1>
      <p className="mt-4 text-lg text-foreground">{COPY.lead}</p>
      <p className="mt-4 text-muted-foreground">{COPY.offer}</p>
      <p className="mt-3 text-sm text-muted-foreground">{COPY.scope}</p>
    </header>
  );
}

export type RunFormValues = {
  input: string;
  use_case: string;
  interface: "rest" | "mcp";
  stores: string;
};

export function RunForm({
  values,
  onChange,
  onSubmit,
  busy,
  disabled = false,
  message,
  challenge,
}: {
  values: RunFormValues;
  onChange: (v: RunFormValues) => void;
  onSubmit: (e: FormEvent) => void;
  busy: boolean;
  /** The test cannot run yet (the challenge has not loaded, or it is paused). */
  disabled?: boolean;
  message: string | null;
  challenge: ReactNode;
}) {
  const set = (k: keyof RunFormValues) => (e: { target: { value: string } }) =>
    onChange({ ...values, [k]: e.target.value });
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <label className="block">
        <span className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
          One product URL or barcode
        </span>
        <Input
          required
          value={values.input}
          onChange={set("input")}
          placeholder="https://shop.example/products/item or a 13-digit barcode"
          className="mt-2 bg-background"
        />
      </label>
      <label className="block">
        <span className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
          What you are building
        </span>
        <Input
          value={values.use_case}
          onChange={set("use_case")}
          placeholder="A comparison agent for outdoor gear"
          className="mt-2 bg-background"
        />
      </label>
      <fieldset>
        <legend className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
          How you will call it
        </legend>
        <div className="mt-2 flex gap-4 text-sm">
          {(["rest", "mcp"] as const).map((v) => (
            <label key={v} className="flex items-center gap-2">
              <input
                type="radio"
                name="interface"
                value={v}
                checked={values.interface === v}
                onChange={() => onChange({ ...values, interface: v })}
              />
              {v === "rest" ? "REST" : "MCP"}
            </label>
          ))}
        </div>
      </fieldset>
      <label className="block">
        <span className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
          Which stores matter to you
        </span>
        <Input
          value={values.stores}
          onChange={set("stores")}
          placeholder="Shopify stores, a few big retailers"
          className="mt-2 bg-background"
        />
      </label>
      {challenge}
      <Button
        type="submit"
        disabled={busy || disabled}
        className="bg-signal text-background hover:bg-signal/90"
      >
        {busy ? "Running the test" : "Run the test"}
      </Button>
      {message && <p className="font-mono text-sm text-signal">{message}</p>}
    </form>
  );
}

function price(r: FoundingReport) {
  if (!r.price || r.price.low === null) return "no price band";
  const { low, high, currency } = r.price;
  return `${low}${high !== null && high !== low ? ` to ${high}` : ""} ${currency ?? ""}`.trim();
}

export function ReportCard({ report, trusted }: { report: FoundingReport; trusted: boolean }) {
  return (
    <div className="rounded-md border border-hairline bg-surface p-5">
      <div className="font-display text-2xl">{report.title ?? "No product returned"}</div>
      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 font-mono text-xs text-muted-foreground">
        <dt>brand</dt>
        <dd className="text-foreground">{report.brand ?? "none"}</dd>
        <dt>price band</dt>
        <dd className="text-foreground">{price(report)}</dd>
        <dt>availability</dt>
        <dd className="text-foreground">{report.availability ?? "unknown"}</dd>
        <dt>confidence</dt>
        <dd className="text-foreground">{report.confidence ?? "none"}</dd>
        <dt>method</dt>
        <dd className="text-foreground">{report.method ?? "none"}</dd>
        <dt>cost of this read</dt>
        <dd className="text-foreground">{report.cost_usd} USD</dd>
      </dl>
      <p className="mt-4 text-sm text-muted-foreground">
        {trusted ? COPY.fitNote : COPY.nonFitNote}
      </p>
    </div>
  );
}

export function EmailStep({
  email,
  onEmail,
  onSubmit,
  busy,
}: {
  email: string;
  onEmail: (v: string) => void;
  onSubmit: (e: FormEvent) => void;
  busy: boolean;
}) {
  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <p className="text-sm text-muted-foreground">{COPY.emailAsk}</p>
      <div className="flex flex-col gap-3 sm:flex-row">
        <Input
          required
          type="email"
          value={email}
          onChange={(e) => onEmail(e.target.value)}
          aria-label="Your email"
          className="bg-background"
        />
        <Button type="submit" disabled={busy} variant="outline" className="shrink-0">
          {busy ? "Sending" : "Send me the link"}
        </Button>
      </div>
    </form>
  );
}

export function Sent() {
  return <p className="font-mono text-sm text-foreground">{COPY.sent}</p>;
}

export function Welcome({
  apiKey,
  keyHint,
  input,
  report,
  trusted,
  contact,
}: {
  apiKey: string | null;
  keyHint: string | null;
  input: FoundingInput;
  report: FoundingReport;
  trusted: boolean;
  contact: string | null;
}) {
  const shown = apiKey ?? "lgk_your_key";
  return (
    <div className="space-y-6">
      {apiKey ? (
        <div>
          <div className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
            Your key, shown once
          </div>
          <pre className="mt-2 overflow-x-auto rounded-md border border-hairline bg-surface p-4 font-mono text-sm">
            {apiKey}
          </pre>
          <p className="mt-2 text-sm text-muted-foreground">
            Copy it now. We keep only a hash, so it cannot be shown again.
          </p>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          You already have a key{keyHint ? ` (${keyHint})` : ""}. Use it below, or revoke it in the
          dashboard to make a new one.
        </p>
      )}
      <ReportCard report={report} trusted={trusted} />
      <div>
        <div className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
          The same read from your terminal
        </div>
        <pre className="mt-2 overflow-x-auto rounded-md border border-hairline bg-surface p-4 font-mono text-xs">
          {curlFor(input, shown)}
        </pre>
      </div>
      <div>
        <div className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
          Or as an MCP server
        </div>
        <pre className="mt-2 overflow-x-auto rounded-md border border-hairline bg-surface p-4 font-mono text-xs">
          {mcpConfigFor(shown)}
        </pre>
      </div>
      {trusted && contact && (
        <p className="text-sm text-muted-foreground">{COPY.callOffer(contact)}</p>
      )}
    </div>
  );
}
