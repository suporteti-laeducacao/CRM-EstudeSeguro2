-- Adicionar o novo role 'supervisor' ao enum app_role
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'supervisor';