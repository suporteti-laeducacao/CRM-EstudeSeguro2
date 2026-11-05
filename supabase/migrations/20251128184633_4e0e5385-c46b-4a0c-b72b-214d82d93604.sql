-- Add certification date fields to clientes table
ALTER TABLE public.clientes 
ADD COLUMN promessa_certificacao date,
ADD COLUMN previsao_certificacao date;