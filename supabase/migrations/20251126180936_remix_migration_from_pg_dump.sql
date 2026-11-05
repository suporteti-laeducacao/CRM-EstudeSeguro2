CREATE EXTENSION IF NOT EXISTS "pg_graphql";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "plpgsql";
CREATE EXTENSION IF NOT EXISTS "supabase_vault";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
--
-- PostgreSQL database dump
--


-- Dumped from database version 17.6
-- Dumped by pg_dump version 17.7

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--



--
-- Name: app_role; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.app_role AS ENUM (
    'admin',
    'gerente',
    'vendedor'
);


--
-- Name: get_user_roles(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_user_roles(_user_id uuid) RETURNS SETOF public.app_role
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT role
  FROM public.user_roles
  WHERE user_id = _user_id;
$$;


--
-- Name: has_role(uuid, public.app_role); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.has_role(_user_id uuid, _role public.app_role) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  );
$$;


--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


SET default_table_access_method = heap;

--
-- Name: collection_attempts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.collection_attempts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    installment_id uuid NOT NULL,
    date timestamp with time zone NOT NULL,
    method text NOT NULL,
    response text,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT collection_attempts_method_check CHECK ((method = ANY (ARRAY['whatsapp'::text, 'email'::text, 'phone'::text])))
);


--
-- Name: installments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.installments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    sale_id uuid NOT NULL,
    student_name text NOT NULL,
    course text NOT NULL,
    installment_number integer NOT NULL,
    total_installments integer NOT NULL,
    value numeric(10,2) NOT NULL,
    due_date date NOT NULL,
    status text NOT NULL,
    paid_date date,
    paid_amount numeric(10,2),
    paid_method text,
    receipt text,
    notes text,
    days_overdue integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT installments_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'due_today'::text, 'overdue'::text, 'paid'::text])))
);


