import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import {
  Search,
  Plus,
  Download,
  Users,
  TrendingUp,
  DollarSign,
  Filter,
  CalendarIcon,
  CalendarDays,
  PhoneCall,
} from 'lucide-react';
import { Lead, LeadOrigem, LEAD_ORIGEM_CONFIG } from '@/lib/leads-types';
import { Vendedor } from '@/lib/vendedores-storage';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import * as XLSX from 'xlsx';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';

export type PeriodPreset = 'all' | 'today' | 'yesterday' | 'last7' | 'this_month' | 'last_month' | 'custom';

export interface PeriodFilter {
  preset: PeriodPreset;
  from?: Date;
  to?: Date;
}

interface LeadsToolbarProps {
  leads: Lead[];
  allLeads: Lead[];
  searchTerm: string;
  onSearchChange: (value: string) => void;
  filterOrigem: string;
  onFilterOrigemChange: (value: string) => void;
  filterCurso: string;
  onFilterCursoChange: (value: string) => void;
  filterVendedor: string;
  onFilterVendedorChange: (value: string) => void;
  vendedoresList: Vendedor[];
  onNewLead: () => void;
  period: PeriodFilter;
  onPeriodChange: (p: PeriodFilter) => void;
}

interface Curso {
  id: string;
  nome: string;
  nivel_ensino: string | null;
}

