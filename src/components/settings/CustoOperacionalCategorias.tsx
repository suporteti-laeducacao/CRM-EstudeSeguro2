import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  getTodasCategorias,
  setCategoriaCustoOperacional,
  type CategoriaPersonalizada,
} from '@/lib/categorias-storage';

const CustoOperacionalCategorias = () => {
  const [categorias, setCategorias] = useState<CategoriaPersonalizada[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  const load = async () => {
    try {
      setLoading(true);
      setCategorias(await getTodasCategorias());
    } catch {
      toast.error('Erro ao carregar categorias');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const toggle = async (cat: CategoriaPersonalizada, value: boolean) => {
    setSaving(cat.id);
    const prev = categorias;
    setCategorias(cs => cs.map(c => (c.id === cat.id ? { ...c, custo_operacional: value } : c)));
    try {
      await setCategoriaCustoOperacional(cat.id, value);
    } catch {
      setCategorias(prev);
      toast.error('Erro ao salvar categoria');
    } finally {
      setSaving(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Categorias de Custo Operacional</CardTitle>
        <p className="text-sm text-muted-foreground">
          Marque quais categorias de contas a pagar compõem o custo operacional (regime de competência).
        </p>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {categorias.map(cat => (
              <div key={cat.id} className="flex items-center justify-between rounded-lg border p-3">
                <span className="text-sm">{cat.nome}</span>
                <Switch
                  checked={!!cat.custo_operacional}
                  disabled={saving === cat.id}
                  onCheckedChange={v => toggle(cat, v)}
                />
              </div>
            ))}
            {categorias.length === 0 && (
              <p className="text-sm text-muted-foreground">Nenhuma categoria cadastrada.</p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default CustoOperacionalCategorias;
