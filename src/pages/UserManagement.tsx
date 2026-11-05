import { getPhotoSignedUrl } from '@/lib/photo-url';
import { useEffect, useState, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Database } from '@/integrations/supabase/types';
import Layout from '@/components/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
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
import { toast } from 'sonner';
import { 
  Shield, 
  UserPlus, 
  Trash2, 
  Search, 
  MoreHorizontal, 
  Edit, 
  Power, 
  Key,
  Eye,
  Users,
  Loader2,
  CheckCircle2,
  XCircle,
  Camera,
  Upload
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { z } from 'zod';

type AppRole = Database['public']['Enums']['app_role'];

interface SunChatUser {
  id: string;
  name: string;
  email?: string;
}

interface UserWithRoles {
  id: string;
  email: string;
  name: string;
  roles: AppRole[];
  lastSignIn?: string;
  ativo?: boolean;
  fotoUrl?: string | null;
  telefone?: string | null;
  sunchatUserId?: string | null;
}

const roleLabels: Record<AppRole, string> = {
  admin: 'Administrador',
  gerente: 'Gerente',
  supervisor: 'Supervisor',
  vendedor: 'Vendedor',
  financeiro: 'Financeiro'
};

const roleColors: Record<AppRole, string> = {
  admin: 'bg-brand text-brand-foreground',
  gerente: 'bg-ink-950 text-white',
  supervisor: 'bg-ink-100 text-ink-700',
  vendedor: 'bg-ink-100 text-ink-700',
  financeiro: 'bg-ink-100 text-ink-700'
};

const UserManagement = () => {
  const { hasRole, user } = useAuth();
  const [users, setUsers] = useState<UserWithRoles[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'ativos' | 'todos' | 'inativos'>('ativos');
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [addingRole, setAddingRole] = useState(false);
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserRole, setNewUserRole] = useState<AppRole>('vendedor');
  const [editingUser, setEditingUser] = useState<UserWithRoles | null>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<UserWithRoles | null>(null);
  const [deletingUser, setDeletingUser] = useState(false);
  const [disableTarget, setDisableTarget] = useState<UserWithRoles | null>(null);
  const [disablingUser, setDisablingUser] = useState(false);
  const [enableTarget, setEnableTarget] = useState<UserWithRoles | null>(null);
  const [enablingUser, setEnablingUser] = useState(false);

  const [showCreateAccountDialog, setShowCreateAccountDialog] = useState(false);
  const [creatingAccount, setCreatingAccount] = useState(false);
  const [createName, setCreateName] = useState('');
  const [createEmail, setCreateEmail] = useState('');
  const [createPassword, setCreatePassword] = useState('');

  const [showReconcileDialog, setShowReconcileDialog] = useState(false);
  const [reconcilingUser, setReconcilingUser] = useState(false);
  const [reconcileEmail, setReconcileEmail] = useState('');

  const [detailsUser, setDetailsUser] = useState<UserWithRoles | null>(null);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  const [savingCredentials, setSavingCredentials] = useState(false);
  const [detailsName, setDetailsName] = useState('');
  const [detailsEmail, setDetailsEmail] = useState('');
  const [detailsPassword, setDetailsPassword] = useState('');
  const [detailsTelefone, setDetailsTelefone] = useState('');
  const [detailsSunchatUserId, setDetailsSunchatUserId] = useState('');
  const [detailsPhotoUrl, setDetailsPhotoUrl] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);

  const [sunChatUsers, setSunChatUsers] = useState<SunChatUser[]>([]);
  const [loadingSunChatUsers, setLoadingSunChatUsers] = useState(false);

  const createAccountSchema = z.object({
    name: z.string().trim().min(1, 'Informe o nome').max(80, 'Nome muito longo'),
    email: z.string().trim().email('Email inválido').max(255, 'Email muito longo'),
    password: z.string().min(8, 'Senha deve ter no mínimo 8 caracteres').max(72, 'Senha muito longa'),
  });

  const reconcileSchema = z.object({
    email: z.string().trim().email('Email inválido').max(255, 'Email muito longo'),
  });

  const credentialsSchema = z
    .object({
      name: z.string().trim().min(1, 'Informe o nome').max(80, 'Nome muito longo').optional(),
      email: z.string().trim().email('Email inválido').max(255, 'Email muito longo').optional(),
      password: z
        .string()
        .min(8, 'Senha deve ter no mínimo 8 caracteres')
        .max(72, 'Senha muito longa')
        .optional(),
    })
    .refine((v) => Boolean(v.name) || Boolean(v.email) || Boolean(v.password), {
      message: 'Informe nome, email e/ou senha',
    });

  const canManageUsers = hasRole('admin') || hasRole('gerente');
  const canGrantAdmin = hasRole('admin');

  useEffect(() => {
    if (!canManageUsers) {
      toast.error('Acesso negado. Apenas administradores e gerentes podem acessar esta página.');
      return;
    }
    fetchUsers();
  }, [canManageUsers]);

  const fetchUsers = async () => {
    try {
      const { data: rolesData, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id, role');

      if (rolesError) throw rolesError;

      const { data: vendedoresData, error: vendedoresError } = await supabase
        .from('vendedores')
        .select('user_id, nome, email, ativo, foto_url, telefone, sunchat_user_id');

      if (vendedoresError) throw vendedoresError;

      const vendedorMap = new Map<string, { nome: string; email: string | null; ativo: boolean | null; foto_url: string | null; telefone: string | null; sunchat_user_id: string | null }>();
      vendedoresData?.forEach(v => {
        vendedorMap.set(v.user_id, {
          nome: v.nome,
          email: v.email,
          ativo: v.ativo ?? true,
          foto_url: v.foto_url ?? null,
          telefone: v.telefone ?? null,
          sunchat_user_id: v.sunchat_user_id ?? null,
        });
      });

      const userRolesMap = new Map<string, AppRole[]>();
      rolesData?.forEach(({ user_id, role }) => {
        if (!userRolesMap.has(user_id)) {
          userRolesMap.set(user_id, []);
        }
        userRolesMap.get(user_id)?.push(role);
      });

      // Inclui também usuários sem nenhum cargo (não somem da lista)
      vendedorMap.forEach((_v, userId) => {
        if (userId && !userRolesMap.has(userId)) {
          userRolesMap.set(userId, []);
        }
      });

      const usersWithRoles: UserWithRoles[] = Array.from(userRolesMap.entries()).map(([id, roles]) => {
        const vendedor = vendedorMap.get(id);
        const vendedorNome = vendedor?.nome && vendedor.nome !== 'Usuário' ? vendedor.nome : null;
        const vendedorEmail = vendedor?.email || null;
        const vendedorAtivo = vendedor?.ativo ?? true;
        const isCurrentUser = id === user?.id;
        const userEmail = vendedorEmail || (isCurrentUser ? (user.email || '') : '');
        
        return {
          id,
          email: userEmail,
          name: vendedorNome || userEmail || 'Usuário',
          roles,
          ativo: vendedorAtivo,
          fotoUrl: vendedor?.foto_url || null,
          telefone: vendedor?.telefone || null,
          sunchatUserId: vendedor?.sunchat_user_id || null,
        };
      });

      const usersWithPhotos = await Promise.all(
        usersWithRoles.map(async (u) => ({ ...u, fotoUrl: await getPhotoSignedUrl(u.fotoUrl) }))
      );

      setUsers(usersWithPhotos);
    } catch (error) {
      console.error('Error fetching users:', error);
      toast.error('Erro ao carregar usuários');
    } finally {
      setLoading(false);
    }
  };

  const loadSunChatUsers = async () => {
    // SunChat integration removed — keep no-op to preserve UI compatibility
    setSunChatUsers([]);
    setLoadingSunChatUsers(false);
  };

  const getSunChatUserName = (sunchatUserId?: string | null) => {
    if (!sunchatUserId) return null;
    const u = sunChatUsers.find(s => s.id === sunchatUserId);
    return u?.name || sunchatUserId;
  };

  const addRole = async (userId: string, role: AppRole) => {
    try {
      const { error } = await supabase
        .from('user_roles')
        .insert({ user_id: userId, role });

      if (error) throw error;

      toast.success('Permissão adicionada com sucesso!');
      fetchUsers();
    } catch (error) {
      console.error('Error adding role:', error);
      toast.error('Erro ao adicionar permissão');
    }
  };

  const removeRole = async (userId: string, role: AppRole) => {
    try {
      const { error } = await supabase
        .from('user_roles')
        .delete()
        .eq('user_id', userId)
        .eq('role', role);

      if (error) throw error;

      toast.success('Permissão removida com sucesso!');
      fetchUsers();
    } catch (error) {
      console.error('Error removing role:', error);
      toast.error('Erro ao remover permissão');
    }
  };

  const filteredUsers = users.filter(u => {
    const q = searchQuery.toLowerCase();
    const matchesSearch = u.email.toLowerCase().includes(q) ||
                          u.name.toLowerCase().includes(q) ||
                          u.id.toLowerCase().includes(q) ||
                          (u.telefone && u.telefone.toLowerCase().includes(q));
    const matchesRole = roleFilter === 'all' || u.roles.includes(roleFilter as AppRole);
    const matchesStatus =
      statusFilter === 'todos' ||
      (statusFilter === 'ativos' ? u.ativo !== false : u.ativo === false);
    return matchesSearch && matchesRole && matchesStatus;
  });

  const handleEditUser = (userItem: UserWithRoles) => {
    setEditingUser(userItem);
    setShowEditDialog(true);
  };

  const handleViewDetails = (userItem: UserWithRoles) => {
    setDetailsUser(userItem);
    setDetailsName(userItem.name || '');
    setDetailsEmail(userItem.email || '');
    setDetailsPassword('');
    setDetailsTelefone(userItem.telefone || '');
    setDetailsSunchatUserId(userItem.sunchatUserId || '');
    setDetailsPhotoUrl(userItem.fotoUrl || null);
    setShowDetailsDialog(true);
    loadSunChatUsers();
  };

  const handlePhotoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !detailsUser) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Por favor, selecione uma imagem válida');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error('A imagem deve ter no máximo 5MB');
      return;
    }

    try {
      setUploadingPhoto(true);

      const fileExt = file.name.split('.').pop();
      const fileName = `${detailsUser.id}-${Date.now()}.${fileExt}`;
      const filePath = `${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('user-photos')
        .upload(filePath, file, { upsert: true });

      if (uploadError) {
        console.error('Upload error:', uploadError);
        toast.error('Erro ao fazer upload da foto');
        return;
      }

      // Bucket is private: store only the object path and display via signed URLs.
      const publicUrl = filePath;

      const { error: updateError } = await supabase
        .from('vendedores')
        .update({ foto_url: publicUrl } as Record<string, unknown>)
        .eq('user_id', detailsUser.id);

      if (updateError) {
        console.error('Update error:', updateError);
        toast.error('Erro ao salvar foto no perfil');
        return;
      }

      setDetailsPhotoUrl(await getPhotoSignedUrl(publicUrl));
      toast.success('Foto atualizada com sucesso!');
      await fetchUsers();
    } catch (error) {
      console.error('Photo upload error:', error);
      toast.error('Erro ao fazer upload da foto');
    } finally {
      setUploadingPhoto(false);
      if (photoInputRef.current) {
        photoInputRef.current.value = '';
      }
    }
  };

  const handlePhotoRemove = async () => {
    if (!detailsUser || !detailsPhotoUrl) return;
    try {
      setUploadingPhoto(true);
      const { error: updateError } = await supabase
        .from('vendedores')
        .update({ foto_url: null } as Record<string, unknown>)
        .eq('user_id', detailsUser.id);

      if (updateError) {
        console.error('Remove photo error:', updateError);
        toast.error('Erro ao remover foto');
        return;
      }

      setDetailsPhotoUrl(null);
      toast.success('Foto removida com sucesso!');
      await fetchUsers();
    } catch (error) {
      console.error('Photo remove error:', error);
      toast.error('Erro ao remover foto');
    } finally {
      setUploadingPhoto(false);
    }
  };

  const toggleRole = async (userId: string, role: AppRole, hasRole: boolean) => {
    if (role === 'admin' && !canGrantAdmin) {
      toast.error('Apenas administradores podem conceder ou remover a permissão de admin.');
      return;
    }
    if (hasRole) {
      await removeRole(userId, role);
    } else {
      await addRole(userId, role);
    }
    if (editingUser) {
      const updatedRoles = hasRole 
        ? editingUser.roles.filter(r => r !== role)
        : [...editingUser.roles, role];
      setEditingUser({ ...editingUser, roles: updatedRoles });
    }
  };

  const handleDeleteUser = async () => {
    if (!deleteTarget) return;
    if (!user?.id) {
      toast.error('Você precisa estar logado para realizar esta ação.');
      return;
    }
    if (deleteTarget.id === user.id) {
      toast.error('Você não pode deletar seu próprio usuário.');
      return;
    }

    try {
      setDeletingUser(true);
      const { data, error } = await supabase.functions.invoke('delete-user', {
        body: { userId: deleteTarget.id },
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Falha ao deletar usuário');

      toast.success('Usuário deletado com sucesso.');
      setDeleteTarget(null);
      await fetchUsers();
    } catch (err) {
      console.error('Error deleting user:', err);
      toast.error('Erro ao deletar usuário');
    } finally {
      setDeletingUser(false);
    }
  };

  const handleDisableUser = async () => {
    if (!disableTarget) return;
    if (!user?.id) {
      toast.error('Você precisa estar logado para realizar esta ação.');
      return;
    }
    if (disableTarget.id === user.id) {
      toast.error('Você não pode desativar seu próprio usuário.');
      return;
    }

    try {
      setDisablingUser(true);
      const { data, error } = await supabase.functions.invoke('disable-user', {
        body: { userId: disableTarget.id },
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Falha ao desativar usuário');

      toast.success('Usuário desativado com sucesso.');
      setDisableTarget(null);
      await fetchUsers();
    } catch (err) {
      console.error('Error disabling user:', err);
      toast.error('Erro ao desativar usuário');
    } finally {
      setDisablingUser(false);
    }
  };

  const handleEnableUser = async () => {
    if (!enableTarget) return;
    try {
      setEnablingUser(true);
      const { data, error } = await supabase.functions.invoke('enable-user', {
        body: { userId: enableTarget.id },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Falha ao reativar usuário');
      toast.success('Usuário reativado com sucesso.');
      setEnableTarget(null);
      await fetchUsers();
    } catch (err) {
      console.error('Error enabling user:', err);
      toast.error('Erro ao reativar usuário');
    } finally {
      setEnablingUser(false);
    }
  };

  const handleSaveDetails = async () => {
    if (!detailsUser) return;

    const currentName = (detailsUser.name ?? '').trim();
    const currentEmail = (detailsUser.email ?? '').trim();
    const nextName = detailsName.trim();
    const nextEmail = detailsEmail.trim();

    const hasCredentialChanges = (nextName && nextName !== currentName) || (nextEmail && nextEmail !== currentEmail) || detailsPassword;

    // Save telefone and sunchat_user_id directly to vendedores
    const currentTelefone = (detailsUser.telefone ?? '').trim();
    const currentSunchat = (detailsUser.sunchatUserId ?? '').trim();
    const nextTelefone = detailsTelefone.trim();
    const nextSunchat = detailsSunchatUserId.trim();
    const hasVendedorChanges = nextTelefone !== currentTelefone || nextSunchat !== currentSunchat;

    if (!hasCredentialChanges && !hasVendedorChanges) {
      toast.error('Nenhuma alteração detectada');
      return;
    }

    try {
      setSavingCredentials(true);

      // Update vendedores fields (telefone, sunchat) directly
      if (hasVendedorChanges) {
        const { error: vendedorError } = await supabase
          .from('vendedores')
          .update({
            telefone: nextTelefone || null,
            sunchat_user_id: nextSunchat || null,
          })
          .eq('user_id', detailsUser.id);

        if (vendedorError) {
          console.error('Error updating vendedor fields:', vendedorError);
          toast.error('Erro ao atualizar telefone/SunChat');
          return;
        }
      }

      // Update credentials via edge function if needed
      if (hasCredentialChanges) {
        const payload = {
          name: nextName && nextName !== currentName ? nextName : undefined,
          email: nextEmail && nextEmail !== currentEmail ? nextEmail : undefined,
          password: detailsPassword || undefined,
        };

        const parsed = credentialsSchema.safeParse(payload);
        if (!parsed.success) {
          toast.error(parsed.error.issues[0]?.message ?? 'Dados inválidos');
          return;
        }

        const { data, error } = await supabase.functions.invoke('update-user-credentials', {
          body: { userId: detailsUser.id, ...parsed.data },
        });

        if (error) {
          toast.error('Erro ao atualizar credenciais');
          return;
        }

        if (!data?.success) {
          toast.error(data?.error || 'Não foi possível atualizar');
          return;
        }
      }

      toast.success('Dados atualizados com sucesso.');
      setDetailsPassword('');
      setShowDetailsDialog(false);
      await fetchUsers();
    } catch (err) {
      console.warn('Update failed:', err);
      toast.error('Erro ao atualizar dados');
    } finally {
      setSavingCredentials(false);
    }
  };

  if (!canManageUsers) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Card className="max-w-md">
            <CardHeader className="text-center">
              <div className="mx-auto w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
                <Shield className="w-6 h-6 text-destructive" />
              </div>
              <CardTitle>Acesso Negado</CardTitle>
              <CardDescription>
                Você não tem permissão para acessar esta página.
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Deletar usuário</AlertDialogTitle>
              <AlertDialogDescription>
                Esta ação é permanente. O usuário <strong>{deleteTarget?.name}</strong> ({deleteTarget?.email || deleteTarget?.id})
                será removido do sistema.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deletingUser}>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDeleteUser}
                disabled={deletingUser}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {deletingUser ? (
                  <span className="inline-flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Deletando...
                  </span>
                ) : (
                  'Deletar'
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog open={!!disableTarget} onOpenChange={(open) => !open && setDisableTarget(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Desativar usuário</AlertDialogTitle>
              <AlertDialogDescription>
                O usuário <strong>{disableTarget?.name}</strong> ({disableTarget?.email || disableTarget?.id})
                terá o acesso bloqueado, mas as vendas e histórico serão mantidos.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={disablingUser}>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDisableUser}
                disabled={disablingUser}
              >
                {disablingUser ? (
                  <span className="inline-flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Desativando...
                  </span>
                ) : (
                  'Desativar'
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog open={!!enableTarget} onOpenChange={(open) => !open && setEnableTarget(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Reativar usuário</AlertDialogTitle>
              <AlertDialogDescription>
                O usuário <strong>{enableTarget?.name}</strong> ({enableTarget?.email || enableTarget?.id})
                terá o acesso restaurado ao sistema.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={enablingUser}>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={handleEnableUser} disabled={enablingUser}>
                {enablingUser ? (
                  <span className="inline-flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Reativando...
                  </span>
                ) : (
                  'Reativar'
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="font-display text-[26px] leading-8 text-ink-950">Gestão de Usuários</h1>
            <p className="mt-1 text-[13.5px] text-ink-500">
              Gerencie acessos, permissões e dados dos usuários do sistema
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <Dialog open={showReconcileDialog} onOpenChange={setShowReconcileDialog}>
              <DialogTrigger asChild>
                <Button variant="secondary" className="gap-2">
                  <Users className="h-4 w-4" />
                  Vincular conta existente
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Vincular conta existente</DialogTitle>
                  <DialogDescription>
                    Se o email já existe na autenticação mas não aparece aqui, vincule para criar os registros de permissões.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="reconcile-email">Email</Label>
                    <Input
                      id="reconcile-email"
                      placeholder="aristoteles@facla.edu.br"
                      value={reconcileEmail}
                      onChange={(e) => setReconcileEmail(e.target.value)}
                      autoComplete="email"
                      inputMode="email"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Isso cria (se faltar) o cadastro do vendedor e uma permissão inicial de <strong>Vendedor</strong>.
                  </p>
                </div>
                <DialogFooter>
                  <Button
                    variant="outline"
                    disabled={reconcilingUser}
                    onClick={() => setShowReconcileDialog(false)}
                  >
                    Cancelar
                  </Button>
                  <Button
                    disabled={reconcilingUser}
                    onClick={async () => {
                      const parsed = reconcileSchema.safeParse({ email: reconcileEmail });
                      if (!parsed.success) {
                        toast.error(parsed.error.issues[0]?.message ?? 'Email inválido');
                        return;
                      }

                      try {
                        setReconcilingUser(true);
                        const { data, error } = await supabase.functions.invoke('reconcile-user', {
                          body: parsed.data,
                        });

                        if (error) {
                          toast.error('Erro ao vincular conta');
                          return;
                        }

                        if (!data?.success) {
                          toast.error(data?.error || 'Não foi possível vincular');
                          return;
                        }

                        toast.success('Conta vinculada com sucesso.');
                        setShowReconcileDialog(false);
                        setReconcileEmail('');
                        await fetchUsers();
                      } catch (err) {
                        console.warn('Reconcile user failed:', err);
                        toast.error('Erro ao vincular conta');
                      } finally {
                        setReconcilingUser(false);
                      }
                    }}
                  >
                    {reconcilingUser ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                    Vincular
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <Dialog open={showCreateAccountDialog} onOpenChange={setShowCreateAccountDialog}>
              <DialogTrigger asChild>
                <Button className="gap-2">
                  <UserPlus className="h-4 w-4" />
                  Criar nova conta
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Criar nova conta</DialogTitle>
                  <DialogDescription>
                    Cria um usuário com acesso inicial de <strong>Vendedor</strong>. Depois você pode ajustar as permissões.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="create-name">Nome</Label>
                    <Input
                      id="create-name"
                      placeholder="Nome do usuário"
                      value={createName}
                      onChange={(e) => setCreateName(e.target.value)}
                      autoComplete="name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="create-email">Email</Label>
                    <Input
                      id="create-email"
                      placeholder="email@empresa.com"
                      value={createEmail}
                      onChange={(e) => setCreateEmail(e.target.value)}
                      autoComplete="email"
                      inputMode="email"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="create-password">Senha</Label>
                    <Input
                      id="create-password"
                      type="password"
                      placeholder="Mínimo 8 caracteres"
                      value={createPassword}
                      onChange={(e) => setCreatePassword(e.target.value)}
                      autoComplete="new-password"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    O ID é gerado automaticamente.
                  </p>
                </div>
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => setShowCreateAccountDialog(false)}
                    disabled={creatingAccount}
                  >
                    Cancelar
                  </Button>
                  <Button
                    disabled={creatingAccount}
                    onClick={async () => {
                      const parsed = createAccountSchema.safeParse({
                        name: createName,
                        email: createEmail,
                        password: createPassword,
                      });

                      if (!parsed.success) {
                        toast.error(parsed.error.issues[0]?.message ?? 'Dados inválidos');
                        return;
                      }

                      try {
                        setCreatingAccount(true);
                        const { data, error } = await supabase.functions.invoke('create-user', {
                          body: parsed.data,
                        });

                        if (error) {
                          toast.error('Erro ao criar conta');
                          return;
                        }

                        if (!data?.success) {
                          toast.error(data?.error || 'Não foi possível criar a conta');
                          return;
                        }

                        toast.success('Conta criada com sucesso.');
                        setShowCreateAccountDialog(false);
                        setCreateName('');
                        setCreateEmail('');
                        setCreatePassword('');
                        await fetchUsers();
                      } catch (err) {
                        console.warn('Create user failed:', err);
                        toast.error('Erro ao criar conta');
                      } finally {
                        setCreatingAccount(false);
                      }
                    }}
                  >
                    {creatingAccount ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                    Criar
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="py-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nome, email ou telefone..."
                  className="pl-9"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <Select value={roleFilter} onValueChange={setRoleFilter}>
                <SelectTrigger className="w-full sm:w-48">
                  <SelectValue placeholder="Filtrar por tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os tipos</SelectItem>
                  <SelectItem value="admin">Administradores</SelectItem>
                  <SelectItem value="gerente">Gerentes</SelectItem>
                  <SelectItem value="supervisor">Supervisores</SelectItem>
                  <SelectItem value="vendedor">Vendedores</SelectItem>
                  <SelectItem value="financeiro">Financeiro</SelectItem>
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as 'ativos' | 'todos' | 'inativos')}>
                <SelectTrigger className="w-full sm:w-48">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ativos">Apenas ativos</SelectItem>
                  <SelectItem value="inativos">Apenas inativos</SelectItem>
                  <SelectItem value="todos">Todos (ativos e inativos)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Users Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Usuários ({filteredUsers.length})
            </CardTitle>
            <CardDescription>
              Cadastro unificado de todos os usuários do sistema
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-12">
                <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
                <p className="mt-4 text-muted-foreground">Carregando usuários...</p>
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="text-center py-12">
                <Users className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                <p className="text-muted-foreground">Nenhum usuário encontrado</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Clique em "Criar nova conta" para adicionar um usuário
                </p>
              </div>
            ) : (
              <div className="rounded-lg border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead>Usuário</TableHead>
                      <TableHead>Nome</TableHead>
                      <TableHead>Telefone</TableHead>
                      <TableHead>Permissões</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredUsers.map((userItem) => (
                      <TableRow key={userItem.id} className="hover:bg-muted/30">
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar className="h-10 w-10">
                              <AvatarImage src={userItem.fotoUrl || undefined} alt={userItem.name} />
                              <AvatarFallback className="bg-ink-950 text-brand font-medium">
                                {userItem.name.substring(0, 2).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="text-xs text-muted-foreground">
                                {userItem.email || `ID: ${userItem.id.substring(0, 12)}...`}
                              </p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <p className="font-medium">{userItem.name}</p>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-muted-foreground">
                            {userItem.telefone || '-'}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {userItem.roles.map((role) => (
                              <Badge 
                                key={role} 
                                className={cn("text-xs", roleColors[role])}
                              >
                                {roleLabels[role]}
                              </Badge>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell>
                          {userItem.ativo ? (
                            <div className="flex items-center gap-2">
                              <CheckCircle2 className="h-4 w-4 text-success" />
                              <span className="text-sm text-success">Ativo</span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <XCircle className="h-4 w-4 text-muted-foreground" />
                              <span className="text-sm text-muted-foreground">Inativo</span>
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" aria-label="Mais ações do usuário">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleViewDetails(userItem)}>
                                <Eye className="mr-2 h-4 w-4" />
                                Ver detalhes
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleEditUser(userItem)}>
                                <Edit className="mr-2 h-4 w-4" />
                                Editar permissões
                              </DropdownMenuItem>

                              {userItem.ativo ? (
                                <DropdownMenuItem
                                  onClick={() => setDisableTarget(userItem)}
                                  disabled={userItem.id === user?.id}
                                >
                                  <Power className="mr-2 h-4 w-4" />
                                  Desativar usuário
                                </DropdownMenuItem>
                              ) : (
                                <DropdownMenuItem
                                  onClick={() => setEnableTarget(userItem)}
                                >
                                  <Power className="mr-2 h-4 w-4" />
                                  Reativar usuário
                                </DropdownMenuItem>
                              )}

                              <DropdownMenuItem
                                onClick={() => setDeleteTarget(userItem)}
                                disabled={userItem.id === user?.id}
                                className="text-destructive focus:text-destructive"
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Deletar usuário
                              </DropdownMenuItem>

                              {userItem.roles.map((role) => (
                                <DropdownMenuItem 
                                  key={role}
                                  onClick={() => removeRole(userItem.id, role)}
                                  disabled={userItem.id === user?.id && role === 'admin'}
                                  className="text-destructive focus:text-destructive"
                                >
                                  <Trash2 className="mr-2 h-4 w-4" />
                                  Remover {roleLabels[role]}
                                </DropdownMenuItem>
                              ))}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Details Dialog */}
        <Dialog open={showDetailsDialog} onOpenChange={setShowDetailsDialog}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Detalhes do Usuário</DialogTitle>
              <DialogDescription>
                {detailsUser?.name} ({detailsUser?.email || detailsUser?.id})
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-5 py-4">
              {/* Photo upload section */}
              <div className="flex flex-col items-center gap-4">
                <div className="relative group">
                  <Avatar className="h-24 w-24 border-2 border-muted">
                    <AvatarImage src={detailsPhotoUrl || undefined} alt={detailsUser?.name} />
                    <AvatarFallback className="text-2xl">
                      {detailsUser?.name?.charAt(0).toUpperCase() || 'U'}
                    </AvatarFallback>
                  </Avatar>
                  <Button
                    size="icon" aria-label="Alterar foto"
                    variant="secondary"
                    className="absolute bottom-0 right-0 h-8 w-8 rounded-full shadow-card"
                    onClick={() => photoInputRef.current?.click()}
                    disabled={uploadingPhoto}
                  >
                    {uploadingPhoto ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Camera className="h-4 w-4" />
                    )}
                  </Button>
                  <input
                    ref={photoInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handlePhotoUpload}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <p className="text-xs text-muted-foreground">
                    Clique no ícone de câmera para trocar a foto
                  </p>
                  {detailsPhotoUrl && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive hover:text-destructive hover:bg-destructive/10 text-xs gap-1"
                      onClick={handlePhotoRemove}
                      disabled={uploadingPhoto}
                    >
                      <Trash2 className="h-3 w-3" />
                      Remover foto
                    </Button>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="details-name">Nome (usado nas vendas)</Label>
                <Input
                  id="details-name"
                  placeholder="Nome do vendedor"
                  value={detailsName}
                  onChange={(e) => setDetailsName(e.target.value)}
                  autoComplete="name"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="details-email">E-mail</Label>
                <Input
                  id="details-email"
                  placeholder="email@empresa.com"
                  value={detailsEmail}
                  onChange={(e) => setDetailsEmail(e.target.value)}
                  inputMode="email"
                  autoComplete="email"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="details-telefone">Telefone</Label>
                <Input
                  id="details-telefone"
                  placeholder="(00) 00000-0000"
                  value={detailsTelefone}
                  onChange={(e) => setDetailsTelefone(e.target.value)}
                />
              </div>


              <div className="space-y-2">
                <Label htmlFor="details-password">Trocar senha</Label>
                <Input
                  id="details-password"
                  type="password"
                  placeholder="Mínimo 8 caracteres"
                  value={detailsPassword}
                  onChange={(e) => setDetailsPassword(e.target.value)}
                  autoComplete="new-password"
                />
                <p className="text-xs text-muted-foreground">
                  Se deixar vazio, a senha não será alterada.
                </p>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setShowDetailsDialog(false)} disabled={savingCredentials}>
                Fechar
              </Button>
              <Button
                disabled={savingCredentials || !detailsUser}
                onClick={handleSaveDetails}
              >
                {savingCredentials ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Salvar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit Permissions Dialog */}
        <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Editar Permissões</DialogTitle>
              <DialogDescription>
                {editingUser?.name} ({editingUser?.email})
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-3">
              {(['admin', 'gerente', 'supervisor', 'vendedor', 'financeiro'] as AppRole[])
                  .filter((role) => role !== 'admin' || canGrantAdmin)
                  .map((role) => {
                  const hasThisRole = editingUser?.roles.includes(role) || false;
                  const isCurrentUserAdmin = editingUser?.id === user?.id && role === 'admin';
                  const cannotGrantAdmin = role === 'admin' && !canGrantAdmin;
                  
                  return (
                    <div
                      key={role}
                      className={cn(
                        "flex items-center justify-between p-4 rounded-lg border transition-colors",
                        hasThisRole ? "bg-brand-tint border-brand/40" : "bg-ink-50"
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <Badge className={cn("text-sm", roleColors[role])}>
                          {roleLabels[role]}
                        </Badge>
                        <span className="text-sm text-muted-foreground">
                          {role === 'admin' && 'Acesso total ao sistema'}
                          {role === 'gerente' && 'Gestão completa exceto admin'}
                          {role === 'supervisor' && 'Vê todas as vendas do sistema'}
                          {role === 'vendedor' && 'Apenas vendas próprias'}
                          {role === 'financeiro' && 'Acesso ao módulo financeiro'}
                        </span>
                      </div>
                      <Button
                        variant={hasThisRole ? "destructive" : "default"}
                        size="sm"
                        disabled={isCurrentUserAdmin || cannotGrantAdmin}
                        onClick={() => editingUser && toggleRole(editingUser.id, role, hasThisRole)}
                      >
                        {hasThisRole ? (
                          <>
                            <XCircle className="mr-1 h-4 w-4" />
                            Remover
                          </>
                        ) : (
                          <>
                            <CheckCircle2 className="mr-1 h-4 w-4" />
                            Adicionar
                          </>
                        )}
                      </Button>
                    </div>
                  );
                })}
              </div>
              {editingUser?.id === user?.id && (
                <p className="text-sm text-muted-foreground text-center">
                  Você não pode remover sua própria permissão de admin.
                </p>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowEditDialog(false)}>
                Fechar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Help Card */}
        <Card className="bg-muted/30 border-dashed">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Key className="h-5 w-5 text-warning" />
              Como configurar o primeiro admin?
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p className="text-muted-foreground">
              Para adicionar o primeiro administrador ao sistema, você precisa do ID do usuário 
              que fez login. Siga os passos:
            </p>
            <ol className="list-decimal list-inside space-y-2 text-muted-foreground ml-2">
              <li>O usuário deve fazer login no sistema (cadastrar e logar)</li>
              <li>Acesse o painel do banco de dados e localize a tabela <code className="bg-background px-1 py-0.5 rounded text-foreground">user_roles</code></li>
              <li>Insira o ID do usuário com a role "admin"</li>
            </ol>
            <div className="bg-background rounded-lg p-4 mt-4">
              <pre className="text-xs overflow-x-auto text-foreground">
{`INSERT INTO public.user_roles (user_id, role)
VALUES ('USER_UUID_HERE', 'admin');`}
              </pre>
            </div>
            {user && (
              <div className="bg-ink-50 rounded-[10px] p-4 mt-4 border border-ink-200">
                <p className="text-sm font-medium text-primary mb-1">Seu ID de usuário:</p>
                <code className="text-xs bg-background px-2 py-1 rounded block overflow-x-auto">
                  {user.id}
                </code>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default UserManagement;
