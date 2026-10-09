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
3. **Attribution mechanism** *(revised 2026-10-03, was link-only)*:
   `?ref=CODE` link + cookie **or** the affiliate's promo code typed into a
   new field on the main site's enquiry form. A typed code beats a link if
   they point at different affiliates. Record which method attributed each
   signup (`link` / `promo_code`) to spot leaked codes.
4. **Attribution window** *(revised, was 90 days)*: **14 days** for links.
   Anything outside the window without the code typed is unattributed —
   intentionally kept as company revenue (stated in affiliate T&Cs).
5. **PII exposure to affiliates** *(revised)*: **always masked, never
   unlocked**. Per name part: 1 letter shown as-is; 2–4 letters → first
   letter + `*`; 5+ letters → first 3 + `*`. Mobile → last 4 digits.
   Email → first 5 chars of local part (even if that shows all of a short
   local part — acceptable since the domain is fully censored), domain
   fully censored. Master admin sees everything unmasked.
   Late payment = more than 3 days after due date.
   **Full details ARE stored** in the affiliate DB (accounting: matching
   payments to signups, future billing/invoicing system). Affiliates only
   ever read through the masking function, never the raw columns.
6. **Commission** *(approved 2026-10-03)*: % of the customer's first full
   month's net rent — **1–10 = 10%, 11–30 = 20%, 31+ = 35%**, tier by
   qualified referrals in a rolling 12 months. Qualifies after **60 days in
   good standing** (no late payment, default, cancellation), or for storage
   under 60 days, on **successful outbound** from the warehouse. **Paid 30
   days after qualifying.** Payouts manual for now.
6b. **Future**: lightweight one-click billing/invoicing system tying the
    main site, affiliate system and payments together (user wants this
    built with Claude later) — design tables with that in mind.
6c. **Security**: user wants the anti-ghost-signup layers back-checked and
    mutation-tested with ~100 cases before go-live.
6e. **Rates are private** *(2026-10-03)*: no rates/tiers/payout timing on
    the public site. Public `/partner` page is benefit-led only (main-site
    task: `D:\EcoStorage\HANDOFF-partner-page.md`). Affiliate terms are
    not public; they're accepted inside the portal.
6f. **Automated onboarding** *(2026-10-03)*: admin approves an application
    with **one click** → system creates the auth user via
    `inviteUserByEmail` (set-password email), creates `affiliate_profiles`,
    generates their code, and emails a **basic onboarding package** (welcome,
    rates/tiers, payout timing, 60-day rule, their link + code, share
    templates, do's & don'ts, terms link). On first login the affiliate must
    accept the current terms version (click-wrap) **before their code is
    activated**. Store acceptances in a `terms_acceptances` table
    (affiliate, terms_version, accepted_at, ip/user agent). Onboarding
    content is versioned/editable by admin, not hardcoded. Email via Resend
    (same provider as main site; separate API key/domain TBC).
6h. **Customer late fees** *(2026-10-06)*: cumulative from due date:
    30d S$50; 45d +S$100; 60d +1 month's fee; 75d Notice of Default.
    Disposal/claims right from 45d (after written notice). "Late" for the
    affiliate good-standing test is still >3 days. Legal entity/UEN TBD.
    Resend parked until a new domain is bought; A7 (new Supabase keys)
    skipped as non-critical.
 (zh-Hans)** *(2026-10-05)*: affiliate-facing UI, emails,
    onboarding pack and share templates in English + Simplified Chinese;
    admin console English only. Language picker (`English | 中文`, no flags)
    on login and dashboard; first visit guesses from Accept-Language; saved
    to `affiliate_profiles.preferred_locale` once signed in. First login runs
    a 3-step welcome (language → agreement → code reveal + share templates).
    All UI text lives in `src/lib/i18n/dictionaries.ts` (Chinese UI text reviewed
    2026-10-06). Terms are per-locale in `terms_versions`;
    **English governs**: a translation is only shown if its version matches
    the current English version (else English is shown), Chinese acceptance
    needs an extra "English prevails" checkbox, and each acceptance records
    shown locale + governing English version. No professional translator available:
    Chinese terms are reference-only, "only English is binding" disclaimer.
