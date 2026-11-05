import { useEffect, useMemo, useState, useCallback } from 'react';
import { DragDropContext, DropResult } from '@hello-pangea/dnd';
import Layout from '@/components/Layout';
import PageHeader from '@/components/PageHeader';
import KanbanColumn from '@/components/leads/KanbanColumn';
import LeadsToolbar, { PeriodFilter } from '@/components/leads/LeadsToolbar';
import LeadFormDialog from '@/components/leads/LeadFormDialog';
import LeadDetailDialog from '@/components/leads/LeadDetailDialog';
import LostReasonDialog from '@/components/leads/LostReasonDialog';
import BulkAssignDialog from '@/components/leads/BulkAssignDialog';
import { Button } from '@/components/ui/button';
import { ArrowLeftRight } from 'lucide-react';
import { useLeads } from '@/hooks/useLeads';
import { Lead, LeadStatus, KANBAN_COLUMNS } from '@/lib/leads-types';
import { getVendedores, Vendedor } from '@/lib/vendedores-storage';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
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
import { Loader2 } from 'lucide-react';

export interface LeadRechamadaInfo {
  nextDue: string | null;
  hasOverdue: boolean;
  hasDueToday: boolean;
}

const Leads = () => {
  const {
    leads,
    loading,
    createLead,
    updateLead,
    updateLeadStatus,
    assignVendedor,
    archiveLead,
    deleteLead,
    addLeadNote,
  } = useLeads();

  const { hasRole } = useAuth();
  const canAssign = hasRole('admin') || hasRole('supervisor') || hasRole('gerente');
  const canDelete = !hasRole('vendedor') || hasRole('admin') || hasRole('supervisor') || hasRole('gerente');

  // State
  const [searchTerm, setSearchTerm] = useState('');
  const [filterOrigem, setFilterOrigem] = useState('all');
  const [filterCurso, setFilterCurso] = useState('all');
  const [filterVendedor, setFilterVendedor] = useState('all');
  const [period, setPeriod] = useState<PeriodFilter>({ preset: 'all' });
  
  // Dialogs
  const [formOpen, setFormOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [archiveDialogOpen, setArchiveDialogOpen] = useState(false);
  
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  const [lostDialogOpen, setLostDialogOpen] = useState(false);
  const [pendingLostLead, setPendingLostLead] = useState<Lead | null>(null);
  const [reasonMode, setReasonMode] = useState<'perdido' | 'reciclagem' | 'potencial'>('perdido');
  const [bulkAssignOpen, setBulkAssignOpen] = useState(false);

  const [vendedoresList, setVendedoresList] = useState<Vendedor[]>([]);
  const [vendedoresMap, setVendedoresMap] = useState<Map<string, string>>(new Map());
  const [rechamadaInfoMap, setRechamadaInfoMap] = useState<Map<string, LeadRechamadaInfo>>(new Map());
  const [cursoNivelMap, setCursoNivelMap] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    getVendedores(true).then((vendedores) => {
      setVendedoresList(vendedores);
      setVendedoresMap(new Map(vendedores.map((v) => [v.id, v.nome])));
    });
    supabase
      .from('cursos')
      .select('nome, nivel_ensino')
      .eq('ativo', true)
      .then(({ data }) => {
        if (data) {
          setCursoNivelMap(
            new Map(
              data
                .filter((c) => c.nome && c.nivel_ensino)
                .map((c) => [c.nome as string, c.nivel_ensino as string])
            )
          );
        }
      });
  }, []);

  const rechamadaLeadIds = useMemo(
    () => leads.filter((l) => l.status === 'rechamada').map((l) => l.id),
    [leads]
  );

  const loadRechamadaTasks = useCallback(async () => {
    if (rechamadaLeadIds.length === 0) {
      setRechamadaInfoMap(new Map());
      return;
    }
    const { data } = await supabase
      .from('lead_tasks')
      .select('lead_id, data_vencimento, concluida, cancelada, tipo')
      .in('lead_id', rechamadaLeadIds)
      .eq('tipo', 'rechamada')
      .eq('concluida', false)
      .eq('cancelada', false);

    const map = new Map<string, LeadRechamadaInfo>();
    const now = new Date();
    const todayStr = now.toDateString();
    (data || []).forEach((t: any) => {
      if (!t.data_vencimento) return;
      const due = new Date(t.data_vencimento);
      const existing = map.get(t.lead_id) || { nextDue: null, hasOverdue: false, hasDueToday: false };
      if (due < now && due.toDateString() !== todayStr) existing.hasOverdue = true;
      if (due.toDateString() === todayStr) existing.hasDueToday = true;
      if (!existing.nextDue || due < new Date(existing.nextDue)) existing.nextDue = t.data_vencimento;
      map.set(t.lead_id, existing);
    });
    setRechamadaInfoMap(map);
  }, [rechamadaLeadIds.join(',')]);

  useEffect(() => {
    loadRechamadaTasks();
    const i = window.setInterval(loadRechamadaTasks, 5 * 60_000);
    return () => window.clearInterval(i);
  }, [loadRechamadaTasks]);

  // Recarrega a cor dos cards assim que qualquer tarefa de lead é alterada
  useEffect(() => {
    const handler = () => loadRechamadaTasks();
    window.addEventListener('lead-tasks-changed', handler);
    return () => window.removeEventListener('lead-tasks-changed', handler);
  }, [loadRechamadaTasks]);

  // Filter leads
  const filteredLeads = useMemo(() => {
    // Compute period range
    let from: number | null = null;
    let to: number | null = null;
    const now = new Date();
    const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    const dayMs = 24 * 60 * 60 * 1000;

    switch (period.preset) {
      case 'today': {
        from = startOfDay(now);
        to = from + dayMs;
        break;
      }
      case 'yesterday': {
        to = startOfDay(now);
        from = to - dayMs;
        break;
      }
      case 'last7': {
        to = startOfDay(now) + dayMs;
        from = to - 7 * dayMs;
        break;
      }
      case 'this_month': {
        from = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
        to = new Date(now.getFullYear(), now.getMonth() + 1, 1).getTime();
        break;
      }
      case 'last_month': {
        from = new Date(now.getFullYear(), now.getMonth() - 1, 1).getTime();
        to = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
        break;
      }
      case 'custom': {
        if (period.from) from = startOfDay(period.from);
        if (period.to) to = startOfDay(period.to) + dayMs;
        break;
      }
    }

    return leads.filter((lead) => {
      if (from !== null && to !== null) {
        const t = new Date(lead.data_entrada).getTime();
        if (t < from || t >= to) return false;
      }

      // Search filter
      if (searchTerm) {
        const search = searchTerm.toLowerCase();
        const matchesSearch =
          lead.nome.toLowerCase().includes(search) ||
          lead.email?.toLowerCase().includes(search) ||
          lead.telefone?.includes(search);
        if (!matchesSearch) return false;
      }

      // Origin filter
      if (filterOrigem !== 'all' && lead.origem !== filterOrigem) {
        return false;
      }

      // Course (Nível de Ensino) filter
      if (filterCurso !== 'all') {
        const nivel = lead.curso_interesse ? cursoNivelMap.get(lead.curso_interesse) : null;
        if (nivel !== filterCurso) return false;
      }

      // Vendor filter
      if (filterVendedor !== 'all' && lead.vendedor_id !== filterVendedor) {
        return false;
      }

      return true;
    });
  }, [leads, searchTerm, filterOrigem, filterCurso, filterVendedor, period, cursoNivelMap]);

  // Handle drag and drop
  const handleDragEnd = async (result: DropResult) => {
    const { destination, source, draggableId } = result;

    if (!destination) return;
    if (destination.droppableId === source.droppableId && destination.index === source.index) return;

    const newStatus = destination.droppableId as LeadStatus;
    const lead = leads.find((l) => l.id === draggableId);

    // Mover para "perdido", "reciclagem" ou "potencial" exige justificativa obrigatória
    if (newStatus === 'perdido' && lead && lead.status !== 'perdido') {
      setReasonMode('perdido');
      setPendingLostLead(lead);
      setLostDialogOpen(true);
      return;
    }
    if (newStatus === 'reciclagem' && lead && lead.status !== 'reciclagem') {
      setReasonMode('reciclagem');
      setPendingLostLead(lead);
      setLostDialogOpen(true);
      return;
    }
    if (newStatus === 'potencial' && lead && lead.status !== 'potencial') {
      setReasonMode('potencial');
      setPendingLostLead(lead);
      setLostDialogOpen(true);
      return;
    }

    await updateLeadStatus(draggableId, newStatus);
  };

  const handleConfirmLost = async (reason: string) => {
    if (!pendingLostLead) return;
    const ok = await updateLeadStatus(pendingLostLead.id, reasonMode);
    if (ok) {
      const label =
        reasonMode === 'perdido'
          ? 'Motivo da perda'
          : reasonMode === 'reciclagem'
            ? 'Motivo da reciclagem'
            : 'Classificação como Potencial';
      await addLeadNote(pendingLostLead.id, `${label}: ${reason}`);
    }
    setLostDialogOpen(false);
    setPendingLostLead(null);
  };

  const handleCancelLost = () => {
    setLostDialogOpen(false);
    setPendingLostLead(null);
  };

  // Lead actions
  const handleNewLead = () => {
    setEditingLead(null);
    setFormOpen(true);
  };

  const handleViewLead = (lead: Lead) => {
    setSelectedLead(lead);
    setDetailOpen(true);
  };

  const handleEditLead = (lead: Lead) => {
    setEditingLead(lead);
    setFormOpen(true);
  };

  const handleArchiveLead = (lead: Lead) => {
    setSelectedLead(lead);
    setArchiveDialogOpen(true);
  };

  const handleDeleteLead = (lead: Lead) => {
    setSelectedLead(lead);
    setDeleteDialogOpen(true);
  };

  const handleAssignVendedor = async (lead: Lead, vendedorId: string) => {
    await assignVendedor(lead.id, vendedorId);
  };

  const confirmArchive = async () => {
    if (selectedLead) {
      await archiveLead(selectedLead.id);
      setArchiveDialogOpen(false);
      setSelectedLead(null);
    }
  };

  const confirmDelete = async () => {
    if (selectedLead) {
      await deleteLead(selectedLead.id);
      setDeleteDialogOpen(false);
      setSelectedLead(null);
    }
  };

  const handleSaveLead = async (data: Partial<Lead>): Promise<boolean> => {
    if (editingLead) {
      return await updateLead(editingLead.id, data);
    } else {
      const result = await createLead(data);
      return result !== null;
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-96">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <PageHeader
            title="Gestão de Leads"
            subtitle="Gerencie seus leads e acompanhe o funil de vendas"
            className="mb-0"
          />
          {canAssign && (
            <Button variant="outline" onClick={() => setBulkAssignOpen(true)}>
              <ArrowLeftRight className="h-4 w-4 mr-2" />
              Transferir em massa
            </Button>
          )}
        </div>

        <LeadsToolbar
          leads={filteredLeads}
          allLeads={leads}
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          filterOrigem={filterOrigem}
          onFilterOrigemChange={setFilterOrigem}
          filterCurso={filterCurso}
          onFilterCursoChange={setFilterCurso}
          filterVendedor={filterVendedor}
          onFilterVendedorChange={setFilterVendedor}
          vendedoresList={vendedoresList}
          onNewLead={handleNewLead}
          period={period}
          onPeriodChange={setPeriod}
        />

        {/* Kanban Board */}
        <DragDropContext onDragEnd={handleDragEnd}>
          <ScrollArea className="w-full">
            <div className="flex gap-4 pb-4">
              {KANBAN_COLUMNS.map((status) => (
                <KanbanColumn
                  key={status}
                  status={status}
                  leads={filteredLeads}
                  vendedoresMap={vendedoresMap}
                  vendedoresList={vendedoresList}
                  canAssign={canAssign}
                  canDelete={canDelete}
                  onViewLead={handleViewLead}
                  onEditLead={handleEditLead}
                  onArchiveLead={handleArchiveLead}
                  onDeleteLead={handleDeleteLead}
                  onAssignVendedor={handleAssignVendedor}
                  rechamadaInfoMap={rechamadaInfoMap}
                />
              ))}
            </div>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
        </DragDropContext>
      </div>

      {/* Dialogs */}
      <LeadFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        lead={editingLead}
        onSave={handleSaveLead}
      />

      <LeadDetailDialog
        open={detailOpen}
        onOpenChange={setDetailOpen}
        lead={selectedLead}
        onEdit={() => {
          setDetailOpen(false);
          if (selectedLead) handleEditLead(selectedLead);
        }}
      />

      <AlertDialog open={archiveDialogOpen} onOpenChange={setArchiveDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Arquivar Lead</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja arquivar o lead "{selectedLead?.nome}"?
              Leads arquivados podem ser restaurados posteriormente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmArchive}>Arquivar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Lead</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o lead "{selectedLead?.nome}"?
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <LostReasonDialog
        open={lostDialogOpen}
        leadName={pendingLostLead?.nome}
        mode={reasonMode}
        onCancel={handleCancelLost}
        onConfirm={handleConfirmLost}
      />

      <BulkAssignDialog
        open={bulkAssignOpen}
        onOpenChange={setBulkAssignOpen}
        leads={leads}
        vendedoresList={vendedoresList}
        vendedoresMap={vendedoresMap}
        onCompleted={() => {
          // O realtime do useLeads já dispara refetch, mas garantimos atualização imediata.
        }}
      />
    </Layout>
  );
};

export default Leads;
