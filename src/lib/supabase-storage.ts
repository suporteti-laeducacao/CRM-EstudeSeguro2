import { supabase } from '@/integrations/supabase/client';
import { Sale, Student, Installment, CollectionAttempt } from './types';
import { cancelarCertificacaoDaVenda } from './certificacoes-storage';

// Sales
export const getSales = async (): Promise<Sale[]> => {
  const { data, error } = await supabase
    .from('sales')
    .select('*')
    .order('date', { ascending: false });

  if (error) {
    console.error('Error fetching sales:', error);
    return [];
  }

  return data.map(sale => ({
    id: sale.id,
    studentName: sale.student_name,
    course: sale.course,
    paymentMode: sale.payment_mode,
    amount: Number(sale.amount),
    quantity: sale.quantity,
    date: sale.date,
    seller: sale.seller,
    vendedorId: sale.vendedor_id || undefined,
    observation: sale.observation || undefined,
    status: (sale.status as 'ativa' | 'cancelada') || 'ativa',
    installments: sale.installments_enabled ? {
      enabled: sale.installments_enabled,
      downPayment: sale.installments_down_payment ? Number(sale.installments_down_payment) : undefined,
      downPaymentCountsInOriginal: sale.down_payment_counts_in_original ?? true,
      downPaymentCountsInCompany: sale.down_payment_counts_in_company ?? true,
      numberOfInstallments: sale.installments_number || 0,
      installmentValue: sale.installments_value ? Number(sale.installments_value) : 0,
      firstDueDate: sale.installments_first_due_date || '',
    } : undefined,
    // Campos de boleto com repasse
    tipoBoleto: (sale.tipo_boleto as 'proprio' | 'repasse') || 'proprio',
    grupoRepasseId: sale.grupo_repasse_id || undefined,
    valorTotalBoleto: sale.valor_total_boleto ? Number(sale.valor_total_boleto) : undefined,
    porcentagemAplicada: sale.porcentagem_aplicada ? Number(sale.porcentagem_aplicada) : undefined,
    valorEmpresa: sale.valor_empresa ? Number(sale.valor_empresa) : undefined,
    courseValues: sale.course_values ? (sale.course_values as number[]).map(Number) : undefined,
    courseLevels: (sale as any).course_levels ? ((sale as any).course_levels as string[]) : undefined,
    boletoGerado: sale.boleto_gerado ?? false,
    nfEmitida: (sale as any).nf_emitida ?? false,
    nfEmitidaAt: (sale as any).nf_emitida_at || undefined,
    origemLead: (sale as any).origem_lead || undefined,
    campanhaId: (sale as any).campanha_id || undefined,
    duracaoCursoValor: (sale as any).duracao_curso_valor ?? undefined,
    duracaoCursoUnidade: (sale as any).duracao_curso_unidade || undefined,
    previsaoConclusao: (sale as any).previsao_conclusao || undefined,
    alunoInativadoInadimplencia: (sale as any).aluno_inativado_inadimplencia ?? false,
  }));
};

export const saveSale = async (sale: Sale): Promise<void> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');

  const saleData = {
    id: sale.id,
    user_id: user.id,
    student_name: sale.studentName,
    course: sale.course,
    payment_mode: sale.paymentMode,
    amount: sale.amount,
    quantity: sale.quantity,
    date: sale.date,
    seller: sale.seller,
    vendedor_id: sale.vendedorId || null,
    observation: sale.observation,
    installments_enabled: sale.installments?.enabled || false,
    installments_down_payment: sale.installments?.downPayment,
    installments_number: sale.installments?.numberOfInstallments,
    installments_value: sale.installments?.installmentValue,
    installments_first_due_date: sale.installments?.firstDueDate,
    down_payment_counts_in_original: sale.installments?.downPaymentCountsInOriginal ?? true,
    down_payment_counts_in_company: sale.installments?.downPaymentCountsInCompany ?? true,
    // Campos de boleto com repasse
    tipo_boleto: sale.tipoBoleto || 'proprio',
    grupo_repasse_id: sale.grupoRepasseId || null,
    valor_total_boleto: sale.valorTotalBoleto || null,
    porcentagem_aplicada: sale.porcentagemAplicada || null,
    valor_empresa: sale.valorEmpresa || null,
    course_values: sale.courseValues || null,
    course_levels: sale.courseLevels || null,
    boleto_gerado: sale.boletoGerado ?? false,
    nf_emitida: sale.nfEmitida ?? false,
    nf_emitida_at: sale.nfEmitidaAt || null,
    origem_lead: sale.origemLead || null,
    campanha_id: sale.campanhaId || null,
    duracao_curso_valor: sale.duracaoCursoValor ?? null,
    duracao_curso_unidade: sale.duracaoCursoUnidade || null,
    previsao_conclusao: sale.previsaoConclusao || null,
    aluno_inativado_inadimplencia: sale.alunoInativadoInadimplencia ?? false,
  };

  const { error } = await supabase
    .from('sales')
    .upsert(saleData);

  if (error) throw error;
};

