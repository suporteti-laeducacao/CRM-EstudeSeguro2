import { useEffect, useMemo, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Lead, LeadStatus, LEAD_STATUS_CONFIG, KANBAN_COLUMNS } from '@/lib/leads-types';
import { Vendedor } from '@/lib/vendedores-storage';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { ArrowRight, Users } from 'lucide-react';

interface BulkAssignDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leads: Lead[];
  vendedoresList: Vendedor[];
  vendedoresMap: Map<string, string>;
  onCompleted: () => void;
}

const BulkAssignDialog = ({
  open,
  onOpenChange,
  leads,
  vendedoresList,
  vendedoresMap,
  onCompleted,
}: BulkAssignDialogProps) => {
  const [fromVendedorId, setFromVendedorId] = useState<string>('');
  const [toVendedorId, setToVendedorId] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setFromVendedorId('');
      setToVendedorId('');
      setStatusFilter('all');
      setSelectedIds(new Set());
      setSubmitting(false);
    }
  }, [open]);

  // Leads candidatos: pertencentes ao vendedor de origem (ou sem vendedor) + status filtro
  const candidateLeads = useMemo(() => {
    if (!fromVendedorId) return [];
    return leads.filter((l) => {
      const matchesFrom =
        fromVendedorId === '__none__'
          ? !l.vendedor_id
          : l.vendedor_id === fromVendedorId;
      if (!matchesFrom) return false;
      if (statusFilter !== 'all' && l.status !== statusFilter) return false;
      return true;
    });
  }, [leads, fromVendedorId, statusFilter]);

  // Re-seleciona tudo quando o filtro muda
  useEffect(() => {
    setSelectedIds(new Set(candidateLeads.map((l) => l.id)));
  }, [candidateLeads]);

  const toggleAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(candidateLeads.map((l) => l.id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const toggleOne = (id: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const allChecked =
    candidateLeads.length > 0 && selectedIds.size === candidateLeads.length;

  const canSubmit =
    !!fromVendedorId &&
    !!toVendedorId &&
    fromVendedorId !== toVendedorId &&
    selectedIds.size > 0 &&
    !submitting;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const ids = Array.from(selectedIds);
      const { error } = await supabase
        .from('leads')
        .update({ vendedor_id: toVendedorId })
        .in('id', ids);

      if (error) throw error;
      toast.success(
        `${ids.length} lead(s) transferido(s) para ${vendedoresMap.get(toVendedorId) || 'vendedor selecionado'}`
      );
      onCompleted();
      onOpenChange(false);
    } catch (err: any) {
      console.error('Bulk assign error:', err);
      toast.error('Erro ao transferir leads');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!submitting) onOpenChange(o);
      }}
    >
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Transferência em massa de leads
          </DialogTitle>
          <DialogDescription>
            Selecione o vendedor de origem, o vendedor de destino e os leads que deseja transferir.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_1fr] gap-3 items-end">
            <div className="space-y-2">
              <Label>Vendedor de origem *</Label>
              <Select value={fromVendedorId} onValueChange={setFromVendedorId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Sem vendedor</SelectItem>
                  {vendedoresList.map((v) => (
                    <SelectItem key={v.id} value={v.id}>
                      {v.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <ArrowRight className="h-5 w-5 text-muted-foreground hidden sm:block mb-2 mx-auto" />

            <div className="space-y-2">
              <Label>Vendedor de destino *</Label>
              <Select value={toVendedorId} onValueChange={setToVendedorId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {vendedoresList
                    .filter((v) => v.id !== fromVendedorId)
                    .map((v) => (
                      <SelectItem key={v.id} value={v.id}>
                        {v.nome}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Filtrar por status (opcional)</Label>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os status</SelectItem>
                {KANBAN_COLUMNS.map((s) => (
                  <SelectItem key={s} value={s}>
                    {LEAD_STATUS_CONFIG[s as LeadStatus].label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="border rounded-md">
            <div className="flex items-center justify-between px-3 py-2 border-b bg-muted/30">
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={allChecked}
                  onCheckedChange={(c) => toggleAll(!!c)}
                  disabled={candidateLeads.length === 0}
                />
                <span className="text-sm font-medium">
                  {candidateLeads.length === 0
                    ? 'Nenhum lead encontrado'
                    : `${selectedIds.size} de ${candidateLeads.length} selecionado(s)`}
                </span>
              </div>
            </div>
            <ScrollArea className="h-64">
              <div className="divide-y">
                {candidateLeads.map((l) => {
                  const checked = selectedIds.has(l.id);
                  const cfg = LEAD_STATUS_CONFIG[l.status];
                  return (
                    <label
                      key={l.id}
                      className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-muted/40"
                    >
                      <Checkbox
                        checked={checked}
                        onCheckedChange={(c) => toggleOne(l.id, !!c)}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{l.nome}</div>
                        <div className="text-xs text-muted-foreground truncate">
                          {l.telefone || l.email || '—'}
                        </div>
                      </div>
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full ${cfg.bgColor} ${cfg.color}`}
                      >
                        {cfg.label}
                      </span>
                    </label>
                  );
                })}
                {!fromVendedorId && (
                  <div className="text-sm text-muted-foreground text-center py-8">
                    Selecione um vendedor de origem para listar os leads.
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={!canSubmit}>
            {submitting
              ? 'Transferindo...'
              : `Transferir ${selectedIds.size} lead(s)`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default BulkAssignDialog;
