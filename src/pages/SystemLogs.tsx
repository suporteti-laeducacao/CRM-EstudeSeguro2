import { useEffect, useMemo, useState } from 'react';
import Layout from '@/components/Layout';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { FileSearch, RefreshCw, Eye, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface SystemLog {
  id: string;
  user_id: string | null;
  user_email: string | null;
  table_name: string;
  record_id: string | null;
  action: 'INSERT' | 'UPDATE' | 'DELETE';
  old_data: any;
  new_data: any;
  changed_fields: string[] | null;
  created_at: string;
  restaurado_em?: string | null;
}

const TABLE_LABELS: Record<string, string> = {
  sales: 'Vendas',
  installments: 'Parcelas',
  installment_payments: 'Pagamentos de Parcela',
  students: 'Alunos',
  leads: 'Leads',
  lead_tasks: 'Tarefas de Lead',
  lead_notes: 'Anotações de Lead',
  lead_history: 'Histórico de Lead',
  contas_pagar: 'Contas a Pagar',
  credores: 'Credores',
  recorrencias: 'Recorrências',
  categorias_conta: 'Categorias',
  cursos: 'Cursos',
  grupos_repasse: 'Grupos de Repasse',
  vendedores: 'Vendedores',
  user_roles: 'Permissões',
  metas_gerais: 'Metas Gerais',
  metas_vendedores: 'Metas de Vendedores',
  campanhas_trafego: 'Campanhas',
  lancamentos_campanha: 'Lançamentos de Campanha',
  negocios: 'Negócios',
  clientes: 'Clientes',
  collection_attempts: 'Tentativas de Cobrança',
  atividades: 'Atividades',
};

const ACTION_LABEL: Record<string, { label: string; variant: 'default' | 'destructive' | 'secondary'; className: string }> = {
  INSERT: { label: 'Criação', variant: 'default', className: 'bg-[#F1F1F4] text-[#2B2B30] border-transparent hover:bg-[#F1F1F4]' },
  UPDATE: { label: 'Edição', variant: 'secondary', className: 'bg-[#FFF1E7] text-[#B44309] border-transparent hover:bg-[#FFF1E7]' },
  DELETE: { label: 'Exclusão', variant: 'destructive', className: 'bg-[#FDECEC] text-[#B02121] border-transparent hover:bg-[#FDECEC]' },
};

const PAGE_SIZE = 50;

export default function SystemLogs() {
  const [logs, setLogs] = useState<SystemLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);

  const [search, setSearch] = useState('');
  const [contentSearch, setContentSearch] = useState('');
  const [tableFilter, setTableFilter] = useState<string>('all');
  const [actionFilter, setActionFilter] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const [selected, setSelected] = useState<SystemLog | null>(null);
  const [totalCount, setTotalCount] = useState<number | null>(null);
  const [related, setRelated] = useState<SystemLog[]>([]);
  const [confirmIds, setConfirmIds] = useState<string[] | null>(null);
  const [restoring, setRestoring] = useState(false);

  // Exclusões feitas pelo mesmo usuário no mesmo momento (ex.: conta + recorrência)
  useEffect(() => {
    setRelated([]);
    if (!selected || selected.action !== 'DELETE' || selected.restaurado_em) return;
    const t = new Date(selected.created_at).getTime();
    let q = supabase.from('system_logs').select('*')
      .eq('action', 'DELETE').is('restaurado_em', null)
      .gte('created_at', new Date(t - 5000).toISOString())
      .lte('created_at', new Date(t + 5000).toISOString());
    q = selected.user_id ? q.eq('user_id', selected.user_id) : q.is('user_id', null);
    q.then(({ data }) => setRelated((data as SystemLog[]) || []));
  }, [selected]);

  const doRestore = async () => {
    if (!confirmIds) return;
    setRestoring(true);
    const { data, error } = await supabase.rpc('system_logs_restaurar', { _log_ids: confirmIds });
    setRestoring(false);
    setConfirmIds(null);
    if (error) { toast.error(error.message); return; }
    const res = data as { restaurados: number; falhas: { tabela: string; erro: string }[] };
    if (res.falhas?.length) {
      toast.warning(`${res.restaurados} restaurado(s). ${res.falhas.length} não puderam voltar: ${res.falhas.map(f => `${TABLE_LABELS[f.tabela] || f.tabela} (${f.erro})`).join('; ')}`);
    } else {
      toast.success(`${res.restaurados} registro(s) restaurado(s) com sucesso.`);
    }
    setSelected(null);
    load(true);
  };

  const applyFilters = (q: any) => {
    if (tableFilter !== 'all') q = q.eq('table_name', tableFilter);
    if (actionFilter !== 'all') q = q.eq('action', actionFilter);
    if (dateFrom) q = q.gte('created_at', `${dateFrom}T00:00:00`);
    if (dateTo) q = q.lte('created_at', `${dateTo}T23:59:59`);
    if (search.trim()) q = q.ilike('user_email', `%${search.trim()}%`);
    if (contentSearch.trim()) {
      q = q.ilike('searchable_text', `%${contentSearch.trim().toLowerCase()}%`);
    }
    return q;
  };

  const load = async (reset = false) => {
    setLoading(true);
    const from = reset ? 0 : page * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    let q = supabase
      .from('system_logs')
      .select('*', reset ? { count: 'exact' } : undefined)
      .order('created_at', { ascending: false })
      .range(from, to);

    q = applyFilters(q);

    const { data, error, count } = await q;
    if (!error && data) {
      const rows = data as SystemLog[];
      setLogs(reset ? rows : [...logs, ...rows]);
      setHasMore(rows.length === PAGE_SIZE);
      if (reset) {
        setPage(1);
        setTotalCount(count ?? rows.length);
      } else {
        setPage(p => p + 1);
      }
    }
    setLoading(false);
  };

  useEffect(() => {
    load(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tableFilter, actionFilter, dateFrom, dateTo]);

  const handleSearch = () => load(true);

  const tableOptions = useMemo(
    () => Object.entries(TABLE_LABELS).sort((a, b) => a[1].localeCompare(b[1])),
    []
  );

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-[26px] leading-8 text-ink-950 flex items-center gap-2">
              <FileSearch className="h-7 w-7 text-ink-950" />
              Logs do Sistema
            </h1>
            <p className="mt-1 text-[13.5px] text-ink-500">
              Histórico completo de todas as interações realizadas no sistema
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="rounded-[14px] border border-ink-200 bg-card px-5 py-3 text-center shadow-card">
              <div className="text-xs text-ink-500 font-medium">
                Total filtrado
              </div>
              <div className="font-display text-[26px] tabular-nums text-ink-950 leading-tight">
                {totalCount !== null ? totalCount.toLocaleString('pt-BR') : '—'}
              </div>
              <div className="text-[10px] text-muted-foreground">
                {totalCount === 1 ? 'registro' : 'registros'}
              </div>
            </div>
            <Button onClick={() => load(true)} variant="outline" disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Atualizar
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Filtros</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-3">
            <div className="lg:col-span-2 flex gap-2">
              <Input
                placeholder="Buscar por e-mail do usuário..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              />
            </div>
            <div className="lg:col-span-2 flex gap-2">
              <Input
                placeholder="Buscar no conteúdo (nome, telefone, e-mail, ID...)"
                value={contentSearch}
                onChange={(e) => setContentSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              />
              <Button onClick={handleSearch} variant="secondary">Buscar</Button>
            </div>
            <Select value={tableFilter} onValueChange={setTableFilter}>
              <SelectTrigger><SelectValue placeholder="Módulo" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os módulos</SelectItem>
                {tableOptions.map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={actionFilter} onValueChange={setActionFilter}>
              <SelectTrigger><SelectValue placeholder="Ação" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as ações</SelectItem>
                <SelectItem value="INSERT">Criação</SelectItem>
                <SelectItem value="UPDATE">Edição</SelectItem>
                <SelectItem value="DELETE">Exclusão</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex gap-2">
              <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
              <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data/Hora</TableHead>
                  <TableHead>Usuário</TableHead>
                  <TableHead>Módulo</TableHead>
                  <TableHead>Ação</TableHead>
                  <TableHead>Campos Alterados</TableHead>
                  <TableHead className="w-[80px]">Detalhes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.length === 0 && !loading && (
                  <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    Nenhum log encontrado
                  </TableCell></TableRow>
                )}
                {logs.map((log) => {
                  const a = ACTION_LABEL[log.action];
                  return (
                    <TableRow key={log.id}>
                      <TableCell className="whitespace-nowrap text-sm">
                        {format(new Date(log.created_at), "dd/MM/yyyy HH:mm:ss", { locale: ptBR })}
                      </TableCell>
                      <TableCell className="text-sm">
                        {log.user_email || <span className="text-muted-foreground italic">Sistema</span>}
                      </TableCell>
                      <TableCell className="text-sm">
                        {TABLE_LABELS[log.table_name] || log.table_name}
                      </TableCell>
                      <TableCell>
                        <Badge variant={a.variant} className={a.className}>{a.label}</Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-md truncate">
                        {log.action === 'UPDATE'
                          ? (log.changed_fields?.join(', ') || '—')
                          : log.action === 'INSERT' ? 'Novo registro' : log.restaurado_em ? 'Registro removido · Restaurado' : 'Registro removido'}
                      </TableCell>
                      <TableCell>
                        <Button size="icon" aria-label="Ver detalhes do log" variant="ghost" onClick={() => setSelected(log)}>
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            {hasMore && (
              <div className="p-4 flex justify-center border-t">
                <Button variant="outline" onClick={() => load(false)} disabled={loading}>
                  {loading ? 'Carregando...' : 'Carregar mais'}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Detalhes do Log</DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div><strong>Data/Hora:</strong> {format(new Date(selected.created_at), "dd/MM/yyyy 'às' HH:mm:ss", { locale: ptBR })}</div>
                <div><strong>Usuário:</strong> {selected.user_email || 'Sistema'}</div>
                <div><strong>Módulo:</strong> {TABLE_LABELS[selected.table_name] || selected.table_name}</div>
                <div><strong>Ação:</strong> <Badge variant={ACTION_LABEL[selected.action].variant} className={ACTION_LABEL[selected.action].className}>{ACTION_LABEL[selected.action].label}</Badge></div>
                <div className="col-span-2"><strong>ID do registro:</strong> <code className="text-xs">{selected.record_id}</code></div>
              </div>

              {(() => {
                const ident = extractIdentification(selected.table_name, selected.new_data || selected.old_data);
                if (ident.length === 0) return null;
                return (
                  <div className="rounded-[10px] border border-ink-200 bg-ink-50 p-4">
                    <h4 className="font-semibold mb-2 text-sm text-ink-950">
                      Identificação do registro
                    </h4>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                      {ident.map(([label, value]) => (
                        <div key={label}>
                          <span className="text-muted-foreground">{label}:</span>{' '}
                          <span className="font-medium break-all">{value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}

              {selected.action === 'UPDATE' && selected.changed_fields && selected.changed_fields.length > 0 && (
                <div>
                  <h4 className="font-semibold mb-2">Alterações</h4>
                  <div className="border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Campo</TableHead>
                          <TableHead>Valor anterior</TableHead>
                          <TableHead>Valor novo</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {selected.changed_fields.map(f => (
                          <TableRow key={f}>
                            <TableCell className="font-mono text-xs">{f}</TableCell>
                            <TableCell className="text-xs text-destructive max-w-xs break-all">
                              {formatVal(selected.old_data?.[f])}
                            </TableCell>
                            <TableCell className="text-xs text-primary max-w-xs break-all">
                              {formatVal(selected.new_data?.[f])}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}

              {selected.action === 'INSERT' && (
                <div>
                  <h4 className="font-semibold mb-2">Dados criados</h4>
                  <pre className="bg-muted p-3 rounded text-xs overflow-x-auto max-h-96">
                    {JSON.stringify(selected.new_data, null, 2)}
                  </pre>
                </div>
              )}

              {selected.action === 'DELETE' && (
                <div className="rounded-[10px] border p-4 space-y-3">
                  <h4 className="font-semibold">Recuperar registro excluído</h4>
                  {selected.restaurado_em ? (
                    <p className="text-sm text-muted-foreground">
                      Este registro já foi restaurado em {format(new Date(selected.restaurado_em), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}.
                    </p>
                  ) : (
                    <>
                      <p className="text-sm text-muted-foreground">
                        O registro volta exatamente como estava (mesmo ID, valores, datas e vínculos), voltando a aparecer em todas as telas e cálculos.
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <Button size="sm" disabled={restoring} onClick={() => setConfirmIds([selected.id])}>
                          <RotateCcw className="h-4 w-4 mr-1" /> Restaurar este registro
                        </Button>
                        {related.length > 1 && (
                          <Button size="sm" variant="outline" disabled={restoring} onClick={() => setConfirmIds(related.map(r => r.id))}>
                            <RotateCcw className="h-4 w-4 mr-1" /> Restaurar as {related.length} exclusões feitas juntas
                          </Button>
                        )}
                      </div>
                      {related.length > 1 && (
                        <p className="text-xs text-muted-foreground">
                          Exclusões feitas juntas: {Object.entries(related.reduce((acc: Record<string, number>, r) => { const n = TABLE_LABELS[r.table_name] || r.table_name; acc[n] = (acc[n] || 0) + 1; return acc; }, {})).map(([n, c]) => `${c} em ${n}`).join(', ')}
                        </p>
                      )}
                    </>
                  )}
                </div>
              )}

              {selected.action === 'DELETE' && (
                <div>
                  <h4 className="font-semibold mb-2">Dados removidos</h4>
                  <pre className="bg-muted p-3 rounded text-xs overflow-x-auto max-h-96">
                    {JSON.stringify(selected.old_data, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!confirmIds} onOpenChange={(o) => !o && !restoring && setConfirmIds(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Restaurar {confirmIds?.length} registro(s)?</AlertDialogTitle>
            <AlertDialogDescription>
              Os dados voltam exatamente como estavam antes da exclusão e passam a valer de novo em todas as telas, totais e relatórios. A restauração fica registrada no log.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={restoring}>Cancelar</AlertDialogCancel>
            <AlertDialogAction disabled={restoring} onClick={(e) => { e.preventDefault(); doRestore(); }}>
              {restoring ? 'Restaurando...' : 'Restaurar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Layout>
  );
}

function formatVal(v: any): string {
  if (v === null || v === undefined) return '—';
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}

const IDENTIFICATION_FIELDS: Record<string, Array<[string, string]>> = {
  leads:               [['Nome','nome'],['Telefone','telefone'],['E-mail','email'],['Curso','curso_interesse'],['Status','status']],
  lead_tasks:          [['Título','titulo'],['Tipo','tipo'],['Vencimento','data_vencimento']],
  lead_notes:          [['Conteúdo','conteudo']],
  lead_history:        [['Status anterior','status_anterior'],['Status novo','status_novo']],
  lead_messages:       [['Remetente','remetente'],['Conteúdo','conteudo']],
  sales:               [['Aluno','student_name'],['Curso','course'],['Vendedor','seller'],['Valor','amount'],['Data','date']],
  installments:        [['Aluno','student_name'],['Curso','course'],['Parcela','installment_number'],['Valor','value'],['Vencimento','due_date']],
  installment_payments:[['Valor','valor'],['Data Pagamento','data_pagamento'],['Método','metodo']],
  students:            [['Nome','full_name'],['CPF','cpf'],['E-mail','email'],['Telefone','phone']],
  contas_pagar:        [['Descrição','descricao'],['Categoria','categoria'],['Valor','valor'],['Vencimento','data_vencimento']],
  credores:            [['Nome','nome'],['Tipo','tipo']],
  recorrencias:        [['Descrição','descricao'],['Valor','valor'],['Recorrência','recorrencia']],
  categorias_conta:    [['Nome','nome']],
  cursos:              [['Nome','nome'],['Nível','nivel_ensino']],
  grupos_repasse:      [['Nome','nome'],['% Empresa','porcentagem_empresa']],
  vendedores:          [['Nome','nome'],['E-mail','email']],
  user_roles:          [['Role','role']],
  metas_gerais:        [['Período','periodo'],['Valor','valor']],
  metas_vendedores:    [['Período','periodo'],['Valor','valor']],
  campanhas_trafego:   [['Nome','nome'],['Plataforma','plataforma'],['Data','data']],
  lancamentos_campanha:[['Plataforma','plataforma'],['Categoria','categoria'],['Data','data']],
  negocios:            [['Cliente','cliente_nome'],['Curso','curso'],['Valor','valor'],['Status','status']],
  clientes:            [['Nome','nome'],['Telefone','telefone'],['E-mail','email']],
  collection_attempts: [['Método','method'],['Data','date']],
  atividades:          [['Tipo','tipo'],['Descrição','descricao']],
};

function extractIdentification(table: string, data: any): Array<[string, string]> {
  if (!data || typeof data !== 'object') return [];
  const fields = IDENTIFICATION_FIELDS[table];
  if (!fields) return [];
  const out: Array<[string, string]> = [];
  for (const [label, key] of fields) {
    const v = data[key];
    if (v !== null && v !== undefined && v !== '') {
      out.push([label, typeof v === 'object' ? JSON.stringify(v) : String(v)]);
    }
  }
  return out;
}
