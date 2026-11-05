import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format, parseISO, isWithinInterval, getMonth, getYear } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { FinancialReportFilters } from './FinancialReportFilters';
import { applyTimbrado, TIMBRADO_TOP_MARGIN, TIMBRADO_BOTTOM_MARGIN } from './timbrado';

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

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
};

export const generateFinancialReportPDF = async (
  filters: FinancialReportFilters,
  sales: Sale[],
  installments: Installment[],
  vendedores: { id: string; nome: string }[]
) => {
  const doc = new jsPDF();
  let yPos = TIMBRADO_TOP_MARGIN;

  // Filtrar vendas
  const vendasFiltradas = sales.filter((sale) => {
    const dataSale = parseISO(sale.date);

    if (filters.dataInicio && filters.dataFim) {
      if (!isWithinInterval(dataSale, { start: filters.dataInicio, end: filters.dataFim })) {
        return false;
      }
    } else if (filters.dataInicio) {
      if (dataSale < filters.dataInicio) return false;
    } else if (filters.dataFim) {
      if (dataSale > filters.dataFim) return false;
    }

    if (!filters.todosVendedores && filters.vendedoresSelecionados.length > 0) {
      if (!sale.vendedorId || !filters.vendedoresSelecionados.includes(sale.vendedorId)) {
        return false;
      }
    }

    return true;
  });

  const saleIdsVendedor = new Set(vendasFiltradas.map((v) => v.id));

  const parcelasFiltradas = installments.filter((inst) => {
    if (!filters.todosVendedores && filters.vendedoresSelecionados.length > 0) {
      if (!saleIdsVendedor.has(inst.saleId)) {
        return false;
      }
    }
    return true;
  });

  const parcelasRecebidas = parcelasFiltradas.filter((inst) => {
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

  const parcelasAReceber = parcelasFiltradas.filter((inst) => {
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

  // Parcelas em atraso - calcular dinamicamente baseado na data
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  
  const parcelasInadimplentes = parcelasFiltradas.filter((inst) => {
    if (inst.status === 'paid' || inst.status === 'refunded') return false;
    const dataVencimento = parseISO(inst.dueDate);
    return dataVencimento < hoje;
  });

  const totalVendas = vendasFiltradas.length;
  const valorRecebido = parcelasRecebidas.reduce((acc, p) => acc + (p.paidAmount ?? p.fullValue ?? p.value), 0);
  const valorAReceber = parcelasAReceber.reduce((acc, p) => acc + p.value, 0);
  const totalInadimplentes = parcelasInadimplentes.length;

  // Cabeçalho
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('RELATÓRIO DE FECHAMENTO COMERCIAL', 105, yPos, { align: 'center' });
  yPos += 10;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  const periodoTexto = `Período analisado: ${filters.dataInicio ? format(filters.dataInicio, 'dd/MM/yyyy', { locale: ptBR }) : 'N/A'} a ${filters.dataFim ? format(filters.dataFim, 'dd/MM/yyyy', { locale: ptBR }) : 'N/A'}`;
  doc.text(periodoTexto, 105, yPos, { align: 'center' });
  yPos += 6;
  doc.text(`Data de geração: ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`, 105, yPos, { align: 'center' });
  yPos += 15;

  // 1. Resumo Geral
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('1. RESUMO GERAL DO PERÍODO', 14, yPos);
  yPos += 8;

  const resumoData: string[][] = [
    ['Número Total de Vendas', String(totalVendas)],
  ];

  if (filters.valoresRecebidos) {
    resumoData.push(['Valor Total Recebido', formatCurrency(valorRecebido)]);
  }

  if (filters.valoresAReceber) {
    resumoData.push(['Valor Total a Receber', formatCurrency(valorAReceber)]);
  }

  autoTable(doc, {
    startY: yPos,
    head: [['Métrica', 'Valor']],
    body: resumoData,
    theme: 'striped',
    headStyles: { fillColor: [26, 26, 26] },
    margin: { left: 14, right: 14, top: TIMBRADO_TOP_MARGIN, bottom: 30 },
  });

  yPos = (doc as any).lastAutoTable.finalY + 15;

  // 2. Desempenho por Mês
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

  const dadosPorMes = Object.values(meses).sort((a, b) => a.mes.localeCompare(b.mes));

  if (yPos > TIMBRADO_BOTTOM_MARGIN - 25) {
    doc.addPage();
    yPos = TIMBRADO_TOP_MARGIN;
  }

  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('2. DESEMPENHO POR MÊS', 14, yPos);
  yPos += 10;

  dadosPorMes.forEach((mes, idx) => {
    if (yPos > TIMBRADO_BOTTOM_MARGIN - 25) {
      doc.addPage();
      yPos = TIMBRADO_TOP_MARGIN;
    }

    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text(`2.${idx + 1} ${mes.mes}`, 14, yPos);
    yPos += 6;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Total de vendas realizadas: ${mes.vendas.length}`, 20, yPos);
    yPos += 5;

    if (filters.valoresRecebidos) {
      doc.text(`Valor total recebido: ${formatCurrency(mes.recebido)}`, 20, yPos);
      yPos += 5;
    }


    yPos += 3;

    // Tabela por vendedor
    const vendedorHeaders = ['Vendedor', 'Qtd. Vendas'];
    if (filters.valoresRecebidos) vendedorHeaders.push('Recebido');

    const vendedorData = Object.entries(mes.porVendedor)
      .sort((a, b) => b[1].recebido - a[1].recebido)
      .map(([vendedor, dados]) => {
      const row = [vendedor, String(dados.vendas)];
      if (filters.valoresRecebidos) row.push(formatCurrency(dados.recebido));
      return row;
    });

    if (vendedorData.length > 0) {
      autoTable(doc, {
        startY: yPos,
        head: [vendedorHeaders],
        body: vendedorData,
        theme: 'striped',
        headStyles: { fillColor: [80, 80, 80], fontSize: 9 },
        bodyStyles: { fontSize: 9 },
        margin: { left: 20, right: 14, top: TIMBRADO_TOP_MARGIN, bottom: 30 },
      });

      yPos = (doc as any).lastAutoTable.finalY + 10;
    } else {
      yPos += 5;
    }
  });

  // Agrupar inadimplentes e pendentes por aluno
  const inadimplentesPorAluno: Record<string, { nome: string; parcelas: number; valorTotal: number }> = {};
  parcelasInadimplentes.forEach((parcela) => {
    if (!inadimplentesPorAluno[parcela.studentName]) {
      inadimplentesPorAluno[parcela.studentName] = { nome: parcela.studentName, parcelas: 0, valorTotal: 0 };
    }
    inadimplentesPorAluno[parcela.studentName].parcelas += 1;
    inadimplentesPorAluno[parcela.studentName].valorTotal += parcela.value;
  });

  const pendentesPorAluno: Record<string, { nome: string; parcelas: number; valorTotal: number }> = {};
  parcelasAReceber.forEach((parcela) => {
    if (!pendentesPorAluno[parcela.studentName]) {
      pendentesPorAluno[parcela.studentName] = { nome: parcela.studentName, parcelas: 0, valorTotal: 0 };
    }
    pendentesPorAluno[parcela.studentName].parcelas += 1;
    pendentesPorAluno[parcela.studentName].valorTotal += parcela.value;
  });

  const listaInadimplentes = Object.values(inadimplentesPorAluno);
  const listaPendentes = Object.values(pendentesPorAluno);
  const totalAlunosInadimplentes = listaInadimplentes.length;

  // 3. Valores Pendentes
  if (filters.valoresAReceber && valorAReceber > 0) {
    if (yPos > TIMBRADO_BOTTOM_MARGIN - 35) {
      doc.addPage();
      yPos = TIMBRADO_TOP_MARGIN;
    }

    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('3. VALORES PENDENTES A RECEBER', 14, yPos);
    yPos += 8;

    autoTable(doc, {
      startY: yPos,
      head: [['Descrição', 'Valor']],
      body: [
        ['Valor Total Pendente', formatCurrency(valorAReceber)],
        ['Parcelas Pendentes', String(parcelasAReceber.length)],
      ],
      theme: 'striped',
      headStyles: { fillColor: [217, 119, 6] },
      margin: { left: 14, right: 14, top: TIMBRADO_TOP_MARGIN, bottom: 30 },
    });

    yPos = (doc as any).lastAutoTable.finalY + 10;

    // Detalhamento por aluno
    if (listaPendentes.length > 0) {
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text('Detalhamento por Aluno:', 14, yPos);
      yPos += 5;

      autoTable(doc, {
        startY: yPos,
        head: [['Aluno', 'Parcelas', 'Valor Total']],
        body: listaPendentes.map((aluno) => [
          aluno.nome,
          String(aluno.parcelas),
          formatCurrency(aluno.valorTotal),
        ]),
        theme: 'striped',
        headStyles: { fillColor: [217, 119, 6], fontSize: 9 },
        bodyStyles: { fontSize: 9 },
        margin: { left: 14, right: 14, top: TIMBRADO_TOP_MARGIN, bottom: 30 },
      });

      yPos = (doc as any).lastAutoTable.finalY + 15;
    }
  }

  // 4. Inadimplência (sempre exibir)
  if (yPos > TIMBRADO_BOTTOM_MARGIN - 35) {
    doc.addPage();
    yPos = TIMBRADO_TOP_MARGIN;
  }

  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('4. INADIMPLÊNCIA', 14, yPos);
  yPos += 10;

  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  
  if (totalAlunosInadimplentes > 0) {
    const textoInadimplencia = totalAlunosInadimplentes === 1 
      ? 'Atualmente existe 1 aluno inadimplente.'
      : `Atualmente existem ${totalAlunosInadimplentes} alunos inadimplentes.`;
    doc.text(textoInadimplencia, 14, yPos);
  } else {
    doc.text('Não há alunos inadimplentes no momento.', 14, yPos);
  }
  yPos += 8;

  if (filters.notificacoesEmAndamento) {
    doc.setFontSize(10);
    doc.text('[OK] As notificacoes de cobranca ja estao em andamento.', 14, yPos);
    yPos += 6;
  }

  if (filters.incluirAvisoBloqueio) {
    doc.setFontSize(10);
    doc.text('[ATENCAO] Caso nao haja regularizacao, esta previsto o bloqueio da plataforma', 14, yPos);
    yPos += 5;
    doc.text('apos 1 mes, conforme politica interna.', 14, yPos);
    yPos += 8;
  }

  // Lista de inadimplentes
  if (listaInadimplentes.length > 0) {
    yPos += 2;
    autoTable(doc, {
      startY: yPos,
      head: [['Aluno', 'Parcelas em Atraso', 'Valor Total']],
      body: listaInadimplentes.map((aluno) => [
        aluno.nome,
        String(aluno.parcelas),
        formatCurrency(aluno.valorTotal),
      ]),
      theme: 'striped',
      headStyles: { fillColor: [220, 38, 38], fontSize: 9 },
      bodyStyles: { fontSize: 9 },
      margin: { left: 14, right: 14, top: TIMBRADO_TOP_MARGIN, bottom: 30 },
    });
  }

  // Aplicar timbrado em todas as páginas
  await applyTimbrado(doc);

  // Download
  const fileName = `relatorio-financeiro-${format(new Date(), 'yyyy-MM-dd-HHmm')}.pdf`;
  doc.save(fileName);
};
