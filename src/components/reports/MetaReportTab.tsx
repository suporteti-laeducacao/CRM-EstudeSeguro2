import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Target, Users } from 'lucide-react';
import { toast } from 'sonner';
import { getMetaGeralAtiva, getMetasVendedoresAtivas, MetaGeral, MetaVendedor } from '@/lib/metas-storage';
import { getVendedores, Vendedor } from '@/lib/vendedores-storage';
import { storage } from '@/lib/storage';
import { Sale, Installment } from '@/lib/types';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  PieChart, Pie, Cell,
} from 'recharts';

const formatCurrency = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

const COLORS = ['hsl(var(--primary))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))'];

const MetaReportTab = () => {
  const [metaGeral, setMetaGeral] = useState<MetaGeral | null>(null);
  const [metasVendedores, setMetasVendedores] = useState<MetaVendedor[]>([]);
  const [vendedores, setVendedores] = useState<Vendedor[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [installments, setInstallments] = useState<Installment[]>([]);

  useEffect(() => {
    const load = async () => {
      try {
        const [mg, mv, v, s, i] = await Promise.all([
          getMetaGeralAtiva(),
          getMetasVendedoresAtivas(),
          getVendedores(),
          storage.getSales(),
          storage.getInstallments(),
        ]);
        setMetaGeral(mg);
        setMetasVendedores(mv);
        setVendedores(v);
        setSales(s);
        setInstallments(i);
      } catch { toast.error('Erro ao carregar dados'); }
    };
    load();
  }, []);

  const realizadoPorVendedor = useMemo(() => {
    const period = metaGeral || (metasVendedores.length > 0 ? metasVendedores[0] : null);
    if (!period) return new Map<string, number>();
    const map = new Map<string, number>();
    sales.forEach(sale => {
      if (sale.date < period.data_inicio || sale.date > period.data_fim) return;
      const vid = sale.vendedorId || '';
      const paid = installments
        .filter(i => i.saleId === sale.id && i.status === 'paid')
        .reduce((sum, i) => sum + (i.paidAmount ?? i.value), 0);
      map.set(vid, (map.get(vid) || 0) + paid);
    });
    return map;
  }, [sales, installments, metaGeral, metasVendedores]);

  const totalRealizado = useMemo(() => {
    let t = 0;
    realizadoPorVendedor.forEach(v => t += v);
    return t;
  }, [realizadoPorVendedor]);

  const percentGeral = metaGeral ? (totalRealizado / metaGeral.valor) * 100 : 0;

  const vendedorRows = useMemo(() => {
    return vendedores.map(v => {
      const meta = metasVendedores.find(m => m.vendedor_id === v.id);
      const realizado = realizadoPorVendedor.get(v.id) || 0;
      const percent = meta ? (realizado / meta.valor) * 100 : 0;
      const diff = meta ? realizado - meta.valor : 0;
      return { vendedor: v, meta, realizado, percent, diff };
    }).filter(r => r.meta || r.realizado > 0)
      .sort((a, b) => b.percent - a.percent);
  }, [vendedores, metasVendedores, realizadoPorVendedor]);

  const barChartData = vendedorRows.map(r => ({
    nome: r.vendedor.nome.length > 12 ? r.vendedor.nome.substring(0, 12) + '...' : r.vendedor.nome,
    Meta: r.meta?.valor || 0,
    Realizado: r.realizado,
  }));

  const gaugeData = [
    { name: 'Atingido', value: Math.min(totalRealizado, metaGeral?.valor || 1) },
    { name: 'Restante', value: Math.max((metaGeral?.valor || 0) - totalRealizado, 0) },
  ];

  if (!metaGeral && metasVendedores.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <Target className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p className="text-lg font-medium">Nenhuma meta ativa encontrada</p>
        <p className="text-sm">Configure metas em Administração &gt; Metas para ver o relatório</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Resumo Geral */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Meta Geral</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-display text-[26px] leading-8 font-bold tabular-nums">{metaGeral ? formatCurrency(metaGeral.valor) : '-'}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Realizado</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-display text-[26px] leading-8 font-bold tabular-nums text-primary">{formatCurrency(totalRealizado)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">% Atingimento</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="font-display text-[26px] leading-8 font-bold tabular-nums">{percentGeral.toFixed(1)}%</p>
            <Progress value={Math.min(percentGeral, 100)} className="h-3" />
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Meta vs Realizado por Vendedor</CardTitle>
          </CardHeader>
          <CardContent>
            {barChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={barChartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="nome" fontSize={12} />
                  <YAxis tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} fontSize={12} />
                  <Tooltip formatter={(v: number) => formatCurrency(v)} />
                  <Legend />
                  <Bar dataKey="Meta" fill="hsl(var(--muted-foreground))" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Realizado" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : <p className="text-center py-8 text-muted-foreground">Sem dados</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Atingimento da Meta Geral</CardTitle>
          </CardHeader>
          <CardContent className="flex justify-center">
            {metaGeral ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={gaugeData}
                    cx="50%"
                    cy="50%"
                    innerRadius={70}
                    outerRadius={100}
                    startAngle={90}
                    endAngle={-270}
                    dataKey="value"
                  >
                    <Cell fill="hsl(var(--primary))" />
                    <Cell fill="hsl(var(--muted))" />
                  </Pie>
                  <Tooltip formatter={(v: number) => formatCurrency(v)} />
                  <text x="50%" y="50%" textAnchor="middle" dominantBaseline="middle" className="fill-foreground font-display text-[26px] leading-8 font-bold tabular-nums">
                    {percentGeral.toFixed(0)}%
                  </text>
                </PieChart>
              </ResponsiveContainer>
            ) : <p className="text-center py-8 text-muted-foreground">Sem meta geral</p>}
          </CardContent>
        </Card>
      </div>

      {/* Tabela detalhada */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Users className="h-5 w-5" />Detalhamento por Vendedor</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Vendedor</TableHead>
                <TableHead className="text-right">Meta</TableHead>
                <TableHead className="text-right">Realizado</TableHead>
                <TableHead className="text-right">% Atingido</TableHead>
                <TableHead className="text-right">Diferença</TableHead>
                <TableHead className="w-40">Progresso</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {vendedorRows.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Sem dados</TableCell></TableRow>
              ) : vendedorRows.map(r => (
                <TableRow key={r.vendedor.id}>
                  <TableCell className="font-medium">{r.vendedor.nome}</TableCell>
                  <TableCell className="text-right">{r.meta ? formatCurrency(r.meta.valor) : <span className="text-muted-foreground">Sem meta</span>}</TableCell>
                  <TableCell className="text-right font-semibold">{formatCurrency(r.realizado)}</TableCell>
                  <TableCell className="text-right">
                    {r.meta ? (
                      <Badge variant={r.percent >= 100 ? 'default' : r.percent >= 70 ? 'secondary' : 'destructive'}>
                        {r.percent.toFixed(1)}%
                      </Badge>
                    ) : '-'}
                  </TableCell>
                  <TableCell className={`text-right font-medium ${r.diff >= 0 ? 'text-success' : 'text-destructive'}`}>
                    {r.meta ? `${r.diff >= 0 ? '+' : ''}${formatCurrency(r.diff)}` : '-'}
                  </TableCell>
                  <TableCell>
                    {r.meta ? <Progress value={Math.min(r.percent, 100)} className="h-2" /> : '-'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default MetaReportTab;
