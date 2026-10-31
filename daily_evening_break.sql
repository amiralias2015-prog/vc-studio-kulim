-- VC STUDIO KULIM: Tutup slot 19:00, 19:30 dan 20:00 SETIAP HARI untuk Konsep A/B.
-- Booking bermula semula 20:30. Tidak mengubah tetapan booking_open atau rekod sedia ada.
-- IMPORTANT: Semak dahulu jika ada booking lama pada waktu ini; ia tidak dipadam automatik.

create or replace function public.slot_availability(p_day date,p_concept text) returns table(slot_time text,unavailable boolean) language sql security definer set search_path=public as $$
select substr(s.t::text,1,5),(s.t>='19:00'::time and s.t<'20:30'::time) or exists(select 1 from public.studio_bookings b where b.booking_date=p_day and b.concept=p_concept and b.slot_time=s.t and (b.status in('confirmed','pending_review') or(b.status='awaiting_payment' and b.expires_at>now()))) or exists(select 1 from public.blocked_slots z where z.booking_date=p_day and z.concept=p_concept and z.slot_time=s.t) from(select('09:00'::time+i*interval '30 minutes')::time t from generate_series(0,29)i)s$$;

create or replace function public.create_studio_booking(p_concept text,p_date date,p_time text,p_name text,p_phone text,p_guests integer,p_payment text)
returns table(id uuid,booking_ref text,total_amount integer,deposit integer,expires_at timestamptz) language plpgsql security definer set search_path=public as $$
declare s public.studio_settings%rowtype;tm time;base integer;b public.studio_bookings%rowtype;
begin
select * into s from public.studio_settings where studio_settings.id=1;
if not coalesce(s.booking_open,false) or s.booking_start is null or s.booking_end is null then raise exception 'Tempahan belum dibuka';end if;
if p_date<s.booking_start or p_date>s.booking_end or p_date<(now() at time zone 'Asia/Kuala_Lumpur')::date then raise exception 'Tarikh tidak sah';end if;
if p_concept not in('A','B') or p_time !~ '^([01][0-9]|2[0-3]):(00|30)$' then raise exception 'Konsep/masa tidak sah';end if;
tm:=p_time::time;if tm<'09:00' or tm>'23:30' then raise exception 'Di luar waktu operasi';end if;
if tm>='19:00' and tm<'20:30' then raise exception 'Rehat malam: booking sambung 8:30 malam';end if;
if p_guests not between 1 and 15 or length(trim(p_name))<2 or length(trim(p_name))>120 or p_phone !~ '^[+]?[0-9][0-9 -]{7,17}$' or p_payment not in('QR','Bank Transfer') then raise exception 'Maklumat tidak sah';end if;
perform pg_advisory_xact_lock(hashtext(p_concept||p_date::text||tm::text));
update public.studio_bookings x set status='expired' where x.concept=p_concept and x.booking_date=p_date and x.slot_time=tm and x.status='awaiting_payment' and x.expires_at<=now();
if exists(select 1 from public.studio_bookings x where x.concept=p_concept and x.booking_date=p_date and x.slot_time=tm and x.status in('awaiting_payment','pending_review','confirmed')) or exists(select 1 from public.blocked_slots z where z.concept=p_concept and z.booking_date=p_date and z.slot_time=tm) then raise exception 'Slot penuh';end if;
base:=case when p_date in(s.raya_first,s.raya_second) then 200 else 150 end;
insert into public.studio_bookings(concept,booking_date,slot_time,customer_name,phone,guests,total_amount,payment_method) values(p_concept,p_date,tm,trim(p_name),trim(p_phone),p_guests,base+greatest(0,p_guests-6)*10,p_payment) returning * into b;
return query select b.id,b.booking_ref,b.total_amount,b.deposit,b.expires_at;end$$;

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
 if tm>='19:00' and tm<'20:30' then raise exception 'Rehat malam: slot dibuka semula 8:30 malam';end if;
 perform pg_advisory_xact_lock(hashtext(p_concept||p_date::text||tm::text));
 select * into b from public.studio_bookings where id=p_id for update;
 if not found or b.status <> 'confirmed' then raise exception 'Hanya booking confirmed boleh ditukar';end if;
 if exists(select 1 from public.blocked_slots where concept=p_concept and booking_date=p_date and slot_time=tm) then raise exception 'Slot ditutup';end if;
 update public.studio_bookings set status='expired'
 where concept=p_concept and booking_date=p_date and slot_time=tm and status='awaiting_payment' and expires_at<=now();
 if exists(select 1 from public.studio_bookings where id<>p_id and concept=p_concept and booking_date=p_date and slot_time=tm and status in ('confirmed','pending_review','awaiting_payment')) then raise exception 'Slot sudah ditempah';end if;
 update public.studio_bookings set concept=p_concept,booking_date=p_date,slot_time=tm where id=p_id;
end $$;

