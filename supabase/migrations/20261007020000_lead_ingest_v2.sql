-- Lead ingestion v2.
--
-- The main site now sends both attribution signals and this function picks:
--   1. a typed promo code, if it belongs to an active code of an active
--      affiliate (a typed code beats a link, decision #3);
--   2. otherwise the ?ref= link cookie, if clicked within 14 days;
--   3. otherwise the lead is recorded as unattributed with the reason.
-- It also takes the main site's "already a customer" flag, and serializes
-- concurrent calls for the same person so two simultaneous enquiries can't
-- both be attributed.

drop function public.ingest_lead(uuid, text, public.attribution_method, public.lead_source, text, text, text, jsonb, timestamptz, timestamptz);

create function public.ingest_lead(
  p_main_site_inquiry_id uuid,
  p_source public.lead_source,
  p_full_name text,
  p_email text,
  p_phone text,
  p_quote jsonb,
  p_submitted_at timestamptz,
  p_promo_code text default null,
  p_ref_code text default null,
  p_link_clicked_at timestamptz default null,
  p_is_existing_customer boolean default false
)
returns table (signup_id uuid, attributed boolean, reason text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email_norm text := lower(trim(p_email));
  v_phone8 text := right(regexp_replace(coalesce(p_phone, ''), '\D', '', 'g'), 8);
  v_promo text := nullif(upper(regexp_replace(coalesce(p_promo_code, ''), '\s', '', 'g')), '');
  v_ref text := nullif(upper(regexp_replace(coalesce(p_ref_code, ''), '\s', '', 'g')), '');
  v_code_id uuid;
  v_affiliate_id uuid;
  v_affiliate public.affiliate_profiles%rowtype;
  v_method public.attribution_method;
  v_reason text;
  v_existing public.affiliate_signups%rowtype;
  v_id uuid;
begin
  -- Same person enquiring twice at once: take a per-person lock first.
  perform pg_advisory_xact_lock(hashtextextended('lead:' || v_email_norm, 0));
  if v_phone8 <> '' then
    perform pg_advisory_xact_lock(hashtextextended('lead:phone:' || v_phone8, 0));
  end if;

  -- Idempotent on the main site's inquiry id (relay retries).
  select * into v_existing from public.affiliate_signups
  where main_site_inquiry_id = p_main_site_inquiry_id;
  if v_existing.id is not null then
    return query select v_existing.id, v_existing.affiliate_id is not null, v_existing.ineligible_reason;
    return;
  end if;

  -- 1. Typed code.
  if v_promo is not null then
    select c.id, c.affiliate_id into v_code_id, v_affiliate_id
    from public.affiliate_codes c
    join public.affiliate_profiles a on a.id = c.affiliate_id
    where c.code = v_promo and c.is_active and a.status = 'active';
    select * into v_affiliate from public.affiliate_profiles where id = v_affiliate_id;
    if v_code_id is not null then
      v_method := 'promo_code';
    end if;
  end if;

  -- 2. Link cookie, only if no valid typed code.
  if v_method is null and v_ref is not null then
    select c.id, c.affiliate_id into v_code_id, v_affiliate_id
    from public.affiliate_codes c
    join public.affiliate_profiles a on a.id = c.affiliate_id
    where c.code = v_ref and c.is_active and a.status = 'active';
    select * into v_affiliate from public.affiliate_profiles where id = v_affiliate_id;
    if v_code_id is not null then
      if p_link_clicked_at is null
         or p_link_clicked_at < p_submitted_at - interval '14 days'
         or p_link_clicked_at > p_submitted_at + interval '5 minutes' then
        v_reason := 'outside_link_window';
      else
        v_method := 'link';
      end if;
    end if;
  end if;

  if v_method is null and v_reason is null then
    v_reason := 'unknown_or_inactive_code';
  elsif v_method is not null then
    if p_is_existing_customer then
      v_reason := 'existing_customer';
    elsif v_email_norm = v_affiliate.email_normalized
       or (v_phone8 <> '' and v_phone8 = v_affiliate.phone_last8) then
      v_reason := 'self_referral';
    elsif exists (
      select 1 from public.affiliate_signups s
      where s.affiliate_id is not null
        and (s.email_normalized = v_email_norm or (v_phone8 <> '' and s.phone_last8 = v_phone8))
    ) then
      v_reason := 'already_referred';
    end if;
  end if;

  insert into public.affiliate_signups (
    main_site_inquiry_id, affiliate_id, code_id, attribution_method, source,
    full_name, email, phone, quote, submitted_at, commission_status, ineligible_reason
  ) values (
    p_main_site_inquiry_id,
    case when v_reason is null then v_affiliate.id end,
    case when v_reason is null then v_code_id end,
    case when v_reason is null then v_method end,
    p_source, p_full_name, p_email, p_phone, coalesce(p_quote, '{}'), p_submitted_at,
    case when v_reason is null then 'pending' else 'ineligible' end::public.commission_status,
    v_reason
  )
  returning id into v_id;

  return query select v_id, v_reason is null, v_reason;
end;
$$;

revoke execute on function public.ingest_lead(uuid, public.lead_source, text, text, text, jsonb, timestamptz, text, text, timestamptz, boolean)
  from public, anon, authenticated;

-- Promo code check for the main site's calculator "Apply" button.
create function public.is_code_redeemable(p_code text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.affiliate_codes c
    join public.affiliate_profiles a on a.id = c.affiliate_id
    where c.code = upper(regexp_replace(coalesce(p_code, ''), '\s', '', 'g'))
      and c.is_active and a.status = 'active'
  );
$$;

revoke execute on function public.is_code_redeemable(text) from public, anon, authenticated;
