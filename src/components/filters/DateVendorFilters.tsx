import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { CalendarIcon, X } from 'lucide-react';
import { format, startOfMonth, endOfMonth, subMonths, startOfWeek, endOfWeek, subWeeks } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { getVendedores, Vendedor } from '@/lib/vendedores-storage';

interface DateVendorFiltersProps {
  dataInicio: Date | undefined;
  setDataInicio: (date: Date | undefined) => void;
  dataFim: Date | undefined;
  setDataFim: (date: Date | undefined) => void;
  vendedorId: string;
  setVendedorId: (id: string) => void;
  onClearFilters: () => void;
  showVendorFilter?: boolean;
}

const DateVendorFilters = ({
  dataInicio,
  setDataInicio,
  dataFim,
  setDataFim,
  vendedorId,
  setVendedorId,
  onClearFilters,
  showVendorFilter = true,
}: DateVendorFiltersProps) => {
  const [vendedores, setVendedores] = useState<Vendedor[]>([]);
  const [periodoRapido, setPeriodoRapido] = useState<string>('');

  useEffect(() => {
    if (showVendorFilter) {
      loadVendedores();
    }
  }, [showVendorFilter]);

  const loadVendedores = async () => {
    const loaded = await getVendedores();
    setVendedores(loaded);
  };

  const handlePeriodoRapido = (periodo: string) => {
    setPeriodoRapido(periodo);
    const hoje = new Date();

    switch (periodo) {
      case 'hoje':
        setDataInicio(hoje);
        setDataFim(hoje);
        break;
      case 'semana_atual':
        setDataInicio(startOfWeek(hoje, { weekStartsOn: 0 }));
        setDataFim(endOfWeek(hoje, { weekStartsOn: 0 }));
        break;
      case 'semana_passada':
        setDataInicio(startOfWeek(subWeeks(hoje, 1), { weekStartsOn: 0 }));
        setDataFim(endOfWeek(subWeeks(hoje, 1), { weekStartsOn: 0 }));
        break;
      case 'mes_atual':
        setDataInicio(startOfMonth(hoje));
        setDataFim(endOfMonth(hoje));
        break;
      case 'mes_passado':
        setDataInicio(startOfMonth(subMonths(hoje, 1)));
        setDataFim(endOfMonth(subMonths(hoje, 1)));
        break;
      case 'ultimos_3_meses':
        setDataInicio(startOfMonth(subMonths(hoje, 2)));
        setDataFim(endOfMonth(hoje));
        break;
      case 'ultimos_6_meses':
        setDataInicio(startOfMonth(subMonths(hoje, 5)));
        setDataFim(endOfMonth(hoje));
        break;
      default:
        setDataInicio(undefined);
        setDataFim(undefined);
    }
  };

  const hasActiveFilters = dataInicio || dataFim || vendedorId;

  const handleClearFilters = () => {
    setPeriodoRapido('');
    onClearFilters();
  };

  return (
    <div className="flex flex-wrap gap-3 items-end">
      {/* Período Rápido */}
      <div className="min-w-[160px]">
        <Label className="text-xs text-muted-foreground mb-1 block">Período</Label>
        <Select value={periodoRapido} onValueChange={handlePeriodoRapido}>
          <SelectTrigger className="h-9">
            <SelectValue placeholder="Selecionar..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="hoje">Hoje</SelectItem>
            <SelectItem value="semana_atual">Semana Atual</SelectItem>
            <SelectItem value="semana_passada">Semana Passada</SelectItem>
            <SelectItem value="mes_atual">Mês Atual</SelectItem>
            <SelectItem value="mes_passado">Mês Passado</SelectItem>
            <SelectItem value="ultimos_3_meses">Últimos 3 Meses</SelectItem>
            <SelectItem value="ultimos_6_meses">Últimos 6 Meses</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Data Início */}
      <div className="min-w-[140px]">
        <Label className="text-xs text-muted-foreground mb-1 block">De</Label>
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn(
                'h-9 w-full justify-start text-left font-normal',
                !dataInicio && 'text-muted-foreground'
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {dataInicio ? format(dataInicio, 'dd/MM/yyyy', { locale: ptBR }) : 'Início'}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={dataInicio}
              onSelect={(date) => {
                setDataInicio(date);
                setPeriodoRapido('');
              }}
              initialFocus
              locale={ptBR}
            />
          </PopoverContent>
        </Popover>
      </div>

      {/* Data Fim */}
      <div className="min-w-[140px]">
        <Label className="text-xs text-muted-foreground mb-1 block">Até</Label>
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn(
                'h-9 w-full justify-start text-left font-normal',
                !dataFim && 'text-muted-foreground'
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {dataFim ? format(dataFim, 'dd/MM/yyyy', { locale: ptBR }) : 'Fim'}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={dataFim}
              onSelect={(date) => {
                setDataFim(date);
                setPeriodoRapido('');
              }}
              initialFocus
              locale={ptBR}
            />
          </PopoverContent>
        </Popover>
      </div>

      {/* Vendedor */}
      {showVendorFilter && (
        <div className="min-w-[160px]">
          <Label className="text-xs text-muted-foreground mb-1 block">Vendedor</Label>
          <Select value={vendedorId} onValueChange={setVendedorId}>
            <SelectTrigger className="h-9">
              <SelectValue placeholder="Todos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {vendedores.map((v) => (
                <SelectItem key={v.id} value={v.id}>
                  {v.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Limpar Filtros */}
      {hasActiveFilters && (
        <Button
          variant="ghost"
          size="sm"
          onClick={handleClearFilters}
          className="h-9 gap-1 text-muted-foreground hover:text-foreground"
        >
          <X className="h-4 w-4" />
          Limpar
        </Button>
      )}
    </div>
  );
};

export default DateVendorFilters;
