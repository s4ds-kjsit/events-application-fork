import type { FieldDef } from "@/lib/form-types";

/**
 * The extra questions each event asks, keyed by `Event.form_key`.
 *
 * There is deliberately no drag-and-drop builder. Adding an event with
 * different questions is a one-line edit here plus a deploy.
 *
 * `full_name`, `email` and `phone` are columns on every registration — they are
 * asked by default and must NOT be repeated here.
 *
 * Rules:
 *  - A `key` is permanent. Renaming it orphans the answers already collected.
 *  - Every key here becomes a CSV column in the admin export.
 */
export const FORMS = {
  /** Internal KJSIT event — students only */
  "kjsit-student": [
    {
      key: "department",
      label: "Department",
      type: "select",
      required: true,
      options: ["AIDS", "COMPS", "IT", "EXTC", "MECH", "ETRX"],
    },
    {
      key: "year",
      label: "Year of Study",
      type: "select",
      required: true,
      options: ["FE", "SE", "TE", "BE"],
    },
    {
      key: "division",
      label: "Division",
      type: "select",
      required: true,
      options: ["A", "B", "C", "D"],
    },
  ],

  /** Open to students from other colleges and to working professionals */
  "open-public": [
    {
      key: "organization",
      label: "College / Company",
      type: "text",
      required: true,
    },
    {
      key: "role",
      label: "You are a",
      type: "radio",
      required: true,
      options: ["Student", "Working professional", "Other"],
    },
    {
      key: "linkedin",
      label: "LinkedIn profile",
      type: "text",
      required: false,
      placeholder: "https://linkedin.com/in/...",
    },
  ],

  /**
   * AI Agents Workshop, Aug 2026.
   *
   * The last three questions exist for specific reasons, not just to collect
   * data — say so in the hints so people answer honestly:
   *  - own_laptop    -> how many lab machines to reserve
   *  - os            -> which setup/troubleshooting slides to prepare
   *  - python_comfort -> pairing beginners with people who can help
   */
  "ai-agents-workshop": [
    {
      key: "department",
      label: "Department",
      type: "radio",
      required: true,
      options: ["COMPS", "AI-DS", "IT", "EXTC"],
    },
    {
      key: "year",
      label: "Year of Study",
      type: "radio",
      required: true,
      options: ["FY", "SY", "TY", "LY"],
    },
    {
      key: "own_laptop",
      label: "Will you bring your own laptop?",
      type: "radio",
      required: true,
      options: [
        "Yes, I'll bring my own laptop",
        "No, I need a lab machine",
      ],
      hint: "Bringing your own is strongly recommended",
      emphasiseHint: true,
    },
    {
      key: "os",
      label: "Which OS is on your device?",
      type: "radio",
      required: true,
      options: ["Windows", "macOS", "Linux"],
      hint: "So we can prepare the right setup steps for virtualenv activation and install errors.",
    },
    {
      key: "python_comfort",
      label: "How comfortable are you with Python?",
      type: "radio",
      required: true,
      options: [
        "None - complete beginner",
        "Basic - I can read and edit scripts",
        "Comfortable - I write my own",
        "I build stuff regularly",
      ],
      hint: "Answer honestly. We use this to seat people in pairs so nobody gets stuck alone.",
    },
  ],

  /**
   * Mahakumbh Hackathon — selected teams work with the Government of
   * Maharashtra on the Nashik Kumbh Mela (Aug–Sep 2027).
   *
   * One registration = one TEAM, not one person. The name/email/phone columns
   * on the registration are the team lead's — they're the single contact we
   * mail the ticket and every update to. Member 2 is captured here.
   *
   * `problem_statement` is the field the whole shortlisting runs off: three
   * teams are selected per statement, so admins sort the responses by it. The
   * twelve options are the WRC/ICSSR list, verbatim and in their published
   * order — do not reword them, the outcome goes back to the Government of
   * Maharashtra against these exact headings.
   */
  "mahakumbh-hackathon": [
    {
      key: "team_name",
      label: "Team name",
      type: "text",
      required: true,
      placeholder: "e.g. Team Trimbak",
      hint: "Shown on your certificates. Keep it clean — we'll rename anything we can't print.",
    },
    {
      key: "problem_statement",
      label: "Problem statement",
      type: "select",
      required: true,
      options: [
        "1. Finance aspect of Mahakumbh",
        "2. Planning and organization of Mahakumbh",
        "3. Critical analysis of the supply chain issues in Mahakumbh",
        "4. Management of transportation during Mahakumbh",
        "5. Planning for important aspects such as Shahi Snan",
        "6. Human resources planning regarding the Mahakumbh",
        "7. Role of local government in Mahakumbh",
        "8. Life experiences of visitors to Mahakumbh",
        "9. Science / Scientific angle of Mahakumbh",
        "10. Role of Social Media in organizing, managing Mahakumbh",
        "11. Role of AI in organizing, managing Mahakumbh",
        "12. Any other topic in the aspect of Mahakumbh",
      ],
      hint: "Only three teams are selected per statement. Pick the one you actually want to build for — we do not reassign teams.",
      emphasiseHint: true,
    },
    {
      key: "problem_statement_pitch",
      label: "Your approach to that problem statement",
      type: "textarea",
      required: true,
      placeholder:
        "What you'd build, what data you'd need, and what the government would get at the end.",
      hint: "This is what the shortlisting is judged on. A few honest sentences beat a paragraph of buzzwords.",
    },

    // --- team lead (the person filling this in) ------------------------------
    {
      key: "lead_organization",
      label: "Team lead — college / organization",
      type: "text",
      required: true,
    },
    {
      key: "lead_year",
      label: "Team lead — year of study",
      type: "select",
      required: true,
      options: ["FE", "SE", "TE", "BE", "PG", "Not a student"],
    },

    // --- member 2 ------------------------------------------------------------
    // Teams are exactly two. We collect the second member here rather than
    // asking them to register separately: a half-registered team is worse than
    // no team, and the pair has to be fixed before shortlisting anyway.
    {
      key: "member2_name",
      label: "Member 2 — full name",
      type: "text",
      required: true,
      hint: "Teams are exactly two people. Both names go on the certificates, so spell it the way it should be printed.",
      emphasiseHint: true,
    },
    {
      key: "member2_email",
      label: "Member 2 — email",
      type: "email",
      required: true,
      hint: "Must be different from the team lead's. All official mail still goes to the lead.",
    },
    {
      key: "member2_phone",
      label: "Member 2 — phone",
      type: "phone",
      required: true,
    },
    {
      key: "member2_organization",
      label: "Member 2 — college / organization",
      type: "text",
      required: true,
      hint: "Can be different from the lead's — cross-college teams are allowed.",
    },
    {
      key: "member2_year",
      label: "Member 2 — year of study",
      type: "select",
      required: true,
      options: ["FE", "SE", "TE", "BE", "PG", "Not a student"],
    },

    // --- consent -------------------------------------------------------------
    {
      key: "govt_consent",
      label:
        "Both members agree that, if selected, our work may be submitted to the Government of Maharashtra",
      type: "checkbox",
      required: true,
      hint: "The outcome of the selected projects goes to the state for the Nashik Kumbh Mela. Confirm with your teammate before ticking.",
      emphasiseHint: true,
    },
  ],

  /** Nothing beyond name/email/phone */
  minimal: [],
} as const satisfies Record<string, readonly FieldDef[]>;

export type FormKey = keyof typeof FORMS;

export const FORM_KEYS = Object.keys(FORMS) as FormKey[];

export function isFormKey(value: string): value is FormKey {
  return value in FORMS;
}

/**
 * Never index FORMS directly from a DB value — a stale `form_key` left behind
 * by a deploy would render an event page with no questions and silently accept
 * incomplete registrations. Fail loudly instead.
 */
export function getFormFields(formKey: string): FieldDef[] {
  if (!isFormKey(formKey)) {
    throw new Error(
      `Unknown form_key "${formKey}". Known keys: ${FORM_KEYS.join(", ")}. ` +
        `Either add it to src/config/forms/index.ts or fix the event.`,
    );
  }
  return FORMS[formKey] as unknown as FieldDef[];
}