const LeadsToolbar = ({
  leads,
  allLeads,
  searchTerm,
  onSearchChange,
  filterOrigem,
  onFilterOrigemChange,
  filterCurso,
  onFilterCursoChange,
  filterVendedor,
  onFilterVendedorChange,
  vendedoresList,
  onNewLead,
  period,
  onPeriodChange,
}: LeadsToolbarProps) => {
  const [cursos, setCursos] = useState<Curso[]>([]);
  const [rechamadasHoje, setRechamadasHoje] = useState(0);
  const { hasRole } = useAuth();
  const canExport = hasRole('admin') || hasRole('gerente') || hasRole('supervisor') || hasRole('financeiro');
  const [customOpen, setCustomOpen] = useState(false);

  useEffect(() => {
    const fetchCursos = async () => {
      const { data } = await supabase
        .from('cursos')
        .select('id, nome, nivel_ensino')
        .eq('ativo', true);
      if (data) setCursos(data as Curso[]);
    };
    fetchCursos();
  }, []);

  const niveisEnsino = Array.from(
    new Set(cursos.map((c) => c.nivel_ensino).filter((n): n is string => !!n))
  ).sort();

  // Map curso nome -> nivel_ensino para aplicar filtro de nível de ensino
  const cursoNivelMap = new Map(
    cursos
      .filter((c) => c.nome && c.nivel_ensino)
      .map((c) => [c.nome, c.nivel_ensino as string])
  );

  // Aplica filtros de origem/nível/vendedor (mas NÃO o filtro de período) em allLeads
  const matchesFilters = (l: Lead) => {
    if (filterOrigem !== 'all' && l.origem !== filterOrigem) return false;
    if (filterCurso !== 'all') {
      const nivel = l.curso_interesse ? cursoNivelMap.get(l.curso_interesse) : null;
      if (nivel !== filterCurso) return false;
    }
    if (filterVendedor !== 'all' && l.vendedor_id !== filterVendedor) return false;
    return true;
  };

  // Metrics
  const totalLeads = leads.length;
  const wonLeads = leads.filter(l => l.status === 'matriculado').length;
  const conversionRate = totalLeads > 0 ? ((wonLeads / totalLeads) * 100).toFixed(1) : '0';
  const pipelineValue = leads
    .filter(l => !['matriculado', 'perdido'].includes(l.status))
    .reduce((sum, l) => sum + (l.valor_estimado || 0), 0);

  // Leads recebidos hoje (ignora filtro de período mas respeita demais filtros)
  const today = new Date();
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const todayEnd = todayStart + 24 * 60 * 60 * 1000;
  const leadsHoje = allLeads.filter((l) => {
    const t = new Date(l.data_entrada).getTime();
    if (t < todayStart || t >= todayEnd) return false;
    return matchesFilters(l);
  }).length;

  // Rechamadas hoje: leads transferidos para "rechamada" hoje (filtrados) +
  // tarefas de rechamada concluídas hoje cujos leads passem nos filtros
  const allLeadsById = new Map(allLeads.map((l) => [l.id, l]));
  const transferredHojeIds = allLeads
    .filter((l) => {
      if (l.status !== 'rechamada' || l.arquivado) return false;
      const t = new Date(l.updated_at).getTime();
      if (t < todayStart || t >= todayEnd) return false;
      return matchesFilters(l);
    })
    .map((l) => l.id);

  useEffect(() => {
    const fetchRechamadas = async () => {
      const fromIso = new Date(todayStart).toISOString();
      const toIso = new Date(todayEnd).toISOString();

      const { data: completedTasks } = await supabase
        .from('lead_tasks')
        .select('lead_id, completed_by')
        .eq('tipo', 'rechamada')
        .eq('concluida', true)
        .gte('completed_at', fromIso)
        .lt('completed_at', toIso);

      // Atribuição da rechamada concluída = quem CONCLUIU a tarefa (completed_by),
      // não o vendedor original do lead. Quando há filtro por vendedor, comparamos
      // o user_id do vendedor com o completed_by da tarefa.
      const filterVendedorUserId =
        filterVendedor !== 'all'
          ? vendedoresList.find((v) => v.id === filterVendedor)?.user_id
          : null;

      const completedCount = (completedTasks || []).filter((t: any) => {
        const lead = allLeadsById.get(t.lead_id);
        if (!lead) return false;
        // Aplica filtros de origem/curso (não de vendedor) sobre o lead
        if (filterOrigem !== 'all' && lead.origem !== filterOrigem) return false;
        if (filterCurso !== 'all') {
          const nivel = lead.curso_interesse ? cursoNivelMap.get(lead.curso_interesse) : null;
          if (nivel !== filterCurso) return false;
        }
        if (filterVendedor !== 'all') {
          if (!filterVendedorUserId) return false;
          if (t.completed_by !== filterVendedorUserId) return false;
        }
        return true;
      }).length;

      setRechamadasHoje(transferredHojeIds.length + completedCount);
    };
    fetchRechamadas();
    const i = window.setInterval(fetchRechamadas, 2 * 60_000);
    return () => window.clearInterval(i);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allLeads.length, filterOrigem, filterCurso, filterVendedor, cursos.length, vendedoresList.length]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  const exportToExcel = () => {
    const rows = leads.map(lead => ({
      Nome: lead.nome,
      Email: lead.email || '',
      Telefone: lead.telefone || '',
      Empresa: lead.empresa || '',
      Curso: lead.curso_interesse || '',
      Valor: lead.valor_estimado || 0,
      Origem: LEAD_ORIGEM_CONFIG[lead.origem]?.label || lead.origem,
      Status: lead.status,
      'Data Entrada': format(new Date(lead.data_entrada), 'dd/MM/yyyy'),
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Leads');
    XLSX.writeFile(wb, `leads_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
  };

  const presetLabel = (p: PeriodFilter) => {
    switch (p.preset) {
      case 'today': return 'Hoje';
      case 'yesterday': return 'Ontem';
      case 'last7': return 'Últimos 7 dias';
      case 'this_month': return 'Mês atual';
      case 'last_month': return 'Mês passado';
      case 'custom':
        if (p.from && p.to) return `${format(p.from, 'dd/MM/yy')} - ${format(p.to, 'dd/MM/yy')}`;
        return 'Personalizado';
      default: return 'Todos os períodos';
    }
  };

  const handlePresetChange = (value: string) => {
    if (value === 'custom') {
      onPeriodChange({ preset: 'custom', from: period.from, to: period.to });
      setCustomOpen(true);
    } else {
      onPeriodChange({ preset: value as PeriodPreset });
    }
  };

  return (
    <div className="space-y-4">
      {/* Toolbar / Filters */}
      <div className="flex flex-wrap items-center gap-4">
        <Button onClick={onNewLead}>
          <Plus className="h-4 w-4 mr-2" />
          Novo Lead
        </Button>

        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Buscar por nome, email ou telefone..."
            className="pl-9"
          />
        </div>

        <Select value={period.preset} onValueChange={handlePresetChange}>
          <SelectTrigger className="w-[200px]">
            <CalendarDays className="h-4 w-4 mr-2" />
            <SelectValue>{presetLabel(period)}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os períodos</SelectItem>
            <SelectItem value="today">Hoje</SelectItem>
            <SelectItem value="yesterday">Ontem</SelectItem>
            <SelectItem value="last7">Últimos 7 dias</SelectItem>
            <SelectItem value="this_month">Mês atual</SelectItem>
            <SelectItem value="last_month">Mês passado</SelectItem>
            <SelectItem value="custom">Personalizado...</SelectItem>
          </SelectContent>
        </Select>

        {period.preset === 'custom' && (
          <Popover open={customOpen} onOpenChange={setCustomOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" className={cn('justify-start text-left font-normal', !period.from && 'text-muted-foreground')}>
                <CalendarIcon className="h-4 w-4 mr-2" />
                {period.from && period.to
                  ? `${format(period.from, 'dd/MM/yy')} - ${format(period.to, 'dd/MM/yy')}`
                  : 'Selecionar datas'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="range"
                selected={{ from: period.from, to: period.to }}
                onSelect={(range) => {
                  onPeriodChange({ preset: 'custom', from: range?.from, to: range?.to });
                }}
                locale={ptBR}
                initialFocus
                className={cn('p-3 pointer-events-auto')}
              />
            </PopoverContent>
          </Popover>
        )}

        <Select value={filterOrigem} onValueChange={onFilterOrigemChange}>
          <SelectTrigger className="w-[150px]">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Origem" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas origens</SelectItem>
            {Object.entries(LEAD_ORIGEM_CONFIG).map(([key, config]) => (
              <SelectItem key={key} value={key}>
                {config.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filterCurso} onValueChange={onFilterCursoChange}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Nível de Ensino" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os níveis</SelectItem>
            {niveisEnsino.map((nivel) => (
              <SelectItem key={nivel} value={nivel}>
                {nivel}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filterVendedor} onValueChange={onFilterVendedorChange}>
          <SelectTrigger className="w-[180px]">
            <Users className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Vendedor" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos vendedores</SelectItem>
            {vendedoresList.map((v) => (
              <SelectItem key={v.id} value={v.id}>
                {v.nome}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {canExport && (
          <div className="flex items-center gap-2 ml-auto">
            <Button variant="outline" onClick={exportToExcel}>
              <Download className="h-4 w-4 mr-2" />
              Exportar Excel
            </Button>
          </div>
        )}
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="h-12 w-12 rounded-lg bg-ink-100 flex items-center justify-center">
              <Users className="h-6 w-6 text-ink-700" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total de Leads</p>
              <p className="text-2xl font-bold">{totalLeads}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="h-12 w-12 rounded-lg bg-ink-100 flex items-center justify-center">
              <CalendarDays className="h-6 w-6 text-ink-700" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Leads recebidos hoje</p>
              <p className="text-2xl font-bold">{leadsHoje}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="h-12 w-12 rounded-lg bg-[#FFF1E7] flex items-center justify-center">
              <PhoneCall className="h-6 w-6 text-[#B44309]" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Rechamadas hoje</p>
              <p className="text-2xl font-bold">{rechamadasHoje}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="h-12 w-12 rounded-lg bg-ink-100 flex items-center justify-center">
              <TrendingUp className="h-6 w-6 text-ink-700" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Taxa de Conversão</p>
              <p className="text-2xl font-bold">{conversionRate}%</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="h-12 w-12 rounded-lg bg-ink-100 flex items-center justify-center">
              <DollarSign className="h-6 w-6 text-ink-700" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Pipeline</p>
              <p className="text-2xl font-bold">{formatCurrency(pipelineValue)}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default LeadsToolbar;
