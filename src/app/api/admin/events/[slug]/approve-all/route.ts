import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/supabase";
import { requireRole, AuthError } from "@/lib/auth";
import { enqueueEmail, ticketUrl } from "@/lib/email/queue";
import { emailPayload } from "@/lib/email/payload";

const bodySchema = z.object({
  // The ids the admin was actually looking at. Approving "every PENDING row"
  // instead would also approve anyone who registered after the page loaded —
  // people nobody has reviewed.
  ids: z.array(z.string().uuid()).min(1).max(1000),
});

/**
 * Approve every registration in the "Needs review" list at once.
 *
 * Same effect as pressing Approve on each row: status goes to APPROVED and each
 * person gets one "approved" email. Only rows that are still PENDING change, so
 * someone rejected or approved in another tab meanwhile is left alone and never
 * gets a second email.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    await requireRole("ADMIN");
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Nothing to approve" }, { status: 400 });
  }

  const { slug } = await params;
  const { data: event, error: eventError } = await db
    .from("events")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();

  if (eventError) throw eventError;
  if (!event) return NextResponse.json({ error: "Event not found" }, { status: 404 });

  // One conditional UPDATE: the `status = PENDING` filter is what makes a
  // double click or a second admin harmless — the rows it returns are exactly
  // the ones that changed, and only those are emailed.
  const { data: approved, error } = await db
    .from("registrations")
    .update({ status: "APPROVED" })
    .eq("event_id", event.id)
    .eq("status", "PENDING")
    .in("id", parsed.data.ids)
    .select("id, code, full_name, email");

  if (error) {
    console.error("approve-all failed:", error);
    return NextResponse.json({ error: "Could not approve" }, { status: 500 });
  }

  if (approved.length) {
    // The event part of the payload is identical for everyone, so look it up
    // once rather than twice per person.
    const base = await emailPayload(event.id, "", "");

    await Promise.all(
      approved.map((row) =>
        enqueueEmail({
          to: row.email,
          event_id: event.id,
          template: "approved",
          registration_id: row.id,
          payload: { ...base, name: row.full_name, code: row.code, ticket_url: ticketUrl(row.code) },
        }),
      ),
    );
  }

  return NextResponse.json({ ok: true, approved: approved.length });
}
