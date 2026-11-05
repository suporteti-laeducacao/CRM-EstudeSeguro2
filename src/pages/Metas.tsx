import { useState, useEffect } from 'react';
import Layout from '@/components/Layout';
import PageHeader from '@/components/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Pencil, Trash2, Target, Users, Filter } from 'lucide-react';
import { toast } from 'sonner';
import {
  MetaGeral, MetaVendedor,
  getMetasGerais, saveMetaGeral, deleteMetaGeral,
  getMetasVendedores, saveMetaVendedor, deleteMetaVendedor,
} from '@/lib/metas-storage';
import { getVendedores, Vendedor } from '@/lib/vendedores-storage';
import { format, endOfMonth, startOfMonth, parse } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const formatCurrency = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

const periodoLabels: Record<string, string> = {
  mensal: 'Mensal',
  trimestral: 'Trimestral',
  anual: 'Anual',
};

// Helper: convert "2026-03" to { data_inicio: "2026-03-01", data_fim: "2026-03-31" }
const monthToDates = (monthStr: string) => {
  if (!monthStr) return { data_inicio: '', data_fim: '' };
  const date = parse(monthStr + '-01', 'yyyy-MM-dd', new Date());
  return {
    data_inicio: format(startOfMonth(date), 'yyyy-MM-dd'),
    data_fim: format(endOfMonth(date), 'yyyy-MM-dd'),
  };
};

// Helper: convert data_inicio "2026-03-01" to "2026-03"
const datesToMonth = (dataInicio: string) => {
  if (!dataInicio) return '';
  return dataInicio.substring(0, 7);
};

const formatMesAno = (dataInicio: string) => {
  if (!dataInicio) return '-';
  try {
    const date = new Date(dataInicio + 'T12:00:00');
    return format(date, 'MMMM/yyyy', { locale: ptBR }).replace(/^\w/, c => c.toUpperCase());
  } catch { return dataInicio; }
};

const currentMonth = format(new Date(), 'yyyy-MM');

