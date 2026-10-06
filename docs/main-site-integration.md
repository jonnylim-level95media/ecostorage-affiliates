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

## Signing spec (implemented in `src/lib/signing.ts`)

Every server-to-server call to this app carries:

```
X-Eco-Timestamp: <unix seconds>
X-Eco-Signature: v1=<hex HMAC-SHA256(AFFILIATE_WEBHOOK_SECRET, `${timestamp}.${rawBody}`)>
Content-Type: application/json
```

- Sign the **exact bytes** you send (serialize the JSON once, sign that
  string, send that string).
- Requests more than 5 minutes off the server clock are rejected (401).
- Rotation: set `AFFILIATE_WEBHOOK_SECRET_PREVIOUS` on this app to the old
  secret, update the main site, then remove it.

Reference signer for the main site (Node):

```ts
import { createHmac } from "node:crypto";
export function signRequest(rawBody: string, secret: string) {
  const ts = String(Math.floor(Date.now() / 1000));
  const sig = createHmac("sha256", secret).update(`${ts}.${rawBody}`).digest("hex");
  return { "x-eco-timestamp": ts, "x-eco-signature": `v1=${sig}` };
}
```

## `POST {AFFILIATE_API_URL}/api/applications` (built in B2)

Body (JSON, max 10 KB):

| Field | Type | Notes |
|---|---|---|
| `full_name` | string ≤200 | required |
| `email` | string | required; one pending application per email |
| `phone` | string | optional, `+`, digits, spaces, `()-` |
| `promotion_plan` | string ≤2000 | optional |
| `contact_consent` | `true` | required (the form checkbox) |
| `preferred_locale` | `"en"` \| `"zh-Hans"` | defaults to `en`; use the site language the applicant used |
| `turnstile_token` | string | the form's Turnstile token, **forwarded unverified**. Tokens are single-use, so the main site must not verify it itself |
| `client_ip` | string | applicant's IP (last `x-forwarded-for` hop); used for Turnstile and a 5/hour per-applicant limit |
| `main_site_inquiry_id` | uuid | optional, if the main site also stores the submission |

Responses: `201 {id}` · `400 {error}` invalid input (message is safe to
show) · `401` bad signature (config problem, show a generic error) · `403`
bot check failed · `409` already pending for this email (show "we already
have your application") · `413` too large · `429` too many attempts.

## `POST {AFFILIATE_API_URL}/api/webhooks/lead` (built in B4)

Send after saving the enquiry, **only if** it has a typed promo code or an
`eco_ref` cookie. Signed as above. Body (JSON, max 20 KB):

| Field | Type | Notes |
|---|---|---|
| `main_site_inquiry_id` | uuid | required; idempotency key, so retries are safe |
| `source` | `"contact_form"` \| `"calculator"` | required |
| `full_name`, `email` | string | required |
| `phone` | string | optional |
| `submitted_at` | ISO timestamp | required; within the last 7 days (retry window) |
| `promo_code` | string | what the visitor typed, if anything (case/spaces ignored) |
| `ref_code` | string | `eco_ref` cookie value, if present |
| `link_clicked_at` | ISO timestamp | when the cookie was set (store it in the cookie) |
| `is_existing_customer` | boolean | true if the email/phone already belongs to a customer on the main site |
| `quote` | object ≤8 KB | calculator quote details, optional |

The affiliate system decides attribution: a valid typed code wins, else a
link clicked within 14 days, else unattributed. Self-referrals, existing
customers and already-referred people are recorded but earn no commission.

Responses: `200 {signup_id, attributed, reason}` (log it; never show
`reason` to visitors) · `202 {recorded:false}` neither code was usable ·
`400` · `401` · `413` · `500`. On network errors or 5xx, keep the enquiry
flagged and retry later (any time within 7 days).

## `POST {AFFILIATE_API_URL}/api/promo/validate` (built in B4)

For the calculator's Apply button. Signed. Body: `{ code, client_ip }`.

Response: `{ valid: false }` or
`{ valid: true, code: "ABCD2345", offer: { commitment_months: 4, free_months: 1 } }`.
Use `offer` to show "1 month free on a 4-month plan" and to unlock the
4-month option. `429` after 10 checks per 10 minutes per visitor. The
response never identifies the affiliate.
