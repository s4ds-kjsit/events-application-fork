/**
 * Events whose schedule isn't fixed yet, keyed by `Event.slug`.
 *
 * `events.starts_at` / `ends_at` are NOT NULL — the schema has no way to say
 * "not decided", and giving them a nullable date would put an "is it real?"
 * check on every consumer of every event. So the row carries a placeholder and
 * this list is what stops the site from presenting that placeholder as fact.
 *
 * A wrong date on a public page is worse than no date: people plan around it,
 * and the correction never reaches everyone who saw the first version.
 *
 * **Delete the slug the moment the dates are confirmed** — the placeholder does
 * not stop being a placeholder on its own, it just stops being hidden.
 */
export const SCHEDULE_TBA = new Set<string>(["mahakumbh-hackathon"]);

export function isScheduleTba(slug: string): boolean {
  return SCHEDULE_TBA.has(slug);
}

/** Shown wherever a date would otherwise go. */
export const SCHEDULE_TBA_LABEL = "Dates to be announced";
