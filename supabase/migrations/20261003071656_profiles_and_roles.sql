-- Role system: every auth user gets a profile with a role. New accounts default
-- to 'affiliate' (least privilege); admins are promoted manually (see bottom).

create type public.app_role as enum ('admin', 'affiliate');

-- Shared updated_at trigger, reused by later tables.
create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role public.app_role not null default 'affiliate',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Backs every admin-only RLS policy. Never rely on auth.role() = 'authenticated'
-- alone: affiliates are authenticated users too. SECURITY DEFINER so it can read
-- profiles without recursing through profiles' own RLS.
create function public.is_admin()
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
  );
$$;

revoke execute on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

-- Auto-create a profile for every new auth user.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id) values (new.id);
  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- RLS: users can read their own profile, admins can read all. There are
-- deliberately no insert/update/delete policies — rows are created by the
-- trigger and roles change only via the service role, so nobody can
-- self-promote to admin from the client.
alter table public.profiles enable row level security;

revoke all on public.profiles from anon;

create policy "profiles: read own or admin"
  on public.profiles
  for select
  to authenticated
  using ((select auth.uid()) = id or (select public.is_admin()));

-- Bootstrapping the first admin (run once by hand in the SQL editor after
-- signing up, not part of this migration):
--   update public.profiles set role = 'admin'
--   where id = (select id from auth.users where email = '<your email>');