6d. **T&Cs**: drafts in `docs/affiliate-terms-draft.md` and
    `docs/customer-terms-draft.md` (adapted from EZ Storage's `tandc.txt`;
    adds moving-partner outsourcing + indemnity; warehousing 100% in-house).
    Integration design: `docs/main-site-integration.md`.
6a. **Referred customer offer** (placeholder): 1 month free on a 4-month
    commitment (current public promo: 1 month free on 8-month lock-in).
    Admin fee + security deposit are standard charges for every customer,
    never discounted by referral offers, and excluded from commission.
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

## Infrastructure (resolved 2026-10-03)

Supabase free-project cap worked around with a second account the user owns:
- Supabase project **EcoStorage Affiliates** (`fbprauhmowkfjqtbjuvv`,
  ap-southeast-1) in **jonnylim-level95media's Org**, linked locally via the
  Supabase CLI (logged in as jonnylim). The claude.ai Supabase MCP connector
  stays on hello@ (main `ecostorage` project) — use the CLI for this one.
- GitHub: `jonnylim-level95media/ecostorage-affiliates` (private). Repo-local
  git identity is jonnylim; global identity and `D:\EcoStorage` stay hello@.
  No global `gh` credential helper (deliberate, keeps accounts separate).
- Pushes / history rewrites are run by the user (auto mode blocks them).
- No Docker locally, so migrations can't be tested on a local stack — they
  go straight to the (empty) remote project.

## Planned database schema (designed, being revised for the decisions above
— first migration drafted, not yet applied)

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

## Business decisions for Novac (2026-10-09)

- Admin fee: fixed S$30, described as an administration fee (account set-up,
  inventory/photo records, warehouse security). Not described as insurance;
  no insurance statement in the customer terms.
- No GST (not registered). Build GST as a switch, off.
- Anniversary billing from the customer's on-site signature date (service
  report signature = services rendered = billing starts). No part-month
  charges. Upgrade: immediate, daily-prorated difference for rest of cycle,
  billing date unchanged. Downgrade: next cycle, no refund.
- Upfront = 1st month's rent IN ADVANCE + security deposit + S$30 admin fee.
  Deposit = 1 month's rent (<100 sq ft) or 0.5 month's rent (>=100 sq ft),
  on rent before valet. So totals are 2 months + S$30 (<100) and
  1.5 months + S$30 (>=100), but only the deposit part is refundable; the
  first month is rent for cycle 1, NOT deposit. Novac must invoice these as
  separate lines (rent / deposit / admin fee) and only the deposit line goes
  to the deposit ledger.
  Existing customers upgrading: no extra deposit unless the increase is
  substantial (admin discretion). Deposit never partly refunded on
  downgrade. Novac keeps a per-customer deposit ledger (paid, held,
  refunded; may be 0).
- Affiliate commission: tier % of the first month's rent actually paid,
  nothing else, unaffected by later changes. Stays <60 days (actual days
  stored): fixed S$5 per 20 sq ft or tier %, whichever is lower; short stays
  don't count toward tiers. Reduction by half or more / end before payout →
  may recalculate. Not-closed cases (unpaid/disputed/negotiating) hold ALL
  linked payments (affiliate, mover, EcoStorage revenue); payments received
  are still recorded. Terms updated in docs/affiliate-terms-draft.md
  (6.2, 6.2A, 6.2B, 6.4A). DB commission logic NOT yet changed (do with
  Billing; the rent base will come from paid invoices).
- Movers: 90% of everything EcoStorage bills for work they perform, rounded
  UP per job to the nearest S$5. Never show the customer price or the
  percentage to movers. Paid on a monthly tally; unpaid customer amounts
  roll over. Job lines editable until the job is closed. Warehouse
  receiving labour is 100% EcoStorage (own staff).
- Bookkeeping in Novac (no Xero): invoices, payments, deposits, refunds,
  payouts, general expenses with multi-image receipts (master admin),
  bank statement CSV import with suggested matching, monthly reports,
  accountant export. Not full double-entry/statutory accounts.
- Job orders get a customer quote-photo upload; Flow broadcast links to them
  (view-only, per-job, expiring).
