import { useState, useEffect } from 'react';
import Layout from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus, Edit, Power, PowerOff, Search, Loader2 } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { getVendedores, saveVendedor, deleteVendedor, reativarVendedor, Vendedor } from '@/lib/vendedores-storage';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import CustoOperacionalCategorias from '@/components/settings/CustoOperacionalCategorias';


interface SunChatUser {
  id: string;
  name: string;
  email?: string;
}

const Settings = () => {
  const [vendedores, setVendedores] = useState<Vendedor[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingVendedor, setEditingVendedor] = useState<Vendedor | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const [sunChatUsers, setSunChatUsers] = useState<SunChatUser[]>([]);
  const [loadingSunChatUsers, setLoadingSunChatUsers] = useState(false);
  const [formData, setFormData] = useState({
    nome: '',
    email: '',
    telefone: '',
    sunchat_user_id: '',
  });

  useEffect(() => {
    loadVendedores();
  }, [showInactive]);

  useEffect(() => {
    if (isDialogOpen) {
      loadSunChatUsers();
    }
  }, [isDialogOpen]);

  const loadVendedores = async () => {
    const loaded = await getVendedores(!showInactive);
    setVendedores(loaded);
  };

  const loadSunChatUsers = async () => {
    // SunChat integration removed — keep no-op to preserve UI compatibility
    setSunChatUsers([]);
    setLoadingSunChatUsers(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.nome.trim()) {
      toast.error('Nome é obrigatório');
      return;
    }

    try {
      await saveVendedor({
        id: editingVendedor?.id,
        nome: formData.nome,
        email: formData.email || undefined,
        telefone: formData.telefone || undefined,
        sunchat_user_id: formData.sunchat_user_id || undefined,
        ativo: true,
      });

      toast.success(editingVendedor ? 'Vendedor atualizado!' : 'Vendedor cadastrado!');
      loadVendedores();
      resetForm();
      setIsDialogOpen(false);
    } catch (error) {
      console.error('Error saving vendedor:', error);
      toast.error('Erro ao salvar vendedor');
    }
  };

  const handleEdit = (vendedor: Vendedor) => {
    setEditingVendedor(vendedor);
    setFormData({
      nome: vendedor.nome,
      email: vendedor.email || '',
      telefone: vendedor.telefone || '',
      sunchat_user_id: vendedor.sunchat_user_id || '',
    });
    setIsDialogOpen(true);
  };

  const handleToggleAtivo = async (id: string, ativo: boolean) => {
    try {
      if (ativo) {
        await deleteVendedor(id);
        toast.success('Vendedor desativado');
      } else {
        await reativarVendedor(id);
        toast.success('Vendedor reativado');
      }
      loadVendedores();
    } catch (error) {
      console.error('Error toggling vendedor:', error);
      toast.error('Erro ao alterar status do vendedor');
    }
  };

  const resetForm = () => {
    setFormData({
      nome: '',
      email: '',
      telefone: '',
      sunchat_user_id: '',
    });
    setEditingVendedor(null);
  };

  const filteredVendedores = vendedores.filter((v) =>
    v.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (v.email && v.email.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const getSunChatUserName = (sunchatUserId?: string) => {
    if (!sunchatUserId) return null;
    const user = sunChatUsers.find(u => u.id === sunchatUserId);
    return user?.name || sunchatUserId;
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="font-display text-[26px] leading-8 text-ink-950 mb-1">Configurações</h1>
          <p className="text-[13.5px] text-ink-500">Gerencie vendedores e personalize seu sistema</p>
        </div>

        {/* Gestão de Vendedores */}
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle>Gestão de Vendedores</CardTitle>
              <Dialog open={isDialogOpen} onOpenChange={(open) => {
                setIsDialogOpen(open);
                if (!open) resetForm();
              }}>
                <DialogTrigger asChild>
                  <Button className="gap-2">
                    <Plus className="w-4 h-4" />
                    Novo Vendedor
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle>{editingVendedor ? 'Editar Vendedor' : 'Cadastrar Novo Vendedor'}</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                      <Label htmlFor="nome">Nome *</Label>
                      <Input
                        id="nome"
                        value={formData.nome}
                        onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                        placeholder="Digite o nome completo"
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
                    <div>
                      <Label htmlFor="sunchat_user">Usuário no SunChat</Label>
                      {loadingSunChatUsers ? (
                        <div className="flex items-center gap-2 h-10 px-3 border rounded-md text-muted-foreground">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Carregando usuários...
                        </div>
                      ) : (
                        <Select
                          value={formData.sunchat_user_id}
                          onValueChange={(value) => setFormData({ ...formData, sunchat_user_id: value === '_none_' ? '' : value })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione o usuário do SunChat" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="_none_">Nenhum</SelectItem>
                            {sunChatUsers.map((user) => (
                              <SelectItem key={user.id} value={user.id}>
                                {user.name} {user.email ? `(${user.email})` : ''}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                    <div className="flex gap-2 justify-end">
                      <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                        Cancelar
                      </Button>
                      <Button type="submit">
                        {editingVendedor ? 'Atualizar' : 'Cadastrar'}
                      </Button>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4 mb-6">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                <Input
                  placeholder="Buscar por nome ou e-mail..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Button
                variant="outline"
                onClick={() => setShowInactive(!showInactive)}
              >
                {showInactive ? 'Ver Apenas Ativos' : 'Ver Todos'}
              </Button>
            </div>

            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>E-mail</TableHead>
                    <TableHead>Telefone</TableHead>
                    <TableHead>SunChat</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredVendedores.map((vendedor) => (
                    <TableRow key={vendedor.id}>
                      <TableCell className="font-medium">{vendedor.nome}</TableCell>
                      <TableCell>{vendedor.email || '-'}</TableCell>
                      <TableCell>{vendedor.telefone || '-'}</TableCell>
                      <TableCell>
                        {vendedor.sunchat_user_id ? (
                          <Badge variant="outline" className="text-xs">
                            {getSunChatUserName(vendedor.sunchat_user_id) || 'Vinculado'}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground text-sm">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {vendedor.ativo ? (
                          <Badge variant="default">Ativo</Badge>
                        ) : (
                          <Badge variant="secondary">Inativo</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex gap-2 justify-end">
                          <Button aria-label="Editar" 
                            size="sm" 
                            variant="outline" 
                            onClick={() => handleEdit(vendedor)}
                            title="Editar"
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button aria-label="Ativar ou desativar vendedor"
                            size="sm"
                            variant={vendedor.ativo ? "destructive" : "default"}
                            onClick={() => handleToggleAtivo(vendedor.id, vendedor.ativo)}
                            title={vendedor.ativo ? "Desativar" : "Reativar"}
                          >
                            {vendedor.ativo ? (
                              <PowerOff className="w-4 h-4" />
                            ) : (
                              <Power className="w-4 h-4" />
                            )}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {filteredVendedores.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        Nenhum vendedor encontrado
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>

            <div className="mt-4">
              <p className="text-sm text-muted-foreground">
                {filteredVendedores.length} vendedor(es) encontrado(s)
              </p>
            </div>
          </CardContent>
        </Card>

        <CustoOperacionalCategorias />



      </div>
    </Layout>
  );
};

export default Settings;
