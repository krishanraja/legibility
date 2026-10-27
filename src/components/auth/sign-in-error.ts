// supabase-js stringifies the raw Response on a 5xx, so the message is "{}".
// Map status to copy a person can act on instead of echoing it.
export function signInErrorMessage(error: { message?: string; status?: number }): string {
  if (error.status === 429) {
    return "Too many sign-in emails just now. Wait a minute, then try again.";
  }
  const message = error.message?.trim() ?? "";
  if ((error.status ?? 0) >= 500 || !message || message === "{}") {
    return "We could not send your sign-in email. Try again shortly, or write to founders@legibility.io.";
  }
  return message;
}
