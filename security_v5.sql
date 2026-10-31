-- VC STUDIO KULIM SECURITY CHECK V5
-- Does not open public booking.
-- Prevent admin deposit RPC from confirming a timed-out awaiting_payment hold.
create or replace function public.admin_verify_deposit(p_id uuid)
returns void language plpgsql security invoker set search_path=public as $$
declare b public.studio_bookings%rowtype;
begin
 if not public.is_studio_admin() then raise exception 'Bukan admin'; end if;
 select * into b from public.studio_bookings where id=p_id for update;
 if not found then raise exception 'Booking tidak dijumpai'; end if;
 if b.status not in ('awaiting_payment','pending_review','confirmed') then
    raise exception 'Status booking tidak boleh disahkan';
 end if;
 if b.status='awaiting_payment' and b.expires_at <= now() then
    raise exception 'Pegangan slot sudah tamat. Minta pelanggan tempah semula, jangan sahkan deposit.';
 end if;
 update public.studio_bookings
 set status='confirmed',confirmed_at=coalesce(confirmed_at,now()),
 deposit_verified_at=coalesce(deposit_verified_at,now()),
 deposit_verified_by=coalesce(deposit_verified_by,auth.uid())
 where id=p_id;
end $$;
revoke all on function public.admin_verify_deposit(uuid) from PUBLIC,anon;
grant execute on function public.admin_verify_deposit(uuid) to authenticated;
-- Rate limiting against repeated public booking lookups requires a server-side
-- endpoint/WAF, e.g. Supabase Edge Function with abuse controls.
-- Do not treat matching reference + phone as strong identity verification.
