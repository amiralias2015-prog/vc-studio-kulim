-- VC STUDIO KULIM Supabase schema. TEST thoroughly before accepting payments.
create extension if not exists pgcrypto;
create table public.admin_users(user_id uuid primary key references auth.users(id) on delete cascade);
create table public.studio_settings(id integer primary key default 1 check(id=1),booking_start date,booking_end date,ramadan_start date,ramadan_end date,raya_first date,raya_second date,booking_open boolean not null default false);
insert into public.studio_settings(id) values(1) on conflict do nothing;
create table public.studio_bookings(id uuid primary key default gen_random_uuid(),booking_ref text unique not null default ('VC-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,9))),concept text not null check(concept in('A','B')),booking_date date not null,slot_time time not null,customer_name text not null,phone text not null,guests integer not null check(guests between 1 and 15),total_amount integer not null,deposit integer not null default 50,payment_method text not null,status text not null default 'awaiting_payment',expires_at timestamptz not null default now()+interval '30 minutes',created_at timestamptz not null default now(),confirmed_at timestamptz);
create unique index studio_one_active_slot on public.studio_bookings(concept,booking_date,slot_time) where status in('awaiting_payment','pending_review','confirmed');
create table public.blocked_slots(id uuid primary key default gen_random_uuid(),concept text not null,booking_date date not null,slot_time time not null,unique(concept,booking_date,slot_time));
alter table public.admin_users enable row level security;alter table public.studio_bookings enable row level security;alter table public.studio_settings enable row level security;alter table public.blocked_slots enable row level security;
create function public.is_studio_admin() returns boolean language sql stable security definer set search_path=public as $$select exists(select 1 from public.admin_users where user_id=auth.uid())$$;
grant execute on function public.is_studio_admin() to authenticated;
create policy "admin bookings" on public.studio_bookings for all to authenticated using(public.is_studio_admin()) with check(public.is_studio_admin());
create policy "admin settings" on public.studio_settings for all to authenticated using(public.is_studio_admin()) with check(public.is_studio_admin());
create policy "admin blocks" on public.blocked_slots for all to authenticated using(public.is_studio_admin()) with check(public.is_studio_admin());
create policy "admin self" on public.admin_users for select to authenticated using(user_id=auth.uid());
create function public.public_studio_settings() returns table(booking_start date,booking_end date,ramadan_start date,ramadan_end date,raya_first date,raya_second date,booking_open boolean) language sql security definer set search_path=public as $$select s.booking_start,s.booking_end,s.ramadan_start,s.ramadan_end,s.raya_first,s.raya_second,s.booking_open from public.studio_settings s where id=1$$;
grant execute on function public.public_studio_settings() to anon,authenticated;
create function public.slot_availability(p_day date,p_concept text) returns table(slot_time text,unavailable boolean) language sql security definer set search_path=public as $$
select substr(s.t::text,1,5),exists(select 1 from public.studio_bookings b where b.booking_date=p_day and b.concept=p_concept and b.slot_time=s.t and (b.status in('confirmed','pending_review') or(b.status='awaiting_payment' and b.expires_at>now()))) or exists(select 1 from public.blocked_slots z where z.booking_date=p_day and z.concept=p_concept and z.slot_time=s.t) from(select('09:00'::time+i*interval '30 minutes')::time t from generate_series(0,29)i)s$$;
grant execute on function public.slot_availability(date,text) to anon,authenticated;
create function public.create_studio_booking(p_concept text,p_date date,p_time text,p_name text,p_phone text,p_guests integer,p_payment text)
returns table(id uuid,booking_ref text,total_amount integer,deposit integer,expires_at timestamptz) language plpgsql security definer set search_path=public as $$
declare s public.studio_settings%rowtype;tm time;base integer;b public.studio_bookings%rowtype;
begin
select * into s from public.studio_settings where studio_settings.id=1;
if not coalesce(s.booking_open,false) or s.booking_start is null or s.booking_end is null then raise exception 'Tempahan belum dibuka';end if;
if p_date<s.booking_start or p_date>s.booking_end or p_date<(now() at time zone 'Asia/Kuala_Lumpur')::date then raise exception 'Tarikh tidak sah';end if;
if p_concept not in('A','B') or p_time !~ '^([01][0-9]|2[0-3]):(00|30)$' then raise exception 'Konsep/masa tidak sah';end if;
tm:=p_time::time;if tm<'09:00' or tm>'23:30' then raise exception 'Di luar waktu operasi';end if;
if s.ramadan_start is not null and p_date between s.ramadan_start and s.ramadan_end and tm>='19:00' and tm<'20:30' then raise exception 'Rehat berbuka';end if;
if p_guests not between 1 and 15 or length(trim(p_name))<2 or length(trim(p_name))>120 or p_phone !~ '^[+]?[0-9][0-9 -]{7,17}$' or p_payment not in('QR','Bank Transfer') then raise exception 'Maklumat tidak sah';end if;
perform pg_advisory_xact_lock(hashtext(p_concept||p_date::text||tm::text));
update public.studio_bookings x set status='expired' where x.concept=p_concept and x.booking_date=p_date and x.slot_time=tm and x.status='awaiting_payment' and x.expires_at<=now();
if exists(select 1 from public.studio_bookings x where x.concept=p_concept and x.booking_date=p_date and x.slot_time=tm and x.status in('awaiting_payment','pending_review','confirmed')) or exists(select 1 from public.blocked_slots z where z.concept=p_concept and z.booking_date=p_date and z.slot_time=tm) then raise exception 'Slot penuh';end if;
base:=case when p_date in(s.raya_first,s.raya_second) then 200 else 150 end;
insert into public.studio_bookings(concept,booking_date,slot_time,customer_name,phone,guests,total_amount,payment_method) values(p_concept,p_date,tm,trim(p_name),trim(p_phone),p_guests,base+greatest(0,p_guests-6)*10,p_payment) returning * into b;
return query select b.id,b.booking_ref,b.total_amount,b.deposit,b.expires_at;end$$;
grant execute on function public.create_studio_booking(text,date,text,text,text,integer,text) to anon,authenticated;