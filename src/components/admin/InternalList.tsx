import { useCallback, useEffect, useState } from "react";

import { INTERNAL_CLASSES, type InternalClass } from "@/lib/api/internal-accounts";
import {
  addInternalAccount,
  getInternalList,
  removeInternalAccount,
  setInternalKey,
  type InternalAccount,
} from "@/lib/api/internal.functions";

/**
 * A1: the internal list, kept by an admin at run time.
 *
 * Every account here, and every key on it, is left out of the North Star and exported as
 * internal. A key can carry a class of its own (the growth engine's key, a CI key), but only
 * on an account that is already on the list: the database refuses anything else.
 */

type Payload = Awaited<ReturnType<typeof getInternalList>>;

const fieldClass =
  "rounded-sm border border-hairline bg-background px-2 py-1.5 font-mono text-xs text-foreground";
const buttonClass =
  "rounded-sm border border-hairline px-2 py-1 font-mono text-xs text-muted-foreground hover:border-signal hover:text-signal disabled:opacity-50";

export function InternalList({ onChange }: { onChange?: () => void }) {
  const [payload, setPayload] = useState<Payload | null>(null);
  const [identifier, setIdentifier] = useState("");
  const [cls, setCls] = useState<InternalClass>("krish");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(() => {
    getInternalList()
      .then(setPayload)
      .catch(() => setPayload({ admin: false }));
  }, []);
  useEffect(load, [load]);

  const act = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setMessage(null);
    try {
      await fn();
      load();
      onChange?.();
      return true;
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "That did not save.");
      return false;
    } finally {
      setBusy(false);
    }
  };

  if (!payload || !payload.admin) return null;
  const accounts = payload.accounts ?? [];

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Accounts on this list, and every key on them, are left out of the North Star. Add one by its
        account id or its sign-in address.
      </p>

      <form
        className="flex flex-wrap items-center gap-2"
        onSubmit={async (e) => {
          e.preventDefault();
          const ok = await act(() => addInternalAccount({ data: { identifier, class: cls } }));
          if (ok) setIdentifier("");
        }}
      >
        <input
          aria-label="Account id or sign-in address"
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
          placeholder="account id or sign-in address"
          className={`${fieldClass} min-w-[260px] flex-1`}
        />
        <ClassPicker value={cls} onChange={setCls} label="Class" />
        <button type="submit" disabled={busy || identifier.trim() === ""} className={buttonClass}>
          add
        </button>
      </form>
      {message && <p className="font-mono text-xs text-destructive">{message}</p>}

      {accounts.length === 0 ? (
        <div className="rounded-md border border-dashed border-hairline bg-surface p-6 text-center font-mono text-xs text-muted-foreground">
          No internal accounts yet, so the number counts every account.
        </div>
      ) : (
        <div className="divide-y divide-hairline rounded-md border border-hairline">
          {accounts.map((a) => (
            <AccountRow key={a.account_id} account={a} busy={busy} act={act} />
          ))}
        </div>
      )}
    </div>
  );
}

function AccountRow({
  account,
  busy,
  act,
}: {
  account: InternalAccount;
  busy: boolean;
  act: (fn: () => Promise<unknown>) => Promise<boolean>;
}) {
  return (
    <div className="p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-3 font-mono text-xs">
        <div>
          <span className="text-foreground">{account.label ?? account.account_id}</span>
          <span className="ml-2 text-signal">{account.class}</span>
          <span className="ml-2 text-muted-foreground">added {account.added_at.slice(0, 10)}</span>
        </div>
        <button
          disabled={busy}
          onClick={() =>
            act(() => removeInternalAccount({ data: { accountId: account.account_id } }))
          }
          className={buttonClass}
        >
          remove
        </button>
      </div>
      {account.keys.length > 0 && (
        <ul className="mt-3 space-y-2 font-mono text-xs text-muted-foreground">
          {account.keys.map((k) => (
            <li key={k.key_id} className="flex flex-wrap items-center gap-2">
              <span className="text-foreground">
                {k.prefix}...{k.last_four}
              </span>
              {k.revoked && <span>revoked</span>}
              <span>{k.class ? `key class ${k.class}` : "internal by its account"}</span>
              <ClassPicker
                label="Key class"
                value={k.class as InternalClass | null}
                allowNone
                onChange={(c) =>
                  act(() => setInternalKey({ data: { keyId: k.key_id, class: c ?? null } }))
                }
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ClassPicker<T extends InternalClass | null>({
  value,
  onChange,
  label,
  allowNone,
}: {
  value: T;
  onChange: (c: T) => void;
  label: string;
  allowNone?: boolean;
}) {
  return (
    <select
      aria-label={label}
      value={value ?? ""}
      onChange={(e) => onChange((e.target.value === "" ? null : e.target.value) as T)}
      className={fieldClass}
    >
      {allowNone && <option value="">no key class</option>}
      {INTERNAL_CLASSES.map((c) => (
        <option key={c} value={c}>
          {c}
        </option>
      ))}
    </select>
  );
}
