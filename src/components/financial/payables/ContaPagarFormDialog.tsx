import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { CalendarIcon, Plus, Trash2, Paperclip, FileText, X, ChevronsUpDown, Check, Repeat, AlertTriangle } from 'lucide-react';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { format, parseISO, addMonths, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { 
  Credor, 
  ContaPagar, 
  CATEGORIAS_CONTA, 
  FORMAS_PAGAMENTO, 
  RECORRENCIAS,
  RECORRENCIA_DB_TYPE,
  CategoriaContaPagar, 
  StatusContaPagar,
  Recorrencia
} from '@/lib/payables-types';
import {
  generateRecurrenceDates,
  buildRecurrenceSummary,
  UNIDADES_RECORRENCIA,
  MAX_RECURRENCE_ITEMS,
  NEVER_LOOKAHEAD,
  RecurrenceUnit,
  RecurrenceEndType,
} from '@/lib/recurrence';
import { saveContaPagar, updateContaPagar, updateRecurrenceFromHere } from '@/lib/payables-storage';
import { saveRecorrencia, gerarContasParaRecorrencia, buildCustomRecorrenciaKey } from '@/lib/recorrencias-storage';
import { getCategoriasPersonalizadas, CategoriaPersonalizada } from '@/lib/categorias-storage';
import { toast } from 'sonner';
import { Card } from '@/components/ui/card';
import CategoriaQuickAdd from './CategoriaQuickAdd';


interface Parcela {
  numero: number;
  valor: number;
  dataVencimento: Date;
}

interface ContaPagarFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conta?: ContaPagar | null;
  credores: Credor[];
  onSuccess: () => void;
}

