import { useEffect, useMemo, useState, Fragment } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { format, startOfMonth, endOfMonth, subMonths, startOfYear } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CalendarIcon, X, FileDown, FileSpreadsheet, Loader2, Printer, FileText, ChevronDown, CheckCircle2, AlertTriangle, ShieldAlert } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { getCredores, getJurosPagos } from '@/lib/payables-storage';
import { CATEGORIAS_CONTA, FORMAS_PAGAMENTO, type Credor } from '@/lib/payables-types';
import {
  gerarRelatorioCP, statusConciliacao, hojeBrasilia, type ContaRelatorio, type JurosRelatorio, type LinhaPagamento,
} from '@/lib/payables-report';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { fetchBranding, fitLogo, loadLogoForPdf } from '@/lib/branding';

const brl = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);
const num = (v: number) => (v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const dBR = (s?: string | null) => (s ? s.split('-').reverse().join('/') : '—');
const ymd = (d: Date) => format(d, 'yyyy-MM-dd');
const catLabel = (c: string) => CATEGORIAS_CONTA.find(x => x.value === c)?.label || c;
const formaLabel = (f?: string) => (f ? FORMAS_PAGAMENTO.find(x => x.value === f)?.label || f : '—');

const periodos = [
  { value: 'mes_atual', label: 'Mês Atual' },
  { value: 'mes_anterior', label: 'Mês Anterior' },
  { value: 'ultimos_3_meses', label: 'Últimos 3 Meses' },
  { value: 'ano_atual', label: 'Ano Atual' },
];

const mesAnterior = () => {
  const m = subMonths(new Date(), 1);
  return { inicio: startOfMonth(m), fim: endOfMonth(m) };
};

type Opcoes = { subtotais: boolean; resumos: boolean; pendencias: boolean; naoConciliados: boolean };

const DatePick = ({ label, value, onChange }: { label: string; value?: Date; onChange: (d?: Date) => void }) => (
  <div className="space-y-2">
    <Label className="text-sm font-medium">{label}</Label>
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" className={cn('w-full justify-start text-left font-normal', !value && 'text-muted-foreground')}>
          <CalendarIcon className="mr-2 h-4 w-4" />
          {value ? format(value, 'dd/MM/yyyy', { locale: ptBR }) : 'Selecione'}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar mode="single" selected={value} onSelect={onChange} initialFocus locale={ptBR} className="p-3 pointer-events-auto" />
      </PopoverContent>
    </Popover>
  </div>
);

const MultiCheck = ({ label, items, selected, onChange }: {
  label: string; items: { value: string; label: string }[]; selected: string[]; onChange: (v: string[]) => void;
}) => {
  const [busca, setBusca] = useState('');
  const muitos = items.length > 15;
  const visiveis = muitos ? items.filter(i => i.label.toLowerCase().includes(busca.toLowerCase())) : items;
  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium">{label}</Label>
      {muitos && <Input placeholder="Buscar..." value={busca} onChange={e => setBusca(e.target.value)} className="max-w-sm h-9" />}
      <div className={cn('flex flex-wrap gap-x-4 gap-y-2', muitos && 'max-h-44 overflow-y-auto rounded-md border p-3')}>
        <label className="flex items-center gap-2 text-sm">
          <Checkbox checked={selected.length === 0} onCheckedChange={() => onChange([])} />
          Todos
        </label>
        {visiveis.map(i => (
          <label key={i.value} className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={selected.includes(i.value)}
              onCheckedChange={c => onChange(c ? [...selected, i.value] : selected.filter(s => s !== i.value))}
            />
            {i.label}
          </label>
        ))}
      </div>
      {muitos && selected.length > 0 && <p className="text-xs text-muted-foreground">{selected.length} selecionado(s)</p>}
    </div>
  );
};

