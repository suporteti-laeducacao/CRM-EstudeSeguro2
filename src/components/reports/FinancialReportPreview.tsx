import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Button } from '@/components/ui/button';
import { format, parseISO, isWithinInterval, getMonth, getYear } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ChevronDown, ChevronUp, AlertTriangle, CheckCircle2 } from 'lucide-react';
import type { FinancialReportFilters } from './FinancialReportFilters';
import { useBranding } from '@/hooks/useBranding';

interface Sale {
  id: string;
  studentName: string;
  course: string;
  paymentMode: string;
  amount: number;
  quantity: number;
  date: string;
  seller: string;
  vendedorId?: string;
  valorEmpresa?: number;
}

interface Installment {
  id: string;
  saleId: string;
  studentName: string;
  course: string;
  installmentNumber: number;
  totalInstallments: number;
  value: number;
  dueDate: string;
  status: 'pending' | 'due_today' | 'overdue' | 'paid' | 'refunded';
  paidDate?: string;
  paidAmount?: number;
  fullValue?: number;
  companyValue?: number;
}

interface FinancialReportPreviewProps {
  filters: FinancialReportFilters;
  sales: Sale[];
  installments: Installment[];
  vendedores: { id: string; nome: string }[];
}

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
};

const FinancialReportPreview = ({
  filters,
  sales,
  installments,
  vendedores,
}: FinancialReportPreviewProps) => {
  const { nomeEmpresa } = useBranding();
  const [showPendingDetails, setShowPendingDetails] = useState(false);
  const [showOverdueDetails, setShowOverdueDetails] = useState(false);
  // Filtrar vendas pelo período e vendedores
  const vendasFiltradas = useMemo(() => {
    return sales.filter((sale) => {
      const dataSale = parseISO(sale.date);

      // Filtro de data
      if (filters.dataInicio && filters.dataFim) {
        if (!isWithinInterval(dataSale, { start: filters.dataInicio, end: filters.dataFim })) {
          return false;
        }
      } else if (filters.dataInicio) {
        if (dataSale < filters.dataInicio) return false;
      } else if (filters.dataFim) {
        if (dataSale > filters.dataFim) return false;
      }

      // Filtro de vendedor
      if (!filters.todosVendedores && filters.vendedoresSelecionados.length > 0) {
        if (!sale.vendedorId || !filters.vendedoresSelecionados.includes(sale.vendedorId)) {
          return false;
        }
      }

      return true;
    });
  }, [sales, filters]);

  // Filtrar parcelas pelo período e vendedores
  const parcelasFiltradas = useMemo(() => {
    const saleIdsVendedor = new Set(
      vendasFiltradas.map((v) => v.id)
    );

    return installments.filter((inst) => {
      // Filtrar por vendedor via saleId
      if (!filters.todosVendedores && filters.vendedoresSelecionados.length > 0) {
        if (!saleIdsVendedor.has(inst.saleId)) {
          return false;
        }
      }

      return true;
    });
  }, [installments, vendasFiltradas, filters]);

  // Parcelas pagas no período (para valores recebidos)
  const parcelasRecebidas = useMemo(() => {
    return parcelasFiltradas.filter((inst) => {
      if (inst.status !== 'paid' || !inst.paidDate) return false;

      const dataPaga = parseISO(inst.paidDate);

      if (filters.dataInicio && filters.dataFim) {
        return isWithinInterval(dataPaga, { start: filters.dataInicio, end: filters.dataFim });
      } else if (filters.dataInicio) {
        return dataPaga >= filters.dataInicio;
      } else if (filters.dataFim) {
        return dataPaga <= filters.dataFim;
      }

      return true;
    });
  }, [parcelasFiltradas, filters]);

  // Parcelas a receber no período (pendentes com vencimento no período)
  const parcelasAReceber = useMemo(() => {
    return parcelasFiltradas.filter((inst) => {
      if (inst.status === 'paid' || inst.status === 'refunded') return false;

      const dataVencimento = parseISO(inst.dueDate);

      if (filters.dataInicio && filters.dataFim) {
        return isWithinInterval(dataVencimento, { start: filters.dataInicio, end: filters.dataFim });
      } else if (filters.dataInicio) {
        return dataVencimento >= filters.dataInicio;
      } else if (filters.dataFim) {
        return dataVencimento <= filters.dataFim;
      }

      return true;
    });
  }, [parcelasFiltradas, filters]);

  // Parcelas em atraso (overdue) - calcular dinamicamente baseado na data
  const parcelasInadimplentes = useMemo(() => {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    
    return parcelasFiltradas.filter((inst) => {
      if (inst.status === 'paid' || inst.status === 'refunded') return false;
      const dataVencimento = parseISO(inst.dueDate);
      return dataVencimento < hoje;
    });
  }, [parcelasFiltradas]);

  // Agrupar inadimplentes por aluno
  const inadimplentesPorAluno = useMemo(() => {
    const agrupado: Record<string, { nome: string; parcelas: typeof parcelasInadimplentes; valorTotal: number }> = {};
    
    parcelasInadimplentes.forEach((parcela) => {
      if (!agrupado[parcela.studentName]) {
        agrupado[parcela.studentName] = {
          nome: parcela.studentName,
          parcelas: [],
          valorTotal: 0,
        };
      }
      agrupado[parcela.studentName].parcelas.push(parcela);
      agrupado[parcela.studentName].valorTotal += parcela.value;
    });

    return Object.values(agrupado);
  }, [parcelasInadimplentes]);

  // Agrupar pendentes por aluno
  const pendentesPorAluno = useMemo(() => {
    const agrupado: Record<string, { nome: string; parcelas: typeof parcelasAReceber; valorTotal: number }> = {};
    
    parcelasAReceber.forEach((parcela) => {
      if (!agrupado[parcela.studentName]) {
        agrupado[parcela.studentName] = {
          nome: parcela.studentName,
          parcelas: [],
          valorTotal: 0,
        };
      }
      agrupado[parcela.studentName].parcelas.push(parcela);
      agrupado[parcela.studentName].valorTotal += parcela.value;
    });

    return Object.values(agrupado);
  }, [parcelasAReceber]);

  // Cálculos de resumo
  const resumo = useMemo(() => {
    const totalVendas = vendasFiltradas.length;
    const valorRecebido = parcelasRecebidas.reduce((acc, p) => acc + (p.paidAmount ?? p.fullValue ?? p.value), 0);
    const valorAReceber = parcelasAReceber.reduce((acc, p) => acc + p.value, 0);
    const totalInadimplentes = parcelasInadimplentes.length;
    const totalAlunosInadimplentes = inadimplentesPorAluno.length;

    return {
      totalVendas,
      valorRecebido,
      valorAReceber,
      totalInadimplentes,
      totalAlunosInadimplentes,
    };
  }, [vendasFiltradas, parcelasRecebidas, parcelasAReceber, parcelasInadimplentes, inadimplentesPorAluno]);

  // Agrupar por mês
  const dadosPorMes = useMemo(() => {
    const meses: Record<string, {
      mes: string;
      vendas: Sale[];
      recebido: number;
      aReceber: number;
      porVendedor: Record<string, { vendas: number; recebido: number; aReceber: number }>;
    }> = {};

    vendasFiltradas.forEach((venda) => {
      const dataVenda = parseISO(venda.date);
      const mesAno = format(dataVenda, 'MMMM yyyy', { locale: ptBR });
      const chave = `${getYear(dataVenda)}-${getMonth(dataVenda)}`;

      if (!meses[chave]) {
        meses[chave] = {
          mes: mesAno.charAt(0).toUpperCase() + mesAno.slice(1),
          vendas: [],
          recebido: 0,
          aReceber: 0,
          porVendedor: {},
        };
      }

      meses[chave].vendas.push(venda);

      const vendedorNome = vendedores.find((v) => v.id === venda.vendedorId)?.nome || venda.seller || 'Não identificado';
      if (!meses[chave].porVendedor[vendedorNome]) {
        meses[chave].porVendedor[vendedorNome] = { vendas: 0, recebido: 0, aReceber: 0 };
      }
      meses[chave].porVendedor[vendedorNome].vendas += 1;
    });

    // Adicionar valores recebidos por mês
    parcelasRecebidas.forEach((parcela) => {
      if (!parcela.paidDate) return;
      const dataPaga = parseISO(parcela.paidDate);
      const chave = `${getYear(dataPaga)}-${getMonth(dataPaga)}`;

      if (meses[chave]) {
      meses[chave].recebido += parcela.paidAmount ?? parcela.fullValue ?? parcela.value;

        const venda = vendasFiltradas.find((v) => v.id === parcela.saleId);
        if (venda) {
          const vendedorNome = vendedores.find((v) => v.id === venda.vendedorId)?.nome || venda.seller || 'Não identificado';
          if (meses[chave].porVendedor[vendedorNome]) {
            meses[chave].porVendedor[vendedorNome].recebido += parcela.paidAmount ?? parcela.fullValue ?? parcela.value;
          }
        }
      }
    });

    // Adicionar valores a receber por mês
    parcelasAReceber.forEach((parcela) => {
      const dataVencimento = parseISO(parcela.dueDate);
      const chave = `${getYear(dataVencimento)}-${getMonth(dataVencimento)}`;

      if (meses[chave]) {
        meses[chave].aReceber += parcela.value;

        const venda = vendasFiltradas.find((v) => v.id === parcela.saleId);
        if (venda) {
          const vendedorNome = vendedores.find((v) => v.id === venda.vendedorId)?.nome || venda.seller || 'Não identificado';
          if (meses[chave].porVendedor[vendedorNome]) {
            meses[chave].porVendedor[vendedorNome].aReceber += parcela.value;
          }
        }
      }
    });

    return Object.values(meses).sort((a, b) => a.mes.localeCompare(b.mes));
  }, [vendasFiltradas, parcelasRecebidas, parcelasAReceber, vendedores]);

  if (!filters.dataInicio && !filters.dataFim) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-muted-foreground">
          Selecione um período para visualizar o relatório.
        </CardContent>
      </Card>
    );
  }

  if (!filters.valoresRecebidos && !filters.valoresAReceber) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-muted-foreground">
          Selecione pelo menos um tipo de valor (Recebidos ou A Receber).
        </CardContent>
      </Card>
    );
  }

  if (vendasFiltradas.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-muted-foreground">
          Nenhum dado encontrado para o período selecionado.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6" id="financial-report-preview">
      {/* Cabeçalho */}
      <Card>
        <CardHeader className="text-center border-b">
          <CardTitle className="text-xl">RELATÓRIO DE FECHAMENTO COMERCIAL{nomeEmpresa ? ` – ${nomeEmpresa.toUpperCase()}` : ''}</CardTitle>
          <div className="text-sm text-muted-foreground mt-2">
            <p>
              Período analisado: {filters.dataInicio ? format(filters.dataInicio, "dd/MM/yyyy", { locale: ptBR }) : 'N/A'} a{' '}
              {filters.dataFim ? format(filters.dataFim, "dd/MM/yyyy", { locale: ptBR }) : 'N/A'}
            </p>
            <p>Data de geração: {format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</p>
          </div>
        </CardHeader>
      </Card>

      {/* 1. Resumo Geral */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">1. RESUMO GERAL DO PERÍODO</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Métrica</TableHead>
                <TableHead className="text-right">Valor</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell className="font-medium">Número Total de Vendas</TableCell>
                <TableCell className="text-right">{resumo.totalVendas}</TableCell>
              </TableRow>
              {filters.valoresRecebidos && (
                <TableRow>
                  <TableCell className="font-medium">Valor Total Recebido</TableCell>
                  <TableCell className="text-right text-[#07714E] font-semibold">
                    {formatCurrency(resumo.valorRecebido)}
                  </TableCell>
                </TableRow>
              )}
              {filters.valoresAReceber && (
                <TableRow>
                  <TableCell className="font-medium">Valor Total a Receber</TableCell>
                  <TableCell className="text-right text-[#B44309] font-semibold">
                    {formatCurrency(resumo.valorAReceber)}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* 2. Desempenho por Mês */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">2. DESEMPENHO POR MÊS</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {dadosPorMes.map((mes, idx) => (
            <div key={idx} className="border rounded-lg p-4">
              <h4 className="font-semibold text-md mb-3">2.{idx + 1} {mes.mes}</h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
                <div className="bg-muted/50 rounded p-3">
                  <p className="text-sm text-muted-foreground">Total de Vendas</p>
                  <p className="font-display text-[20px] leading-7 font-bold tabular-nums">{mes.vendas.length}</p>
                </div>
                {filters.valoresRecebidos && (
                  <div className="bg-[#E7F7F0] rounded p-3">
                    <p className="text-sm text-muted-foreground">Valor Recebido</p>
                    <p className="font-display text-[20px] leading-7 font-bold tabular-nums text-[#07714E]">{formatCurrency(mes.recebido)}</p>
                  </div>
                )}
              </div>

              {Object.keys(mes.porVendedor).length > 0 && (
                <div>
                  <p className="text-sm font-medium mb-2">Vendas por Vendedor:</p>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Vendedor</TableHead>
                        <TableHead className="text-right">Qtd. Vendas</TableHead>
                        {filters.valoresRecebidos && <TableHead className="text-right">Recebido</TableHead>}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {Object.entries(mes.porVendedor)
                        .sort((a, b) => b[1].recebido - a[1].recebido)
                        .map(([vendedor, dados]) => (
                        <TableRow key={vendedor}>
                          <TableCell>{vendedor}</TableCell>
                          <TableCell className="text-right">{dados.vendas}</TableCell>
                          {filters.valoresRecebidos && (
                            <TableCell className="text-right text-[#07714E]">
                              {formatCurrency(dados.recebido)}
                            </TableCell>
                          )}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      {/* 3. Valores Pendentes */}
      {filters.valoresAReceber && resumo.valorAReceber > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">3. VALORES PENDENTES A RECEBER</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-[#FFF1E7] rounded p-4">
                <p className="text-sm text-muted-foreground">Valor Total Pendente</p>
                <p className="font-display text-[26px] leading-8 font-bold tabular-nums text-[#B44309]">{formatCurrency(resumo.valorAReceber)}</p>
              </div>
              <div className="bg-muted/50 rounded p-4">
                <p className="text-sm text-muted-foreground">Parcelas Pendentes</p>
                <p className="font-display text-[26px] leading-8 font-bold tabular-nums">{parcelasAReceber.length}</p>
              </div>
            </div>

            {/* Lista de alunos com valores pendentes */}
            {pendentesPorAluno.length > 0 && (
              <Collapsible open={showPendingDetails} onOpenChange={setShowPendingDetails}>
                <CollapsibleTrigger asChild>
                  <Button variant="outline" className="w-full justify-between">
                    <span>Detalhamento por Aluno ({pendentesPorAluno.length} alunos)</span>
                    {showPendingDetails ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-4">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Aluno</TableHead>
                        <TableHead className="text-center">Parcelas</TableHead>
                        <TableHead className="text-right">Valor Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pendentesPorAluno.map((aluno) => (
                        <TableRow key={aluno.nome}>
                          <TableCell className="font-medium">{aluno.nome}</TableCell>
                          <TableCell className="text-center">{aluno.parcelas.length}</TableCell>
                          <TableCell className="text-right text-[#B44309] font-semibold">
                            {formatCurrency(aluno.valorTotal)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CollapsibleContent>
              </Collapsible>
            )}
          </CardContent>
        </Card>
      )}

      {/* 4. Inadimplência */}
      <Card className={resumo.totalAlunosInadimplentes > 0 ? "border-[#F5C2C2]" : ""}>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            {resumo.totalAlunosInadimplentes > 0 && <AlertTriangle className="h-5 w-5 text-[#B02121]" />}
            4. INADIMPLÊNCIA
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className={resumo.totalAlunosInadimplentes > 0 ? "bg-[#FDECEC] rounded p-4" : "bg-[#E7F7F0] rounded p-4"}>
            {resumo.totalAlunosInadimplentes > 0 ? (
              <p className="text-lg font-semibold text-[#B02121]">
                Atualmente {resumo.totalAlunosInadimplentes === 1 ? 'existe' : 'existem'}{' '}
                <span className="text-xl">{resumo.totalAlunosInadimplentes}</span>{' '}
                {resumo.totalAlunosInadimplentes === 1 ? 'aluno inadimplente' : 'alunos inadimplentes'}.
              </p>
            ) : (
              <p className="text-lg font-semibold text-[#07714E] flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5" />
                Não há alunos inadimplentes no momento.
              </p>
            )}
          </div>

          {/* Status de Notificações */}
          {filters.notificacoesEmAndamento && (
            <div className="flex items-center gap-2 p-3 bg-[#E7F7F0] rounded">
              <CheckCircle2 className="h-5 w-5 text-[#07714E]" />
              <span className="text-[#07714E]">
                As notificações de cobrança já estão em andamento.
              </span>
            </div>
          )}

          {/* Aviso de Bloqueio */}
          {filters.incluirAvisoBloqueio && (
            <div className="flex items-start gap-2 p-3 bg-[#FFF1E7] rounded border border-[#FFD3B0]">
              <AlertTriangle className="h-5 w-5 text-[#B44309] mt-0.5 flex-shrink-0" />
              <span className="text-[#B44309]">
                Caso não haja regularização, está previsto o bloqueio da plataforma após 1 mês, conforme política interna.
              </span>
            </div>
          )}

          {/* Lista de alunos inadimplentes */}
          {inadimplentesPorAluno.length > 0 && (
            <Collapsible open={showOverdueDetails} onOpenChange={setShowOverdueDetails}>
              <CollapsibleTrigger asChild>
                <Button variant="outline" className="w-full justify-between border-[#F5C2C2]">
                  <span>Ver detalhes dos inadimplentes</span>
                  {showOverdueDetails ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-4">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Aluno</TableHead>
                      <TableHead className="text-center">Parcelas em Atraso</TableHead>
                      <TableHead className="text-right">Valor Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {inadimplentesPorAluno.map((aluno) => (
                      <TableRow key={aluno.nome}>
                        <TableCell className="font-medium">{aluno.nome}</TableCell>
                        <TableCell className="text-center">{aluno.parcelas.length}</TableCell>
                        <TableCell className="text-right text-[#B02121] font-semibold">
                          {formatCurrency(aluno.valorTotal)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CollapsibleContent>
            </Collapsible>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default FinancialReportPreview;
