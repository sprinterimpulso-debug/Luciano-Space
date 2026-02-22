-- Corrige IDs temporarios deixados em faixa 1.000.000+ e restaura a numeracao esperada.
BEGIN;

UPDATE public.questions
SET id = id - 1000000
WHERE id >= 1000000
  AND id < 2000000;

DO $$
DECLARE
  seq_name text;
  max_id bigint;
BEGIN
  seq_name := pg_get_serial_sequence('public.questions', 'id');
  IF seq_name IS NOT NULL THEN
    SELECT COALESCE(MAX(id), 0) INTO max_id FROM public.questions;
    EXECUTE format('SELECT setval(%L, %s, true)', seq_name, max_id::text);
  END IF;
END $$;

COMMIT;
