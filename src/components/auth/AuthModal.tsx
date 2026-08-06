import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function AuthModal({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    setSending(true);
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/dashboard` },
    });
    setSending(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setSent(true);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-surface border-hairline sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">Sign in to Legibility</DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Magic link, no password. New here? Signing in creates your account.
          </DialogDescription>
        </DialogHeader>
        {sent ? (
          <div className="rounded-md border border-hairline bg-background p-5 text-sm">
            <p className="font-medium text-foreground">Check your inbox.</p>
            <p className="mt-1 text-muted-foreground">
              We sent a sign-in link to <span className="font-mono">{email}</span>.
            </p>
          </div>
        ) : (
          <form onSubmit={send} className="space-y-3">
            <Input
              type="email"
              placeholder="you@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
              className="bg-background"
            />
            <Button
              type="submit"
              disabled={sending || !email}
              className="w-full bg-signal text-background hover:bg-signal/90"
            >
              {sending ? "Sending…" : "Send magic link"}
            </Button>
            <p className="text-xs text-muted-foreground">
              By continuing you agree to the{" "}
              <a href="/terms" className="underline">
                Terms
              </a>{" "}
              and{" "}
              <a href="/privacy" className="underline">
                Privacy Policy
              </a>
              .
            </p>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