- Data: no purge; state a retention reason (claims) in the privacy policy.
- Infra goal: start Novac on free tiers only; migrate accounts to an
  @ecostorage.sg identity.
- (2026-10-09) Extras priced from an EcoStorage price list; job lines are
  invoice-style (description + amount editable per job, e.g. TV size).
  Mover sees lines + their fee, never customer amounts.
- Damage claims: EcoStorage negotiates for all parties; default split of
  the cost 20% EcoStorage / 80% partner (of the partner's 90% share),
  editable per case.
- Partner tally around the last Thu/Fri of the month (no fixed rule; make
  it a setting). Non-solicitation clause (light). Partners may
  subcontract, but the partner entity that accepts the Flow job is legally
  responsible; accepting a broadcast = agreeing to that job's terms + fee.
- "Substantial upgrade" deposit = manual call; Novac tracks upgrades
  (size change, deposit taken or not, outcome) to derive rules later.
- Bank: MariBank FlexiBiz (not opened yet) → CSV statement import.
- Email: Resend for app emails from a subdomain of ecostorage.sg (also as
  Supabase Auth SMTP); Zoho stays for human inboxes (hello@, jonnylim@).
- Hosting stays on Vercel (Hobby while building with zero customers; Pro
  when commercial). Main site: keep its own repo; optionally transfer to
  the @ecostorage.sg GitHub org later (domain unchanged, no SEO impact).
- Maps: docs/novac/novac-functional-map.(svg|png) and
  docs/novac/novac-technical-map.(svg|png).

## Build progress

- **B1 admin console: done (2026-10-06).** /admin overview, applications
  (reject; approve arrives in B3), signups list + detail (edit customer
  record, qualify, forfeit), payouts (mark paid with reference), terms
  publishing per locale, onboarding template editor (starter EN/ZH packs
  prefilled). All writes are server actions → `adminContext()` (re-checks
  admin, service-role client, audit_log entry). Atomic publish via
  `publish_terms_version` / `publish_onboarding_template`. Rent is locked
  once commission leaves `pending`.
- **B2 application intake: done (2026-10-06).** `POST /api/applications`,
  HMAC-signed (`src/lib/signing.ts`, spec in docs/main-site-integration.md),
  Turnstile verified here (main site forwards token unverified), per-applicant
  IP limit 5/hr, one pending application per email (DB unique index), admin
  email via `src/lib/email.ts` (skipped until Resend is configured). Signed
  server-to-server routes get a 300/min proxy ceiling instead of 20/min since
  they all come from the main site's IP. Live-tested 22 cases incl. forged,
  stale, future, tampered, oversize, dedupe, limits, Turnstile pass/fail.
- Note: migration `20261006035951_application_dedupe.sql` is intentionally
  empty (created by mistake, already applied); the index is in `..040500`.
- **B3 approval/onboarding + security hardening: done (2026-10-06).**
  - One-click approve (`/admin/applications`): invite → affiliate + inactive
    code → onboarding email (skipped until Resend) → audit. Rolls back the
    auth user if profile creation fails. Supabase default email only reaches
    project team members, so when it can't deliver, the admin is shown a
    one-time invite link to pass on (`generateLink`). Same fallback for
    "Send set-password link". `/admin/affiliates`: resend onboarding,
    set-password link, replace (rotate) code, suspend/reactivate.
  - Auth (pushed via `supabase config push`): public sign-up OFF, Turnstile
    captcha on sign-in/reset enforced by Supabase, 12-char passwords with
    upper/lower/digit, secure password change, email confirmations on,
    invite/reset links 24h. Admin **2FA (TOTP) required**: `requireAdmin()`
    redirects to `/mfa/setup` or `/mfa/verify`, and `is_admin()` requires
    `aal = aal2`, so the DB refuses admin reads from password-only sessions.
    Lost authenticator: delete the user's row in `auth.mfa_factors` via SQL.
  - Pages: `/forgot-password`, `/auth/callback` (handles Supabase default
    email links: ?code or #tokens, strips tokens from URL), `/auth/set-password`,
    `/auth/confirm` (scanner-safe POST flow for the custom templates).
  - Custom bilingual templates in `supabase/templates/` are commented out in
    config.toml: free plan only allows template edits with custom SMTP.
    **When Resend is set up: configure it as SMTP in Supabase, then
    uncomment the template blocks and `config push`.** (Push needs
    `TURNSTILE_SECRET_KEY` exported in the shell, since config.toml reads it.)
  - Headers: per-request nonce CSP (`strict-dynamic`), HSTS, nosniff,
    X-Frame-Options DENY, Referrer-Policy, Permissions-Policy, COOP,
    noindex, `no-store` on authenticated/API routes, no X-Powered-By.
    Server actions get Next's built-in Origin check; sign-out checks Origin.
  - Shared Postgres rate limiter `check_rate_limit()` (`src/lib/rate-limit-db.ts`,
    fails closed): applications 5/hr per applicant IP, 3/day per email.
  - Upgraded Next 16.3.5 → 16.3.8 (critical RCE advisory GHSA-vcvr-r3jv-pc5j
    in next/og). **The main site is still on 16.3.5 and uses next/og.**
  - `tests/e2e/security.mjs`: 71 live checks, all passing; basis for B7.
- **B4 lead endpoint + promo validation: done (2026-10-07).**
  `POST /api/webhooks/lead` and `POST /api/promo/validate`, both signed
  (contracts in docs/main-site-integration.md). `ingest_lead()` v2 (migration
  `20261007020000`) takes both signals (typed code + ref cookie) and decides
  in the DB under a per-person advisory lock: valid typed code > link within
  14 days > unattributed; existing customer / self-referral / already
  referred → recorded, ineligible. Idempotent on main-site inquiry id.
  Affiliate gets a masked "new referral" email (en/zh) and admin a note,
  both skipped until Resend. Promo check: 10 per 10 min per visitor IP,
  never reveals the affiliate. Customer offer constant in `src/lib/offer.ts`.
  Only a rolled-back DB sanity run so far; full endpoint tests deferred to
  B7 at the user's request.
- **B5 main-site connection: done locally (2026-10-07), NOT pushed.**
  D:\EcoStorage commits `6bee9ee` (Next 16.3.8 + sharp/source-map-js fixes)
  and `d8be0e3` (integration). Main site auto-deploys on push, so it stays
  unpushed until the affiliate app is deployed (B6). What changed there:
  ?ref= → 14-day httpOnly `eco_ref` cookie (`CODE.unixtime`, proxy only runs
  when ?ref present; treated as a disclosed referral cookie, set without
  consent, no personal data); calculator submits via `/api/inquiries` with
  the quote recomputed server-side; `/api/promo` proxies code checks;
  referred enquiries relayed signed via `after()`, state in
  `inquiries.metadata.affiliate`, daily Vercel cron `/api/cron/affiliate-relay`
  (CRON_SECRET) retries for 7 days; `/partner` affiliate form →
  `/api/affiliate-applications` → affiliate system (falls back to a partner
  inquiry if unreachable); Turnstile on all forms, loaded on first focus,
  skipped if keys unset; CSP allows challenges.cloudflare.com; cookie +
  privacy pages updated. Inquiries now written with the service role.
  `is_existing_customer` is always false for now (no customer records on
  the main site; wire to billing in B8).
  **Main-site migration `05_inquiries_server_only_insert.sql` must be
  applied AFTER the new main-site code is live** (old live calculator
  inserts from the browser).
- Next: B6 deploy → B3 approval/onboarding → B4 lead endpoint →
  B5 main site → B6 deploy → B7 security tests.

## Still to design/build (not started)

- **Cross-project webhook**: main site's `/api/inquiries` (in
  `D:\EcoStorage`) needs to read the `?ref=` cookie and, if present, POST
  the lead to a new endpoint on this affiliate system's API so it can
  create an `affiliate_signups` row. Auth (decided): HMAC-SHA256 signature
  over `timestamp.rawBody` using a shared secret held as an env var on both
  Vercel projects; reject if older than 5 min; idempotent on the main
  site's inquiry ID. Plus Turnstile on the enquiry form, self-referral and
  duplicate-customer checks, and the 60-day hold as anti-ghost-signup
  layers.
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
