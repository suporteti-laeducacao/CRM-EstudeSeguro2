import { useSearchParams } from 'react-router-dom';
import { useState, useEffect, useMemo } from 'react';
import Layout from '@/components/Layout';
import PageHeader from '@/components/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Plus, Pencil, Trash2, TrendingUp, Users, DollarSign, Target, BarChart3, CalendarIcon, X, FileText, Megaphone, Eye, PlusCircle, ClipboardList, MoreVertical } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { format, parseISO, startOfMonth, endOfMonth, subMonths, startOfYear, isWithinInterval } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import FinancialReportTab from '@/components/reports/FinancialReportTab';
import MonthlyClosingReport from '@/components/reports/MonthlyClosingReport';
import MetaReportTab from '@/components/reports/MetaReportTab';

interface Campanha {
  id: string;
  nome: string;
  data: string;
  valor_gasto: number;
  leads: number;
  alunos_convertidos: number;
  plataforma: string;
  categoria: string;
  user_id: string;
  created_at: string;
}

interface Lancamento {
  id: string;
  campanha_id: string;
  data: string;
  valor_gasto: number;
  leads: number;
  alunos_convertidos: number;
  plataforma: string;
  categoria: string;
  user_id: string;
  created_at: string;
}

interface VendaCampanha {
  id: string;
  date: string;
  campanha_id: string | null;
}

interface CampanhaComLancamentos extends Campanha {
  lancamentos: Lancamento[];
  totalGasto: number;
  totalLeads: number;
  totalConversoes: number;
}

const plataformas = [
  'Facebook Ads',
  'Google Ads',
  'Instagram Ads',
  'TikTok Ads',
  'LinkedIn Ads',
  'YouTube Ads',
  'Outros',
];

const categorias = [
  { value: 'eja', label: 'EJA' },
  { value: 'tecnico', label: 'Técnico' },
  { value: 'pos_tecnico', label: 'Pós Técnico' },
  { value: 'bacharelado', label: 'Bacharelado' },
  { value: 'tecnologo', label: 'Tecnólogo' },
];

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
};

