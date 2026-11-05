import { useState } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Edit, History, Power, PowerOff, Plus, Trash2, MoreVertical } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Credor, ContaPagar, TIPOS_CREDOR } from '@/lib/payables-types';
import { updateCredor, deleteCredor } from '@/lib/payables-storage';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import CredorFormDialog from './CredorFormDialog';
import CredorHistoryDialog from './CredorHistoryDialog';

interface CredoresTableProps {
  credores: Credor[];
  contasPagar: ContaPagar[];
  onUpdate: () => void;
}

const CredoresTable = ({ credores, contasPagar, onUpdate }: CredoresTableProps) => {
  const [editingCredor, setEditingCredor] = useState<Credor | null>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [credorToDelete, setCredorToDelete] = useState<Credor | null>(null);
  const [historyCredor, setHistoryCredor] = useState<Credor | null>(null);

  const getTipoLabel = (tipo: string) => {
    return TIPOS_CREDOR.find(t => t.value === tipo)?.label || tipo;
  };

  const getTotalPendente = (credorId: string) => {
    return contasPagar
      .filter(c => c.credor_id === credorId && c.status !== 'pago')
      .reduce((sum, c) => sum + c.valor, 0);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const handleToggleStatus = async (credor: Credor) => {
    try {
      const newStatus = credor.status === 'ativo' ? 'inativo' : 'ativo';
      await updateCredor(credor.id, { status: newStatus });
      toast.success(`Fornecedor/Prestador ${newStatus === 'ativo' ? 'ativado' : 'desativado'} com sucesso!`);
      onUpdate();
    } catch (error) {
      console.error('Error updating credor status:', error);
      toast.error('Erro ao atualizar status');
    }
  };

  const handleDelete = async () => {
    if (!credorToDelete) return;

    // Check if credor has pending accounts
    const hasPendingAccounts = contasPagar.some(
      c => c.credor_id === credorToDelete.id && c.status !== 'pago'
    );

    if (hasPendingAccounts) {
      toast.error('Não é possível excluir credor com contas pendentes');
      setCredorToDelete(null);
      return;
    }

    try {
      await deleteCredor(credorToDelete.id);
      toast.success('Fornecedor/Prestador excluído com sucesso!');
      onUpdate();
    } catch (error) {
      console.error('Error deleting credor:', error);
      toast.error('Erro ao excluir fornecedor/prestador. Verifique se não há contas vinculadas.');
    } finally {
      setCredorToDelete(null);
    }
  };

  const handleEdit = (credor: Credor) => {
    setEditingCredor(credor);
    setShowEditDialog(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Fornecedores/Prestadores</h3>
        <Button onClick={() => setShowAddDialog(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Novo Fornecedor/Prestador
        </Button>
      </div>

      <div className="border rounded-lg overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome/Apelido</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Total Pendente</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {credores.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                  Nenhum fornecedor/prestador cadastrado
                </TableCell>
              </TableRow>
            ) : (
              credores.map((credor) => {
                const totalPendente = getTotalPendente(credor.id);
                return (
                  <TableRow key={credor.id}>
                    <TableCell className="font-medium">{credor.nome}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{getTipoLabel(credor.tipo)}</Badge>
                    </TableCell>
                    <TableCell>
                      {credor.status === 'ativo' ? (
                        <Badge className="bg-[#E7F7F0] text-[#07714E] border-transparent">
                          Ativo
                        </Badge>
                      ) : (
                        <Badge className="bg-[#F1F1F4] text-[#2B2B30] border-transparent">
                          Inativo
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {totalPendente > 0 ? (
                        <span className="text-warning">{formatCurrency(totalPendente)}</span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon" aria-label="Editar"
                          onClick={() => handleEdit(credor)}
                          title="Editar"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" aria-label="Mais ações">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-56">
                            <DropdownMenuItem onClick={() => handleToggleStatus(credor)}>
                              {credor.status === 'ativo' ? (
                                <PowerOff className="h-4 w-4 mr-2 text-ink-500" />
                              ) : (
                                <Power className="h-4 w-4 mr-2 text-ink-500" />
                              )}
                              {credor.status === 'ativo' ? 'Desativar' : 'Ativar'}
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setHistoryCredor(credor)}>
                              <History className="h-4 w-4 mr-2 text-ink-500" />
                              Ver histórico
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => setCredorToDelete(credor)} className="text-destructive focus:text-destructive">
                              <Trash2 className="h-4 w-4 mr-2" />
                              Excluir
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <CredorFormDialog
        open={showAddDialog}
        onOpenChange={setShowAddDialog}
        onSuccess={onUpdate}
      />

      <CredorFormDialog
        open={showEditDialog}
        onOpenChange={setShowEditDialog}
        credor={editingCredor}
        onSuccess={onUpdate}
      />

      <CredorHistoryDialog
        open={!!historyCredor}
        onOpenChange={(open) => !open && setHistoryCredor(null)}
        credor={historyCredor}
        contasPagar={contasPagar}
      />

      <AlertDialog open={!!credorToDelete} onOpenChange={(open) => !open && setCredorToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o fornecedor/prestador "{credorToDelete?.nome}"? 
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default CredoresTable;
