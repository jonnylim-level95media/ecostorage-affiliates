-- One pending application per email address. Enforced in the database so two
-- simultaneous submissions can't both get through; the intake route maps the
-- unique violation to a friendly "already received" response.
create unique index affiliate_applications_one_pending_per_email
  on public.affiliate_applications (lower(trim(email)))
  where status = 'pending';
