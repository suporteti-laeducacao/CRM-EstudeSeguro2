import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { saveVendedor } from '@/lib/vendedores-storage';
import { toast } from 'sonner';

interface VendedorQuickAddProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: (vendedorId: string, vendedorNome: string) => void;
}

export const VendedorQuickAdd = ({ open, onOpenChange, onSuccess }: VendedorQuickAddProps) => {
  const [formData, setFormData] = useState({
    nome: '',
    email: '',
    telefone: '',
  });
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.nome.trim()) {
      toast.error('Nome é obrigatório');
      return;
    }

    setIsLoading(true);
    try {
      const vendedorId = await saveVendedor({
        nome: formData.nome,
        email: formData.email || undefined,
        telefone: formData.telefone || undefined,
        ativo: true,
      });

      toast.success('Vendedor cadastrado!');
      onSuccess(vendedorId, formData.nome);
      
      // Reset form
      setFormData({ nome: '', email: '', telefone: '' });
      onOpenChange(false);
    } catch (error) {
      console.error('Error saving vendedor:', error);
      toast.error('Erro ao cadastrar vendedor');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Cadastrar Novo Vendedor</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="nome">Nome *</Label>
            <Input
              id="nome"
              value={formData.nome}
              onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
              placeholder="Digite o nome completo"
              autoFocus
            />
          </div>
          <div>
            <Label htmlFor="email">E-mail</Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              placeholder="email@exemplo.com"
            />
          </div>
          <div>
            <Label htmlFor="telefone">Telefone</Label>
            <Input
              id="telefone"
              value={formData.telefone}
              onChange={(e) => setFormData({ ...formData, telefone: e.target.value })}
              placeholder="(00) 00000-0000"
            />
          </div>
          <div className="flex gap-2 justify-end">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? 'Salvando...' : 'Salvar e Selecionar'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
