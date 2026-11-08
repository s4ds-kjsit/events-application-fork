import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../src/lib/database.types";

/**
 * Queues the KnowBuild 2.0 "Certificates of Participation" email for every
 * APPROVED team — one email per team, sent to the leader and every teammate
 * at once, with one certificate PDF attached per person.
 *
 * Dry-run by default: prints who would get what and queues nothing. Pass
 * --send to actually insert the email_jobs rows (the worker/cron then sends
 * them the same way every other email goes out).
 *
 * --team can be repeated (or comma-separated) to limit the run to specific
 * teams by name, matched case-insensitively — useful for sending in batches
 * rather than to every approved team at once.
 *
 *   npx tsx scripts/send-knowbuild-certificates.ts                              # preview, all teams
 *   npx tsx scripts/send-knowbuild-certificates.ts --team "Oasis" --team "MKKR" # preview, just these
 *   npx tsx scripts/send-knowbuild-certificates.ts --team "Oasis,MKKR" --send   # queue for real
 */

const EVENT_SLUG = "knowbuild-2-0";

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env");

const db = createClient<Database>(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const DRY_RUN = !process.argv.includes("--send");

const TEAM_FILTER = (() => {
  const names: string[] = [];
  const args = process.argv.slice(2);
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--team" && args[i + 1]) {
      names.push(...args[i + 1].split(","));
      i++;
    }
  }
  const trimmed = names.map((n) => n.trim().toLowerCase()).filter(Boolean);
  return trimmed.length ? new Set(trimmed) : null;
})();

type Member = { name: string; email: string };

function membersFor(fullName: string, email: string, answers: Record<string, unknown>): Member[] {
  const teamSize = Number(answers.team_size) || 1;
  const members: Member[] = [{ name: fullName, email }];

  for (let n = 2; n <= teamSize; n++) {
    const name = answers[`member${n}_name`];
    const memberEmail = answers[`member${n}_email`];
    if (typeof name === "string" && typeof memberEmail === "string" && name && memberEmail) {
      members.push({ name, email: memberEmail });
    }
  }

  return members;
}

async function main() {
  const { data: event, error: eventError } = await db
    .from("events")
    .select("id, title")
    .eq("slug", EVENT_SLUG)
    .single();

  if (eventError || !event) {
    console.error("Could not find event:", eventError);
    process.exit(1);
  }

  const { data: regs, error } = await db
    .from("registrations")
    .select("id, full_name, email, answers")
    .eq("event_id", event.id)
    .eq("status", "APPROVED");

  if (error) {
    console.error("Failed to load registrations:", error);
    process.exit(1);
  }

  if (!regs?.length) {
    console.log("No APPROVED registrations for", EVENT_SLUG);
    return;
  }

  const filteredRegs = TEAM_FILTER
    ? regs.filter((reg) => {
        const answers = (reg.answers ?? {}) as Record<string, unknown>;
        const teamName = typeof answers.team_name === "string" ? answers.team_name : "";
        return TEAM_FILTER.has(teamName.trim().toLowerCase());
      })
    : regs;

  if (TEAM_FILTER && filteredRegs.length !== TEAM_FILTER.size) {
    const found = new Set(
      filteredRegs.map((reg) => {
        const answers = (reg.answers ?? {}) as Record<string, unknown>;
        return String(answers.team_name ?? "").trim().toLowerCase();
      }),
    );
    const missing = [...TEAM_FILTER].filter((name) => !found.has(name));
    if (missing.length) {
      console.error(`Could not find an APPROVED team matching: ${missing.join(", ")}`);
      process.exit(1);
    }
  }

  console.log(
    `${event.title}: ${filteredRegs.length} team(s)${TEAM_FILTER ? " (filtered)" : ""}.\n`,
  );

  const jobs = filteredRegs.map((reg) => {
    const answers = (reg.answers ?? {}) as Record<string, unknown>;
    const teamName = typeof answers.team_name === "string" ? answers.team_name : "Team";
    const members = membersFor(reg.full_name, reg.email, answers);
    const to = members.map((m) => m.email).join(", ");

    console.log(`- ${teamName} (${members.length} member${members.length === 1 ? "" : "s"})`);
    for (const m of members) console.log(`    ${m.name} <${m.email}>`);

    return {
      registration_id: reg.id,
      to,
      template: "knowbuild_certificate" as const,
      status: "QUEUED" as const,
      payload: {
        team_name: teamName,
        event_title: event.title,
        members: members.map((m) => ({ name: m.name })),
      },
    };
  });

  const totalEmails = jobs.reduce(
    (sum, j) => sum + (j.payload.members as { name: string }[]).length,
    0,
  );

  console.log(
    `\n${jobs.length} email(s), ${totalEmails} certificate(s) total.`,
  );

  if (DRY_RUN) {
    console.log("\nDry run — nothing queued. Re-run with --send to queue these emails.");
    return;
  }

  const { error: insertError } = await db.from("email_jobs").insert(jobs);
  if (insertError) {
    console.error("Failed to queue emails:", insertError);
    process.exit(1);
  }

  console.log(
    `\nQueued ${jobs.length} email(s). Unlike the per-attendee "certificate" template, these` +
      ` are not held back from the regular cron — /api/cron/process-emails picks them up on its` +
      ` normal run (every minute in production). Locally, POST to that route with the` +
      ` x-cron-secret header to drain them right away.`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
