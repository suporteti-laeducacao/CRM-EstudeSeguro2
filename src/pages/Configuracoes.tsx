import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ImagePlus, Loader2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import Layout from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { BRANDING_QUERY_KEY, useBranding } from '@/hooks/useBranding';
import { removeLogoFile, saveBranding, TAMANHO_MAX_LOGO, TIPOS_LOGO_ACEITOS, uploadLogo } from '@/lib/branding';

const Configuracoes = () => {
  const queryClient = useQueryClient();
  const { nomeEmpresa, logoUrl, isLoading } = useBranding();
  const fileInput = useRef<HTMLInputElement>(null);

  const [nome, setNome] = useState('');
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [previewArquivo, setPreviewArquivo] = useState<string | null>(null);
  const [removerLogo, setRemoverLogo] = useState(false);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    setNome(nomeEmpresa ?? '');
  }, [nomeEmpresa]);

  useEffect(() => {
    if (!arquivo) {
      setPreviewArquivo(null);
      return;
    }
    const url = URL.createObjectURL(arquivo);
    setPreviewArquivo(url);
    return () => URL.revokeObjectURL(url);
  }, [arquivo]);

  const preview = previewArquivo ?? (removerLogo ? null : logoUrl);

  const escolherArquivo = (file?: File) => {
    if (!file) return;
    if (!TIPOS_LOGO_ACEITOS.includes(file.type)) {
      toast.error('Use uma imagem PNG, JPG ou WEBP.');
      return;
    }
    if (file.size > TAMANHO_MAX_LOGO) {
      toast.error('A imagem deve ter no máximo 2 MB.');
      return;
    }
    setArquivo(file);
    setRemoverLogo(false);
  };

  const limparLogo = () => {
    setArquivo(null);
    setRemoverLogo(true);
    if (fileInput.current) fileInput.current.value = '';
  };

  const salvar = async () => {
    setSalvando(true);
    try {
      const novaLogo = arquivo ? await uploadLogo(arquivo) : removerLogo ? null : logoUrl;
      await saveBranding({ nomeEmpresa: nome.trim() || null, logoUrl: novaLogo });
      if (novaLogo !== logoUrl) await removeLogoFile(logoUrl).catch(() => undefined);
      await queryClient.invalidateQueries({ queryKey: BRANDING_QUERY_KEY });
      setArquivo(null);
      setRemoverLogo(false);
      if (fileInput.current) fileInput.current.value = '';
      toast.success('Configurações salvas!');
    } catch (error) {
      console.error('Erro ao salvar configurações:', error);
      toast.error('Não foi possível salvar as configurações.');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Layout>
      <div className="space-y-6 max-w-2xl">
        <div>
          <h1 className="text-2xl font-bold">Configurações</h1>
          <p className="text-muted-foreground">Nome e logo usados no sistema e nos relatórios em PDF.</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Identidade da empresa</CardTitle>
            <CardDescription>As alterações valem para todos os usuários, inclusive na tela de login.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="nome-empresa">Nome da empresa</Label>
              <Input
                id="nome-empresa"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Ex: Minha Empresa"
                maxLength={80}
                disabled={isLoading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="logo-empresa">Logo</Label>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex h-24 items-center justify-center rounded-md border bg-white p-3">
                  {preview ? <img src={preview} alt="Prévia em fundo claro" className="max-h-full object-contain" /> : <span className="text-sm text-ink-400">Sem logo</span>}
                </div>
                <div className="flex h-24 items-center justify-center rounded-md border bg-sidebar p-3">
                  {preview ? <img src={preview} alt="Prévia no menu lateral" className="max-h-full object-contain" /> : <span className="text-sm text-ink-400">Sem logo</span>}
                </div>
              </div>
              <p className="text-sm text-muted-foreground">
                Prévia em fundo claro e no menu lateral. Prefira PNG com fundo transparente. Formatos: PNG, JPG ou WEBP, até 2 MB.
              </p>
              <input
                id="logo-empresa"
                ref={fileInput}
                type="file"
                accept={TIPOS_LOGO_ACEITOS.join(',')}
                className="hidden"
                onChange={(e) => escolherArquivo(e.target.files?.[0])}
              />
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={() => fileInput.current?.click()}>
                  <ImagePlus className="mr-2 h-4 w-4" />
                  Escolher imagem
                </Button>
                {preview && (
                  <Button type="button" variant="ghost" onClick={limparLogo}>
                    <Trash2 className="mr-2 h-4 w-4" />
                    Remover logo
                  </Button>
                )}
              </div>
            </div>

            <div className="flex justify-end">
              <Button type="button" onClick={salvar} disabled={salvando || isLoading}>
                {salvando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Salvar
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default Configuracoes;
