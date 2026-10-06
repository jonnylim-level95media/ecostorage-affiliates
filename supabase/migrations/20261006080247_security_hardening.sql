-- Security hardening.
--
-- 1. Admin access requires two-factor auth (AAL2). Enforced here in
--    is_admin(), so every admin RLS policy needs a TOTP-verified session even
--    if someone bypasses the app and calls the Data API with a password-only
--    session. Lost authenticator recovery: delete the row from
--    auth.mfa_factors for that user in the SQL editor, then re-enroll.
--
-- 2. Shared rate limiter. The in-memory limiter only sees one server
--    instance; on Vercel each instance has its own memory, so sensitive
--    endpoints also check this Postgres-backed fixed-window counter.

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles
    where id = (select auth.uid())
      and role = 'admin'
  )
  and coalesce((select auth.jwt() ->> 'aal'), '') = 'aal2';
$$;

-- Rate limiting ---------------------------------------------------------------

create table public.rate_limits (
  key text primary key,
  count integer not null,
  window_ends_at timestamptz not null
);

alter table public.rate_limits enable row level security;
revoke all on public.rate_limits from anon, authenticated;
-- No policies: only the service role (and the function below) touch it.

-- Returns true if the call is allowed. Atomic under concurrency: the upsert
-- takes a row lock, so parallel requests for the same key serialize.
create function public.check_rate_limit(p_key text, p_limit integer, p_window_seconds integer)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  if p_key is null or length(p_key) > 300 or p_limit < 1 or p_window_seconds < 1 then
    raise exception 'invalid rate limit arguments';
  end if;

  insert into public.rate_limits as r (key, count, window_ends_at)
  values (p_key, 1, now() + make_interval(secs => p_window_seconds))
  on conflict (key) do update
    set count = case when r.window_ends_at <= now() then 1 else r.count + 1 end,
        window_ends_at = case when r.window_ends_at <= now()
                              then now() + make_interval(secs => p_window_seconds)
                              else r.window_ends_at end
  returning count into v_count;

  -- Opportunistic cleanup so the table stays small without a cron job.
  if random() < 0.01 then
    delete from public.rate_limits where window_ends_at < now() - interval '1 day';
  end if;

  return v_count <= p_limit;
end;
$$;

revoke execute on function public.check_rate_limit(text, integer, integer) from public, anon, authenticated;

-- Helper functions that were callable by anon/authenticated but have no
-- reason to be. (mask_* are pure string functions, but there's no need to
-- expose them over the Data API.)
revoke execute on function public.mask_name(text) from public, anon, authenticated;
revoke execute on function public.mask_phone(text) from public, anon, authenticated;
revoke execute on function public.mask_email(text) from public, anon, authenticated;
