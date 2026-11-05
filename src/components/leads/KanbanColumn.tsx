import { memo, useState, useMemo } from 'react';
import { Droppable, Draggable } from '@hello-pangea/dnd';
import { Lead, LeadStatus, LEAD_STATUS_CONFIG } from '@/lib/leads-types';
import LeadCard from './LeadCard';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Vendedor } from '@/lib/vendedores-storage';
import { Button } from '@/components/ui/button';
import { ChevronDown } from 'lucide-react';
import type { LeadRechamadaInfo } from '@/pages/Leads';

const CARDS_PER_PAGE = 20;

interface KanbanColumnProps {
  status: LeadStatus;
  leads: Lead[];
  vendedoresMap: Map<string, string>;
  vendedoresList: Vendedor[];
  canAssign: boolean;
  canDelete?: boolean;
  onViewLead: (lead: Lead) => void;
  onEditLead: (lead: Lead) => void;
  onArchiveLead: (lead: Lead) => void;
  onDeleteLead: (lead: Lead) => void;
  onAssignVendedor?: (lead: Lead, vendedorId: string) => void;
  rechamadaInfoMap?: Map<string, LeadRechamadaInfo>;
}

const KanbanColumn = memo(({ 
  status, 
  leads, 
  vendedoresMap,
  vendedoresList,
  canAssign,
  canDelete = true,
  onViewLead, 
  onEditLead, 
  onArchiveLead, 
  onDeleteLead,
  onAssignVendedor,
  rechamadaInfoMap,
}: KanbanColumnProps) => {
  const config = LEAD_STATUS_CONFIG[status];
  const columnLeads = useMemo(() => {
    const filtered = leads.filter(lead => lead.status === status);
    if (status === 'rechamada' && rechamadaInfoMap) {
      // Ordenar por próxima tarefa pendente (mais antiga/atrasada primeiro)
      return [...filtered].sort((a, b) => {
        const da = rechamadaInfoMap.get(a.id)?.nextDue;
        const db = rechamadaInfoMap.get(b.id)?.nextDue;
        if (!da && !db) return 0;
        if (!da) return 1;
        if (!db) return -1;
        return new Date(da).getTime() - new Date(db).getTime();
      });
    }
    return filtered;
  }, [leads, status, rechamadaInfoMap]);
  const totalValue = useMemo(() => columnLeads.reduce((sum, lead) => sum + (lead.valor_estimado || 0), 0), [columnLeads]);
  const rechamadaCounts = useMemo(() => {
    if (status !== 'rechamada' || !rechamadaInfoMap) return { overdue: 0, today: 0 };
    let overdue = 0, today = 0;
    columnLeads.forEach((l) => {
      const info = rechamadaInfoMap.get(l.id);
      if (!info) return;
      if (info.hasOverdue) overdue++;
      if (info.hasDueToday) today++;
    });
    return { overdue, today };
  }, [columnLeads, status, rechamadaInfoMap]);
  const [visibleCount, setVisibleCount] = useState(CARDS_PER_PAGE);

  const visibleLeads = useMemo(() => columnLeads.slice(0, visibleCount), [columnLeads, visibleCount]);
  const hasMore = columnLeads.length > visibleCount;

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  return (
    <div className="flex-shrink-0 w-72 bg-ink-50 rounded-[14px] border border-ink-200 flex flex-col max-h-[calc(100vh-320px)]">
      <div className={`p-3 rounded-t-[13px] ${config.bgColor}`}>
        <div className="flex items-center justify-between">
          <h3 className={`font-semibold text-[14px] ${config.color}`}>
            {config.label}
          </h3>
          <span className="text-xs font-semibold tabular-nums px-2 py-0.5 rounded-full bg-ink-200 text-ink-700">
            {columnLeads.length}
          </span>
        </div>
        {totalValue > 0 && (
          <p className={`text-xs mt-1 tabular-nums ${config.color} opacity-80`}>
            {formatCurrency(totalValue)}
          </p>
        )}
        {status === 'rechamada' && (rechamadaCounts.overdue > 0 || rechamadaCounts.today > 0) && (
          <div className="flex flex-wrap gap-1 mt-2">
            {rechamadaCounts.overdue > 0 && (
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-destructive/10 text-destructive border border-destructive/25">
                {rechamadaCounts.overdue} atrasada{rechamadaCounts.overdue > 1 ? 's' : ''}
              </span>
            )}
            {rechamadaCounts.today > 0 && (
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-warning/15 text-warning border border-warning/30">
                {rechamadaCounts.today} hoje
              </span>
            )}
          </div>
        )}
      </div>

      <Droppable droppableId={status}>
        {(provided, snapshot) => (
          <div className="flex-1 w-full overflow-y-auto overflow-x-hidden">
            <div
              ref={provided.innerRef}
              {...provided.droppableProps}
              className={`p-2 pb-6 min-h-[200px] transition-colors ${
                snapshot.isDraggingOver ? 'bg-primary/5' : ''
              }`}
            >
              {visibleLeads.map((lead, index) => (
                <Draggable key={lead.id} draggableId={lead.id} index={index}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.draggableProps}
                      {...provided.dragHandleProps}
                    >
                      <LeadCard
                        lead={lead}
                        onView={onViewLead}
                        onEdit={onEditLead}
                        onArchive={onArchiveLead}
                        onDelete={onDeleteLead}
                        onAssignVendedor={onAssignVendedor}
                        rechamadaInfo={rechamadaInfoMap?.get(lead.id)}
                        isDragging={snapshot.isDragging}
                        vendedorNome={lead.vendedor_id ? vendedoresMap.get(lead.vendedor_id) : undefined}
                        vendedoresList={vendedoresList}
                        canAssign={canAssign}
                        canDelete={canDelete}
                      />
                    </div>
                  )}
                </Draggable>
              ))}
              {provided.placeholder}
              
              {hasMore && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full mt-1 text-xs text-muted-foreground"
                  onClick={() => setVisibleCount(prev => prev + CARDS_PER_PAGE)}
                >
                  <ChevronDown className="h-3 w-3 mr-1" />
                  Mostrar mais ({columnLeads.length - visibleCount} restantes)
                </Button>
              )}

              {columnLeads.length === 0 && !snapshot.isDraggingOver && (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  Arraste leads aqui
                </div>
              )}
            </div>
          </div>
        )}
      </Droppable>
    </div>
  );
});

KanbanColumn.displayName = 'KanbanColumn';

export default KanbanColumn;
