import { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import Layout from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Badge } from '@/components/ui/badge';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Plus, Search, Edit, Trash2, Check, ChevronsUpDown, Info, ArrowRightLeft, ChevronDown, ChevronUp, User, Ban, Calculator, Paperclip, X, Lock, Unlock, RotateCcw, FileText, ShoppingCart, MoreVertical } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { storage } from '@/lib/storage';
import { Sale, Installment, Student, COURSES, PAYMENT_MODES, BRAZILIAN_STATES } from '@/lib/types';
import { toast } from 'sonner';
import { getVendedores, Vendedor } from '@/lib/vendedores-storage';
import { supabase } from '@/integrations/supabase/client';
import { VendedorQuickAdd } from '@/components/VendedorQuickAdd';
import { CursoQuickAdd } from '@/components/CursoQuickAdd';
import { GrupoRepasseQuickAdd } from '@/components/GrupoRepasseQuickAdd';
import { getCursos, Curso } from '@/lib/cursos-storage';
import { getGruposRepasseAtivos, GrupoRepasse } from '@/lib/grupos-repasse-storage';
import DateVendorFilters from '@/components/filters/DateVendorFilters';
import { PageHeader } from '@/components/PageHeader';
import { CancelSaleDialog } from '@/components/sales/CancelSaleDialog';
import { SaleChangeLog } from '@/components/sales/SaleChangeLog';
import { RecalculateInstallmentsDialog } from '@/components/sales/RecalculateInstallmentsDialog';
import { UnlockEnrollmentDialog } from '@/components/sales/UnlockEnrollmentDialog';
import { LockEnrollmentDialog } from '@/components/sales/LockEnrollmentDialog';
import { DeleteSaleDialog } from '@/components/sales/DeleteSaleDialog';
import { useAuth } from '@/hooks/useAuth';
import { ensureCertificacaoDaVenda } from '@/lib/certificacoes-storage';

