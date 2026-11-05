-- Nome e logo do sistema, editaveis em /configuracoes (uma unica linha)
CREATE TABLE public.configuracoes_sistema (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  nome_empresa text,
  logo_url text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.configuracoes_sistema (id) VALUES (true);
ALTER TABLE public.configuracoes_sistema ENABLE ROW LEVEL SECURITY;

-- A tela de login precisa mostrar a logo antes de o usuario entrar
GRANT SELECT ON public.configuracoes_sistema TO anon, authenticated;
GRANT UPDATE ON public.configuracoes_sistema TO authenticated;
CREATE POLICY "Todos podem ver a identidade do sistema" ON public.configuracoes_sistema
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Admins podem alterar a identidade do sistema" ON public.configuracoes_sistema
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE TRIGGER update_configuracoes_sistema_updated_at
  BEFORE UPDATE ON public.configuracoes_sistema
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Bucket publico so para a logo: 2 MB, sem SVG
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('branding', 'branding', true, 2097152, ARRAY['image/png','image/jpeg','image/webp']);
CREATE POLICY "Admins gerenciam branding (select)" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'branding' AND public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Admins gerenciam branding (insert)" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'branding' AND public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Admins gerenciam branding (delete)" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'branding' AND public.has_role(auth.uid(), 'admin'::public.app_role));

-- Num banco zerado ninguem e admin: todo cadastro nasce como vendedor.
-- Rode uma vez no SQL Editor, depois de criar a conta:
--   SELECT public.definir_primeiro_admin('email@cliente.com');
CREATE FUNCTION public.definir_primeiro_admin(p_email text) RETURNS text
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE v_user uuid;
BEGIN
  IF EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin') THEN
    RAISE EXCEPTION 'Ja existe um administrador. Use a tela de Usuarios.';
  END IF;
  SELECT id INTO v_user FROM auth.users WHERE lower(email) = lower(trim(p_email));
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Nenhuma conta encontrada com o e-mail %', p_email;
  END IF;
  DELETE FROM public.user_roles WHERE user_id = v_user;
  INSERT INTO public.user_roles (user_id, role) VALUES (v_user, 'admin');
  -- Categorias internas que o financeiro espera encontrar
  INSERT INTO public.categorias_conta (user_id, nome, ativo, custo_operacional)
  SELECT v_user, c.nome, false, c.co
  FROM (VALUES ('comissao', true), ('salario', true), ('vale', true), ('despesa_fixa', false),
               ('despesa_variavel', false), ('fornecedor', false), ('outros', false)) AS c(nome, co)
  WHERE NOT EXISTS (SELECT 1 FROM public.categorias_conta x WHERE x.nome = c.nome);
  RETURN 'Administrador definido: ' || p_email;
END;
$$;
-- Jamais expor pela API: quem chamasse poderia virar admin
REVOKE ALL ON FUNCTION public.definir_primeiro_admin(text) FROM PUBLIC, anon, authenticated, service_role;
