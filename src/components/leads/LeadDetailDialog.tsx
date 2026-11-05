import { useState, useEffect } from 'react';
import { Lead, LeadHistory, LeadNote, LeadTask, LEAD_STATUS_CONFIG, LEAD_ORIGEM_CONFIG } from '@/lib/leads-types';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  Phone, 
  Mail, 
  MessageCircle, 
  Building, 
  GraduationCap, 
  DollarSign,
  Calendar,
  User,
  Clock,
  Plus,
  Send,
  CheckCircle,
  ExternalLink,
  ShoppingCart
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useLeads } from '@/hooks/useLeads';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

interface LeadDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lead: Lead | null;
  onEdit: () => void;
}

const LeadDetailDialog = ({ open, onOpenChange, lead, onEdit }: LeadDetailDialogProps) => {
  const navigate = useNavigate();
  const { 
    fetchLeadHistory, 
    fetchLeadNotes, 
    addLeadNote, 
    fetchLeadTasks, 
    addLeadTask, 
    toggleTaskComplete,
  } = useLeads();

  const [history, setHistory] = useState<LeadHistory[]>([]);
  const [notes, setNotes] = useState<LeadNote[]>([]);
  const [tasks, setTasks] = useState<LeadTask[]>([]);
  const [userNames, setUserNames] = useState<Map<string, string>>(new Map());
  const [newNote, setNewNote] = useState('');
  const [newTask, setNewTask] = useState({ titulo: '', descricao: '', data_vencimento: '' });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (lead && open) {
      loadData();
    }
  }, [lead, open]);

  const loadData = async () => {
    if (!lead) return;
    setLoading(true);
    try {
      const [historyData, notesData, tasksData] = await Promise.all([
        fetchLeadHistory(lead.id),
        fetchLeadNotes(lead.id),
        fetchLeadTasks(lead.id),
      ]);
      setHistory(historyData);
      setNotes(notesData);
      setTasks(tasksData);

      // Carrega nomes dos usuários para log de segurança
      const userIds = Array.from(new Set([
        ...historyData.map((h: any) => h.user_id),
        ...notesData.map((n: any) => n.user_id),
        ...tasksData.map((t: any) => t.user_id),
        ...tasksData.map((t: any) => t.completed_by),
      ].filter(Boolean)));

      if (userIds.length > 0) {
        const { data: vendedores } = await supabase
          .from('vendedores')
          .select('user_id, nome')
          .in('user_id', userIds);
        setUserNames(new Map((vendedores || []).map((v: any) => [v.user_id, v.nome])));
      } else {
        setUserNames(new Map());
      }
    } finally {
      setLoading(false);
    }
  };

  const handleAddNote = async () => {
    if (!lead || !newNote.trim()) return;
    const success = await addLeadNote(lead.id, newNote);
    if (success) {
      setNewNote('');
      loadData();
    }
  };

  const handleAddTask = async () => {
    if (!lead || !newTask.titulo.trim()) return;
    const success = await addLeadTask(lead.id, {
      titulo: newTask.titulo,
      descricao: newTask.descricao || undefined,
      data_vencimento: newTask.data_vencimento || undefined,
    });
    if (success) {
      setNewTask({ titulo: '', descricao: '', data_vencimento: '' });
      loadData();
    }
  };

  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

  const handleToggleTask = async (taskId: string, completed: boolean) => {
    if (completed) {
      const task = tasks.find((t) => t.id === taskId);
      if (task?.tipo === 'rechamada' && task.data_vencimento) {
        const dueDay = startOfDay(new Date(task.data_vencimento));
        const today = startOfDay(new Date());
        if (dueDay.getTime() > today.getTime()) {
          toast.error('Esta rechamada só pode ser concluída no dia do vencimento ou após.');
          return;
        }
      }
    }
    await toggleTaskComplete(taskId, completed);
    loadData();
  };

  const handleConvertToSale = () => {
    if (!lead) return;
    // Navigate to sales page with lead data pre-filled
    navigate('/vendas', { 
      state: { 
        prefillLead: {
          studentName: lead.nome,
          course: lead.curso_interesse,
          amount: lead.valor_estimado,
          studentEmail: lead.email,
          studentPhone: lead.telefone,
        }
      }
    });
    onOpenChange(false);
    toast.success('Abrindo página de vendas para registrar a conversão');
  };

  const formatCurrency = (value: number | undefined) => {
    if (!value) return '-';
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  if (!lead) return null;

  const statusConfig = LEAD_STATUS_CONFIG[lead.status];
  const origemConfig = LEAD_ORIGEM_CONFIG[lead.origem] ?? { label: lead.origem || '—', icon: 'Globe' };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <div className="flex items-start justify-between">
            <div>
              <DialogTitle className="text-xl">{lead.nome}</DialogTitle>
              <div className="flex gap-2 mt-2">
                <Badge className={`${statusConfig.bgColor} ${statusConfig.color}`}>
                  {statusConfig.label}
                </Badge>
                <Badge variant="outline">
                  {origemConfig.label}
                </Badge>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={onEdit}>
                Editar
              </Button>
              {lead.status === 'matriculado' && (
                <Button size="sm" onClick={handleConvertToSale}>
                  <ShoppingCart className="h-4 w-4 mr-2" />
                  Converter em Venda
                </Button>
              )}
            </div>
          </div>
        </DialogHeader>

        <div className="grid grid-cols-3 gap-6 mt-4">
          {/* Lead Info */}
          <div className="col-span-1 space-y-4">
            <div className="bg-muted/50 rounded-lg p-4 space-y-3">
              <h4 className="font-semibold text-sm">Informações de Contato</h4>
              
              {lead.telefone && (
                <div className="flex items-center gap-2 text-sm">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <span>{lead.telefone}</span>
                  <div className="ml-auto flex gap-1">
                    <Button 
                      variant="ghost" 
                      size="icon" aria-label="Ligar para o lead" 
                      className="h-7 w-7"
                      onClick={() => window.open(`tel:${lead.telefone}`, '_blank')}
                    >
                      <Phone className="h-3 w-3" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="icon" aria-label="Abrir WhatsApp" 
                      className="h-7 w-7"
                      onClick={() => {
                        const phone = lead.telefone?.replace(/\D/g, '');
                        window.open(`https://wa.me/55${phone}`, '_blank');
                      }}
                    >
                      <MessageCircle className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              )}

              {lead.email && (
                <div className="flex items-center gap-2 text-sm">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <span className="truncate">{lead.email}</span>
                  <Button 
                    variant="ghost" 
                    size="icon" aria-label="Abrir link" 
                    className="h-7 w-7 ml-auto"
                    onClick={() => window.open(`mailto:${lead.email}`, '_blank')}
                  >
                    <ExternalLink className="h-3 w-3" />
                  </Button>
                </div>
              )}

              {lead.empresa && (
                <div className="flex items-center gap-2 text-sm">
                  <Building className="h-4 w-4 text-muted-foreground" />
                  <span>{lead.empresa}</span>
                </div>
              )}
            </div>

            <div className="bg-muted/50 rounded-lg p-4 space-y-3">
              <h4 className="font-semibold text-sm">Informações do Lead</h4>
              
              {lead.curso_interesse && (
                <div className="flex items-center gap-2 text-sm">
                  <GraduationCap className="h-4 w-4 text-muted-foreground" />
                  <span>{lead.curso_interesse}</span>
                </div>
              )}

              <div className="flex items-center gap-2 text-sm">
                <DollarSign className="h-4 w-4 text-muted-foreground" />
                <span>{formatCurrency(lead.valor_estimado)}</span>
              </div>

              <div className="flex items-center gap-2 text-sm">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span>Entrada: {format(new Date(lead.data_entrada), "dd/MM/yyyy", { locale: ptBR })}</span>
              </div>
            </div>

            {lead.tags && lead.tags.length > 0 && (
              <div className="bg-muted/50 rounded-lg p-4">
                <h4 className="font-semibold text-sm mb-2">Tags</h4>
                <div className="flex flex-wrap gap-1">
                  {lead.tags.map((tag, index) => (
                    <Badge key={index} variant="secondary" className="text-xs">
                      {tag}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Tabs */}
          <div className="col-span-2">
            <Tabs defaultValue="timeline" className="w-full">
              <TabsList className="w-full justify-start">
                <TabsTrigger value="timeline">Timeline</TabsTrigger>
                <TabsTrigger value="notes">Anotações</TabsTrigger>
                <TabsTrigger value="tasks">Tarefas</TabsTrigger>
              </TabsList>

              <TabsContent value="timeline" className="mt-4">
                <ScrollArea className="h-[400px]">
                  <div className="space-y-3">
                    {history.map((item) => (
                      <div key={item.id} className="flex gap-3 text-sm">
                        <div className="flex flex-col items-center">
                          <div className="w-2 h-2 rounded-full bg-primary" />
                          <div className="w-0.5 flex-1 bg-border" />
                        </div>
                        <div className="flex-1 pb-4">
                          <p className="text-muted-foreground">
                            Status alterado de{' '}
                            <span className="font-medium text-foreground">
                              {item.status_anterior ? LEAD_STATUS_CONFIG[item.status_anterior as keyof typeof LEAD_STATUS_CONFIG]?.label : 'Novo'}
                            </span>{' '}
                            para{' '}
                            <span className="font-medium text-foreground">
                              {LEAD_STATUS_CONFIG[item.status_novo as keyof typeof LEAD_STATUS_CONFIG]?.label}
                            </span>
                          </p>
                          {item.observacao && (
                            <p className="text-muted-foreground mt-1">{item.observacao}</p>
                          )}
                          <p className="text-xs text-muted-foreground mt-1 flex items-center gap-2 flex-wrap">
                            <span className="flex items-center gap-1">
                              <User className="h-3 w-3" />
                              {userNames.get(item.user_id) || 'Usuário desconhecido'}
                            </span>
                            <span>·</span>
                            <span>{format(new Date(item.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</span>
                          </p>
                        </div>
                      </div>
                    ))}
                    {history.length === 0 && (
                      <p className="text-muted-foreground text-center py-8">Nenhum histórico registrado</p>
                    )}
                  </div>
                </ScrollArea>
              </TabsContent>

              <TabsContent value="notes" className="mt-4">
                <div className="space-y-4">
                  <div className="flex gap-2">
                    <Textarea
                      value={newNote}
                      onChange={(e) => setNewNote(e.target.value)}
                      placeholder="Adicionar anotação..."
                      className="flex-1"
                      rows={2}
                    />
                    <Button aria-label="Adicionar anotação" onClick={handleAddNote} disabled={!newNote.trim()}>
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>
                  <ScrollArea className="h-[320px]">
                    <div className="space-y-3">
                      {notes.map((note) => (
                        <div key={note.id} className="bg-muted/50 rounded-lg p-3">
                          <p className="text-sm">{note.conteudo}</p>
                          <p className="text-xs text-muted-foreground mt-2 flex items-center gap-2 flex-wrap">
                            <span className="flex items-center gap-1">
                              <User className="h-3 w-3" />
                              {userNames.get(note.user_id) || 'Usuário desconhecido'}
                            </span>
                            <span>·</span>
                            <span>{format(new Date(note.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</span>
                          </p>
                        </div>
                      ))}
                      {notes.length === 0 && (
                        <p className="text-muted-foreground text-center py-8">Nenhuma anotação</p>
                      )}
                    </div>
                  </ScrollArea>
                </div>
              </TabsContent>

              <TabsContent value="tasks" className="mt-4">
                <div className="space-y-4">
                  <div className="bg-muted/50 rounded-lg p-4 space-y-3">
                    <Input
                      value={newTask.titulo}
                      onChange={(e) => setNewTask({ ...newTask, titulo: e.target.value })}
                      placeholder="Título da tarefa..."
                    />
                    <div className="flex gap-2">
                      <Input
                        type="datetime-local"
                        value={newTask.data_vencimento}
                        onChange={(e) => setNewTask({ ...newTask, data_vencimento: e.target.value })}
                        className="flex-1"
                      />
                      <Button aria-label="Adicionar tarefa" onClick={handleAddTask} disabled={!newTask.titulo.trim()}>
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <ScrollArea className="h-[280px]">
                    <div className="space-y-2">
                      {[...tasks]
                        .sort((a, b) => {
                          const aPending = !a.concluida && !a.cancelada;
                          const bPending = !b.concluida && !b.cancelada;
                          if (aPending !== bPending) return aPending ? -1 : 1;
                          if (aPending && bPending) {
                            const ad = a.data_vencimento ? new Date(a.data_vencimento).getTime() : Infinity;
                            const bd = b.data_vencimento ? new Date(b.data_vencimento).getTime() : Infinity;
                            return ad - bd;
                          }
                          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
                        })
                        .map((task) => {
                        const today = startOfDay(new Date());
                        const dueDay = task.data_vencimento ? startOfDay(new Date(task.data_vencimento)) : null;
                        const isOverdue = !task.concluida && !task.cancelada && dueDay && dueDay.getTime() < today.getTime();
                        const isFutureRechamada = !task.concluida && !task.cancelada && task.tipo === 'rechamada' && dueDay && dueDay.getTime() > today.getTime();
                        return (
                        <div 
                          key={task.id} 
                          className={`flex items-start gap-3 p-3 rounded-lg border ${
                            task.cancelada ? 'bg-muted/30 opacity-50 line-through' :
                            task.concluida ? 'bg-muted/50 opacity-60' :
                            isOverdue ? 'bg-destructive/5 border-destructive/40' : ''
                          }`}
                        >
                          <Checkbox 
                            checked={task.concluida}
                            disabled={task.cancelada || isFutureRechamada}
                            onCheckedChange={(checked) => handleToggleTask(task.id, !!checked)}
                          />
                          <div className="flex-1">
                            <p className={`text-sm ${task.concluida || task.cancelada ? 'line-through' : ''}`}>
                              {task.titulo}
                              {task.cancelada && <span className="ml-2 text-xs text-muted-foreground">(cancelada)</span>}
                              {task.rechamada_ciclo ? <span className="ml-2 text-xs text-muted-foreground">· ciclo {task.rechamada_ciclo}</span> : null}
                            </p>
                            {task.data_vencimento && (
                              <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                                <Clock className="h-3 w-3" />
                                {format(new Date(task.data_vencimento), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                              </p>
                            )}
                            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                              <User className="h-3 w-3" />
                              Criada por {userNames.get(task.user_id) || 'Usuário desconhecido'}
                            </p>
                            {task.concluida && task.completed_at && (
                              <p className="text-xs text-success flex items-center gap-1 mt-1">
                                <CheckCircle className="h-3 w-3" />
                                Concluída por {task.completed_by ? (userNames.get(task.completed_by) || 'Usuário desconhecido') : 'Usuário desconhecido'}
                                {' · '}
                                {format(new Date(task.completed_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                              </p>
                            )}
                          </div>
                          {task.concluida && (
                            <CheckCircle className="h-4 w-4 text-success" />
                          )}
                        </div>
                        );
                      })}
                      {tasks.length === 0 && (
                        <p className="text-muted-foreground text-center py-8">Nenhuma tarefa</p>
                      )}
                    </div>
                  </ScrollArea>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default LeadDetailDialog;
