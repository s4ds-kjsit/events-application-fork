import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../src/lib/database.types";

/**
 * Creates (or updates) the DevOps Workshop event.
 *
 * Online, 2-hour session with Pratik Parikh (Simbian), open to the public.
 * Free, but every registration starts PENDING and is reviewed by hand from
 * /admin/events/devops-workshop.
 *
 * Safe to re-run — it upserts on slug rather than wiping, unlike `db:seed`.
 * Does NOT touch admin_users; use scripts/create-admin.ts if you need a login.
 *
 *   npx tsx scripts/create-devops-workshop-event.ts
 */

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env");

const db = createClient<Database>(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function check<T>(what: string, result: { data: T | null; error: unknown }): T {
  if (result.error) {
    console.error(`\n${what} failed:`, result.error);
    process.exit(1);
  }
  return result.data as T;
}

// 14 November 2026, 10am to 12pm, IST offset explicit.
const STARTS_AT = "2026-11-14T10:00:00+05:30";
const ENDS_AT = "2026-11-14T12:00:00+05:30";

// Close the night before so there's time to review and send out the link.
const REGISTRATION_CLOSES_AT = "2026-11-13T23:59:00+05:30";

async function main() {
  const [event] = check(
    "upsert event",
    await db
      .from("events")
      .upsert(
        {
          slug: "devops-workshop",
          title: "DevOps Workshop",
          tagline: "From code push to production",
          description: [
            "A two-hour online session on how code actually gets from a developer's laptop to production, and how to automate every step of the way.",
            "",
            "**What we'll cover**",
            "",
            "- **All about DevOps:** the developer-to-production journey and why it matters",
            "- **Containers & Docker:** writing Dockerfiles, building and running images",
            "- **CI/CD pipelines:** end-to-end demo, from code push to automated tests to deployment",
            "- **CI/CD using GitHub Actions:** automating build, test, and deploy workflows",
            "- **Observability with Grafana & Prometheus:** a live metrics dashboard for a running application (if time permits)",
          ].join("\n"),
          venue: "Online",
          banner_url: null,
          form_key: "devops-workshop",
          starts_at: STARTS_AT,
          ends_at: ENDS_AT,
          capacity: null,
          slot_answer_key: null,
          slot_capacity: null,
          status: "PUBLISHED",
          registration_opens_at: new Date().toISOString(),
          registration_closes_at: REGISTRATION_CLOSES_AT,
          requires_payment: false,
          fee_amount: null,
          payment_qr_url: null,
          // Free, but reviewed by hand before anyone is approved.
          auto_approve: false,
          // Online, so there's no QR door check (see event-features) and
          // therefore no attendance for certificates to read from.
          certificate_enabled: false,
        },
        { onConflict: "slug" },
      )
      .select("*"),
  );

  console.log(`Event: ${event.title} (${event.id})`);

  check(
    "upsert days",
    await db
      .from("event_days")
      .upsert([{ event_id: event.id, day_number: 1, label: null, date: STARTS_AT }], {
        onConflict: "event_id,day_number",
      })
      .select("id"),
  );

  console.log("\nDone.");
  console.log(`  Public page : /${event.slug}`);
  console.log(`  Admin       : /admin/events/${event.slug}`);
  console.log(`\nRuns ${STARTS_AT} -> ${ENDS_AT}. Registration closes ${REGISTRATION_CLOSES_AT}.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
