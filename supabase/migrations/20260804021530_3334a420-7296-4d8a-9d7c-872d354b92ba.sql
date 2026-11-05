-- =========================
-- 1) JORNADA DE TRABALHO
-- =========================
CREATE TABLE public.work_schedule (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  weekday smallint NOT NULL UNIQUE CHECK (weekday BETWEEN 0 AND 6),
  hours numeric NOT NULL DEFAULT 8 CHECK (hours >= 0 AND hours <= 24),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.work_schedule TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.work_schedule TO authenticated;
GRANT ALL ON public.work_schedule TO service_role;

ALTER TABLE public.work_schedule ENABLE ROW LEVEL SECURITY;

CREATE POLICY "work_schedule_select_authenticated" ON public.work_schedule
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "work_schedule_admin_insert" ON public.work_schedule
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "work_schedule_admin_update" ON public.work_schedule
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "work_schedule_admin_delete" ON public.work_schedule
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_work_schedule_updated_at BEFORE UPDATE ON public.work_schedule
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_audit_work_schedule AFTER INSERT OR UPDATE OR DELETE ON public.work_schedule
  FOR EACH ROW EXECUTE FUNCTION public.log_system_change();

INSERT INTO public.work_schedule (weekday, hours) VALUES
  (0, 0), (1, 8), (2, 8), (3, 8), (4, 8), (5, 8), (6, 4);

-- =========================
-- 2) FERIADOS
-- =========================
CREATE TABLE public.holidays (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  day smallint CHECK (day BETWEEN 1 AND 31),
  month smallint CHECK (month BETWEEN 1 AND 12),
  date date,
  is_recurring boolean NOT NULL DEFAULT true,
  is_movable boolean NOT NULL DEFAULT false,
  movable_rule text,
  scope text NOT NULL DEFAULT 'nacional' CHECK (scope IN ('nacional','estadual','municipal','empresa')),
  day_weight numeric NOT NULL DEFAULT 0 CHECK (day_weight >= 0 AND day_weight <= 1),
  is_facultative boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  legal_basis text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.holidays TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.holidays TO authenticated;
GRANT ALL ON public.holidays TO service_role;

ALTER TABLE public.holidays ENABLE ROW LEVEL SECURITY;

CREATE POLICY "holidays_select_authenticated" ON public.holidays
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "holidays_admin_insert" ON public.holidays
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "holidays_admin_update" ON public.holidays
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "holidays_admin_delete" ON public.holidays
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_holidays_updated_at BEFORE UPDATE ON public.holidays
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_audit_holidays AFTER INSERT OR UPDATE OR DELETE ON public.holidays
  FOR EACH ROW EXECUTE FUNCTION public.log_system_change();

-- Nacionais fixos
INSERT INTO public.holidays (name, day, month, is_recurring, is_movable, scope, day_weight, is_facultative, is_active, legal_basis) VALUES
  ('Confraternização Universal', 1, 1, true, false, 'nacional', 0, false, true, 'Lei Federal 10.607/2002'),
  ('Tiradentes', 21, 4, true, false, 'nacional', 0, false, true, 'Lei Federal 662/1949'),
  ('Dia Mundial do Trabalho', 1, 5, true, false, 'nacional', 0, false, true, 'Lei Federal 662/1949'),
  ('Independência do Brasil', 7, 9, true, false, 'nacional', 0, false, true, 'Lei Federal 662/1949'),
  ('Nossa Senhora Aparecida', 12, 10, true, false, 'nacional', 0, false, true, 'Lei Federal 6.802/1980'),
  ('Finados', 2, 11, true, false, 'nacional', 0, false, true, 'Lei Federal 662/1949'),
  ('Proclamação da República', 15, 11, true, false, 'nacional', 0, false, true, 'Lei Federal 662/1949'),
  ('Dia Nacional da Consciência Negra', 20, 11, true, false, 'nacional', 0, false, true, 'Lei Federal 14.759/2023'),
  ('Natal', 25, 12, true, false, 'nacional', 0, false, true, 'Lei Federal 662/1949');

-- Móveis (offset em relação à Páscoa)
INSERT INTO public.holidays (name, is_recurring, is_movable, movable_rule, scope, day_weight, is_facultative, is_active, legal_basis) VALUES
  ('Sexta-feira da Paixão', true, true, 'easter-2', 'nacional', 0, false, true, 'Lei Federal 9.093/1995 + Lei Municipal de 05/03/1968'),
  ('Corpus Christi', true, true, 'easter+60', 'municipal', 0, false, true, 'Feriado religioso municipal — Lei Municipal de 05/03/1968'),
  ('Terça-feira de Carnaval', true, true, 'easter-47', 'municipal', 0, false, true, 'Decreto Municipal 544/2023 — Itabaiana/SE'),
  ('Segunda-feira de Carnaval', true, true, 'easter-48', 'municipal', 0.5, true, true, 'Decreto Municipal 544/2023 — Itabaiana/SE'),
  ('Quarta-feira de Cinzas', true, true, 'easter-46', 'municipal', 0.5, true, true, 'Decreto Municipal 544/2023 — Itabaiana/SE'),
  ('Quinta-feira Maior', true, true, 'easter-3', 'municipal', 0.5, true, false, 'Decreto Municipal 544/2023 — Itabaiana/SE');

-- Estadual / Municipais
INSERT INTO public.holidays (name, day, month, is_recurring, is_movable, scope, day_weight, is_facultative, is_active, legal_basis) VALUES
  ('Independência de Sergipe', 8, 7, true, false, 'estadual', 0, false, true, 'Constituição do Estado de Sergipe'),
  ('Nossa Senhora do Bom Parto', 25, 1, true, false, 'municipal', 0, false, true, 'Lei Municipal nº 1.408, de 30/06/2010'),
  ('Santo Antônio — Padroeiro da Cidade', 13, 6, true, false, 'municipal', 0, false, true, 'Lei Orgânica do Município de Itabaiana/SE'),
  ('Emancipação Política de Itabaiana/SE', 28, 8, true, false, 'municipal', 0, false, true, 'Lei Orgânica do Município de Itabaiana/SE'),
  ('Dia de São João', 24, 6, true, false, 'municipal', 0.5, true, true, 'Decreto 544/2023 — meio expediente'),
  ('Nossa Senhora da Conceição', 8, 12, true, false, 'municipal', 0, false, false, 'Lei Municipal de 05/03/1968 — não consta no decreto recente'),
  ('Dia do Servidor Público', 28, 10, true, false, 'nacional', 0, true, false, 'Lei 8.112/1990 — vale apenas para servidores públicos'),
  ('Véspera de Natal', 24, 12, true, false, 'nacional', 0.5, true, false, 'Ponto facultativo'),
  ('Véspera de Ano Novo', 31, 12, true, false, 'nacional', 0.5, true, false, 'Ponto facultativo');

-- =========================
-- 3) EXCEÇÕES DO CALENDÁRIO
-- =========================
CREATE TABLE public.calendar_exceptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date date NOT NULL,
  description text NOT NULL,
  day_weight numeric NOT NULL DEFAULT 0 CHECK (day_weight >= 0 AND day_weight <= 1),
  type text NOT NULL CHECK (type IN ('folga','trabalho_extra','meio_expediente')),
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (date)
);

