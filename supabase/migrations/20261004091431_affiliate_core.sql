-- Affiliate programme core: applications, affiliates, codes, commission tiers,
-- terms acceptance, onboarding, signups (full PII, affiliates read masked
-- only), and the admin audit log.
--
-- Write model: almost every write goes through the service role (Next.js API
-- routes) or a SECURITY DEFINER function below. Client-facing RLS is
-- read-only, so nothing an affiliate does in the browser can create signups,
-- change commission, or activate codes outside the defined flows.

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

create type public.application_status as enum ('pending', 'approved', 'rejected');
create type public.affiliate_status as enum ('invited', 'active', 'suspended', 'terminated');
create type public.attribution_method as enum ('link', 'promo_code');
create type public.lead_source as enum ('contact_form', 'calculator');

-- Where the customer is in the storage lifecycle.
create type public.signup_status as enum (
  'lead', 'contacted', 'customer', 'moved_out', 'lost'
);

-- Where the commission is. pending → qualified → paid, or forfeited /
-- ineligible. Kept separate from signup_status so a churned customer can
-- still have a paid commission, etc.
create type public.commission_status as enum (
  'pending', 'qualified', 'paid', 'forfeited', 'ineligible'
);

-- ---------------------------------------------------------------------------
-- Applications (public form → inserted server-side after Turnstile check)
-- ---------------------------------------------------------------------------

create table public.affiliate_applications (
  id uuid primary key default gen_random_uuid(),
  full_name text not null check (length(full_name) between 1 and 200),
  email text not null check (length(email) between 3 and 320),
  phone text check (length(phone) <= 32),
  promotion_plan text check (length(promotion_plan) <= 2000),
  contact_consent boolean not null check (contact_consent),
  status public.application_status not null default 'pending',
  review_notes text,
  reviewed_by uuid references auth.users (id),
  reviewed_at timestamptz,
  main_site_inquiry_id uuid,
  created_at timestamptz not null default now()
);

create index affiliate_applications_status_idx
  on public.affiliate_applications (status, created_at desc);

-- ---------------------------------------------------------------------------
-- Affiliates
-- ---------------------------------------------------------------------------

create table public.affiliate_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users (id) on delete restrict,
  application_id uuid unique references public.affiliate_applications (id),
  full_name text not null,
  email text not null,
  phone text,
  email_normalized text generated always as (lower(trim(email))) stored,
  phone_last8 text generated always as (right(regexp_replace(coalesce(phone, ''), '\D', '', 'g'), 8)) stored,
  payout_method text check (payout_method in ('paynow', 'bank_transfer')),
  payout_details text,
  status public.affiliate_status not null default 'invited',
  activated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger affiliate_profiles_set_updated_at
  before update on public.affiliate_profiles
  for each row execute function public.set_updated_at();

-- Resolves the calling user's affiliate id; null for admins / non-affiliates.
create function public.current_affiliate_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select id from public.affiliate_profiles where user_id = (select auth.uid());
$$;

revoke execute on function public.current_affiliate_id() from public, anon;
grant execute on function public.current_affiliate_id() to authenticated;

-- ---------------------------------------------------------------------------
-- Codes: 8 chars from an unambiguous alphabet (no I/O/0/1), random, never
-- sequential. Created inactive; activated when current terms are accepted.
-- ---------------------------------------------------------------------------

create table public.affiliate_codes (
  id uuid primary key default gen_random_uuid(),
  affiliate_id uuid not null references public.affiliate_profiles (id) on delete restrict,
  code text not null unique check (code ~ '^[A-HJ-NP-Z2-9]{8}$'),
  is_active boolean not null default false,
  activated_at timestamptz,
  deactivated_at timestamptz,
  created_at timestamptz not null default now()
);

create index affiliate_codes_affiliate_idx on public.affiliate_codes (affiliate_id);

create function public.generate_affiliate_code()
returns text
language plpgsql
volatile
set search_path = ''
as $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; -- 32 chars
  candidate text;
  bytes bytea;
begin
  loop
    bytes := extensions.gen_random_bytes(8);
    candidate := '';
    for i in 0..7 loop
      -- 256 is a multiple of 32, so mod 32 is unbiased.
      candidate := candidate || substr(alphabet, (get_byte(bytes, i) % 32) + 1, 1);
    end loop;
    exit when not exists (select 1 from public.affiliate_codes where code = candidate);
  end loop;
  return candidate;
end;
$$;

