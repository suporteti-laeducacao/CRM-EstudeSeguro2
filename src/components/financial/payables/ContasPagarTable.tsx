import { useState, useEffect, useMemo, useCallback } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { CalendarIcon, CheckCircle, Edit, Eye, Plus, Search, Trash2, X, FileText, MoreVertical, Undo2 } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { format, parseISO, isToday, isBefore, addDays, startOfDay, startOfMonth, endOfMonth, subMonths, startOfWeek, endOfWeek, subWeeks } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { Credor, ContaPagar, CATEGORIAS_CONTA } from '@/lib/payables-types';
import { getCategoriasPersonalizadas, CategoriaPersonalizada } from '@/lib/categorias-storage';
import { deleteContaPagar, deleteRecurrenceFromHere, reverterPagamento } from '@/lib/payables-storage';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
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
import ContaPagarFormDialog from './ContaPagarFormDialog';
import ConfirmPaymentDialog from './ConfirmPaymentDialog';

interface ContasPagarTableProps {
  contasPagar: ContaPagar[];
  credores: Credor[];
  onUpdate: () => void;
}

const ContasPagarTable = ({ contasPagar, credores, onUpdate }: ContasPagarTableProps) => {
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingConta, setEditingConta] = useState<ContaPagar | null>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [contaToDelete, setContaToDelete] = useState<ContaPagar | null>(null);
  const [deleteScope, setDeleteScope] = useState<'one' | 'following'>('one');
  const [payingConta, setPayingConta] = useState<ContaPagar | null>(null);
  const [viewingConta, setViewingConta] = useState<ContaPagar | null>(null);
  const [contaToRevert, setContaToRevert] = useState<ContaPagar | null>(null);
  const [reverting, setReverting] = useState(false);

  const handleRevert = async () => {
    if (!contaToRevert) return;
    setReverting(true);
    try {
      await reverterPagamento(contaToRevert);
      toast.success('Pagamento revertido. A conta voltou para pendente.');
      setContaToRevert(null);
      onUpdate();
    } catch (err) {
      console.error(err);
      toast.error('Não foi possível reverter o pagamento.');
    } finally {
      setReverting(false);
    }
  };

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCredorId, setFilterCredorId] = useState('all');
  const [filterCategoria, setFilterCategoria] = useState('all');
  const [filterPendente, setFilterPendente] = useState(true);
  const [filterPago, setFilterPago] = useState(false);
  const [filterAtrasado, setFilterAtrasado] = useState(true);
  const [filterDataInicio, setFilterDataInicio] = useState<Date | undefined>();
  const [filterDataFim, setFilterDataFim] = useState<Date | undefined>();
  const [filterDateField, setFilterDateField] = useState<'vencimento' | 'pagamento'>('vencimento');
  const [sortBy, setSortBy] = useState<'vencimento' | 'pagamento'>('vencimento');
  const [periodoRapido, setPeriodoRapido] = useState('');
  const [categoriasPersonalizadas, setCategoriasPersonalizadas] = useState<CategoriaPersonalizada[]>([]);

  const loadCategorias = useCallback(async () => {
    try {
      const data = await getCategoriasPersonalizadas();
      setCategoriasPersonalizadas(data);
    } catch (error) {
      console.error('Error loading categorias:', error);
    }
  }, []);

  useEffect(() => {
    loadCategorias();
  }, [loadCategorias]);

  const handlePeriodoRapido = (periodo: string) => {
    setPeriodoRapido(periodo);
    const hoje = new Date();
    switch (periodo) {
      case 'semana_atual':
        setFilterDataInicio(startOfWeek(hoje, { weekStartsOn: 0 }));
        setFilterDataFim(endOfWeek(hoje, { weekStartsOn: 0 }));
        break;
      case 'semana_passada':
        setFilterDataInicio(startOfWeek(subWeeks(hoje, 1), { weekStartsOn: 0 }));
        setFilterDataFim(endOfWeek(subWeeks(hoje, 1), { weekStartsOn: 0 }));
        break;
      case 'mes_atual':
        setFilterDataInicio(startOfMonth(hoje));
        setFilterDataFim(endOfMonth(hoje));
        break;
      case 'mes_passado':
        setFilterDataInicio(startOfMonth(subMonths(hoje, 1)));
        setFilterDataFim(endOfMonth(subMonths(hoje, 1)));
        break;
      case 'ultimos_3_meses':
        setFilterDataInicio(startOfMonth(subMonths(hoje, 2)));
        setFilterDataFim(endOfMonth(hoje));
        break;
      case 'ultimos_6_meses':
        setFilterDataInicio(startOfMonth(subMonths(hoje, 5)));
        setFilterDataFim(endOfMonth(hoje));
        break;
      default:
        setFilterDataInicio(undefined);
        setFilterDataFim(undefined);
    }
  };

  const getCredorNome = (credorId: string) => {
    return credores.find(c => c.id === credorId)?.nome || '-';
  };

  const getCategoriaLabel = (categoria: string) => {
    return CATEGORIAS_CONTA.find(c => c.value === categoria)?.label || categoria;
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  // Calculate real status based on date
  const getRealStatus = (conta: ContaPagar): 'pago' | 'pendente' | 'atrasado' => {
    if (conta.status === 'pago') return 'pago';
    const hoje = startOfDay(new Date());
    const vencimento = parseISO(conta.data_vencimento);
    if (isBefore(vencimento, hoje)) return 'atrasado';
    return 'pendente';
  };

  const hasPartialPayment = (conta: ContaPagar): boolean => {
    return (conta.valor_pago ?? 0) > 0 && conta.status !== 'pago';
  };

  const getStatusBadge = (conta: ContaPagar) => {
    const status = getRealStatus(conta);
    const hoje = startOfDay(new Date());
    const vencimento = parseISO(conta.data_vencimento);
    const em3Dias = addDays(hoje, 3);
    const isPartial = hasPartialPayment(conta);

    switch (status) {
      case 'pago':
        return <Badge className="bg-[#E7F7F0] text-[#07714E] border-transparent">✓ Pago</Badge>;
      case 'atrasado':
        return (
          <div className="flex flex-col gap-1">
            <Badge className="bg-[#FDECEC] text-[#B02121] border-transparent">Atrasado</Badge>
            {isPartial && <Badge className="bg-[#FFF1E7] text-[#B44309] border-transparent text-xs">Pagto Parcial</Badge>}
          </div>
        );
      case 'pendente':
        if (isToday(vencimento)) {
          return (
            <div className="flex flex-col gap-1">
              <Badge className="bg-[#FFF1E7] text-[#B44309] border-transparent">Vence Hoje</Badge>
              {isPartial && <Badge className="bg-[#FFF1E7] text-[#B44309] border-transparent text-xs">Pagto Parcial</Badge>}
            </div>
          );
        }
        if (vencimento <= em3Dias) {
          return (
            <div className="flex flex-col gap-1">
              <Badge className="bg-[#FFF1E7] text-[#B44309] border-transparent">Pendente</Badge>
              {isPartial && <Badge className="bg-[#FFF1E7] text-[#B44309] border-transparent text-xs">Pagto Parcial</Badge>}
            </div>
          );
        }
        return (
          <div className="flex flex-col gap-1">
            <Badge className="bg-[#E7F7F0] text-[#07714E] border-transparent">Pendente</Badge>
            {isPartial && <Badge className="bg-[#FFF1E7] text-[#B44309] border-transparent text-xs">Pagto Parcial</Badge>}
          </div>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const filteredContas = useMemo(() => {
    const result = contasPagar.filter(conta => {
      // Search filter
      if (searchTerm) {
        const credorNome = getCredorNome(conta.credor_id).toLowerCase();
        const descricao = conta.descricao.toLowerCase();
        const search = searchTerm.toLowerCase();
        if (!credorNome.includes(search) && !descricao.includes(search)) {
          return false;
        }
      }

      // Credor filter
      if (filterCredorId !== 'all' && conta.credor_id !== filterCredorId) {
        return false;
      }

      // Categoria filter
      if (filterCategoria !== 'all' && conta.categoria !== filterCategoria) {
        return false;
      }

      // Status filter
      const realStatus = getRealStatus(conta);
      if (!filterPendente && realStatus === 'pendente') return false;
      if (!filterPago && realStatus === 'pago') return false;
      if (!filterAtrasado && realStatus === 'atrasado') return false;

      // Date filter
      const dateValue = filterDateField === 'vencimento' ? conta.data_vencimento : conta.data_pagamento;
      if (dateValue) {
        const date = parseISO(dateValue);
        if (filterDataInicio && date < filterDataInicio) return false;
        if (filterDataFim && date > filterDataFim) return false;
      } else if (filterDateField === 'pagamento' && (filterDataInicio || filterDataFim)) {
        // When filtering by payment date, skip accounts without payment date
        return false;
      }

      return true;
    });

    // Sort
    return result.sort((a, b) => {
      const fieldA = sortBy === 'vencimento' ? a.data_vencimento : (a.data_pagamento || a.data_vencimento);
      const fieldB = sortBy === 'vencimento' ? b.data_vencimento : (b.data_pagamento || b.data_vencimento);
      return new Date(fieldA).getTime() - new Date(fieldB).getTime();
    });
  }, [contasPagar, searchTerm, filterCredorId, filterCategoria, filterPendente, filterPago, filterAtrasado, filterDataInicio, filterDataFim, filterDateField, sortBy]);

  const handleClearFilters = () => {
    setSearchTerm('');
    setFilterCredorId('all');
    setFilterCategoria('all');
    setFilterPendente(true);
    setFilterPago(true);
    setFilterAtrasado(true);
    setFilterDataInicio(undefined);
    setFilterDataFim(undefined);
    setFilterDateField('vencimento');
    setSortBy('vencimento');
    setPeriodoRapido('');
  };

  const handleDelete = async () => {
    if (!contaToDelete) return;

    try {
      if (contaToDelete.recurrence_group_id && deleteScope === 'following') {
        const total = await deleteRecurrenceFromHere(contaToDelete);
        toast.success(`${total} lançamento(s) da recorrência excluído(s)!`);
      } else {
        await deleteContaPagar(contaToDelete.id);
        toast.success('Conta excluída com sucesso!');
      }
      onUpdate();
    } catch (error) {
      console.error('Error deleting conta:', error);
      toast.error('Erro ao excluir conta');
    } finally {
      setContaToDelete(null);
      setDeleteScope('one');
    }
  };


  const handleEdit = (conta: ContaPagar) => {
    setEditingConta(conta);
    setShowEditDialog(true);
  };

  const handleViewBoleto = async (boletoPath: string) => {
    try {
      const { data, error } = await supabase.storage
        .from('boletos')
        .createSignedUrl(boletoPath, 3600); // 1 hour
      if (error) throw error;
      window.open(data.signedUrl, '_blank');
    } catch (error) {
      console.error('Error opening boleto:', error);
      toast.error('Erro ao abrir boleto');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h3 className="text-lg font-semibold">Contas a Pagar</h3>
        <Button onClick={() => setShowAddDialog(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Nova Conta
        </Button>
      </div>

      {/* Filters */}
      <div className="bg-muted/30 p-4 rounded-lg space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por fornecedor ou descrição..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>

          <Select value={periodoRapido} onValueChange={handlePeriodoRapido}>
            <SelectTrigger>
              <SelectValue placeholder="Período..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="semana_atual">Semana Atual</SelectItem>
              <SelectItem value="semana_passada">Semana Passada</SelectItem>
              <SelectItem value="mes_atual">Mês Atual</SelectItem>
              <SelectItem value="mes_passado">Mês Passado</SelectItem>
              <SelectItem value="ultimos_3_meses">Últimos 3 Meses</SelectItem>
              <SelectItem value="ultimos_6_meses">Últimos 6 Meses</SelectItem>
            </SelectContent>
          </Select>

          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  'justify-start text-left font-normal',
                  !filterDataInicio && 'text-muted-foreground'
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {filterDataInicio ? format(filterDataInicio, 'dd/MM/yyyy', { locale: ptBR }) : 'Data início'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={filterDataInicio}
                onSelect={(date) => { setFilterDataInicio(date); setPeriodoRapido(''); }}
                initialFocus
                className={cn("p-3 pointer-events-auto")}
                locale={ptBR}
              />
            </PopoverContent>
          </Popover>

          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  'justify-start text-left font-normal',
                  !filterDataFim && 'text-muted-foreground'
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {filterDataFim ? format(filterDataFim, 'dd/MM/yyyy', { locale: ptBR }) : 'Data fim'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={filterDataFim}
                onSelect={(date) => { setFilterDataFim(date); setPeriodoRapido(''); }}
                initialFocus
                className={cn("p-3 pointer-events-auto")}
                locale={ptBR}
              />
            </PopoverContent>
          </Popover>

          <Select value={filterCredorId} onValueChange={setFilterCredorId}>
            <SelectTrigger>
              <SelectValue placeholder="Todos fornecedores" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos fornecedores</SelectItem>
              {credores.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <Select value={filterCategoria} onValueChange={setFilterCategoria}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Todas categorias" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas categorias</SelectItem>
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
            </SelectContent>
          </Select>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Checkbox
                id="filterPendente"
                checked={filterPendente}
                onCheckedChange={(checked) => setFilterPendente(checked === true)}
              />
              <label htmlFor="filterPendente" className="text-sm cursor-pointer">Pendente</label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="filterPago"
                checked={filterPago}
                onCheckedChange={(checked) => setFilterPago(checked === true)}
              />
              <label htmlFor="filterPago" className="text-sm cursor-pointer">Pago</label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="filterAtrasado"
                checked={filterAtrasado}
                onCheckedChange={(checked) => setFilterAtrasado(checked === true)}
              />
              <label htmlFor="filterAtrasado" className="text-sm cursor-pointer">Atrasado</label>
            </div>
          </div>

          <Select value={filterDateField} onValueChange={(v) => setFilterDateField(v as 'vencimento' | 'pagamento')}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Data: vencimento" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="vencimento">Data: Vencimento</SelectItem>
              <SelectItem value="pagamento">Data: Pagamento</SelectItem>
            </SelectContent>
          </Select>

          <Select value={sortBy} onValueChange={(v) => setSortBy(v as 'vencimento' | 'pagamento')}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Ordenar por vencimento" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="vencimento">Ordenar: Vencimento</SelectItem>
              <SelectItem value="pagamento">Ordenar: Data Pagamento</SelectItem>
            </SelectContent>
          </Select>

          <Button variant="ghost" size="sm" onClick={handleClearFilters}>
            <X className="h-4 w-4 mr-1" />
            Limpar
          </Button>
        </div>
      </div>

      <div className="border rounded-lg overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Vencimento</TableHead>
              <TableHead>Fornecedor/Prestador</TableHead>
              <TableHead>Descrição</TableHead>
              <TableHead>Categoria</TableHead>
              <TableHead className="text-right">Valor Total</TableHead>
              <TableHead className="text-right">Valor Restante</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Data Pagamento</TableHead>
              <TableHead className="text-center">Boleto</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredContas.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                  Nenhuma conta encontrada
                </TableCell>
              </TableRow>
            ) : (
              filteredContas.map((conta) => {
                const realStatus = getRealStatus(conta);
                const isPartial = hasPartialPayment(conta);
                const valorTotal = conta.valor_total || conta.valor;
                const valorJaPago = conta.valor_pago || 0;
                const valorRestante = conta.valor;
                
                return (
                  <TableRow key={conta.id}>
                    <TableCell>
                      {format(parseISO(conta.data_vencimento), 'dd/MM/yyyy', { locale: ptBR })}
                    </TableCell>
                    <TableCell className="font-medium">
                      {getCredorNome(conta.credor_id)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span>{conta.descricao}</span>
                        {conta.installment_number && conta.installment_total && (
                          <Badge variant="secondary" className="text-xs shrink-0">
                            {conta.installment_number}/{conta.installment_total}
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{getCategoriaLabel(conta.categoria)}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="font-medium">{formatCurrency(valorTotal)}</span>
                      {isPartial && (
                        <div className="text-xs text-success">
                          Pago: {formatCurrency(valorJaPago)}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="font-medium">{formatCurrency(valorRestante)}</span>
                    </TableCell>
                    <TableCell>{getStatusBadge(conta)}</TableCell>
                    <TableCell>
                      {conta.data_pagamento
                        ? format(parseISO(conta.data_pagamento), 'dd/MM/yyyy', { locale: ptBR })
                        : <span className="text-muted-foreground text-xs">-</span>
                      }
                    </TableCell>
                    <TableCell className="text-center">
                      {conta.boleto_url ? (
                        <Button
                          variant="ghost"
                          size="icon" aria-label="Ver boleto"
                          onClick={() => handleViewBoleto(conta.boleto_url!)}
                          title="Ver boleto"
                          className="text-primary hover:text-primary/80"
                        >
                          <FileText className="h-4 w-4" />
                        </Button>
                      ) : (
                        <span className="text-muted-foreground text-xs">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {realStatus !== 'pago' && (
                          <Button
                            variant="ghost"
                            size="icon" aria-label="Pagar"
                            onClick={() => setPayingConta(conta)}
                            title="Pagar"
                            className="text-success hover:text-[#07714E]"
                          >
                            <CheckCircle className="h-4 w-4" />
                          </Button>
                        )}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" aria-label="Mais ações">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-56">
                            {realStatus === 'pago' ? (
                              <DropdownMenuItem onClick={() => setViewingConta(conta)}>
                                <Eye className="h-4 w-4 mr-2 text-ink-500" />
                                Ver detalhes
                              </DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem onClick={() => handleEdit(conta)}>
                                <Edit className="h-4 w-4 mr-2 text-ink-500" />
                                Editar
                              </DropdownMenuItem>
                            )}
                            {(realStatus === 'pago' || (conta.valor_pago ?? 0) > 0) && (
                              <DropdownMenuItem onClick={() => setContaToRevert(conta)}>
                                <Undo2 className="h-4 w-4 mr-2 text-ink-500" />
                                Reverter pagamento
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => setContaToDelete(conta)} className="text-destructive focus:text-destructive">
                              <Trash2 className="h-4 w-4 mr-2" />
                              Excluir
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <ContaPagarFormDialog
        open={showAddDialog}
        onOpenChange={setShowAddDialog}
        credores={credores}
        onSuccess={onUpdate}
      />

      <ContaPagarFormDialog
        open={showEditDialog}
        onOpenChange={setShowEditDialog}
        conta={editingConta}
        credores={credores}
        onSuccess={onUpdate}
      />

      <ConfirmPaymentDialog
        open={!!payingConta}
        onOpenChange={(open) => !open && setPayingConta(null)}
        conta={payingConta}
        credor={credores.find(c => c.id === payingConta?.credor_id)}
        onSuccess={onUpdate}
      />

      {/* View Dialog for paid accounts */}
      <AlertDialog open={!!viewingConta} onOpenChange={(open) => !open && setViewingConta(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Detalhes da Conta</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-left">
                <div className="flex justify-between py-1 border-b">
                  <span className="text-muted-foreground">Fornecedor/Prestador:</span>
                  <span className="font-medium">{getCredorNome(viewingConta?.credor_id || '')}</span>
                </div>
                <div className="flex justify-between py-1 border-b">
                  <span className="text-muted-foreground">Descrição:</span>
                  <span className="font-medium">{viewingConta?.descricao}</span>
                </div>
                <div className="flex justify-between py-1 border-b">
                  <span className="text-muted-foreground">Valor Total:</span>
                  <span className="font-medium">{formatCurrency(viewingConta?.valor_total || viewingConta?.valor || 0)}</span>
                </div>
                {(viewingConta?.valor_pago ?? 0) > 0 && (
                  <div className="flex justify-between py-1 border-b">
                    <span className="text-muted-foreground">Valor Pago:</span>
                    <span className="font-medium text-success">{formatCurrency(viewingConta?.valor_pago || 0)}</span>
                  </div>
                )}
                <div className="flex justify-between py-1 border-b">
                  <span className="text-muted-foreground">Vencimento:</span>
                  <span className="font-medium">
                    {viewingConta?.data_vencimento && format(parseISO(viewingConta.data_vencimento), 'dd/MM/yyyy', { locale: ptBR })}
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b">
                  <span className="text-muted-foreground">Data Pagamento:</span>
                  <span className="font-medium">
                    {viewingConta?.data_pagamento && format(parseISO(viewingConta.data_pagamento), 'dd/MM/yyyy', { locale: ptBR })}
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b">
                  <span className="text-muted-foreground">Forma de Pagamento:</span>
                  <span className="font-medium">{viewingConta?.forma_pagamento || '-'}</span>
                </div>
                {viewingConta?.observacoes && (
                  <div className="py-1 border-b">
                    <span className="text-muted-foreground">Observações:</span>
                    <p className="font-medium mt-1">{viewingConta.observacoes}</p>
                  </div>
                )}
                {viewingConta?.boleto_url && (
                  <div className="py-1">
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-1"
                      onClick={() => handleViewBoleto(viewingConta.boleto_url!)}
                    >
                      <FileText className="h-4 w-4 mr-2" />
                      Ver Boleto
                    </Button>
                  </div>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Fechar</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!contaToDelete} onOpenChange={(open) => !open && setContaToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir a conta "{contaToDelete?.descricao}"? 
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>

          {contaToDelete?.recurrence_group_id && (
            <RadioGroup
              value={deleteScope}
              onValueChange={(v) => setDeleteScope(v as 'one' | 'following')}
              className="space-y-3 py-2"
            >
              <div className="flex items-center gap-3">
                <RadioGroupItem value="one" id="del-scope-one" />
                <label htmlFor="del-scope-one" className="text-sm cursor-pointer">
                  Aplicar somente a este lançamento
                </label>
              </div>
              <div className="flex items-center gap-3">
                <RadioGroupItem value="following" id="del-scope-following" />
                <label htmlFor="del-scope-following" className="text-sm cursor-pointer">
                  Aplicar a este e aos próximos lançamentos
                </label>
              </div>
              <p className="text-xs text-muted-foreground">
                Lançamentos já pagos nunca são excluídos.
              </p>
            </RadioGroup>
          )}

          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); handleDelete(); }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>

        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!contaToRevert} onOpenChange={(o) => !o && setContaToRevert(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reverter pagamento?</AlertDialogTitle>
            <AlertDialogDescription>
              A conta "{contaToRevert?.descricao}" voltará para pendente com o valor original
              {contaToRevert ? ` (${formatCurrency(Number(contaToRevert.valor_total ?? 0) > 0 ? Number(contaToRevert.valor_total) : Number(contaToRevert.valor || 0) + Number(contaToRevert.valor_pago || 0))})` : ''}.
              Os juros registrados nessa baixa também serão removidos. O comprovante anexado é mantido.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={reverting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction disabled={reverting} onClick={(e) => { e.preventDefault(); handleRevert(); }}>
              {reverting ? 'Revertendo...' : 'Reverter'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default ContasPagarTable;