GRANT SELECT ON public.calendar_exceptions TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.calendar_exceptions TO authenticated;
GRANT ALL ON public.calendar_exceptions TO service_role;

ALTER TABLE public.calendar_exceptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "calendar_exceptions_select_authenticated" ON public.calendar_exceptions
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "calendar_exceptions_admin_insert" ON public.calendar_exceptions
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "calendar_exceptions_admin_update" ON public.calendar_exceptions
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "calendar_exceptions_admin_delete" ON public.calendar_exceptions
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_calendar_exceptions_updated_at BEFORE UPDATE ON public.calendar_exceptions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_audit_calendar_exceptions AFTER INSERT OR UPDATE OR DELETE ON public.calendar_exceptions
  FOR EACH ROW EXECUTE FUNCTION public.log_system_change();

-- =========================
-- 4) CONFIGURAÇÕES DO CALENDÁRIO
-- =========================
CREATE TABLE public.calendar_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  consider_facultative boolean NOT NULL DEFAULT false,
  singleton boolean NOT NULL DEFAULT true UNIQUE CHECK (singleton),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.calendar_settings TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.calendar_settings TO authenticated;
GRANT ALL ON public.calendar_settings TO service_role;

ALTER TABLE public.calendar_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "calendar_settings_select_authenticated" ON public.calendar_settings
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "calendar_settings_admin_insert" ON public.calendar_settings
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "calendar_settings_admin_update" ON public.calendar_settings
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "calendar_settings_admin_delete" ON public.calendar_settings
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_calendar_settings_updated_at BEFORE UPDATE ON public.calendar_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_audit_calendar_settings AFTER INSERT OR UPDATE OR DELETE ON public.calendar_settings
  FOR EACH ROW EXECUTE FUNCTION public.log_system_change();

INSERT INTO public.calendar_settings (consider_facultative) VALUES (false);
