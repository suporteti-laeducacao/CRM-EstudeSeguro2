import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { Lead, LeadHistory, LeadNote, LeadTask, LeadMessage, LeadStatus, RECHAMADA_TASKS } from '@/lib/leads-types';
import { isBrazilianHoliday } from '@/lib/holidays';
import { toast } from 'sonner';

export const useLeads = () => {
  const { user } = useAuth();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const syncChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const broadcastLeadsChanged = useCallback(async () => {
    const ch = syncChannelRef.current;
    if (!ch) return;
    try {
      await ch.send({
        type: 'broadcast',
        event: 'leads_changed',
        payload: { ts: Date.now() },
      });
    } catch {
      // no-op: broadcast is best-effort
    }
  }, []);

  const fetchLeads = useCallback(async () => {
    if (!user) return;

    try {
      const PAGE_SIZE = 1000;
      let allData: Lead[] = [];
      let from = 0;
      let hasMore = true;

      while (hasMore) {
        const { data, error } = await supabase
          .from('leads')
          .select('*')
          .eq('arquivado', false)
          .order('created_at', { ascending: false })
          .range(from, from + PAGE_SIZE - 1);

        if (error) throw error;

        const chunk = (data || []) as Lead[];
        allData = allData.concat(chunk);

        if (chunk.length < PAGE_SIZE) {
          hasMore = false;
        } else {
          from += PAGE_SIZE;
        }
      }

      setLeads(allData);
    } catch (error) {
      console.error('Error fetching leads:', error);
      toast.error('Erro ao carregar leads');
    } finally {
      setLoading(false);
    }
  }, [user]);

  const createLead = async (leadData: Partial<Lead>): Promise<Lead | null> => {
    if (!user) return null;

    try {
      const { data, error } = await supabase
        .from('leads')
        .insert([{
          nome: leadData.nome || '',
          email: leadData.email,
          telefone: leadData.telefone,
          empresa: leadData.empresa,
          curso_interesse: leadData.curso_interesse,
          valor_estimado: leadData.valor_estimado,
          origem: leadData.origem || 'organico',
          status: leadData.status || 'novo',
          vendedor_id: leadData.vendedor_id,
          tags: leadData.tags,
          user_id: user.id,
          arquivado: false,
        }])
        .select()
        .single();

      if (error) throw error;

      // Create history entry
      await supabase.from('lead_history').insert({
        lead_id: data.id,
        user_id: user.id,
        status_novo: 'novo',
        observacao: 'Lead criado',
      });

      toast.success('Lead criado com sucesso!');
      await broadcastLeadsChanged();
      await fetchLeads();
      return data as Lead;
    } catch (error) {
      console.error('Error creating lead:', error);
      toast.error('Erro ao criar lead');
      return null;
    }
  };

  const updateLead = async (id: string, updates: Partial<Lead>): Promise<boolean> => {
    if (!user) return false;

    try {
      const currentLead = leads.find(l => l.id === id);
      
      const { error } = await supabase
        .from('leads')
        .update(updates)
        .eq('id', id);

      if (error) throw error;

      // If status changed, create history entry
      if (updates.status && currentLead && updates.status !== currentLead.status) {
        await supabase.from('lead_history').insert({
          lead_id: id,
          user_id: user.id,
          status_anterior: currentLead.status,
          status_novo: updates.status,
        });

        // Entrou em rechamada => criar 7 tarefas (Rechamada 2..8)
        if (updates.status === 'rechamada') {
          // Cancela QUAISQUER tarefas de rechamada pendentes (de ciclos anteriores
          // ou de outros vendedores) — não devemos manter ciclos paralelos ativos.
          await supabase
            .from('lead_tasks')
            .update({ cancelada: true })
            .eq('lead_id', id)
            .eq('tipo', 'rechamada')
            .eq('concluida', false)
            .eq('cancelada', false);

          // Determina próximo ciclo
          const { data: existing } = await supabase
            .from('lead_tasks')
            .select('rechamada_ciclo')
            .eq('lead_id', id)
            .eq('tipo', 'rechamada')
            .order('rechamada_ciclo', { ascending: false })
            .limit(1);
          const lastCiclo = existing && existing[0]?.rechamada_ciclo ? Number(existing[0].rechamada_ciclo) : 0;
          const novoCiclo = lastCiclo + 1;
          const base = new Date();
          // Sábado é dia útil; pula domingo e feriados nacionais para o próximo dia útil
          const adjustToBusinessDay = (d: Date) => {
            // Avança enquanto for domingo (0) ou feriado nacional
            while (d.getDay() === 0 || isBrazilianHoliday(d)) {
              d.setDate(d.getDate() + 1);
            }
            return d;
          };
          const tasksToInsert = RECHAMADA_TASKS.map((t) => {
            const due = new Date(base);
            due.setDate(due.getDate() + t.dias);
            adjustToBusinessDay(due);
            return {
              lead_id: id,
              user_id: user.id,
              titulo: t.titulo,
              data_vencimento: due.toISOString(),
              concluida: false,
              cancelada: false,
              tipo: 'rechamada',
              rechamada_ordem: t.ordem,
              rechamada_ciclo: novoCiclo,
            };
          });
          await supabase.from('lead_tasks').insert(tasksToInsert);
        }

        // Saiu de rechamada => cancelar tarefas pendentes (não concluídas) deste tipo
        if (currentLead.status === 'rechamada' && updates.status !== 'rechamada') {
          await supabase
            .from('lead_tasks')
            .update({ cancelada: true })
            .eq('lead_id', id)
            .eq('tipo', 'rechamada')
            .eq('concluida', false)
            .eq('cancelada', false);
        }
      }

      toast.success('Lead atualizado!');
      await broadcastLeadsChanged();
      await fetchLeads();
      return true;
    } catch (error) {
      console.error('Error updating lead:', error);
      toast.error('Erro ao atualizar lead');
      return false;
    }
  };

  const updateLeadStatus = async (id: string, newStatus: LeadStatus): Promise<boolean> => {
    return updateLead(id, { status: newStatus });
  };

  const assignVendedor = async (id: string, vendedorId: string): Promise<boolean> => {
    if (!user) return false;

    try {
      const { error } = await supabase
        .from('leads')
        .update({ vendedor_id: vendedorId })
        .eq('id', id);

      if (error) throw error;

      toast.success('Vendedor atribuído com sucesso!');
      await broadcastLeadsChanged();
      await fetchLeads();
      return true;
    } catch (error) {
      console.error('Error assigning vendedor:', error);
      toast.error('Erro ao atribuir vendedor');
      return false;
    }
  };

  const archiveLead = async (id: string): Promise<boolean> => {
    return updateLead(id, { arquivado: true });
  };

  const deleteLead = async (id: string): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('leads')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast.success('Lead excluído!');
      await broadcastLeadsChanged();
      await fetchLeads();
      return true;
    } catch (error) {
      console.error('Error deleting lead:', error);
      toast.error('Erro ao excluir lead');
      return false;
    }
  };

  // Fetch lead history
  const fetchLeadHistory = async (leadId: string): Promise<LeadHistory[]> => {
    try {
      const { data, error } = await supabase
        .from('lead_history')
        .select('*')
        .eq('lead_id', leadId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data || []) as LeadHistory[];
    } catch (error) {
      console.error('Error fetching lead history:', error);
      return [];
    }
  };

  // Lead notes
  const fetchLeadNotes = async (leadId: string): Promise<LeadNote[]> => {
    try {
      const { data, error } = await supabase
        .from('lead_notes')
        .select('*')
        .eq('lead_id', leadId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data || []) as LeadNote[];
    } catch (error) {
      console.error('Error fetching lead notes:', error);
      return [];
    }
  };

  const addLeadNote = async (leadId: string, content: string): Promise<boolean> => {
    if (!user) return false;

    try {
      const { error } = await supabase.from('lead_notes').insert({
        lead_id: leadId,
        user_id: user.id,
        conteudo: content,
      });

      if (error) throw error;
      toast.success('Anotação adicionada!');
      return true;
    } catch (error) {
      console.error('Error adding note:', error);
      toast.error('Erro ao adicionar anotação');
      return false;
    }
  };

  // Lead tasks
  const fetchLeadTasks = async (leadId: string): Promise<LeadTask[]> => {
    try {
      const { data, error } = await supabase
        .from('lead_tasks')
        .select('*')
        .eq('lead_id', leadId)
        .order('data_vencimento', { ascending: true });

      if (error) throw error;
      return (data || []) as LeadTask[];
    } catch (error) {
      console.error('Error fetching lead tasks:', error);
      return [];
    }
  };

  const addLeadTask = async (leadId: string, task: Partial<LeadTask>): Promise<boolean> => {
    if (!user) return false;

    try {
      const { error } = await supabase.from('lead_tasks').insert({
        lead_id: leadId,
        user_id: user.id,
        titulo: task.titulo,
        descricao: task.descricao,
        data_vencimento: task.data_vencimento,
        concluida: false,
      });

      if (error) throw error;
      toast.success('Tarefa adicionada!');
      return true;
    } catch (error) {
      console.error('Error adding task:', error);
      toast.error('Erro ao adicionar tarefa');
      return false;
    }
  };

  const toggleTaskComplete = async (taskId: string, completed: boolean): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('lead_tasks')
        .update({ concluida: completed, completed_at: completed ? new Date().toISOString() : null })
        .eq('id', taskId);

      if (error) throw error;
      // Notifica a tela de leads para reavaliar a cor dos cards imediatamente
      window.dispatchEvent(new CustomEvent('lead-tasks-changed'));
      return true;
    } catch (error) {
      console.error('Error toggling task:', error);
      return false;
    }
  };

  // Lead messages
  const fetchLeadMessages = async (leadId: string): Promise<LeadMessage[]> => {
    try {
      const { data, error } = await supabase
        .from('lead_messages')
        .select('*')
        .eq('lead_id', leadId)
        .order('data_mensagem', { ascending: true });

      if (error) throw error;
      return (data || []) as LeadMessage[];
    } catch (error) {
      console.error('Error fetching lead messages:', error);
      return [];
    }
  };

  useEffect(() => {
    fetchLeads();
  }, [fetchLeads]);

  // Mantém todas as telas sincronizadas quando qualquer usuário mexer nos leads
  useEffect(() => {
    if (!user) return;

    let refreshTimeout: number | undefined;
    const scheduleRefresh = () => {
      window.clearTimeout(refreshTimeout);
      refreshTimeout = window.setTimeout(() => {
        fetchLeads();
      }, 50);
    };

    const channel = supabase
      .channel('leads-sync')
      .on('broadcast', { event: 'leads_changed' }, scheduleRefresh)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'leads' },
        scheduleRefresh
      )
      .subscribe();

    syncChannelRef.current = channel;

    return () => {
      window.clearTimeout(refreshTimeout);
      syncChannelRef.current = null;
      channel.unsubscribe();
    };
  }, [user, fetchLeads]);

  return {
    leads,
    loading,
    createLead,
    updateLead,
    updateLeadStatus,
    assignVendedor,
    archiveLead,
    deleteLead,
    
    fetchLeadHistory,
    fetchLeadNotes,
    addLeadNote,
    fetchLeadTasks,
    addLeadTask,
    toggleTaskComplete,
    fetchLeadMessages,
    refreshLeads: fetchLeads,
  };
};
