-- Add data, follow_up_1, and follow_up_2 date fields to negocios table
ALTER TABLE public.negocios
ADD COLUMN data DATE,
ADD COLUMN follow_up_1 DATE,
ADD COLUMN follow_up_2 DATE;