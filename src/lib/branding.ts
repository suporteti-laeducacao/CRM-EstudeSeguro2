import { supabase } from '@/integrations/supabase/client';

const BUCKET = 'branding';

export const TIPOS_LOGO_ACEITOS = ['image/png', 'image/jpeg', 'image/webp'];
export const TAMANHO_MAX_LOGO = 2 * 1024 * 1024;

export interface Branding {
  nomeEmpresa: string | null;
  logoUrl: string | null;
}

export const fetchBranding = async (): Promise<Branding> => {
  const { data, error } = await supabase
    .from('configuracoes_sistema')
    .select('nome_empresa, logo_url')
    .maybeSingle();
  if (error) throw error;
  return { nomeEmpresa: data?.nome_empresa ?? null, logoUrl: data?.logo_url ?? null };
};

export const saveBranding = async ({ nomeEmpresa, logoUrl }: Branding) => {
  const { error } = await supabase
    .from('configuracoes_sistema')
    .update({ nome_empresa: nomeEmpresa, logo_url: logoUrl })
    .eq('id', true);
  if (error) throw error;
};

export const uploadLogo = async (file: File): Promise<string> => {
  const ext = file.name.split('.').pop()?.toLowerCase() || 'png';
  // Nome novo a cada envio, para o navegador não mostrar a logo antiga do cache
  const path = `logo-${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, { contentType: file.type });
  if (error) throw error;
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
};

/** Apaga o arquivo antigo do bucket. Falhar aqui não atrapalha o usuário: só sobra um arquivo sem uso. */
export const removeLogoFile = async (logoUrl: string | null) => {
  const marker = `/${BUCKET}/`;
  const index = logoUrl?.indexOf(marker) ?? -1;
  if (!logoUrl || index < 0) return;
  await supabase.storage.from(BUCKET).remove([logoUrl.slice(index + marker.length)]);
};

export interface PdfLogo {
  dataUrl: string;
  width: number;
  height: number;
}

/** Converte a logo para PNG, formato aceito pelo jsPDF, informando as dimensões para não distorcer. */
export const loadLogoForPdf = (logoUrl: string): Promise<PdfLogo> =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) return reject(new Error('Canvas indisponível'));
      ctx.drawImage(img, 0, 0);
      resolve({ dataUrl: canvas.toDataURL('image/png'), width: img.naturalWidth, height: img.naturalHeight });
    };
    img.onerror = () => reject(new Error('Não foi possível carregar a logo'));
    img.src = logoUrl;
  });

/** Maior tamanho que cabe em maxW x maxH mantendo a proporção da imagem. */
export const fitLogo = (logo: PdfLogo, maxW: number, maxH: number) => {
  const scale = Math.min(maxW / logo.width, maxH / logo.height);
  return { width: logo.width * scale, height: logo.height * scale };
};
