-- VC STUDIO KULIM V6: server-side rate-limited lookup
-- Run BEFORE deploying Edge Function. Keep public booking closed.
create table if not exists public.vc_lookup_limits (
  client_hash text primary key,
  window_start timestamptz not null default now(),
  attempts integer not null default 0
);
alter table public.vc_lookup_limits enable row level security;
revoke all on public.vc_lookup_limits from anon,authenticated;

create or replace function public.vc_limited_lookup(p_ref text,p_phone text,p_client_hash text)
returns table(booking_ref text,concept text,booking_date date,slot_time time,status text,guests integer)
language plpgsql security definer set search_path=public as $$
declare n integer;
begin
 if length(p_client_hash)<>64 or p_client_hash !~ '^[a-f0-9]{64}$' then raise exception 'Invalid client token'; end if;
 insert into public.vc_lookup_limits(client_hash,window_start,attempts)
 values (p_client_hash,now(),1)
 on conflict(client_hash) do update
 set attempts=case when vc_lookup_limits.window_start < now()-interval '15 minutes'
                   then 1 else vc_lookup_limits.attempts+1 end,
     window_start=case when vc_lookup_limits.window_start < now()-interval '15 minutes'
                   then now() else vc_lookup_limits.window_start end
 returning attempts into n;
 if n>5 then raise exception 'Too many attempts. Try again in 15 minutes';end if;
 return query
 select b.booking_ref,b.concept,b.booking_date,b.slot_time,b.status,b.guests
 from public.studio_bookings b
 where b.booking_ref=upper(trim(p_ref))
 and regexp_replace(b.phone,'[^0-9]','','g')=regexp_replace(trim(p_phone),'[^0-9]','','g')
 and length(trim(p_ref)) between 8 and 24
 and length(regexp_replace(trim(p_phone),'[^0-9]','','g')) between 9 and 15
 and b.status not in('cancelled','expired')
 limit 1;
end $$;

revoke all on function public.vc_limited_lookup(text,text,text) from PUBLIC,anon,authenticated;
grant execute on function public.vc_limited_lookup(text,text,text) to service_role;

-- Disable direct anonymous RPC bypass. All customer checks go through Edge Function.
revoke all on function public.lookup_studio_booking(text,text) from PUBLIC,anon,authenticated;
-- Remove execute even if older grants were applied, without deleting the function.
