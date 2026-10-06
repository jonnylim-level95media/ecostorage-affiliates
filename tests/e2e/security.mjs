// End-to-end security tests against the live Supabase project.
// Usage: npm run build && npx next start -p 3123, then `node tests/e2e/security.mjs`
// from the repo root. Creates temporary users/rows and deletes them at the end.
import fs from "node:fs";
import crypto from "node:crypto";
import { createRequire } from "node:module";
const require = createRequire(process.cwd() + "/");
const { encodeReply } = require("next/dist/compiled/react-server-dom-webpack/client.node");

const env = {};
for (const l of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
const U = env.NEXT_PUBLIC_SUPABASE_URL, SK = env.SUPABASE_SECRET_KEY, PK = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const APP = "http://localhost:3123";
const REF = "fbprauhmowkfjqtbjuvv";
const svc = { apikey: SK, Authorization: "Bearer " + SK, "Content-Type": "application/json" };
const manifest = JSON.parse(fs.readFileSync(".next/server/server-reference-manifest.json", "utf8")).node;
const actionId = (name) => Object.entries(manifest).find(([, v]) => v.exportedName === name)[0];

let pass = 0, failn = 0;
const check = (name, ok, detail = "") => {
  if (ok) pass++;
  else failn++;
  console.log((ok ? "PASS" : "FAIL").padEnd(5), name.padEnd(64), ok ? "" : detail);
};

const tag = crypto.randomBytes(3).toString("hex");
const created = { users: [], appIds: [], terms: [] };

// ---------- helpers ----------
async function sb(path, opts = {}) {
  const r = await fetch(U + path, opts);
  const text = await r.text();
  let json; try { json = JSON.parse(text); } catch { json = text; }
  return { status: r.status, json };
}
async function createUser(email) {
  const password = "Tt1" + crypto.randomBytes(12).toString("base64url");
  const r = await sb("/auth/v1/admin/users", { method: "POST", headers: svc, body: JSON.stringify({ email, password, email_confirm: true }) });
  created.users.push(r.json.id);
  return r.json.id;
}
// Session without the captcha-protected password grant: admin magic link → verify.
async function sessionFor(email) {
  const g = await sb("/auth/v1/admin/generate_link", { method: "POST", headers: svc, body: JSON.stringify({ type: "magiclink", email }) });
  const v = await sb("/auth/v1/verify", { method: "POST", headers: { apikey: PK, "Content-Type": "application/json" }, body: JSON.stringify({ type: "magiclink", token_hash: g.json.hashed_token }) });
  return v.json;
}
function totp(secretB32) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = ""; for (const c of secretB32.replace(/=+$/, "")) bits += alphabet.indexOf(c).toString(2).padStart(5, "0");
  const key = Buffer.from(bits.match(/.{8}/g).map((b) => parseInt(b, 2)));
  const counter = Buffer.alloc(8); counter.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30000)));
  const h = crypto.createHmac("sha1", key).update(counter).digest();
  const o = h[19] & 15;
  return String(((h.readUInt32BE(o) & 0x7fffffff) % 1e6)).padStart(6, "0");
}
const authed = (s) => ({ apikey: PK, Authorization: "Bearer " + s.access_token, "Content-Type": "application/json" });
function cookieFor(session) {
  const v = "base64-" + Buffer.from(JSON.stringify(session)).toString("base64url");
  const name = `sb-${REF}-auth-token`, parts = [];
  for (let i = 0; i < v.length; i += 3180) parts.push(v.slice(i, i + 3180));
  return parts.length === 1 ? `${name}=${v}` : parts.map((p, i) => `${name}.${i}=${p}`).join("; ");
}
async function page(path, cookie) {
  const r = await fetch(APP + path, { headers: cookie ? { cookie } : {}, redirect: "manual" });
  return { status: r.status, loc: r.headers.get("location"), headers: r.headers, body: r.status === 200 ? await r.text() : "" };
}
async function action(name, pagePath, cookie, fields, { origin = APP, prev = null } = {}) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.append(k, v);
  const args = name === "acceptTerms" ? [fields.locale] : [prev, fd];
  const body = await encodeReply(args);
  const headers = { cookie, "Next-Action": actionId(name), Accept: "text/x-component", Origin: origin, Host: "localhost:3123" };
  if (typeof body === "string") headers["Content-Type"] = "text/plain;charset=UTF-8";
  const r = await fetch(APP + pagePath, { method: "POST", headers, body, redirect: "manual" });
  return { status: r.status, text: await r.text() };
}
const q = (table, query) => sb(`/rest/v1/${table}?${query}`, { headers: svc }).then((r) => r.json);

