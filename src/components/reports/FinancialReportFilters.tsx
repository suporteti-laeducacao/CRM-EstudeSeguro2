import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { format, startOfMonth, endOfMonth, subMonths, startOfYear } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CalendarIcon, X } from 'lucide-react';

export interface FinancialReportFilters {
  dataInicio: Date | undefined;
  dataFim: Date | undefined;
  vendedoresSelecionados: string[];
  todosVendedores: boolean;
  valoresRecebidos: boolean;
  valoresAReceber: boolean;
  notificacoesEmAndamento: boolean;
  incluirAvisoBloqueio: boolean;
}

interface FinancialReportFiltersProps {
  filters: FinancialReportFilters;
  onFiltersChange: (filters: FinancialReportFilters) => void;
  vendedores: { id: string; nome: string }[];
}

const periodosRapidos = [
  { value: 'mes_atual', label: 'Mês Atual' },
  { value: 'mes_anterior', label: 'Mês Anterior' },
  { value: 'ultimos_3_meses', label: 'Últimos 3 Meses' },
  { value: 'ano_atual', label: 'Ano Atual' },
];

const FinancialReportFiltersComponent = ({
  filters,
  onFiltersChange,
  vendedores,
}: FinancialReportFiltersProps) => {
  const [periodoRapido, setPeriodoRapido] = useState<string>('');

  const aplicarPeriodoRapido = (periodo: string) => {
    setPeriodoRapido(periodo);
    const hoje = new Date();

    let dataInicio: Date | undefined;
    let dataFim: Date | undefined;

    switch (periodo) {
      case 'mes_atual':
        dataInicio = startOfMonth(hoje);
        dataFim = endOfMonth(hoje);
        break;
      case 'mes_anterior':
        const mesAnterior = subMonths(hoje, 1);
        dataInicio = startOfMonth(mesAnterior);
        dataFim = endOfMonth(mesAnterior);
        break;
      case 'ultimos_3_meses':
        dataInicio = startOfMonth(subMonths(hoje, 2));
        dataFim = endOfMonth(hoje);
        break;
      case 'ano_atual':
        dataInicio = startOfYear(hoje);
        dataFim = hoje;
        break;
    }

    onFiltersChange({
      ...filters,
      dataInicio,
      dataFim,
    });
  };

  const handleVendedorChange = (vendedorId: string, checked: boolean) => {
    if (checked) {
      onFiltersChange({
        ...filters,
        vendedoresSelecionados: [...filters.vendedoresSelecionados, vendedorId],
        todosVendedores: false,
      });
    } else {
      onFiltersChange({
        ...filters,
        vendedoresSelecionados: filters.vendedoresSelecionados.filter(id => id !== vendedorId),
      });
    }
  };

  const handleTodosVendedoresChange = (checked: boolean) => {
    onFiltersChange({
      ...filters,
      todosVendedores: checked,
      vendedoresSelecionados: checked ? [] : filters.vendedoresSelecionados,
    });
  };

  const handleValoresChange = (tipo: 'recebidos' | 'aReceber', checked: boolean) => {
    if (tipo === 'recebidos') {
      onFiltersChange({
        ...filters,
        valoresRecebidos: checked,
      });
    } else {
      onFiltersChange({
        ...filters,
        valoresAReceber: checked,
      });
    }
  };

  const limparFiltros = () => {
    setPeriodoRapido('');
    onFiltersChange({
      dataInicio: undefined,
      dataFim: undefined,
      vendedoresSelecionados: [],
      todosVendedores: true,
      valoresRecebidos: true,
      valoresAReceber: true,
      notificacoesEmAndamento: true,
      incluirAvisoBloqueio: true,
    });
  };

  // Salvar filtros no localStorage
  useEffect(() => {
    localStorage.setItem('financialReportFilters', JSON.stringify({
      ...filters,
      dataInicio: filters.dataInicio?.toISOString(),
      dataFim: filters.dataFim?.toISOString(),
    }));
  }, [filters]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex justify-between items-center">
          <CardTitle className="text-lg">Filtros do Relatório</CardTitle>
          <Button variant="ghost" size="sm" onClick={limparFiltros} className="gap-1">
            <X className="h-4 w-4" />
            Limpar Filtros
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Período Rápido */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">Período Rápido</Label>
          <div className="flex flex-wrap gap-2">
            {periodosRapidos.map((periodo) => (
              <Button
                key={periodo.value}
                variant={periodoRapido === periodo.value ? 'default' : 'outline'}
                size="sm"
                onClick={() => aplicarPeriodoRapido(periodo.value)}
              >
                {periodo.label}
              </Button>
            ))}
          </div>
        </div>

        {/* Datas */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="text-sm font-medium">Data Inicial</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !filters.dataInicio && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {filters.dataInicio
                    ? format(filters.dataInicio, "dd/MM/yyyy", { locale: ptBR })
                    : "Selecione"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={filters.dataInicio}
                  onSelect={(date) => {
                    setPeriodoRapido('');
                    onFiltersChange({ ...filters, dataInicio: date });
                  }}
                  initialFocus
                  locale={ptBR}
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium">Data Final</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !filters.dataFim && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {filters.dataFim
                    ? format(filters.dataFim, "dd/MM/yyyy", { locale: ptBR })
                    : "Selecione"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={filters.dataFim}
                  onSelect={(date) => {
                    setPeriodoRapido('');
                    onFiltersChange({ ...filters, dataFim: date });
                  }}
                  initialFocus
                  locale={ptBR}
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>

        {/* Vendedores */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">Vendedores</Label>
          <div className="flex flex-wrap gap-4">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="todos-vendedores"
                checked={filters.todosVendedores}
                onCheckedChange={(checked) => handleTodosVendedoresChange(checked as boolean)}
              />
              <label
                htmlFor="todos-vendedores"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                Todos
              </label>
            </div>
            {vendedores.map((vendedor) => (
              <div key={vendedor.id} className="flex items-center space-x-2">
                <Checkbox
                  id={`vendedor-${vendedor.id}`}
                  checked={filters.vendedoresSelecionados.includes(vendedor.id)}
                  onCheckedChange={(checked) => handleVendedorChange(vendedor.id, checked as boolean)}
                  disabled={filters.todosVendedores}
                />
                <label
                  htmlFor={`vendedor-${vendedor.id}`}
                  className={cn(
                    "text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70",
                    filters.todosVendedores && "text-muted-foreground"
                  )}
                >
                  {vendedor.nome}
                </label>
              </div>
            ))}
          </div>
        </div>

        {/* Tipo de Valores */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">Tipo de Valores</Label>
          <div className="flex flex-wrap gap-4">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="valores-recebidos"
                checked={filters.valoresRecebidos}
                onCheckedChange={(checked) => handleValoresChange('recebidos', checked as boolean)}
              />
              <label
                htmlFor="valores-recebidos"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                Valores Recebidos
              </label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="valores-a-receber"
                checked={filters.valoresAReceber}
                onCheckedChange={(checked) => handleValoresChange('aReceber', checked as boolean)}
              />
              <label
                htmlFor="valores-a-receber"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                Valores a Receber
              </label>
            </div>
          </div>
        </div>

        {/* Opções do Relatório de Inadimplência */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">Opções de Inadimplência</Label>
          <div className="flex flex-wrap gap-4">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="notificacoes-andamento"
                checked={filters.notificacoesEmAndamento}
                onCheckedChange={(checked) => onFiltersChange({ ...filters, notificacoesEmAndamento: checked as boolean })}
              />
              <label
                htmlFor="notificacoes-andamento"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                Notificações de cobrança em andamento
              </label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="aviso-bloqueio"
                checked={filters.incluirAvisoBloqueio}
                onCheckedChange={(checked) => onFiltersChange({ ...filters, incluirAvisoBloqueio: checked as boolean })}
              />
              <label
                htmlFor="aviso-bloqueio"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                Incluir aviso de bloqueio
              </label>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default FinancialReportFiltersComponent;
