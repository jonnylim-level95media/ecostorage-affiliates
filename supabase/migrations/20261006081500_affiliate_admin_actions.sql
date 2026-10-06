-- Admin actions on affiliates that must be atomic. Service role only.

revoke execute on function public.set_updated_at() from public, anon, authenticated;

-- Suspend: codes stop working immediately (leads using them are recorded as
-- unattributed by ingest_lead). Reactivate: back to active if they have
-- accepted terms (else invited), and codes that weren't individually retired
-- come back on.
create function public.set_affiliate_suspended(p_affiliate_id uuid, p_suspended boolean)
returns public.affiliate_status
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status public.affiliate_status;
  v_new public.affiliate_status;
begin
  select status into v_status from public.affiliate_profiles where id = p_affiliate_id for update;
  if v_status is null then
    raise exception 'affiliate not found';
  end if;
  if v_status = 'terminated' then
    raise exception 'affiliate is terminated';
  end if;

  if p_suspended then
    v_new := 'suspended';
    update public.affiliate_codes set is_active = false
    where affiliate_id = p_affiliate_id and is_active;
  else
    v_new := case when exists (select 1 from public.terms_acceptances where affiliate_id = p_affiliate_id)
                  then 'active' else 'invited' end;
    if v_new = 'active' then
      update public.affiliate_codes set is_active = true, activated_at = coalesce(activated_at, now())
      where affiliate_id = p_affiliate_id and deactivated_at is null;
    end if;
  end if;

  update public.affiliate_profiles set status = v_new where id = p_affiliate_id;
  return v_new;
end;
$$;

-- Retire all current codes (e.g. one leaked to a coupon site) and issue a new
-- one, active only if the affiliate is active.
create function public.rotate_affiliate_code(p_affiliate_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status public.affiliate_status;
  v_code text := public.generate_affiliate_code();
begin
  select status into v_status from public.affiliate_profiles where id = p_affiliate_id for update;
  if v_status is null then
    raise exception 'affiliate not found';
  end if;

  update public.affiliate_codes
  set is_active = false, deactivated_at = now()
  where affiliate_id = p_affiliate_id and deactivated_at is null;

  insert into public.affiliate_codes (affiliate_id, code, is_active, activated_at)
  values (p_affiliate_id, v_code, v_status = 'active', case when v_status = 'active' then now() end);

  return v_code;
end;
$$;

revoke execute on function public.set_affiliate_suspended(uuid, boolean) from public, anon, authenticated;
revoke execute on function public.rotate_affiliate_code(uuid) from public, anon, authenticated;
