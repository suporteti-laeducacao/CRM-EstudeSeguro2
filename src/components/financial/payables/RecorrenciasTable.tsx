import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Plus, Pause, Play, Trash2, RefreshCw, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { format, parseISO, addMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Credor, CATEGORIAS_CONTA, FORMAS_PAGAMENTO, RECORRENCIAS } from '@/lib/payables-types';
import { getCategoriasPersonalizadas, CategoriaPersonalizada } from '@/lib/categorias-storage';
import {
  Recorrencia, getRecorrencias, saveRecorrencia, updateRecorrencia,
  deleteRecorrencia, gerarContasRecorrentes, gerarContasParaRecorrencia,
} from '@/lib/recorrencias-storage';

interface RecorrenciasTableProps {
  credores: Credor[];
  onUpdate: () => void;
  onSwitchToContas?: () => void;
}

const RECORRENCIA_LABELS: Record<string, string> = {
  mensal: 'Mensal',
  trimestral: 'Trimestral',
  semestral: 'Semestral',
  anual: 'Anual',
};

const UNIT_LABELS: Record<string, string> = { day: 'dia(s)', month: 'mês(es)', year: 'ano(s)' };

const formatRecorrenciaLabel = (r: string) => {
  if (r?.startsWith('personalizada:')) {
    const [, i, u] = r.split(':');
    return `Personalizada (a cada ${i} ${UNIT_LABELS[u] || u})`;
  }
  return RECORRENCIA_LABELS[r] || r;
};

