import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { saveGrupoRepasse, GrupoRepasse } from '@/lib/grupos-repasse-storage';

interface GrupoRepasseQuickAddProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: (grupo: GrupoRepasse) => void;
}

export function GrupoRepasseQuickAdd({ open, onOpenChange, onSuccess }: GrupoRepasseQuickAddProps) {
  const [nome, setNome] = useState('');
  const [porcentagem, setPorcentagem] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!nome.trim()) {
      toast.error('Digite o nome do grupo');
      return;
    }

    const porcentagemNum = parseFloat(porcentagem);
    if (isNaN(porcentagemNum) || porcentagemNum < 0 || porcentagemNum > 100) {
      toast.error('A porcentagem deve ser entre 0 e 100');
      return;
    }

    setIsLoading(true);
    try {
      const novoGrupo: GrupoRepasse = {
        id: crypto.randomUUID(),
        nome: nome.trim(),
        porcentagem_empresa: porcentagemNum,
        ativo: true,
      };
      
      await saveGrupoRepasse(novoGrupo);
      toast.success('Grupo de repasse criado com sucesso!');
      onSuccess(novoGrupo);
      setNome('');
      setPorcentagem('');
      onOpenChange(false);
    } catch (error) {
      console.error('Erro ao criar grupo:', error);
      toast.error('Erro ao criar grupo de repasse');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Novo Grupo de Repasse</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="nome">Nome do Grupo *</Label>
            <Input
              id="nome"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex: Repasse UNICV"
            />
          </div>
          <div>
            <Label htmlFor="porcentagem">Porcentagem da Empresa (%) *</Label>
            <Input
              id="porcentagem"
              type="number"
              min="0"
              max="100"
              step="0.01"
              value={porcentagem}
              onChange={(e) => setPorcentagem(e.target.value)}
              placeholder="Ex: 30"
            />
            <p className="text-sm text-muted-foreground mt-1">
              Quanto % do valor total fica para a empresa
            </p>
          </div>
          <div className="flex gap-2 justify-end">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? 'Salvando...' : 'Criar Grupo'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
