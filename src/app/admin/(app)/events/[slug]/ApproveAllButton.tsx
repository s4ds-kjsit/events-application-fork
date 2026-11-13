"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCheck } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * "Approve all" for the Needs review tab.
 *
 * Sends the ids on screen, not "everything pending", so someone who registers
 * while the page is open isn't approved unseen. Every approval sends an email
 * that can't be unsent, so the first click only arms a confirm step.
 */
export function ApproveAllButton({ slug, ids }: { slug: string; ids: string[] }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (ids.length === 0) return null;

  async function approveAll() {
    setBusy(true);
    setError(null);

    let response: Response;
    try {
      response = await fetch(`/api/admin/events/${slug}/approve-all`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
    } catch {
      setError("Couldn't reach the server. Check your connection and try again.");
      setBusy(false);
      return;
    }

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      setError(body.error ?? "Could not approve");
      setBusy(false);
      return;
    }

    setConfirming(false);
    startTransition(() => {
      router.refresh();
      setBusy(false);
    });
  }

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      {confirming ? (
        <>
          <span className="text-sm text-muted-foreground">
            Approve {ids.length} and email each of them?
          </span>
          <Button size="sm" variant="outline" disabled={busy} onClick={() => setConfirming(false)}>
            Cancel
          </Button>
          <Button size="sm" disabled={busy} onClick={approveAll}>
            {busy ? "Approving…" : `Yes, approve ${ids.length}`}
          </Button>
        </>
      ) : (
        <Button size="sm" onClick={() => setConfirming(true)}>
          <CheckCheck className="size-4" />
          Approve all ({ids.length})
        </Button>
      )}
    </div>
  );
}
