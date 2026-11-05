import { useState, useEffect, useMemo } from 'react';
import PageHeader from '@/components/PageHeader';
import Layout from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { getCursos, Curso } from '@/lib/cursos-storage';
import { getVendedores, getMyVendedorId, Vendedor } from '@/lib/vendedores-storage';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Plus, MoreHorizontal, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';
import { StudentCombobox } from '@/components/certificacao/StudentCombobox';
import { EditStudentDialog } from '@/components/certificacao/EditStudentDialog';
import { CertificacaoHistoryDialog } from '@/components/certificacao/CertificacaoHistoryDialog';
import { CertificacaoKPIs } from '@/components/certificacao/CertificacaoKPIs';
import { CertificacaoDiagnostics } from '@/components/certificacao/CertificacaoDiagnostics';
import { StudentSearchResult } from '@/hooks/useStudentSearch';
import {
  Certificacao as Cert,
  CertificacaoStatus,
  ResultadoContato,
  STATUS_LABELS,
  STATUS_ORDER,
  STATUS_BADGE_CLASS,
  RESULTADO_LABELS,
  CANAIS_ENTREGA,
  getCertificacoes,
  saveCertificacao,
  
  changeStatus,
  registrarContatoPos,
  isAtrasada,
  todayISO,
  diasParaConcluir,
} from '@/lib/certificacoes-storage';

const fmt = (d?: string | null) => (d ? format(new Date(d + 'T12:00:00'), 'dd/MM/yyyy') : '—');

