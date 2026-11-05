-- Esta tabela e usada pelo app, mas nenhuma migration a criava.
-- Sem este arquivo, um banco novo falha aqui. Estrutura reconstruida a partir de src/integrations/supabase/types.ts.
CREATE TABLE IF NOT EXISTS public.lancamentos_campanha (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  campanha_id uuid NOT NULL REFERENCES public.campanhas_trafego(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  data date NOT NULL,
  plataforma text NOT NULL,
  categoria text NOT NULL,
  valor_gasto numeric NOT NULL DEFAULT 0,
  leads integer NOT NULL DEFAULT 0,
  alunos_convertidos integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_lancamentos_campanha_campanha_id ON public.lancamentos_campanha (campanha_id);
ALTER TABLE public.lancamentos_campanha ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER update_lancamentos_campanha_updated_at
  BEFORE UPDATE ON public.lancamentos_campanha
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
