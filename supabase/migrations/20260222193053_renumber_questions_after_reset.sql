-- Renumera perguntas quando houver reset de IDs (ex.: ...1999, 2000, 1, 2, 3)
-- sem perder dados, preservando a ordem cronologica de criacao.
BEGIN;

WITH ordered AS (
  SELECT
    id,
    created_at,
    lag(id) OVER (ORDER BY created_at, id) AS prev_id,
    row_number() OVER (ORDER BY created_at, id) AS rn
  FROM public.questions
),
reset_point AS (
  SELECT rn, prev_id
  FROM ordered
  WHERE prev_id IS NOT NULL
    AND id < prev_id
  ORDER BY rn
  LIMIT 1
),
target AS (
  SELECT
    o.id AS old_id,
    (r.prev_id + row_number() OVER (ORDER BY o.created_at, o.id))::bigint AS new_id
  FROM ordered o
  JOIN reset_point r ON true
  WHERE o.rn >= r.rn
)
-- Fase 1: move para faixa temporaria alta, evitando colisao de PK.
UPDATE public.questions q
SET id = t.new_id + 1000000
FROM target t
WHERE q.id = t.old_id;

WITH ordered AS (
  SELECT
    id,
    created_at,
    lag(id) OVER (ORDER BY created_at, id) AS prev_id,
    row_number() OVER (ORDER BY created_at, id) AS rn
  FROM public.questions
),
reset_point AS (
  SELECT rn, prev_id
  FROM ordered
  WHERE prev_id IS NOT NULL
    AND id < prev_id
  ORDER BY rn
  LIMIT 1
),
target AS (
  SELECT
    o.id AS old_id,
    (r.prev_id + row_number() OVER (ORDER BY o.created_at, o.id))::bigint AS new_id
  FROM ordered o
  JOIN reset_point r ON true
  WHERE o.rn >= r.rn
)
-- Fase 2: aplica IDs finais corretos.
UPDATE public.questions q
SET id = t.new_id
FROM target t
WHERE q.id = t.new_id + 1000000;

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