const Reports = () => {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const abaAtiva = searchParams.get('aba') || 'financeiro';
  const [campanhas, setCampanhas] = useState<Campanha[]>([]);
  const [lancamentos, setLancamentos] = useState<Lancamento[]>([]);
  const [vendasCampanha, setVendasCampanha] = useState<VendaCampanha[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCampanha, setEditingCampanha] = useState<Campanha | null>(null);
  const [formData, setFormData] = useState({
    nome: '',
    data: '',
    valor_gasto: '',
    leads: '',
    alunos_convertidos: '',
    plataforma: '',
    categoria: '',
  });

  // Lancamento dialog state
  const [lancamentoDialogOpen, setLancamentoDialogOpen] = useState(false);
  const [lancamentoCampanhaId, setLancamentoCampanhaId] = useState<string | null>(null);
  const [editingLancamento, setEditingLancamento] = useState<Lancamento | null>(null);
  const [lancamentoForm, setLancamentoForm] = useState({
    data: '',
    valor_gasto: '',
    leads: '',
    alunos_convertidos: '',
  });

  // Detail view state
  const [detailCampanhaId, setDetailCampanhaId] = useState<string | null>(null);

  const [categoriaFiltro, setCategoriaFiltro] = useState<string>('todas');
  const [dataInicio, setDataInicio] = useState<Date | undefined>(undefined);
  const [dataFim, setDataFim] = useState<Date | undefined>(undefined);
  const [periodoRapido, setPeriodoRapido] = useState<string>('mes_atual');

  // Aplicar mês atual como padrão na inicialização
  useEffect(() => {
    const hoje = new Date();
    setDataInicio(startOfMonth(hoje));
    setDataFim(endOfMonth(hoje));
  }, []);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [campanhasRes, lancamentosRes, vendasRes] = await Promise.all([
        supabase.from('campanhas_trafego').select('*').order('data', { ascending: false }),
        supabase.from('lancamentos_campanha').select('*').order('data', { ascending: false }),
        supabase.from('sales').select('id, date, campanha_id').not('campanha_id', 'is', null),
      ]);

      if (campanhasRes.error) throw campanhasRes.error;
      if (lancamentosRes.error) throw lancamentosRes.error;
      if (vendasRes.error) throw vendasRes.error;

      setCampanhas(campanhasRes.data || []);
      setLancamentos(lancamentosRes.data || []);
      setVendasCampanha((vendasRes.data || []) as VendaCampanha[]);
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      toast.error('Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  };

  // Build campaigns with aggregated lancamento data
  const campanhasComLancamentos: CampanhaComLancamentos[] = useMemo(() => {
    return campanhas.map(c => {
      const lancs = lancamentos.filter(l => l.campanha_id === c.id);
      const hasLancamentos = lancs.length > 0;
      return {
        ...c,
        lancamentos: lancs,
        totalGasto: hasLancamentos ? lancs.reduce((s, l) => s + Number(l.valor_gasto), 0) : Number(c.valor_gasto),
        totalLeads: hasLancamentos ? lancs.reduce((s, l) => s + l.leads, 0) : c.leads,
        totalConversoes: 0,
      };
    });
  }, [campanhas, lancamentos]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    try {
      const campanhaData = {
        nome: formData.nome,
        data: formData.data,
        valor_gasto: parseFloat(formData.valor_gasto) || 0,
        leads: parseInt(formData.leads) || 0,
        alunos_convertidos: parseInt(formData.alunos_convertidos) || 0,
        plataforma: formData.plataforma,
        categoria: formData.categoria,
        user_id: user.id,
      };

      if (editingCampanha) {
        const { error } = await supabase
          .from('campanhas_trafego')
          .update(campanhaData)
          .eq('id', editingCampanha.id);
        if (error) throw error;
        toast.success('Campanha atualizada com sucesso!');
      } else {
        const { error } = await supabase
          .from('campanhas_trafego')
          .insert(campanhaData);
        if (error) throw error;
        toast.success('Campanha cadastrada com sucesso!');
      }

      setDialogOpen(false);
      resetForm();
      fetchData();
    } catch (error) {
      console.error('Erro ao salvar campanha:', error);
      toast.error('Erro ao salvar campanha');
    }
  };

  const handleEdit = (campanha: Campanha) => {
    setEditingCampanha(campanha);
    setFormData({
      nome: campanha.nome,
      data: campanha.data,
      valor_gasto: campanha.valor_gasto.toString(),
      leads: campanha.leads.toString(),
      alunos_convertidos: campanha.alunos_convertidos.toString(),
      plataforma: campanha.plataforma,
      categoria: campanha.categoria,
    });
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir esta campanha e todos seus lançamentos?')) return;

    try {
      // Delete lancamentos first
      await supabase.from('lancamentos_campanha').delete().eq('campanha_id', id);
      const { error } = await supabase.from('campanhas_trafego').delete().eq('id', id);
      if (error) throw error;
      toast.success('Campanha excluída com sucesso!');
      setDetailCampanhaId(null);
      fetchData();
    } catch (error) {
      console.error('Erro ao excluir campanha:', error);
      toast.error('Erro ao excluir campanha');
    }
  };

  const resetForm = () => {
    setFormData({ nome: '', data: '', valor_gasto: '', leads: '', alunos_convertidos: '', plataforma: '', categoria: '' });
    setEditingCampanha(null);
  };

  // === Lancamento handlers ===
  const openLancamentoDialog = (campanhaId: string, lancamento?: Lancamento) => {
    setLancamentoCampanhaId(campanhaId);
    if (lancamento) {
      setEditingLancamento(lancamento);
      setLancamentoForm({
        data: lancamento.data,
        valor_gasto: lancamento.valor_gasto.toString(),
        leads: lancamento.leads.toString(),
        alunos_convertidos: lancamento.alunos_convertidos.toString(),
      });
    } else {
      setEditingLancamento(null);
      setLancamentoForm({ data: format(new Date(), 'yyyy-MM-dd'), valor_gasto: '', leads: '', alunos_convertidos: '' });
    }
    setLancamentoDialogOpen(true);
  };

  const handleLancamentoSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !lancamentoCampanhaId) return;

    const campanha = campanhas.find(c => c.id === lancamentoCampanhaId);
    if (!campanha) return;

    try {
      const data = {
        campanha_id: lancamentoCampanhaId,
        data: lancamentoForm.data,
        valor_gasto: parseFloat(lancamentoForm.valor_gasto) || 0,
        leads: parseInt(lancamentoForm.leads) || 0,
        alunos_convertidos: parseInt(lancamentoForm.alunos_convertidos) || 0,
        plataforma: campanha.plataforma,
        categoria: campanha.categoria,
        user_id: user.id,
      };

      if (editingLancamento) {
        const { error } = await supabase.from('lancamentos_campanha').update(data).eq('id', editingLancamento.id);
        if (error) throw error;
        toast.success('Lançamento atualizado!');
      } else {
        const { error } = await supabase.from('lancamentos_campanha').insert(data);
        if (error) throw error;
        toast.success('Lançamento adicionado!');
      }

      setLancamentoDialogOpen(false);
      fetchData();
    } catch (error) {
      console.error('Erro ao salvar lançamento:', error);
      toast.error('Erro ao salvar lançamento');
    }
  };

  const handleDeleteLancamento = async (id: string) => {
    if (!confirm('Excluir este lançamento?')) return;
    try {
      const { error } = await supabase.from('lancamentos_campanha').delete().eq('id', id);
      if (error) throw error;
      toast.success('Lançamento excluído!');
      fetchData();
    } catch (error) {
      toast.error('Erro ao excluir lançamento');
    }
  };

  // === Filters ===
  const aplicarPeriodoRapido = (periodo: string) => {
    setPeriodoRapido(periodo);
    const hoje = new Date();
    switch (periodo) {
      case 'mes_atual': setDataInicio(startOfMonth(hoje)); setDataFim(endOfMonth(hoje)); break;
      case 'mes_anterior': { const m = subMonths(hoje, 1); setDataInicio(startOfMonth(m)); setDataFim(endOfMonth(m)); break; }
      case 'ultimos_3_meses': setDataInicio(startOfMonth(subMonths(hoje, 2))); setDataFim(endOfMonth(hoje)); break;
      case 'ultimos_6_meses': setDataInicio(startOfMonth(subMonths(hoje, 5))); setDataFim(endOfMonth(hoje)); break;
      case 'ano_atual': setDataInicio(startOfYear(hoje)); setDataFim(hoje); break;
      default: setDataInicio(undefined); setDataFim(undefined); break;
    }
  };

  const limparFiltrosData = () => { setDataInicio(undefined); setDataFim(undefined); setPeriodoRapido('todos'); };

  const dentroDoPeriodo = (dataStr: string) => {
    const d = parseISO(dataStr);
    if (dataInicio && dataFim) return isWithinInterval(d, { start: dataInicio, end: dataFim });
    if (dataInicio) return d >= dataInicio;
    if (dataFim) return d <= dataFim;
    return true;
  };

  // Conversões contadas diretamente das vendas lançadas (inclui vendas canceladas)
  const conversoesPorCampanha = useMemo(() => {
    const map: Record<string, number> = {};
    vendasCampanha.forEach(v => {
      if (!v.campanha_id || !v.date) return;
      if (!dentroDoPeriodo(v.date)) return;
      map[v.campanha_id] = (map[v.campanha_id] || 0) + 1;
    });
    return map;
  }, [vendasCampanha, dataInicio, dataFim]);

  const campanhasFiltradas = useMemo(() => {
    let resultado = campanhasComLancamentos;
    if (categoriaFiltro !== 'todas') resultado = resultado.filter(c => c.categoria === categoriaFiltro);

    // Todas as campanhas cadastradas continuam visíveis; apenas os valores respeitam o período
    return resultado.map(c => {
      const lancsFiltrados = (dataInicio || dataFim)
        ? c.lancamentos.filter(l => dentroDoPeriodo(l.data))
        : c.lancamentos;

      const usaCampanhaBase = c.lancamentos.length === 0 && dentroDoPeriodo(c.data);

      return {
        ...c,
        lancamentos: lancsFiltrados,
        totalGasto: lancsFiltrados.length > 0
          ? lancsFiltrados.reduce((s, l) => s + Number(l.valor_gasto), 0)
          : (usaCampanhaBase ? Number(c.valor_gasto) : 0),
        totalLeads: lancsFiltrados.length > 0
          ? lancsFiltrados.reduce((s, l) => s + l.leads, 0)
          : (usaCampanhaBase ? c.leads : 0),
        totalConversoes: conversoesPorCampanha[c.id] || 0,
      };
    });
  }, [campanhasComLancamentos, categoriaFiltro, dataInicio, dataFim, conversoesPorCampanha]);

  const metricas = useMemo(() => {
    const totalGasto = campanhasFiltradas.reduce((a, c) => a + c.totalGasto, 0);
    const totalLeads = campanhasFiltradas.reduce((a, c) => a + c.totalLeads, 0);
    const totalConversoes = campanhasFiltradas.reduce((a, c) => a + c.totalConversoes, 0);
    return {
      totalGasto,
      totalLeads,
      totalConversoes,
      cplMedio: totalLeads > 0 ? totalGasto / totalLeads : 0,
      cpaMedio: totalConversoes > 0 ? totalGasto / totalConversoes : 0,
      taxaConversaoMedia: totalLeads > 0 ? (totalConversoes / totalLeads) * 100 : 0,
    };
  }, [campanhasFiltradas]);

  const chartDataLine = useMemo(() => {
    const sorted = [...campanhasFiltradas].sort((a, b) => new Date(a.data).getTime() - new Date(b.data).getTime());
    return sorted.map(c => ({
      data: format(parseISO(c.data), 'dd/MM', { locale: ptBR }),
      CPL: c.totalLeads > 0 ? c.totalGasto / c.totalLeads : 0,
      CPA: c.totalConversoes > 0 ? c.totalGasto / c.totalConversoes : 0,
    }));
  }, [campanhasFiltradas]);

  const chartDataBar = useMemo(() => {
    return campanhasFiltradas.slice(0, 10).map(c => ({
      nome: c.nome.length > 15 ? c.nome.substring(0, 15) + '...' : c.nome,
      Leads: c.totalLeads,
      Conversões: c.totalConversoes,
    }));
  }, [campanhasFiltradas]);

  // Detail view campanha
  const detailCampanha = campanhasFiltradas.find(c => c.id === detailCampanhaId)
    || campanhasComLancamentos.find(c => c.id === detailCampanhaId);

  return (
    <Layout>
      <div className="space-y-6">
        <div className="print:hidden">
          <PageHeader
            title="Relatórios"
            subtitle="Análise de campanhas, métricas e relatórios financeiros"
            className="mb-0"
          />
        </div>

        <Tabs value={abaAtiva} onValueChange={v => { const n = new URLSearchParams(searchParams); n.set('aba', v); if (v !== 'financeiro') n.delete('tipo'); setSearchParams(n, { replace: true }); }} className="w-full">
          <TabsList className="grid w-full max-w-2xl grid-cols-4 print:hidden">
            <TabsTrigger value="financeiro" className="gap-2">
              <FileText className="h-4 w-4" />
              Financeiro
            </TabsTrigger>
            <TabsTrigger value="fechamento" className="gap-2">
              <ClipboardList className="h-4 w-4" />
              Fechamento
            </TabsTrigger>
            <TabsTrigger value="metas" className="gap-2">
              <Target className="h-4 w-4" />
              Desempenho vs Meta
            </TabsTrigger>
            <TabsTrigger value="trafego" className="gap-2">
              <Megaphone className="h-4 w-4" />
              Tráfego Pago
            </TabsTrigger>
          </TabsList>

          <TabsContent value="financeiro" className="mt-6">
            <FinancialReportTab />
          </TabsContent>

          <TabsContent value="fechamento" className="mt-6">
            <MonthlyClosingReport />
          </TabsContent>

          <TabsContent value="metas" className="mt-6">
            <MetaReportTab />
          </TabsContent>

          <TabsContent value="trafego" className="mt-6">
            <div className="space-y-6">
              {/* Nova Campanha Dialog */}
              <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
                <DialogTrigger asChild>
                  <Button className="gap-2">
                    <Plus className="h-4 w-4" />
                    Nova Campanha
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[500px]">
                  <DialogHeader>
                    <DialogTitle>{editingCampanha ? 'Editar Campanha' : 'Nova Campanha'}</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="nome">Nome da Campanha</Label>
                      <Input id="nome" value={formData.nome} onChange={(e) => setFormData({ ...formData, nome: e.target.value })} placeholder="Ex: Black Friday 2024" required />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="data">Data Início</Label>
                        <Input id="data" type="date" value={formData.data} onChange={(e) => setFormData({ ...formData, data: e.target.value })} required />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="plataforma">Plataforma</Label>
                        <Select value={formData.plataforma} onValueChange={(v) => setFormData({ ...formData, plataforma: v })}>
                          <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                          <SelectContent>{plataformas.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="categoria">Categoria do Curso</Label>
                      <Select value={formData.categoria} onValueChange={(v) => setFormData({ ...formData, categoria: v })}>
                        <SelectTrigger><SelectValue placeholder="Selecione a categoria" /></SelectTrigger>
                        <SelectContent>{categorias.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <p className="text-xs text-muted-foreground">Os valores de gasto, leads e conversões serão controlados via lançamentos diários após a criação.</p>
                    <div className="flex justify-end gap-2 pt-4">
                      <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
                      <Button type="submit">{editingCampanha ? 'Salvar Alterações' : 'Cadastrar'}</Button>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>

              {/* Lancamento Dialog */}
              <Dialog open={lancamentoDialogOpen} onOpenChange={setLancamentoDialogOpen}>
                <DialogContent className="sm:max-w-[400px]">
                  <DialogHeader>
                    <DialogTitle>{editingLancamento ? 'Editar Lançamento' : 'Novo Lançamento'}</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={handleLancamentoSubmit} className="space-y-4">
                    <div className="space-y-2">
                      <Label>Data</Label>
                      <Input type="date" value={lancamentoForm.data} onChange={(e) => setLancamentoForm({ ...lancamentoForm, data: e.target.value })} required />
                    </div>
                    <div className="space-y-2">
                      <Label>Valor Gasto (R$)</Label>
                      <Input type="number" step="0.01" min="0" value={lancamentoForm.valor_gasto} onChange={(e) => setLancamentoForm({ ...lancamentoForm, valor_gasto: e.target.value })} required />
                    </div>
                    <div className="space-y-2">
                      <Label>Leads</Label>
                      <Input type="number" min="0" value={lancamentoForm.leads} onChange={(e) => setLancamentoForm({ ...lancamentoForm, leads: e.target.value })} />
                    </div>
                    <p className="text-xs text-muted-foreground">As conversões são contadas automaticamente pelas vendas lançadas com esta campanha.</p>
                    <div className="flex justify-end gap-2 pt-4">
                      <Button type="button" variant="outline" onClick={() => setLancamentoDialogOpen(false)}>Cancelar</Button>
                      <Button type="submit">{editingLancamento ? 'Salvar' : 'Lançar'}</Button>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>

              {/* Detail View Dialog */}
              <Dialog open={!!detailCampanhaId} onOpenChange={(open) => { if (!open) setDetailCampanhaId(null); }}>
                <DialogContent className="sm:max-w-[700px] max-h-[80vh] overflow-y-auto">
                  {detailCampanha && (
                    <>
                      <DialogHeader>
                        <DialogTitle className="flex items-center justify-between">
                          <span>Detalhes: {detailCampanha.nome}</span>
                        </DialogTitle>
                      </DialogHeader>
                      <div className="grid grid-cols-3 gap-4 mb-4">
                        <Card>
                          <CardContent className="pt-4 pb-3">
                            <p className="text-xs text-muted-foreground">Total Gasto</p>
                            <p className="text-lg font-bold">{formatCurrency(detailCampanha.totalGasto)}</p>
                          </CardContent>
                        </Card>
                        <Card>
                          <CardContent className="pt-4 pb-3">
                            <p className="text-xs text-muted-foreground">Total Leads</p>
                            <p className="text-lg font-bold">{detailCampanha.totalLeads}</p>
                          </CardContent>
                        </Card>
                        <Card>
                          <CardContent className="pt-4 pb-3">
                            <p className="text-xs text-muted-foreground">Conversões</p>
                            <p className="text-lg font-bold">{detailCampanha.totalConversoes}</p>
                          </CardContent>
                        </Card>
                      </div>

                      <div className="flex items-center justify-between mb-3">
                        <h4 className="font-semibold text-sm">Linha do Tempo de Lançamentos</h4>
                        <Button size="sm" className="gap-1" onClick={() => openLancamentoDialog(detailCampanha.id)}>
                          <PlusCircle className="h-3 w-3" />
                          Novo Lançamento
                        </Button>
                      </div>

                      {detailCampanha.lancamentos.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-6">Nenhum lançamento registrado. Clique em "Novo Lançamento" para adicionar.</p>
                      ) : (
                        <div className="space-y-3">
                          {[...detailCampanha.lancamentos]
                            .sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime())
                            .map(l => (
                              <div key={l.id} className="flex items-center justify-between border rounded-lg p-3">
                                <div className="flex-1">
                                  <p className="text-sm font-medium">{format(parseISO(l.data), 'dd/MM/yyyy', { locale: ptBR })}</p>
                                  <div className="flex gap-4 text-xs text-muted-foreground mt-1">
                                    <span>Gasto: {formatCurrency(Number(l.valor_gasto))}</span>
                                    <span>Leads: {l.leads}</span>
                                  </div>
                                </div>
                                <div className="flex gap-1">
                                  <Button variant="ghost" size="icon" aria-label="Editar lançamento" className="h-8 w-8" onClick={() => openLancamentoDialog(detailCampanha.id, l)}>
                                    <Pencil className="h-3 w-3" />
                                  </Button>
                                  <Button variant="ghost" size="icon" aria-label="Excluir lançamento" className="h-8 w-8" onClick={() => handleDeleteLancamento(l.id)}>
                                    <Trash2 className="h-3 w-3 text-destructive" />
                                  </Button>
                                </div>
                              </div>
                            ))}
                        </div>
                      )}
                    </>
                  )}
                </DialogContent>
              </Dialog>

              {/* Filtros */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg">Filtros</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 items-end">
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Período Rápido</Label>
                      <Select value={periodoRapido} onValueChange={aplicarPeriodoRapido}>
                        <SelectTrigger className="w-full"><SelectValue placeholder="Selecione" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="todos">Todos os períodos</SelectItem>
                          <SelectItem value="mes_atual">Mês Atual</SelectItem>
                          <SelectItem value="mes_anterior">Mês Anterior</SelectItem>
                          <SelectItem value="ultimos_3_meses">Últimos 3 Meses</SelectItem>
                          <SelectItem value="ultimos_6_meses">Últimos 6 Meses</SelectItem>
                          <SelectItem value="ano_atual">Ano Atual</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Data Início</Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !dataInicio && "text-muted-foreground")}>
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {dataInicio ? format(dataInicio, "dd/MM/yyyy", { locale: ptBR }) : "Selecione"}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar mode="single" selected={dataInicio} onSelect={(d) => { setDataInicio(d); setPeriodoRapido(''); }} initialFocus locale={ptBR} className="p-3 pointer-events-auto" />
                        </PopoverContent>
                      </Popover>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Data Fim</Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !dataFim && "text-muted-foreground")}>
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {dataFim ? format(dataFim, "dd/MM/yyyy", { locale: ptBR }) : "Selecione"}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar mode="single" selected={dataFim} onSelect={(d) => { setDataFim(d); setPeriodoRapido(''); }} initialFocus locale={ptBR} className="p-3 pointer-events-auto" />
                        </PopoverContent>
                      </Popover>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Categoria</Label>
                      <Select value={categoriaFiltro} onValueChange={setCategoriaFiltro}>
                        <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="todas">Todas as Categorias</SelectItem>
                          {categorias.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  {(dataInicio || dataFim || categoriaFiltro !== 'todas') && (
                    <div className="mt-4 flex items-center justify-between">
                      <div className="text-sm text-muted-foreground">
                        Mostrando {campanhasFiltradas.length} de {campanhas.length} campanhas
                        {categoriaFiltro !== 'todas' && <span> • Categoria: <strong>{categorias.find(c => c.value === categoriaFiltro)?.label}</strong></span>}
                        {dataInicio && <span> • De: <strong>{format(dataInicio, "dd/MM/yyyy", { locale: ptBR })}</strong></span>}
                        {dataFim && <span> • Até: <strong>{format(dataFim, "dd/MM/yyyy", { locale: ptBR })}</strong></span>}
                      </div>
                      <Button variant="outline" size="sm" onClick={() => { limparFiltrosData(); setCategoriaFiltro('todas'); }} className="gap-1">
                        <X className="h-4 w-4" />
                        Limpar Filtros
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Metric Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
                <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Total Gasto</CardTitle><DollarSign className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="font-display text-[26px] leading-8 font-bold tabular-nums">{formatCurrency(metricas.totalGasto)}</div></CardContent></Card>
                <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Total Leads</CardTitle><Users className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="font-display text-[26px] leading-8 font-bold tabular-nums">{metricas.totalLeads}</div></CardContent></Card>
                <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Conversões</CardTitle><Target className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="font-display text-[26px] leading-8 font-bold tabular-nums">{metricas.totalConversoes}</div></CardContent></Card>
                <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">CPL Médio</CardTitle><TrendingUp className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="font-display text-[26px] leading-8 font-bold tabular-nums">{formatCurrency(metricas.cplMedio)}</div><p className="text-xs text-muted-foreground">Custo por Lead</p></CardContent></Card>
                <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">CPA Médio</CardTitle><BarChart3 className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="font-display text-[26px] leading-8 font-bold tabular-nums">{formatCurrency(metricas.cpaMedio)}</div><p className="text-xs text-muted-foreground">Custo por Aquisição</p></CardContent></Card>
                <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Taxa Conversão</CardTitle><Target className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="font-display text-[26px] leading-8 font-bold tabular-nums">{metricas.taxaConversaoMedia.toFixed(1)}%</div><p className="text-xs text-muted-foreground">Leads → Alunos</p></CardContent></Card>
              </div>

              {/* Charts */}
              {campanhasFiltradas.length > 0 && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <Card>
                    <CardHeader><CardTitle>Evolução do CPL e CPA</CardTitle></CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={300}>
                        <LineChart data={chartDataLine}>
                          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                          <XAxis dataKey="data" className="text-xs" />
                          <YAxis className="text-xs" />
                          <Tooltip formatter={(v: number) => formatCurrency(v)} contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }} />
                          <Legend />
                          <Line type="monotone" dataKey="CPL" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ fill: 'hsl(var(--primary))' }} />
                          <Line type="monotone" dataKey="CPA" stroke="hsl(var(--destructive))" strokeWidth={2} dot={{ fill: 'hsl(var(--destructive))' }} />
                        </LineChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader><CardTitle>Performance por Campanha</CardTitle></CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={chartDataBar}>
                          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                          <XAxis dataKey="nome" className="text-xs" />
                          <YAxis className="text-xs" />
                          <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }} />
                          <Legend />
                          <Bar dataKey="Leads" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                          <Bar dataKey="Conversões" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                </div>
              )}

              {/* Campaign Table */}
              <Card>
                <CardHeader>
                  <CardTitle>Histórico de Campanhas</CardTitle>
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <div className="text-center py-8 text-muted-foreground">Carregando...</div>
                  ) : campanhasFiltradas.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      {categoriaFiltro === 'todas' ? 'Nenhuma campanha cadastrada.' : `Nenhuma campanha encontrada para a categoria selecionada.`}
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Campanha</TableHead>
                            <TableHead>Categoria</TableHead>
                            <TableHead>Plataforma</TableHead>
                            <TableHead className="text-right">Gasto</TableHead>
                            <TableHead className="text-right">Leads</TableHead>
                            <TableHead className="text-right">Conv.</TableHead>
                            <TableHead className="text-right">CPL</TableHead>
                            <TableHead className="text-right">CPA</TableHead>
                            <TableHead className="text-center">Ações</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {campanhasFiltradas.map(campanha => {
                            const cpl = campanha.totalLeads > 0 ? campanha.totalGasto / campanha.totalLeads : 0;
                            const cpa = campanha.totalConversoes > 0 ? campanha.totalGasto / campanha.totalConversoes : 0;
                            return (
                              <TableRow key={campanha.id}>
                                <TableCell className="font-medium">
                                  <div>
                                    {campanha.nome}
                                    {campanha.lancamentos.length > 0 && (
                                      <span className="ml-2 text-xs text-muted-foreground">({campanha.lancamentos.length} lançamentos)</span>
                                    )}
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <span className="inline-flex items-center rounded-full px-2 py-1 text-xs font-medium bg-primary/10 text-primary">
                                    {categorias.find(c => c.value === campanha.categoria)?.label || campanha.categoria}
                                  </span>
                                </TableCell>
                                <TableCell>{campanha.plataforma}</TableCell>
                                <TableCell className="text-right">{formatCurrency(campanha.totalGasto)}</TableCell>
                                <TableCell className="text-right">{campanha.totalLeads}</TableCell>
                                <TableCell className="text-right">{campanha.totalConversoes}</TableCell>
                                <TableCell className="text-right">{formatCurrency(cpl)}</TableCell>
                                <TableCell className="text-right">{formatCurrency(cpa)}</TableCell>
                                <TableCell>
                                  <div className="flex items-center justify-center gap-1">
                                    <Button variant="ghost" size="icon" aria-label="Lançar" className="h-8 w-8" title="Lançar" onClick={() => openLancamentoDialog(campanha.id)}>
                                      <PlusCircle className="h-4 w-4 text-primary" />
                                    </Button>
                                    <DropdownMenu>
                                      <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" size="icon" aria-label="Mais ações" className="h-8 w-8">
                                          <MoreVertical className="h-4 w-4" />
                                        </Button>
                                      </DropdownMenuTrigger>
                                      <DropdownMenuContent align="end" className="w-52">
                                        <DropdownMenuItem onClick={() => setDetailCampanhaId(campanha.id)}>
                                          <Eye className="h-4 w-4 mr-2 text-ink-500" />
                                          Ver Detalhes
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => handleEdit(campanha)}>
                                          <Pencil className="h-4 w-4 mr-2 text-ink-500" />
                                          Editar
                                        </DropdownMenuItem>
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem onClick={() => handleDelete(campanha.id)} className="text-destructive focus:text-destructive">
                                          <Trash2 className="h-4 w-4 mr-2" />
                                          Excluir
                                        </DropdownMenuItem>
                                      </DropdownMenuContent>
                                    </DropdownMenu>
                                  </div>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
};

export default Reports;
