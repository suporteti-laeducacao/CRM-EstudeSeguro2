import jsPDF from 'jspdf';
import { fetchBranding, fitLogo, loadLogoForPdf, PdfLogo } from '@/lib/branding';

/**
 * Aplica cabeçalho e rodapé com o nome e a logo configurados em todas as páginas.
 * Chame DEPOIS de adicionar o conteúdo e ANTES de doc.save().
 * Se a logo não carregar, o PDF sai mesmo assim, só com o nome.
 */
export const applyTimbrado = async (doc: jsPDF) => {
  let nomeEmpresa: string | null = null;
  let logo: PdfLogo | null = null;
  try {
    const branding = await fetchBranding();
    nomeEmpresa = branding.nomeEmpresa;
    if (branding.logoUrl) logo = await loadLogoForPdf(branding.logoUrl);
  } catch (error) {
    console.error('Erro ao carregar identidade para o PDF:', error);
  }

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const totalPages = doc.getNumberOfPages();

  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setDrawColor(200);
    doc.setTextColor(90);

    if (logo) {
      const { width, height } = fitLogo(logo, 50, 16);
      doc.addImage(logo.dataUrl, 'PNG', 14, 5, width, height);
    }
    if (nomeEmpresa) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.text(nomeEmpresa, pageWidth - 14, 15, { align: 'right' });
    }
    if (logo || nomeEmpresa) doc.line(14, 24, pageWidth - 14, 24);

    doc.line(14, pageHeight - 13, pageWidth - 14, pageHeight - 13);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text(`Página ${i} de ${totalPages}`, pageWidth - 14, pageHeight - 8, { align: 'right' });
  }
};

/** Top margin to start content below header */
export const TIMBRADO_TOP_MARGIN = 32;

/** Bottom margin to avoid footer overlap */
export const TIMBRADO_BOTTOM_MARGIN = 270;
