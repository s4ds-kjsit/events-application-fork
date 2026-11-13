/**
 * In-process email worker — the thing that actually sends queued mail.
 *
 * Registration only writes a row to `email_jobs`; something has to drain it.
 * On Netlify that was a scheduled function, but the app now runs as a
 * long-lived `next start` on a VPS, where nothing calls the cron route on its
 * own — mail sat queued until someone pressed "send all" in admin. So the
 * server drains the queue itself, the same way in dev and in production.
 *
 * Set EMAIL_WORKER=off to disable it (for example on a local dev server that
 * shouldn't send real mail from the production queue). Several instances
 * running this at once is safe: claim_email_jobs uses FOR UPDATE SKIP LOCKED,
 * so each job is claimed by exactly one of them.
 *
 * Certificates are deliberately left out (processEmailQueue's default) — they
 * are sent by hand from admin, never automatically.
 */
export async function register() {
  // instrumentation also loads in the edge runtime, where none of this works.
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  // `next build` loads this too; a timer there would hold the build open.
  if (process.env.NEXT_PHASE === "phase-production-build") return;
  if (process.env.EMAIL_WORKER === "off") {
    console.log("[email] worker off (EMAIL_WORKER=off) — queued mail won't send from this server");
    return;
  }

  const { processEmailQueue } = await import("@/lib/email/worker");

  const INTERVAL_MS = 15_000;
  let running = false;

  setInterval(async () => {
    // A slow SMTP round trip must not stack up overlapping drains.
    if (running) return;
    running = true;

    try {
      const { sent, failed } = await processEmailQueue(5);
      if (sent || failed) {
        console.log(`[email] sent ${sent}, failed ${failed}`);
      }
    } catch (error) {
      // Never crash the server over this — a missing Gmail password or a
      // database blip shouldn't take registrations down with it. The next
      // tick retries.
      console.error("[email] drain failed:", error instanceof Error ? error.message : error);
    } finally {
      running = false;
    }
  }, INTERVAL_MS).unref?.();

  console.log(`[email] worker on — draining the queue every ${INTERVAL_MS / 1000}s`);
}