const Metas = () => {
  const [metasGerais, setMetasGerais] = useState<MetaGeral[]>([]);
  const [metasVendedores, setMetasVendedores] = useState<MetaVendedor[]>([]);
  const [vendedores, setVendedores] = useState<Vendedor[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [filterStatusGeral, setFilterStatusGeral] = useState('ativa');
  const [filterMesGeral, setFilterMesGeral] = useState(currentMonth);
  const [filterStatusVendedor, setFilterStatusVendedor] = useState('ativa');
  const [filterMesVendedor, setFilterMesVendedor] = useState(currentMonth);

  // Meta Geral form
  const [geralDialogOpen, setGeralDialogOpen] = useState(false);
  const [editingGeral, setEditingGeral] = useState<MetaGeral | null>(null);
  const [geralForm, setGeralForm] = useState({ valor: '', periodo: 'mensal', data_inicio: '', data_fim: '', mes_ref: '', ativo: true });

  // Meta Vendedor form
  const [vendedorDialogOpen, setVendedorDialogOpen] = useState(false);
  const [editingVendedor, setEditingVendedor] = useState<MetaVendedor | null>(null);
  const [vendedorForm, setVendedorForm] = useState({ vendedor_id: '', valor: '', periodo: 'mensal', data_inicio: '', data_fim: '', mes_ref: '', ativo: true });

  // Filter helper
  const filterMetas = <T extends { ativo: boolean; data_inicio: string; data_fim: string }>(
    metas: T[], statusFilter: string, mesFilter: string
  ): T[] => {
    const today = new Date().toISOString().split('T')[0];
    return metas.filter(m => {
      // Status filter
      if (statusFilter !== 'todos') {
        if (statusFilter === 'ativa' && (!m.ativo || m.data_fim < today)) return false;
        if (statusFilter === 'inativa' && m.ativo) return false;
        if (statusFilter === 'encerrada' && (!m.ativo || m.data_fim >= today)) return false;
      }
      // Month filter
      if (mesFilter) {
        const mesInicio = m.data_inicio.substring(0, 7);
        if (mesInicio !== mesFilter) return false;
      }
      return true;
    });
  };

  const filteredMetasGerais = filterMetas(metasGerais, filterStatusGeral, filterMesGeral);
  const filteredMetasVendedores = filterMetas(metasVendedores, filterStatusVendedor, filterMesVendedor);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const [mg, mv, v] = await Promise.all([getMetasGerais(), getMetasVendedores(), getVendedores()]);
      setMetasGerais(mg);
      setMetasVendedores(mv);
      setVendedores(v);
    } catch (e) {
      toast.error('Erro ao carregar metas');
    } finally {
      setLoading(false);
    }
  };

  // Meta Geral handlers
  const handleSaveGeral = async (e: React.FormEvent) => {
    e.preventDefault();
    let dataInicio = geralForm.data_inicio;
    let dataFim = geralForm.data_fim;
    if (geralForm.periodo === 'mensal') {
      const dates = monthToDates(geralForm.mes_ref);
      dataInicio = dates.data_inicio;
      dataFim = dates.data_fim;
    }
    if (!dataInicio || !dataFim) { toast.error('Preencha o período'); return; }
    try {
      await saveMetaGeral({
        id: editingGeral?.id,
        valor: parseFloat(geralForm.valor),
        periodo: geralForm.periodo,
        data_inicio: dataInicio,
        data_fim: dataFim,
        ativo: geralForm.ativo,
      });
      toast.success(editingGeral ? 'Meta atualizada!' : 'Meta criada!');
      setGeralDialogOpen(false);
      setEditingGeral(null);
      loadData();
    } catch { toast.error('Erro ao salvar meta'); }
  };

  const handleEditGeral = (m: MetaGeral) => {
    setEditingGeral(m);
    setGeralForm({
      valor: m.valor.toString(), periodo: m.periodo,
      data_inicio: m.data_inicio, data_fim: m.data_fim,
      mes_ref: m.periodo === 'mensal' ? datesToMonth(m.data_inicio) : '',
      ativo: m.ativo,
    });
    setGeralDialogOpen(true);
  };

  const handleDeleteGeral = async (id: string) => {
    if (!confirm('Excluir esta meta geral?')) return;
    try { await deleteMetaGeral(id); toast.success('Meta excluída!'); loadData(); }
    catch { toast.error('Erro ao excluir'); }
  };

  // Meta Vendedor handlers
  const handleSaveVendedor = async (e: React.FormEvent) => {
    e.preventDefault();
    let dataInicio = vendedorForm.data_inicio;
    let dataFim = vendedorForm.data_fim;
    if (vendedorForm.periodo === 'mensal') {
      const dates = monthToDates(vendedorForm.mes_ref);
      dataInicio = dates.data_inicio;
      dataFim = dates.data_fim;
    }
    if (!dataInicio || !dataFim) { toast.error('Preencha o período'); return; }
    try {
      await saveMetaVendedor({
        id: editingVendedor?.id,
        vendedor_id: vendedorForm.vendedor_id,
        valor: parseFloat(vendedorForm.valor),
        periodo: vendedorForm.periodo,
        data_inicio: dataInicio,
        data_fim: dataFim,
        ativo: vendedorForm.ativo,
      });
      toast.success(editingVendedor ? 'Meta atualizada!' : 'Meta criada!');
      setVendedorDialogOpen(false);
      setEditingVendedor(null);
      loadData();
    } catch { toast.error('Erro ao salvar meta'); }
  };

  const handleEditVendedor = (m: MetaVendedor) => {
    setEditingVendedor(m);
    setVendedorForm({
      vendedor_id: m.vendedor_id, valor: m.valor.toString(), periodo: m.periodo,
      data_inicio: m.data_inicio, data_fim: m.data_fim,
      mes_ref: m.periodo === 'mensal' ? datesToMonth(m.data_inicio) : '',
      ativo: m.ativo,
    });
    setVendedorDialogOpen(true);
  };

  const handleDeleteVendedor = async (id: string) => {
    if (!confirm('Excluir esta meta individual?')) return;
    try { await deleteMetaVendedor(id); toast.success('Meta excluída!'); loadData(); }
    catch { toast.error('Erro ao excluir'); }
  };

  // Reusable date fields component
  const DateFields = ({ periodo, mesRef, dataInicio, dataFim, onChange }: {
    periodo: string;
    mesRef: string;
    dataInicio: string;
    dataFim: string;
    onChange: (field: string, value: string) => void;
  }) => {
    if (periodo === 'mensal') {
      return (
        <div className="space-y-2">
          <Label>Mês de Referência</Label>
          <Input
            type="month"
            value={mesRef}
            onChange={e => onChange('mes_ref', e.target.value)}
            required
          />
        </div>
      );
    }
    return (
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Data Início</Label>
          <Input type="date" value={dataInicio} onChange={e => onChange('data_inicio', e.target.value)} required />
        </div>
        <div className="space-y-2">
          <Label>Data Fim</Label>
          <Input type="date" value={dataFim} onChange={e => onChange('data_fim', e.target.value)} required />
        </div>
      </div>
    );
  };

  return (
    <Layout>
      <div className="space-y-6">
        <PageHeader
          title="Gestão de Metas"
          subtitle="Configure metas gerais e individuais por vendedor"
          className="mb-0"
        />

        <Tabs defaultValue="geral" className="w-full">
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="geral" className="gap-2"><Target className="h-4 w-4" />Meta Geral</TabsTrigger>
            <TabsTrigger value="vendedores" className="gap-2"><Users className="h-4 w-4" />Por Vendedor</TabsTrigger>
          </TabsList>

          {/* META GERAL TAB */}
          <TabsContent value="geral" className="mt-6 space-y-4">
            <Dialog open={geralDialogOpen} onOpenChange={(o) => { setGeralDialogOpen(o); if (!o) setEditingGeral(null); }}>
              <DialogTrigger asChild>
                <Button className="gap-2" onClick={() => setGeralForm({ valor: '', periodo: 'mensal', data_inicio: '', data_fim: '', mes_ref: '', ativo: true })}>
                  <Plus className="h-4 w-4" />Nova Meta Geral
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>{editingGeral ? 'Editar Meta Geral' : 'Nova Meta Geral'}</DialogTitle></DialogHeader>
                <form onSubmit={handleSaveGeral} className="space-y-4">
                  <div className="space-y-2">
                    <Label>Valor da Meta (R$)</Label>
                    <Input type="number" step="0.01" value={geralForm.valor} onChange={e => setGeralForm({ ...geralForm, valor: e.target.value })} required />
                  </div>
                  <div className="space-y-2">
                    <Label>Período</Label>
                    <Select value={geralForm.periodo} onValueChange={v => setGeralForm({ ...geralForm, periodo: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="mensal">Mensal</SelectItem>
                        <SelectItem value="trimestral">Trimestral</SelectItem>
                        <SelectItem value="anual">Anual</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <DateFields
                    periodo={geralForm.periodo}
                    mesRef={geralForm.mes_ref}
                    dataInicio={geralForm.data_inicio}
                    dataFim={geralForm.data_fim}
                    onChange={(field, value) => setGeralForm({ ...geralForm, [field]: value })}
                  />
                  <div className="flex items-center gap-2">
                    <input type="checkbox" checked={geralForm.ativo} onChange={e => setGeralForm({ ...geralForm, ativo: e.target.checked })} id="geral-ativo" />
                    <Label htmlFor="geral-ativo">Ativa</Label>
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button type="button" variant="outline" onClick={() => setGeralDialogOpen(false)}>Cancelar</Button>
                    <Button type="submit">Salvar</Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>

            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <Select value={filterStatusGeral} onValueChange={setFilterStatusGeral}>
                  <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ativa">Ativas</SelectItem>
                    <SelectItem value="inativa">Inativas</SelectItem>
                    <SelectItem value="encerrada">Encerradas</SelectItem>
                    <SelectItem value="todos">Todos</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <Input
                  type="month"
                  value={filterMesGeral}
                  onChange={e => setFilterMesGeral(e.target.value)}
                  className="w-[170px]"
                />
                {filterMesGeral && (
                  <Button variant="ghost" size="sm" onClick={() => setFilterMesGeral('')}>Limpar</Button>
                )}
              </div>
            </div>

            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Valor</TableHead>
                      <TableHead>Período</TableHead>
                      <TableHead>Referência</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredMetasGerais.length === 0 ? (
                      <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Nenhuma meta geral encontrada</TableCell></TableRow>
                    ) : filteredMetasGerais.map(m => (
                      <TableRow key={m.id}>
                        <TableCell className="font-semibold">{formatCurrency(m.valor)}</TableCell>
                        <TableCell>{periodoLabels[m.periodo] || m.periodo}</TableCell>
                        <TableCell>
                          {m.periodo === 'mensal'
                            ? formatMesAno(m.data_inicio)
                            : `${format(new Date(m.data_inicio + 'T12:00:00'), 'dd/MM/yyyy')} — ${format(new Date(m.data_fim + 'T12:00:00'), 'dd/MM/yyyy')}`
                          }
                        </TableCell>
                        <TableCell>
                          {(() => {
                            const today = new Date().toISOString().split('T')[0];
                            if (!m.ativo) return <Badge variant="secondary">Inativa</Badge>;
                            if (m.data_fim < today) return <Badge variant="outline" className="border-muted-foreground text-muted-foreground">Encerrada</Badge>;
                            return <Badge variant="default">Ativa</Badge>;
                          })()}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="icon" aria-label="Editar meta" onClick={() => handleEditGeral(m)}><Pencil className="h-4 w-4" /></Button>
                          <Button variant="ghost" size="icon" aria-label="Excluir meta" onClick={() => handleDeleteGeral(m.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* META VENDEDOR TAB */}
          <TabsContent value="vendedores" className="mt-6 space-y-4">
            <Dialog open={vendedorDialogOpen} onOpenChange={(o) => { setVendedorDialogOpen(o); if (!o) setEditingVendedor(null); }}>
              <DialogTrigger asChild>
                <Button className="gap-2" onClick={() => setVendedorForm({ vendedor_id: '', valor: '', periodo: 'mensal', data_inicio: '', data_fim: '', mes_ref: '', ativo: true })}>
                  <Plus className="h-4 w-4" />Nova Meta Individual
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>{editingVendedor ? 'Editar Meta Individual' : 'Nova Meta Individual'}</DialogTitle></DialogHeader>
                <form onSubmit={handleSaveVendedor} className="space-y-4">
                  <div className="space-y-2">
                    <Label>Vendedor</Label>
                    <Select value={vendedorForm.vendedor_id} onValueChange={v => setVendedorForm({ ...vendedorForm, vendedor_id: v })}>
                      <SelectTrigger><SelectValue placeholder="Selecione o vendedor" /></SelectTrigger>
                      <SelectContent>
                        {vendedores.map(v => <SelectItem key={v.id} value={v.id}>{v.nome}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Valor da Meta (R$)</Label>
                    <Input type="number" step="0.01" value={vendedorForm.valor} onChange={e => setVendedorForm({ ...vendedorForm, valor: e.target.value })} required />
                  </div>
                  <div className="space-y-2">
                    <Label>Período</Label>
                    <Select value={vendedorForm.periodo} onValueChange={v => setVendedorForm({ ...vendedorForm, periodo: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="mensal">Mensal</SelectItem>
                        <SelectItem value="trimestral">Trimestral</SelectItem>
                        <SelectItem value="anual">Anual</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <DateFields
                    periodo={vendedorForm.periodo}
                    mesRef={vendedorForm.mes_ref}
                    dataInicio={vendedorForm.data_inicio}
                    dataFim={vendedorForm.data_fim}
                    onChange={(field, value) => setVendedorForm({ ...vendedorForm, [field]: value })}
                  />
                  <div className="flex items-center gap-2">
                    <input type="checkbox" checked={vendedorForm.ativo} onChange={e => setVendedorForm({ ...vendedorForm, ativo: e.target.checked })} id="vend-ativo" />
                    <Label htmlFor="vend-ativo">Ativa</Label>
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button type="button" variant="outline" onClick={() => setVendedorDialogOpen(false)}>Cancelar</Button>
                    <Button type="submit">Salvar</Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>

            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <Select value={filterStatusVendedor} onValueChange={setFilterStatusVendedor}>
                  <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ativa">Ativas</SelectItem>
                    <SelectItem value="inativa">Inativas</SelectItem>
                    <SelectItem value="encerrada">Encerradas</SelectItem>
                    <SelectItem value="todos">Todos</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <Input
                  type="month"
                  value={filterMesVendedor}
                  onChange={e => setFilterMesVendedor(e.target.value)}
                  className="w-[170px]"
                />
                {filterMesVendedor && (
                  <Button variant="ghost" size="sm" onClick={() => setFilterMesVendedor('')}>Limpar</Button>
                )}
              </div>
            </div>

            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Vendedor</TableHead>
                      <TableHead>Valor</TableHead>
                      <TableHead>Período</TableHead>
                      <TableHead>Referência</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredMetasVendedores.length === 0 ? (
                      <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Nenhuma meta individual encontrada</TableCell></TableRow>
                    ) : filteredMetasVendedores.map(m => (
                      <TableRow key={m.id}>
                        <TableCell className="font-medium">{m.vendedor?.nome || '-'}</TableCell>
                        <TableCell className="font-semibold">{formatCurrency(m.valor)}</TableCell>
                        <TableCell>{periodoLabels[m.periodo] || m.periodo}</TableCell>
                        <TableCell>
                          {m.periodo === 'mensal'
                            ? formatMesAno(m.data_inicio)
                            : `${format(new Date(m.data_inicio + 'T12:00:00'), 'dd/MM/yyyy')} — ${format(new Date(m.data_fim + 'T12:00:00'), 'dd/MM/yyyy')}`
                          }
                        </TableCell>
                        <TableCell>
                          {(() => {
                            const today = new Date().toISOString().split('T')[0];
                            if (!m.ativo) return <Badge variant="secondary">Inativa</Badge>;
                            if (m.data_fim < today) return <Badge variant="outline" className="border-muted-foreground text-muted-foreground">Encerrada</Badge>;
                            return <Badge variant="default">Ativa</Badge>;
                          })()}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="icon" aria-label="Editar meta do vendedor" onClick={() => handleEditVendedor(m)}><Pencil className="h-4 w-4" /></Button>
                          <Button variant="ghost" size="icon" aria-label="Excluir meta do vendedor" onClick={() => handleDeleteVendedor(m.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
};

export default Metas;
