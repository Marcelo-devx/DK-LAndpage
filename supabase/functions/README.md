This folder contains edge functions used by the app.

- send-email-via-resend: sends emails via Resend API. Requires RESEND_API_KEY and RESEND_FROM_EMAIL secrets.
- generate-token: creates one-time tokens and stores them in public.email_links. Requires SUPABASE_SERVICE_ROLE_KEY secret.
- validate-token: validates tokens from public.email_links.

Make sure to set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY as function secrets for server-side DB access.
