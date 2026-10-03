# EcoStorage Affiliate Program — Handoff / Context

Started 2026-10-03, in a separate Claude Code session from the main
`D:\EcoStorage` project. This folder is intentionally isolated — its own
git repo, own Supabase project, own Vercel project, own domain — so it
never shares a codebase or deployment with the main marketing site.

## What this project is

EcoStorage (Singapore valet/non-self-access storage) wants an affiliate /
peer-to-peer referral programme: affiliates get unique referral codes, log
into a portal to see signups attributed to their codes (with status +
duration), the master admin has a console to manage affiliates/codes/all
data, and both admin + the relevant affiliate get emailed when a code is
used. Must stay free to run (no paid services) and scale comfortably for
1–1000 affiliates.

## Architecture decisions already made (confirmed by user)

1. **Signup definition**: any inquiry/signup on the main site submitted
   with an affiliate's referral code attached counts as a trackable signup
   (auto-captured, not manual-only).
2. **Affiliate auth**: standard Supabase Auth email + password (same pattern
   as the main site's `/admin` login), not magic-link or PIN-based.
3. **Attribution mechanism**: URL query param (`?ref=CODE`) + cookie only —
   no manual code-entry field on the form.
4. **Attribution window**: 90 days.
5. **PII exposure to affiliates**: masked (e.g. "J*** T., j***@gmail.com")
   until a lead's status is updated to `active_customer`, then full details
   unlock. Enforced at the data layer, not just hidden in the UI.
6. **Commission tracking**: yes, track a commission rate/amount per signup
   now (even though actual payouts happen manually outside the system for
   now).
7. **Affiliate onboarding**: self-serve application form (public), but the
   application sits as `pending` until master admin manually approves it —
   not auto-approved.
8. **2FA**: not required for affiliates (admin already has 2FA on the main
   site; affiliates just get rate-limited login + Supabase's standard
   protections).
9. **Isolation level**: fully separate — new Supabase project **and** new
   Vercel project, not sharing the main site's database. This means the
   main site's `/api/inquiries` route will eventually need a webhook call
   to relay ref-coded leads over to this system's API (not yet built).
10. **Domain**: a free `*.vercel.app` subdomain for now (no custom domain
    purchase), since the business doesn't yet control `storagespace.com.sg`'s
    DNS to carve out a subdomain there.

## Current blocker (unresolved — needs user decision)

Tried to provision the new Supabase project and hit: **the Supabase org
("hello@level95media.com's Org") is capped at 2 active free projects**, and
it's already at that cap:
- `ecostorage` (ACTIVE_HEALTHY) — the main site, must stay.
- `nkoptics-site` (ACTIVE_HEALTHY) — unrelated project, not EcoStorage.
- `EZStorage` (INACTIVE/paused) — unclear if safe to delete, not confirmed.

Options given to the user, awaiting their choice:
1. Pause or delete `EZStorage` to free a slot (fastest, but needs the user
   to confirm it's actually unused — not something to touch unilaterally).
2. Upgrade the Supabase org to a paid plan (lifts the cap, but conflicts
   with the "stays free" requirement).
3. Fall back to sharing the `ecostorage` Supabase project after all
   (abandons full data isolation, contradicts decision #9 above).

**Next step once unblocked**: run `create_project` (name
`ecostorage-affiliates`, region `ap-southeast-1` to match the main site's
Singapore-local latency) via the Supabase MCP tool, then build out the
schema below.

## Planned database schema (designed, not yet applied — pending the project
unblock above)

Same role-system pattern already retrofitted onto the main `ecostorage`
project (worth copying here since this is a fresh database starting from
zero — there's no existing "admin" concept to retrofit, so build it in
correctly from the start):

- **`profiles`** — `id` (references `auth.users`), `role` (`admin` |
  `affiliate`), auto-created via an `on_auth_user_created` trigger
  defaulting to `affiliate` (least-privilege default). An `is_admin()` SQL
  helper function backs every admin-only RLS policy — never trust
  `auth.role() = 'authenticated'` alone, since affiliates are also real
  authenticated users.
- **`affiliate_applications`** — public can `INSERT` (the self-serve
  application form), only admin can read/approve/reject.
- **`affiliate_profiles`** — created when an application is approved;
  `user_id` links to a real Supabase Auth account (created via
  `supabase.auth.admin.inviteUserByEmail`, which sends Supabase's own
  secure "set your password" email — never generate/email a plaintext
  password ourselves).
- **`affiliate_codes`** — unique, admin-generated only (random,
  collision-checked, never sequential/guessable), optional
  `commission_rate` per code.
- **`affiliate_signups`** — one row per attributed signup; `status` enum
  (`lead` / `contacted` / `active_customer` / `churned`), `commission_amount`,
  `customer_started_at`/`customer_ended_at` (duration = the difference,
  computed at query time, not stored). RLS restricts affiliates to only
  their own codes' rows.
- **`audit_log`** — admin-action accountability trail (service-role insert
  only, no client-facing insert policy).
- **`get_affiliate_signups()`** — a `SECURITY DEFINER` SQL function (not a
  view — Postgres view+RLS interaction is version-dependent and easy to get
  wrong) that does the PII masking server-side: full details only when
  `status = 'active_customer'`, masked otherwise, self-contained
  authorization check inside the function body rather than relying on
  nested RLS evaluation.

Full migration SQL for this was drafted in the main session (not run here
yet) — regenerate it fresh in this project rather than copy-pasting, since
table/column choices may evolve once the cross-project webhook design (next
section) is finalized.

## Still to design/build (not started)

- **Cross-project webhook**: main site's `/api/inquiries` (in
  `D:\EcoStorage`) needs to read the `?ref=` cookie and, if present, POST
  the lead to a new endpoint on this affiliate system's API so it can
  create an `affiliate_signups` row. Needs an auth scheme between the two
  systems (e.g. a shared secret header) since they're on separate
  Supabase/Vercel projects with no built-in trust relationship.
- Next.js app scaffold for this project (not yet run — `create-next-app`
  or hand-rolled to match the main site's conventions: App Router,
  TypeScript, Tailwind, `@/` path aliases).
- `/affiliate/apply`, `/affiliate/login`, `/affiliate` (dashboard),
  `/admin/*` (master console) routes.
- Email notifications via Resend (admin + affiliate on signup) — reuse the
  same approach as the main site's inquiry notifications once the webhook
  lands a signup here.
- Vercel project creation + deployment once the local app exists.

## Secrets handling (carries over from the main project — same rule applies
here)

Never paste real passwords/API keys into chat expecting them to be written
into a file. Real secrets go directly into `.env.local` (gitignored) or the
relevant dashboard's UI, entered by the user, not relayed through
conversation.
