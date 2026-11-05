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
import { saveCurso } from '@/lib/cursos-storage';
import { toast } from 'sonner';

interface CursoQuickAddProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: (cursoNome: string) => void;
}

export const CursoQuickAdd = ({ open, onOpenChange, onSuccess }: CursoQuickAddProps) => {
  const [cursoNome, setCursoNome] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!cursoNome.trim()) {
      toast.error('Nome do curso é obrigatório');
      return;
    }

    setIsLoading(true);
    try {
      await saveCurso({
        nome: cursoNome,
        ativo: true,
      });

      toast.success('Curso cadastrado!');
      onSuccess(cursoNome.toUpperCase());
      
      // Reset form
      setCursoNome('');
      onOpenChange(false);
    } catch (error) {
      console.error('Error saving curso:', error);
      toast.error('Erro ao cadastrar curso');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Cadastrar Novo Curso</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="curso-nome">Nome do Curso *</Label>
            <Input
              id="curso-nome"
              value={cursoNome}
              onChange={(e) => setCursoNome(e.target.value)}
              placeholder="Digite o nome do curso"
              autoFocus
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
