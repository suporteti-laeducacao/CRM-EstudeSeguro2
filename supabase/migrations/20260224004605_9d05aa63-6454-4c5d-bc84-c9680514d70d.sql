
-- Migrate leads status values
UPDATE public.leads SET status = 'primeiro_contato' WHERE status = 'em_contato';
UPDATE public.leads SET status = 'em_conversa' WHERE status = 'qualificado';
UPDATE public.leads SET status = 'potencial' WHERE status = 'proposta_enviada';
UPDATE public.leads SET status = 'matriculado' WHERE status = 'em_negociacao';
UPDATE public.leads SET status = 'matriculado' WHERE status = 'ganho';

-- Migrate lead_history status values
UPDATE public.lead_history SET status_novo = 'primeiro_contato' WHERE status_novo = 'em_contato';
UPDATE public.lead_history SET status_novo = 'em_conversa' WHERE status_novo = 'qualificado';
UPDATE public.lead_history SET status_novo = 'potencial' WHERE status_novo = 'proposta_enviada';
UPDATE public.lead_history SET status_novo = 'matriculado' WHERE status_novo = 'em_negociacao';
UPDATE public.lead_history SET status_novo = 'matriculado' WHERE status_novo = 'ganho';

UPDATE public.lead_history SET status_anterior = 'primeiro_contato' WHERE status_anterior = 'em_contato';
UPDATE public.lead_history SET status_anterior = 'em_conversa' WHERE status_anterior = 'qualificado';
UPDATE public.lead_history SET status_anterior = 'potencial' WHERE status_anterior = 'proposta_enviada';
UPDATE public.lead_history SET status_anterior = 'matriculado' WHERE status_anterior = 'em_negociacao';
UPDATE public.lead_history SET status_anterior = 'matriculado' WHERE status_anterior = 'ganho';
