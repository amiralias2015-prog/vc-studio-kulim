-- V6.1 fix: Do NOT raise exception after incrementing attempts,
-- as an exception rolls back the rate-limit counter transaction.
CREATE OR REPLACE FUNCTION public.vc_limited_lookup(
 p_ref text,p_phone text,p_client_hash text
) RETURNS TABLE(booking_ref text,concept text,booking_date date,slot_time time,status text,guests integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE n integer;
BEGIN
 IF p_client_hash IS NULL OR p_client_hash !~ '^[a-f0-9]{64}$'
 THEN RETURN; END IF;
 INSERT INTO public.vc_lookup_limits(client_hash,window_start,attempts)
 VALUES(p_client_hash,now(),1)
 ON CONFLICT(client_hash) DO UPDATE SET
 attempts=CASE WHEN vc_lookup_limits.window_start < now()-interval '15 minutes' THEN 1 ELSE vc_lookup_limits.attempts+1 END,
 window_start=CASE WHEN vc_lookup_limits.window_start < now()-interval '15 minutes' THEN now() ELSE vc_lookup_limits.window_start END
 RETURNING attempts INTO n;
 IF n>5 THEN RETURN; END IF;
 RETURN QUERY SELECT b.booking_ref,b.concept,b.booking_date,b.slot_time,b.status,b.guests
 FROM public.studio_bookings b
 WHERE b.booking_ref=upper(trim(p_ref))
 AND regexp_replace(b.phone,'[^0-9]','','g')=regexp_replace(trim(p_phone),'[^0-9]','','g')
 AND b.status NOT IN('cancelled','expired') LIMIT 1;
END $$;
REVOKE ALL ON FUNCTION public.vc_limited_lookup(text,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.vc_limited_lookup(text,text,text) TO service_role;
REVOKE ALL ON FUNCTION public.lookup_studio_booking(text,text) FROM PUBLIC,anon,authenticated;