export const deleteSale = async (id: string): Promise<void> => {
  // Cancela a certificação vinculada antes de remover a venda
  try {
    await cancelarCertificacaoDaVenda(id, 'Venda excluída');
  } catch (e) {
    console.error('Erro ao cancelar certificação da venda excluída:', e);
  }

  const { error } = await supabase
    .from('sales')
    .delete()
    .eq('id', id);

  if (error) throw error;
};

// Students
export const getStudents = async (): Promise<Student[]> => {
  const { data, error } = await supabase
    .from('students')
    .select('*')
    .order('full_name', { ascending: true });

  if (error) {
    console.error('Error fetching students:', error);
    return [];
  }

  return data.map(student => ({
    id: student.id,
    fullName: student.full_name,
    email: student.email,
    phone: student.phone,
    cpf: student.cpf,
    birthDate: student.birth_date,
    photo: student.photo || undefined,
    address: {
      cep: student.address_cep,
      street: student.address_street,
      number: student.address_number,
      complement: student.address_complement || undefined,
      neighborhood: student.address_neighborhood,
      city: student.address_city,
      state: student.address_state,
    },
    academic: {
      course: student.academic_course,
      class: student.academic_class,
      enrollmentDate: student.academic_enrollment_date,
      status: student.academic_status as 'active' | 'suspended' | 'completed' | 'cancelled',
      defaultPaymentMode: student.academic_default_payment_mode,
    },
    financial: student.financial_status ? {
      status: student.financial_status as 'on_time' | 'near_due' | 'overdue' | 'settled',
      defaultPaymentMode: student.financial_default_payment_mode || '',
      preferredDueDay: student.financial_preferred_due_day || 1,
    } : undefined,
    observation: student.observation || undefined,
  }));
};

export const saveStudent = async (student: Student): Promise<void> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');

  const studentData = {
    id: student.id,
    user_id: user.id,
    full_name: student.fullName,
    email: student.email,
    phone: student.phone,
    cpf: student.cpf,
    birth_date: student.birthDate,
    photo: student.photo,
    address_cep: student.address.cep,
    address_street: student.address.street,
    address_number: student.address.number,
    address_complement: student.address.complement,
    address_neighborhood: student.address.neighborhood,
    address_city: student.address.city,
    address_state: student.address.state,
    academic_course: student.academic.course,
    academic_class: student.academic.class,
    academic_enrollment_date: student.academic.enrollmentDate,
    academic_status: student.academic.status,
    academic_default_payment_mode: student.academic.defaultPaymentMode,
    financial_status: student.financial?.status,
    financial_default_payment_mode: student.financial?.defaultPaymentMode,
    financial_preferred_due_day: student.financial?.preferredDueDay,
    observation: student.observation,
  };

  const { error } = await supabase
    .from('students')
    .upsert(studentData);

  if (error) throw error;
};

export const deleteStudent = async (id: string): Promise<void> => {
  const { error } = await supabase
    .from('students')
    .delete()
    .eq('id', id);

  if (error) throw error;
};

