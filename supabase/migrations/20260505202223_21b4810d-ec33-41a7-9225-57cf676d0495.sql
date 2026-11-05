-- Habilita extensão de busca por trigram (caso ainda não esteja)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Coluna calculada que concatena todo o conteúdo pesquisável do log
ALTER TABLE public.system_logs
  ADD COLUMN IF NOT EXISTS searchable_text text
  GENERATED ALWAYS AS (
    lower(
      coalesce(record_id, '') || ' ' ||
      coalesce(user_email, '') || ' ' ||
      coalesce(old_data::text, '') || ' ' ||
      coalesce(new_data::text, '')
    )
  ) STORED;

-- Índice GIN trigram para ILIKE rápido em qualquer trecho do conteúdo
CREATE INDEX IF NOT EXISTS idx_system_logs_searchable_trgm
  ON public.system_logs USING gin (searchable_text gin_trgm_ops);

-- Índices auxiliares para os filtros mais comuns
CREATE INDEX IF NOT EXISTS idx_system_logs_table_name ON public.system_logs (table_name);
CREATE INDEX IF NOT EXISTS idx_system_logs_action ON public.system_logs (action);
CREATE INDEX IF NOT EXISTS idx_system_logs_created_at ON public.system_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_system_logs_record_id ON public.system_logs (record_id);