try {
  // ---------- Supabase Auth hardening ----------
  let r = await sb("/auth/v1/signup", { method: "POST", headers: { apikey: PK, "Content-Type": "application/json" }, body: JSON.stringify({ email: `x${tag}@level95media.com`, password: "Abcdefghij12" }) });
  check("public sign-up is blocked", r.status >= 400, JSON.stringify(r.json));
  r = await sb("/auth/v1/token?grant_type=password", { method: "POST", headers: { apikey: PK, "Content-Type": "application/json" }, body: JSON.stringify({ email: "jonnylim@level95media.com", password: "x" }) });
  check("password sign-in without bot check is blocked", r.json.error_code === "captcha_failed", JSON.stringify(r.json));
  r = await sb("/auth/v1/recover", { method: "POST", headers: { apikey: PK, "Content-Type": "application/json" }, body: JSON.stringify({ email: "jonnylim@level95media.com" }) });
  check("password reset without bot check is blocked", r.json.error_code === "captcha_failed", JSON.stringify(r.json));

  // ---------- Admin with 2FA ----------
  var adminEmail = `b3-admin-${tag}@test.level95media.com`;
  const adminId = await createUser(adminEmail);
  await sb(`/rest/v1/profiles?id=eq.${adminId}`, { method: "PATCH", headers: svc, body: JSON.stringify({ role: "admin" }) });
  let adminS = await sessionFor(adminEmail);
  let ck = cookieFor(adminS);
  r = await page("/admin", ck);
  check("admin without authenticator → sent to 2FA setup", r.status === 307 && r.loc?.endsWith("/mfa/setup"), `${r.status} ${r.loc}`);

  // aal1 admin can't read admin data through the API either (DB-enforced)
  const appIns = await sb("/rest/v1/affiliate_applications", { method: "POST", headers: { ...svc, Prefer: "return=representation" }, body: JSON.stringify({ full_name: "Test Applicant", email: `b3-aff-${tag}@test.level95media.com`, contact_consent: true, preferred_locale: "zh-Hans" }) });
  const appId = appIns.json[0].id; created.appIds.push(appId);
  r = await sb("/rest/v1/affiliate_applications?select=id", { headers: authed(adminS) });
  check("password-only admin session reads 0 applications via API", Array.isArray(r.json) && r.json.length === 0, JSON.stringify(r.json));

  const enroll = await sb("/auth/v1/factors", { method: "POST", headers: authed(adminS), body: JSON.stringify({ factor_type: "totp", friendly_name: "test" }) });
  const factorId = enroll.json.id, secret = enroll.json.totp.secret;
  const verifyFactor = async (s) => {
    const ch = await sb(`/auth/v1/factors/${factorId}/challenge`, { method: "POST", headers: authed(s), body: "{}" });
    return sb(`/auth/v1/factors/${factorId}/verify`, { method: "POST", headers: authed(s), body: JSON.stringify({ challenge_id: ch.json.id, code: totp(secret) }) });
  };
  const bad = await (async () => {
    const ch = await sb(`/auth/v1/factors/${factorId}/challenge`, { method: "POST", headers: authed(adminS), body: "{}" });
    return sb(`/auth/v1/factors/${factorId}/verify`, { method: "POST", headers: authed(adminS), body: JSON.stringify({ challenge_id: ch.json.id, code: "000000" }) });
  })();
  check("wrong 2FA code is rejected", bad.status >= 400, String(bad.status));
  const v1 = await verifyFactor(adminS);
  check("correct 2FA code enrolls the authenticator", v1.status === 200, JSON.stringify(v1.json).slice(0, 120));

  adminS = await sessionFor(adminEmail); // fresh password-level session, factor now enrolled
  r = await page("/admin", cookieFor(adminS));
  check("admin with authenticator but no code → sent to code entry", r.status === 307 && r.loc?.endsWith("/mfa/verify"), `${r.status} ${r.loc}`);
  const v2 = await verifyFactor(adminS);
  adminS = v2.json; ck = cookieFor(adminS);
  r = await page("/admin", ck);
  check("admin with 2FA reaches the console", r.status === 200, String(r.status));
  r = await sb("/rest/v1/affiliate_applications?select=id&id=eq." + appId, { headers: authed(adminS) });
  check("2FA admin session can read applications via API", r.json.length === 1, JSON.stringify(r.json));

  // ---------- Security headers ----------
  r = await page("/login");
  const csp = r.headers.get("content-security-policy") ?? "";
  check("CSP present with per-request nonce", /script-src 'self' 'nonce-[A-Za-z0-9+/=]+' 'strict-dynamic'/.test(csp), csp);
  check("CSP blocks framing and plugins", csp.includes("frame-ancestors 'none'") && csp.includes("object-src 'none'"), csp);
  const nonce1 = csp.match(/nonce-([^']+)/)?.[1];
  const nonce2 = ((await page("/login")).headers.get("content-security-policy") ?? "").match(/nonce-([^']+)/)?.[1];
  check("nonce differs on every request", nonce1 && nonce2 && nonce1 !== nonce2);
  check("page scripts carry the nonce", r.body.includes(`nonce="${nonce1}"`));
  for (const [h, want] of [["strict-transport-security", "max-age="], ["x-content-type-options", "nosniff"], ["x-frame-options", "DENY"], ["referrer-policy", "strict-origin"], ["permissions-policy", "camera=()"], ["cross-origin-opener-policy", "same-origin"]]) {
    check(`header ${h}`, (r.headers.get(h) ?? "").includes(want), r.headers.get(h) ?? "missing");
  }
  check("X-Powered-By hidden", !r.headers.get("x-powered-by"));
  r = await page("/admin", ck);
  check("authenticated pages are not cacheable", (r.headers.get("cache-control") ?? "").includes("no-store"), r.headers.get("cache-control"));

  // ---------- CSRF ----------
  r = await action("rejectApplication", "/admin/applications", ck, { id: appId, notes: "csrf" }, { origin: "https://evil.example" });
  const stillPending = (await q("affiliate_applications", `id=eq.${appId}&select=status`))[0].status === "pending";
  check("server action from another origin is rejected", r.status >= 400 && stillPending, `${r.status} ${r.text.slice(0, 80)}`);
  r = await fetch(APP + "/auth/signout", { method: "POST", headers: { cookie: ck, Origin: "https://evil.example" }, redirect: "manual" });
  check("cross-site sign-out is rejected", r.status === 403, String(r.status));

  // ---------- Approve (B3) ----------
  r = await action("approveApplication", "/admin/applications", ck, { id: "not-a-uuid" });
  check("approve with malformed id is refused", r.text.includes("Invalid request"), r.text.slice(-200));
  r = await action("approveApplication", "/admin/applications", ck, { id: appId });
  const approvedMsg = /Approved\./.test(r.text);
  check("one-click approve succeeds", approvedMsg, r.text.slice(-300));
  check("approve reports onboarding not sent (email not configured)", r.text.includes("Onboarding pack NOT sent"), r.text.slice(-300));
  const usedFallback = r.text.includes("/auth/v1/verify");
  console.log("      (invite delivery:", usedFallback ? "manual one-time link shown to admin)" : "emailed by Supabase)");
  const aff = (await q("affiliate_profiles", `application_id=eq.${appId}&select=id,user_id,status,preferred_locale,affiliate_codes(code,is_active)`))[0];
  if (aff) created.users.push(aff.user_id);
  check("affiliate created as invited, Chinese preference kept", aff?.status === "invited" && aff?.preferred_locale === "zh-Hans", JSON.stringify(aff));
  check("code generated but not live yet", aff?.affiliate_codes.length === 1 && !aff.affiliate_codes[0].is_active, JSON.stringify(aff?.affiliate_codes));
  check("application marked approved", (await q("affiliate_applications", `id=eq.${appId}&select=status`))[0].status === "approved");
  check("approval written to audit log", (await q("audit_log", `entity_id=eq.${aff?.id}&action=eq.affiliate.invited&select=id`)).length === 1);
  r = await action("approveApplication", "/admin/applications", ck, { id: appId });
  check("approving the same application twice is refused", r.text.includes("no longer pending"), r.text.slice(-200));

  // ---------- Affiliate side ----------
  const affEmail = `b3-aff-${tag}@test.level95media.com`;
  const affS = await sessionFor(affEmail);
  const affCk = cookieFor(affS);
  r = await page("/admin", affCk);
  check("affiliate can't open the admin console", r.status === 307 && r.loc?.endsWith("/affiliate"), `${r.status} ${r.loc}`);
  r = await page("/mfa/setup", affCk);
  check("affiliate can't open admin 2FA pages", r.status === 307 && !r.loc?.includes("/mfa"), `${r.status} ${r.loc}`);
  r = await page("/affiliate", affCk);
  check("invited affiliate is sent to the welcome flow", r.status === 307 && r.loc?.endsWith("/affiliate/welcome"), `${r.status} ${r.loc}`);
  r = await action("approveApplication", "/admin/applications", affCk, { id: appId });
  check("affiliate calling an admin action is refused", !/Approved\./.test(r.text) && (r.status === 303 || r.status === 307 || r.text.includes("NEXT_REDIRECT") || r.status >= 400), `${r.status} ${r.text.slice(0, 120)}`);

  // API-level escapes with the affiliate's own token
  r = await sb(`/rest/v1/profiles?id=eq.${aff.user_id}`, { method: "PATCH", headers: { ...authed(affS), Prefer: "return=representation" }, body: JSON.stringify({ role: "admin" }) });
  const roleNow = (await q("profiles", `id=eq.${aff.user_id}&select=role`))[0].role;
  check("affiliate can't promote themselves to admin", roleNow === "affiliate", `${r.status} role=${roleNow}`);
  r = await sb("/rest/v1/affiliate_signups?select=full_name,email", { headers: authed(affS) });
  check("affiliate can't read raw signups (full PII)", Array.isArray(r.json) && r.json.length === 0, JSON.stringify(r.json).slice(0, 100));
  r = await sb("/rest/v1/affiliate_applications?select=email", { headers: authed(affS) });
  check("affiliate can't read applications", Array.isArray(r.json) && r.json.length === 0);
  r = await sb("/rest/v1/affiliate_profiles?select=email", { headers: authed(affS) });
  check("affiliate sees only their own profile", r.json.length === 1 && r.json[0].email === affEmail, JSON.stringify(r.json));
  for (const [fn, args] of [["qualify_signup", { p_signup_id: crypto.randomUUID() }], ["ingest_lead", {}], ["rotate_affiliate_code", { p_affiliate_id: aff.id }], ["set_affiliate_suspended", { p_affiliate_id: aff.id, p_suspended: false }], ["check_rate_limit", { p_key: "x", p_limit: 1, p_window_seconds: 1 }], ["publish_terms_version", { p_version: "x", p_locale: "en", p_body_md: "x" }], ["create_affiliate_from_application", {}], ["mask_name", { full_name: "x" }]]) {
    r = await sb(`/rest/v1/rpc/${fn}`, { method: "POST", headers: authed(affS), body: JSON.stringify(args) });
    check(`affiliate can't call ${fn}()`, r.status === 401 || r.status === 403 || r.status === 404 || r.json?.code === "42501", `${r.status} ${JSON.stringify(r.json).slice(0, 80)}`);
  }
  r = await sb("/rest/v1/affiliate_codes", { method: "POST", headers: authed(affS), body: JSON.stringify({ affiliate_id: aff.id, code: "ABCDEFGH", is_active: true }) });
  check("affiliate can't insert their own code", r.status >= 400, String(r.status));
  r = await sb(`/rest/v1/affiliate_codes?affiliate_id=eq.${aff.id}`, { method: "PATCH", headers: { ...authed(affS), Prefer: "return=representation" }, body: JSON.stringify({ is_active: true }) });
  const liveNow = (await q("affiliate_codes", `affiliate_id=eq.${aff.id}&select=is_active`))[0].is_active;
  check("affiliate can't switch on their code without accepting terms", liveNow === false, `${r.status}`);
  r = await sb("/rest/v1/rpc/accept_current_terms", { method: "POST", headers: authed(affS), body: JSON.stringify({ p_locale: "en" }) });
  check("accepting terms fails when none are published", r.status >= 400, String(r.status));

  // anonymous API access
  for (const t of ["affiliate_signups", "affiliate_profiles", "affiliate_codes", "profiles", "rate_limits", "audit_log"]) {
    r = await sb(`/rest/v1/${t}?select=*`, { headers: { apikey: PK } });
    check(`anonymous can't read ${t}`, r.status === 401 || (Array.isArray(r.json) && r.json.length === 0), `${r.status}`);
  }

  // ---------- Terms acceptance activates the code ----------
  const termsBefore = await q("terms_versions", "is_current=eq.true&select=id");
  if (termsBefore.length === 0) {
    const tv = `test-${tag}`;
    await sb("/rest/v1/rpc/publish_terms_version", { method: "POST", headers: svc, body: JSON.stringify({ p_version: tv, p_locale: "en", p_body_md: "Test terms ".repeat(10) }) });
    created.terms.push(tv);
    r = await action("acceptTerms", "/affiliate/welcome", affCk, { locale: "zh-Hans" });
    const after = (await q("affiliate_profiles", `id=eq.${aff.id}&select=status,affiliate_codes(is_active),terms_acceptances(locale_shown,governing_terms_version_id)`))[0];
    check("accepting terms activates affiliate and code", after.status === "active" && after.affiliate_codes[0].is_active, JSON.stringify(after));
    check("zh preference with no zh terms → English shown and recorded", after.terms_acceptances[0]?.locale_shown === "en", JSON.stringify(after.terms_acceptances));
  } else {
    console.log("SKIP  terms acceptance (real terms already published; not touching them)");
  }

  // ---------- Admin affiliate actions ----------
  r = await action("setSuspended", "/admin/affiliates", ck, { id: aff.id, suspend: "true" });
  let st = (await q("affiliate_profiles", `id=eq.${aff.id}&select=status,affiliate_codes(is_active)`))[0];
  check("suspend turns off codes immediately", st.status === "suspended" && st.affiliate_codes.every((c) => !c.is_active), JSON.stringify(st));
  r = await sb("/rest/v1/rpc/accept_current_terms", { method: "POST", headers: authed(affS), body: JSON.stringify({ p_locale: "en" }) });
  st = (await q("affiliate_profiles", `id=eq.${aff.id}&select=status,affiliate_codes(is_active)`))[0];
  check("suspended affiliate can't reactivate via terms", st.status === "suspended" && st.affiliate_codes.every((c) => !c.is_active), JSON.stringify(st));
  r = await action("setSuspended", "/admin/affiliates", ck, { id: aff.id, suspend: "false" });
  st = (await q("affiliate_profiles", `id=eq.${aff.id}&select=status`))[0];
  check("reactivate restores status", st.status === (created.terms.length ? "active" : "invited"), JSON.stringify(st));
  const oldCode = aff.affiliate_codes[0].code;
  r = await action("rotateCode", "/admin/affiliates", ck, { id: aff.id });
  const codes = await q("affiliate_codes", `affiliate_id=eq.${aff.id}&select=code,is_active,deactivated_at`);
  const old = codes.find((c) => c.code === oldCode), fresh = codes.find((c) => c.code !== oldCode);
  check("replace code retires the old one and issues a new one", old && !old.is_active && old.deactivated_at && fresh && /^[A-HJ-NP-Z2-9]{8}$/.test(fresh.code), JSON.stringify(codes));
  r = await action("resendOnboarding", "/admin/affiliates", ck, { id: aff.id });
  check("resend onboarding reports email not configured", r.text.includes("not sent"), r.text.slice(-200));

  // ---------- Shared DB rate limiter on applications ----------
  const SECRET = env.AFFILIATE_WEBHOOK_SECRET;
  const limitEmail = `b3-limit-${tag}@test.level95media.com`;
  const statuses = [];
  for (let i = 0; i < 4; i++) {
    const raw = JSON.stringify({ full_name: "Limit Test", email: limitEmail, contact_consent: true, client_ip: `198.51.100.${10 + i}`, turnstile_token: "x" });
    const ts = String(Math.floor(Date.now() / 1000));
    const sig = "v1=" + crypto.createHmac("sha256", SECRET).update(`${ts}.${raw}`).digest("hex");
    const rr = await fetch(APP + "/api/applications", { method: "POST", headers: { "content-type": "application/json", "x-eco-timestamp": ts, "x-eco-signature": sig }, body: raw });
    statuses.push(rr.status);
  }
  check("4th application for one email in a day is limited (shared limiter)", statuses[3] === 429 && statuses.slice(0, 3).every((s) => s !== 429), statuses.join(","));

  // ---------- Auth pages ----------
  for (const p of ["/login", "/forgot-password", "/auth/callback"]) {
    r = await page(p);
    check(`${p} loads`, r.status === 200, String(r.status));
  }
  r = await page("/auth/confirm?token_hash=../../evil&type=invite");
  check("confirm page rejects malformed token", r.status === 307 && r.loc?.includes("error=link"), `${r.status} ${r.loc}`);
  // Next echoes the URL into the page data, so check the destination prop itself.
  r = await page("/mfa/verify?next=https://evil.example", cookieFor(await sessionFor(adminEmail)));
  check("2FA page ignores external redirect targets", (r.body.match(/destination[^/]{0,12}(\/[a-z-/]*)/) || [])[1] === "/admin", r.body.match(/destination.{0,40}/)?.[0]);
  r = await page("/auth/set-password");
  check("set-password requires a session", r.status === 307 && r.loc?.endsWith("/login"), `${r.status} ${r.loc}`);
} catch (e) {
  failn++;
  console.log("ERROR", e);
} finally {
  // ---------- cleanup ----------
  const del = (t, filter) => sb(`/rest/v1/${t}?${filter}`, { method: "DELETE", headers: svc });
  const affs = await q("affiliate_profiles", `user_id=in.(${created.users.join(",")})&select=id`);
  const affIds = affs.map((a) => a.id).join(",");
  if (affIds) {
    for (const t of ["terms_acceptances", "onboarding_sends", "affiliate_signups", "affiliate_codes"]) await del(t, `affiliate_id=in.(${affIds})`);
    await del("audit_log", `entity_id=in.(${affIds})`);
    await del("affiliate_profiles", `id=in.(${affIds})`);
  }
  await del("audit_log", `actor_id=in.(${created.users.join(",")})`);
  await del("affiliate_applications", `email=like.b3-*`);
  for (const v of created.terms) await del("terms_versions", `version=eq.${v}`);
  await del("rate_limits", `key=like.*b3-*`);
  for (const id of created.users) await sb(`/auth/v1/admin/users/${id}`, { method: "DELETE", headers: svc });
  const left = await sb("/auth/v1/admin/users?per_page=100", { headers: svc });
  console.log(`\n${pass} passed, ${failn} failed. Auth users remaining: ${left.json.users.map((u) => u.email).join(", ")}`);
}
