import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Search, ExternalLink, History } from 'lucide-react';
import { Installment } from '@/lib/types';
import { useFinancial } from '@/contexts/FinancialContext';
import { parseLocalDate } from '@/lib/date';
import InstallmentTimeline from './InstallmentTimeline';

interface LockedTabProps {
  filterVendedorId?: string;
}

const LockedTab = ({ filterVendedorId }: LockedTabProps) => {
  const { installments: allInstallments } = useFinancial();
  const [searchTerm, setSearchTerm] = useState('');
  const [isTimelineOpen, setIsTimelineOpen] = useState(false);
  const [timelineInstallment, setTimelineInstallment] = useState<Installment | null>(null);

  const lockedInstallments = useMemo(() => {
    return allInstallments
      .filter(i => {
        if (i.status !== 'locked') return false;
        if (filterVendedorId && filterVendedorId !== 'all' && i.vendedorId !== filterVendedorId) return false;
        return true;
      })
      .sort((a, b) => parseLocalDate(a.dueDate).getTime() - parseLocalDate(b.dueDate).getTime());
  }, [allInstallments, filterVendedorId]);

  const filtered = useMemo(() => {
    return lockedInstallments.filter(inst =>
      inst.studentName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      inst.course.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [lockedInstallments, searchTerm]);

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

  return (
    <div className="space-y-4">
      <div className="flex gap-4 items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
          <Input
            placeholder="Buscar por aluno ou curso..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Aluno</TableHead>
              <TableHead>Produto</TableHead>
              <TableHead>N° Parcela</TableHead>
              <TableHead>Valor</TableHead>
              <TableHead>Vencimento Original</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((inst) => (
              <TableRow key={inst.id} className="bg-muted/20">
                <TableCell className="font-medium">{inst.studentName}</TableCell>
                <TableCell>{inst.course}</TableCell>
                <TableCell>{inst.installmentNumber}/{inst.totalInstallments}</TableCell>
                <TableCell>{formatCurrency(inst.value)}</TableCell>
                <TableCell>{parseLocalDate(inst.dueDate).toLocaleDateString('pt-BR')}</TableCell>
                <TableCell>
                  <Badge variant="outline" className="bg-[#F1F1F4] text-[#2B2B30] border-transparent">
                    Trancado
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex gap-2 justify-end">
                    <Button aria-label="Histórico de alterações"
                      size="sm"
                      variant="outline"
                      onClick={() => { setTimelineInstallment(inst); setIsTimelineOpen(true); }}
                      title="Histórico de alterações"
                    >
                      <History className="w-4 h-4" />
                    </Button>
                    <Button aria-label="Abrir venda"
                      size="sm"
                      variant="outline"
                      onClick={() => window.open(`/vendas?sale=${inst.saleId}`, '_blank')}
                      title="Abrir venda"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                  Nenhuma parcela trancada
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">
          {filtered.length} parcela(s) trancada(s)
        </p>
        <p className="text-lg font-bold text-foreground">
          Total: <span className="text-ink-700">
            {formatCurrency(filtered.reduce((sum, inst) => sum + inst.value, 0))}
          </span>
        </p>
      </div>
      {timelineInstallment && (
        <InstallmentTimeline
          installmentId={timelineInstallment.id}
          studentName={timelineInstallment.studentName}
          installmentLabel={`${timelineInstallment.installmentNumber}/${timelineInstallment.totalInstallments}`}
          open={isTimelineOpen}
          onOpenChange={setIsTimelineOpen}
        />
      )}
    </div>
  );
};

export default LockedTab;
