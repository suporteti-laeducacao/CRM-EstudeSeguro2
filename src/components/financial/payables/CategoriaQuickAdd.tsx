import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, X, Check } from 'lucide-react';
import { saveCategoriaPersonalizada } from '@/lib/categorias-storage';
import { toast } from 'sonner';

interface CategoriaQuickAddProps {
  onSuccess: () => void;
}

const CategoriaQuickAdd = ({ onSuccess }: CategoriaQuickAddProps) => {
  const [isAdding, setIsAdding] = useState(false);
  const [nome, setNome] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!nome.trim()) {
      toast.error('Digite um nome para a categoria');
      return;
    }

    setLoading(true);
    try {
      await saveCategoriaPersonalizada(nome.trim());
      toast.success('Categoria adicionada!');
      setNome('');
      setIsAdding(false);
      onSuccess();
    } catch (error) {
      console.error('Error adding categoria:', error);
      toast.error('Erro ao adicionar categoria');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setNome('');
    setIsAdding(false);
  };

  if (!isAdding) {
    return (
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => setIsAdding(true)}
        className="w-full justify-start text-primary hover:text-primary"
      >
        <Plus className="h-4 w-4 mr-2" />
        Adicionar categoria
      </Button>
    );
  }

  return (
    <div className="p-2 space-y-2">
      <Input
        value={nome}
        onChange={(e) => setNome(e.target.value)}
        placeholder="Nome da categoria"
        autoFocus
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            handleSubmit();
          }
          if (e.key === 'Escape') {
            handleCancel();
          }
        }}
      />
      <div className="flex gap-2">
        <Button
          type="button"
          size="sm"
          onClick={handleSubmit}
          disabled={loading || !nome.trim()}
          className="flex-1"
        >
          <Check className="h-4 w-4 mr-1" />
          Salvar
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleCancel}
          disabled={loading}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};

export default CategoriaQuickAdd;
