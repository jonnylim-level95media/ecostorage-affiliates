-- English + Simplified Chinese support for the affiliate side.
--
-- Terms: each version can exist in several locales. English is always the
-- governing text; a translation is only shown if it matches the current
-- English version string, so a stale translation is never presented after
-- the English terms change. Acceptances record both the text shown and the
-- governing English version.

create type public.app_locale as enum ('en', 'zh-Hans');

alter table public.affiliate_applications
  add column preferred_locale public.app_locale not null default 'en';

alter table public.affiliate_profiles
  add column preferred_locale public.app_locale not null default 'en';

-- Terms versions per locale ------------------------------------------------

alter table public.terms_versions
  add column locale public.app_locale not null default 'en',
  drop constraint terms_versions_version_key,
  add constraint terms_versions_version_locale_key unique (version, locale);

drop index public.terms_versions_one_current;
create unique index terms_versions_one_current_per_locale
  on public.terms_versions (locale) where is_current;

alter table public.terms_acceptances
  add column locale_shown public.app_locale not null default 'en',
  add column governing_terms_version_id uuid references public.terms_versions (id);

-- Onboarding templates per locale -------------------------------------------

alter table public.onboarding_templates
  add column locale public.app_locale not null default 'en',
  drop constraint onboarding_templates_version_key,
  add constraint onboarding_templates_version_locale_key unique (version, locale);

drop index public.onboarding_templates_one_current;
create unique index onboarding_templates_one_current_per_locale
  on public.onboarding_templates (locale) where is_current;

-- Terms to display for a locale: the current translation if it matches the
-- current English version, otherwise the English text. SECURITY INVOKER, so
-- terms_versions RLS (affiliates + admin) still applies to direct callers.
create function public.get_current_terms(p_locale public.app_locale)
returns table (
  id uuid,
  version text,
  locale public.app_locale,
  body_md text,
  governing_id uuid
)
language sql
stable
set search_path = ''
as $$
  with en as (
    select * from public.terms_versions where is_current and locale = 'en'
  ),
  tr as (
    select t.* from public.terms_versions t, en
    where t.is_current and t.locale = p_locale and t.version = en.version
  )
  select coalesce(tr.id, en.id), en.version, coalesce(tr.locale, en.locale),
         coalesce(tr.body_md, en.body_md), en.id
  from en left join tr on true;
$$;

revoke execute on function public.get_current_terms(public.app_locale) from public, anon;
grant execute on function public.get_current_terms(public.app_locale) to authenticated;

-- Affiliate sets their own language (no client UPDATE policy on profiles).
create function public.set_my_locale(p_locale public.app_locale)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.affiliate_profiles
  set preferred_locale = p_locale
  where user_id = (select auth.uid());
$$;

revoke execute on function public.set_my_locale(public.app_locale) from public, anon;
grant execute on function public.set_my_locale(public.app_locale) to authenticated;

-- Click-wrap, now locale-aware ---------------------------------------------

drop function public.accept_current_terms(inet, text);

create function public.accept_current_terms(
  p_locale public.app_locale,
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
  v_terms record;
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

  select * into v_terms from public.get_current_terms(p_locale);
  if v_terms.id is null then
    raise exception 'no current terms version';
  end if;

  insert into public.terms_acceptances (
    affiliate_id, terms_version_id, governing_terms_version_id,
    locale_shown, ip_address, user_agent
  )
  values (
    v_affiliate_id, v_terms.id, v_terms.governing_id,
    v_terms.locale, p_ip_address, left(p_user_agent, 500)
  )
  on conflict (affiliate_id, terms_version_id) do nothing;

  update public.affiliate_profiles
  set status = 'active',
      activated_at = coalesce(activated_at, now()),
      preferred_locale = p_locale
  where id = v_affiliate_id and status = 'invited';

  update public.affiliate_codes
  set is_active = true, activated_at = now()
  where affiliate_id = v_affiliate_id and not is_active and deactivated_at is null;
end;
$$;

revoke execute on function public.accept_current_terms(public.app_locale, inet, text) from public, anon;
grant execute on function public.accept_current_terms(public.app_locale, inet, text) to authenticated;

-- Approval carries the applicant's language onto the affiliate profile ------

create or replace function public.create_affiliate_from_application(
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

  insert into public.affiliate_profiles (
    user_id, application_id, full_name, email, phone, preferred_locale
  )
  values (p_user_id, app.id, app.full_name, app.email, app.phone, app.preferred_locale)
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
