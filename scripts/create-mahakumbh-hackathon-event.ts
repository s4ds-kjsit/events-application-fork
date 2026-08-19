import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../src/lib/database.types";

/**
 * Creates (or updates) the Mahakumbh Hackathon event.
 *
 * Selected teams work with the Government of Maharashtra on the Nashik Kumbh
 * Mela (Aug-Sep 2027). Twelve problem statements from the WRC/ICSSR call,
 * three teams shortlisted per statement, two members per team.
 *
 * Safe to re-run - it upserts on slug rather than wiping, unlike `db:seed`.
 * Unlike create-ai-agents-event.ts this does NOT touch admin_users; use
 * scripts/create-admin.ts if you need a login.
 *
 *   npx tsx scripts/create-mahakumbh-hackathon-event.ts
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

// The real schedule isn't fixed yet. These are PLACEHOLDERS — edit them and
// re-run this script once the dates are confirmed, the upsert will update them.
// IST offset is explicit, same as the other event scripts.
const DAY_1_START = "2026-10-10T09:00:00+05:30";
const DAY_1_END = "2026-10-10T21:00:00+05:30";
const DAY_2_START = "2026-10-11T09:00:00+05:30";
const DAY_2_END = "2026-10-11T18:00:00+05:30";

const REGISTRATION_CLOSES_AT = "2026-10-05T23:59:00+05:30";

// 12 problem statements x 3 teams. Capacity counts TEAMS, because one
// registration is one team — 36 teams is 72 people in the room.
const PROBLEM_STATEMENTS = 12;
const TEAMS_PER_PROBLEM_STATEMENT = 3;
const MEMBERS_PER_TEAM = 2;
const TEAM_CAPACITY = PROBLEM_STATEMENTS * TEAMS_PER_PROBLEM_STATEMENT;

async function main() {
  const [event] = check(
    "upsert event",
    await db
      .from("events")
      .upsert(
        {
          slug: "mahakumbh-hackathon",
          title: "Mahakumbh Hackathon",
          tagline: "Build for the Nashik Kumbh Mela, with the Government of Maharashtra",
          description: [
            "The Mahakumbh was organised in Prayagraj in 2025. The next Kumbh Mela comes to **Nashik, Maharashtra** in August–September 2027 — and the planning starts now.",
            "",
            "Working from the Western Regional Centre (WRC/ICSSR) call for research on *Learnings from Organization of Mahakumbh*, this hackathon puts student teams on the same twelve problems. **Selected teams work directly with the Government of Maharashtra**, and their output is submitted to the state for the organisation of the Kumbh Mela.",
            "",
            "**How it works**",
            "",
            `- Teams of exactly **${MEMBERS_PER_TEAM}**. One person registers for the team and is the contact for everything after.`,
            `- You pick **one** of the ${PROBLEM_STATEMENTS} problem statements below when you register.`,
            `- **${TEAMS_PER_PROBLEM_STATEMENT} teams are selected per problem statement** — ${TEAM_CAPACITY} teams in total.`,
            "- Shortlisting is on your written approach, so take that question seriously. Registering does not mean you're in.",
            "",
            "**The twelve problem statements**",
            "",
            "1. Finance aspect of Mahakumbh",
            "2. Planning and organization of Mahakumbh",
            "3. Critical analysis of the supply chain issues in Mahakumbh",
            "4. Management of transportation during Mahakumbh",
            "5. Planning for important aspects such as Shahi Snan (शाही स्नान)",
            "6. Human resources planning regarding the Mahakumbh",
            "7. Role of local government in Mahakumbh",
            "8. Life experiences of visitors to Mahakumbh",
            "9. Science / Scientific angle of Mahakumbh",
            "10. Role of Social Media in organizing, managing Mahakumbh",
            "11. Role of AI in organizing, managing Mahakumbh",
            "12. Any other topic in the aspect of Mahakumbh",
            "",
            "**What to bring**",
            "",
            "Your own laptop. Bring anything you've already read on crowd management, civic planning or the 2025 Mahakumbh — the strongest submissions are the ones that start from real material rather than from scratch.",
            "",
            "Open to students across departments and colleges. Cross-college teams are allowed.",
          ].join("\n"),
          venue: "KJSIT, Vidyavihar",
          form_key: "mahakumbh-hackathon",
          starts_at: DAY_1_START,
          ends_at: DAY_2_END,
          capacity: TEAM_CAPACITY,
          status: "PUBLISHED",
          registration_opens_at: new Date().toISOString(),
          registration_closes_at: REGISTRATION_CLOSES_AT,
          // Free — the selection, not a fee, is the filter.
          requires_payment: false,
          fee_amount: null,
          payment_qr_url: null,
          // Every team starts PENDING. Three per problem statement are approved
          // by hand from /admin/events/mahakumbh-hackathon — auto-approve here
          // would hand out all 36 places first-come-first-served and defeat the
          // whole selection.
          auto_approve: false,
          certificate_enabled: true,
        },
        { onConflict: "slug" },
      )
      .select("*"),
  );

  console.log(`Event: ${event.title} (${event.id})`);

  // Days are upserted separately so re-running doesn't duplicate them.
  check(
    "upsert days",
    await db
      .from("event_days")
      .upsert(
        [
          {
            event_id: event.id,
            day_number: 1,
            label: "Day 1 — Problem briefing & build",
            date: DAY_1_START,
          },
          {
            event_id: event.id,
            day_number: 2,
            label: "Day 2 — Evaluation & government panel",
            date: DAY_2_START,
          },
        ],
        { onConflict: "event_id,day_number" },
      )
      .select("id"),
  );

  console.log("\nDone.");
  console.log(`  Public page : /${event.slug}`);
  console.log(`  Admin        : /admin/events/${event.slug}`);
  console.log(
    `\nCapacity: ${TEAM_CAPACITY} teams ` +
      `(${PROBLEM_STATEMENTS} problem statements x ${TEAMS_PER_PROBLEM_STATEMENT}) ` +
      `= ${TEAM_CAPACITY * MEMBERS_PER_TEAM} people.`,
  );
  console.log(`Day 1: ${DAY_1_START}  ->  ${DAY_1_END}`);
  console.log(`Day 2: ${DAY_2_START}  ->  ${DAY_2_END}`);
  console.log(
    "\nDates above are PLACEHOLDERS. Edit the constants at the top of this " +
      "script and re-run once the schedule is confirmed.",
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
