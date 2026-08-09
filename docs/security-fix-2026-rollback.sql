-- ROLLBACK SCRIPT
-- Purpose: revert the security fix applied to `webhook_configs` and `order_audit_log`
-- back to the exact state that existed before the fix, in case something breaks
-- (n8n dispatch, admin webhook management UI, or order audit logging).
--
-- Run these statements manually (via the SQL tool) ONLY if a rollback is needed.
-- This does not affect any table data — only grants/policies.

-- === webhook_configs: restore original public SELECT policy + anon grants ===
CREATE POLICY "service_role_read_webhooks" ON "public"."webhook_configs"
  AS PERMISSIVE FOR SELECT TO PUBLIC USING (true);

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE
  ON public.webhook_configs TO anon;

-- === order_audit_log: restore original public INSERT policy + anon/authenticated grants ===
CREATE POLICY "audit_log_insert_trigger" ON "public"."order_audit_log"
  AS PERMISSIVE FOR INSERT TO PUBLIC WITH CHECK (true);

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE
  ON public.order_audit_log TO anon;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, TRIGGER, TRUNCATE, UPDATE
  ON public.order_audit_log TO authenticated;