const RecorrenciasTable = ({ credores, onUpdate, onSwitchToContas }: RecorrenciasTableProps) => {
  const [recorrencias, setRecorrencias] = useState<Recorrencia[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [deleteRec, setDeleteRec] = useState<Recorrencia | null>(null);
  const [pendingContas, setPendingContas] = useState<Array<{ id: string; descricao: string; data_vencimento: string; valor: number }>>([]);
  const [selectedContas, setSelectedContas] = useState<Set<string>>(new Set());
  const [loadingPending, setLoadingPending] = useState(false);
  const [deletingRec, setDeletingRec] = useState(false);
  const [generating, setGenerating] = useState(false);

  // Form state
  const [credorId, setCredorId] = useState('');
  const [descricao, setDescricao] = useState('');
  const [categoria, setCategoria] = useState('comissao');
  const [valor, setValor] = useState('');
  const [formaPagamento, setFormaPagamento] = useState('');
  const [recorrenciaTipo, setRecorrenciaTipo] = useState('mensal');
  const [diaVencimento, setDiaVencimento] = useState('1');
  const [observacoes, setObservacoes] = useState('');
  const [categoriasPersonalizadas, setCategoriasPersonalizadas] = useState<CategoriaPersonalizada[]>([]);
  const [formLoading, setFormLoading] = useState(false);

  const loadRecorrencias = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getRecorrencias();
      setRecorrencias(data);
    } catch (error) {
      console.error('Error loading recorrencias:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadCategorias = useCallback(async () => {
    try {
      const data = await getCategoriasPersonalizadas();
      setCategoriasPersonalizadas(data);
    } catch (error) {
      console.error('Error loading categorias:', error);
    }
  }, []);

  useEffect(() => {
    loadRecorrencias();
    loadCategorias();
  }, [loadRecorrencias, loadCategorias]);


  const resetForm = () => {
    setCredorId('');
    setDescricao('');
    setCategoria('comissao');
    setValor('');
    setFormaPagamento('');
    setRecorrenciaTipo('mensal');
    setDiaVencimento('1');
    setObservacoes('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log('[RecorrenciasTable] handleSubmit V2 chamado!');
    toast.info('Iniciando cadastro de recorrência...');
    if (!credorId) { toast.error('Selecione um fornecedor/prestador'); return; }
    if (!descricao.trim()) { toast.error('Descrição é obrigatória'); return; }
    if (!valor || parseFloat(valor) <= 0) { toast.error('Valor deve ser maior que zero'); return; }

    const dia = parseInt(diaVencimento) || 1;
    const valorNum = parseFloat(valor);

    // A primeira parcela vence no dia informado (este mês ou próximo)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    let primeiraData = new Date(today.getFullYear(), today.getMonth(), dia);
    if (primeiraData <= today) {
      primeiraData = new Date(today.getFullYear(), today.getMonth() + 1, dia);
    }

    const INTERVALOS: Record<string, number> = {
      mensal: 1, trimestral: 3, semestral: 6, anual: 12,
    };
    const intervalo = INTERVALOS[recorrenciaTipo] || 1;

    // 3 parcelas: primeira data, +1 intervalo, +2 intervalos
    const datasParaGerar = [
      primeiraData,
      addMonths(primeiraData, intervalo),
      addMonths(primeiraData, intervalo * 2),
    ];

    // proxima_geracao = a 4ª parcela
    const proximaGeracao = addMonths(primeiraData, intervalo * 3);

    setFormLoading(true);
    try {
      // 1. Buscar user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { toast.error('Usuário não autenticado'); return; }

      // 2. Gerar as 3 parcelas PRIMEIRO
      let count = 0;
      for (const dt of datasParaGerar) {
        const dataVencimento = format(dt, 'yyyy-MM-dd');
        const descricaoGerada = `${descricao} - ${format(dt, 'MMM/yy', { locale: ptBR })}`;

        const { error } = await supabase
          .from('contas_pagar')
          .insert({
            user_id: user.id,
            credor_id: credorId,
            descricao: descricaoGerada,
            categoria,
            valor: valorNum,
            data_vencimento: dataVencimento,
            status: 'pendente',
            forma_pagamento: formaPagamento || null,
            observacoes: observacoes ? `Recorrência automática. ${observacoes}` : 'Recorrência automática.',
          });

        if (error) {
          console.error('Erro ao inserir parcela:', JSON.stringify(error));
          toast.error(`Erro ao gerar parcela ${dataVencimento}`);
        } else {
          count++;
        }
      }

      // 3. Salvar a recorrência para geração futura
      await saveRecorrencia({
        credor_id: credorId,
        descricao,
        categoria,
        valor: valorNum,
        forma_pagamento: formaPagamento || undefined,
        observacoes: observacoes || undefined,
        recorrencia: recorrenciaTipo,
        dia_vencimento: dia,
        proxima_geracao: format(proximaGeracao, 'yyyy-MM-dd'),
        ativo: true,
      });

      resetForm();
      setIsDialogOpen(false);
      toast.success(`Recorrência cadastrada com ${count} parcela(s) gerada(s)!`);

      // 4. Atualizar dados
      await onUpdate();
      loadRecorrencias();
    } catch (error) {
      console.error('Erro no cadastro:', error);
      toast.error('Erro ao salvar recorrência');
    } finally {
      setFormLoading(false);
    }
  };

  const handleToggleAtivo = async (rec: Recorrencia) => {
    try {
      await updateRecorrencia(rec.id, { ativo: !rec.ativo });
      toast.success(rec.ativo ? 'Recorrência pausada!' : 'Recorrência reativada!');
      loadRecorrencias();
    } catch (error) {
      console.error('Error toggling recorrencia:', error);
      toast.error('Erro ao alterar status');
    }
  };

  const openDelete = async (rec: Recorrencia) => {
    setDeleteRec(rec);
    setSelectedContas(new Set());
    setLoadingPending(true);
    try {
      const { data, error } = await supabase
        .from('contas_pagar')
        .select('id, descricao, data_vencimento, valor')
        .eq('credor_id', rec.credor_id)
        .eq('status', 'pendente')
        .like('descricao', `${rec.descricao} - %`)
        .order('data_vencimento', { ascending: true });
      if (error) throw error;
      const list = (data || []).map((r: any) => ({
        id: r.id,
        descricao: r.descricao,
        data_vencimento: r.data_vencimento,
        valor: Number(r.valor),
      }));
      setPendingContas(list);
      setSelectedContas(new Set(list.map(l => l.id)));
    } catch (err) {
      console.error('Error loading pending contas:', err);
      toast.error('Erro ao carregar parcelas em aberto');
      setPendingContas([]);
    } finally {
      setLoadingPending(false);
    }
  };

  const toggleConta = (id: string) => {
    setSelectedContas(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAllContas = () => {
    if (selectedContas.size === pendingContas.length) {
      setSelectedContas(new Set());
    } else {
      setSelectedContas(new Set(pendingContas.map(c => c.id)));
    }
  };

  const handleDelete = async () => {
    if (!deleteRec) return;
    setDeletingRec(true);
    try {
      if (selectedContas.size > 0) {
        const ids = Array.from(selectedContas);
        const { error } = await supabase
          .from('contas_pagar')
          .delete()
          .in('id', ids);
        if (error) throw error;
      }
      await deleteRecorrencia(deleteRec.id);
      toast.success(
        selectedContas.size > 0
          ? `Recorrência e ${selectedContas.size} parcela(s) excluída(s)!`
          : 'Recorrência excluída!'
      );
      setDeleteRec(null);
      setPendingContas([]);
      setSelectedContas(new Set());
      await onUpdate();
      loadRecorrencias();
    } catch (error) {
      console.error('Error deleting recorrencia:', error);
      toast.error('Erro ao excluir recorrência');
    } finally {
      setDeletingRec(false);
    }
  };

  const handleForceGenerate = async () => {
    setGenerating(true);
    try {
      const count = await gerarContasRecorrentes();
      if (count > 0) {
        toast.success(`${count} conta(s) gerada(s)!`);
        onUpdate();
        loadRecorrencias();
      } else {
        toast.info('Nenhuma conta a gerar no momento.');
      }
    } catch (error) {
      console.error('Error generating:', error);
      toast.error('Erro ao gerar contas');
    } finally {
      setGenerating(false);
    }
  };

  const getCredorNome = (id: string) => credores.find(c => c.id === id)?.nome || 'Desconhecido';
  const credoresAtivos = credores.filter(c => c.status === 'ativo');

  const formatCurrency = (v: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Pagamentos Recorrentes</h3>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleForceGenerate} disabled={generating}>
            <RefreshCw className={`w-4 h-4 mr-2 ${generating ? 'animate-spin' : ''}`} />
            Gerar Pendentes
          </Button>
          <Button size="sm" onClick={() => { resetForm(); setIsDialogOpen(true); }}>
            <Plus className="w-4 h-4 mr-2" />
            Nova Recorrência
          </Button>
        </div>
      </div>

      <p className="text-sm text-muted-foreground">
        Parcelas são geradas automaticamente quando faltam 60 dias para o vencimento. A recorrência continua indefinidamente até ser pausada ou excluída.
      </p>

      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fornecedor</TableHead>
              <TableHead>Descrição</TableHead>
              <TableHead>Valor</TableHead>
              <TableHead>Frequência</TableHead>
              <TableHead>Dia Venc.</TableHead>
              <TableHead>Próxima Geração</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {recorrencias.map((rec) => (
              <TableRow key={rec.id}>
                <TableCell className="font-medium">{getCredorNome(rec.credor_id)}</TableCell>
                <TableCell>{rec.descricao}</TableCell>
                <TableCell>{formatCurrency(rec.valor)}</TableCell>
                <TableCell>{formatRecorrenciaLabel(rec.recorrencia)}</TableCell>
                <TableCell>Dia {rec.dia_vencimento}</TableCell>
                <TableCell>
                  {format(parseISO(rec.proxima_geracao), 'dd/MM/yyyy', { locale: ptBR })}
                </TableCell>
                <TableCell>
                  {rec.ativo ? (
                    <Badge className="bg-[#E7F7F0] text-[#07714E] border-transparent">Ativa</Badge>
                  ) : (
                    <Badge variant="secondary">Pausada</Badge>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex gap-1 justify-end">
                    <Button aria-label="Pausar ou reativar recorrência"
                      size="sm"
                      variant="outline"
                      onClick={() => handleToggleAtivo(rec)}
                      title={rec.ativo ? 'Pausar' : 'Reativar'}
                    >
                      {rec.ativo ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                    </Button>
                    <Button aria-label="Excluir"
                      size="sm"
                      variant="destructive"
                      onClick={() => openDelete(rec)}
                      title="Excluir"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {recorrencias.length === 0 && !loading && (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                  Nenhuma recorrência cadastrada
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Create Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Nova Recorrência</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Fornecedor/Prestador *</Label>
              <Select value={credorId} onValueChange={setCredorId}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {credoresAtivos.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.nome} ({c.tipo})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Descrição *</Label>
              <Input value={descricao} onChange={e => setDescricao(e.target.value)} placeholder="Ex: Aluguel, Internet, etc." />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Categoria</Label>
                <Select value={categoria} onValueChange={setCategoria}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIAS_CONTA.map(c => (
                      <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                    ))}
                    {categoriasPersonalizadas.map(c => (
                      <SelectItem key={c.id} value={c.nome}>{c.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Valor (R$) *</Label>
                <Input type="number" step="0.01" min="0.01" value={valor} onChange={e => setValor(e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Frequência</Label>
                <Select value={recorrenciaTipo} onValueChange={setRecorrenciaTipo}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {RECORRENCIAS.filter(r => r.value !== 'nenhuma').map(r => (
                      <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Dia do Vencimento</Label>
                <Input type="number" min="1" max="31" value={diaVencimento} onChange={e => setDiaVencimento(e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Forma de Pagamento</Label>
              <Select value={formaPagamento} onValueChange={setFormaPagamento}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {FORMAS_PAGAMENTO.filter(f => f.value !== 'parcelado').map(f => (
                    <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Observações</Label>
              <Textarea value={observacoes} onChange={e => setObservacoes(e.target.value)} rows={2} />
            </div>
            <div className="flex gap-2 justify-end">
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={formLoading}>{formLoading ? 'Salvando...' : 'Cadastrar'}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog with Pending Installments */}
      <Dialog
        open={!!deleteRec}
        onOpenChange={(open) => {
          if (!open && !deletingRec) {
            setDeleteRec(null);
            setPendingContas([]);
            setSelectedContas(new Set());
          }
        }}
      >
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Excluir Recorrência</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Você está excluindo a recorrência <strong className="text-foreground">{deleteRec?.descricao}</strong>.
              Selecione abaixo quais parcelas em aberto também devem ser excluídas. Parcelas já pagas não são afetadas.
            </p>

            {loadingPending ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : pendingContas.length === 0 ? (
              <div className="rounded-md border p-4 text-sm text-muted-foreground text-center">
                Nenhuma parcela em aberto encontrada para esta recorrência.
              </div>
            ) : (
              <div className="rounded-md border overflow-x-auto">
                <div className="flex items-center gap-2 px-3 py-2 border-b bg-muted/40">
                  <Checkbox
                    checked={selectedContas.size === pendingContas.length}
                    onCheckedChange={toggleAllContas}
                  />
                  <span className="text-sm font-medium">
                    Selecionar todas ({selectedContas.size}/{pendingContas.length})
                  </span>
                </div>
                <div className="max-h-72 overflow-y-auto divide-y">
                  {pendingContas.map(c => (
                    <label
                      key={c.id}
                      className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-muted/30"
                    >
                      <Checkbox
                        checked={selectedContas.has(c.id)}
                        onCheckedChange={() => toggleConta(c.id)}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{c.descricao}</div>
                        <div className="text-xs text-muted-foreground">
                          Vence em {format(parseISO(c.data_vencimento), 'dd/MM/yyyy', { locale: ptBR })}
                        </div>
                      </div>
                      <div className="text-sm font-medium">{formatCurrency(c.valor)}</div>
                    </label>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-2 justify-end pt-2">
              <Button
                type="button"
                variant="outline"
                disabled={deletingRec}
                onClick={() => {
                  setDeleteRec(null);
                  setPendingContas([]);
                  setSelectedContas(new Set());
                }}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                variant="destructive"
                disabled={deletingRec || loadingPending}
                onClick={handleDelete}
              >
                {deletingRec ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Excluindo...</>
                ) : selectedContas.size > 0 ? (
                  `Excluir recorrência + ${selectedContas.size} parcela(s)`
                ) : (
                  'Excluir somente recorrência'
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default RecorrenciasTable;
