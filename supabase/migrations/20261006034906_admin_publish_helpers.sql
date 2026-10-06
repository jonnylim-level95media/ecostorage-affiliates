-- Atomic "publish as current" for terms and onboarding templates. Doing the
-- unset-old / insert-new swap in one function keeps the one-current-per-locale
-- unique index from ever seeing two current rows, and avoids a window with
-- none. Service role only (called from admin server actions).

create function public.publish_terms_version(
  p_version text,
  p_locale public.app_locale,
  p_body_md text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_id uuid;
begin
  -- A translation must correspond to a published English version, since
  -- English is the only binding text.
  if p_locale <> 'en' and not exists (
    select 1 from public.terms_versions where version = p_version and locale = 'en'
  ) then
    raise exception 'publish English version % first', p_version;
  end if;

  update public.terms_versions
  set is_current = false
  where locale = p_locale and is_current;

  insert into public.terms_versions (version, locale, body_md, is_current)
  values (p_version, p_locale, p_body_md, true)
  returning id into new_id;

  return new_id;
end;
$$;

revoke execute on function public.publish_terms_version(text, public.app_locale, text)
  from public, anon, authenticated;

create function public.publish_onboarding_template(
  p_version text,
  p_locale public.app_locale,
  p_subject text,
  p_body_md text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_id uuid;
begin
  update public.onboarding_templates
  set is_current = false
  where locale = p_locale and is_current;

  insert into public.onboarding_templates (version, locale, subject, body_md, is_current)
  values (p_version, p_locale, p_subject, p_body_md, true)
  returning id into new_id;

  return new_id;
end;
$$;

revoke execute on function public.publish_onboarding_template(text, public.app_locale, text, text)
  from public, anon, authenticated;
