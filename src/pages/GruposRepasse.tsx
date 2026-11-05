import { useState, useEffect } from 'react';
import Layout from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Plus, Edit, Search, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import {
  getGruposRepasse,
  saveGrupoRepasse,
  toggleGrupoRepasseStatus,
  checkGrupoRepasseHasVendas,
  GrupoRepasse,
} from '@/lib/grupos-repasse-storage';

const GruposRepasse = () => {
  const [grupos, setGrupos] = useState<GrupoRepasse[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingGrupo, setEditingGrupo] = useState<GrupoRepasse | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [formData, setFormData] = useState({
    nome: '',
    porcentagem_empresa: '',
  });

  useEffect(() => {
    loadGrupos();
  }, []);

  const loadGrupos = async () => {
    try {
      const loaded = await getGruposRepasse();
      setGrupos(loaded);
    } catch (error) {
      console.error('Erro ao carregar grupos:', error);
      toast.error('Erro ao carregar grupos de repasse');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.nome.trim()) {
      toast.error('Digite o nome do grupo');
      return;
    }

    const porcentagem = parseFloat(formData.porcentagem_empresa);
    if (isNaN(porcentagem) || porcentagem < 0 || porcentagem > 100) {
      toast.error('A porcentagem deve ser entre 0 e 100');
      return;
    }

    try {
      const grupo: Partial<GrupoRepasse> = {
        id: editingGrupo?.id || crypto.randomUUID(),
        nome: formData.nome.trim(),
        porcentagem_empresa: porcentagem,
        ativo: editingGrupo?.ativo ?? true,
      };

      await saveGrupoRepasse(grupo);
      await loadGrupos();
      resetForm();
      setIsDialogOpen(false);
      toast.success(editingGrupo ? 'Grupo atualizado!' : 'Grupo criado!');
    } catch (error) {
      console.error('Erro ao salvar grupo:', error);
      toast.error('Erro ao salvar grupo de repasse');
    }
  };

  const handleEdit = (grupo: GrupoRepasse) => {
    setEditingGrupo(grupo);
    setFormData({
      nome: grupo.nome,
      porcentagem_empresa: grupo.porcentagem_empresa.toString(),
    });
    setIsDialogOpen(true);
  };

  const handleToggleStatus = async (grupo: GrupoRepasse) => {
    if (grupo.ativo) {
      // Verificar se tem vendas vinculadas antes de inativar
      try {
        const hasVendas = await checkGrupoRepasseHasVendas(grupo.id);
        if (hasVendas) {
          toast.error(
            'Este grupo possui vendas vinculadas e não pode ser inativado. Desvincule as vendas primeiro.',
            { duration: 5000 }
          );
          return;
        }
      } catch (error) {
        console.error('Erro ao verificar vendas:', error);
        toast.error('Erro ao verificar vendas vinculadas');
        return;
      }
    }

    try {
      await toggleGrupoRepasseStatus(grupo.id, !grupo.ativo);
      await loadGrupos();
      toast.success(grupo.ativo ? 'Grupo inativado!' : 'Grupo ativado!');
    } catch (error) {
      console.error('Erro ao alterar status:', error);
      toast.error('Erro ao alterar status do grupo');
    }
  };

  const resetForm = () => {
    setFormData({
      nome: '',
      porcentagem_empresa: '',
    });
    setEditingGrupo(null);
  };

  const filteredGrupos = grupos.filter((grupo) =>
    grupo.nome.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="font-display text-[26px] leading-8 text-ink-950 mb-1">Grupos de Repasse</h1>
            <p className="text-[13.5px] text-ink-500">
              Gerencie os grupos de repasse para boletos com parceiros
            </p>
          </div>
          <Dialog
            open={isDialogOpen}
            onOpenChange={(open) => {
              setIsDialogOpen(open);
              if (!open) resetForm();
            }}
          >
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="w-4 h-4" />
                Novo Grupo
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {editingGrupo ? 'Editar Grupo' : 'Novo Grupo de Repasse'}
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="nome">Nome do Grupo *</Label>
                  <Input
                    id="nome"
                    value={formData.nome}
                    onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
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
                    value={formData.porcentagem_empresa}
                    onChange={(e) =>
                      setFormData({ ...formData, porcentagem_empresa: e.target.value })
                    }
                    placeholder="Ex: 30"
                  />
                  <p className="text-sm text-muted-foreground mt-1">
                    Quanto % do valor total fica para a empresa
                  </p>
                </div>
                <div className="flex gap-2 justify-end">
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                    Cancelar
                  </Button>
                  <Button type="submit">{editingGrupo ? 'Atualizar' : 'Criar'} Grupo</Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="bg-card rounded-[14px] shadow-card border border-ink-200 p-6">
          <div className="flex gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                placeholder="Buscar por nome..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          <div className="bg-[#FFF1E7] border border-[#FFD3B0] rounded-[10px] p-4 mb-6 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-[#B44309] flex-shrink-0 mt-0.5" />
            <div className="text-sm text-[#B44309]">
              <p className="font-medium mb-1">Como funciona o repasse?</p>
              <p>
                A porcentagem da empresa indica quanto % do valor total do boleto fica para a
                empresa. Por exemplo: se o boleto é R$ 1.000 e a porcentagem é 30%, a empresa
                recebe R$ 300 como receita.
              </p>
            </div>
          </div>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome do Grupo</TableHead>
                  <TableHead>Porcentagem da Empresa</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Data de Cadastro</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredGrupos.map((grupo) => (
                  <TableRow key={grupo.id}>
                    <TableCell className="font-medium">{grupo.nome}</TableCell>
                    <TableCell>
                      <span className="font-semibold text-primary">
                        {grupo.porcentagem_empresa}%
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge variant={grupo.ativo ? 'default' : 'secondary'}>
                        {grupo.ativo ? 'Ativo' : 'Inativo'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {grupo.created_at
                        ? new Date(grupo.created_at).toLocaleDateString('pt-BR')
                        : '-'}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex gap-2 justify-end items-center">
                        <Button aria-label="Editar grupo" size="sm" variant="outline" onClick={() => handleEdit(grupo)}>
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Switch
                          checked={grupo.ativo}
                          onCheckedChange={() => handleToggleStatus(grupo)}
                          title={grupo.ativo ? 'Inativar grupo' : 'Ativar grupo'}
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {filteredGrupos.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                      Nenhum grupo de repasse encontrado
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          <div className="mt-4">
            <p className="text-sm text-muted-foreground">
              {filteredGrupos.length} grupo(s) encontrado(s)
            </p>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default GruposRepasse;
