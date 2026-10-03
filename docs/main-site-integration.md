# Main site (D:\EcoStorage) ↔ affiliate system integration — design

Status: design only, nothing in `D:\EcoStorage` changed yet.

## What exists today (main site)

| Entry point | How it submits | Notes |
|---|---|---|
| `ContactForm.tsx` (contact, personal, corporate, partner pages) | `POST /api/inquiries` (server route) | Honeypot, 20 req/min/IP rate limit in `src/proxy.ts`. No promo field. |
| `StorageCalculator.tsx` ("Lock In My Rate") | **Browser inserts straight into Supabase `inquiries`** via the anon client | Has a "Promo code (optional)" field, but **Apply never validates** — it just flips `promoApplied = true`, so any string is accepted and saved in `metadata.promoCode`. |

The calculator's direct browser insert has to change: the server can't read
the referral cookie, sign the webhook or validate the code on a write it
never sees.

## Target flow

```
visitor clicks yoursite/?ref=ABC123
  └─ src/proxy.ts sets first-party cookie  eco_ref=ABC123  (14 days, httpOnly, SameSite=Lax)

visitor submits ContactForm or Calculator (optional promo code field)
  └─ POST /api/inquiries            (both forms go through here)
       1. Turnstile + honeypot + rate limit   (existing + new)
       2. insert into main-site inquiries     (existing)
       3. resolve attribution:
            typed code (validated)  →  method = promo_code
            else eco_ref cookie     →  method = link
            else                    →  nothing sent (company revenue)
       4. POST https://<affiliates>.vercel.app/api/webhooks/lead
            headers: X-Eco-Timestamp, X-Eco-Signature = HMAC-SHA256(secret, ts + "." + rawBody)
            body:    { inquiry_id, code, method, name, email, phone, source, quote, submitted_at }
       5. mark inquiry.affiliate_sync = sent | failed  (failed ones retried by cron)

affiliate system /api/webhooks/lead
  1. reject if signature invalid or timestamp > 5 min old
  2. upsert on inquiry_id (duplicates are no-ops)
  3. code must exist and be active, else record as unattributed
  4. self-referral check (email/phone vs affiliate's own) → flagged, no commission
  5. existing-customer / already-attributed check → flagged
  6. insert affiliate_signups row, status = lead
```

## Changes needed in D:\EcoStorage

1. **`src/proxy.ts`** — widen the matcher to public pages (excluding static
   assets) and set `eco_ref` when `?ref=` is present. Overwrites any older
   cookie (last click wins for links; a typed code still beats it).
2. **`StorageCalculator.tsx`** — submit via `POST /api/inquiries` instead of
   the browser Supabase client. Then drop the anon `insert` RLS policy on
   `inquiries` so the table can only be written server-side.
3. **Promo code validation** — "Apply" calls a new main-site route
   `POST /api/promo/validate`, which calls the affiliate system
   server-to-server (signed, same scheme). Returns `{ valid, offer }` so the
   calculator can show "1 month free on a 4-month commitment". Rate-limited
   tightly to stop code guessing.
4. **`ContactForm.tsx`** — add the optional promo code field.
5. **Calculator commitment options** — add a **4-month** option, shown only
   when a valid affiliate code is applied (current options are monthly,
   8, 12, 18 months).
6. **`/api/inquiries`** — attribution + signed webhook + retry flag.
7. **Turnstile** on both forms (free Cloudflare bot check).
8. **Env vars (both Vercel projects):** `AFFILIATE_WEBHOOK_SECRET`; main
   site also gets `AFFILIATE_API_URL`.
9. **Privacy/cookie notice** — mention the referral cookie.

## Keeping status in sync (lead → customer → qualified)

The affiliate system needs to know when a lead becomes a customer, its
storage start date, payments (late/default) and move-out. Until the billing
system exists, an admin updates these in the affiliate admin console. The
planned one-click billing/invoicing system will later write payment events
directly, which drives the 60-day Good Standing check automatically.

## Open points

- Does the 4-month referral offer also apply to month-to-month calculator
  quotes, or only as its own plan?
- Partner page inquiries (`type = 'partner'`) are **not** storage leads and
  never go through attribution. The user is reworking `/partner` to capture
  both individual affiliates and B2B partners; affiliate applicants should
  be routed to the affiliate system's application endpoint
  (`affiliate_applications`), B2B partners stay in main-site `inquiries`.
