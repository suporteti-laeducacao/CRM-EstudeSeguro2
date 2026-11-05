import { useMemo, useState } from 'react';
import Layout from '@/components/Layout';
import PageHeader from '@/components/PageHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import AlertaCard from '@/components/acompanhamento/AlertaCard';
import RegistrarContatoDialog from '@/components/acompanhamento/RegistrarContatoDialog';
import { useAcompanhamento } from '@/hooks/useAcompanhamento';
import {
  AlertaAcompanhamento,
  PRIORIDADE_LABELS,
  PRIORIDADE_ORDER,
  RESULTADO_LABELS,
  ResultadoContato,
} from '@/lib/acompanhamento';

const fmt = (iso?: string | null) => (iso ? iso.split('-').reverse().join('/') : '—');

const Acompanhamento = () => {
  const {
    loading,
    reload,
    alertas,
    cancelados,
    pendentes,
    porPrioridade,
    podeVerTodos,
    monitorados,
    semPrevisao,
    semVendedor,
  } = useAcompanhamento();

  const [selecionado, setSelecionado] = useState<AlertaAcompanhamento | null>(null);
  const [busca, setBusca] = useState('');
  const [fPrioridade, setFPrioridade] = useState('todas');
  const [fVendedor, setFVendedor] = useState('todos');
  const [fSemContato, setFSemContato] = useState('todos');

  const vendedores = useMemo(
    () =>
      Array.from(
        new Map(
          alertas
            .filter((a) => a.vendedorId)
            .map((a) => [a.vendedorId as string, a.vendedorNome || 'Sem nome'])
        ).entries()
      ).sort((a, b) => a[1].localeCompare(b[1])),
    [alertas]
  );

  const aplicar = (lista: AlertaAcompanhamento[]) => {
    const termo = busca.trim().toLowerCase();
    return lista.filter((a) => {
      if (termo && !`${a.alunoNome} ${a.curso}`.toLowerCase().includes(termo)) return false;
      if (fPrioridade !== 'todas' && a.prioridade !== fPrioridade) return false;
      if (fVendedor !== 'todos' && a.vendedorId !== fVendedor) return false;
      if (fSemContato === 'sim' && a.contatos.length > 0) return false;
      return true;
    });
  };

  const naRegua = alertas.filter((a) => !a.foraDaRegua && a.marcoAtual);
  const canceladosList = aplicar(cancelados);
  const futuros = aplicar(alertas.filter((a) => !a.foraDaRegua && !a.marcoAtual));
  const hojeList = aplicar(naRegua.filter((a) => a.pendente));
  const agendados = aplicar(naRegua.filter((a) => !!a.adiadoAte));
  const vencidos = aplicar(naRegua.filter((a) => a.marcoAtual === 'VENCIDO'));
  const contatados = aplicar(
    naRegua.filter(
      (a) => !a.pendente && !a.adiadoAte && a.marcoAtual !== 'VENCIDO' && a.contatos.length > 0
    )
  );
  const historico = aplicar(alertas.filter((a) => a.contatos.length > 0)).flatMap((a) =>
    a.contatos.map((c) => ({ a, c }))
  );

  const contatosHoje = alertas
    .flatMap((a) => a.contatos)
    .filter((c) => c.data_contato === new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date()));
  const especiais = alertas.filter((a) => a.acompanhamentoEspecial).length;

  const kpi = (label: string, value: string | number, extra?: string, danger?: boolean) => (
    <Card className="rounded-[14px] border-ink-200 shadow-card">
      <CardContent className="p-4">
        <p className="text-[12.5px] font-medium text-ink-500">{label}</p>
        <p className={`font-display text-[26px] leading-8 font-extrabold tabular-nums ${danger ? 'text-destructive' : 'text-ink-950'}`}>{value}</p>
        {extra && <p className="mt-1 text-[11.5px] text-ink-500 tabular-nums">{extra}</p>}
      </CardContent>
    </Card>
  );

  const lista = (items: AlertaAcompanhamento[], vazio: string) =>
    items.length === 0 ? (
      <p className="text-sm text-muted-foreground py-8 text-center">{vazio}</p>
    ) : (
      <div className="grid gap-3">
        {items.map((a) => (
          <AlertaCard key={a.saleId} alerta={a} onRegistrar={setSelecionado} />
        ))}
      </div>
    );

  return (
    <Layout>
      <div className="space-y-6">
        <PageHeader
          title="Fila de contatos"
          subtitle="Alunos a contatar antes de a previsão de conclusão vencer."
          className="mb-0"
        />

        <div className="grid gap-3 grid-cols-2 lg:grid-cols-5">
          {kpi('Alunos monitorados', monitorados)}
          {kpi(
            'Alertas pendentes hoje',
            pendentes.length,
            PRIORIDADE_ORDER.map((p) => `${PRIORIDADE_LABELS[p]}: ${porPrioridade[p]}`).join(' · ')
          )}
          {kpi('Contatos registrados hoje', contatosHoje.length)}
          {kpi('Em acompanhamento especial', especiais)}
          {kpi('Matrículas sem previsão', semPrevisao, `Sem vendedor: ${semVendedor}`, semPrevisao > 0)}
        </div>

        <Card className="rounded-[14px] border-ink-200 shadow-card">
          <CardContent className="p-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Input
              placeholder="Buscar aluno ou curso"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
            />
            <Select value={fPrioridade} onValueChange={setFPrioridade}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas as prioridades</SelectItem>
                {PRIORIDADE_ORDER.map((p) => (
                  <SelectItem key={p} value={p}>{PRIORIDADE_LABELS[p]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {podeVerTodos && (
              <Select value={fVendedor} onValueChange={setFVendedor}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os vendedores</SelectItem>
                  {vendedores.map(([id, nome]) => (
                    <SelectItem key={id} value={id}>{nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Select value={fSemContato} onValueChange={setFSemContato}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Com ou sem contato</SelectItem>
                <SelectItem value="sim">Somente sem nenhum contato</SelectItem>
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {loading ? (
          <p className="text-muted-foreground">Carregando...</p>
        ) : (
          <Tabs defaultValue="hoje">
            <TabsList>
              <TabsTrigger value="hoje">Hoje ({hojeList.length})</TabsTrigger>
              <TabsTrigger value="agendados">Agendados ({agendados.length})</TabsTrigger>
              <TabsTrigger value="vencidos">Vencidos ({vencidos.length})</TabsTrigger>
              <TabsTrigger value="contatados">Contatados ({contatados.length})</TabsTrigger>
              <TabsTrigger value="futuros">Em monitoramento ({futuros.length})</TabsTrigger>
              <TabsTrigger value="cancelados">Cancelados ({canceladosList.length})</TabsTrigger>
              <TabsTrigger value="historico">Histórico</TabsTrigger>
            </TabsList>

            <TabsContent value="hoje" className="mt-4">
              {lista(hojeList, 'Nenhum contato pendente para hoje.')}
            </TabsContent>
            <TabsContent value="agendados" className="mt-4">
              {lista(agendados, 'Nenhum contato agendado.')}
            </TabsContent>
            <TabsContent value="vencidos" className="mt-4">
              {lista(vencidos, 'Nenhum aluno com prazo vencido.')}
            </TabsContent>
            <TabsContent value="contatados" className="mt-4 space-y-3">
              <p className="text-sm text-muted-foreground">
                Alunos já contatados nesta etapa. Eles voltam para a aba "Hoje" quando entrarem na
                próxima etapa da régua.
              </p>
              {lista(contatados, 'Nenhum aluno contatado nesta etapa.')}
            </TabsContent>
            <TabsContent value="futuros" className="mt-4 space-y-3">
              <p className="text-sm text-muted-foreground">
                Alunos com previsão de conclusão ainda distante. Eles entram na fila de contatos
                automaticamente quando faltarem 30 dias para a conclusão.
              </p>
              {lista(futuros, 'Nenhum aluno em monitoramento.')}
            </TabsContent>
            <TabsContent value="cancelados" className="mt-4 space-y-3">
              <p className="text-sm text-muted-foreground">
                Alunos de vendas canceladas ou inativadas. Eles não entram mais na fila de contatos.
              </p>
              {lista(canceladosList, 'Nenhum aluno cancelado.')}
            </TabsContent>
            <TabsContent value="historico" className="mt-4">
              <Card className="rounded-[14px] border-ink-200 shadow-card">
                <CardContent className="p-0 overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Data</TableHead>
                        <TableHead>Aluno</TableHead>
                        <TableHead>Marco</TableHead>
                        <TableHead>Canal</TableHead>
                        <TableHead>Resultado</TableHead>
                        <TableHead>Previsão (snapshot)</TableHead>
                        <TableHead>Observação</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {historico.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                            Nenhum contato registrado.
                          </TableCell>
                        </TableRow>
                      ) : (
                        historico.map(({ a, c }) => (
                          <TableRow key={c.id}>
                            <TableCell>{fmt(c.data_contato)}</TableCell>
                            <TableCell>{a.alunoNome}</TableCell>
                            <TableCell>{c.marco}</TableCell>
                            <TableCell>{c.canal}</TableCell>
                            <TableCell>
                              {RESULTADO_LABELS[c.resultado as ResultadoContato] || c.resultado}
                            </TableCell>
                            <TableCell>{fmt(c.data_prevista_conclusao)}</TableCell>
                            <TableCell className="max-w-[320px] truncate">{c.observacao || '—'}</TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        )}
      </div>

      <RegistrarContatoDialog
        alerta={selecionado}
        onClose={() => setSelecionado(null)}
        onSaved={reload}
      />
    </Layout>
  );
};

export default Acompanhamento;
