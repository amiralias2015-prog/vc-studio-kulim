-- V3: Deposit manual, check-in dan tamat tempoh hold. Booking awam kekal seperti sedia ada.
alter table public.studio_bookings add column if not exists deposit_verified_at timestamptz;
alter table public.studio_bookings add column if not exists deposit_verified_by uuid;
alter table public.studio_bookings add column if not exists checkin_status text not null default 'not_arrived';
alter table public.studio_bookings add column if not exists checked_in_at timestamptz;
alter table public.studio_bookings drop constraint if exists studio_checkin_valid;
alter table public.studio_bookings add constraint studio_checkin_valid check(checkin_status in ('not_arrived','arrived','no_show'));

-- Existing confirmed rows are NOT assumed to have paid deposit.
create or replace function public.admin_verify_deposit(p_id uuid)
returns void language plpgsql security invoker set search_path=public as $$
begin
 if not public.is_studio_admin() then raise exception 'Bukan admin'; end if;
 update public.studio_bookings set status='confirmed',confirmed_at=coalesce(confirmed_at,now()),deposit_verified_at=now(),deposit_verified_by=auth.uid()
 where id=p_id and status in ('awaiting_payment','pending_review','confirmed');
 if not found then raise exception 'Booking tidak boleh disahkan'; end if;
end $$;
revoke all on function public.admin_verify_deposit(uuid) from public,anon;
grant execute on function public.admin_verify_deposit(uuid) to authenticated;

create or replace function public.admin_expire_studio_holds()
returns integer language plpgsql security invoker set search_path=public as $$
declare affected integer;
begin
 if not public.is_studio_admin() then raise exception 'Bukan admin'; end if;
 update public.studio_bookings set status='expired'
 where status='awaiting_payment' and expires_at<=now();
 get diagnostics affected=row_count;
 return affected;
end $$;
revoke all on function public.admin_expire_studio_holds() from public,anon;
grant execute on function public.admin_expire_studio_holds() to authenticated;
-- IMPORTANT: slot_availability already treats expired 30-min holds as available.
-- create_studio_booking atomically expires any old hold at that slot before creating new booking.
-- Admin cleanup runs when dashboard reloads; no external scheduler is required to free slots.
