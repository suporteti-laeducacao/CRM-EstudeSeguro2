import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { applyTimbrado, TIMBRADO_TOP_MARGIN, TIMBRADO_BOTTOM_MARGIN } from './timbrado';

const fmt = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

const compStr = (cur: number, prev: number) => {
  if (prev === 0) return cur > 0 ? '+100%' : '0%';
  const diff = cur - prev;
  const pct = ((cur - prev) / Math.abs(prev)) * 100;
  const sign = diff >= 0 ? '+' : '';
  return `${sign}${fmt(diff)} (${sign}${pct.toFixed(1)}%)`;
};

const compStrNum = (cur: number, prev: number) => {
  if (prev === 0) return cur > 0 ? '+100%' : '0%';
  const diff = cur - prev;
  const pct = ((cur - prev) / Math.abs(prev)) * 100;
  const sign = diff >= 0 ? '+' : '';
  return `${sign}${diff} (${sign}${pct.toFixed(1)}%)`;
};

interface ReportData {
  selectedLabel: string;
  prevLabel: string;
  sec1: {
    receivedCur: number; receivedPrev: number;
    toReceiveCur: number; toReceivePrev: number;
    openCountCur: number; openCountPrev: number;
  };
  sec2: {
    totalCur: number; totalPrev: number;
    cancelCur?: number; cancelPrev?: number;
    receivedCur: number; receivedPrev: number;
    byModeCur: Record<string, { count: number; value: number; toReceive: number }>;
    sellerRanking: { nome: string; count: number; received: number }[];
    bySellerPrev: Record<string, { nome: string; count: number; received: number }>;
  };
  sec3: {
    total: number;
    top10: { nome: string; parcelas: number; valor: number }[];
    restCount: number; restParcelas: number; restValor: number;
  };
  sec4: {
    gastoCur: number; gastoPrev: number;
    leadsCur: number; leadsPrev: number;
    convCur: number; convPrev: number;
    cplCur: number; cplPrev: number;
    cpaCur: number; cpaPrev: number;
    taxaCur: number; taxaPrev: number;
    activeCampaigns: { id: string; nome: string; plataforma: string; gasto: number; leads: number; conversoes: number }[];
  };
  sec5: {
    paidValCur: number; paidValPrev: number;
    paidCountCur: number; paidCountPrev: number;
    pendValCur: number; pendCountCur: number;
    paidList: { descricao: string; credorNome: string; categoria: string; valor: number; valor_total?: number; valor_pago?: number; data_pagamento?: string }[];
    pendList: { descricao: string; credorNome: string; categoria: string; valor: number; data_vencimento: string; status: string }[];
  };
  sec6?: {
    totalCur: number; totalPrev: number;
    pagoCur: number; pendenteCur: number;
    byCategoria: { categoria: string; count: number; valor: number }[];
    list: { descricao: string; credorNome: string; categoria: string; competencia: string; status: string; valorConsiderado: number; data_pagamento?: string }[];
  };

  metaGeral?: { valor: number };
  metaBySellerName?: Record<string, number>;
}