const Kpi = ({ title, value, sub, tone }: { title: string; value: string; sub?: string; tone?: 'danger' }) => (
  <Card>
    <CardContent className="p-4">
      <p className="text-xs text-muted-foreground">{title}</p>
      <p className={cn('text-xl font-semibold mt-1', tone === 'danger' && 'text-destructive')}>{value}</p>
      {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
    </CardContent>
  </Card>
);

const ContasPagarReport = () => {
  const { user, hasRole } = useAuth();
  const isAdmin = hasRole('admin');
  const [loading, setLoading] = useState(true);
  const [contas, setContas] = useState<ContaRelatorio[]>([]);
  const [credores, setCredores] = useState<Credor[]>([]);
  const [juros, setJuros] = useState<JurosRelatorio[]>([]);
  const [registrosRetornados, setRegistrosRetornados] = useState(0);

  const def = mesAnterior();
  const [periodo, setPeriodo] = useState('mes_anterior');
  const [dataInicio, setDataInicio] = useState<Date | undefined>(def.inicio);
  const [dataFim, setDataFim] = useState<Date | undefined>(def.fim);
  const [selCredores, setSelCredores] = useState<string[]>([]);
  const [selCategorias, setSelCategorias] = useState<string[]>([]);
  const [selFormas, setSelFormas] = useState<string[]>([]);
  const [opcoes, setOpcoes] = useState<Opcoes>({ subtotais: true, resumos: true, pendencias: true, naoConciliados: false });
  const [gerado, setGerado] = useState<null | { inicio: string; fim: string }>(null);
  const [soNaoConciliados, setSoNaoConciliados] = useState(false);
  const [extrato, setExtrato] = useState('');
  const [contaAberta, setContaAberta] = useState<ContaRelatorio | null>(null);

  const carregar = async () => {
    setLoading(true);
    try {
      const PAGE = 1000;
      let all: any[] = [];
      for (let from = 0; ; from += PAGE) {
        const { data, error } = await supabase.from('contas_pagar').select('*').order('data_vencimento').range(from, from + PAGE - 1);
        if (error) throw error;
        all = all.concat(data || []);
        if (!data || data.length < PAGE) break;
      }
      setRegistrosRetornados(all.length);
      setContas(all.map(r => ({ ...r, valor: Number(r.valor), valor_pago: r.valor_pago != null ? Number(r.valor_pago) : null, valor_total: r.valor_total != null ? Number(r.valor_total) : null })));
      const [cr, jr] = await Promise.all([getCredores(), getJurosPagos()]);
      setCredores(cr);
      setJuros(jr.map(j => ({ conta_pagar_id: j.conta_pagar_id, valor_juros: j.valor_juros, data_pagamento: j.data_pagamento })));
    } catch (e) {
      console.error(e);
      toast.error('Erro ao carregar contas a pagar');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { carregar(); }, []);

  const credorNomes = useMemo(() => Object.fromEntries(credores.map(c => [c.id, c.nome])), [credores]);
  const categorias = useMemo(() => [...new Set(contas.map(c => c.categoria))].sort().map(c => ({ value: c, label: catLabel(c) })), [contas]);
  const formas = useMemo(() => [...new Set(contas.map(c => c.forma_pagamento).filter(Boolean) as string[])].sort().map(f => ({ value: f, label: formaLabel(f) })), [contas]);

  const aplicarPeriodo = (p: string) => {
    setPeriodo(p);
    const hoje = new Date();
    if (p === 'mes_atual') { setDataInicio(startOfMonth(hoje)); setDataFim(endOfMonth(hoje)); }
    if (p === 'mes_anterior') { const m = mesAnterior(); setDataInicio(m.inicio); setDataFim(m.fim); }
    if (p === 'ultimos_3_meses') { setDataInicio(startOfMonth(subMonths(hoje, 2))); setDataFim(endOfMonth(hoje)); }
    if (p === 'ano_atual') { setDataInicio(startOfYear(hoje)); setDataFim(hoje); }
  };

  const limpar = () => {
    aplicarPeriodo('mes_anterior');
    setSelCredores([]); setSelCategorias([]); setSelFormas([]);
    setOpcoes({ subtotais: true, resumos: true, pendencias: true, naoConciliados: false });
  };

  const rel = useMemo(() => {
    if (!gerado) return null;
    return gerarRelatorioCP(contas, credorNomes, juros, {
      inicio: gerado.inicio, fim: gerado.fim, credores: selCredores, categorias: selCategorias, formas: selFormas,
      somenteNaoConciliados: opcoes.naoConciliados || soNaoConciliados,
    });
  }, [gerado, contas, credorNomes, juros, selCredores, selCategorias, selFormas, opcoes.naoConciliados, soNaoConciliados]);

  const validar = () => {
    if (!dataInicio || !dataFim) { toast.error('Selecione o período inicial e final'); return null; }
    if (dataFim < dataInicio) { toast.error('A data final deve ser maior que a data inicial'); return null; }
    return { inicio: ymd(dataInicio), fim: ymd(dataFim) };
  };

  const gerar = () => { const p = validar(); if (p) setGerado(p); };

  const garantir = () => {
    const p = validar();
    if (!p) return null;
    setGerado(p);
    return gerarRelatorioCP(contas, credorNomes, juros, {
      inicio: p.inicio, fim: p.fim, credores: selCredores, categorias: selCategorias, formas: selFormas,
      somenteNaoConciliados: opcoes.naoConciliados || soNaoConciliados,
    });
  };

  const toggleConciliado = async (contaId: string, valor: boolean) => {
    const patch = { conciliado: valor, conciliado_em: valor ? new Date().toISOString() : null, conciliado_por: valor ? user?.id ?? null : null };
    setContas(prev => prev.map(c => (c.id === contaId ? { ...c, conciliado: valor } : c)));
    const { error } = await supabase.from('contas_pagar').update(patch).eq('id', contaId);
    if (error) {
      toast.error('Não foi possível salvar a conciliação');
      setContas(prev => prev.map(c => (c.id === contaId ? { ...c, conciliado: !valor } : c)));
    }
  };

  const filtrosTexto = () => {
    const nomes = (sel: string[], items: { value: string; label: string }[]) => (sel.length ? sel.map(s => items.find(i => i.value === s)?.label || s).join(', ') : 'Todos');
    return [
      `Fornecedores: ${nomes(selCredores, credores.map(c => ({ value: c.id, label: c.nome })))}`,
      `Categorias: ${nomes(selCategorias, categorias)}`,
      `Formas: ${nomes(selFormas, formas)}`,
    ];
  };

  const linhasDetalhadas = (r: NonNullable<typeof rel>) => {
    const rows: (string | number)[][] = [];
    r.linhas.forEach((l, i) => {
      rows.push([i + 1, dBR(l.dataPagamento), l.credorNome, l.descricao, catLabel(l.categoria), dBR(l.vencimento), l.diasAtraso,
        l.valorOriginal, l.juros, l.desconto, l.valorPago, formaLabel(l.forma), l.parcial ? 'Sim' : 'Não', l.acumulado, l.conciliado ? 'Sim' : 'Não']);
      const prox = r.linhas[i + 1];
      if (opcoes.subtotais && (!prox || prox.dataPagamento !== l.dataPagamento)) {
        const s = r.subtotaisDia.get(l.dataPagamento)!;
        rows.push(['', `Subtotal ${dBR(l.dataPagamento)}`, `${s.qtd} lançamento(s)`, '', '', '', '', '', '', '', s.total, '', '', '', '']);
      }
    });
    rows.push(['', 'TOTAL GERAL', `${r.qtdLancamentos} lançamento(s)`, '', '', '', '', r.principal, r.juros, r.descontos, r.totalPago, '', '', '', '']);
    return rows;
  };

  const HEAD = ['#', 'Data Pagamento', 'Fornecedor/Prestador', 'Descrição', 'Categoria', 'Vencimento', 'Dias atraso', 'Valor Original', 'Juros/Multa', 'Desconto', 'Valor Pago', 'Forma', 'Parcial?', 'Acumulado', 'Conciliado'];
  const nomeArquivo = (r: { inicio: string; fim: string }, ext: string) => `contas-a-pagar_${r.inicio}_a_${r.fim}.${ext}`;
  const extratoNum = Number(extrato.replace(/\./g, '').replace(',', '.')) || 0;

  const exportarExcel = () => {
    const r = garantir(); if (!r) return;
    const p = validar()!;
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([HEAD, ...linhasDetalhadas(r)]), 'Detalhado');
    const resumo: (string | number)[][] = [
      ['Relatório Financeiro – Contas a Pagar'], [`Período (data de pagamento): ${dBR(p.inicio)} a ${dBR(p.fim)}`], ...filtrosTexto().map(f => [f]), [],
      ['Total Pago no Período', r.totalPago], ['Lançamentos', r.qtdLancamentos], ['Contas distintas', r.qtdContas],
      ['Principal Pago', r.principal], ['Juros/Multa', r.juros], ['Descontos', r.descontos],
      ['Pagos com Atraso (valor)', r.valorAtrasados], ['Pagos com Atraso (qtd)', r.atrasados.length], ['Ticket médio', r.ticketMedio], [],
      ['Conciliação'], ['Total do relatório', r.totalPago], ['Total do extrato', extratoNum], ['Diferença', Math.round((extratoNum - r.totalPago) * 100) / 100], [],
      ['Por Categoria', 'Qtd', 'Total', '%'], ...r.porCategoria.map(g => [catLabel(g.nome), g.qtd, g.total, Number(g.pct.toFixed(2))]), [],
      ['Por Fornecedor', 'Qtd', 'Total', '%'], ...r.porFornecedor.map(g => [g.nome, g.qtd, g.total, Number(g.pct.toFixed(2))]), [],
      ['Por Forma de Pagamento', 'Qtd', 'Total', '%'], ...r.porForma.map(g => [formaLabel(g.nome), g.qtd, g.total, Number(g.pct.toFixed(2))]),
    ];
    if (opcoes.pendencias) resumo.push([], ['Pendências do período', 'Fornecedor', 'Valor restante', 'Dias em atraso'], ...r.pendencias.map(x => [dBR(x.vencimento), x.credorNome, x.valorRestante, x.diasAtraso]));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(resumo), 'Resumo');
    XLSX.writeFile(wb, nomeArquivo(p, 'xlsx'));
  };

  const exportarCSV = () => {
    const r = garantir(); if (!r) return;
    const cel = (v: string | number) => {
      const s = typeof v === 'number' ? v.toLocaleString('pt-BR', { useGrouping: false, maximumFractionDigits: 2 }) : v;
      return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const csv = [HEAD, ...linhasDetalhadas(r)].map(row => row.map(cel).join(';')).join('\r\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = nomeArquivo(validar()!, 'csv');
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const exportarPDF = async () => {
    const r = garantir(); if (!r) return;
    const p = validar()!;
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    let textoX = 14;
    try {
      const { logoUrl } = await fetchBranding();
      if (logoUrl) {
        const pdfLogo = await loadLogoForPdf(logoUrl);
        const { width, height } = fitLogo(pdfLogo, 30, 12);
        doc.addImage(pdfLogo.dataUrl, 'PNG', 14, 8, width, height);
        textoX = 50;
      }
    } catch { /* sem logo */ }
    const emissao = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' }).format(new Date());
    doc.setFontSize(14); doc.text('Relatório Financeiro – Contas a Pagar', textoX, 14);
    doc.setFontSize(9);
    doc.text(`Período (data de pagamento): ${dBR(p.inicio)} a ${dBR(p.fim)}   |   Emitido em ${emissao} (Brasília) por ${user?.email ?? '—'}`, textoX, 19);
    doc.text(filtrosTexto().join('   |   ').slice(0, 220), 14, 26);
    doc.text(`Total pago: ${brl(r.totalPago)}   Lançamentos: ${r.qtdLancamentos}   Contas: ${r.qtdContas}   Principal: ${brl(r.principal)}   Juros/Multa: ${brl(r.juros)}   Pagos c/ atraso: ${brl(r.valorAtrasados)} (${r.atrasados.length})`, 14, 31);
    const fmtRow = (row: (string | number)[]) => row.map((v, i) => (typeof v === 'number' && [7, 8, 9, 10, 13].includes(i) ? num(v) : String(v)));
    autoTable(doc, {
      startY: 35, head: [HEAD], body: linhasDetalhadas(r).map(fmtRow), styles: { fontSize: 6.5, cellPadding: 1 },
      headStyles: { fillColor: [40, 40, 40] },
      didParseCell: d => { const t = String((d.row.raw as any[])?.[1] ?? ''); if (d.section === 'body' && (t.startsWith('Subtotal') || t === 'TOTAL GERAL')) d.cell.styles.fontStyle = 'bold'; },
    });
    const resumoTab = (titulo: string, rows: { nome: string; qtd: number; total: number; pct: number }[], lab = (s: string) => s) =>
      autoTable(doc, { head: [[titulo, 'Qtd', 'Total pago', '%']], body: rows.map(g => [lab(g.nome), g.qtd, num(g.total), `${g.pct.toFixed(1).replace('.', ',')}%`]), styles: { fontSize: 8 }, headStyles: { fillColor: [40, 40, 40] } });
    if (opcoes.resumos) {
      resumoTab('Por Categoria', r.porCategoria, catLabel);
      resumoTab('Por Fornecedor', r.porFornecedor);
      resumoTab('Por Forma de Pagamento', r.porForma, formaLabel);
    }
    if (opcoes.pendencias && r.pendencias.length) {
      autoTable(doc, { head: [['Pendências – Vencimento', 'Fornecedor', 'Descrição', 'Valor restante', 'Dias em atraso']], body: r.pendencias.map(x => [dBR(x.vencimento), x.credorNome, x.descricao, num(x.valorRestante), x.diasAtraso]), styles: { fontSize: 8 }, headStyles: { fillColor: [40, 40, 40] } });
    }
    const n = doc.getNumberOfPages();
    for (let i = 1; i <= n; i++) { doc.setPage(i); doc.setFontSize(8); doc.text(`Página ${i} de ${n}`, 283, 203, { align: 'right' }); }
    doc.save(nomeArquivo(p, 'pdf'));
  };

  const imprimir = () => { if (!gerado) gerar(); setTimeout(() => window.print(), 200); };

  // Diagnóstico (admin)
  const diag = useMemo(() => {
    if (!isAdmin || !rel || !gerado) return null;
    const hoje = hojeBrasilia();
    const pagoSemData = contas.filter(c => c.status === 'pago' && !c.data_pagamento);
    const pagoMaiorSemJuros = contas.filter(c => Number(c.valor_pago || 0) > Number(c.valor_total || 0) + 0.01 && Number(c.valor_total || 0) > 0 && !juros.some(j => j.conta_pagar_id === c.id));
    const futuros = rel.todosPagamentos.filter(l => l.dataPagamento > hoje);
    const mes = hoje.slice(0, 7);
    const relMes = rel.todosPagamentos.filter(l => l.dataPagamento.startsWith(mes)).reduce((s, l) => s + l.valorPago, 0);
    const cardMes = contas.filter(c => c.status === 'pago' && c.data_pagamento?.startsWith(mes)).reduce((s, c) => s + (Number(c.valor_pago) || Number(c.valor_total) || 0), 0);
    return { pagoSemData, pagoMaiorSemJuros, futuros, relMes: Math.round(relMes * 100) / 100, cardMes: Math.round(cardMes * 100) / 100 };
  }, [isAdmin, rel, gerado, contas, juros]);

  if (loading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  }

  const st = rel && extrato ? statusConciliacao(rel.totalPago, extratoNum) : null;
  const opt = (k: keyof Opcoes, label: string) => (
    <label className="flex items-center gap-2 text-sm">
      <Checkbox checked={opcoes[k]} onCheckedChange={c => setOpcoes(o => ({ ...o, [k]: !!c }))} />
      {label}
    </label>
  );

  return (
    <div className="space-y-6">
      <Card className="print:hidden">
        <CardHeader className="pb-3">
          <div className="flex justify-between items-center">
            <CardTitle className="text-lg">Filtros do Relatório</CardTitle>
            <Button variant="ghost" size="sm" onClick={limpar} className="gap-1"><X className="h-4 w-4" />Limpar Filtros</Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label className="text-sm font-medium">Período Rápido</Label>
            <div className="flex flex-wrap gap-2">
              {periodos.map(p => (
                <Button key={p.value} size="sm" variant={periodo === p.value ? 'default' : 'outline'} onClick={() => aplicarPeriodo(p.value)}>{p.label}</Button>
              ))}
            </div>
          </div>
          <div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <DatePick label="Data Inicial" value={dataInicio} onChange={d => { setPeriodo(''); setDataInicio(d); }} />
              <DatePick label="Data Final" value={dataFim} onChange={d => { setPeriodo(''); setDataFim(d); }} />
            </div>
            <p className="text-xs text-muted-foreground mt-2">Filtra pela data de pagamento</p>
          </div>
          <MultiCheck label="Fornecedores/Prestadores" items={credores.map(c => ({ value: c.id, label: c.nome }))} selected={selCredores} onChange={setSelCredores} />
          <MultiCheck label="Categorias" items={categorias} selected={selCategorias} onChange={setSelCategorias} />
          {formas.length > 0 && <MultiCheck label="Forma de Pagamento" items={formas} selected={selFormas} onChange={setSelFormas} />}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Opções do Relatório</Label>
            <div className="flex flex-col gap-2">
              {opt('subtotais', 'Incluir subtotais por dia')}
              {opt('resumos', 'Incluir resumo por categoria e fornecedor')}
              {opt('pendencias', 'Incluir pendências do período (vencidas e não pagas)')}
              {opt('naoConciliados', 'Mostrar somente lançamentos não conciliados')}
            </div>
          </div>
          <div className="flex flex-wrap gap-3 pt-2 border-t">
            <Button variant="outline" className="gap-2" onClick={exportarExcel}><FileSpreadsheet className="h-4 w-4" />Exportar Excel</Button>
            <Button variant="outline" className="gap-2" onClick={exportarPDF}><FileDown className="h-4 w-4" />Exportar PDF</Button>
            <Button variant="outline" className="gap-2" onClick={exportarCSV}><FileText className="h-4 w-4" />Exportar CSV</Button>
            <Button variant="outline" className="gap-2" onClick={imprimir}><Printer className="h-4 w-4" />Imprimir</Button>
            <Button className="gap-2" onClick={gerar}>Gerar Relatório</Button>
          </div>
        </CardContent>
      </Card>

      {rel && gerado && (
        <>
          <div className="hidden print:block">
            <h2 className="text-lg font-semibold">Relatório Financeiro – Contas a Pagar</h2>
            <p className="text-sm">Pagamentos de {dBR(gerado.inicio)} a {dBR(gerado.fim)}</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <Kpi title="Total Pago no Período" value={brl(rel.totalPago)} />
            <Kpi title="Lançamentos" value={String(rel.qtdLancamentos)} sub={`${rel.qtdContas} conta(s) distinta(s)`} />
            <Kpi title="Principal Pago" value={brl(rel.principal)} sub={`Juros/Multa ${brl(rel.juros)} · Descontos ${brl(rel.descontos)}`} />
            <Kpi title="Pagos com Atraso" value={brl(rel.valorAtrasados)} sub={`${rel.atrasados.length} lançamento(s)`} tone={rel.atrasados.length ? 'danger' : undefined} />
            <Kpi title="Ticket médio por lançamento" value={brl(rel.ticketMedio)} />
          </div>

          <Card>
            <CardHeader className="pb-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <CardTitle className="text-lg">Pagamentos em ordem cronológica</CardTitle>
                <div className="flex items-center gap-4 print:hidden">
                  <Badge variant="secondary">{rel.linhas.filter(l => l.conciliado).length} de {rel.linhas.length} conciliados</Badge>
                  <label className="flex items-center gap-2 text-sm">
                    <Checkbox checked={soNaoConciliados} onCheckedChange={c => setSoNaoConciliados(!!c)} />
                    Mostrar só não conciliados
                  </label>
                </div>
              </div>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>{HEAD.map(h => <TableHead key={h} className="whitespace-nowrap">{h}</TableHead>)}</TableRow>
                </TableHeader>
                <TableBody>
                  {rel.linhas.length === 0 && (
                    <TableRow><TableCell colSpan={HEAD.length} className="text-center text-muted-foreground py-8">Nenhum pagamento no período.</TableCell></TableRow>
                  )}
                  {rel.linhas.map((l: LinhaPagamento, i) => {
                    const prox = rel.linhas[i + 1];
                    const fimDia = !prox || prox.dataPagamento !== l.dataPagamento;
                    const sub = rel.subtotaisDia.get(l.dataPagamento)!;
                    return (
                      <Fragment key={l.key}>
                        <TableRow className="cursor-pointer" onClick={() => setContaAberta(contas.find(c => c.id === l.contaId) || null)}>
                          <TableCell>{i + 1}</TableCell>
                          <TableCell className="whitespace-nowrap">{dBR(l.dataPagamento)}</TableCell>
                          <TableCell>{l.credorNome}</TableCell>
                          <TableCell className="min-w-[180px]">{l.descricao}</TableCell>
                          <TableCell>{catLabel(l.categoria)}</TableCell>
                          <TableCell className="whitespace-nowrap">{dBR(l.vencimento)}</TableCell>
                          <TableCell className={cn('text-right', l.diasAtraso > 0 && 'text-destructive font-medium')}>{l.diasAtraso}</TableCell>
                          <TableCell className="text-right whitespace-nowrap">{brl(l.valorOriginal)}</TableCell>
                          <TableCell className="text-right whitespace-nowrap">{brl(l.juros)}</TableCell>
                          <TableCell className="text-right whitespace-nowrap">{brl(l.desconto)}</TableCell>
                          <TableCell className="text-right whitespace-nowrap font-medium">{brl(l.valorPago)}</TableCell>
                          <TableCell>{formaLabel(l.forma)}</TableCell>
                          <TableCell>{l.parcial ? 'Sim' : 'Não'}</TableCell>
                          <TableCell className="text-right whitespace-nowrap">{brl(l.acumulado)}</TableCell>
                          <TableCell onClick={e => e.stopPropagation()}>
                            <Checkbox checked={l.conciliado} onCheckedChange={c => toggleConciliado(l.contaId, !!c)} aria-label="Conciliado" />
                          </TableCell>
                        </TableRow>
                        {opcoes.subtotais && fimDia && (
                          <TableRow className="bg-muted/50 hover:bg-muted/50">
                            <TableCell colSpan={HEAD.length} className="text-sm font-medium">
                              Subtotal {dBR(l.dataPagamento)}: {brl(sub.total)} – {sub.qtd} lançamento(s)
                            </TableCell>
                          </TableRow>
                        )}
                      </Fragment>
                    );
                  })}
                </TableBody>
                <TableFooter>
                  <TableRow>
                    <TableCell colSpan={7} className="font-semibold">TOTAL GERAL – {rel.qtdLancamentos} lançamento(s)</TableCell>
                    <TableCell className="text-right whitespace-nowrap font-semibold">{brl(rel.principal)}</TableCell>
                    <TableCell className="text-right whitespace-nowrap font-semibold">{brl(rel.juros)}</TableCell>
                    <TableCell className="text-right whitespace-nowrap font-semibold">{brl(rel.descontos)}</TableCell>
                    <TableCell className="text-right whitespace-nowrap font-semibold">{brl(rel.totalPago)}</TableCell>
                    <TableCell colSpan={4} />
                  </TableRow>
                </TableFooter>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-lg">Conciliação Bancária</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="max-w-xs space-y-2">
                <Label>Total debitado no extrato bancário (R$)</Label>
                <Input inputMode="decimal" placeholder="0,00" value={extrato} onChange={e => setExtrato(e.target.value)} />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Kpi title="Total do relatório" value={brl(rel.totalPago)} />
                <Kpi title="Total do extrato" value={brl(extratoNum)} />
                <Kpi title="Diferença" value={brl(Math.round((extratoNum - rel.totalPago) * 100) / 100)} />
              </div>
              {st === 'conciliado' && <div className="flex items-center gap-2 rounded-md border border-success/40 bg-success/10 p-3 text-sm text-success"><CheckCircle2 className="h-4 w-4" />Conciliado</div>}
              {st === 'extrato_maior' && <div className="flex items-center gap-2 rounded-md border border-warning/40 bg-warning/10 p-3 text-sm"><AlertTriangle className="h-4 w-4 text-warning" />Existem saídas no banco não lançadas no sistema</div>}
              {st === 'relatorio_maior' && <div className="flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive"><ShieldAlert className="h-4 w-4" />Existem pagamentos lançados que não saíram do banco (verifique datas ou lançamentos indevidos)</div>}
            </CardContent>
          </Card>

          {(opcoes.resumos || opcoes.pendencias) && (
            <Card>
              <CardContent className="pt-6">
                <Tabs defaultValue={opcoes.resumos ? 'categoria' : 'pendencias'}>
                  <TabsList className="flex-wrap h-auto">
                    {opcoes.resumos && <TabsTrigger value="categoria">Por Categoria</TabsTrigger>}
                    {opcoes.resumos && <TabsTrigger value="fornecedor">Por Fornecedor</TabsTrigger>}
                    {opcoes.resumos && <TabsTrigger value="forma">Por Forma de Pagamento</TabsTrigger>}
                    {opcoes.resumos && <TabsTrigger value="atraso">Pagos com Atraso</TabsTrigger>}
                    {opcoes.pendencias && <TabsTrigger value="pendencias">Pendências do período</TabsTrigger>}
                  </TabsList>
                  {([['categoria', rel.porCategoria, catLabel, 'Categoria'], ['fornecedor', rel.porFornecedor, (s: string) => s, 'Fornecedor'], ['forma', rel.porForma, formaLabel, 'Forma']] as const).map(([k, rows, lab, t]) => (
                    <TabsContent key={k} value={k}>
                      <Table>
                        <TableHeader><TableRow><TableHead>{t}</TableHead><TableHead className="text-right">Qtd</TableHead><TableHead className="text-right">Total pago</TableHead><TableHead className="text-right">% do total</TableHead></TableRow></TableHeader>
                        <TableBody>
                          {rows.map(g => (
                            <TableRow key={g.nome}><TableCell>{lab(g.nome)}</TableCell><TableCell className="text-right">{g.qtd}</TableCell><TableCell className="text-right">{brl(g.total)}</TableCell><TableCell className="text-right">{g.pct.toFixed(1).replace('.', ',')}%</TableCell></TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TabsContent>
                  ))}
                  <TabsContent value="atraso">
                    <Table>
                      <TableHeader><TableRow><TableHead>Pagamento</TableHead><TableHead>Fornecedor</TableHead><TableHead>Descrição</TableHead><TableHead>Vencimento</TableHead><TableHead className="text-right">Dias de atraso</TableHead><TableHead className="text-right">Juros/Multa</TableHead><TableHead className="text-right">Valor pago</TableHead></TableRow></TableHeader>
                      <TableBody>
                        {rel.atrasados.map(l => (
                          <TableRow key={l.key}><TableCell>{dBR(l.dataPagamento)}</TableCell><TableCell>{l.credorNome}</TableCell><TableCell>{l.descricao}</TableCell><TableCell>{dBR(l.vencimento)}</TableCell><TableCell className="text-right">{l.diasAtraso}</TableCell><TableCell className="text-right">{brl(l.juros)}</TableCell><TableCell className="text-right">{brl(l.valorPago)}</TableCell></TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TabsContent>
                  <TabsContent value="pendencias">
                    <p className="text-xs text-muted-foreground mb-2">Não entram no total pago — apenas para controle. Total: {brl(rel.totalPendencias)}</p>
                    <Table>
                      <TableHeader><TableRow><TableHead>Vencimento</TableHead><TableHead>Fornecedor</TableHead><TableHead>Descrição</TableHead><TableHead className="text-right">Valor restante</TableHead><TableHead className="text-right">Dias em atraso</TableHead></TableRow></TableHeader>
                      <TableBody>
                        {rel.pendencias.map(p => (
                          <TableRow key={p.contaId} className="cursor-pointer" onClick={() => setContaAberta(contas.find(c => c.id === p.contaId) || null)}>
                            <TableCell>{dBR(p.vencimento)}</TableCell><TableCell>{p.credorNome}</TableCell><TableCell>{p.descricao}</TableCell><TableCell className="text-right">{brl(p.valorRestante)}</TableCell><TableCell className="text-right">{p.diasAtraso}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          )}

          {diag && (
            <Collapsible className="print:hidden">
              <Card>
                <CollapsibleTrigger asChild>
                  <button className="w-full flex items-center justify-between p-4 text-left">
                    <span className="font-medium">Painel de Diagnóstico (Admin)</span>
                    <ChevronDown className="h-4 w-4" />
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <CardContent className="space-y-3 text-sm">
                    <p>Intervalo aplicado: {dBR(gerado.inicio)} a {dBR(gerado.fim)} (data de pagamento, sem horário — mesma data em Brasília e UTC: {gerado.inicio} a {gerado.fim}).</p>
                    <p>Registros de contas retornados: {registrosRetornados} · Pagamentos reconstruídos: {rel.todosPagamentos.length} · Exibidos: {rel.linhas.length}</p>
                    <p>Pagas sem data de pagamento: {diag.pagoSemData.length} {diag.pagoSemData.slice(0, 10).map(c => `· ${c.descricao}`).join(' ')}</p>
                    <p>Valor pago maior que o total sem juros registrados: {diag.pagoMaiorSemJuros.length} {diag.pagoMaiorSemJuros.slice(0, 10).map(c => `· ${c.descricao}`).join(' ')}</p>
                    <p>Pagamentos com data futura: {diag.futuros.length} {diag.futuros.slice(0, 10).map(l => `· ${l.descricao} (${dBR(l.dataPagamento)})`).join(' ')}</p>
                    <p className={cn(Math.abs(diag.relMes - diag.cardMes) > 0.005 && 'text-destructive font-medium')}>
                      Mês atual — relatório: {brl(diag.relMes)} · card "Pagas no Mês": {brl(diag.cardMes)} · diferença: {brl(diag.relMes - diag.cardMes)}
                      {Math.abs(diag.relMes - diag.cardMes) > 0.005 && ' (o card só conta contas totalmente quitadas; o relatório conta também pagamentos parciais pela data em que saíram)'}
                    </p>
                  </CardContent>
                </CollapsibleContent>
              </Card>
            </Collapsible>
          )}
        </>
      )}

      <Dialog open={!!contaAberta} onOpenChange={o => !o && setContaAberta(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{contaAberta?.descricao}</DialogTitle></DialogHeader>
          {contaAberta && (
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><p className="text-muted-foreground">Fornecedor</p><p>{credorNomes[contaAberta.credor_id] || '—'}</p></div>
              <div><p className="text-muted-foreground">Categoria</p><p>{catLabel(contaAberta.categoria)}</p></div>
              <div><p className="text-muted-foreground">Vencimento</p><p>{dBR(contaAberta.data_vencimento)}</p></div>
              <div><p className="text-muted-foreground">Data pagamento</p><p>{dBR(contaAberta.data_pagamento)}</p></div>
              <div><p className="text-muted-foreground">Valor total</p><p>{brl(Number(contaAberta.valor_total || 0) || Number(contaAberta.valor || 0) + Number(contaAberta.valor_pago || 0))}</p></div>
              <div><p className="text-muted-foreground">Valor pago</p><p>{brl(Number(contaAberta.valor_pago || 0))}</p></div>
              <div><p className="text-muted-foreground">Valor restante</p><p>{brl(contaAberta.status === 'pago' ? 0 : Number(contaAberta.valor || 0))}</p></div>
              <div><p className="text-muted-foreground">Status</p><p className="capitalize">{contaAberta.status}</p></div>
              <div className="col-span-2"><p className="text-muted-foreground">Observações</p><p className="whitespace-pre-wrap">{contaAberta.observacoes || '—'}</p></div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ContasPagarReport;
