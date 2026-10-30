# VC STUDIO KULIM — Raya Booking

Mobile-first website and protected admin dashboard, designed for a **Supabase** backend.

## Included

- `index.html`: customer booking interface in Malay (A/B concept, date, 30-minute slot choices, 20-minute session, 1–15 people, price, policy, RM50 deposit and WhatsApp receipt hand-off).
- `admin.html` and `admin.js`: secure admin sign-in; booking list, deposit confirmation/cancellation, slot blocks, date/booking settings.
- `schema.sql`: Supabase PostgreSQL tables, RLS, public availability RPC and atomic booking RPC with locking.
- `config.js`: public configuration. **Never put a service-role key here.**

## Activate safely

1. Create your own Supabase project. In SQL Editor, run `schema.sql` once.
2. Turn off public sign-up, create an admin user under Supabase Authentication, then insert that admin UUID via SQL Editor:
   `insert into public.admin_users(user_id) values ('YOUR-AUTH-USER-UUID');`
3. Edit `config.js`: Supabase URL and **anon/publishable key**, bank details, official WhatsApp number, concept photo URLs and (optional) QR image URL. QR URL must be hosted securely.
4. In `admin.html`, sign in and set the official Ramadan/Raya dates, start/end booking dates and booking-open checkbox. Booking remains disabled until both database booking-open is true **and** bank account details are present.
5. Host all HTML, JS and CSS on HTTPS (GitHub Pages or Netlify). Avoid deploying the SQL script or credential files containing private information.
6. Test on multiple phones: book two simultaneous clients for the same concept/date/time; one should be rejected, and matching-time booking for the other concept should still work. Test Ramadan break and Raya prices.

## Manual deposit workflow

- Customer selects a slot and submits booking. A 30-minute temporary hold is placed.
- Customer transfers RM50 using displayed bank/QR details, then presses WhatsApp to send proof and reference **manually**.
- Admin checks money actually received in bank and sets booking to `confirmed`.
- **No automatic bank confirmation or receipt-upload storage is included.** Receipt is sent to admin via WhatsApp; no gateway required.
- Expired temporary holds are treated as available and atomically reclaimed by the next booking. Admin can view/mark them explicitly; for production, add a Supabase scheduled cron cleanup and anti-spam limits.

## Important production work before publishing to customers

- Setup server-side rate limiting / CAPTCHA to prevent malicious mass holds, and confirm your privacy policy and retention requirements.
- Add a secure WhatsApp reminder service only if desired; this template does **not** automatically message customers.
- Admin rescheduling is not implemented in the dashboard; use an audited admin workflow or add a secure reschedule RPC before offering it publicly.
- Both concepts have independent slot inventories. Make sure actual studio staffing supports concurrent bookings.
- The `studio_settings` controls official Raya dates for price differences and Ramadan closure; do not rely on approximate lunar calendar predictions.
- Price: RM150 normal, RM200 Raya day 1/2; +RM10 per person above 6 (max 15), deposit RM50.
- Last selectable start: 23:30; actual 20-minute session ends 23:50.

**This is a working integration-ready project, not a live booking website. A database and deployment are required.**