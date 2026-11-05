import { describe, expect, it, vi, beforeEach } from 'vitest';
import jsPDF from 'jspdf';
import { applyTimbrado } from './timbrado';
import { fetchBranding, loadLogoForPdf } from '@/lib/branding';

vi.mock('@/integrations/supabase/client', () => ({ supabase: {} }));

vi.mock('@/lib/branding', async (original) => ({
  ...(await original<typeof import('@/lib/branding')>()),
  fetchBranding: vi.fn(),
  loadLogoForPdf: vi.fn(),
}));

const PIXEL_PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

const novoPdf = () => {
  const doc = new jsPDF();
  doc.addPage();
  return doc;
};

describe('applyTimbrado', () => {
  beforeEach(() => vi.clearAllMocks());

  it('funciona sem logo e sem nome', async () => {
    vi.mocked(fetchBranding).mockResolvedValue({ nomeEmpresa: null, logoUrl: null });
    const doc = novoPdf();
    const addImage = vi.spyOn(doc, 'addImage');
    await applyTimbrado(doc);
    expect(addImage).not.toHaveBeenCalled();
    expect(doc.getNumberOfPages()).toBe(2);
  });

  it('aplica a logo sem distorcer, em todas as páginas', async () => {
    vi.mocked(fetchBranding).mockResolvedValue({ nomeEmpresa: 'Empresa X', logoUrl: 'https://x/logo.png' });
    vi.mocked(loadLogoForPdf).mockResolvedValue({ dataUrl: PIXEL_PNG, width: 400, height: 100 });
    const doc = novoPdf();
    const addImage = vi.spyOn(doc, 'addImage');
    await applyTimbrado(doc);
    expect(addImage).toHaveBeenCalledTimes(2);
    expect(addImage).toHaveBeenCalledWith(PIXEL_PNG, 'PNG', 14, 5, 50, 12.5);
  });

  it('gera o PDF mesmo se a logo não carregar', async () => {
    vi.mocked(fetchBranding).mockResolvedValue({ nomeEmpresa: 'Empresa X', logoUrl: 'https://x/logo.png' });
    vi.mocked(loadLogoForPdf).mockRejectedValue(new Error('falhou'));
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    await expect(applyTimbrado(novoPdf())).resolves.toBeUndefined();
  });
});
