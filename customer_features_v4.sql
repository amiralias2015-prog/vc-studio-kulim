-- VC STUDIO KULIM V4 - private booking lookup by BOTH reference and WhatsApp.
-- Does not alter booking_open or existing reservations.
create or replace function public.lookup_studio_booking(p_ref text,p_phone text)
returns table(booking_ref text,concept text,booking_date date,slot_time time,status text,guests integer)
language sql security definer set search_path=public
as $$
 select b.booking_ref,b.concept,b.booking_date,b.slot_time,b.status,b.guests
 from public.studio_bookings b
 where b.booking_ref=upper(trim(p_ref))
 and regexp_replace(b.phone,'[^0-9]','','g')=regexp_replace(trim(p_phone),'[^0-9]','','g')
 and length(trim(p_ref)) between 8 and 24
 and length(regexp_replace(trim(p_phone),'[^0-9]','','g')) between 9 and 15
 and b.status not in ('cancelled','expired')
 limit 1
$$;
revoke all on function public.lookup_studio_booking(text,text) from public;
grant execute on function public.lookup_studio_booking(text,text) to anon,authenticated;
-- Access to private customer details is intentionally not granted.
-- Before public launch consider additional rate limits and abuse protections via Edge Function.
