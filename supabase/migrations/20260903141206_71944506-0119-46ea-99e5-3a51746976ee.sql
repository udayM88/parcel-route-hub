ALTER TABLE public.sms_logs
  ADD COLUMN IF NOT EXISTS courier_name text,
  ADD COLUMN IF NOT EXISTS raw_status text,
  ADD COLUMN IF NOT EXISTS normalized_status text,
  ADD COLUMN IF NOT EXISTS dedupe_key text,
  ADD COLUMN IF NOT EXISTS attempt_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS next_retry_at timestamptz,
  ADD COLUMN IF NOT EXISTS sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE UNIQUE INDEX IF NOT EXISTS sms_logs_dedupe_key_uidx
  ON public.sms_logs (dedupe_key) WHERE dedupe_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS sms_logs_retry_idx
  ON public.sms_logs (next_retry_at) WHERE status = 'failed';

CREATE INDEX IF NOT EXISTS sms_logs_created_at_idx
  ON public.sms_logs (created_at DESC);

DROP TRIGGER IF EXISTS update_sms_logs_updated_at ON public.sms_logs;
CREATE TRIGGER update_sms_logs_updated_at
  BEFORE UPDATE ON public.sms_logs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();