revoke execute on function public.generate_affiliate_code() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Commission tiers (admin-editable; each signup snapshots the rate it got)
-- ---------------------------------------------------------------------------

create table public.commission_tiers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  min_qualified integer not null check (min_qualified >= 1),
  max_qualified integer check (max_qualified is null or max_qualified >= min_qualified),
  rate numeric(5, 4) not null check (rate > 0 and rate <= 1),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

insert into public.commission_tiers (name, min_qualified, max_qualified, rate) values
  ('Starter', 1, 10, 0.10),
  ('Partner', 11, 30, 0.20),
  ('Elite', 31, null, 0.35);

-- ---------------------------------------------------------------------------
-- Terms versions + click-wrap acceptance
-- ---------------------------------------------------------------------------

create table public.terms_versions (
  id uuid primary key default gen_random_uuid(),
  version text not null unique,
  body_md text not null,
  is_current boolean not null default false,
  published_at timestamptz not null default now()
);

-- At most one current version.
create unique index terms_versions_one_current
  on public.terms_versions (is_current) where is_current;

create table public.terms_acceptances (
  id uuid primary key default gen_random_uuid(),
  affiliate_id uuid not null references public.affiliate_profiles (id) on delete restrict,
  terms_version_id uuid not null references public.terms_versions (id),
  accepted_at timestamptz not null default now(),
  ip_address inet,
  user_agent text,
  unique (affiliate_id, terms_version_id)
);

-- ---------------------------------------------------------------------------
-- Onboarding pack (admin-editable template) + send log
-- ---------------------------------------------------------------------------

create table public.onboarding_templates (
  id uuid primary key default gen_random_uuid(),
  version text not null unique,
  subject text not null,
  body_md text not null, -- supports {{name}}, {{code}}, {{link}} placeholders
  is_current boolean not null default false,
  created_at timestamptz not null default now()
);

create unique index onboarding_templates_one_current
  on public.onboarding_templates (is_current) where is_current;

