import { toast } from 'sonner';
import { useEffect, useMemo, useState } from 'react';
import Layout from '@/components/Layout';
import PageHeader from '@/components/PageHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useCobrancas, CobrancaItem } from '@/hooks/useCobrancas';
import CobrancaCard, { fmtData, fmtMoeda } from '@/components/cobrancas/CobrancaCard';
import { AgendarDialog, CANAIS, TimelineDialog } from '@/components/cobrancas/CobrancaDialogs';
import { MarcarPagoDialog } from '@/components/cobrancas/MarcarPagoDialog';
import { resolverPromessa } from '@/lib/cobrancas-storage';
import { RegistrarCobrancaFluxoDialog, RegistrarRetornoDialog, ResolverEstadoDialog, MedidaEspecialDialog } from '@/components/cobrancas/RegistroFluxoDialogs';
import { canViewHistoricoGeral, getReguaEtapas } from '@/lib/cobrancas-storage';

const db = supabase as any;
const T = 'todos';

const Cobrancas = () => {
  const { userRoles } = useAuth();
  const podeHistorico = canViewHistoricoGeral(userRoles);
  const { itens, loading, reload, responsaveis, hoje } = useCobrancas();
  const nomes = useMemo(() => new Map(responsaveis), [responsaveis]);
  const [etapas, setEtapas] = useState<any[]>([]);
  useEffect(() => { getReguaEtapas().then((e: any) => setEtapas(e || [])).catch(() => {}); }, []);

  const [abrir, setAbrir] = useState<CobrancaItem | null>(null);
  const [registrar, setRegistrar] = useState<{ c: CobrancaItem; tipo: 'cobranca' | 'retorno' } | null>(null);
  const [agendar, setAgendar] = useState<CobrancaItem | null>(null);
  const [pago, setPago] = useState<{ c: CobrancaItem; promessaObs?: string } | null>(null);
  const [medida, setMedida] = useState<{ c: CobrancaItem; tipo: string } | null>(null);
  const [resolver, setResolver] = useState<{ c: CobrancaItem; modo: 'promessa' | 'renegociacao' } | null>(null);

  // filtros
  const [busca, setBusca] = useState('');
  const [fResp, setFResp] = useState(T);
  const [fAtraso, setFAtraso] = useState(T);
  const [fEtapa, setFEtapa] = useState(T);
  const [fStatus, setFStatus] = useState(T);
  const [fPromessa, setFPromessa] = useState(T);
  const [fReneg, setFReneg] = useState(T);
  const [fInat, setFInat] = useState(T);
  const [fNeg, setFNeg] = useState(T);
  const [fUltDe, setFUltDe] = useState('');
  const [fUltAte, setFUltAte] = useState('');
  const [fValorMin, setFValorMin] = useState('');
  const [fValorMax, setFValorMax] = useState('');

  const aplicar = (lista: CobrancaItem[]) => {
    const termo = busca.trim().toLowerCase();
    return lista.filter((c) => {
      if (termo && !`${c.alunoNome} ${c.curso}`.toLowerCase().includes(termo)) return false;
      if (fResp !== T && c.responsavelId !== fResp) return false;
      if (fAtraso !== T) {
        const [min, max] = fAtraso.split('-').map(Number);
        if (c.diasAtraso < min || (max && c.diasAtraso > max)) return false;
      }
      if (fEtapa !== T && c.etapaId !== fEtapa) return false;
      if (fStatus !== T && c.situacao !== fStatus) return false;
      if (fPromessa === 'ativa' && !c.promessaAtiva) return false;
      if (fPromessa === 'nao_cumprida' && !c.promessaNaoCumprida) return false;
      if (fPromessa === 'sem' && (c.promessaAtiva || c.promessaNaoCumprida)) return false;
      if (fReneg === 'sim' && !c.renegociacaoAtiva) return false;
      if (fReneg === 'nao' && c.renegociacaoAtiva) return false;
      const ac = (tipo: string, st: string) => c.acoes.some((a) => a.tipo === tipo && a.status === st);
      if (fInat !== T && !ac('inativacao', fInat)) return false;
      if (fNeg === 'aviso' && !c.acoes.some((a) => a.tipo === 'aviso_negativacao' && a.status !== 'cancelada')) return false;
      if ((fNeg === 'pendente' || fNeg === 'confirmada') && !ac('negativacao', fNeg)) return false;
      const ult = c.ultimaAcaoEm?.slice(0, 10);
      if (fUltDe && (!ult || ult < fUltDe)) return false;
      if (fUltAte && (!ult || ult > fUltAte)) return false;
      if (fValorMin && c.totalAberto < Number(fValorMin)) return false;
      if (fValorMax && c.totalAberto > Number(fValorMax)) return false;
      return true;
    });
  };

  const ativas = itens.filter((c) => c.situacao === 'ativa');
  const por = (s: string) => aplicar(ativas.filter((c) => c.situacaoOperacional === s));
  const hojeL = por('hoje'), atrasL = por('atrasados'), agendL = por('agendados'), semL = por('sem_agendamento');

  const kpi = (label: string, value: string | number, danger?: boolean) => (
    <Card className="rounded-[14px] border-ink-200 shadow-card">
      <CardContent className="p-4">
        <p className="text-[12.5px] font-medium text-ink-500">{label}</p>
        <p className={`font-display text-[26px] leading-8 font-extrabold tabular-nums whitespace-nowrap ${danger ? 'text-destructive' : 'text-ink-950'}`}>{value}</p>
      </CardContent>
    </Card>
  );

  const lista = (items: CobrancaItem[], vazio: string) =>
    items.length === 0 ? <p className="text-sm text-muted-foreground py-8 text-center">{vazio}</p> : (
      <div className="grid gap-3">
        {items.map((c) => (
          <CobrancaCard key={c.id} cobranca={c} onAbrir={setAbrir} onRegistrar={(x, tipo) => setRegistrar({ c: x, tipo })} onAgendar={setAgendar} onResolver={(x, modo) => setResolver({ c: x, modo })} onMedida={(x, tipo) => setMedida({ c: x, tipo })} onPagar={(x) => setPago({ c: x })} hoje={hoje} />
        ))}
      </div>
    );

  const sel = (value: string, set: (v: string) => void, opts: [string, string][], todos: string) => (
    <Select value={value} onValueChange={set}>
      <SelectTrigger><SelectValue /></SelectTrigger>
      <SelectContent>
        <SelectItem value={T}>{todos}</SelectItem>
        {opts.map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
      </SelectContent>
    </Select>
  );

  return (
    <Layout>
      <div className="space-y-6">
        <PageHeader title="Gestão de Cobranças" subtitle="Acompanhe, registre e organize as cobranças financeiras dos alunos." className="mb-0" />

        <div className="grid gap-3 grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {kpi('Cobranças para hoje', ativas.filter((c) => c.situacaoOperacional === 'hoje').length)}
          {kpi('Cobranças atrasadas', ativas.filter((c) => c.situacaoOperacional === 'atrasados').length, true)}
          {kpi('Promessas para hoje', ativas.filter((c) => c.promessaAtiva?.data === hoje).length)}
          {kpi('Sem agendamento', ativas.filter((c) => c.situacaoOperacional === 'sem_agendamento').length)}
          {kpi('Valor total em aberto', fmtMoeda(ativas.reduce((s, c) => s + c.totalAberto, 0)))}
          {kpi('Valor total em atraso', fmtMoeda(ativas.reduce((s, c) => s + c.valorAtraso, 0)), true)}
        </div>

        <Card className="rounded-[14px] border-ink-200 shadow-card">
          <CardContent className="p-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Input placeholder="Buscar aluno ou curso" value={busca} onChange={(e) => setBusca(e.target.value)} />
            {sel(fResp, setFResp, responsaveis, 'Todos os responsáveis')}
            {sel(fAtraso, setFAtraso, [['1-15', '1 a 15 dias'], ['16-30', '16 a 30 dias'], ['31-60', '31 a 60 dias'], ['61-90', '61 a 90 dias'], ['91-', 'Mais de 90 dias']], 'Qualquer atraso')}
            {sel(fEtapa, setFEtapa, etapas.map((e) => [e.id, e.codigo]), 'Todas as etapas')}
            {sel(fStatus, setFStatus, [['ativa', 'Ativa'], ['encerrada', 'Encerrada']], 'Todos os status')}
            {sel(fPromessa, setFPromessa, [['ativa', 'Promessa ativa'], ['nao_cumprida', 'Promessa não cumprida'], ['sem', 'Sem promessa']], 'Promessa: todas')}
            {sel(fReneg, setFReneg, [['sim', 'Em renegociação'], ['nao', 'Sem renegociação']], 'Renegociação: todas')}
            {sel(fInat, setFInat, [['pendente', 'Inativação pendente'], ['confirmada', 'Plataforma inativada']], 'Inativação: todas')}
            {sel(fNeg, setFNeg, [['aviso', 'Aviso de negativação'], ['pendente', 'Negativação pendente'], ['confirmada', 'Negativado']], 'Negativação: todas')}
            <div className="flex gap-2 items-center">
              <Input type="date" value={fUltDe} onChange={(e) => setFUltDe(e.target.value)} aria-label="Última cobrança de" title="Última cobrança de" />
              <Input type="date" value={fUltAte} onChange={(e) => setFUltAte(e.target.value)} aria-label="Última cobrança até" title="Última cobrança até" />
            </div>
            <div className="flex gap-2">
              <Input type="number" placeholder="Valor mín." value={fValorMin} onChange={(e) => setFValorMin(e.target.value)} />
              <Input type="number" placeholder="Valor máx." value={fValorMax} onChange={(e) => setFValorMax(e.target.value)} />
            </div>
          </CardContent>
        </Card>

        {loading ? <p className="text-muted-foreground">Carregando...</p> : (
          <Tabs defaultValue="hoje">
            <TabsList>
              <TabsTrigger value="hoje">Hoje ({hojeL.length})</TabsTrigger>
              <TabsTrigger value="atrasados">Atrasados ({atrasL.length})</TabsTrigger>
              <TabsTrigger value="agendados">Agendados ({agendL.length})</TabsTrigger>
              <TabsTrigger value="sem">Sem Agendamento ({semL.length})</TabsTrigger>
              {podeHistorico && <TabsTrigger value="historico">Histórico</TabsTrigger>}
            </TabsList>
            <TabsContent value="hoje" className="mt-4">{lista(hojeL, 'Nenhuma cobrança para hoje.')}</TabsContent>
            <TabsContent value="atrasados" className="mt-4">{lista(atrasL, 'Nenhuma cobrança atrasada.')}</TabsContent>
            <TabsContent value="agendados" className="mt-4">{lista(agendL, 'Nenhuma cobrança agendada.')}</TabsContent>
            <TabsContent value="sem" className="mt-4 space-y-3">
              <p className="text-sm text-muted-foreground">Estas cobranças continuam ativas, porém estão sem uma próxima ação programada.</p>
              {lista(semL, 'Nenhuma cobrança sem agendamento.')}
            </TabsContent>
            {podeHistorico && (
              <TabsContent value="historico" className="mt-4">
                <HistoricoGeral itens={itens} nomes={nomes} etapas={etapas} />
              </TabsContent>
            )}
          </Tabs>
        )}
      </div>

      <TimelineDialog alvo={abrir} onClose={() => setAbrir(null)} nomes={nomes} />
      <RegistrarCobrancaFluxoDialog alvo={registrar?.tipo === 'cobranca' ? registrar.c : null} onClose={() => setRegistrar(null)} onSaved={reload} />
      <RegistrarRetornoDialog alvo={registrar?.tipo === 'retorno' ? registrar.c : null} onClose={() => setRegistrar(null)} onSaved={reload} />
      <MarcarPagoDialog alvo={pago?.c ?? null} titulo={pago?.promessaObs !== undefined ? 'Confirmar pagamento da promessa' : undefined}
        onClose={() => setPago(null)}
        onPaid={async (instId) => {
          if (instId && pago?.promessaObs !== undefined) {
            try { await resolverPromessa(pago.c.id, 'pago', pago.promessaObs || undefined); } catch { /* cobrança já encerrada com promessa cumprida */ }
            toast.success('Promessa cumprida.');
          }
          reload();
        }} />
      <MedidaEspecialDialog alvo={medida} onClose={() => setMedida(null)} onSaved={reload} />
      <ResolverEstadoDialog alvo={resolver?.c ?? null} modo={resolver?.modo ?? 'promessa'} onClose={() => setResolver(null)} onSaved={reload} onPedirBaixa={(x, obs) => setPago({ c: x, promessaObs: obs })} />
      <AgendarDialog alvo={agendar} onClose={() => setAgendar(null)} onSaved={reload} />
    </Layout>
  );
};

const TIPOS_ACAO: [string, string][] = [
  ['cobranca', 'Cobrança'], ['retorno', 'Retorno'], ['observacao', 'Observação'], ['promessa', 'Promessa'],
  ['renegociacao', 'Renegociação'], ['agendamento_manual', 'Agendamento manual'], ['inativacao', 'Inativação'],
  ['aviso_negativacao', 'Aviso de negativação'], ['negativacao', 'Negativação'], ['encerramento', 'Encerramento'], ['reabertura', 'Reabertura'],
];

const HistoricoGeral = ({ itens, nomes, etapas }: { itens: CobrancaItem[]; nomes: Map<string, string>; etapas: any[] }) => {
  const [eventos, setEventos] = useState<any[] | null>(null);
  const [aluno, setAluno] = useState('');
  const [operador, setOperador] = useState(T);
  const [resp, setResp] = useState(T);
  const [de, setDe] = useState('');
  const [ate, setAte] = useState('');
  const [canal, setCanal] = useState(T);
  const [acao, setAcao] = useState(T);
  const [etapa, setEtapa] = useState(T);
  const [matricula, setMatricula] = useState('');
  const [parcela, setParcela] = useState('');

  useEffect(() => {
    (async () => {
      const all: any[] = [];
      let from = 0;
      while (true) {
        const { data, error } = await db.from('cobranca_eventos').select('*').order('created_at', { ascending: false }).range(from, from + 999);
        if (error) break;
        all.push(...(data || []));
        if (!data || data.length < 1000) break;
        from += 1000;
      }
      setEventos(all);
    })();
  }, []);

  const cobMap = useMemo(() => new Map(itens.map((c) => [c.id, c])), [itens]);
  const etapaMap = useMemo(() => new Map(etapas.map((e) => [e.id, e.codigo])), [etapas]);
  const nomesArr = Array.from(nomes.entries());

  const linhas = (eventos || []).filter((e) => {
    const c = cobMap.get(e.cobranca_id);
    const dia = e.created_at.slice(0, 10);
    const d = e.dados || {};
    if (aluno && !(c?.alunoNome || '').toLowerCase().includes(aluno.toLowerCase())) return false;
    if (operador === 'sistema' ? !e.automatico : operador !== T && e.user_id !== operador) return false;
    if (resp !== T && c?.responsavelId !== resp) return false;
    if (de && dia < de) return false;
    if (ate && dia > ate) return false;
    if (canal !== T && d.canal !== canal) return false;
    if (acao !== T && !String(e.tipo).includes(acao)) return false;
    if (etapa !== T && (d.etapa_id || c?.etapaId) !== etapa) return false;
    if (matricula && !`${c?.saleId || ''} ${fmtData(c?.saleDate)}`.includes(matricula)) return false;
    if (parcela && String(d.parcela_numero ?? c?.parcelaNumero ?? '') !== parcela) return false;
    return true;
  });

  const sel = (v: string, s: (x: string) => void, opts: [string, string][], todos: string) => (
    <Select value={v} onValueChange={s}>
      <SelectTrigger><SelectValue /></SelectTrigger>
      <SelectContent><SelectItem value={T}>{todos}</SelectItem>{opts.map(([a, b]) => <SelectItem key={a} value={a}>{b}</SelectItem>)}</SelectContent>
    </Select>
  );

  return (
    <div className="space-y-3">
      <Card className="rounded-[14px] border-ink-200 shadow-card">
        <CardContent className="p-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Input placeholder="Aluno" value={aluno} onChange={(e) => setAluno(e.target.value)} />
          {sel(operador, setOperador, [['sistema', 'Sistema (automático)'], ...nomesArr], 'Todos os operadores')}
          {sel(resp, setResp, nomesArr, 'Todos os responsáveis')}
          <div className="flex gap-2">
            <Input type="date" value={de} onChange={(e) => setDe(e.target.value)} aria-label="Período de" />
            <Input type="date" value={ate} onChange={(e) => setAte(e.target.value)} aria-label="Período até" />
          </div>
          {sel(canal, setCanal, Object.entries(CANAIS), 'Todos os canais')}
          {sel(acao, setAcao, TIPOS_ACAO, 'Todas as ações')}
          {sel(etapa, setEtapa, etapas.map((e) => [e.id, e.codigo]), 'Todas as etapas')}
          <div className="flex gap-2">
            <Input placeholder="Matrícula (data)" value={matricula} onChange={(e) => setMatricula(e.target.value)} />
            <Input placeholder="Parcela nº" value={parcela} onChange={(e) => setParcela(e.target.value)} />
          </div>
        </CardContent>
      </Card>
      <Card className="rounded-[14px] border-ink-200 shadow-card">
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="whitespace-nowrap">Data/hora</TableHead>
                <TableHead>Aluno</TableHead>
                <TableHead>Ação</TableHead>
                <TableHead>Origem</TableHead>
                <TableHead>Canal</TableHead>
                <TableHead>Etapa</TableHead>
                <TableHead>Responsável</TableHead>
                <TableHead>Descrição</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {eventos === null ? (
                <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Carregando...</TableCell></TableRow>
              ) : linhas.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Nenhum evento encontrado.</TableCell></TableRow>
              ) : linhas.map((e) => {
                const c = cobMap.get(e.cobranca_id);
                const d = e.dados || {};
                return (
                  <TableRow key={e.id}>
                    <TableCell className="whitespace-nowrap tabular-nums">{new Date(e.created_at).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' })}</TableCell>
                    <TableCell className="min-w-[180px]">{c?.alunoNome || '—'}</TableCell>
                    <TableCell className="capitalize whitespace-nowrap">{String(e.tipo).replace(/_/g, ' ')}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={e.automatico ? 'bg-ink-100 text-ink-700' : 'bg-brand-tint text-ink-900'}>
                        {e.automatico ? 'Sistema' : nomes.get(e.user_id) || 'Usuário'}
                      </Badge>
                    </TableCell>
                    <TableCell>{d.canal ? CANAIS[d.canal] || d.canal : '—'}</TableCell>
                    <TableCell>{etapaMap.get(d.etapa_id) || '—'}</TableCell>
                    <TableCell>{c?.responsavelNome || '—'}</TableCell>
                    <TableCell className="min-w-[240px] text-ink-700">{e.descricao || '—'}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default Cobrancas;
