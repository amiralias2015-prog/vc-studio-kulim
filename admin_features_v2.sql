-- VC STUDIO KULIM ADMIN FEATURES V2
-- Run ONCE in Supabase SQL Editor. Keeps existing booking_open setting unchanged.
alter table public.studio_bookings add column if not exists balance_paid integer not null default 0;
alter table public.studio_bookings add constraint balance_paid_bounds check(balance_paid >= 0 and balance_paid <= total_amount - deposit);

create or replace function public.admin_reschedule_studio_booking(p_id uuid,p_date date,p_time text,p_concept text)
returns void language plpgsql security invoker set search_path=public as $$
declare b public.studio_bookings%rowtype;s public.studio_settings%rowtype;tm time;
begin
 if not public.is_studio_admin() then raise exception 'Akses admin diperlukan';end if;
 if p_concept not in ('A','B') or p_time !~ '^([01][0-9]|2[0-3]):(00|30)$' then raise exception 'Pilihan slot tidak sah';end if;
 tm:=p_time::time;
 if tm<'09:00' or tm>'23:30' then raise exception 'Di luar waktu operasi';end if;
 select * into s from public.studio_settings where id=1;
 if p_date < s.booking_start or p_date > s.booking_end then raise exception 'Di luar tarikh operasi';end if;
 if p_date between s.ramadan_start and s.ramadan_end and tm>='19:00' and tm<'20:30' then raise exception 'Slot berbuka puasa';end if;
 perform pg_advisory_xact_lock(hashtext(p_concept||p_date::text||tm::text));
 select * into b from public.studio_bookings where id=p_id for update;
 if not found or b.status <> 'confirmed' then raise exception 'Hanya booking confirmed boleh ditukar';end if;
 if exists(select 1 from public.blocked_slots where concept=p_concept and booking_date=p_date and slot_time=tm) then raise exception 'Slot ditutup';end if;
 update public.studio_bookings set status='expired'
 where concept=p_concept and booking_date=p_date and slot_time=tm and status='awaiting_payment' and expires_at<=now();
 if exists(select 1 from public.studio_bookings where id<>p_id and concept=p_concept and booking_date=p_date and slot_time=tm and status in ('confirmed','pending_review','awaiting_payment')) then raise exception 'Slot sudah ditempah';end if;
 update public.studio_bookings set concept=p_concept,booking_date=p_date,slot_time=tm where id=p_id;
end $$;
revoke all on function public.admin_reschedule_studio_booking(uuid,date,text,text) from public,anon;
grant execute on function public.admin_reschedule_studio_booking(uuid,date,text,text) to authenticated;
-- NOTE: No booking is opened and no existing data is deleted.