create table public.onboarding_sends (
  id uuid primary key default gen_random_uuid(),
  affiliate_id uuid not null references public.affiliate_profiles (id) on delete restrict,
  template_id uuid not null references public.onboarding_templates (id),
  sent_by uuid references auth.users (id),
  provider_message_id text,
  sent_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Signups: one row per lead relayed from the main site. Full PII is kept for
-- accounting/billing; affiliates never select this table directly (no RLS
-- policy for them) and only see get_my_signups()' masked output.
-- ---------------------------------------------------------------------------

create table public.affiliate_signups (
  id uuid primary key default gen_random_uuid(),
  main_site_inquiry_id uuid not null unique, -- idempotency key for the webhook
  affiliate_id uuid references public.affiliate_profiles (id) on delete restrict,
  code_id uuid references public.affiliate_codes (id),
  attribution_method public.attribution_method,
  source public.lead_source not null,
  full_name text not null,
  email text not null,
  phone text,
  email_normalized text generated always as (lower(trim(email))) stored,
  phone_last8 text generated always as (right(regexp_replace(coalesce(phone, ''), '\D', '', 'g'), 8)) stored,
  quote jsonb not null default '{}',
  submitted_at timestamptz not null,

  status public.signup_status not null default 'lead',
  customer_started_at timestamptz,
  outbound_completed_at timestamptz,
  customer_ended_at timestamptz,

  commission_status public.commission_status not null default 'pending',
  ineligible_reason text,
  forfeit_reason text,
  first_month_net_rent numeric(10, 2) check (first_month_net_rent >= 0),
  tier_name text,
  commission_rate numeric(5, 4),
  commission_amount numeric(10, 2),
  qualified_at timestamptz,
  payout_due_at timestamptz,
  paid_at timestamptz,
  payout_reference text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- An attributed row must say how; an unattributed row must be ineligible.
  check ((affiliate_id is null) = (attribution_method is null)),
  check (affiliate_id is not null or commission_status = 'ineligible')
);

create index affiliate_signups_affiliate_idx
  on public.affiliate_signups (affiliate_id, created_at desc);
create index affiliate_signups_email_idx on public.affiliate_signups (email_normalized);
create index affiliate_signups_phone_idx on public.affiliate_signups (phone_last8);
create index affiliate_signups_payout_idx
  on public.affiliate_signups (payout_due_at) where commission_status = 'qualified';

create trigger affiliate_signups_set_updated_at
  before update on public.affiliate_signups
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Audit log (service role inserts only)
-- ---------------------------------------------------------------------------

create table public.audit_log (
  id bigint generated always as identity primary key,
  actor_id uuid references auth.users (id),
  action text not null,
  entity_type text not null,
  entity_id uuid,
  details jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index audit_log_entity_idx on public.audit_log (entity_type, entity_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Masking. Name part: 1 letter as-is; 2–4 → first letter + ***; 5+ → first 3
-- + ***. Fixed-width *** so the real length isn't revealed.
-- ---------------------------------------------------------------------------

create function public.mask_name(full_name text)
returns text
language sql
immutable
set search_path = ''
as $$
  select string_agg(
    case
      when char_length(part) = 1 then part
      when char_length(part) <= 4 then left(part, 1) || '***'
      else left(part, 3) || '***'
    end,
    ' ' order by ord
  )
  from regexp_split_to_table(trim(full_name), '\s+') with ordinality as t(part, ord)
  where part <> '';
$$;

create function public.mask_phone(phone text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when phone is null or regexp_replace(phone, '\D', '', 'g') = '' then null
    else '•••• ' || right(regexp_replace(phone, '\D', '', 'g'), 4)
  end;
$$;

-- First 5 chars of the local part (all of it if shorter), domain fully hidden.
create function public.mask_email(email text)
returns text
language sql
immutable
set search_path = ''
as $$
  select left(split_part(trim(email), '@', 1), 5) || '***@*****';
$$;

-- ---------------------------------------------------------------------------
-- Affiliate-facing read: masked signups for the caller only. Authorization is
-- inside the function (caller must be an affiliate), not via nested RLS.
-- ---------------------------------------------------------------------------

create function public.get_my_signups()
returns table (
  id uuid,
  masked_name text,
  masked_phone text,
  masked_email text,
  source public.lead_source,
  attribution_method public.attribution_method,
  submitted_at timestamptz,
  status public.signup_status,
  customer_started_at timestamptz,
  customer_ended_at timestamptz,
  duration_days integer,
  commission_status public.commission_status,
  commission_rate numeric,
  commission_amount numeric,
  qualified_at timestamptz,
  payout_due_at timestamptz,
  paid_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    s.id,
    public.mask_name(s.full_name),
    public.mask_phone(s.phone),
    public.mask_email(s.email),
    s.source,
    s.attribution_method,
    s.submitted_at,
    s.status,
    s.customer_started_at,
    s.customer_ended_at,
    case when s.customer_started_at is not null then
      (coalesce(s.customer_ended_at, now())::date - s.customer_started_at::date)
    end,
    s.commission_status,
    s.commission_rate,
    s.commission_amount,
    s.qualified_at,
    s.payout_due_at,
    s.paid_at
  from public.affiliate_signups s
  where s.affiliate_id = public.current_affiliate_id()
    and public.current_affiliate_id() is not null
  order by s.submitted_at desc;
$$;

revoke execute on function public.get_my_signups() from public, anon;
grant execute on function public.get_my_signups() to authenticated;

-- ---------------------------------------------------------------------------
-- Lead ingestion (called by the signed webhook route with the service role).
-- Idempotent on main_site_inquiry_id. Never trusts the caller's attribution
-- blindly: re-checks code validity, the 14-day link window, self-referral
-- and prior attribution.
-- ---------------------------------------------------------------------------

create function public.ingest_lead(
  p_main_site_inquiry_id uuid,
  p_code text,
  p_method public.attribution_method,
  p_source public.lead_source,
  p_full_name text,
  p_email text,
  p_phone text,
  p_quote jsonb,
  p_submitted_at timestamptz,
  p_link_clicked_at timestamptz default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  existing_id uuid;
  v_code public.affiliate_codes%rowtype;
  v_affiliate public.affiliate_profiles%rowtype;
  v_email_norm text := lower(trim(p_email));
  v_phone8 text := right(regexp_replace(coalesce(p_phone, ''), '\D', '', 'g'), 8);
  v_reason text;
  new_id uuid;
begin
  select id into existing_id
  from public.affiliate_signups
  where main_site_inquiry_id = p_main_site_inquiry_id;
  if existing_id is not null then
    return existing_id;
  end if;

  select c.* into v_code
  from public.affiliate_codes c
  where c.code = upper(trim(p_code)) and c.is_active;

  if v_code.id is not null then
    select a.* into v_affiliate
    from public.affiliate_profiles a
    where a.id = v_code.affiliate_id and a.status = 'active';
  end if;

  if v_affiliate.id is null then
    v_reason := 'unknown_or_inactive_code';
  elsif p_method = 'link'
    and (p_link_clicked_at is null
         or p_link_clicked_at < p_submitted_at - interval '14 days'
         or p_link_clicked_at > p_submitted_at + interval '5 minutes') then
    v_reason := 'outside_link_window';
  elsif v_email_norm = v_affiliate.email_normalized
    or (v_phone8 <> '' and v_phone8 = v_affiliate.phone_last8) then
    v_reason := 'self_referral';
  elsif exists (
    select 1 from public.affiliate_signups s
    where s.affiliate_id is not null
      and (s.email_normalized = v_email_norm
           or (v_phone8 <> '' and s.phone_last8 = v_phone8))
  ) then
    v_reason := 'already_referred';
  end if;

  insert into public.affiliate_signups (
    main_site_inquiry_id, affiliate_id, code_id, attribution_method, source,
    full_name, email, phone, quote, submitted_at,
    commission_status, ineligible_reason
  ) values (
    p_main_site_inquiry_id,
    case when v_reason is null then v_affiliate.id end,
    case when v_reason is null then v_code.id end,
    case when v_reason is null then p_method end,
    p_source,
    p_full_name, p_email, p_phone, coalesce(p_quote, '{}'), p_submitted_at,
    case when v_reason is null then 'pending' else 'ineligible' end::public.commission_status,
    v_reason
  )
  returning id into new_id;

  return new_id;
end;
$$;

revoke execute on function public.ingest_lead(uuid, text, public.attribution_method, public.lead_source, text, text, text, jsonb, timestamptz, timestamptz)
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Qualify a signup (admin action via service role, after 60 days in good
-- standing or successful outbound for <60-day storage). Picks the tier from
-- qualified referrals in the trailing 12 months *including this one*, snapshots
-- the rate and amount, and sets payout due 30 days later.
-- ---------------------------------------------------------------------------

create function public.qualify_signup(p_signup_id uuid)
returns public.affiliate_signups
language plpgsql
security definer
set search_path = ''
as $$
declare
  s public.affiliate_signups%rowtype;
  n integer;
  t public.commission_tiers%rowtype;
begin
  select * into s from public.affiliate_signups where id = p_signup_id for update;

  if s.id is null then
    raise exception 'signup % not found', p_signup_id;
  end if;
  if s.commission_status <> 'pending' then
    raise exception 'signup % is %, not pending', p_signup_id, s.commission_status;
  end if;
  if s.customer_started_at is null or s.first_month_net_rent is null then
    raise exception 'signup % needs customer_started_at and first_month_net_rent', p_signup_id;
  end if;
  if now() < s.customer_started_at + interval '60 days'
     and s.outbound_completed_at is null then
    raise exception 'signup % has not completed 60 days or outbound', p_signup_id;
  end if;

  select count(*) + 1 into n
  from public.affiliate_signups
  where affiliate_id = s.affiliate_id
    and commission_status in ('qualified', 'paid')
    and qualified_at >= now() - interval '12 months';

  select * into t
  from public.commission_tiers
  where is_active
    and n >= min_qualified
    and (max_qualified is null or n <= max_qualified)
  order by min_qualified desc
  limit 1;

  if t.id is null then
    raise exception 'no active commission tier covers % qualified referrals', n;
  end if;

  update public.affiliate_signups
  set commission_status = 'qualified',
      qualified_at = now(),
      payout_due_at = now() + interval '30 days',
      tier_name = t.name,
      commission_rate = t.rate,
      commission_amount = round(s.first_month_net_rent * t.rate, 2)
  where id = p_signup_id
  returning * into s;

  return s;
end;
$$;

revoke execute on function public.qualify_signup(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Click-wrap: the signed-in affiliate accepts the current terms, which
-- activates their account and codes. IP/user agent are passed by the server
-- route (optional).
-- ---------------------------------------------------------------------------

create function public.accept_current_terms(
  p_ip_address inet default null,
  p_user_agent text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_affiliate_id uuid := public.current_affiliate_id();
  v_terms_id uuid;
begin
  if v_affiliate_id is null then
    raise exception 'not an affiliate';
  end if;

  if exists (
    select 1 from public.affiliate_profiles
    where id = v_affiliate_id and status in ('suspended', 'terminated')
  ) then
    raise exception 'affiliate account is not eligible';
  end if;

  select id into v_terms_id from public.terms_versions where is_current;
  if v_terms_id is null then
    raise exception 'no current terms version';
  end if;

  insert into public.terms_acceptances (affiliate_id, terms_version_id, ip_address, user_agent)
  values (v_affiliate_id, v_terms_id, p_ip_address, left(p_user_agent, 500))
  on conflict (affiliate_id, terms_version_id) do nothing;

  update public.affiliate_profiles
  set status = 'active', activated_at = coalesce(activated_at, now())
  where id = v_affiliate_id and status = 'invited';

  update public.affiliate_codes
  set is_active = true, activated_at = now()
  where affiliate_id = v_affiliate_id and not is_active and deactivated_at is null;
end;
$$;

revoke execute on function public.accept_current_terms(inet, text) from public, anon;
grant execute on function public.accept_current_terms(inet, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Approval helper (service role): after the API route has invited the auth
-- user, create the affiliate profile from the application and an inactive
-- code. The onboarding email is sent by the route afterwards.
-- ---------------------------------------------------------------------------

create function public.create_affiliate_from_application(
  p_application_id uuid,
  p_user_id uuid,
  p_reviewer_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  app public.affiliate_applications%rowtype;
  v_affiliate_id uuid;
begin
  select * into app from public.affiliate_applications
  where id = p_application_id for update;

  if app.id is null or app.status <> 'pending' then
    raise exception 'application % is not pending', p_application_id;
  end if;

  insert into public.affiliate_profiles (user_id, application_id, full_name, email, phone)
  values (p_user_id, app.id, app.full_name, app.email, app.phone)
  returning id into v_affiliate_id;

  insert into public.affiliate_codes (affiliate_id, code)
  values (v_affiliate_id, public.generate_affiliate_code());

  update public.affiliate_applications
  set status = 'approved', reviewed_by = p_reviewer_id, reviewed_at = now()
  where id = app.id;

  insert into public.audit_log (actor_id, action, entity_type, entity_id, details)
  values (p_reviewer_id, 'application.approved', 'affiliate_profile', v_affiliate_id,
          jsonb_build_object('application_id', app.id));

  return v_affiliate_id;
end;
$$;

revoke execute on function public.create_affiliate_from_application(uuid, uuid, uuid)
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- RLS. Every table on; anon gets nothing. Affiliates read only their own
-- profile, codes, acceptances and the tier table. Admins read everything.
-- No client insert/update/delete policies anywhere.
-- ---------------------------------------------------------------------------

alter table public.affiliate_applications enable row level security;
alter table public.affiliate_profiles enable row level security;
alter table public.affiliate_codes enable row level security;
alter table public.commission_tiers enable row level security;
alter table public.terms_versions enable row level security;
alter table public.terms_acceptances enable row level security;
alter table public.onboarding_templates enable row level security;
alter table public.onboarding_sends enable row level security;
alter table public.affiliate_signups enable row level security;
alter table public.audit_log enable row level security;

revoke all on
  public.affiliate_applications, public.affiliate_profiles, public.affiliate_codes,
  public.commission_tiers, public.terms_versions, public.terms_acceptances,
  public.onboarding_templates, public.onboarding_sends, public.affiliate_signups,
  public.audit_log
from anon;

create policy "applications: admin read"
  on public.affiliate_applications for select to authenticated
  using ((select public.is_admin()));

create policy "affiliate_profiles: read own or admin"
  on public.affiliate_profiles for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));

create policy "affiliate_codes: read own or admin"
  on public.affiliate_codes for select to authenticated
  using (affiliate_id = (select public.current_affiliate_id()) or (select public.is_admin()));

create policy "commission_tiers: affiliates and admin read"
  on public.commission_tiers for select to authenticated
  using ((select public.current_affiliate_id()) is not null or (select public.is_admin()));

create policy "terms_versions: affiliates and admin read"
  on public.terms_versions for select to authenticated
  using ((select public.current_affiliate_id()) is not null or (select public.is_admin()));

create policy "terms_acceptances: read own or admin"
  on public.terms_acceptances for select to authenticated
  using (affiliate_id = (select public.current_affiliate_id()) or (select public.is_admin()));

create policy "onboarding_templates: admin read"
  on public.onboarding_templates for select to authenticated
  using ((select public.is_admin()));

create policy "onboarding_sends: admin read"
  on public.onboarding_sends for select to authenticated
  using ((select public.is_admin()));

-- Deliberately NO affiliate policy: affiliates read signups only via
-- get_my_signups() (masked).
create policy "affiliate_signups: admin read"
  on public.affiliate_signups for select to authenticated
  using ((select public.is_admin()));

create policy "audit_log: admin read"
  on public.audit_log for select to authenticated
  using ((select public.is_admin()));
