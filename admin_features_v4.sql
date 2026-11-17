-- VC STUDIO KULIM V4: timestamp and admin audit for balance payments.
-- Run once in Supabase SQL Editor. Existing bookings and booking settings are preserved.
alter table public.studio_bookings
  add column if not exists balance_paid_at timestamptz;

alter table public.studio_bookings
  add column if not exists balance_paid_by uuid references auth.users(id) on delete set null;

comment on column public.studio_bookings.balance_paid_at is
  'Timestamp when the admin last recorded an increase to cumulative balance payments received.';
comment on column public.studio_bookings.balance_paid_by is
  'Authenticated admin who last recorded an increase to cumulative balance payments received.';