const ContaPagarFormDialog = ({ open, onOpenChange, conta, credores, onSuccess }: ContaPagarFormDialogProps) => {
  const [credorId, setCredorId] = useState(conta?.credor_id || '');
  const [descricao, setDescricao] = useState(conta?.descricao || '');
  const [categoria, setCategoria] = useState<string>(conta?.categoria || 'comissao');
  const [valor, setValor] = useState(conta?.valor?.toString() || '');
  const [dataVencimento, setDataVencimento] = useState<Date | undefined>(
    conta?.data_vencimento ? parseISO(conta.data_vencimento) : undefined
  );
  const [status, setStatus] = useState<StatusContaPagar>(conta?.status || 'pendente');
  const [formaPagamento, setFormaPagamento] = useState(conta?.forma_pagamento || '');
  const [dataPagamento, setDataPagamento] = useState<Date | undefined>(
    conta?.data_pagamento ? parseISO(conta.data_pagamento) : undefined
  );
  const [observacoes, setObservacoes] = useState(conta?.observacoes || '');
  const [boletoUrl, setBoletoUrl] = useState(conta?.boleto_url || '');
  const [boletoFile, setBoletoFile] = useState<File | null>(null);
  const [uploadingBoleto, setUploadingBoleto] = useState(false);
  const [mesReferencia, setMesReferencia] = useState(conta?.mes_referencia || '');
  const [loading, setLoading] = useState(false);

  // Categorias personalizadas
  const [categoriasPersonalizadas, setCategoriasPersonalizadas] = useState<CategoriaPersonalizada[]>([]);

  // Recorrência
  const [recorrencia, setRecorrencia] = useState<Recorrencia>('nenhuma');

  // Recorrência personalizada
  const [customInterval, setCustomInterval] = useState('1');
  const [customUnit, setCustomUnit] = useState<RecurrenceUnit>('month');
  const [customEndType, setCustomEndType] = useState<RecurrenceEndType>('count');
  const [customCount, setCustomCount] = useState('12');
  const [customEndDate, setCustomEndDate] = useState<Date | undefined>();
  const [customErrors, setCustomErrors] = useState<Record<string, string>>({});

  // Escopo de edição de recorrência
  const [showScopeDialog, setShowScopeDialog] = useState(false);
  const [editScope, setEditScope] = useState<'one' | 'following'>('one');

  const isCustomRecorrencia = recorrencia === 'personalizada';

  const resetCustomRecorrencia = () => {
    setCustomInterval('1');
    setCustomUnit('month');
    setCustomEndType('count');
    setCustomCount('12');
    setCustomEndDate(undefined);
    setCustomErrors({});
  };

  const handleRecorrenciaChange = (v: Recorrencia) => {
    setRecorrencia(v);
    if (v !== 'personalizada') resetCustomRecorrencia();
  };

  const customPreview = useMemo(() => {
    if (!isCustomRecorrencia || !dataVencimento) return { dates: [] as Date[], truncated: false };
    const intervalNum = parseInt(customInterval);
    if (!intervalNum || intervalNum < 1) return { dates: [] as Date[], truncated: false };
    return generateRecurrenceDates({
      start: dataVencimento,
      interval: intervalNum,
      unit: customUnit,
      endType: customEndType,
      count: parseInt(customCount) || undefined,
      endDate: customEndDate,
    });
  }, [isCustomRecorrencia, dataVencimento, customInterval, customUnit, customEndType, customCount, customEndDate]);

  const customSummary = useMemo(() => {
    if (customPreview.dates.length === 0) return '';
    return buildRecurrenceSummary(
      {
        start: dataVencimento!,
        interval: parseInt(customInterval) || 1,
        unit: customUnit,
        endType: customEndType,
      },
      customPreview.dates
    );
  }, [customPreview, dataVencimento, customInterval, customUnit, customEndType]);

  const validateCustomRecorrencia = (): boolean => {
    const errors: Record<string, string> = {};
    const intervalNum = parseInt(customInterval);
    if (!intervalNum || intervalNum < 1) {
      errors.interval = 'Informe um intervalo válido (mínimo 1).';
    } else if (intervalNum > 365) {
      errors.interval = 'O intervalo máximo é 365.';
    }

    if (customEndType === 'count') {
      const countNum = parseInt(customCount);
      if (!countNum || countNum < 1) {
        errors.count = 'Informe a quantidade de repetições (mínimo 1).';
      } else if (countNum > 120) {
        errors.count = 'A quantidade máxima é 120 repetições.';
      }
    } else if (customEndType === 'date') {
      if (!customEndDate) {
        errors.endDate = 'Informe a data final da recorrência.';
      } else if (dataVencimento && customEndDate < dataVencimento) {
        errors.endDate = 'A data final não pode ser anterior ao vencimento inicial.';
      }
    }

    setCustomErrors(errors);
    return Object.keys(errors).length === 0;
  };


  // Parcelamento (para boleto e parcelado)
  const [numeroParcelas, setNumeroParcelas] = useState('1');
  const [parcelas, setParcelas] = useState<Parcela[]>([]);

  const isParcelado = formaPagamento === 'boleto' || formaPagamento === 'parcelado';
  const CATEGORIAS_COM_MES_REFERENCIA = ['comissao', 'salario', 'DARF', 'FGTS'];
  const showMesReferencia = CATEGORIAS_COM_MES_REFERENCIA.includes(categoria);

  // Build month/year options for reference month
  const mesReferenciaOptions = useMemo(() => {
    const options: { value: string; label: string }[] = [];
    const now = new Date();
    for (let i = 0; i < 24; i++) {
      const d = subMonths(now, i);
      const val = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = format(d, 'MMMM yyyy', { locale: ptBR });
      options.push({ value: val, label: label.charAt(0).toUpperCase() + label.slice(1) });
    }
    return options;
  }, []);

  const loadCategoriasPersonalizadas = useCallback(async () => {
    try {
      const data = await getCategoriasPersonalizadas();
      setCategoriasPersonalizadas(data);
    } catch (error) {
      console.error('Error loading categorias personalizadas:', error);
    }
  }, []);

  useEffect(() => {
    if (open) {
      loadCategoriasPersonalizadas();
    }
  }, [open, loadCategoriasPersonalizadas]);

  useEffect(() => {
    if (conta) {
      setCredorId(conta.credor_id);
      setDescricao(conta.descricao);
      setCategoria(conta.categoria);
      setValor(conta.valor.toString());
      setDataVencimento(conta.data_vencimento ? parseISO(conta.data_vencimento) : undefined);
      setStatus(conta.status);
      setFormaPagamento(conta.forma_pagamento || '');
      setDataPagamento(conta.data_pagamento ? parseISO(conta.data_pagamento) : undefined);
      setObservacoes(conta.observacoes || '');
      setBoletoUrl(conta.boleto_url || '');
      setBoletoFile(null);
      setMesReferencia(conta.mes_referencia || '');
      setRecorrencia('nenhuma');
      resetCustomRecorrencia();
      setEditScope('one');
      setNumeroParcelas('1');
      setParcelas([]);
    } else {
      resetForm();
    }
  }, [conta, open]);

  // Gerar parcelas quando mudar número de parcelas ou data
  useEffect(() => {
    if (isParcelado && dataVencimento && valor) {
      const numParcelas = parseInt(numeroParcelas) || 1;
      const valorTotal = parseFloat(valor) || 0;
      const valorParcela = valorTotal / numParcelas;

      const novasParcelas: Parcela[] = [];
      for (let i = 0; i < numParcelas; i++) {
        novasParcelas.push({
          numero: i + 1,
          valor: Math.round(valorParcela * 100) / 100,
          dataVencimento: addMonths(dataVencimento, i),
        });
      }
      setParcelas(novasParcelas);
    } else {
      setParcelas([]);
    }
  }, [isParcelado, numeroParcelas, dataVencimento, valor]);

  const uploadBoleto = async (): Promise<string | undefined> => {
    if (!boletoFile) return boletoUrl || undefined;
    setUploadingBoleto(true);
    try {
      const fileExt = boletoFile.name.split('.').pop();
      const fileName = `${crypto.randomUUID()}.${fileExt}`;
      const { error } = await supabase.storage
        .from('boletos')
        .upload(fileName, boletoFile);
      if (error) throw error;
      const { data: { publicUrl } } = supabase.storage
        .from('boletos')
        .getPublicUrl(fileName);
      // Since bucket is private, we store the path and generate signed URLs
      return fileName;
    } catch (error) {
      console.error('Error uploading boleto:', error);
      toast.error('Erro ao enviar boleto');
      return boletoUrl || undefined;
    } finally {
      setUploadingBoleto(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!credorId) {
      toast.error('Selecione um fornecedor/prestador');
      return;
    }
    if (!descricao.trim()) {
      toast.error('Descrição é obrigatória');
      return;
    }
    if (!valor || parseFloat(valor) <= 0) {
      toast.error('Valor deve ser maior que zero');
      return;
    }
    if (!dataVencimento && !isParcelado) {
      toast.error('Data de vencimento é obrigatória');
      return;
    }
    if (isParcelado && parcelas.length === 0) {
      toast.error('Configure as parcelas');
      return;
    }
    if (status === 'pago' && !dataPagamento) {
      toast.error('Data de pagamento é obrigatória quando status é Pago');
      return;
    }
    if (showMesReferencia && !mesReferencia) {
      toast.error('Mês de referência é obrigatório para esta categoria');
      return;
    }
    if (!conta && isCustomRecorrencia) {
      if (!validateCustomRecorrencia()) return;
      if (customPreview.dates.length === 0) {
        toast.error('Não foi possível gerar lançamentos com essa configuração');
        return;
      }
    }

    // Edição de um lançamento que faz parte de uma recorrência: perguntar escopo
    if (conta && conta.recurrence_group_id && conta.status !== 'pago') {
      setEditScope('one');
      setShowScopeDialog(true);
      return;
    }

    await performSave('one');
  };

  const performSave = async (scope: 'one' | 'following') => {
    setLoading(true);
    try {
      const uploadedBoletoPath = await uploadBoleto();
      
      if (conta) {
        // Edição
        const contaData = {
          credor_id: credorId,
          descricao,
          categoria,
          valor: parseFloat(valor),
          data_vencimento: format(dataVencimento!, 'yyyy-MM-dd'),
          status,
          forma_pagamento: formaPagamento || undefined,
          data_pagamento: dataPagamento ? format(dataPagamento, 'yyyy-MM-dd') : undefined,
          observacoes: observacoes || undefined,
          boleto_url: uploadedBoletoPath || undefined,
          mes_referencia: showMesReferencia && mesReferencia ? mesReferencia : null,
        };
        if (scope === 'following' && conta.recurrence_group_id) {
          const total = await updateRecurrenceFromHere(conta, contaData as any);
          toast.success(`${total} lançamento(s) da recorrência atualizado(s)!`);
        } else {
          await updateContaPagar(conta.id, contaData);
          toast.success('Conta atualizada com sucesso!');
        }

      } else {
        // Criação de contas (pode ser múltiplas se parcelado ou recorrente)
        if (isParcelado) {
          // Criar uma conta para cada parcela
          for (const parcela of parcelas) {
            const contaData = {
              credor_id: credorId,
              descricao: `${descricao} - Parcela ${parcela.numero}/${parcelas.length}`,
              categoria,
              valor: parcela.valor,
              data_vencimento: format(parcela.dataVencimento, 'yyyy-MM-dd'),
              status: 'pendente' as StatusContaPagar,
              forma_pagamento: formaPagamento || undefined,
              observacoes: observacoes || undefined,
              mes_referencia: showMesReferencia && mesReferencia ? mesReferencia : undefined,
            };
            await saveContaPagar(contaData);
          }
          toast.success(`${parcelas.length} parcelas cadastradas com sucesso!`);
        } else if (isCustomRecorrencia && customEndType === 'never') {
          // Recorrência personalizada sem término: gera gradativamente (apenas as próximas parcelas)
          const intervalNum = parseInt(customInterval) || 1;
          const novaRec = await saveRecorrencia({
            credor_id: credorId,
            descricao,
            categoria,
            valor: parseFloat(valor),
            forma_pagamento: formaPagamento || undefined,
            observacoes: observacoes || undefined,
            recorrencia: buildCustomRecorrenciaKey(intervalNum, customUnit),
            dia_vencimento: dataVencimento!.getDate(),
            proxima_geracao: format(dataVencimento!, 'yyyy-MM-dd'),
            ativo: true,
          });
          const geradas = await gerarContasParaRecorrencia(novaRec.id);
          toast.success(`Recorrência criada! ${geradas} parcela(s) lançada(s); as próximas serão geradas automaticamente.`);
        } else if (isCustomRecorrencia) {
          // Recorrência personalizada com término definido: gera todos os lançamentos
          const { data: { user } } = await supabase.auth.getUser();
          if (!user) throw new Error('Usuário não autenticado');

          const datas = customPreview.dates;
          const groupId = crypto.randomUUID();
          const total = datas.length;
          const intervalNum = parseInt(customInterval) || 1;
          const valorNum = parseFloat(valor);

          const rows = datas.map((dt, idx) => ({
            user_id: user.id,
            credor_id: credorId,
            descricao,
            categoria,
            valor: valorNum,
            data_vencimento: format(dt, 'yyyy-MM-dd'),
            status: 'pendente',
            forma_pagamento: formaPagamento || null,
            observacoes: observacoes || null,
            mes_referencia: showMesReferencia && mesReferencia ? mesReferencia : null,
            recurrence_type: RECORRENCIA_DB_TYPE.personalizada,
            recurrence_interval: intervalNum,
            recurrence_unit: customUnit,
            recurrence_end_type: customEndType,
            recurrence_count: customEndType === 'count' ? total : null,
            recurrence_end_date: customEndType === 'date' && customEndDate
              ? format(customEndDate, 'yyyy-MM-dd')
              : null,
            recurrence_group_id: groupId,
            installment_number: idx + 1,
            installment_total: total,
          }));

          const { error } = await supabase.from('contas_pagar').insert(rows as any);
          if (error) throw error;

          if (customPreview.truncated) {
            toast.warning(`A recorrência foi truncada em ${MAX_RECURRENCE_ITEMS} lançamentos.`);
          }
          toast.success(`${total} lançamento(s) criado(s) com recorrência personalizada!`);
        } else if (recorrencia !== 'nenhuma') {

          // Criar as 3 primeiras parcelas imediatamente + configuração de recorrência
          const dia = dataVencimento!.getDate();
          const valorNum = parseFloat(valor);
          const primeiraData = dataVencimento!;

          const INTERVALOS: Record<string, number> = {
            mensal: 1, trimestral: 3, semestral: 6, anual: 12,
          };
          const intervalo = INTERVALOS[recorrencia] || 1;

          const datasParaGerar = [
            primeiraData,
            addMonths(primeiraData, intervalo),
            addMonths(primeiraData, intervalo * 2),
          ];
          const proximaGeracao = addMonths(primeiraData, intervalo * 3);

          // Buscar user para inserção direta
          const { data: { user } } = await supabase.auth.getUser();
          if (!user) throw new Error('Usuário não autenticado');

          // Gerar as 3 parcelas
          let count = 0;
          for (const dt of datasParaGerar) {
            const dataVenc = format(dt, 'yyyy-MM-dd');
            const descGerada = `${descricao} - ${format(dt, 'MMM/yy', { locale: ptBR })}`;

            const { error } = await supabase
              .from('contas_pagar')
              .insert({
                user_id: user.id,
                credor_id: credorId,
                descricao: descGerada,
                categoria,
                valor: valorNum,
                data_vencimento: dataVenc,
                status: 'pendente',
                forma_pagamento: formaPagamento || null,
                mes_referencia: showMesReferencia ? format(subMonths(dt, 1), 'yyyy-MM') : null,
                observacoes: observacoes ? `Recorrência automática. ${observacoes}` : 'Recorrência automática.',
              });

            if (error) {
              console.error('Erro ao inserir parcela recorrente:', JSON.stringify(error));
            } else {
              count++;
            }
          }

          // Salvar configuração de recorrência para geração futura
          await saveRecorrencia({
            credor_id: credorId,
            descricao,
            categoria,
            valor: valorNum,
            forma_pagamento: formaPagamento || undefined,
            observacoes: observacoes || undefined,
            recorrencia,
            dia_vencimento: dia,
            proxima_geracao: format(proximaGeracao, 'yyyy-MM-dd'),
            ativo: true,
          });
          toast.success(`Recorrência cadastrada com ${count} parcela(s) gerada(s)!`);
        } else {
          // Conta única
          const contaData = {
            credor_id: credorId,
            descricao,
            categoria,
            valor: parseFloat(valor),
            data_vencimento: format(dataVencimento!, 'yyyy-MM-dd'),
            status,
            forma_pagamento: formaPagamento || undefined,
            data_pagamento: dataPagamento ? format(dataPagamento, 'yyyy-MM-dd') : undefined,
            observacoes: observacoes || undefined,
            boleto_url: uploadedBoletoPath || undefined,
            mes_referencia: showMesReferencia && mesReferencia ? mesReferencia : undefined,
          };
          await saveContaPagar(contaData);
          toast.success('Conta cadastrada com sucesso!');
        }
      }
      onSuccess();
      onOpenChange(false);
      resetForm();
    } catch (error) {
      console.error('Error saving conta:', error);
      toast.error('Erro ao salvar conta');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setCredorId('');
    setDescricao('');
    setCategoria('comissao');
    setValor('');
    setDataVencimento(undefined);
    setStatus('pendente');
    setFormaPagamento('');
    setDataPagamento(undefined);
    setObservacoes('');
    setRecorrencia('nenhuma');
    resetCustomRecorrencia();
    setNumeroParcelas('1');
    setParcelas([]);
    setBoletoUrl('');
    setBoletoFile(null);
    setMesReferencia('');
  };

  const updateParcelaData = (index: number, novaData: Date) => {
    const novasParcelas = [...parcelas];
    novasParcelas[index].dataVencimento = novaData;
    setParcelas(novasParcelas);
  };

  const updateParcelaValor = (index: number, novoValor: string) => {
    const novasParcelas = [...parcelas];
    novasParcelas[index].valor = parseFloat(novoValor) || 0;
    setParcelas(novasParcelas);
  };

  const credoresAtivos = credores.filter(c => c.status === 'ativo');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{conta ? 'Editar Conta a Pagar' : 'Registrar Conta a Pagar'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="credor">Fornecedor/Prestador *</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  className={cn(
                    "w-full justify-between font-normal",
                    !credorId && "text-muted-foreground"
                  )}
                >
                  {credorId
                    ? (() => {
                        const selected = credoresAtivos.find(c => c.id === credorId);
                        return selected ? `${selected.nome} (${selected.tipo})` : 'Selecione um fornecedor/prestador';
                      })()
                    : 'Selecione um fornecedor/prestador'}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                <Command>
                  <CommandInput placeholder="Buscar fornecedor..." />
                  <CommandList>
                    <CommandEmpty>Nenhum fornecedor encontrado.</CommandEmpty>
                    <CommandGroup>
                      {credoresAtivos.map((c) => (
                        <CommandItem
                          key={c.id}
                          value={`${c.nome} (${c.tipo})`}
                          onSelect={() => setCredorId(c.id)}
                        >
                          <Check className={cn("mr-2 h-4 w-4", credorId === c.id ? "opacity-100" : "opacity-0")} />
                          {c.nome} ({c.tipo})
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-2">
            <Label htmlFor="descricao">Descrição *</Label>
            <Input
              id="descricao"
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Ex: Comissão Nov/24, Vale, etc."
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="categoria">Categoria</Label>
              <Select value={categoria} onValueChange={(v) => setCategoria(v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIAS_CONTA.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                  {categoriasPersonalizadas.map((c) => (
                    <SelectItem key={c.id} value={c.nome}>
                      {c.nome}
                    </SelectItem>
                  ))}
                  <div className="border-t mt-1 pt-1">
                    <CategoriaQuickAdd onSuccess={loadCategoriasPersonalizadas} />
                  </div>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="valor">Valor Total (R$) *</Label>
              <Input
                id="valor"
                type="number"
                step="0.01"
                min="0.01"
                value={valor}
                onChange={(e) => setValor(e.target.value)}
                placeholder="0,00"
                required
              />
            </div>
          </div>

          {/* Mês de Referência - for Comissão/Salário */}
          {showMesReferencia && (
            <div className="space-y-2">
              <Label>Mês de Referência</Label>
              <Select value={mesReferencia} onValueChange={setMesReferencia}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o mês trabalhado" />
                </SelectTrigger>
                <SelectContent>
                  {mesReferenciaOptions.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Mês a que se refere esta comissão/salário (mês trabalhado)</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="formaPagamento">Forma de Pagamento</Label>
              <Select value={formaPagamento} onValueChange={setFormaPagamento}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {FORMAS_PAGAMENTO.map((f) => (
                    <SelectItem key={f.value} value={f.value}>
                      {f.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {!isParcelado && !conta && (
              <div className="space-y-2">
                <Label htmlFor="recorrencia">Recorrência</Label>
                <Select value={recorrencia} onValueChange={(v) => handleRecorrenciaChange(v as Recorrencia)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {RECORRENCIAS.map((r) => (
                      <SelectItem key={r.value} value={r.value}>
                        {r.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          {/* Configuração de Recorrência Personalizada */}
          {isCustomRecorrencia && !isParcelado && !conta && (
            <Card className="p-4 space-y-4 bg-muted/30 animate-fade-in">
              <div className="flex items-center gap-2">
                <Repeat className="h-4 w-4 text-primary" />
                <h4 className="font-medium">Recorrência Personalizada</h4>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="customInterval">Repetir a cada *</Label>
                  <Input
                    id="customInterval"
                    type="number"
                    min="1"
                    max="365"
                    value={customInterval}
                    onChange={(e) => setCustomInterval(e.target.value)}
                  />
                  {customErrors.interval && (
                    <p className="text-xs text-destructive">{customErrors.interval}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>Unidade</Label>
                  <Select value={customUnit} onValueChange={(v) => setCustomUnit(v as RecurrenceUnit)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {UNIDADES_RECORRENCIA.map((u) => (
                        <SelectItem key={u.value} value={u.value}>
                          {u.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-3">
                <Label>Término da recorrência</Label>
                <RadioGroup
                  value={customEndType}
                  onValueChange={(v) => setCustomEndType(v as RecurrenceEndType)}
                  className="space-y-3"
                >
                  <div className="flex items-center gap-3">
                    <RadioGroupItem value="count" id="end-count" />
                    <Label htmlFor="end-count" className="font-normal cursor-pointer">Após</Label>
                    <Input
                      type="number"
                      min="1"
                      max="120"
                      value={customCount}
                      onChange={(e) => setCustomCount(e.target.value)}
                      onFocus={() => setCustomEndType('count')}
                      className="w-24 h-8"
                      disabled={customEndType !== 'count'}
                    />
                    <span className="text-sm text-muted-foreground">repetições</span>
                  </div>
                  {customErrors.count && (
                    <p className="text-xs text-destructive">{customErrors.count}</p>
                  )}

                  <div className="flex items-center gap-3">
                    <RadioGroupItem value="date" id="end-date" />
                    <Label htmlFor="end-date" className="font-normal cursor-pointer">Até a data</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={customEndType !== 'date'}
                          className={cn('h-8 font-normal', !customEndDate && 'text-muted-foreground')}
                        >
                          <CalendarIcon className="mr-2 h-3 w-3" />
                          {customEndDate ? format(customEndDate, 'dd/MM/yyyy', { locale: ptBR }) : 'Selecione'}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={customEndDate}
                          onSelect={setCustomEndDate}
                          disabled={(date) => (dataVencimento ? date < dataVencimento : false)}
                          initialFocus
                          className={cn('p-3 pointer-events-auto')}
                          locale={ptBR}
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                  {customErrors.endDate && (
                    <p className="text-xs text-destructive">{customErrors.endDate}</p>
                  )}

                  <div className="flex items-start gap-3">
                    <RadioGroupItem value="never" id="end-never" className="mt-1" />
                    <div>
                      <Label htmlFor="end-never" className="font-normal cursor-pointer">
                        Nunca encerrar (interromper manualmente)
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        Apenas as próximas {NEVER_LOOKAHEAD} parcelas são lançadas; as demais são geradas automaticamente conforme se aproximam. Para parar, pause ou exclua a recorrência na aba "Recorrências".
                      </p>
                    </div>
                  </div>
                </RadioGroup>
              </div>

              {!dataVencimento && (
                <p className="text-xs text-muted-foreground">
                  Informe a data de vencimento para visualizar os lançamentos gerados.
                </p>
              )}

              {customSummary && (
                <p className="text-sm font-medium text-foreground">{customSummary}</p>
              )}

              {customPreview.truncated && (
                <div className="flex items-start gap-2 text-xs text-warning">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  <span>
                    O limite é de {MAX_RECURRENCE_ITEMS} lançamentos por recorrência. A geração será truncada.
                  </span>
                </div>
              )}

              {customPreview.dates.length > 0 && (
                <div className="space-y-1">
                  <Label className="text-xs">Pré-visualização</Label>
                  <div className="flex flex-wrap gap-2">
                    {customPreview.dates.slice(0, 5).map((d, i) => (
                      <span key={i} className="text-xs px-2 py-1 rounded border bg-background">
                        {i + 1}. {format(d, 'dd/MM/yyyy', { locale: ptBR })}
                      </span>
                    ))}
                  </div>
                  {customPreview.dates.length > 5 && (
                    <p className="text-xs text-muted-foreground">
                      e mais {customPreview.dates.length - 5} lançamentos
                    </p>
                  )}
                </div>
              )}
            </Card>
          )}


          {/* Configuração de Parcelamento (boleto ou parcelado) */}
          {isParcelado && !conta && (
            <Card className="p-4 space-y-4 bg-muted/30">
              <div className="flex items-center gap-2">
                <h4 className="font-medium">
                  Configuração de {formaPagamento === 'boleto' ? 'Boletos' : 'Parcelas'}
                </h4>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Número de Parcelas</Label>
                  <Input
                    type="number"
                    min="1"
                    max="48"
                    value={numeroParcelas}
                    onChange={(e) => setNumeroParcelas(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Data da 1ª Parcela *</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          'w-full justify-start text-left font-normal',
                          !dataVencimento && 'text-muted-foreground'
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {dataVencimento ? format(dataVencimento, 'dd/MM/yyyy', { locale: ptBR }) : 'Selecione'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={dataVencimento}
                        onSelect={setDataVencimento}
                        initialFocus
                        className={cn("p-3 pointer-events-auto")}
                        locale={ptBR}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              {parcelas.length > 0 && (
                <div className="space-y-2">
                  <Label>Parcelas Geradas</Label>
                  <div className="max-h-[200px] overflow-y-auto space-y-2">
                    {parcelas.map((parcela, index) => (
                      <div key={index} className="flex items-center gap-2 p-2 bg-background rounded border">
                        <span className="text-sm font-medium w-16">
                          {parcela.numero}/{parcelas.length}
                        </span>
                        <Input
                          type="number"
                          step="0.01"
                          value={parcela.valor}
                          onChange={(e) => updateParcelaValor(index, e.target.value)}
                          className="w-28 h-8"
                        />
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button variant="outline" size="sm" className="h-8">
                              <CalendarIcon className="h-3 w-3 mr-1" />
                              {format(parcela.dataVencimento, 'dd/MM/yy', { locale: ptBR })}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="single"
                              selected={parcela.dataVencimento}
                              onSelect={(date) => date && updateParcelaData(index, date)}
                              initialFocus
                              className={cn("p-3 pointer-events-auto")}
                              locale={ptBR}
                            />
                          </PopoverContent>
                        </Popover>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Total: R$ {parcelas.reduce((sum, p) => sum + p.valor, 0).toFixed(2)}
                  </p>
                </div>
              )}
            </Card>
          )}

          {/* Data de vencimento para conta simples */}
          {!isParcelado && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Data de Vencimento *</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        'w-full justify-start text-left font-normal',
                        !dataVencimento && 'text-muted-foreground'
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {dataVencimento ? format(dataVencimento, 'dd/MM/yyyy', { locale: ptBR }) : 'Selecione'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={dataVencimento}
                      onSelect={setDataVencimento}
                      initialFocus
                      className={cn("p-3 pointer-events-auto")}
                      locale={ptBR}
                    />
                  </PopoverContent>
                </Popover>
              </div>

              {conta && (
                <div className="space-y-2">
                  <Label htmlFor="status">Status</Label>
                  <Select value={status} onValueChange={(v) => setStatus(v as StatusContaPagar)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pendente">Pendente</SelectItem>
                      <SelectItem value="pago">Pago</SelectItem>
                      <SelectItem value="atrasado">Atrasado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          )}

          {/* Data de pagamento só aparece em edição ou se status for pago */}
          {conta && status === 'pago' && (
            <div className="space-y-2">
              <Label>Data de Pagamento</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      'w-full justify-start text-left font-normal',
                      !dataPagamento && 'text-muted-foreground'
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dataPagamento ? format(dataPagamento, 'dd/MM/yyyy', { locale: ptBR }) : 'Selecione'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={dataPagamento}
                    onSelect={setDataPagamento}
                    initialFocus
                    className={cn("p-3 pointer-events-auto")}
                    locale={ptBR}
                  />
                </PopoverContent>
              </Popover>
            </div>
          )}

          {/* Anexo de Boleto */}
          <div className="space-y-2">
            <Label>Anexar Boleto</Label>
            {(boletoUrl && !boletoFile) ? (
              <div className="flex items-center gap-2 p-2 bg-muted/30 rounded border">
                <FileText className="h-4 w-4 text-primary" />
                <span className="text-sm truncate flex-1">Boleto anexado</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon" aria-label="Remover anexo"
                  className="h-6 w-6"
                  onClick={() => setBoletoUrl('')}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            ) : boletoFile ? (
              <div className="flex items-center gap-2 p-2 bg-muted/30 rounded border">
                <FileText className="h-4 w-4 text-primary" />
                <span className="text-sm truncate flex-1">{boletoFile.name}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon" aria-label="Remover anexo"
                  className="h-6 w-6"
                  onClick={() => setBoletoFile(null)}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            ) : (
              <div>
                <label
                  htmlFor="boleto-upload"
                  className="flex items-center gap-2 cursor-pointer p-2 border border-dashed rounded hover:bg-muted/30 transition-colors"
                >
                  <Paperclip className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Clique para anexar boleto (PDF, imagem)</span>
                </label>
                <input
                  id="boleto-upload"
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg,.webp"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      if (file.size > 10 * 1024 * 1024) {
                        toast.error('Arquivo muito grande (máx. 10MB)');
                        return;
                      }
                      setBoletoFile(file);
                    }
                  }}
                />
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="observacoes">Observações</Label>
            <Textarea
              id="observacoes"
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              placeholder="Observações adicionais..."
              rows={2}
            />
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading
                ? 'Salvando...'
                : isParcelado && !conta
                  ? `Criar ${parcelas.length} Parcela(s)`
                  : isCustomRecorrencia && !conta && customPreview.dates.length > 0
                    ? `Criar ${customPreview.dates.length} Lançamento(s)`
                    : 'Salvar Conta'}
            </Button>
          </div>
        </form>

        {/* Escopo de edição para lançamentos recorrentes */}
        <AlertDialog open={showScopeDialog} onOpenChange={setShowScopeDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Editar lançamento recorrente</AlertDialogTitle>
              <AlertDialogDescription>
                Este lançamento faz parte de uma recorrência. Como deseja aplicar as alterações?
                Lançamentos já pagos não serão alterados.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <RadioGroup
              value={editScope}
              onValueChange={(v) => setEditScope(v as 'one' | 'following')}
              className="space-y-3 py-2"
            >
              <div className="flex items-center gap-3">
                <RadioGroupItem value="one" id="scope-one" />
                <Label htmlFor="scope-one" className="font-normal cursor-pointer">
                  Aplicar somente a este lançamento
                </Label>
              </div>
              <div className="flex items-center gap-3">
                <RadioGroupItem value="following" id="scope-following" />
                <Label htmlFor="scope-following" className="font-normal cursor-pointer">
                  Aplicar a este e aos próximos lançamentos
                </Label>
              </div>
            </RadioGroup>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={async (e) => {
                  e.preventDefault();
                  setShowScopeDialog(false);
                  await performSave(editScope);
                }}
              >
                Confirmar
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </DialogContent>
    </Dialog>
  );

};

export default ContaPagarFormDialog;