export const generateMonthlyClosingPDF = async (data: ReportData) => {
  const doc = new jsPDF('p', 'mm', 'a4');
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 14;
  let y = TIMBRADO_TOP_MARGIN;

  const addTitle = (text: string) => {
    if (y > TIMBRADO_BOTTOM_MARGIN - 15) { doc.addPage(); y = TIMBRADO_TOP_MARGIN; }
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 0, 0);
    doc.text(text, margin, y);
    y += 2;
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.5);
    doc.line(margin, y, pageWidth - margin, y);
    y += 6;
  };

  const addMetricRow = (items: { label: string; value: string; comp: string; valueColor?: [number, number, number] }[]) => {
    if (y > TIMBRADO_BOTTOM_MARGIN - 10) { doc.addPage(); y = TIMBRADO_TOP_MARGIN; }
    const colW = (pageWidth - 2 * margin) / items.length;
    items.forEach((item, i) => {
      const x = margin + i * colW;
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100);
      doc.text(item.label, x, y);
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      if (item.valueColor) {
        doc.setTextColor(item.valueColor[0], item.valueColor[1], item.valueColor[2]);
      } else {
        doc.setTextColor(30);
      }
      doc.text(item.value, x, y + 5);
      doc.setFontSize(7);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(item.comp.startsWith('+') ? 34 : item.comp.startsWith('-') ? 180 : 100, item.comp.startsWith('+') ? 139 : item.comp.startsWith('-') ? 30 : 100, item.comp.startsWith('+') ? 34 : item.comp.startsWith('-') ? 30 : 100);
      doc.text(item.comp, x, y + 9);
    });
    y += 14;
  };

  const checkPage = (needed: number) => {
    if (y + needed > TIMBRADO_BOTTOM_MARGIN) { doc.addPage(); y = TIMBRADO_TOP_MARGIN; }
  };

  // ═══ HEADER ═══
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 0);
  doc.text(`FECHAMENTO DO MÊS — ${data.selectedLabel.toUpperCase()}`, pageWidth / 2, y, { align: 'center' });
  y += 6;
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100);
  doc.text(`Comparativo com ${data.prevLabel} • Gerado em ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`, pageWidth / 2, y, { align: 'center' });
  y += 10;

  // ═══ SEÇÃO 1 ═══
  y += 4;
  addTitle('1. MOVIMENTAÇÕES FINANCEIRAS DO MÊS');
  addMetricRow([
    { label: 'Valor Total Recebido', value: fmt(data.sec1.receivedCur), comp: compStr(data.sec1.receivedCur, data.sec1.receivedPrev) },
    { label: 'Valor Total a Receber', value: fmt(data.sec1.toReceiveCur), comp: compStr(data.sec1.toReceiveCur, data.sec1.toReceivePrev) },
    { label: 'Parcelas em Aberto', value: String(data.sec1.openCountCur), comp: compStrNum(data.sec1.openCountCur, data.sec1.openCountPrev) },
  ]);
  y += 10;

  // ═══ SEÇÃO 2 ═══
  addTitle('2. VENDAS DO MÊS');
  const sec2Metrics: { label: string; value: string; comp: string; valueColor?: [number, number, number] }[] = [
    {
      label: (data.sec2.cancelCur || 0) > 0
        ? `Vendas Ativas (+ ${data.sec2.cancelCur} cancelada(s) = ${data.sec2.totalCur + (data.sec2.cancelCur || 0)} total)`
        : 'Quantidade de Vendas',
      value: String(data.sec2.totalCur),
      comp: compStrNum(data.sec2.totalCur, data.sec2.totalPrev),
    },
    { label: 'Valor Recebido (vendas do mês)', value: fmt(data.sec2.receivedCur), comp: compStr(data.sec2.receivedCur, data.sec2.receivedPrev) },
  ];
  if (data.metaGeral) {
    const atingiu = data.sec2.receivedCur >= data.metaGeral.valor;
    const remaining = Math.max(data.metaGeral.valor - data.sec2.receivedCur, 0);
    const acima = data.sec2.receivedCur - data.metaGeral.valor;
    sec2Metrics.push({
      label: atingiu ? 'Acima da Meta 🎉' : 'Restante p/ Meta',
      value: atingiu ? fmt(acima) : fmt(remaining),
      comp: '',
      valueColor: atingiu ? [34, 139, 34] : [200, 30, 30],
    });
  }
  addMetricRow(sec2Metrics);

  // Meta Geral progress
  if (data.metaGeral) {
    checkPage(14);
    const metaPct = Math.min((data.sec2.receivedCur / data.metaGeral.valor) * 100, 100);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(50);
    doc.text('Meta Geral da Equipe', margin, y);
    y += 4;
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(80);
    doc.text(`${fmt(data.sec2.receivedCur)} / ${fmt(data.metaGeral.valor)} — ${metaPct.toFixed(1)}%`, margin, y);
    y += 4;
    // Draw progress bar
    const barWidth = pageWidth - 2 * margin;
    const barHeight = 4;
    doc.setFillColor(230, 230, 230);
    doc.roundedRect(margin, y, barWidth, barHeight, 2, 2, 'F');
    const fillWidth = (metaPct / 100) * barWidth;
    doc.setFillColor(26, 26, 26);
    if (fillWidth > 0) doc.roundedRect(margin, y, Math.max(fillWidth, 4), barHeight, 2, 2, 'F');
    y += 8;
    if (data.sec2.receivedCur >= data.metaGeral.valor) {
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(34, 139, 34);
      doc.text('Meta atingida!', margin, y);
      y += 6;
    }
  }

  // Seller ranking
  const hasMetas = data.metaBySellerName && Object.keys(data.metaBySellerName).length > 0;
  if (data.sec2.sellerRanking.length > 0) {
    checkPage(10 + data.sec2.sellerRanking.length * 7);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(50);
    doc.text('Ranking por Vendedor', margin, y);
    y += 4;

    const sellerHeaders = ['#', 'Vendedor', 'Vendas', 'Recebido'];
    if (hasMetas) sellerHeaders.push('Meta', 'Diferença', '% Atingido');
    sellerHeaders.push('Comparativo');

    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin, top: TIMBRADO_TOP_MARGIN, bottom: 30 },
      head: [sellerHeaders],
      body: data.sec2.sellerRanking.map((s, i) => {
        const prev = data.sec2.bySellerPrev[s.nome];
        const row = [`${i + 1}º`, s.nome, String(s.count), fmt(s.received)];
        if (hasMetas) {
          const meta = data.metaBySellerName![s.nome];
          if (meta) {
            const diff = s.received - meta;
            const pctAtingido = (s.received / meta) * 100;
            row.push(fmt(meta), `${diff >= 0 ? '+' : ''}${fmt(diff)}`, `${pctAtingido.toFixed(1)}%`);
          } else {
            row.push('—', '—', '—');
          }
        }
        row.push(compStr(s.received, prev?.received || 0));
        return row;
      }),
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [26, 26, 26], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [245, 247, 250] },
    });
    y = (doc as any).lastAutoTable.finalY + 6;
  }

  // By mode table (após ranking de vendedores)
  const modeEntries = Object.entries(data.sec2.byModeCur).sort((a, b) => b[1].value - a[1].value);
  if (modeEntries.length > 0) {
    checkPage(10 + modeEntries.length * 7);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(50);
    doc.text('Por Modalidade de Pagamento', margin, y);
    y += 4;
    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin, top: TIMBRADO_TOP_MARGIN, bottom: 30 },
      head: [['Modalidade', 'Qtd. Vendas', 'Valor Recebido', 'A Receber']],
      body: modeEntries.map(([mode, d]) => [mode, String(d.count), fmt(d.value), fmt(d.toReceive)]),
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [26, 26, 26], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [245, 247, 250] },
    });
    y = (doc as any).lastAutoTable.finalY + 6;
  }



  // ═══ SEÇÃO 3 ═══
  y += 10;
  checkPage(30);
  addTitle('3. INADIMPLÊNCIA');
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(50);
  doc.text(`Total de alunos inadimplentes: ${data.sec3.total}`, margin, y);
  y += 6;

  if (data.sec3.top10.length > 0) {
    const bodyRows = data.sec3.top10.map((a, i) => [`${i + 1}`, a.nome, String(a.parcelas), fmt(a.valor)]);
    if (data.sec3.restCount > 0) {
      bodyRows.push(['', `+ ${data.sec3.restCount} aluno(s)`, String(data.sec3.restParcelas), fmt(data.sec3.restValor)]);
    }
    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin, top: TIMBRADO_TOP_MARGIN, bottom: 30 },
      head: [['#', 'Aluno', 'Parcelas em Atraso', 'Valor Total']],
      body: bodyRows,
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [26, 26, 26], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [245, 247, 250] },
    });
    y = (doc as any).lastAutoTable.finalY + 6;
  }

  // ═══ SEÇÃO 4 ═══
  y += 10;
  checkPage(40);
  addTitle('4. TRÁFEGO PAGO DO MÊS');
  addMetricRow([
    { label: 'Total Gasto', value: fmt(data.sec4.gastoCur), comp: compStr(data.sec4.gastoCur, data.sec4.gastoPrev) },
    { label: 'Leads Captados', value: String(data.sec4.leadsCur), comp: compStrNum(data.sec4.leadsCur, data.sec4.leadsPrev) },
    { label: 'Leads Convertidos', value: String(data.sec4.convCur), comp: compStrNum(data.sec4.convCur, data.sec4.convPrev) },
  ]);
  addMetricRow([
    { label: 'CPL Médio', value: fmt(data.sec4.cplCur), comp: compStr(data.sec4.cplCur, data.sec4.cplPrev) },
    { label: 'CPA Médio', value: fmt(data.sec4.cpaCur), comp: compStr(data.sec4.cpaCur, data.sec4.cpaPrev) },
    { label: 'Taxa de Conversão', value: `${data.sec4.taxaCur.toFixed(1)}%`, comp: compStrNum(data.sec4.taxaCur, data.sec4.taxaPrev) },
  ]);

  if (data.sec4.activeCampaigns.length > 0) {
    checkPage(10 + data.sec4.activeCampaigns.length * 7);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(50);
    doc.text('Campanhas com Movimentação no Mês', margin, y);
    y += 4;
    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin, top: TIMBRADO_TOP_MARGIN, bottom: 30 },
      head: [['Campanha', 'Plataforma', 'Gasto', 'Leads', 'Conversões', 'CPL']],
      body: data.sec4.activeCampaigns.map(c => [
        c.nome, c.plataforma, fmt(c.gasto), String(c.leads), String(c.conversoes),
        c.leads > 0 ? fmt(c.gasto / c.leads) : '—',
      ]),
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [26, 26, 26], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [245, 247, 250] },
    });
    y = (doc as any).lastAutoTable.finalY + 6;
  }

  // ═══ SEÇÃO 5 ═══
  y += 10;
  checkPage(40);
  addTitle('5. CONTAS A PAGAR DO MÊS (REGIME DE CAIXA)');

  addMetricRow([
    { label: 'Total Pago', value: fmt(data.sec5.paidValCur), comp: compStr(data.sec5.paidValCur, data.sec5.paidValPrev) },
    { label: 'Contas Pagas', value: String(data.sec5.paidCountCur), comp: compStrNum(data.sec5.paidCountCur, data.sec5.paidCountPrev) },
    { label: 'Total Pendente', value: fmt(data.sec5.pendValCur), comp: '' },
    { label: 'Contas Pendentes', value: String(data.sec5.pendCountCur), comp: '' },
  ]);

  if (data.sec5.paidList.length > 0) {
    checkPage(10 + data.sec5.paidList.length * 7);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(50);
    doc.text('Contas Pagas no Mês', margin, y);
    y += 4;
    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin, top: TIMBRADO_TOP_MARGIN, bottom: 30 },
      head: [['Descrição', 'Credor', 'Categoria', 'Valor', 'Data Pagamento']],
      body: data.sec5.paidList.map(c => [
        c.descricao, c.credorNome, c.categoria,
        fmt(c.valor_total || c.valor_pago || c.valor),
        c.data_pagamento ? format(new Date(c.data_pagamento + 'T12:00:00'), 'dd/MM/yyyy') : '—',
      ]),
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [26, 26, 26], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [245, 247, 250] },
    });
    y = (doc as any).lastAutoTable.finalY + 6;
  }

  if (data.sec5.pendList.length > 0) {
    checkPage(10 + data.sec5.pendList.length * 7);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(50);
    doc.text('Contas Pendentes no Mês', margin, y);
    y += 4;
    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin, top: TIMBRADO_TOP_MARGIN, bottom: 30 },
      head: [['Descrição', 'Credor', 'Categoria', 'Valor', 'Vencimento', 'Status']],
      body: data.sec5.pendList.map(c => [
        c.descricao, c.credorNome, c.categoria, fmt(c.valor),
        format(new Date(c.data_vencimento + 'T12:00:00'), 'dd/MM/yyyy'),
        c.status === 'pendente' ? 'Pendente' : c.status,
      ]),
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [26, 26, 26], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [245, 247, 250] },
    });
    y = (doc as any).lastAutoTable.finalY + 6;
  }

  // ═══ SEÇÃO 6 ═══
  if (data.sec6) {
    y += 10;
    checkPage(40);
    addTitle('6. CUSTO OPERACIONAL (REGIME DE COMPETÊNCIA)');
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100);
    doc.text('Considera o mês de referência (competência), independentemente da data de pagamento.', margin, y);
    y += 5;
    addMetricRow([
      { label: 'Custo Operacional', value: fmt(data.sec6.totalCur), comp: compStr(data.sec6.totalCur, data.sec6.totalPrev) },
      { label: 'Já Pago', value: fmt(data.sec6.pagoCur), comp: '' },
      { label: 'Pendente', value: fmt(data.sec6.pendenteCur), comp: '' },
      { label: 'Lançamentos', value: String(data.sec6.list.length), comp: '' },
    ]);

    if (data.sec6.byCategoria.length > 0) {
      checkPage(10 + data.sec6.byCategoria.length * 7);
      autoTable(doc, {
        startY: y,
        margin: { left: margin, right: margin, top: TIMBRADO_TOP_MARGIN, bottom: 30 },
        head: [['Categoria', 'Qtd', 'Valor', '% do Total']],
        body: data.sec6.byCategoria.map(c => [
          c.categoria, String(c.count), fmt(c.valor),
          data.sec6!.totalCur > 0 ? `${((c.valor / data.sec6!.totalCur) * 100).toFixed(1)}%` : '—',
        ]),
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: [26, 26, 26], textColor: 255, fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [245, 247, 250] },
      });
      y = (doc as any).lastAutoTable.finalY + 6;
    }

    if (data.sec6.list.length > 0) {
      checkPage(10 + data.sec6.list.length * 7);
      autoTable(doc, {
        startY: y,
        margin: { left: margin, right: margin, top: TIMBRADO_TOP_MARGIN, bottom: 30 },
        head: [['Descrição', 'Credor', 'Categoria', 'Competência', 'Status', 'Valor', 'Data Pagamento']],
        body: data.sec6.list.map(c => [
          c.descricao, c.credorNome, c.categoria, c.competencia,
          c.status === 'pago' ? 'Pago' : 'Pendente', fmt(c.valorConsiderado),
          c.data_pagamento ? format(new Date(c.data_pagamento + 'T12:00:00'), 'dd/MM/yyyy') : '—',
        ]),
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: [26, 26, 26], textColor: 255, fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [245, 247, 250] },
      });
      y = (doc as any).lastAutoTable.finalY + 6;
    }
  }

  // Aplicar timbrado em todas as páginas
  await applyTimbrado(doc);


  

  doc.save(`fechamento-${data.selectedLabel.toLowerCase().replace(/\s/g, '-')}.pdf`);
};
