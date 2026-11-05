import { useState, useEffect, useMemo } from 'react';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import Layout from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { ChevronDown, ChevronRight, Search, FileSearch, EyeOff, Undo2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { storage } from '@/lib/storage';
import { Sale, Installment } from '@/lib/types';

const getDefaultDates = () => {
  const now = new Date();
  return {
    start: format(startOfMonth(now), 'yyyy-MM-dd'),
    end: format(endOfMonth(now), 'yyyy-MM-dd'),
  };
};

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

interface PaymentLogEntry {
  id: string;
  installment_id: string;
  valor: number;
  data_pagamento: string;
  metodo: string;
  observacoes: string | null;
  created_at: string;
}

interface AuditEntry {
  installment: Installment;
  sale: Sale;
  type: 'paid' | 'partial';
  countedValue: number;
  ignoredValue: number;
  reason: string;
}

const exclusionKey = (type: 'payment' | 'installment', id: string) => `${type}:${id}`;

const RankingAudit = () => {
  const defaultDates = getDefaultDates();
  const [sales, setSales] = useState<Sale[]>([]);
  const [installments, setInstallments] = useState<Installment[]>([]);
  const [startDate, setStartDate] = useState(defaultDates.start);
  const [endDate, setEndDate] = useState(defaultDates.end);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterSeller, setFilterSeller] = useState('all');
  const [expandedSellers, setExpandedSellers] = useState<Set<string>>(new Set());
  const [paymentLogs, setPaymentLogs] = useState<Map<string, PaymentLogEntry[]>>(new Map());
  const [exclusions, setExclusions] = useState<Set<string>>(new Set());
  const [savingKey, setSavingKey] = useState<string | null>(null);

  const loadExclusions = async () => {
    const { data } = await supabase
      .from('ranking_exclusions')
      .select('reference_type, reference_id');
    if (data) {
      setExclusions(
        new Set(
          data.map((r: { reference_type: string; reference_id: string }) =>
            exclusionKey(r.reference_type as 'payment' | 'installment', r.reference_id)
          )
        )
      );
    }
  };

  const toggleExclusion = async (type: 'payment' | 'installment', id: string) => {
    const key = exclusionKey(type, id);
    const isExcluded = exclusions.has(key);
    setSavingKey(key);
    try {
      if (isExcluded) {
        const { error } = await supabase
          .from('ranking_exclusions')
          .delete()
          .eq('reference_type', type)
          .eq('reference_id', id);
        if (error) throw error;
        setExclusions((prev) => {
          const next = new Set(prev);
          next.delete(key);
          return next;
        });
        toast({ title: 'Valor retornado ao ranking' });
      } else {
        const { data: userData } = await supabase.auth.getUser();
        if (!userData.user) throw new Error('Sessão expirada');
        const { error } = await supabase.from('ranking_exclusions').insert({
          user_id: userData.user.id,
          reference_type: type,
          reference_id: id,
        });
        if (error) throw error;
        setExclusions((prev) => new Set(prev).add(key));
        toast({ title: 'Valor desconsiderado do ranking', description: 'O financeiro continua contabilizando normalmente.' });
      }
    } catch (err) {
      toast({
        title: 'Erro',
        description: err instanceof Error ? err.message : 'Não foi possível atualizar o ranking.',
        variant: 'destructive',
      });
    } finally {
      setSavingKey(null);
    }
  };

  useEffect(() => {
    const load = async () => {
      const [s, i] = await Promise.all([storage.getSales(), storage.getInstallments()]);
      setSales(s);
      setInstallments(i);

      // Fetch all payment log entries
      const { data: logs } = await supabase
        .from('installment_payments')
        .select('*')
        .order('data_pagamento', { ascending: true });

      if (logs) {
        const map = new Map<string, PaymentLogEntry[]>();
        logs.forEach((log: PaymentLogEntry) => {
          const existing = map.get(log.installment_id) || [];
          existing.push(log);
          map.set(log.installment_id, existing);
        });
        setPaymentLogs(map);
      }

      await loadExclusions();
    };
    load();
  }, []);

  const auditData = useMemo(() => {
    const entries: AuditEntry[] = [];

    sales.forEach((sale) => {
      const isBoleto = sale.paymentMode?.toLowerCase().includes('boleto');

      // Get all relevant installments (paid or with partial payments)
      const relevantInsts = installments.filter(
        (inst) =>
          inst.saleId === sale.id &&
          inst.status !== 'refunded' &&
          (!isBoleto || inst.installmentNumber === 0) &&
          (inst.status === 'paid' || (inst.paidAmount || 0) > 0)
      );

      relevantInsts.forEach((inst) => {
        const logs = paymentLogs.get(inst.id) || [];

        if (logs.length > 0) {
          // USE LEDGER: only count payments whose dates fall within the period
          const logsInPeriod = logs.filter(
            (log) => log.data_pagamento >= startDate && log.data_pagamento <= endDate
          );

          if (logsInPeriod.length > 0) {
            const countedLogs = logsInPeriod.filter(
              (log) => !exclusions.has(exclusionKey('payment', log.id))
            );
            const periodAmount = countedLogs.reduce((sum, log) => sum + Number(log.valor), 0);
            const ignoredAmount = logsInPeriod
              .filter((log) => exclusions.has(exclusionKey('payment', log.id)))
              .reduce((sum, log) => sum + Number(log.valor), 0);
            entries.push({
              installment: inst,
              sale,
              type: inst.status === 'paid' && logsInPeriod.length === logs.length ? 'paid' : 'partial',
              countedValue: periodAmount,
              ignoredValue: ignoredAmount,
              reason: inst.status === 'paid' && logsInPeriod.length === logs.length
                ? `Parcela paga (${logsInPeriod.length} entrada${logsInPeriod.length > 1 ? 's' : ''} no período)`
                : `Pagamento parcial no período (${logsInPeriod.length} de ${logs.length} entrada${logs.length > 1 ? 's' : ''})`,
            });
          }
        } else if (inst.status === 'paid' && inst.paidDate) {
          // FALLBACK for installments paid before the ledger system existed
          if (inst.paidDate >= startDate && inst.paidDate <= endDate) {
            const amount = inst.paidAmount ?? inst.fullValue ?? inst.value;
            const baseValue =
              sale.tipoBoleto === 'repasse' && inst.isRepasse
                ? inst.companyValue || amount
                : amount;
            const isIgnored = exclusions.has(exclusionKey('installment', inst.id));

            entries.push({
              installment: inst,
              sale,
              type: 'paid',
              countedValue: isIgnored ? 0 : baseValue,
              ignoredValue: isIgnored ? baseValue : 0,
              reason: `Parcela paga em ${inst.paidDate} (sem histórico detalhado)`,
            });
          }
        }
      });
    });

    return entries;
  }, [sales, installments, startDate, endDate, paymentLogs, exclusions]);

  // Group by seller
  const groupedBySeller = useMemo(() => {
    const map = new Map<string, { entries: AuditEntry[]; total: number }>();

    auditData.forEach((entry) => {
      const seller = entry.sale.seller || 'Sem Vendedor';
      if (!map.has(seller)) map.set(seller, { entries: [], total: 0 });
      const group = map.get(seller)!;
      group.entries.push(entry);
      group.total += entry.countedValue;
    });

    return Array.from(map.entries())
      .sort((a, b) => b[1].total - a[1].total);
  }, [auditData]);

  const sellers = useMemo(
    () => groupedBySeller.map(([name]) => name),
    [groupedBySeller]
  );

  const filtered = useMemo(() => {
    let result = groupedBySeller;
    if (filterSeller !== 'all') {
      result = result.filter(([name]) => name === filterSeller);
    }
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result
        .map(([name, data]) => [
          name,
          {
            ...data,
            entries: data.entries.filter(
              (e) =>
                e.installment.studentName.toLowerCase().includes(term) ||
                e.sale.course.toLowerCase().includes(term) ||
                e.sale.id.toLowerCase().includes(term)
            ),
          },
        ] as [string, { entries: AuditEntry[]; total: number }])
        .filter(([, data]) => data.entries.length > 0);
    }
    return result;
  }, [groupedBySeller, filterSeller, searchTerm]);

  const toggleSeller = (name: string) => {
    setExpandedSellers((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const totalGeral = groupedBySeller.reduce((sum, [, data]) => sum + data.total, 0);
  const totalIgnorado = auditData.reduce((sum, e) => sum + e.ignoredValue, 0);

  // Excluded installments (paid but outside period or boleto non-entry)
  const excludedEntries = useMemo(() => {
    const excluded: { installment: Installment; sale: Sale; reason: string }[] = [];

    sales.forEach((sale) => {
      const isBoleto = sale.paymentMode?.toLowerCase().includes('boleto');

      installments
        .filter((inst) => inst.saleId === sale.id && inst.status === 'paid')
        .forEach((inst) => {
          if (!inst.paidDate) return;

          if (inst.paidDate < startDate || inst.paidDate > endDate) {
            // Paid outside period — not excluded from view, just not counted
            return;
          }

          if (isBoleto && inst.installmentNumber !== 0) {
            excluded.push({
              installment: inst,
              sale,
              reason: `Boleto: apenas entrada conta (parcela ${inst.installmentNumber})`,
            });
          }
        });
    });

    return excluded;
  }, [sales, installments, startDate, endDate]);

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="font-display text-[26px] leading-8 text-ink-950 mb-1 flex items-center gap-2">
            <FileSearch className="h-7 w-7 text-ink-950" />
            Auditoria do Ranking
          </h1>
          <p className="text-[13.5px] text-ink-500">
            Detalhamento de todas as parcelas contabilizadas no ranking de vendedores
          </p>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
              <div>
                <Label>Data Início</Label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div>
                <Label>Data Fim</Label>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
              <div>
                <Label>Vendedor</Label>
                <Select value={filterSeller} onValueChange={setFilterSeller}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    {sellers.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Buscar</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Aluno, curso ou ID..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Summary */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6 text-center">
              <p className="text-[13px] text-ink-500">Total Contabilizado</p>
              <p className="font-display text-[26px] tabular-nums text-ink-950">{formatCurrency(totalGeral)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 text-center">
              <p className="text-[13px] text-ink-500">Parcelas Contadas</p>
              <p className="font-display text-[26px] tabular-nums text-ink-950">{auditData.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 text-center">
              <p className="text-[13px] text-ink-500">Desconsiderado do Ranking</p>
              <p className="font-display text-[26px] tabular-nums text-destructive line-through">
                {formatCurrency(totalIgnorado)}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 text-center">
              <p className="text-[13px] text-ink-500">Vendedores</p>
              <p className="font-display text-[26px] tabular-nums text-ink-950">{groupedBySeller.length}</p>
            </CardContent>
          </Card>
        </div>

        {/* Detail per seller */}
        <Card>
          <CardHeader>
            <CardTitle>Detalhamento por Vendedor</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {filtered.length === 0 && (
              <p className="text-center text-muted-foreground py-8">
                Nenhum registro encontrado para o período selecionado
              </p>
            )}

            {filtered.map(([sellerName, data]) => {
              const isOpen = expandedSellers.has(sellerName);
              const paidCount = data.entries.filter((e) => e.type === 'paid').length;
              const partialCount = data.entries.filter((e) => e.type === 'partial').length;

              return (
                <Collapsible key={sellerName} open={isOpen} onOpenChange={() => toggleSeller(sellerName)}>
                  <CollapsibleTrigger className="flex items-center justify-between w-full p-4 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
                    <div className="flex items-center gap-3">
                      {isOpen ? (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      )}
                      <span className="font-semibold text-foreground">{sellerName}</span>
                      <Badge variant="secondary" className="text-xs">
                        {paidCount} paga{paidCount !== 1 ? 's' : ''}
                      </Badge>
                      {partialCount > 0 && (
                        <Badge variant="outline" className="text-xs border-chart-4 text-chart-4">
                          {partialCount} parcial(is)
                        </Badge>
                      )}
                    </div>
                    <span className="font-bold text-primary">{formatCurrency(data.total)}</span>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="mt-1 rounded-lg border overflow-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-[50px]">Tipo</TableHead>
                            <TableHead>Aluno</TableHead>
                            <TableHead>Curso</TableHead>
                            <TableHead>Parcela</TableHead>
                            <TableHead>Valor Original</TableHead>
                            <TableHead>Valor Pago</TableHead>
                            <TableHead>Valor Contado</TableHead>
                            <TableHead>Histórico de Pagamentos</TableHead>
                            <TableHead>Vencimento</TableHead>
                            <TableHead>Forma Pgto Venda</TableHead>
                            <TableHead>Tipo Boleto</TableHead>
                            <TableHead>Motivo</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {data.entries.map((entry, idx) => (
                            <TableRow key={`${entry.installment.id}-${idx}`}>
                              <TableCell>
                                {entry.type === 'paid' ? (
                                  <Badge className="bg-success text-white text-xs">Pago</Badge>
                                ) : (
                                  <Badge variant="outline" className="text-xs border-chart-4 text-chart-4">
                                    Parcial
                                  </Badge>
                                )}
                              </TableCell>
                              <TableCell className="font-medium text-sm">
                                {entry.installment.studentName}
                              </TableCell>
                              <TableCell className="text-sm">{entry.installment.course}</TableCell>
                              <TableCell className="text-sm">
                                {entry.installment.installmentNumber === 0
                                  ? 'Entrada'
                                  : `${entry.installment.installmentNumber}/${entry.installment.totalInstallments}`}
                              </TableCell>
                              <TableCell className="text-sm">
                                {formatCurrency(entry.installment.fullValue ?? entry.installment.value)}
                              </TableCell>
                              <TableCell className="text-sm">
                                {formatCurrency(entry.installment.paidAmount ?? 0)}
                              </TableCell>
                              <TableCell className="text-sm font-semibold text-primary">
                                {formatCurrency(entry.countedValue)}
                                {entry.ignoredValue > 0 && (
                                  <div className="text-xs font-normal text-muted-foreground line-through">
                                    {formatCurrency(entry.ignoredValue)}
                                  </div>
                                )}
                              </TableCell>
                              <TableCell className="text-sm">
                                {(() => {
                                  const logs = paymentLogs.get(entry.installment.id);
                                  if (logs && logs.length > 0) {
                                    return (
                                      <div className="space-y-1">
                                        {logs.map((log) => {
                                          const key = exclusionKey('payment', log.id);
                                          const isIgnored = exclusions.has(key);
                                          return (
                                            <div
                                              key={log.id}
                                              className={cn(
                                                'flex items-start gap-2 border-l-2 pl-2 py-0.5',
                                                isIgnored ? 'border-destructive/50 opacity-70' : 'border-primary/30'
                                              )}
                                            >
                                              <div className={cn('flex flex-col', isIgnored && 'line-through')}>
                                                <span className="text-xs font-medium">{log.data_pagamento}</span>
                                                <span className="text-xs text-muted-foreground">
                                                  {formatCurrency(log.valor)} — {log.metodo}
                                                </span>
                                                {log.observacoes && (
                                                  <span className="text-xs text-muted-foreground italic">{log.observacoes}</span>
                                                )}
                                              </div>
                                              <Button
                                                type="button"
                                                size="sm"
                                                variant="ghost"
                                                disabled={savingKey === key}
                                                className="h-6 px-1 text-xs shrink-0"
                                                title={isIgnored ? 'Retornar ao ranking' : 'Desconsiderar do ranking'}
                                                onClick={() => toggleExclusion('payment', log.id)}
                                              >
                                                {isIgnored ? <Undo2 className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                                              </Button>
                                            </div>
                                          );
                                        })}
                                      </div>
                                    );
                                  }
                                  // Fallback for entries before the log system
                                  const instKey = exclusionKey('installment', entry.installment.id);
                                  const instIgnored = exclusions.has(instKey);
                                  return (
                                    <div className="flex items-center gap-2">
                                      <span className={cn('text-xs', instIgnored && 'line-through opacity-70')}>
                                        {entry.installment.paidDate || '-'}
                                      </span>
                                      <Button
                                        type="button"
                                        size="sm"
                                        variant="ghost"
                                        disabled={savingKey === instKey}
                                        className="h-6 px-1 text-xs shrink-0"
                                        title={instIgnored ? 'Retornar ao ranking' : 'Desconsiderar do ranking'}
                                        onClick={() => toggleExclusion('installment', entry.installment.id)}
                                      >
                                        {instIgnored ? <Undo2 className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                                      </Button>
                                    </div>
                                  );
                                })()}
                              </TableCell>
                              <TableCell className="text-sm">
                                {entry.installment.dueDate}
                              </TableCell>
                              <TableCell className="text-sm">{entry.sale.paymentMode}</TableCell>
                              <TableCell className="text-sm">{entry.sale.tipoBoleto || '-'}</TableCell>
                              <TableCell className="text-xs text-muted-foreground">
                                {entry.reason}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              );
            })}
          </CardContent>
        </Card>

        {/* Excluded installments */}
        {excludedEntries.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-destructive">
                Parcelas Excluídas do Ranking ({excludedEntries.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Aluno</TableHead>
                      <TableHead>Vendedor</TableHead>
                      <TableHead>Parcela</TableHead>
                      <TableHead>Valor Pago</TableHead>
                      <TableHead>Data Pgto</TableHead>
                      <TableHead>Motivo da Exclusão</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {excludedEntries.map((entry, idx) => (
                      <TableRow key={idx}>
                        <TableCell className="text-sm">{entry.installment.studentName}</TableCell>
                        <TableCell className="text-sm">{entry.sale.seller}</TableCell>
                        <TableCell className="text-sm">
                          {entry.installment.installmentNumber}/{entry.installment.totalInstallments}
                        </TableCell>
                        <TableCell className="text-sm">
                          {formatCurrency(entry.installment.paidAmount ?? entry.installment.value)}
                        </TableCell>
                        <TableCell className="text-sm">{entry.installment.paidDate}</TableCell>
                        <TableCell className="text-sm text-destructive">{entry.reason}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </Layout>
  );
};

export default RankingAudit;