export default function Certificacao() {
  const { hasRole } = useAuth();
  const isPrivileged = hasRole('admin') || hasRole('gerente') || hasRole('supervisor') || hasRole('financeiro');
  const isAdmin = hasRole('admin');
  const { toast } = useToast();

  const [certs, setCerts] = useState<Cert[]>([]);
  const [cursos, setCursos] = useState<Curso[]>([]);
  const [vendedores, setVendedores] = useState<Vendedor[]>([]);
  const [myVendedorId, setMyVendedorId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Filtros (Parte C)
  const [fBusca, setFBusca] = useState('');
  const [fStatus, setFStatus] = useState('todos');
  const [fNivel, setFNivel] = useState('todos');
  const [fCurso, setFCurso] = useState('todos');
  const [fVendedor, setFVendedor] = useState('todos');
  const [fInicio, setFInicio] = useState('');
  const [fFim, setFFim] = useState('');
  const [fApenasAtrasadas, setFApenasAtrasadas] = useState(false);
  const [fMostrarEntregues, setFMostrarEntregues] = useState(false);
  const [fMostrarCancelados, setFMostrarCancelados] = useState(false);

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Partial<Cert>>({});
  const [student, setStudent] = useState<StudentSearchResult | null>(null);
  const [editStudentOpen, setEditStudentOpen] = useState(false);

  const [historyId, setHistoryId] = useState<string | null>(null);
  const [deliverTarget, setDeliverTarget] = useState<Cert | null>(null);
  const [deliverForm, setDeliverForm] = useState({ data: todayISO(), canal: '' });
  const [cancelTarget, setCancelTarget] = useState<Cert | null>(null);
  const [cancelMotivo, setCancelMotivo] = useState('');
  const [etapaTarget, setEtapaTarget] = useState<Cert | null>(null);
  const [etapaForm, setEtapaForm] = useState<{ status: CertificacaoStatus | ''; data: string; canal: string; motivo: string }>({
    status: '', data: todayISO(), canal: '', motivo: '',
  });
  const [contatoTarget, setContatoTarget] = useState<Cert | null>(null);
  const [contatoForm, setContatoForm] = useState<{ data: string; resultado: ResultadoContato }>({
    data: todayISO(),
    resultado: 'interessado',
  });

  const loadAll = async () => {
    try {
      setLoading(true);
      const [c, cur, vens, myId] = await Promise.all([
        getCertificacoes(),
        getCursos(),
        getVendedores(true),
        getMyVendedorId(),
      ]);
      setCerts(c);
      setCursos(cur);
      setVendedores(vens);
      setMyVendedorId(myId);
    } catch (error) {
      toast({
        title: 'Erro ao carregar certificações',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  const niveisEnsino = useMemo(
    () => Array.from(new Set(cursos.map((c) => c.nivel_ensino).filter((n): n is string => !!n))).sort(),
    [cursos]
  );
  const cursosFiltrados = useMemo(
    () => cursos.filter((c) => !editing.nivel_ensino || c.nivel_ensino === editing.nivel_ensino),
    [cursos, editing.nivel_ensino]
  );
  const vendedorNomeMap = useMemo(() => new Map(vendedores.map((v) => [v.id, v.nome])), [vendedores]);

  const cursosDisponiveis = useMemo(
    () => Array.from(new Set(certs.map((c) => c.curso).filter((c): c is string => !!c))).sort(),
    [certs]
  );

  const certsFiltrados = useMemo(() => {
    const termo = fBusca.trim().toLowerCase();
    const digitos = termo.replace(/\D/g, '');
    const filtrados = certs.filter((c) => {
      if (fStatus !== 'todos' && c.status !== fStatus) return false;
      if (fNivel !== 'todos' && c.nivel_ensino !== fNivel) return false;
      if (fCurso !== 'todos' && c.curso !== fCurso) return false;
      if (fVendedor !== 'todos' && c.vendedor_id !== fVendedor) return false;
      if (fInicio && c.data_solicitacao < fInicio) return false;
      if (fFim && c.data_solicitacao > fFim) return false;
      if (fApenasAtrasadas && !isAtrasada(c)) return false;
      if (fStatus === 'todos' && c.status === 'entregue' && !fMostrarEntregues) return false;
      if (fStatus === 'todos' && c.status === 'cancelada' && !fMostrarCancelados) return false;
      if (termo) {
        const alvo = `${c.nome} ${c.email || ''} ${c.curso || ''} ${c.certificadora || ''}`.toLowerCase();
        const alvoDigitos = `${c.telefone || ''}${c.cpf || ''}`.replace(/\D/g, '');
        if (!alvo.includes(termo) && !(digitos.length >= 3 && alvoDigitos.includes(digitos))) return false;
      }
      return true;
    });
    // Entregues e cancelados sempre por último quando visíveis
    return filtrados.sort((a, b) => {
      const aOculto = a.status === 'entregue' || a.status === 'cancelada';
      const bOculto = b.status === 'entregue' || b.status === 'cancelada';
      if (aOculto && !bOculto) return 1;
      if (!aOculto && bOculto) return -1;
      return 0;
    });
  }, [certs, fBusca, fStatus, fNivel, fCurso, fVendedor, fInicio, fFim, fApenasAtrasadas, fMostrarEntregues, fMostrarCancelados]);


  // Duplicidade: mesmo aluno + mesmo curso, status diferente de cancelada
  const duplicata = useMemo(() => {
    if (!editing.aluno_id || !editing.curso) return null;
    return (
      certs.find(
        (c) =>
          c.id !== editing.id &&
          c.aluno_id === editing.aluno_id &&
          c.curso === editing.curso &&
          c.status !== 'cancelada'
      ) || null
    );
  }, [certs, editing.aluno_id, editing.curso, editing.id]);

  const openNew = () => {
    setStudent(null);
    setEditing({
      status: 'pendente_documentos',
      data_solicitacao: todayISO(),
      vendedor_id: isPrivileged ? undefined : myVendedorId || undefined,
      resultado_contato: 'nao_contatado',
      is_segunda_via: false,
      apto_nova_oferta: false,
    });
    setShowForm(true);
  };

  const openEdit = async (c: Cert) => {
    setEditing({ ...c });
    if (c.aluno_id) {
      const { data } = await supabase
        .from('students')
        .select('id, full_name, email, phone, cpf, academic_course')
        .eq('id', c.aluno_id)
        .maybeSingle();
      setStudent((data as StudentSearchResult) || null);
    } else {
      setStudent(null);
    }
    setShowForm(true);
  };

  const applyStudent = async (s: StudentSearchResult) => {
    setStudent(s);
    const patch: Partial<Cert> = {
      aluno_id: s.id,
      nome: s.full_name,
      email: s.email || '',
      telefone: s.phone || '',
      cpf: s.cpf || '',
    };
    // Busca a venda mais recente do aluno para nível, curso e vendedor
    const { data: sale } = await supabase
      .from('sales')
      .select('course, course_levels, vendedor_id')
      .ilike('student_name', s.full_name)
      .order('date', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (sale) {
      const lvl = (sale as { course_levels?: string[] }).course_levels?.[0];
      if (lvl) patch.nivel_ensino = lvl;
      if ((sale as { course?: string }).course) patch.curso = (sale as { course: string }).course;
      if ((sale as { vendedor_id?: string }).vendedor_id) patch.vendedor_id = (sale as { vendedor_id: string }).vendedor_id;
    } else if (s.academic_course) {
      patch.curso = s.academic_course;
    }
    setEditing((prev) => ({ ...prev, ...patch }));
  };

  const handleSave = async () => {
    if (!editing.aluno_id) {
      toast({ title: 'Selecione um aluno', variant: 'destructive' });
      return;
    }
    if (!editing.nivel_ensino) {
      toast({ title: 'Nível de ensino obrigatório', variant: 'destructive' });
      return;
    }
    if (!editing.curso) {
      toast({ title: 'Curso obrigatório', variant: 'destructive' });
      return;
    }
    if (duplicata && !editing.is_segunda_via) {
      toast({ title: 'Marque "É uma 2ª via" para prosseguir', variant: 'destructive' });
      return;
    }
    const payload = { ...editing };
    if (!isPrivileged && myVendedorId) payload.vendedor_id = myVendedorId;
    try {
      await saveCertificacao(payload);
      toast({ title: 'Sucesso!', description: 'Certificação salva com sucesso' });
      setShowForm(false);
      setEditing({});
      setStudent(null);
      loadAll();
    } catch (error) {
      toast({
        title: 'Erro ao salvar',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      });
    }
  };

  // Certificações nunca são excluídas — apenas canceladas, preservando todo o histórico.
  const handleCancelar = (c: Cert) => {
    setEtapaForm({ status: 'cancelada', data: todayISO(), canal: c.canal_entrega || '', motivo: '' });
    setEtapaTarget(c);
  };

  const openAlterarEtapa = (c: Cert) => {
    setEtapaForm({ status: '', data: todayISO(), canal: c.canal_entrega || '', motivo: '' });
    setEtapaTarget(c);
  };

  const confirmAlterarEtapa = async () => {
    if (!etapaTarget || !etapaForm.status) return;
    if (etapaForm.status === 'entregue' && (!etapaForm.data || !etapaForm.canal)) {
      toast({ title: 'Informe a data e o canal de entrega', variant: 'destructive' });
      return;
    }
    if (etapaForm.status === 'cancelada' && !etapaForm.motivo.trim()) {
      toast({ title: 'Informe o motivo do cancelamento', variant: 'destructive' });
      return;
    }
    try {
      await changeStatus(etapaTarget, etapaForm.status, {
        ...(etapaForm.status === 'entregue'
          ? { data_entrega: etapaForm.data, canal_entrega: etapaForm.canal }
          : {}),
        ...(etapaForm.status === 'cancelada' ? { motivo_cancelamento: etapaForm.motivo.trim() } : {}),
      });
      toast({ title: `Etapa alterada para ${STATUS_LABELS[etapaForm.status]}` });
      setEtapaTarget(null);
      loadAll();
    } catch (e) {
      toast({ title: 'Erro', description: e instanceof Error ? e.message : '', variant: 'destructive' });
    }
  };

  const markDelivered = (c: Cert) => {
    if (c.status !== 'certificado_emitido' && !isAdmin) {
      toast({
        title: 'Fluxo obrigatório',
        description: 'A certificação precisa estar em "Certificado emitido" antes da entrega.',
        variant: 'destructive',
      });
      return;
    }
    setDeliverForm({ data: todayISO(), canal: c.canal_entrega || '' });
    setDeliverTarget(c);
  };

  const confirmDeliver = async () => {
    if (!deliverTarget) return;
    if (deliverTarget.status !== 'certificado_emitido' && !isAdmin) {
      toast({ title: 'Fluxo obrigatório', variant: 'destructive' });
      return;
    }
    try {
      await changeStatus(deliverTarget, 'entregue', {
        data_entrega: deliverForm.data,
        canal_entrega: deliverForm.canal,
      });
      toast({ title: 'Certificação marcada como entregue' });
      setDeliverTarget(null);
      loadAll();
    } catch (e) {
      toast({ title: 'Erro', description: e instanceof Error ? e.message : '', variant: 'destructive' });
    }
  };

  const confirmCancel = async () => {
    if (!cancelTarget) return;
    try {
      await changeStatus(cancelTarget, 'cancelada', { motivo_cancelamento: cancelMotivo });
      toast({ title: 'Certificação cancelada' });
      setCancelTarget(null);
      setCancelMotivo('');
      loadAll();
    } catch (e) {
      toast({ title: 'Erro', description: e instanceof Error ? e.message : '', variant: 'destructive' });
    }
  };

  const confirmContato = async () => {
    if (!contatoTarget) return;
    try {
      await registrarContatoPos(contatoTarget.id, contatoForm.data, contatoForm.resultado);
      toast({ title: 'Contato registrado' });
      setContatoTarget(null);
      loadAll();
    } catch (e) {
      toast({ title: 'Erro', description: e instanceof Error ? e.message : '', variant: 'destructive' });
    }
  };

  const fmtDias = (c: Cert) => {
    const dias = diasParaConcluir(c);
    if (dias === null) return '—';
    if (dias < 0) return <span className="text-destructive font-medium">{Math.abs(dias)}d atrasado</span>;
    if (dias === 0) return <span className="text-warning font-medium">Hoje</span>;
    return `${dias}d`;
  };

  return (
    <Layout>
      <div className="space-y-6">
        <PageHeader
          title="Certificação"
          className="mb-0 items-center"
          actions={
            <>
            <CertificacaoDiagnostics certs={certsFiltrados} />
            <Button onClick={openNew}>
              <Plus className="mr-2 h-4 w-4" />
              Nova Certificação
            </Button>
            </>
          }
        />

        <CertificacaoKPIs certs={certsFiltrados} />

        <Card className="rounded-[14px] border-ink-200 shadow-card">
          <CardContent className="p-4 space-y-3">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <div className="space-y-1">
                <Label className="text-xs">Buscar</Label>
                <Input
                  value={fBusca}
                  onChange={(e) => setFBusca(e.target.value)}
                  placeholder="Nome, e-mail, CPF ou telefone"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Status</Label>
                <Select value={fStatus} onValueChange={setFStatus}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos</SelectItem>
                    {(Object.keys(STATUS_LABELS) as CertificacaoStatus[]).map((s) => (
                      <SelectItem key={s} value={s}>{STATUS_LABELS[s]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Nível de ensino</Label>
                <Select value={fNivel} onValueChange={setFNivel}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos</SelectItem>
                    {niveisEnsino.map((n) => <SelectItem key={n} value={n}>{n}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Curso</Label>
                <Select value={fCurso} onValueChange={setFCurso}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos</SelectItem>
                    {cursosDisponiveis.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Vendedor</Label>
                <Select value={fVendedor} onValueChange={setFVendedor}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos</SelectItem>
                    {vendedores.map((v) => <SelectItem key={v.id} value={v.id}>{v.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Data de matrícula de</Label>
                <Input type="date" value={fInicio} onChange={(e) => setFInicio(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Data de matrícula até</Label>
                <Input type="date" value={fFim} onChange={(e) => setFFim(e.target.value)} />
              </div>
              <div className="flex items-end gap-3 flex-wrap">
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox checked={fApenasAtrasadas} onCheckedChange={(v) => setFApenasAtrasadas(!!v)} />
                  Somente atrasadas
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox checked={fMostrarEntregues} onCheckedChange={(v) => setFMostrarEntregues(!!v)} />
                  Incluir entregues
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox checked={fMostrarCancelados} onCheckedChange={(v) => setFMostrarCancelados(!!v)} />
                  Incluir cancelados
                </label>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setFBusca(''); setFStatus('todos'); setFNivel('todos'); setFCurso('todos');
                    setFVendedor('todos'); setFInicio(''); setFFim(''); setFApenasAtrasadas(false);
                    setFMostrarEntregues(false); setFMostrarCancelados(false);
                  }}
                >
                  Limpar
                </Button>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              {certsFiltrados.length} de {certs.length} certificações exibidas
            </p>
          </CardContent>
        </Card>


        {showForm && (
          <Card className="rounded-[14px] border-ink-200 shadow-card">
            <CardHeader>
              <CardTitle>{editing.id ? 'Editar' : 'Nova'} Certificação</CardTitle>
              <CardDescription>Vincule a certificação a um aluno já cadastrado</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Aluno *</Label>
                <StudentCombobox
                  selected={student}
                  onSelect={applyStudent}
                  onClear={() => {
                    setStudent(null);
                    setEditing((p) => ({ ...p, aluno_id: undefined, nome: '', email: '', telefone: '', cpf: '' }));
                  }}
                />
                {student && (
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">Vindo do cadastro do aluno</Badge>
                    <Button variant="link" size="sm" className="h-auto p-0" onClick={() => setEditStudentOpen(true)}>
                      Editar dados do aluno
                    </Button>
                  </div>
                )}
              </div>

              {duplicata && (
                <div className="rounded-[12px] border border-[#F6C9A8] bg-[#FFF1E7] p-3 text-sm text-[#B44309] space-y-2">
                  <p className="flex items-center gap-2 font-medium">
                    <AlertTriangle className="h-4 w-4" />
                    Este aluno já possui certificação para este curso (status:{' '}
                    {STATUS_LABELS[duplicata.status]}, solicitada em {fmt(duplicata.data_solicitacao)}).
                  </p>
                  <label className="flex items-center gap-2">
                    <Checkbox
                      checked={!!editing.is_segunda_via}
                      onCheckedChange={(v) => setEditing({ ...editing, is_segunda_via: !!v })}
                    />
                    É uma 2ª via / nova certificação
                  </label>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input value={editing.email || ''} readOnly={!!student} placeholder="email@exemplo.com"
                    onChange={(e) => setEditing({ ...editing, email: e.target.value })} />
                  {student && !student.email && (
                    <p className="text-xs text-warning">Aluno sem e-mail no cadastro</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Telefone</Label>
                  <Input value={editing.telefone || ''} readOnly={!!student} placeholder="(00) 00000-0000"
                    onChange={(e) => setEditing({ ...editing, telefone: e.target.value })} />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Certificadora</Label>
                <Input
                  value={editing.certificadora || ''}
                  onChange={(e) => setEditing({ ...editing, certificadora: e.target.value })}
                  placeholder="Nome da certificadora"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Nível de Ensino *</Label>
                  <Select
                    value={editing.nivel_ensino || ''}
                    onValueChange={(v) => setEditing({ ...editing, nivel_ensino: v, curso: undefined })}
                  >
                    <SelectTrigger><SelectValue placeholder="Selecione o nível" /></SelectTrigger>
                    <SelectContent>
                      {niveisEnsino.map((n) => <SelectItem key={n} value={n}>{n}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Curso *</Label>
                  <Select
                    value={editing.curso || ''}
                    onValueChange={(v) => setEditing({ ...editing, curso: v })}
                    disabled={!editing.nivel_ensino}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={editing.nivel_ensino ? 'Selecione o curso' : 'Selecione o nível primeiro'} />
                    </SelectTrigger>
                    <SelectContent>
                      {cursosFiltrados.map((c) => <SelectItem key={c.id} value={c.nome}>{c.nome}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Vendedor Responsável</Label>
                  <Select
                    value={editing.vendedor_id || ''}
                    onValueChange={(v) => setEditing({ ...editing, vendedor_id: v })}
                    disabled={!isPrivileged}
                  >
                    <SelectTrigger><SelectValue placeholder="Selecione um vendedor" /></SelectTrigger>
                    <SelectContent>
                      {vendedores.map((v) => <SelectItem key={v.id} value={v.id}>{v.nome}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Prazo previsto</Label>
                  <Input
                    type="date"
                    value={editing.prazo_previsto || ''}
                    onChange={(e) => setEditing({ ...editing, prazo_previsto: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Data da solicitação</Label>
                  <Input
                    type="date"
                    value={editing.data_solicitacao || todayISO()}
                    onChange={(e) => setEditing({ ...editing, data_solicitacao: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select
                    value={editing.status || 'pendente_documentos'}
                    onValueChange={(v) => setEditing({ ...editing, status: v as CertificacaoStatus })}
                    disabled={!editing.id}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {STATUS_ORDER.filter((s) => s !== 'entregue').map((s) => (
                        <SelectItem key={s} value={s}>{STATUS_LABELS[s]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Promessa de Certificação</Label>
                  <Input
                    type="date"
                    value={editing.promessa_certificacao || ''}
                    onChange={(e) => setEditing({ ...editing, promessa_certificacao: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Previsão de Certificação</Label>
                  <Input
                    type="date"
                    value={editing.previsao_certificacao || ''}
                    onChange={(e) => setEditing({ ...editing, previsao_certificacao: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Notas</Label>
                <textarea
                  value={editing.notas || ''}
                  onChange={(e) => setEditing({ ...editing, notas: e.target.value })}
                  placeholder="Adicione notas sobre o andamento do trabalho..."
                  className="flex min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  rows={4}
                />
              </div>

              <div className="flex gap-2">
                <Button onClick={handleSave}>Salvar</Button>
                <Button variant="outline" onClick={() => { setShowForm(false); setEditing({}); setStudent(null); }}>
                  Cancelar
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        <Card className="rounded-[14px] border-ink-200 shadow-card">
          <CardContent className="p-0">
            {loading ? (
              <div className="py-12 text-center text-muted-foreground">Carregando...</div>
            ) : certsFiltrados.length === 0 ? (
              <div className="py-12 text-center">
                <p className="text-muted-foreground mb-4">
                  {certs.length === 0 ? 'Nenhuma certificação cadastrada ainda' : 'Nenhuma certificação encontrada com os filtros atuais'}
                </p>
                {certs.length === 0 && (
                  <Button onClick={openNew}><Plus className="mr-2 h-4 w-4" />Cadastrar primeira certificação</Button>
                )}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Aluno</TableHead>
                    <TableHead>Curso</TableHead>
                    <TableHead>Nível</TableHead>
                    <TableHead>Certificadora</TableHead>
                    <TableHead>Vendedor</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Data de matrícula</TableHead>
                    <TableHead>Previsão de entrega</TableHead>
                    <TableHead>Entrega</TableHead>
                    <TableHead>Dias para concluir</TableHead>
                    <TableHead>Recontato pós-entrega</TableHead>
                    <TableHead className="w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {certsFiltrados.map((c) => (
                    <TableRow key={c.id} className={isAtrasada(c) ? 'bg-destructive/5' : ''}>
                      <TableCell className="font-medium">
                        {c.nome}
                        {c.is_segunda_via && <Badge variant="outline" className="ml-2">2ª via</Badge>}
                        {isAtrasada(c) && <Badge className="ml-2 bg-[#FDECEC] text-[#B02121]">Atrasada</Badge>}
                      </TableCell>
                      <TableCell>{c.curso || '—'}</TableCell>
                      <TableCell>{c.nivel_ensino || '—'}</TableCell>
                      <TableCell>{c.certificadora || '—'}</TableCell>
                      <TableCell>{c.vendedor_id ? vendedorNomeMap.get(c.vendedor_id) || '—' : '—'}</TableCell>
                      <TableCell>
                        <Badge className={STATUS_BADGE_CLASS[c.status]}>{STATUS_LABELS[c.status]}</Badge>
                      </TableCell>
                      <TableCell>{fmt(c.data_solicitacao)}</TableCell>
                      <TableCell>{fmt(c.previsao_certificacao || c.prazo_previsto)}</TableCell>
                      <TableCell>{fmt(c.data_entrega)}</TableCell>
                      <TableCell>{fmtDias(c)}</TableCell>
                      <TableCell>{RESULTADO_LABELS[c.resultado_contato]}</TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" aria-label="Mais ações"><MoreHorizontal className="h-4 w-4" /></Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {c.status !== 'entregue' && c.status !== 'cancelada' && (
                              <DropdownMenuItem onClick={() => openAlterarEtapa(c)}>Alterar etapa</DropdownMenuItem>
                            )}
                            {c.status !== 'entregue' && c.status !== 'cancelada' && (
                              <DropdownMenuItem onClick={() => markDelivered(c)}>Marcar como entregue</DropdownMenuItem>
                            )}
                            {c.status !== 'cancelada' && (
                              <DropdownMenuItem
                                onClick={() => {
                                  setContatoForm({ data: todayISO(), resultado: 'interessado' });
                                  setContatoTarget(c);
                                }}
                              >
                                Registrar contato pós-entrega
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem onClick={() => setHistoryId(c.id)}>Ver histórico</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => openEdit(c)}>Editar</DropdownMenuItem>
                            {c.status !== 'cancelada' && (
                              <DropdownMenuItem onClick={() => { setCancelMotivo(''); setCancelTarget(c); }}>
                                Cancelar
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem className="text-destructive" onClick={() => handleCancelar(c)}>
                              Cancelar certificação
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <EditStudentDialog
        student={student}
        open={editStudentOpen}
        onOpenChange={setEditStudentOpen}
        onSaved={(s) => {
          setStudent(s);
          setEditing((p) => ({ ...p, nome: s.full_name, email: s.email || '', telefone: s.phone || '', cpf: s.cpf || '' }));
        }}
      />

      <CertificacaoHistoryDialog
        certificacaoId={historyId}
        open={!!historyId}
        onOpenChange={(v) => !v && setHistoryId(null)}
      />

      <Dialog open={!!etapaTarget} onOpenChange={(v) => !v && setEtapaTarget(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Alterar etapa</DialogTitle></DialogHeader>
          <div className="space-y-3">
            {etapaTarget && (
              <p className="text-sm text-muted-foreground">
                Etapa atual: <strong>{STATUS_LABELS[etapaTarget.status]}</strong>
              </p>
            )}
            <div className="space-y-1">
              <Label>Nova etapa *</Label>
              <Select value={etapaForm.status} onValueChange={(v) => setEtapaForm({ ...etapaForm, status: v as CertificacaoStatus })}>
                <SelectTrigger><SelectValue placeholder="Selecione a etapa" /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(STATUS_LABELS) as CertificacaoStatus[])
                    .filter((s) => s !== etapaTarget?.status)
                    .map((s) => (
                      <SelectItem key={s} value={s}>{STATUS_LABELS[s]}</SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            {etapaForm.status === 'entregue' && (
              <>
                <div className="space-y-1">
                  <Label>Data de entrega *</Label>
                  <Input type="date" value={etapaForm.data} onChange={(e) => setEtapaForm({ ...etapaForm, data: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label>Canal de entrega *</Label>
                  <Select value={etapaForm.canal} onValueChange={(v) => setEtapaForm({ ...etapaForm, canal: v })}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      {CANAIS_ENTREGA.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}
            {etapaForm.status === 'cancelada' && (
              <div className="space-y-1">
                <Label>Motivo do cancelamento *</Label>
                <Input value={etapaForm.motivo} onChange={(e) => setEtapaForm({ ...etapaForm, motivo: e.target.value })} placeholder="Descreva o motivo" />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEtapaTarget(null)}>Voltar</Button>
            <Button onClick={confirmAlterarEtapa} disabled={!etapaForm.status}>Confirmar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deliverTarget} onOpenChange={(v) => !v && setDeliverTarget(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Marcar como entregue</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Data de entrega *</Label>
              <Input type="date" value={deliverForm.data} onChange={(e) => setDeliverForm({ ...deliverForm, data: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>Canal de entrega *</Label>
              <Select value={deliverForm.canal} onValueChange={(v) => setDeliverForm({ ...deliverForm, canal: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {CANAIS_ENTREGA.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeliverTarget(null)}>Voltar</Button>
            <Button onClick={confirmDeliver}>Confirmar entrega</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!cancelTarget} onOpenChange={(v) => !v && setCancelTarget(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Cancelar certificação</DialogTitle></DialogHeader>
          <div className="space-y-1">
            <Label>Motivo do cancelamento *</Label>
            <Input value={cancelMotivo} onChange={(e) => setCancelMotivo(e.target.value)} placeholder="Descreva o motivo" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelTarget(null)}>Voltar</Button>
            <Button variant="destructive" onClick={confirmCancel}>Confirmar cancelamento</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!contatoTarget} onOpenChange={(v) => !v && setContatoTarget(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Registrar contato pós-entrega</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Data do contato</Label>
              <Input type="date" value={contatoForm.data} onChange={(e) => setContatoForm({ ...contatoForm, data: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>Resultado</Label>
              <Select
                value={contatoForm.resultado}
                onValueChange={(v) => setContatoForm({ ...contatoForm, resultado: v as ResultadoContato })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(RESULTADO_LABELS) as ResultadoContato[]).map((r) => (
                    <SelectItem key={r} value={r}>{RESULTADO_LABELS[r]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setContatoTarget(null)}>Voltar</Button>
            <Button onClick={confirmContato}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
