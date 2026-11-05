-- Create leads table
CREATE TABLE public.leads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  nome TEXT NOT NULL,
  email TEXT,
  telefone TEXT,
  empresa TEXT,
  curso_interesse TEXT,
  valor_estimado NUMERIC,
  origem TEXT NOT NULL DEFAULT 'manual',
  status TEXT NOT NULL DEFAULT 'novo',
  vendedor_id UUID REFERENCES public.vendedores(id),
  sunchat_id TEXT,
  tags TEXT[],
  arquivado BOOLEAN DEFAULT false,
  data_entrada TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create lead_history table for status changes
CREATE TABLE public.lead_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  status_anterior TEXT,
  status_novo TEXT NOT NULL,
  observacao TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create lead_notes table for annotations
CREATE TABLE public.lead_notes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  conteudo TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create lead_messages table for Sun Chat messages
CREATE TABLE public.lead_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  sunchat_message_id TEXT,
  remetente TEXT NOT NULL,
  conteudo TEXT NOT NULL,
  data_mensagem TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create lead_tasks table for follow-ups
CREATE TABLE public.lead_tasks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  titulo TEXT NOT NULL,
  descricao TEXT,
  data_vencimento TIMESTAMP WITH TIME ZONE,
  concluida BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_tasks ENABLE ROW LEVEL SECURITY;

-- RLS policies for leads
CREATE POLICY "Authenticated users can view all leads" ON public.leads FOR SELECT USING (true);
CREATE POLICY "Authenticated users can insert leads" ON public.leads FOR INSERT WITH CHECK (true);
CREATE POLICY "Authenticated users can update leads" ON public.leads FOR UPDATE USING (true);
CREATE POLICY "Authenticated users can delete leads" ON public.leads FOR DELETE USING (true);

-- RLS policies for lead_history
CREATE POLICY "Authenticated users can view all lead_history" ON public.lead_history FOR SELECT USING (true);
CREATE POLICY "Authenticated users can insert lead_history" ON public.lead_history FOR INSERT WITH CHECK (true);

-- RLS policies for lead_notes
CREATE POLICY "Authenticated users can view all lead_notes" ON public.lead_notes FOR SELECT USING (true);
CREATE POLICY "Authenticated users can insert lead_notes" ON public.lead_notes FOR INSERT WITH CHECK (true);
CREATE POLICY "Authenticated users can update lead_notes" ON public.lead_notes FOR UPDATE USING (true);
CREATE POLICY "Authenticated users can delete lead_notes" ON public.lead_notes FOR DELETE USING (true);

-- RLS policies for lead_messages
CREATE POLICY "Authenticated users can view all lead_messages" ON public.lead_messages FOR SELECT USING (true);
CREATE POLICY "Authenticated users can insert lead_messages" ON public.lead_messages FOR INSERT WITH CHECK (true);

-- RLS policies for lead_tasks
CREATE POLICY "Authenticated users can view all lead_tasks" ON public.lead_tasks FOR SELECT USING (true);
CREATE POLICY "Authenticated users can insert lead_tasks" ON public.lead_tasks FOR INSERT WITH CHECK (true);
CREATE POLICY "Authenticated users can update lead_tasks" ON public.lead_tasks FOR UPDATE USING (true);
CREATE POLICY "Authenticated users can delete lead_tasks" ON public.lead_tasks FOR DELETE USING (true);

-- Create trigger for updated_at
CREATE TRIGGER update_leads_updated_at
BEFORE UPDATE ON public.leads
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();