// Installments
export const getInstallments = async (): Promise<Installment[]> => {
  const pageSize = 1000;
  const data: any[] = [];
  let from = 0;

  while (true) {
    const { data: page, error } = await supabase
      .from('installments')
      .select('*, sales!inner(vendedor_id, observation, payment_mode, tipo_boleto)')
      .order('due_date', { ascending: true })
      .order('id', { ascending: true })
      .range(from, from + pageSize - 1);

    if (error) {
      console.error('Error fetching installments:', error);
      return [];
    }

    data.push(...(page ?? []));
    if (!page || page.length < pageSize) break;
    from += pageSize;
  }

  return data.map((inst: any) => ({
    id: inst.id,
    saleId: inst.sale_id,
    vendedorId: inst.sales?.vendedor_id || undefined,
    studentName: inst.student_name,
    course: inst.course,
    installmentNumber: inst.installment_number,
    totalInstallments: inst.total_installments,
    value: Number(inst.value),
    dueDate: inst.due_date,
    status: inst.status as 'pending' | 'due_today' | 'overdue' | 'paid' | 'refunded',
    paidDate: inst.paid_date || undefined,
    paidAmount: inst.paid_amount ? Number(inst.paid_amount) : undefined,
    paidMethod: inst.paid_method || undefined,
    receipt: inst.receipt || undefined,
    notes: inst.notes || undefined,
    daysOverdue: inst.days_overdue || undefined,
    fullValue: inst.full_value ? Number(inst.full_value) : undefined,
    companyValue: inst.company_value ? Number(inst.company_value) : undefined,
    isRepasse: inst.is_repasse || false,
    saleObservation: inst.sales?.observation || undefined,
    salePaymentMode: inst.sales?.payment_mode || undefined,
    saleTipoBoleto: (inst.sales?.tipo_boleto as 'proprio' | 'repasse') || undefined,
  }));
};

export const saveInstallment = async (installment: Installment): Promise<void> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');

  const installmentData = {
    id: installment.id,
    user_id: user.id,
    sale_id: installment.saleId,
    student_name: installment.studentName,
    course: installment.course,
    installment_number: installment.installmentNumber,
    total_installments: installment.totalInstallments,
    value: installment.value,
    due_date: installment.dueDate,
    status: installment.status,
    paid_date: installment.paidDate,
    paid_amount: installment.paidAmount,
    paid_method: installment.paidMethod,
    receipt: installment.receipt,
    notes: installment.notes,
    days_overdue: installment.daysOverdue,
    full_value: installment.fullValue,
    company_value: installment.companyValue,
    is_repasse: installment.isRepasse,
  };

  const { error } = await supabase
    .from('installments')
    .upsert(installmentData);

  if (error) throw error;
};

export const saveInstallments = async (installments: Installment[]): Promise<void> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');

  const installmentsData = installments.map(inst => ({
    id: inst.id,
    user_id: user.id,
    sale_id: inst.saleId,
    student_name: inst.studentName,
    course: inst.course,
    installment_number: inst.installmentNumber,
    total_installments: inst.totalInstallments,
    value: inst.value,
    due_date: inst.dueDate,
    status: inst.status,
    paid_date: inst.paidDate,
    paid_amount: inst.paidAmount,
    paid_method: inst.paidMethod,
    receipt: inst.receipt,
    notes: inst.notes,
    days_overdue: inst.daysOverdue,
    full_value: inst.fullValue,
    company_value: inst.companyValue,
    is_repasse: inst.isRepasse,
  }));

  const { error } = await supabase
    .from('installments')
    .upsert(installmentsData);

  if (error) throw error;
};

export const deleteInstallment = async (id: string): Promise<void> => {
  const { error } = await supabase
    .from('installments')
    .delete()
    .eq('id', id);

  if (error) throw error;
};

export const deleteInstallmentsBySale = async (saleId: string): Promise<void> => {
  const { error } = await supabase
    .from('installments')
    .delete()
    .eq('sale_id', saleId);

  if (error) throw error;
};

// Collection Attempts
export const getCollectionAttempts = async (): Promise<CollectionAttempt[]> => {
  const { data, error } = await supabase
    .from('collection_attempts')
    .select('*')
    .order('date', { ascending: false });

  if (error) {
    console.error('Error fetching collection attempts:', error);
    return [];
  }

  return data.map(attempt => ({
    id: attempt.id,
    installmentId: attempt.installment_id,
    date: attempt.date,
    method: attempt.method as 'whatsapp' | 'email' | 'phone',
    response: attempt.response || undefined,
    notes: attempt.notes || undefined,
  }));
};

export const saveCollectionAttempt = async (attempt: CollectionAttempt): Promise<void> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');

  const attemptData = {
    id: attempt.id,
    user_id: user.id,
    installment_id: attempt.installmentId,
    date: attempt.date,
    method: attempt.method,
    response: attempt.response,
    notes: attempt.notes,
  };

  const { error } = await supabase
    .from('collection_attempts')
    .insert(attemptData);

  if (error) throw error;
};
