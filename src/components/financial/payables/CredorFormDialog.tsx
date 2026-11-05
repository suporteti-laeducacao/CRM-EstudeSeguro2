import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Credor, TIPOS_CREDOR, TipoCredor } from '@/lib/payables-types';
import { saveCredor, updateCredor } from '@/lib/payables-storage';
import { toast } from 'sonner';

interface CredorFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  credor?: Credor | null;
  onSuccess: () => void;
}

const CredorFormDialog = ({ open, onOpenChange, credor, onSuccess }: CredorFormDialogProps) => {
  const [nome, setNome] = useState('');
  const [tipo, setTipo] = useState<TipoCredor>('vendedor');
  const [observacoes, setObservacoes] = useState('');
  const [loading, setLoading] = useState(false);

  // Atualizar estados quando o credor mudar (para edição)
  useEffect(() => {
    if (credor) {
      setNome(credor.nome);
      setTipo(credor.tipo);
      setObservacoes(credor.observacoes || '');
    } else {
      setNome('');
      setTipo('vendedor');
      setObservacoes('');
    }
  }, [credor, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!nome.trim()) {
      toast.error('Nome é obrigatório');
      return;
    }

    setLoading(true);
    try {
      if (credor) {
        await updateCredor(credor.id, { nome, tipo, observacoes });
        toast.success('Fornecedor/Prestador atualizado com sucesso!');
      } else {
        await saveCredor({ nome, tipo, status: 'ativo', observacoes });
        toast.success('Fornecedor/Prestador cadastrado com sucesso!');
      }
      onSuccess();
      onOpenChange(false);
      resetForm();
    } catch (error) {
      console.error('Error saving credor:', error);
      toast.error('Erro ao salvar fornecedor/prestador');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setNome('');
    setTipo('vendedor');
    setObservacoes('');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{credor ? 'Editar Fornecedor/Prestador' : 'Adicionar Novo Fornecedor/Prestador'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="nome">Nome/Apelido *</Label>
            <Input
              id="nome"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex: Lucas (Rafael)"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="tipo">Tipo *</Label>
            <Select value={tipo} onValueChange={(v) => setTipo(v as TipoCredor)}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o tipo" />
              </SelectTrigger>
              <SelectContent>
                {TIPOS_CREDOR.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="observacoes">Observações</Label>
            <Textarea
              id="observacoes"
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              placeholder="Observações adicionais..."
              rows={3}
            />
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Salvando...' : 'Salvar'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default CredorFormDialog;