--
-- Name: sales; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sales (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    student_name text NOT NULL,
    course text NOT NULL,
    payment_mode text NOT NULL,
    amount numeric(10,2) NOT NULL,
    quantity integer DEFAULT 1 NOT NULL,
    date date NOT NULL,
    seller text NOT NULL,
    observation text,
    installments_enabled boolean DEFAULT false,
    installments_down_payment numeric(10,2),
    installments_number integer,
    installments_value numeric(10,2),
    installments_first_due_date date,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: students; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.students (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    full_name text NOT NULL,
    email text NOT NULL,
    phone text NOT NULL,
    cpf text NOT NULL,
    birth_date date NOT NULL,
    photo text,
    address_cep text NOT NULL,
    address_street text NOT NULL,
    address_number text NOT NULL,
    address_complement text,
    address_neighborhood text NOT NULL,
    address_city text NOT NULL,
    address_state text NOT NULL,
    academic_course text NOT NULL,
    academic_class text NOT NULL,
    academic_enrollment_date date NOT NULL,
    academic_status text NOT NULL,
    academic_default_payment_mode text NOT NULL,
    financial_status text,
    financial_default_payment_mode text,
    financial_preferred_due_day integer,
    observation text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT students_academic_status_check CHECK ((academic_status = ANY (ARRAY['active'::text, 'suspended'::text, 'completed'::text, 'cancelled'::text]))),
    CONSTRAINT students_financial_preferred_due_day_check CHECK (((financial_preferred_due_day >= 1) AND (financial_preferred_due_day <= 31))),
    CONSTRAINT students_financial_status_check CHECK ((financial_status = ANY (ARRAY['on_time'::text, 'near_due'::text, 'overdue'::text, 'settled'::text])))
);


--
-- Name: user_roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_roles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    role public.app_role NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: collection_attempts collection_attempts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.collection_attempts
    ADD CONSTRAINT collection_attempts_pkey PRIMARY KEY (id);


--
-- Name: installments installments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.installments
    ADD CONSTRAINT installments_pkey PRIMARY KEY (id);


--
-- Name: sales sales_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales
    ADD CONSTRAINT sales_pkey PRIMARY KEY (id);


--
-- Name: students students_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.students
    ADD CONSTRAINT students_pkey PRIMARY KEY (id);


--
-- Name: user_roles user_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_pkey PRIMARY KEY (id);


--
-- Name: user_roles user_roles_user_id_role_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_role_key UNIQUE (user_id, role);


--
-- Name: idx_collection_attempts_installment_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_collection_attempts_installment_id ON public.collection_attempts USING btree (installment_id);


--
-- Name: idx_collection_attempts_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_collection_attempts_user_id ON public.collection_attempts USING btree (user_id);


--
-- Name: idx_installments_due_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_installments_due_date ON public.installments USING btree (due_date);


--
-- Name: idx_installments_sale_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_installments_sale_id ON public.installments USING btree (sale_id);


--
-- Name: idx_installments_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_installments_status ON public.installments USING btree (status);


--
-- Name: idx_installments_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_installments_user_id ON public.installments USING btree (user_id);


--
-- Name: idx_sales_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sales_date ON public.sales USING btree (date);


--
-- Name: idx_sales_seller; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sales_seller ON public.sales USING btree (seller);


--
-- Name: idx_sales_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sales_user_id ON public.sales USING btree (user_id);


--
-- Name: idx_students_cpf; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_students_cpf ON public.students USING btree (cpf);


--
-- Name: idx_students_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_students_user_id ON public.students USING btree (user_id);


--
-- Name: installments update_installments_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_installments_updated_at BEFORE UPDATE ON public.installments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: sales update_sales_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_sales_updated_at BEFORE UPDATE ON public.sales FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: students update_students_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_students_updated_at BEFORE UPDATE ON public.students FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: collection_attempts collection_attempts_installment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.collection_attempts
    ADD CONSTRAINT collection_attempts_installment_id_fkey FOREIGN KEY (installment_id) REFERENCES public.installments(id) ON DELETE CASCADE;


--
-- Name: installments installments_sale_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.installments
    ADD CONSTRAINT installments_sale_id_fkey FOREIGN KEY (sale_id) REFERENCES public.sales(id) ON DELETE CASCADE;


--
-- Name: user_roles user_roles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: user_roles Admins can delete roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can delete roles" ON public.user_roles FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: user_roles Admins can insert roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can insert roles" ON public.user_roles FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: user_roles Admins can update roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can update roles" ON public.user_roles FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: user_roles Admins can view all roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view all roles" ON public.user_roles FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: collection_attempts Users can delete their own collection attempts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete their own collection attempts" ON public.collection_attempts FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: installments Users can delete their own installments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete their own installments" ON public.installments FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: sales Users can delete their own sales; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete their own sales" ON public.sales FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: students Users can delete their own students; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete their own students" ON public.students FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: collection_attempts Users can insert their own collection attempts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert their own collection attempts" ON public.collection_attempts FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: installments Users can insert their own installments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert their own installments" ON public.installments FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: sales Users can insert their own sales; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert their own sales" ON public.sales FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: students Users can insert their own students; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert their own students" ON public.students FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: collection_attempts Users can update their own collection attempts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own collection attempts" ON public.collection_attempts FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: installments Users can update their own installments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own installments" ON public.installments FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: sales Users can update their own sales; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own sales" ON public.sales FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: students Users can update their own students; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own students" ON public.students FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: collection_attempts Users can view their own collection attempts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own collection attempts" ON public.collection_attempts FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: installments Users can view their own installments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own installments" ON public.installments FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: user_roles Users can view their own roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own roles" ON public.user_roles FOR SELECT TO authenticated USING ((auth.uid() = user_id));


--
-- Name: sales Users can view their own sales; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own sales" ON public.sales FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: students Users can view their own students; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own students" ON public.students FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: collection_attempts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.collection_attempts ENABLE ROW LEVEL SECURITY;

--
-- Name: installments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.installments ENABLE ROW LEVEL SECURITY;

--
-- Name: sales; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;

--
-- Name: students; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;

--
-- Name: user_roles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

--
-- PostgreSQL database dump complete
--



-- Restaura o search_path para as proximas migrations
SELECT pg_catalog.set_config('search_path', 'public, extensions', false);