const Sales = () => {
  const { hasRole } = useAuth();
  const isAdmin = hasRole('admin');
  const [searchParams, setSearchParams] = useSearchParams();
  const [sales, setSales] = useState<Sale[]>([]);
  const [allInstallments, setAllInstallments] = useState<Installment[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingSale, setEditingSale] = useState<Sale | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterDataInicio, setFilterDataInicio] = useState<Date | undefined>();
  const [filterDataFim, setFilterDataFim] = useState<Date | undefined>();
  const [filterVendedorId, setFilterVendedorId] = useState<string>('');
  const [courseComboboxOpen, setCourseComboboxOpen] = useState(false);
  const [vendedores, setVendedores] = useState<Vendedor[]>([]);
  const [cursos, setCursos] = useState<Curso[]>([]);
  const [campanhas, setCampanhas] = useState<{ id: string; nome: string }[]>([]);
  const [gruposRepasse, setGruposRepasse] = useState<GrupoRepasse[]>([]);
  const [isVendedorQuickAddOpen, setIsVendedorQuickAddOpen] = useState(false);
  const [isCursoQuickAddOpen, setIsCursoQuickAddOpen] = useState(false);
  const [isGrupoRepasseQuickAddOpen, setIsGrupoRepasseQuickAddOpen] = useState(false);
  const [studentDataOpen, setStudentDataOpen] = useState(true);
  const [studentAddressOpen, setStudentAddressOpen] = useState(false);
  const [cancelingSale, setCancelingSale] = useState<Sale | null>(null);
  const [isCancelDialogOpen, setIsCancelDialogOpen] = useState(false);
  const [recalcSale, setRecalcSale] = useState<Sale | null>(null);
  const [isRecalcOpen, setIsRecalcOpen] = useState(false);
  const [comprovanteFiles, setComprovanteFiles] = useState<File[]>([]);
  const [existingReceiptPaths, setExistingReceiptPaths] = useState<string[]>([]);
  const [unlockSale, setUnlockSale] = useState<Sale | null>(null);
  const [isUnlockDialogOpen, setIsUnlockDialogOpen] = useState(false);
  const [lockSale, setLockSale] = useState<Sale | null>(null);
  const [isLockDialogOpen, setIsLockDialogOpen] = useState(false);
  const [deletingSale, setDeletingSale] = useState<Sale | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  // Helper function to get local date string (YYYY-MM-DD) without timezone conversion
  const getLocalDateString = (date: Date = new Date()) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Calcula a previsão de conclusão a partir da data da venda + duração informada
  const calcPrevisaoConclusao = (saleDate: string, valor: string, unidade: string): string | undefined => {
    const n = parseInt(valor);
    if (!saleDate || !n || n <= 0) return undefined;
    const [y, m, d] = saleDate.split('-').map(Number);
    const base = new Date(y, (m || 1) - 1, d || 1);
    if (unidade === 'dias') base.setDate(base.getDate() + n);
    else if (unidade === 'anos') base.setFullYear(base.getFullYear() + n);
    else base.setMonth(base.getMonth() + n);
    return getLocalDateString(base);
  };

  const formatBR = (iso: string) => {
    const [y, m, d] = iso.split('-');
    return `${d}/${m}/${y}`;
  };



  // Parse a YYYY-MM-DD string as a *local* date (prevents day shifting caused by UTC parsing)
  const parseLocalDateString = (dateStr: string) => {
    const [year, month, day] = dateStr.split('-').map(Number);
    return new Date(year, month - 1, day);
  };

  interface ProductLine {
    nivelEnsino: string;
    course: string;
    valor: string;
    courseComboboxOpen?: boolean;
  }

  const createEmptyProduct = (): ProductLine => ({
    nivelEnsino: '',
    course: '',
    valor: '',
    courseComboboxOpen: false,
  });

  const [products, setProducts] = useState<ProductLine[]>([createEmptyProduct()]);

  const [formData, setFormData] = useState({
    studentName: '',
    paymentMode: '',
    date: getLocalDateString(),
    vendedorId: '',
    observation: '',
    origemLead: '',
    campanhaId: '',
    duracaoValor: '',
    duracaoUnidade: 'meses',
    // Installment fields
    enableInstallments: false,
    downPayment: '',
    downPaymentDueDate: getLocalDateString(),
    downPaymentCountsInOriginal: true,
    downPaymentCountsInCompany: true,
    numberOfInstallments: '1',
    firstDueDate: getLocalDateString(),
    // Repasse fields
    tipoBoleto: 'proprio' as 'proprio' | 'repasse',
    grupoRepasseId: '',
    valorTotalBoleto: '',
    // Student fields
    studentEmail: '',
    studentPhone: '',
    studentCpf: '',
    studentBirthDate: '',
    studentCep: '',
    studentStreet: '',
    studentNumber: '',
    studentComplement: '',
    studentNeighborhood: '',
    studentCity: '',
    studentState: '',
    studentClass: '',
  });

  useEffect(() => {
    loadSales();
    loadStudents();
    loadVendedores();
    loadCursos();
    loadCampanhas();
    loadGruposRepasse();
    loadAllInstallments();
  }, []);

  // Auto-open sale from query param
  useEffect(() => {
    const saleId = searchParams.get('sale');
    if (saleId && sales.length > 0 && !editingSale) {
      const sale = sales.find(s => s.id === saleId);
      if (sale) {
        handleEdit(sale);
        searchParams.delete('sale');
        setSearchParams(searchParams, { replace: true });
      }
    }
  }, [sales, searchParams]);

  const loadVendedores = async () => {
    // Em "Nova Venda", carregar a mesma lista que o admin (inclui inativos), sem mudar outras telas.
    try {
      const { data, error } = await supabase.functions.invoke('list-vendedores', {
        body: { includeInactive: true },
      });

      if (!error && data?.success && Array.isArray(data?.data)) {
        setVendedores(data.data as Vendedor[]);
        return;
      }
    } catch {
      // fallback abaixo
    }

    const loaded = await getVendedores(false);
    setVendedores(loaded);
  };

  const loadCampanhas = async () => {
    const { data, error } = await supabase
      .from('campanhas_trafego')
      .select('id, nome')
      .order('nome', { ascending: true });
    if (!error) setCampanhas(data || []);
  };

  const loadCursos = async () => {
    const loaded = await getCursos();
    setCursos(loaded);
  };

  const loadGruposRepasse = async () => {
    try {
      const loaded = await getGruposRepasseAtivos();
      setGruposRepasse(loaded);
    } catch (error) {
      console.error('Erro ao carregar grupos de repasse:', error);
    }
  };

  const loadSales = async () => {
    const loadedSales = await storage.getSales();
    const sortedSales = loadedSales.sort(
      (a, b) => parseLocalDateString(b.date).getTime() - parseLocalDateString(a.date).getTime()
    );
    setSales(sortedSales);
  };

  const loadAllInstallments = async () => {
    const loaded = await storage.getInstallments();
    setAllInstallments(loaded);
  };

  const loadStudents = async () => {
    const loadedStudents = await storage.getStudents();
    setStudents(loadedStudents);
  };

  // Preencher dados do aluno quando o nome é selecionado/alterado
  // Apenas dados pessoais são preenchidos, curso e financeiro ficam livres
  const fillStudentData = (studentName: string) => {
    const existingStudent = students.find(s => s.fullName.toLowerCase() === studentName.toLowerCase());
    if (existingStudent) {
      setFormData(prev => ({
        ...prev,
        studentName: existingStudent.fullName,
        studentEmail: existingStudent.email,
        studentPhone: existingStudent.phone,
        studentCpf: existingStudent.cpf,
        studentBirthDate: existingStudent.birthDate,
        studentCep: existingStudent.address.cep,
        studentStreet: existingStudent.address.street,
        studentNumber: existingStudent.address.number,
        studentComplement: existingStudent.address.complement || '',
        studentNeighborhood: existingStudent.address.neighborhood,
        studentCity: existingStudent.address.city,
        studentState: existingStudent.address.state,
        studentClass: existingStudent.academic.class,
        // Curso e modo de pagamento NÃO são preenchidos automaticamente
      }));
    }
  };

  // Calcular valor da empresa baseado no repasse
  const calcularValorEmpresa = () => {
    if (formData.tipoBoleto !== 'repasse' || !formData.grupoRepasseId || !formData.valorTotalBoleto) {
      return null;
    }
    const grupo = gruposRepasse.find(g => g.id === formData.grupoRepasseId);
    if (!grupo) return null;
    const valorTotal = parseFloat(formData.valorTotalBoleto);
    if (isNaN(valorTotal)) return null;
    return valorTotal * (grupo.porcentagem_empresa / 100);
  };

  const getSelectedGrupoPorcentagem = () => {
    if (!formData.grupoRepasseId) return null;
    const grupo = gruposRepasse.find(g => g.id === formData.grupoRepasseId);
    return grupo?.porcentagem_empresa || null;
  };

  const uploadComprovante = async (file: File, saleId: string): Promise<string> => {
    const fileExt = file.name.split('.').pop();
    const filePath = `${saleId}/${crypto.randomUUID()}.${fileExt}`;
    const { error } = await supabase.storage.from('comprovantes').upload(filePath, file);
    if (error) throw error;
    return filePath;
  };

  const isBoletoOrParcelado = (paymentMode: string, enableInstallments: boolean) => {
    return paymentMode === 'Boleto' || paymentMode.toLowerCase().includes('parcelado') || enableInstallments;
  };

  // Computed total from all products
  const totalProdutos = products.reduce((sum, p) => sum + (parseFloat(p.valor) || 0), 0);
  const totalProdutosStr = totalProdutos > 0 ? totalProdutos.toFixed(2) : '';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate products
    const validProducts = products.filter(p => p.course && p.valor);
    if (!formData.studentName || validProducts.length === 0 || !formData.paymentMode || !formData.vendedorId || !formData.origemLead) {
      toast.error('Preencha todos os campos obrigatórios (incluindo pelo menos um curso com valor e origem do lead)');
      return;
    }

    if (formData.origemLead === 'Tráfego Pago' && !formData.campanhaId) {
      toast.error('Selecione a campanha de tráfego pago');
      return;
    }

    // Comprovante obrigatório para vendas que NÃO são boleto/parcelado
    const isInstallmentSale = isBoletoOrParcelado(formData.paymentMode, formData.enableInstallments);
    if (!isInstallmentSale && comprovanteFiles.length === 0 && !editingSale) {
      toast.error('Anexe o comprovante de pagamento');
      return;
    }

    // Validação dos dados do aluno (obrigatórios)
    if (!formData.studentEmail || !formData.studentPhone || !formData.studentCpf || !formData.studentBirthDate) {
      toast.error('Preencha todos os dados do aluno: E-mail, Telefone, CPF e Data de Nascimento');
      setStudentDataOpen(true);
      return;
    }

    // Validação do endereço do aluno (obrigatório)
    const missingAddress: string[] = [];
    if (!formData.studentCep) missingAddress.push('CEP');
    if (!formData.studentStreet) missingAddress.push('Rua/Avenida');
    if (!formData.studentNumber) missingAddress.push('Número');
    if (!formData.studentNeighborhood) missingAddress.push('Bairro');
    if (!formData.studentCity) missingAddress.push('Cidade');
    if (!formData.studentState) missingAddress.push('Estado');
    if (missingAddress.length > 0) {
      toast.error(`Preencha o endereço do aluno: ${missingAddress.join(', ')}`);
      setStudentDataOpen(true);
      setStudentAddressOpen(true);
      return;
    }


    // Validações específicas para boleto com repasse
    if (formData.paymentMode === 'Boleto' && formData.tipoBoleto === 'repasse') {
      if (!formData.grupoRepasseId) {
        toast.error('Selecione o grupo de repasse');
        return;
      }
      if (!formData.valorTotalBoleto || parseFloat(formData.valorTotalBoleto) <= 0) {
        toast.error('O valor total do boleto deve ser maior que zero');
        return;
      }
    } else if (totalProdutos <= 0) {
      toast.error('Preencha o valor dos produtos');
      return;
    }

    const selectedVendedor = vendedores.find(v => v.id === formData.vendedorId);
    if (!selectedVendedor) {
      toast.error('Vendedor inválido');
      return;
    }

    setIsSaving(true);
    try {
      const shouldGenerateInstallments = 
        formData.enableInstallments && 
        (formData.paymentMode === 'Boleto' || formData.paymentMode.toLowerCase().includes('parcelado'));

      // Calcular valores para repasse
      const coursesStr = products.filter(p => p.course).map(p => p.course).join(' | ');
      let saleAmount = totalProdutos;
      let tipoBoleto: 'proprio' | 'repasse' = 'proprio';
      let grupoRepasseId: string | undefined;
      let valorTotalBoleto: number | undefined;
      let porcentagemAplicada: number | undefined;
      let valorEmpresa: number | undefined;

      if (formData.paymentMode === 'Boleto' && formData.tipoBoleto === 'repasse') {
        tipoBoleto = 'repasse';
        grupoRepasseId = formData.grupoRepasseId;
        valorTotalBoleto = parseFloat(formData.valorTotalBoleto);
        const grupo = gruposRepasse.find(g => g.id === formData.grupoRepasseId);
        if (grupo) {
          porcentagemAplicada = grupo.porcentagem_empresa;
          valorEmpresa = valorTotalBoleto * (grupo.porcentagem_empresa / 100);
          saleAmount = valorEmpresa;
        }
      }

      const sale: Sale = {
        id: editingSale?.id || crypto.randomUUID(),
        studentName: formData.studentName,
        course: coursesStr,
        paymentMode: formData.paymentMode,
        amount: saleAmount,
        quantity: products.filter(p => p.course).length,
        date: formData.date,
        seller: selectedVendedor.nome,
        vendedorId: formData.vendedorId,
        observation: formData.observation,
        origemLead: formData.origemLead,
        campanhaId: formData.origemLead === 'Tráfego Pago' ? formData.campanhaId || undefined : undefined,
        duracaoCursoValor: formData.duracaoValor ? parseInt(formData.duracaoValor) : undefined,
        duracaoCursoUnidade: formData.duracaoValor ? (formData.duracaoUnidade as 'dias' | 'meses' | 'anos') : undefined,
        previsaoConclusao: calcPrevisaoConclusao(formData.date, formData.duracaoValor, formData.duracaoUnidade),
        tipoBoleto,
        grupoRepasseId,
        valorTotalBoleto,
        porcentagemAplicada,
        valorEmpresa,
        courseValues: products.filter(p => p.course).map(p => parseFloat(p.valor) || 0),
        courseLevels: products.filter(p => p.course).map(p => p.nivelEnsino || ''),
      };

      let installments: Installment[] = [];

      if (shouldGenerateInstallments) {
        const fullTotalAmount = tipoBoleto === 'repasse' ? valorTotalBoleto! : totalProdutos;
        const downPayment = formData.downPayment ? parseFloat(formData.downPayment) : 0;
        const numberOfInstallments = parseInt(formData.numberOfInstallments);
        
        // Valor original a parcelar (com ou sem entrada no original)
        const downPaymentForOriginal = formData.downPaymentCountsInOriginal ? downPayment : 0;
        const fullAmountToInstall = fullTotalAmount - downPaymentForOriginal;
        const fullInstallmentValue = fullAmountToInstall / numberOfInstallments;
        
        // Para repasse: valor empresa por parcela = porcentagem sobre cada parcela original
        // Para próprio: valor por parcela = valor original por parcela
        let installmentValue: number;
        if (tipoBoleto === 'repasse') {
          installmentValue = fullInstallmentValue * (porcentagemAplicada! / 100);
        } else {
          installmentValue = fullInstallmentValue;
        }

        sale.installments = {
          enabled: true,
          downPayment,
          downPaymentCountsInOriginal: formData.downPaymentCountsInOriginal,
          downPaymentCountsInCompany: formData.downPaymentCountsInCompany,
          numberOfInstallments,
          installmentValue,
          firstDueDate: formData.firstDueDate,
        };

        // Generate installment records
        // Add down payment if exists
        if (downPayment > 0) {
          installments.push({
            id: crypto.randomUUID(),
            saleId: sale.id,
            studentName: sale.studentName,
            course: sale.course,
            installmentNumber: 0,
            totalInstallments: numberOfInstallments,
            value: downPayment,
            dueDate: formData.downPaymentDueDate || formData.date,
            status: 'pending',
            isRepasse: tipoBoleto === 'repasse',
            fullValue: tipoBoleto === 'repasse' ? downPayment : undefined,
            companyValue: tipoBoleto === 'repasse' ? downPayment : undefined,
          });
        }

        // Add installments
        const [year, month, day] = formData.firstDueDate.split('-').map(Number);
        for (let i = 1; i <= numberOfInstallments; i++) {
          const dueDate = new Date(year, month - 1 + (i - 1), day);
          const dueDateString = `${dueDate.getFullYear()}-${String(dueDate.getMonth() + 1).padStart(2, '0')}-${String(dueDate.getDate()).padStart(2, '0')}`;
          
          installments.push({
            id: crypto.randomUUID(),
            saleId: sale.id,
            studentName: sale.studentName,
            course: sale.course,
            installmentNumber: i,
            totalInstallments: numberOfInstallments,
            value: installmentValue,
            dueDate: dueDateString,
            status: 'pending',
            isRepasse: tipoBoleto === 'repasse',
            fullValue: tipoBoleto === 'repasse' ? fullInstallmentValue : undefined,
            companyValue: tipoBoleto === 'repasse' ? installmentValue : undefined,
          });
        }
      } else {
        // For non-installment sales (PIX, cash, etc.), create a PENDING installment
        // so the financial manager can confirm the payment with the receipt
        const fullValue = tipoBoleto === 'repasse' ? valorTotalBoleto : saleAmount;
        installments.push({
          id: crypto.randomUUID(),
          saleId: sale.id,
          studentName: sale.studentName,
          course: sale.course,
          installmentNumber: 1,
          totalInstallments: 1,
          value: saleAmount,
          dueDate: formData.date,
          status: 'pending',
          isRepasse: tipoBoleto === 'repasse',
          fullValue: tipoBoleto === 'repasse' ? fullValue : undefined,
          companyValue: tipoBoleto === 'repasse' ? saleAmount : undefined,
        });
      }

      // === CHANGE LOG: detect field changes when editing ===
      if (editingSale) {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const changes: { field_name: string; old_value: string | null; new_value: string | null }[] = [];
          if (editingSale.studentName !== sale.studentName) changes.push({ field_name: 'studentName', old_value: editingSale.studentName, new_value: sale.studentName });
          if (editingSale.course !== sale.course) changes.push({ field_name: 'course', old_value: editingSale.course, new_value: sale.course });
          if (editingSale.paymentMode !== sale.paymentMode) changes.push({ field_name: 'paymentMode', old_value: editingSale.paymentMode, new_value: sale.paymentMode });
          if (editingSale.amount !== sale.amount) changes.push({ field_name: 'amount', old_value: String(editingSale.amount), new_value: String(sale.amount) });
          if (editingSale.date !== sale.date) changes.push({ field_name: 'date', old_value: editingSale.date, new_value: sale.date });
          if (editingSale.seller !== sale.seller) changes.push({ field_name: 'seller', old_value: editingSale.seller, new_value: sale.seller });
          if ((editingSale.observation || '') !== (sale.observation || '')) changes.push({ field_name: 'observation', old_value: editingSale.observation || null, new_value: sale.observation || null });

          if (changes.length > 0) {
            await supabase.from('sale_change_logs').insert(
              changes.map((c) => ({ sale_id: sale.id, user_id: user.id, ...c }))
            );
          }
        }
      }

      // Upload comprovantes if provided (multiple supported)
      const uploadedPaths: string[] = [];
      for (const file of comprovanteFiles) {
        const p = await uploadComprovante(file, sale.id);
        uploadedPaths.push(p);
      }

      // Final receipt list = kept existing paths + newly uploaded paths
      const finalReceiptPaths = [...existingReceiptPaths, ...uploadedPaths];
      const joinedReceipts = finalReceiptPaths.length > 0 ? finalReceiptPaths.join('\n') : undefined;

      // Attach receipt to the appropriate installment:
      // - For non-installment sales: attach to the single installment
      // - For installment sales with down payment: attach to the entry (installment #0)
      // - For installment sales without down payment: attach to installment #0 or first
      if (joinedReceipts && !editingSale && installments.length > 0) {
        const targetIdx = installments.findIndex(i => i.installmentNumber === 0);
        if (targetIdx >= 0) {
          installments[targetIdx].receipt = joinedReceipts;
        } else {
          installments[0].receipt = joinedReceipts;
        }
      }

      // Save sale FIRST, then handle installments (foreign key dependency)
      await storage.saveSale(sale);

      if (editingSale) {
        // UPDATE existing installments instead of creating new ones
        const existingInstallments = await storage.getInstallments();
        const saleInstallments = existingInstallments.filter((i) => i.saleId === sale.id);

        if (saleInstallments.length > 0) {
          // Always sync receipts (kept + uploaded) to entry installment on edit
          const entryIdx = saleInstallments.findIndex((i) => i.installmentNumber === 0);
          const targetId = entryIdx >= 0 ? saleInstallments[entryIdx].id : saleInstallments[0].id;

          const updatedInstallments = saleInstallments.map((inst) => {
            const base: typeof inst = {
              ...inst,
              studentName: sale.studentName,
              course: sale.course,
            };
            if (inst.id === targetId) {
              base.receipt = joinedReceipts;
            }
            return base;
          });
          await storage.saveInstallments(updatedInstallments);
        } else if (installments.length > 0) {
          // No existing installments (shouldn't happen), create new ones
          await storage.saveInstallments(installments);
        }
      } else {
        // New sale - create installments
        if (installments.length > 0) {
          await storage.saveInstallments(installments);
        }
      }

      // Sincronizar dados do aluno com a tabela students (obrigatório)
      const existingStudent = students.find(s => s.fullName.toLowerCase() === formData.studentName.toLowerCase());
      const student: Student = {
        id: existingStudent?.id || crypto.randomUUID(),
        fullName: formData.studentName,
        email: formData.studentEmail || existingStudent?.email || '',
        phone: formData.studentPhone || existingStudent?.phone || '',
        cpf: formData.studentCpf || existingStudent?.cpf || '',
        birthDate: formData.studentBirthDate || existingStudent?.birthDate || '',
        address: {
          cep: formData.studentCep || existingStudent?.address.cep || '',
          street: formData.studentStreet || existingStudent?.address.street || '',
          number: formData.studentNumber || existingStudent?.address.number || '',
          complement: formData.studentComplement || existingStudent?.address.complement || '',
          neighborhood: formData.studentNeighborhood || existingStudent?.address.neighborhood || '',
          city: formData.studentCity || existingStudent?.address.city || '',
          state: formData.studentState || existingStudent?.address.state || '',
        },
        academic: {
          course: coursesStr,
          class: formData.studentClass || existingStudent?.academic.class || '',
          enrollmentDate: formData.date,
          status: existingStudent?.academic.status || 'active',
          defaultPaymentMode: formData.paymentMode,
        },
        observation: existingStudent?.observation || formData.observation,
      };
      await storage.saveStudent(student);
      await loadStudents();

      // Cria automaticamente a certificação quando a venda tem previsão de conclusão
      if (sale.previsaoConclusao) {
        try {
          await ensureCertificacaoDaVenda({
            saleId: sale.id,
            alunoId: student.id,
            nome: sale.studentName,
            email: student.email,
            telefone: student.phone,
            cpf: student.cpf,
            curso: sale.course,
            nivelEnsino: sale.courseLevels?.[0] || null,
            vendedorId: sale.vendedorId,
            dataSolicitacao: sale.date,
            previsaoConclusao: sale.previsaoConclusao,
          });
        } catch (e) {
          console.error('Erro ao criar certificação automática:', e);
        }
      }
      
      await loadSales();
      await loadAllInstallments();
      resetForm();
      setIsDialogOpen(false);
      toast.success(editingSale ? 'Venda atualizada!' : 'Venda registrada!');
    } catch (error) {
      console.error('Erro ao salvar venda:', error);
      toast.error('Erro ao salvar venda. Tente novamente.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleLockEnrollment = (sale: Sale) => {
    setLockSale(sale);
    setIsLockDialogOpen(true);
  };

  const saleHasLockedInstallments = (saleId: string) => {
    return allInstallments.some(i => i.saleId === saleId && i.status === 'locked');
  };

  const handleToggleBoletoGerado = async (sale: Sale) => {
    try {
      const newValue = !sale.boletoGerado;
      const { error } = await supabase
        .from('sales')
        .update({ boleto_gerado: newValue })
        .eq('id', sale.id);
      if (error) throw error;
      setSales(prev => prev.map(s => s.id === sale.id ? { ...s, boletoGerado: newValue } : s));
      toast.success(newValue ? 'Boletos marcados como gerados' : 'Marcação de boletos removida');
    } catch (error) {
      toast.error('Erro ao atualizar status dos boletos');
    }
  };

  const handleToggleNfEmitida = async (sale: Sale) => {
    try {
      const newValue = !sale.nfEmitida;
      const nowIso = newValue ? new Date().toISOString() : null;
      const { error } = await supabase
        .from('sales')
        .update({ nf_emitida: newValue, nf_emitida_at: nowIso } as any)
        .eq('id', sale.id);
      if (error) throw error;
      setSales(prev => prev.map(s => s.id === sale.id ? { ...s, nfEmitida: newValue, nfEmitidaAt: nowIso || undefined } : s));
      toast.success(newValue ? 'NF marcada como emitida' : 'Marcação de NF removida');
    } catch (error) {
      toast.error('Erro ao atualizar status da NF');
    }
  };

  const handleEdit = (sale: Sale) => {
    setEditingSale(sale);
    // Look for existing receipt(s) attached to any installment of this sale
    const instWithReceipt = allInstallments.find(i => i.saleId === sale.id && i.receipt);
    const existingPaths = instWithReceipt?.receipt
      ? instWithReceipt.receipt.split('\n').filter(Boolean)
      : [];
    setExistingReceiptPaths(existingPaths);
    setComprovanteFiles([]);
    const existingStudent = students.find(s => s.fullName.toLowerCase() === sale.studentName.toLowerCase());
    
    // Parse courses back into product lines
    const courseNames = sale.course.split(' | ').filter(Boolean);
    const savedValues = sale.courseValues || [];
    const saleTotal = sale.tipoBoleto === 'repasse' && sale.valorTotalBoleto
      ? sale.valorTotalBoleto
      : sale.amount;
    const savedLevels = sale.courseLevels || [];
    const editProducts: ProductLine[] = courseNames.map((courseName, idx) => {
      const savedLevel = savedLevels[idx];
      const cursoObj = savedLevel
        ? cursos.find(c => c.nome === courseName && c.nivel_ensino === savedLevel)
        : cursos.find(c => c.nome === courseName);
      const valor = savedValues[idx] != null
        ? savedValues[idx]
        : (courseNames.length > 0 ? saleTotal / courseNames.length : 0);
      return {
        nivelEnsino: savedLevel || cursoObj?.nivel_ensino || '',
        course: courseName,
        valor: valor > 0 ? valor.toFixed(2) : '',
        courseComboboxOpen: false,
      };
    });
    if (editProducts.length === 0) editProducts.push(createEmptyProduct());
    setProducts(editProducts);

    setFormData({
      studentName: sale.studentName,
      paymentMode: sale.paymentMode,
      date: sale.date,
      vendedorId: sale.vendedorId || '',
      observation: sale.observation || '',
      origemLead: sale.origemLead || '',
      campanhaId: sale.campanhaId || '',
      duracaoValor: sale.duracaoCursoValor ? String(sale.duracaoCursoValor) : '',
      duracaoUnidade: sale.duracaoCursoUnidade || 'meses',
      enableInstallments: sale.installments?.enabled || false,
      downPayment: sale.installments?.downPayment?.toString() || '',
      downPaymentDueDate: getLocalDateString(),
      downPaymentCountsInOriginal: sale.installments?.downPaymentCountsInOriginal ?? true,
      downPaymentCountsInCompany: sale.installments?.downPaymentCountsInCompany ?? true,
      numberOfInstallments: sale.installments?.numberOfInstallments.toString() || '1',
      firstDueDate: sale.installments?.firstDueDate || getLocalDateString(),
      tipoBoleto: sale.tipoBoleto || 'proprio',
      grupoRepasseId: sale.grupoRepasseId || '',
      valorTotalBoleto: sale.valorTotalBoleto?.toString() || '',
      studentEmail: existingStudent?.email || '',
      studentPhone: existingStudent?.phone || '',
      studentCpf: existingStudent?.cpf || '',
      studentBirthDate: existingStudent?.birthDate || '',
      studentCep: existingStudent?.address.cep || '',
      studentStreet: existingStudent?.address.street || '',
      studentNumber: existingStudent?.address.number || '',
      studentComplement: existingStudent?.address.complement || '',
      studentNeighborhood: existingStudent?.address.neighborhood || '',
      studentCity: existingStudent?.address.city || '',
      studentState: existingStudent?.address.state || '',
      studentClass: existingStudent?.academic.class || '',
    });
    setIsDialogOpen(true);
  };

  const handleDelete = (sale: Sale) => {
    setDeletingSale(sale);
    setIsDeleteDialogOpen(true);
  };

  const handleRevertCancel = async (sale: Sale) => {
    if (!isAdmin) return;
    if (!confirm(`Reverter o cancelamento da venda de ${sale.studentName}?\n\nA venda voltará ao status "ativa". Parcelas estornadas e parcelas em aberto removidas no cancelamento NÃO serão restauradas automaticamente — use "Recalcular Parcelas" se necessário.`)) return;
    try {
      const { error } = await supabase
        .from('sales')
        .update({ status: 'ativa' })
        .eq('id', sale.id);
      if (error) throw error;
      toast.success('Cancelamento revertido. Venda reativada.');
      await loadSales();
      await loadAllInstallments();
    } catch (err) {
      console.error('Erro ao reverter cancelamento:', err);
      toast.error('Erro ao reverter cancelamento.');
    }
  };

  const resetForm = () => {
    setFormData({
      studentName: '',
      paymentMode: '',
      date: getLocalDateString(),
      vendedorId: '',
      observation: '',
      origemLead: '',
      campanhaId: '',
      duracaoValor: '',
      duracaoUnidade: 'meses',
      enableInstallments: false,
      downPayment: '',
      downPaymentDueDate: getLocalDateString(),
      downPaymentCountsInOriginal: true,
      downPaymentCountsInCompany: true,
      numberOfInstallments: '1',
      firstDueDate: getLocalDateString(),
      tipoBoleto: 'proprio',
      grupoRepasseId: '',
      valorTotalBoleto: '',
      studentEmail: '',
      studentPhone: '',
      studentCpf: '',
      studentBirthDate: '',
      studentCep: '',
      studentStreet: '',
      studentNumber: '',
      studentComplement: '',
      studentNeighborhood: '',
      studentCity: '',
      studentState: '',
      studentClass: '',
    });
    setProducts([createEmptyProduct()]);
    setCourseComboboxOpen(false);
    setStudentDataOpen(false);
    setStudentAddressOpen(false);
    setComprovanteFiles([]);
    setExistingReceiptPaths([]);
    setEditingSale(null);
  };

  const handleVendedorQuickAddSuccess = (vendedorId: string, vendedorNome: string) => {
    setVendedores([...vendedores, { id: vendedorId, nome: vendedorNome, ativo: true }]);
    setFormData({ ...formData, vendedorId });
  };

  const filteredSales = useMemo(() => {
    return sales.filter((sale) => {
      // Search filter
      const matchesSearch =
        sale.studentName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        sale.course.toLowerCase().includes(searchTerm.toLowerCase());

      // Date filter
      let matchesDate = true;
      if (filterDataInicio || filterDataFim) {
        const saleDate = parseLocalDateString(sale.date);
        saleDate.setHours(0, 0, 0, 0);

        if (filterDataInicio) {
          const startDate = new Date(filterDataInicio);
          startDate.setHours(0, 0, 0, 0);
          if (saleDate < startDate) matchesDate = false;
        }

        if (filterDataFim) {
          const endDate = new Date(filterDataFim);
          endDate.setHours(23, 59, 59, 999);
          if (saleDate > endDate) matchesDate = false;
        }
      }

      // Vendor filter
      const matchesVendor =
        !filterVendedorId || filterVendedorId === 'all' || sale.vendedorId === filterVendedorId;

      return matchesSearch && matchesDate && matchesVendor;
    });
  }, [sales, searchTerm, filterDataInicio, filterDataFim, filterVendedorId]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const handleClearFilters = () => {
    setFilterDataInicio(undefined);
    setFilterDataFim(undefined);
    setFilterVendedorId('');
  };

  // Calculate total from installments (same source as financial module) to avoid divergence
  // For canceled sales, only sum paid installments; for active sales, sum all installments
  const computeSaleTotal = (sale: Sale): number => {
    const saleInstallments = allInstallments.filter(inst => inst.saleId === sale.id);
    if (sale.status === 'cancelada') {
      // Only sum paid installments for canceled sales
      return saleInstallments
        .filter(inst => inst.status === 'paid')
        .reduce((acc, inst) => acc + (inst.paidAmount || inst.value), 0);
    }
    // For active sales, sum all installments (paid use paidAmount, others use value, skip refunded)
    return saleInstallments.reduce((acc, inst) => {
      if (inst.status === 'refunded') return acc;
      if (inst.status === 'paid') {
        return acc + (inst.paidAmount || inst.value);
      }
      return acc + inst.value;
    }, 0);
  };

  const totalSales = useMemo(() => {
    return filteredSales.reduce((sum, sale) => sum + computeSaleTotal(sale), 0);
  }, [filteredSales, allInstallments]);

  // Summary of sales with NF emitida, respecting the current filters
  const nfEmitidaStats = useMemo(() => {
    const nfSales = filteredSales.filter(sale => sale.nfEmitida);
    return {
      count: nfSales.length,
      total: nfSales.reduce((sum, sale) => sum + computeSaleTotal(sale), 0),
    };
  }, [filteredSales, allInstallments]);
  const valorEmpresaCalculado = calcularValorEmpresa();

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex justify-between items-start gap-3">
          <PageHeader
            title="Vendas & Matrículas"
            subtitle="Gerencie todas as vendas de matrículas"
            className="mb-0"
          />
          <Dialog open={isDialogOpen} onOpenChange={(open) => {
            setIsDialogOpen(open);
            if (!open) resetForm();
          }}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="w-4 h-4" />
                Nova Venda
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingSale ? 'Editar Venda' : 'Registrar Nova Venda'}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <Label htmlFor="studentName">Nome do Aluno *</Label>
                    <div className="relative">
                      <Input
                        id="studentName"
                        value={formData.studentName}
                        onChange={(e) => setFormData({ ...formData, studentName: e.target.value })}
                        onBlur={(e) => fillStudentData(e.target.value)}
                        placeholder="Digite o nome completo"
                        list="students-list"
                      />
                      <datalist id="students-list">
                        {students.map((student) => (
                          <option key={student.id} value={student.fullName} />
                        ))}
                      </datalist>
                    </div>
                  </div>
                  {/* === Produtos (Cursos) === */}
                  <div className="col-span-2 space-y-3">
                    <Label className="text-sm font-semibold">Produtos (Cursos) *</Label>
                    {products.map((product, idx) => (
                      <div key={idx} className="border rounded-lg p-3 bg-muted/20 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium text-muted-foreground">Produto {idx + 1}</span>
                          {products.length > 1 && (
                            <Button aria-label="Remover produto"
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                              onClick={() => setProducts(products.filter((_, i) => i !== idx))}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                        <div className="grid grid-cols-3 gap-3">
                          <div>
                            <Label className="text-xs">Nível de Ensino *</Label>
                            <Select
                              value={product.nivelEnsino}
                              onValueChange={(value) => {
                                const updated = [...products];
                                updated[idx] = { ...updated[idx], nivelEnsino: value, course: '' };
                                setProducts(updated);
                              }}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Selecione..." />
                              </SelectTrigger>
                              <SelectContent>
                                {Array.from(new Set(cursos.map(c => c.nivel_ensino).filter(Boolean) as string[])).sort().map((nivel) => (
                                  <SelectItem key={nivel} value={nivel}>{nivel}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label className="text-xs">Curso *</Label>
                            <Popover
                              open={product.courseComboboxOpen}
                              onOpenChange={(open) => {
                                const updated = [...products];
                                updated[idx] = { ...updated[idx], courseComboboxOpen: open };
                                setProducts(updated);
                              }}
                            >
                              <PopoverTrigger asChild>
                                <Button
                                  variant="outline"
                                  role="combobox"
                                  className="w-full justify-between text-xs h-10"
                                  disabled={!product.nivelEnsino}
                                >
                                  <span className="truncate">{product.course || (product.nivelEnsino ? "Selecione..." : "Nível primeiro")}</span>
                                  <ChevronsUpDown className="ml-1 h-3 w-3 shrink-0 opacity-50" />
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-[350px] p-0" onWheel={(e) => e.stopPropagation()}>
                                <Command>
                                  <CommandInput placeholder="Pesquisar curso..." />
                                  <CommandList className="max-h-[250px] overflow-y-auto overscroll-contain">
                                    <CommandEmpty>Nenhum curso encontrado.</CommandEmpty>
                                    <CommandGroup>
                                      {cursos
                                        .filter(c => c.nivel_ensino === product.nivelEnsino)
                                        .map(c => c.nome)
                                        .sort()
                                        .map((course) => (
                                        <CommandItem
                                          key={course}
                                          value={course}
                                          onSelect={(currentValue) => {
                                            const updated = [...products];
                                            updated[idx] = {
                                              ...updated[idx],
                                              course: currentValue === product.course.toLowerCase() ? "" : course,
                                              courseComboboxOpen: false,
                                            };
                                            setProducts(updated);
                                          }}
                                        >
                                          <Check
                                            className={cn(
                                              "mr-2 h-4 w-4",
                                              product.course === course ? "opacity-100" : "opacity-0"
                                            )}
                                          />
                                          {course}
                                        </CommandItem>
                                      ))}
                                    </CommandGroup>
                                  </CommandList>
                                </Command>
                              </PopoverContent>
                            </Popover>
                          </div>
                          <div>
                            <Label className="text-xs">Valor (R$) *</Label>
                            <Input
                              type="number"
                              step="0.01"
                              value={product.valor}
                              onChange={(e) => {
                                const updated = [...products];
                                updated[idx] = { ...updated[idx], valor: e.target.value };
                                setProducts(updated);
                              }}
                              placeholder="0,00"
                              disabled={!!editingSale}
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="gap-1"
                      onClick={() => setProducts([...products, createEmptyProduct()])}
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Adicionar Produto
                    </Button>
                  </div>

                  <div>
                    <Label htmlFor="paymentMode">Modo de Pagamento *</Label>
                    <Select value={formData.paymentMode} onValueChange={(value) => {
                      setFormData({ 
                        ...formData, 
                        paymentMode: value,
                        enableInstallments: value === 'Boleto' || value.toLowerCase().includes('parcelado'),
                        tipoBoleto: 'proprio',
                        grupoRepasseId: '',
                        valorTotalBoleto: '',
                      });
                    }}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        {PAYMENT_MODES.map((mode) => (
                          <SelectItem key={mode} value={mode}>
                            {mode}
                          </SelectItem>
                        ))}
                        <SelectItem value="Parcelado">Parcelado</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Valor Total (read-only, sum of products) - only when not repasse */}
                  {!(formData.paymentMode === 'Boleto' && formData.tipoBoleto === 'repasse') && (
                    <div>
                      <Label htmlFor="valorTotal">Valor Total (R$)</Label>
                      <Input
                        id="valorTotal"
                        type="text"
                        value={totalProdutos > 0 ? formatCurrency(totalProdutos) : 'R$ 0,00'}
                        disabled
                        className="bg-muted font-semibold"
                      />
                    </div>
                  )}

                  {/* Seção de Boleto com Repasse */}
                  {formData.paymentMode === 'Boleto' && (
                    <div className="col-span-2 border rounded-lg p-4 bg-muted/30">
                      <div className="flex items-center gap-2 mb-4">
                        <ArrowRightLeft className="w-4 h-4 text-primary" />
                        <Label className="text-sm font-semibold">Tipo de Boleto</Label>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Info className="w-4 h-4 text-muted-foreground cursor-help" />
                          </TooltipTrigger>
                          <TooltipContent className="max-w-xs">
                            <p>
                              <strong>Boleto Próprio:</strong> Valor total entra como receita.<br />
                              <strong>Boleto com Repasse:</strong> Apenas a porcentagem da empresa entra como receita.
                            </p>
                          </TooltipContent>
                        </Tooltip>
                      </div>
                      <RadioGroup
                        value={formData.tipoBoleto}
                        onValueChange={(value: 'proprio' | 'repasse') => {
                          setFormData({ 
                            ...formData, 
                            tipoBoleto: value,
                            grupoRepasseId: '',
                            valorTotalBoleto: '',
                          });
                        }}
                        className="flex gap-4"
                      >
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="proprio" id="proprio" />
                          <Label htmlFor="proprio" className="cursor-pointer">Boleto Próprio</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="repasse" id="repasse" />
                          <Label htmlFor="repasse" className="cursor-pointer">Boleto com Repasse</Label>
                        </div>
                      </RadioGroup>

                      {formData.tipoBoleto === 'repasse' && (
                        <div className="mt-4 space-y-4">
                          <div>
                            <div className="flex items-center justify-between mb-2">
                              <Label htmlFor="grupoRepasse">Grupo de Repasse *</Label>
                              <Button aria-label="Cadastrar grupo de repasse"
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-6 w-6 p-0"
                                onClick={() => setIsGrupoRepasseQuickAddOpen(true)}
                              >
                                <Plus className="h-4 w-4" />
                              </Button>
                            </div>
                            <Select 
                              value={formData.grupoRepasseId} 
                              onValueChange={(value) => setFormData({ ...formData, grupoRepasseId: value })}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Selecione o grupo de repasse" />
                              </SelectTrigger>
                              <SelectContent>
                                {gruposRepasse.map((grupo) => (
                                  <SelectItem key={grupo.id} value={grupo.id}>
                                    {grupo.nome} ({grupo.porcentagem_empresa}%)
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label htmlFor="valorTotalBoleto">Valor Total do Boleto (R$) *</Label>
                            <Input
                              id="valorTotalBoleto"
                              type="number"
                              step="0.01"
                              value={formData.valorTotalBoleto}
                              onChange={(e) => setFormData({ ...formData, valorTotalBoleto: e.target.value })}
                              placeholder="0,00"
                              disabled={!!editingSale}
                            />
                          </div>
                          {getSelectedGrupoPorcentagem() !== null && (
                            <div className="bg-primary/10 border border-primary/20 rounded-lg p-3">
                              <p className="text-sm text-muted-foreground">
                                Porcentagem da empresa: <strong>{getSelectedGrupoPorcentagem()}%</strong>
                              </p>
                              {valorEmpresaCalculado !== null && (
                                <p className="text-lg font-bold text-primary mt-1">
                                  Valor para a empresa: {formatCurrency(valorEmpresaCalculado)}
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                  <div>
                    <Label htmlFor="date">Data da Venda</Label>
                    <Input
                      id="date"
                      type="date"
                      value={formData.date}
                      onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="vendedor">Vendedor *</Label>
                    <div className="flex gap-2">
                      <Select 
                        value={formData.vendedorId} 
                        onValueChange={(value) => setFormData({ ...formData, vendedorId: value })}
                      >
                        <SelectTrigger className="flex-1">
                          <SelectValue placeholder="Selecione o vendedor" />
                        </SelectTrigger>
                        <SelectContent>
                          {vendedores.map((vendedor) => (
                            <SelectItem key={vendedor.id} value={vendedor.id}>
                              {vendedor.nome}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  
                  {/* Installment Fields */}
                  {formData.enableInstallments && (
                    <>
                      <div className="col-span-2">
                        <div className="border-t pt-4 mt-2">
                          <h4 className="font-semibold mb-4">Configuração de Parcelamento</h4>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="downPayment">Entrada (R$)</Label>
                        <Input
                          id="downPayment"
                          type="number"
                          step="0.01"
                          value={formData.downPayment}
                          onChange={(e) => setFormData({ ...formData, downPayment: e.target.value })}
                          placeholder="0,00"
                          disabled={!!editingSale}
                        />
                        {formData.downPayment && parseFloat(formData.downPayment) > 0 && formData.tipoBoleto === 'repasse' && (
                          <div className="mt-2 space-y-2">
                            <div className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                id="downPaymentCountsInOriginal"
                                checked={formData.downPaymentCountsInOriginal}
                                onChange={(e) => setFormData({ ...formData, downPaymentCountsInOriginal: e.target.checked })}
                                className="h-4 w-4 rounded border-input bg-background text-primary focus:ring-primary"
                                disabled={!!editingSale}
                              />
                              <Label htmlFor="downPaymentCountsInOriginal" className="text-sm font-normal cursor-pointer">
                                Contabilizar entrada no Valor Original
                              </Label>
                            </div>
                          </div>
                        )}
                        {formData.downPayment && parseFloat(formData.downPayment) > 0 && formData.tipoBoleto !== 'repasse' && (
                          <div className="flex items-center gap-2 mt-2">
                            <input
                              type="checkbox"
                              id="downPaymentCountsInOriginal2"
                              checked={formData.downPaymentCountsInOriginal}
                              onChange={(e) => setFormData({ ...formData, downPaymentCountsInOriginal: e.target.checked })}
                              className="h-4 w-4 rounded border-input bg-background text-primary focus:ring-primary"
                              disabled={!!editingSale}
                            />
                            <Label htmlFor="downPaymentCountsInOriginal2" className="text-sm font-normal cursor-pointer">
                              Contabilizar entrada no valor total
                            </Label>
                          </div>
                        )}
                      </div>
                      {formData.downPayment && parseFloat(formData.downPayment) > 0 && (
                        <div className="space-y-2">
                          <Label htmlFor="downPaymentDueDate">Vencimento da Entrada *</Label>
                          <Input
                            id="downPaymentDueDate"
                            type="date"
                            value={formData.downPaymentDueDate}
                            onChange={(e) => {
                              if (!e.target.value) {
                                setFormData({ ...formData, downPaymentDueDate: '' });
                                return;
                              }
                              const selected = new Date(e.target.value + 'T12:00:00');
                              const maxDate = new Date();
                              maxDate.setDate(maxDate.getDate() + 30);
                              if (selected > maxDate) {
                                toast.error('A data de vencimento da entrada não pode exceder 30 dias a partir de hoje');
                                return;
                              }
                              // Recalcula automaticamente a 1ª parcela para 30 dias após o vencimento da entrada (editável)
                              const firstParcel = new Date(selected);
                              firstParcel.setDate(firstParcel.getDate() + 30);
                              const firstParcelStr = `${firstParcel.getFullYear()}-${String(firstParcel.getMonth() + 1).padStart(2, '0')}-${String(firstParcel.getDate()).padStart(2, '0')}`;
                              setFormData({ ...formData, downPaymentDueDate: e.target.value, firstDueDate: firstParcelStr });
                            }}
                            max={(() => {
                              const d = new Date();
                              d.setDate(d.getDate() + 30);
                              return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
                            })()}
                            disabled={!!editingSale}
                          />
                          <p className="text-xs text-muted-foreground">Máximo: 30 dias a partir de hoje</p>
                        </div>
                      )}
                      <div>
                        <Label htmlFor="numberOfInstallments">Número de Parcelas *</Label>
                        <Select 
                          value={formData.numberOfInstallments} 
                          onValueChange={(value) => setFormData({ ...formData, numberOfInstallments: value })}
                          disabled={!!editingSale}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione" />
                          </SelectTrigger>
                          <SelectContent>
                            {Array.from({ length: 24 }, (_, i) => i + 1).map((num) => (
                              <SelectItem key={num} value={num.toString()}>
                                {num}x
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label htmlFor="firstDueDate">1ª Parcela - Vencimento *</Label>
                        <Input
                          id="firstDueDate"
                          type="date"
                          value={formData.firstDueDate}
                          onChange={(e) => setFormData({ ...formData, firstDueDate: e.target.value })}
                          disabled={!!editingSale}
                        />
                      </div>
                      <div>
                        <Label>Valor de Cada Parcela</Label>
                        {formData.tipoBoleto === 'repasse' && valorEmpresaCalculado ? (() => {
                          const valorTotal = parseFloat(formData.valorTotalBoleto || '0');
                          const entrada = parseFloat(formData.downPayment || '0');
                          const numParcelas = parseInt(formData.numberOfInstallments || '1');
                          const grupo = gruposRepasse.find(g => g.id === formData.grupoRepasseId);
                          const porcentagem = grupo?.porcentagem_empresa || 0;
                          
                          // Valor original a parcelar (com ou sem entrada)
                          const valorOriginalParcelar = formData.downPaymentCountsInOriginal ? valorTotal - entrada : valorTotal;
                          const parcelaOriginal = valorOriginalParcelar / numParcelas;
                          
                          // Valor empresa por parcela = porcentagem aplicada sobre o valor de cada parcela original
                          const parcelaEmpresa = parcelaOriginal * (porcentagem / 100);
                          
                          return (
                            <div className="mt-2 space-y-2">
                              <div className="p-2 bg-muted/50 rounded text-sm">
                                <p>Valor Total: {formatCurrency(valorTotal)}</p>
                                {entrada > 0 && <p>Entrada: {formatCurrency(entrada)}</p>}
                                <p>Restante a parcelar: {formatCurrency(valorOriginalParcelar)}</p>
                                <p>Valor total da empresa ({porcentagem}%): {formatCurrency(valorOriginalParcelar * (porcentagem / 100))}</p>
                              </div>
                              <p className="text-muted-foreground">
                                Valor a parcelar: <span className="font-semibold">{formatCurrency(parcelaOriginal)}</span>
                              </p>
                              <p className="text-lg font-semibold text-primary">
                                Valor Empresa ({porcentagem}%): {formatCurrency(parcelaEmpresa)}
                              </p>
                            </div>
                          );
                        })() : (
                          <p className="text-lg font-semibold text-primary mt-2">
                            {(() => {
                              const valorTotal = totalProdutos;
                              const entrada = parseFloat(formData.downPayment || '0');
                              const numParcelas = parseInt(formData.numberOfInstallments || '1');
                              const valorParcelar = formData.downPaymentCountsInOriginal ? valorTotal - entrada : valorTotal;
                              return formatCurrency(valorParcelar / numParcelas);
                            })()}
                          </p>
                        )}
                      </div>
                    </>
                  )}

                  {/* Recalculate and Change Log - only in edit mode, before student data */}
                  {editingSale && (
                    <div className="col-span-2 space-y-4">
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full gap-2"
                        onClick={() => {
                          setRecalcSale(editingSale);
                          setIsRecalcOpen(true);
                        }}
                      >
                        <Calculator className="w-4 h-4" />
                        Recalcular Parcelas/Valores
                      </Button>
                      <SaleChangeLog saleId={editingSale.id} />
                    </div>
                  )}

                  {/* Origem do Lead */}
                  <div className="col-span-2">
                    <Label>Origem do Lead <span className="text-destructive">*</span></Label>
                    <Select
                      value={formData.origemLead}
                      onValueChange={(value) => setFormData({ ...formData, origemLead: value, campanhaId: value === 'Tráfego Pago' ? formData.campanhaId : '' })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione a origem do lead" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Indicação Externa">Indicação Externa</SelectItem>
                        <SelectItem value="Indicação Interna">Indicação Interna</SelectItem>
                        <SelectItem value="Indicação LA">Indicação LA</SelectItem>
                        <SelectItem value="Orgânico">Orgânico</SelectItem>
                        <SelectItem value="Tráfego Pago">Tráfego Pago</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Campanha de Tráfego Pago */}
                  {formData.origemLead === 'Tráfego Pago' && (
                    <div className="col-span-2">
                      <Label>Campanha <span className="text-destructive">*</span></Label>
                      <Select
                        value={formData.campanhaId}
                        onValueChange={(value) => setFormData({ ...formData, campanhaId: value })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione a campanha" />
                        </SelectTrigger>
                        <SelectContent>
                          {campanhas.map((c) => (
                            <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {/* Duração do curso */}
                  <div className="col-span-2 grid grid-cols-3 gap-2 items-end">
                    <div>
                      <Label>Duração do curso</Label>
                      <Input
                        type="number"
                        min="1"
                        placeholder="Ex.: 12"
                        value={formData.duracaoValor}
                        onChange={(e) => setFormData({ ...formData, duracaoValor: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label>Unidade</Label>
                      <Select
                        value={formData.duracaoUnidade}
                        onValueChange={(value) => setFormData({ ...formData, duracaoUnidade: value })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="dias">Dias</SelectItem>
                          <SelectItem value="meses">Meses</SelectItem>
                          <SelectItem value="anos">Anos</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="text-sm text-muted-foreground pb-2">
                      {calcPrevisaoConclusao(formData.date, formData.duracaoValor, formData.duracaoUnidade)
                        ? `Previsão de conclusão: ${formatBR(calcPrevisaoConclusao(formData.date, formData.duracaoValor, formData.duracaoUnidade)!)}`
                        : 'Informe a duração para calcular a previsão de conclusão'}
                    </div>
                  </div>

                  {/* Comprovante de Pagamento */}
                  <div className="col-span-2 border rounded-lg p-4 bg-muted/30">
                    <div className="flex items-center gap-2 mb-3">
                      <Paperclip className="w-4 h-4 text-primary" />
                      <Label className="text-sm font-semibold">
                        Comprovante de Pagamento
                        {!isBoletoOrParcelado(formData.paymentMode, formData.enableInstallments) && formData.paymentMode && (
                          <span className="text-destructive ml-1">*</span>
                        )}
                      </Label>
                      {isBoletoOrParcelado(formData.paymentMode, formData.enableInstallments) && (
                        <Badge variant="outline" className="text-xs">Opcional</Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mb-3">
                      {isBoletoOrParcelado(formData.paymentMode, formData.enableInstallments)
                        ? 'Anexe um ou mais comprovantes da entrada, se houver.'
                        : 'Obrigatório. Você pode anexar mais de um comprovante para somar o valor total da venda.'}
                    </p>

                    {/* Existing receipts (when editing) */}
                    {existingReceiptPaths.length > 0 && (
                      <div className="space-y-2 mb-2">
                        {existingReceiptPaths.map((path, idx) => (
                          <div key={path} className="flex items-center gap-3 p-3 bg-background rounded-md border">
                            <Paperclip className="w-4 h-4 text-success" />
                            <span className="text-sm flex-1 text-[#07714E] font-medium">
                              Comprovante {idx + 1} já anexado
                            </span>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={async () => {
                                try {
                                  const { data } = await supabase.storage.from('comprovantes').createSignedUrl(path, 3600);
                                  if (data?.signedUrl) window.open(data.signedUrl, '_blank');
                                  else toast.error('Erro ao abrir comprovante');
                                } catch {
                                  toast.error('Erro ao abrir comprovante');
                                }
                              }}
                            >
                              Visualizar
                            </Button>
                            <Button aria-label="Remover este comprovante"
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                              onClick={() => setExistingReceiptPaths(existingReceiptPaths.filter((_, i) => i !== idx))}
                              title="Remover este comprovante"
                            >
                              <X className="w-4 h-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Newly selected files (not yet uploaded) */}
                    {comprovanteFiles.length > 0 && (
                      <div className="space-y-2 mb-2">
                        {comprovanteFiles.map((file, idx) => (
                          <div key={`${file.name}-${idx}`} className="flex items-center gap-3 p-3 bg-background rounded-md border">
                            <Paperclip className="w-4 h-4 text-muted-foreground" />
                            <span className="text-sm truncate flex-1">{file.name}</span>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0"
                              onClick={() => setComprovanteFiles(comprovanteFiles.filter((_, i) => i !== idx))}
                            >
                              <X className="w-4 h-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}

                    <Input
                      type="file"
                      accept="image/*,.pdf"
                      multiple
                      onChange={(e) => {
                        const selected = Array.from(e.target.files || []);
                        if (selected.length === 0) return;
                        const valid: File[] = [];
                        for (const file of selected) {
                          if (file.size > 10 * 1024 * 1024) {
                            toast.error(`Arquivo "${file.name}" muito grande. Máximo 10MB.`);
                            continue;
                          }
                          valid.push(file);
                        }
                        if (valid.length > 0) setComprovanteFiles([...comprovanteFiles, ...valid]);
                        // reset input so the same file can be re-selected later
                        e.target.value = '';
                      }}
                    />
                    <p className="text-xs text-muted-foreground mt-2">
                      Você pode anexar vários arquivos. Tamanho máximo: 10MB por arquivo.
                    </p>
                  </div>

                  {/* Dados do Aluno - Collapsible */}
                  <div className="col-span-2 border rounded-lg p-4 bg-muted/30">
                    <Collapsible open={studentDataOpen} onOpenChange={setStudentDataOpen}>
                      <CollapsibleTrigger asChild>
                        <Button
                          type="button"
                          variant="ghost"
                          className="w-full justify-between p-0 h-auto hover:bg-transparent"
                        >
                          <div className="flex items-center gap-2">
                            <User className="w-4 h-4 text-primary" />
                            <span className="font-medium">Dados do Aluno</span>
                            <span className="text-destructive">*</span>
                          </div>
                          {studentDataOpen ? (
                            <ChevronUp className="w-4 h-4" />
                          ) : (
                            <ChevronDown className="w-4 h-4" />
                          )}
                        </Button>
                      </CollapsibleTrigger>
                      <CollapsibleContent className="mt-4 space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label htmlFor="studentEmail">E-mail <span className="text-destructive">*</span></Label>
                            <Input
                              id="studentEmail"
                              type="email"
                              value={formData.studentEmail}
                              onChange={(e) => setFormData({ ...formData, studentEmail: e.target.value })}
                              placeholder="email@exemplo.com"
                              required
                            />
                          </div>
                          <div>
                            <Label htmlFor="studentPhone">Telefone <span className="text-destructive">*</span></Label>
                            <Input
                              id="studentPhone"
                              value={formData.studentPhone}
                              onChange={(e) => setFormData({ ...formData, studentPhone: e.target.value })}
                              placeholder="(00) 00000-0000"
                              required
                            />
                          </div>
                          <div>
                            <Label htmlFor="studentCpf">CPF <span className="text-destructive">*</span></Label>
                            <Input
                              id="studentCpf"
                              value={formData.studentCpf}
                              onChange={(e) => setFormData({ ...formData, studentCpf: e.target.value })}
                              placeholder="000.000.000-00"
                              required
                            />
                          </div>
                          <div>
                            <Label htmlFor="studentBirthDate">Data de Nascimento <span className="text-destructive">*</span></Label>
                            <Input
                              id="studentBirthDate"
                              type="date"
                              value={formData.studentBirthDate}
                              onChange={(e) => setFormData({ ...formData, studentBirthDate: e.target.value })}
                              required
                            />
                          </div>
                        </div>

                        {/* Endereço - Collapsible dentro de Dados do Aluno */}
                        <Collapsible open={studentAddressOpen} onOpenChange={setStudentAddressOpen}>
                          <CollapsibleTrigger asChild>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="w-full justify-between"
                            >
                              <span>Endereço <span className="text-destructive">*</span></span>
                              {studentAddressOpen ? (
                                <ChevronUp className="w-4 h-4" />
                              ) : (
                                <ChevronDown className="w-4 h-4" />
                              )}
                            </Button>
                          </CollapsibleTrigger>
                          <CollapsibleContent className="mt-4">
                            <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
                              <div>
                                <Label htmlFor="studentCep">CEP <span className="text-destructive">*</span></Label>
                                <Input
                                  id="studentCep"
                                  value={formData.studentCep}
                                  onChange={(e) => setFormData({ ...formData, studentCep: e.target.value })}
                                  placeholder="00000-000"
                                />
                              </div>
                              <div className="col-span-2">
                                <Label htmlFor="studentStreet">Rua/Avenida <span className="text-destructive">*</span></Label>
                                <Input
                                  id="studentStreet"
                                  value={formData.studentStreet}
                                  onChange={(e) => setFormData({ ...formData, studentStreet: e.target.value })}
                                />
                              </div>
                              <div>
                                <Label htmlFor="studentNumber">Número <span className="text-destructive">*</span></Label>
                                <Input
                                  id="studentNumber"
                                  value={formData.studentNumber}
                                  onChange={(e) => setFormData({ ...formData, studentNumber: e.target.value })}
                                />
                              </div>
                              <div className="col-span-2">
                                <Label htmlFor="studentNeighborhood">Bairro <span className="text-destructive">*</span></Label>
                                <Input
                                  id="studentNeighborhood"
                                  value={formData.studentNeighborhood}
                                  onChange={(e) => setFormData({ ...formData, studentNeighborhood: e.target.value })}
                                />
                              </div>
                              <div>
                                <Label htmlFor="studentCity">Cidade <span className="text-destructive">*</span></Label>
                                <Input
                                  id="studentCity"
                                  value={formData.studentCity}
                                  onChange={(e) => setFormData({ ...formData, studentCity: e.target.value })}
                                />
                              </div>
                              <div>
                                <Label htmlFor="studentState">Estado <span className="text-destructive">*</span></Label>
                                <Select 
                                  value={formData.studentState} 
                                  onValueChange={(value) => setFormData({ ...formData, studentState: value })}
                                >
                                  <SelectTrigger>
                                    <SelectValue placeholder="UF" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {BRAZILIAN_STATES.map((state) => (
                                      <SelectItem key={state} value={state}>
                                        {state}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="col-span-2">
                                <Label htmlFor="studentComplement">Complemento</Label>
                                <Input
                                  id="studentComplement"
                                  value={formData.studentComplement}
                                  onChange={(e) => setFormData({ ...formData, studentComplement: e.target.value })}
                                  placeholder="Apto, Bloco, etc."
                                />
                              </div>
                            </div>
                          </CollapsibleContent>
                        </Collapsible>
                      </CollapsibleContent>
                    </Collapsible>
                  </div>
                  
                  <div className="col-span-2">
                    <Label htmlFor="observation">Observação</Label>
                    <Textarea
                      id="observation"
                      value={formData.observation}
                      onChange={(e) => setFormData({ ...formData, observation: e.target.value })}
                      placeholder="Anotações adicionais..."
                      rows={3}
                    />
                  </div>

                </div>
                <div className="flex gap-2 justify-end">
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)} disabled={isSaving}>
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={isSaving}>
                    {isSaving ? 'Salvando...' : `${editingSale ? 'Atualizar' : 'Salvar'} Venda`}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>

          <VendedorQuickAdd
            open={isVendedorQuickAddOpen}
            onOpenChange={setIsVendedorQuickAddOpen}
            onSuccess={handleVendedorQuickAddSuccess}
          />
        </div>

        <div className="rounded-[14px] border border-ink-200 bg-white p-6 shadow-card">
          <div className="space-y-4 mb-6">
            <div className="flex gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                <Input
                  placeholder="Buscar por nome ou curso..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <DateVendorFilters
              dataInicio={filterDataInicio}
              setDataInicio={setFilterDataInicio}
              dataFim={filterDataFim}
              setDataFim={setFilterDataFim}
              vendedorId={filterVendedorId}
              setVendedorId={setFilterVendedorId}
              onClearFilters={handleClearFilters}
            />
          </div>

          <div className="overflow-x-auto rounded-[14px] border border-ink-200">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[200px]">Nome do Aluno</TableHead>
                  <TableHead className="min-w-[220px] max-w-[280px]">Curso</TableHead>
                  <TableHead className="min-w-[130px]">Pagamento</TableHead>
                  <TableHead className="min-w-[100px] text-right">Valor</TableHead>
                  <TableHead className="min-w-[60px] text-center">Qtd</TableHead>
                  <TableHead className="min-w-[110px] text-right">Total</TableHead>
                  <TableHead className="min-w-[160px]">Vendedor</TableHead>
                  <TableHead className="min-w-[100px] whitespace-nowrap">Data</TableHead>
                  <TableHead className="w-[96px] min-w-[96px] text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSales.map((sale) => (
                  <TableRow key={sale.id} className={cn(
                    sale.status === 'cancelada' && 'opacity-60 bg-muted/30',
                    sale.status !== 'cancelada' && sale.paymentMode === 'Boleto' && !sale.boletoGerado && 'bg-[#FFFBEA]',
                    sale.status !== 'cancelada' && sale.nfEmitida && 'bg-[#F0FAF4] border-l-4 border-l-success'
                  )}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <span className="truncate max-w-[220px] text-[14.5px] font-semibold text-ink-900" title={sale.studentName}>
                          {sale.studentName}
                        </span>
                        {sale.status === 'cancelada' && (
                          <Badge variant="destructive" className="text-xs">
                            CANCELADA
                          </Badge>
                        )}
                        {sale.nfEmitida && (
                          <Badge className="text-xs bg-success hover:bg-success text-white gap-1">
                            <FileText className="w-3 h-3" />
                            NF Emitida
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="min-w-[200px] max-w-[300px]">
                      <span className="block text-left break-words line-clamp-2 text-[13.5px] text-ink-600" title={sale.course}>{sale.course}</span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="bg-ink-100 text-ink-700 hover:bg-ink-100">{sale.paymentMode}</Badge>
                        {sale.tipoBoleto === 'repasse' && (
                          <Badge variant="outline" className="text-xs bg-[#FFF1E7] text-[#B44309] border-[#FFD3B0]">
                            Repasse
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {sale.tipoBoleto === 'repasse' && sale.valorTotalBoleto ? (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="cursor-help">
                              {formatCurrency(sale.amount)}{' '}
                              <span className="text-xs text-muted-foreground">
                                (de {formatCurrency(sale.valorTotalBoleto)})
                              </span>
                            </span>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Valor total do boleto: {formatCurrency(sale.valorTotalBoleto)}</p>
                            <p>Porcentagem aplicada: {sale.porcentagemAplicada}%</p>
                            <p>Valor para empresa: {formatCurrency(sale.amount)}</p>
                          </TooltipContent>
                        </Tooltip>
                      ) : (
                        formatCurrency(sale.amount)
                      )}
                    </TableCell>
                    <TableCell className="text-center tabular-nums">{sale.quantity}</TableCell>
                    <TableCell className="text-right font-bold tabular-nums text-ink-900">
                      {formatCurrency(sale.amount + (sale.tipoBoleto === 'repasse' && sale.installments?.downPayment ? sale.installments.downPayment : 0))}
                    </TableCell>
                    <TableCell className="min-w-[160px]">
                      <div className="flex items-center gap-2">
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-ink-950 text-[10px] font-bold text-brand">
                          {(sale.seller || '?').trim().charAt(0).toUpperCase()}
                        </span>
                        <span className="truncate max-w-[160px] text-[13.5px] text-ink-700" title={sale.seller}>{sale.seller}</span>
                      </div>
                    </TableCell>
                    <TableCell className="min-w-[100px] whitespace-nowrap text-[13.5px] tabular-nums text-ink-600">{parseLocalDateString(sale.date).toLocaleDateString('pt-BR')}</TableCell>
                    <TableCell className="w-[96px] min-w-[96px] text-right">
                      <div className="flex items-center gap-1 justify-end">
                        {sale.status !== 'cancelada' && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button size="icon" aria-label="Editar venda" variant="ghost" className="text-ink-500 hover:bg-ink-100 hover:text-ink-900" onClick={() => handleEdit(sale)}>
                                <Edit className="w-4 h-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Editar venda</TooltipContent>
                          </Tooltip>
                        )}
                        {(sale.status !== 'cancelada' || isAdmin) && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button size="icon" variant="ghost" aria-label="Mais ações" className="text-ink-500 hover:bg-ink-100 hover:text-ink-900">
                                <MoreVertical className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-64">
                              {sale.status !== 'cancelada' && (
                                <>
                                  {sale.paymentMode === 'Boleto' && (
                                    <DropdownMenuItem onClick={() => handleToggleBoletoGerado(sale)}>
                                      <Check className={cn('w-4 h-4 mr-2', sale.boletoGerado ? 'text-success' : 'text-ink-400')} />
                                      {sale.boletoGerado ? 'Desmarcar boletos gerados' : 'Marcar boletos como gerados'}
                                    </DropdownMenuItem>
                                  )}
                                  <DropdownMenuItem onClick={() => handleToggleNfEmitida(sale)}>
                                    <FileText className={cn('w-4 h-4 mr-2', sale.nfEmitida ? 'text-success' : 'text-ink-400')} />
                                    {sale.nfEmitida ? 'Desmarcar NF emitida' : 'Marcar NF como emitida'}
                                  </DropdownMenuItem>
                                  {saleHasLockedInstallments(sale.id) ? (
                                    <DropdownMenuItem onClick={() => { setUnlockSale(sale); setIsUnlockDialogOpen(true); }}>
                                      <Unlock className="w-4 h-4 mr-2 text-ink-500" />
                                      Destrancar matrícula
                                    </DropdownMenuItem>
                                  ) : (
                                    <DropdownMenuItem onClick={() => handleLockEnrollment(sale)}>
                                      <Lock className="w-4 h-4 mr-2 text-ink-500" />
                                      Trancar matrícula
                                    </DropdownMenuItem>
                                  )}
                                  {isAdmin && (
                                    <>
                                      <DropdownMenuSeparator />
                                      <DropdownMenuItem
                                        onClick={() => { setCancelingSale(sale); setIsCancelDialogOpen(true); }}
                                        className="text-warning focus:text-warning"
                                      >
                                        <Ban className="w-4 h-4 mr-2" />
                                        Cancelar venda
                                      </DropdownMenuItem>
                                    </>
                                  )}
                                </>
                              )}
                              {sale.status === 'cancelada' && isAdmin && (
                                <DropdownMenuItem onClick={() => handleRevertCancel(sale)}>
                                  <RotateCcw className="w-4 h-4 mr-2 text-ink-500" />
                                  Reverter cancelamento
                                </DropdownMenuItem>
                              )}
                              {isAdmin && (
                                <>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem onClick={() => handleDelete(sale)} className="text-destructive focus:text-destructive">
                                    <Trash2 className="w-4 h-4 mr-2" />
                                    Excluir venda
                                  </DropdownMenuItem>
                                </>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {filteredSales.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={9} className="py-12 text-center">
                      <div className="flex flex-col items-center gap-2">
                        <ShoppingCart className="h-8 w-8 text-ink-300" />
                        <span className="text-[14px] text-ink-500">Nenhuma venda encontrada</span>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          <div className="mt-4 flex justify-between items-center gap-4">
            <p className="text-sm text-muted-foreground">
              {(() => {
                const ativas = filteredSales.filter(s => s.status !== 'cancelada').length;
                const canceladas = filteredSales.filter(s => s.status === 'cancelada').length;
                const countText = canceladas > 0
                  ? `${filteredSales.length} venda(s) encontrada(s) (${ativas} ativa(s), ${canceladas} cancelada(s))`
                  : `${filteredSales.length} venda(s) encontrada(s)`;
                return `${countText} · NF Emitida: ${nfEmitidaStats.count} venda(s) · Faturamento NF: ${formatCurrency(nfEmitidaStats.total)}`;
              })()}
            </p>
            <p className="text-lg font-bold text-foreground whitespace-nowrap">
              Total: <span className="font-bold tabular-nums text-ink-950">{formatCurrency(totalSales)}</span>
            </p>
          </div>
        </div>
      </div>

      {/* Quick Add Dialogs */}
      <VendedorQuickAdd
        open={isVendedorQuickAddOpen}
        onOpenChange={setIsVendedorQuickAddOpen}
        onSuccess={(vendedorId, vendedorNome) => {
          setFormData({ ...formData, vendedorId });
          loadVendedores();
        }}
      />
      <CursoQuickAdd
        open={isCursoQuickAddOpen}
        onOpenChange={setIsCursoQuickAddOpen}
        onSuccess={(cursoNome) => {
          loadCursos();
        }}
      />
      <GrupoRepasseQuickAdd
        open={isGrupoRepasseQuickAddOpen}
        onOpenChange={setIsGrupoRepasseQuickAddOpen}
        onSuccess={(grupo) => {
          setGruposRepasse([...gruposRepasse, grupo]);
          setFormData({ ...formData, grupoRepasseId: grupo.id });
        }}
      />
      <CancelSaleDialog
        sale={cancelingSale}
        open={isCancelDialogOpen}
        onOpenChange={setIsCancelDialogOpen}
        onSuccess={() => {
          loadSales();
          loadAllInstallments();
          setCancelingSale(null);
        }}
      />
      <RecalculateInstallmentsDialog
        open={isRecalcOpen}
        onOpenChange={setIsRecalcOpen}
        saleId={recalcSale?.id || ''}
        saleAmount={recalcSale?.amount || 0}
        onSaved={async () => {
          await loadSales();
          await loadAllInstallments();
          // Refresh editingSale and products to reflect updated sale amount
          if (recalcSale) {
            const refreshedSales = await storage.getSales();
            const updated = refreshedSales.find(s => s.id === recalcSale.id);
            if (updated) {
              setEditingSale(updated);
              setRecalcSale(updated);
              // Update products to reflect new values
              const courseNames = updated.course.split(' | ').filter(Boolean);
              const savedValues = updated.courseValues || [];
              const saleTotal = updated.tipoBoleto === 'repasse' && updated.valorTotalBoleto
                ? updated.valorTotalBoleto
                : updated.amount;
              const savedLevels = updated.courseLevels || [];
              const editProducts = courseNames.map((courseName, idx) => {
                const savedLevel = savedLevels[idx];
                const cursoObj = savedLevel
                  ? cursos.find(c => c.nome === courseName && c.nivel_ensino === savedLevel)
                  : cursos.find(c => c.nome === courseName);
                const valor = savedValues[idx] != null
                  ? savedValues[idx]
                  : (courseNames.length > 0 ? saleTotal / courseNames.length : 0);
                return {
                  nivelEnsino: savedLevel || cursoObj?.nivel_ensino || '',
                  course: courseName,
                  valor: valor > 0 ? valor.toFixed(2) : '',
                  courseComboboxOpen: false,
                };
              });
              if (editProducts.length === 0) editProducts.push({ nivelEnsino: '', course: '', valor: '', courseComboboxOpen: false });
              setProducts(editProducts);
            }
          }
        }}
      />
      {unlockSale && (
        <UnlockEnrollmentDialog
          saleId={unlockSale.id}
          studentName={unlockSale.studentName}
          open={isUnlockDialogOpen}
          onOpenChange={setIsUnlockDialogOpen}
          onSuccess={() => {
            loadSales();
            loadAllInstallments();
            setUnlockSale(null);
          }}
        />
      )}
      {lockSale && (
        <LockEnrollmentDialog
          saleId={lockSale.id}
          studentName={lockSale.studentName}
          open={isLockDialogOpen}
          onOpenChange={setIsLockDialogOpen}
          onSuccess={() => {
            loadSales();
            loadAllInstallments();
            setLockSale(null);
          }}
        />
      )}
      <DeleteSaleDialog
        sale={deletingSale}
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
        onSuccess={() => {
          loadSales();
          loadAllInstallments();
          setDeletingSale(null);
        }}
      />
    </Layout>
  );
};

export default Sales;
