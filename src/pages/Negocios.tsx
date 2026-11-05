import { useState, useEffect } from 'react';
import Layout from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { getNegocios, saveNegocio, deleteNegocio, getClientes } from '@/lib/crm-storage';
import { Negocio, Cliente } from '@/lib/crm-types';
import { getMyVendedorId, getVendedores, Vendedor } from '@/lib/vendedores-storage';
import { getCursos, Curso } from '@/lib/cursos-storage';
import { Plus, Trash2, DollarSign, Calendar as CalendarIcon, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { Calendar } from '@/components/ui/calendar';
import { format } from 'date-fns';
import { useAuth } from '@/hooks/useAuth';
import PageHeader from '@/components/PageHeader';

const statusColors = {
  novo: 'bg-ink-400',
  em_andamento: 'bg-warning',
  fechado: 'bg-success',
  perdido: 'bg-destructive',
};

const statusLabels = {
  novo: 'Novo',
  em_andamento: 'Em Andamento',
  fechado: 'Fechado',
  perdido: 'Perdido',
};

export default function Negocios() {
  const { user, hasRole, loading: authLoading } = useAuth();
  const [negocios, setNegocios] = useState<Negocio[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [vendedores, setVendedores] = useState<Vendedor[]>([]);
  const [cursos, setCursos] = useState<Curso[]>([]);
  const [loading, setLoading] = useState(true);
  const [myVendedorId, setMyVendedorId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingNegocio, setEditingNegocio] = useState<Partial<Negocio>>({ status: 'novo', follow_ups: [] });
  const [selectedNivel, setSelectedNivel] = useState<string>('');
  const [dataPopoverOpen, setDataPopoverOpen] = useState(false);
  const [followUpPopoverIdx, setFollowUpPopoverIdx] = useState<number | null>(null);
  const { toast } = useToast();

  const isPrivileged = hasRole('admin') || hasRole('gerente') || hasRole('supervisor');

  const loadNegocios = async () => {
    try {
      setLoading(true);

      let vendedorIdFiltro: string | undefined;
      if (!isPrivileged) {
        const myId = await getMyVendedorId();
        setMyVendedorId(myId);
        if (myId) vendedorIdFiltro = myId;
      } else {
        setMyVendedorId(null);
      }

      const [negociosData, clientesData, vendedoresData, cursosData] = await Promise.all([
        getNegocios(vendedorIdFiltro),
        getClientes(),
        getVendedores(true),
        getCursos(),
      ]);
      setNegocios(negociosData);
      setClientes(clientesData);
      setVendedores(vendedoresData);
      setCursos(cursosData);
    } catch (error) {
      toast({
        title: 'Erro ao carregar dados',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading && user) loadNegocios();
  }, [authLoading, user, isPrivileged]);

  useEffect(() => {
    if (!showForm) return;
    if (isPrivileged) return;
    if (!myVendedorId) return;

    setEditingNegocio((prev) => ({
      ...prev,
      vendedor_id: prev.vendedor_id ?? myVendedorId,
    }));
  }, [showForm, isPrivileged, myVendedorId]);

  const handleSave = async () => {
    if (!editingNegocio.curso) {
      toast({
        title: 'Curso obrigatório',
        description: 'Por favor, selecione o curso',
        variant: 'destructive',
      });
      return;
    }

    try {
      const payload = { ...editingNegocio };
      if (!isPrivileged && myVendedorId) payload.vendedor_id = myVendedorId;
      await saveNegocio(payload);
      toast({
        title: 'Sucesso!',
        description: 'Negócio salvo com sucesso',
      });
      setShowForm(false);
      setEditingNegocio({ status: 'novo', follow_ups: [] });
      setSelectedNivel('');
      loadNegocios();
    } catch (error) {
      toast({
        title: 'Erro ao salvar',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este negócio?')) return;

    try {
      await deleteNegocio(id);
      toast({
        title: 'Sucesso!',
        description: 'Negócio excluído com sucesso',
      });
      loadNegocios();
    } catch (error) {
      toast({
        title: 'Erro ao excluir',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      });
    }
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex justify-between items-start gap-3">
          <PageHeader title="Previsão de vendas" className="mb-0" />
          <Button onClick={() => setShowForm(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Novo Negócio
          </Button>
        </div>

        <Card>
          <CardContent className="py-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-ink-400" />
              <span className="text-[13.5px] text-ink-500">Total previsto ({negocios.length} {negocios.length === 1 ? 'negócio' : 'negócios'})</span>
            </div>
            <span className="font-display text-[34px] leading-none tabular-nums text-ink-950">
              R$ {negocios.reduce((sum, n) => sum + (n.valor || 0), 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </span>
          </CardContent>
        </Card>

        {showForm && (
          <Card>
            <CardHeader>
              <CardTitle>{editingNegocio.id ? 'Editar' : 'Novo'} Negócio</CardTitle>
              <CardDescription>Preencha os dados do negócio</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Nível de Ensino *</Label>
                  <Select
                    value={selectedNivel}
                    onValueChange={(value) => {
                      setSelectedNivel(value);
                      setEditingNegocio({ ...editingNegocio, curso: '' });
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o nível" />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from(new Set(cursos.map((c) => c.nivel_ensino).filter((n): n is string => !!n))).sort().map((n) => (
                        <SelectItem key={n} value={n}>
                          {n}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Curso *</Label>
                  <Select
                    value={editingNegocio.curso || ''}
                    onValueChange={(value) => setEditingNegocio({ ...editingNegocio, curso: value })}
                    disabled={!selectedNivel}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={selectedNivel ? 'Selecione o curso' : 'Selecione o nível primeiro'} />
                    </SelectTrigger>
                    <SelectContent>
                      {cursos.filter((c) => c.nivel_ensino === selectedNivel).map((c) => (
                        <SelectItem key={c.id} value={c.nome}>
                          {c.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="descricao">Descrição</Label>
                <Textarea
                  id="descricao"
                  value={editingNegocio.descricao || ''}
                  onChange={(e) => setEditingNegocio({ ...editingNegocio, descricao: e.target.value })}
                  placeholder="Descreva os detalhes do negócio"
                  rows={3}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="valor">Valor</Label>
                <Input
                  id="valor"
                  type="number"
                  value={editingNegocio.valor || ''}
                  onChange={(e) => setEditingNegocio({ ...editingNegocio, valor: Number(e.target.value) })}
                  placeholder="0.00"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="status">Status *</Label>
                <Select
                  value={editingNegocio.status}
                  onValueChange={(value) => setEditingNegocio({ ...editingNegocio, status: value as Negocio['status'] })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="novo">Novo</SelectItem>
                    <SelectItem value="em_andamento">Em Andamento</SelectItem>
                    <SelectItem value="fechado">Fechado</SelectItem>
                    <SelectItem value="perdido">Perdido</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="cliente">Cliente</Label>
                <Input
                  id="cliente"
                  value={editingNegocio.cliente_nome || ''}
                  onChange={(e) => setEditingNegocio({ ...editingNegocio, cliente_nome: e.target.value })}
                  placeholder="Nome do cliente"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="vendedor">Vendedor Responsável</Label>
                <Select
                  value={editingNegocio.vendedor_id || ''}
                  onValueChange={(value) => setEditingNegocio({ ...editingNegocio, vendedor_id: value })}
                  disabled={!isPrivileged}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um vendedor" />
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
              <div className="space-y-2">
                <Label htmlFor="telefone">Telefone</Label>
                <Input
                  id="telefone"
                  type="tel"
                  value={editingNegocio.telefone || ''}
                  onChange={(e) => setEditingNegocio({ ...editingNegocio, telefone: e.target.value })}
                  placeholder="(00) 00000-0000"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="data">Data</Label>
                <Popover open={dataPopoverOpen} onOpenChange={setDataPopoverOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !editingNegocio.data && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {editingNegocio.data ? format(new Date(editingNegocio.data + 'T00:00:00'), "dd/MM/yyyy") : <span>Selecione a data</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={editingNegocio.data ? new Date(editingNegocio.data + 'T00:00:00') : undefined}
                      onSelect={(date) => {
                        setEditingNegocio({ 
                          ...editingNegocio, 
                          data: date ? format(date, 'yyyy-MM-dd') : undefined 
                        });
                        setDataPopoverOpen(false);
                      }}
                      initialFocus
                      className="pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Follow-ups</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setEditingNegocio({
                        ...editingNegocio,
                        follow_ups: [...(editingNegocio.follow_ups || []), ''],
                      })
                    }
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    Adicionar follow-up
                  </Button>
                </div>
                {(editingNegocio.follow_ups || []).length === 0 && (
                  <p className="text-xs text-muted-foreground">Nenhum follow-up adicionado.</p>
                )}
                <div className="space-y-2">
                  {(editingNegocio.follow_ups || []).map((fu, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <Popover
                        open={followUpPopoverIdx === idx}
                        onOpenChange={(open) => setFollowUpPopoverIdx(open ? idx : null)}
                      >
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className={cn(
                              'flex-1 justify-start text-left font-normal',
                              !fu && 'text-muted-foreground'
                            )}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {fu ? format(new Date(fu + 'T00:00:00'), 'dd/MM/yyyy') : `Follow-up ${idx + 1}`}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={fu ? new Date(fu + 'T00:00:00') : undefined}
                            onSelect={(date) => {
                              const next = [...(editingNegocio.follow_ups || [])];
                              next[idx] = date ? format(date, 'yyyy-MM-dd') : '';
                              setEditingNegocio({ ...editingNegocio, follow_ups: next });
                              setFollowUpPopoverIdx(null);
                            }}
                            initialFocus
                            className="pointer-events-auto"
                          />
                        </PopoverContent>
                      </Popover>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon" aria-label="Remover"
                        onClick={() => {
                          const next = (editingNegocio.follow_ups || []).filter((_, i) => i !== idx);
                          setEditingNegocio({ ...editingNegocio, follow_ups: next });
                        }}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex gap-2">
                <Button onClick={handleSave}>Salvar</Button>
                <Button variant="outline" onClick={() => {
                  setShowForm(false);
                  setEditingNegocio({ status: 'novo', follow_ups: [] });
                  setSelectedNivel('');
                }}>
                  Cancelar
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {loading ? (
          <div className="text-center py-12">Carregando...</div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {negocios.map((negocio) => {
              // Get current date in Brasilia timezone (UTC-3)
              const now = new Date();
              const brasiliaOffset = -3 * 60; // -3 hours in minutes
              const localOffset = now.getTimezoneOffset();
              const brasiliaTime = new Date(now.getTime() + (localOffset + brasiliaOffset) * 60 * 1000);
              const today = format(brasiliaTime, 'yyyy-MM-dd');
              
              // Calculate tomorrow for yellow highlight
              const tomorrow = new Date(brasiliaTime);
              tomorrow.setDate(tomorrow.getDate() + 1);
              const tomorrowStr = format(tomorrow, 'yyyy-MM-dd');

              // Check if any follow-up matches today (red) or tomorrow (yellow)
              const allFollowUps = [negocio.follow_up_1, negocio.follow_up_2, ...(negocio.follow_ups || [])].filter(Boolean) as string[];
              const isFollowUpToday = allFollowUps.includes(today);
              const isFollowUpTomorrow = allFollowUps.includes(tomorrowStr);

              return (
                <Card 
                  key={negocio.id}
                  className={cn(
                    isFollowUpToday && "border-destructive bg-[#FDECEC]",
                    isFollowUpTomorrow && !isFollowUpToday && "border-warning bg-[#FFF1E7]"
                  )}
                >
                  <CardHeader>
                    <CardTitle className="flex justify-between items-start">
                      <span>{negocio.curso}</span>
                      <Button
                        variant="ghost"
                        size="icon" aria-label="Excluir previsão"
                        onClick={() => handleDelete(negocio.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </CardTitle>
                    <Badge className={statusColors[negocio.status]}>
                      {statusLabels[negocio.status]}
                    </Badge>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {negocio.valor && (
                      <div className="flex items-center gap-2 text-lg font-semibold text-ink-950">
                        <DollarSign className="h-5 w-5 text-ink-400" />
                        <span className="tabular-nums">R$ {negocio.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                      </div>
                    )}
                    {negocio.cliente_nome && (
                      <div className="text-sm text-muted-foreground">
                        Cliente: {negocio.cliente_nome}
                      </div>
                    )}
                    {negocio.vendedor && (
                      <div className="text-sm text-muted-foreground">
                        Vendedor: {negocio.vendedor.nome}
                      </div>
                    )}
                    {negocio.telefone && (
                      <div className="text-sm text-muted-foreground">
                        Telefone: {negocio.telefone}
                      </div>
                    )}
                    {negocio.data && (
                      <div className="text-sm text-muted-foreground">
                        Data: {format(new Date(negocio.data + 'T00:00:00'), 'dd/MM/yyyy')}
                      </div>
                    )}
                    {negocio.follow_up_1 && (
                      <div className="text-sm text-muted-foreground">
                        Follow-up 1: {format(new Date(negocio.follow_up_1 + 'T00:00:00'), 'dd/MM/yyyy')}
                      </div>
                    )}
                    {negocio.follow_up_2 && (
                      <div className="text-sm text-muted-foreground">
                        Follow-up 2: {format(new Date(negocio.follow_up_2 + 'T00:00:00'), 'dd/MM/yyyy')}
                      </div>
                    )}
                    {(negocio.follow_ups || []).map((fu, idx) => fu && (
                      <div key={idx} className="text-sm text-muted-foreground">
                        Follow-up {idx + 1 + (negocio.follow_up_1 ? 1 : 0) + (negocio.follow_up_2 ? 1 : 0)}: {format(new Date(fu + 'T00:00:00'), 'dd/MM/yyyy')}
                      </div>
                    ))}
                    <Button
                      variant="outline"
                      className="w-full mt-4"
                      onClick={() => {
                        setEditingNegocio({ ...negocio, follow_ups: negocio.follow_ups || [] });
                        const nivel = cursos.find((c) => c.nome === negocio.curso)?.nivel_ensino || '';
                        setSelectedNivel(nivel);
                        setShowForm(true);
                      }}
                    >
                      Editar
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {!loading && negocios.length === 0 && (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground mb-4">Nenhum negócio cadastrado ainda</p>
              <Button onClick={() => setShowForm(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Cadastrar primeiro negócio
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

    </Layout>
  );
}
