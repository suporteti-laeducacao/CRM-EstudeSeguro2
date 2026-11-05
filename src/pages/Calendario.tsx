import { useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import Layout from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { CalendarDays, Info, Pencil, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useBusinessDays, CALENDAR_QUERY_KEY } from '@/hooks/useBusinessDays';
import {
  deleteCalendarException, deleteHoliday, saveCalendarException, saveHoliday,
  updateCalendarSettings, updateWorkScheduleDay,
} from '@/lib/calendar-storage';
import {
  CalendarException, CALENDAR_LEGAL_NOTICE, EXCEPTION_LABELS, Holiday,
  HolidayScope, SCOPE_LABELS,
} from '@/lib/calendar-types';
import { addDaysKey, dateToKey, formatWeighted, keyToDate } from '@/lib/business-days';
import { cn } from '@/lib/utils';

const WEEKDAY_NAMES = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
const MONTH_NAMES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

const emptyHoliday = (): Partial<Holiday> => ({
  name: '', day: null, month: null, date: null, is_recurring: true, is_movable: false,
  movable_rule: null, scope: 'municipal', day_weight: 0, is_facultative: false,
  is_active: true, legal_basis: '',
});

const Calendario = () => {
  const qc = useQueryClient();
  const { engine, holidays, exceptions, workSchedule, settings, considerFacultative, isLoading } = useBusinessDays();

  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth());
  const [scopeFilter, setScopeFilter] = useState<string>('todos');
  const [holidayDialog, setHolidayDialog] = useState<Partial<Holiday> | null>(null);
  const [exceptionDialog, setExceptionDialog] = useState<Partial<CalendarException> | null>(null);
  const [deleting, setDeleting] = useState<{ type: 'holiday' | 'exception'; id: string; name: string } | null>(null);

  const invalidate = () => qc.invalidateQueries({ queryKey: CALENDAR_QUERY_KEY });

  const monthStart = `${year}-${String(month + 1).padStart(2, '0')}-01`;
  const monthEnd = dateToKey(new Date(year, month + 1, 0, 12));
  const monthDays = useMemo(() => engine.listDays(monthStart, monthEnd), [engine, monthStart, monthEnd]);
  const monthWeighted = monthDays.reduce((s, d) => s + d.weight, 0);
  const monthFullDays = monthDays.filter((d) => d.weight === 1).length;
  const monthHalfDays = monthDays.filter((d) => d.weight > 0 && d.weight < 1).length;

  const yearDays = useMemo(
    () => engine.listDays(`${year}-01-01`, `${year}-12-31`),
    [engine, year]
  );

  const filteredHolidays = holidays.filter((h) => scopeFilter === 'todos' || h.scope === scopeFilter);

  const dayClass = (weight: number, isException: boolean, isHoliday: boolean) => {
    if (isException) return 'bg-brand-tint border-brand/50 text-brand-ink';
    if (weight === 0) return isHoliday
      ? 'bg-[#FDECEC] border-[#F5C2C2] text-[#B02121]'
      : 'bg-ink-100 text-ink-400 border-ink-200';
    if (weight < 1) return 'bg-[#FFF1E7] border-[#FFD3B0] text-[#B44309]';
    return 'bg-[#E7F7F0] border-[#BFE7D6] text-ink-950';
  };

  const handleSaveHoliday = async () => {
    const h = holidayDialog!;
    if (!h.name?.trim()) { toast.error('Informe o nome do feriado'); return; }
    if (!h.is_movable && h.is_recurring && (!h.day || !h.month)) { toast.error('Informe dia e mês'); return; }
    if (!h.is_movable && !h.is_recurring && !h.date) { toast.error('Informe a data'); return; }
    if (h.is_movable && !h.movable_rule) { toast.error('Informe a regra móvel (ex.: easter-2)'); return; }
    try {
      await saveHoliday({
        ...h,
        day: h.is_movable ? null : h.day,
        month: h.is_movable ? null : h.month,
        date: h.is_movable || h.is_recurring ? null : h.date,
      });
      toast.success('Feriado salvo');
      setHolidayDialog(null);
      invalidate();
    } catch (e: any) { toast.error(e.message || 'Erro ao salvar'); }
  };

  const handleSaveException = async () => {
    const e = exceptionDialog!;
    if (!e.date || !e.description?.trim()) { toast.error('Informe data e descrição'); return; }
    try {
      await saveCalendarException(e);
      toast.success('Exceção salva');
      setExceptionDialog(null);
      invalidate();
    } catch (err: any) { toast.error(err.message || 'Erro ao salvar'); }
  };

  const handleDelete = async () => {
    if (!deleting) return;
    try {
      if (deleting.type === 'holiday') await deleteHoliday(deleting.id);
      else await deleteCalendarException(deleting.id);
      toast.success('Removido');
      setDeleting(null);
      invalidate();
    } catch (e: any) { toast.error(e.message || 'Erro ao remover'); }
  };

  const toggleActive = async (h: Holiday) => {
    try {
      await saveHoliday({ id: h.id, is_active: !h.is_active });
      invalidate();
    } catch (e: any) { toast.error(e.message || 'Erro ao atualizar'); }
  };

  const handleHours = async (weekday: number, hours: number) => {
    try {
      await updateWorkScheduleDay(weekday, hours);
      invalidate();
    } catch (e: any) { toast.error(e.message || 'Erro ao atualizar jornada'); }
  };

  const renderMonthGrid = (m: number, compact = false) => {
    const start = `${year}-${String(m + 1).padStart(2, '0')}-01`;
    const end = dateToKey(new Date(year, m + 1, 0, 12));
    const days = engine.listDays(start, end);
    const firstWeekday = keyToDate(start).getDay();
    return (
      <div key={m} className="space-y-2">
        {compact && <p className="text-sm font-semibold text-center">{MONTH_NAMES[m]}</p>}
        <div className="grid grid-cols-7 gap-1 text-center text-[10px] text-muted-foreground">
          {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((d, i) => <div key={i}>{d}</div>)}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: firstWeekday }).map((_, i) => <div key={`e${i}`} />)}
          {days.map((d) => (
            <div
              key={d.key}
              title={[
                format(keyToDate(d.key), "dd 'de' MMMM", { locale: ptBR }),
                d.holiday?.name,
                d.exception?.description,
                `Peso: ${d.weight}`,
              ].filter(Boolean).join(' · ')}
              className={cn(
                'rounded-[10px] border text-center tabular-nums',
                compact ? 'text-[10px] py-1' : 'text-xs py-2 px-1',
                dayClass(d.weight, !!d.exception, !!d.holiday),
                d.key === dateToKey(new Date()) && 'ring-2 ring-brand'
              )}
            >
              <div className="font-medium">{Number(d.key.slice(8))}</div>
              {!compact && (d.holiday || d.exception) && (
                <div className="truncate text-[10px] leading-tight opacity-80">
                  {d.exception?.description || d.holiday?.name}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-[26px] leading-8 text-ink-950 mb-1 flex items-center gap-2">
              <CalendarDays className="h-7 w-7" /> Calendário
            </h1>
            <p className="text-[13.5px] text-ink-500">Feriados, jornada de trabalho e exceções que alimentam o cálculo de metas diárias</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setExceptionDialog({ date: '', description: '', day_weight: 0, type: 'folga' })}>
              <Plus className="h-4 w-4" /> Exceção
            </Button>
            <Button onClick={() => setHolidayDialog(emptyHoliday())}>
              <Plus className="h-4 w-4" /> Adicionar feriado
            </Button>
          </div>
        </div>

        <div className="flex items-start gap-2 rounded-[10px] border border-[#FFD3B0] bg-[#FFF1E7] p-3 text-sm text-[#B44309]">
          <Info className="h-4 w-4 mt-0.5 shrink-0" />
          <span>{CALENDAR_LEGAL_NOTICE}</span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="lg:col-span-3 space-y-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-4 flex-wrap">
                <CardTitle>Visualização</CardTitle>
                <div className="flex items-center gap-2">
                  <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
                    <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 7 }, (_, i) => new Date().getFullYear() - 2 + i).map((y) => (
                        <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={String(month)} onValueChange={(v) => setMonth(Number(v))}>
                    <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {MONTH_NAMES.map((mn, i) => <SelectItem key={mn} value={String(i)}>{mn}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="mes">
                  <TabsList className="mb-4">
                    <TabsTrigger value="mes">Mensal</TabsTrigger>
                    <TabsTrigger value="ano">Anual</TabsTrigger>
                  </TabsList>
                  <TabsContent value="mes">{renderMonthGrid(month)}</TabsContent>
                  <TabsContent value="ano">
                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
                      {MONTH_NAMES.map((_, i) => renderMonthGrid(i, true))}
                    </div>
                  </TabsContent>
                </Tabs>

                <div className="flex flex-wrap gap-3 mt-6 text-xs">
                  {[
                    ['bg-[#E7F7F0] border-[#BFE7D6]', 'Dia integral'],
                    ['bg-[#FFF1E7] border-[#FFD3B0]', 'Meio expediente'],
                    ['bg-ink-100 border-ink-200', 'Não útil'],
                    ['bg-[#FDECEC] border-[#F5C2C2]', 'Feriado'],
                    ['bg-brand-tint border-brand/50', 'Exceção da empresa'],
                  ].map(([cls, label]) => (
                    <span key={label} className="flex items-center gap-1.5">
                      <span className={cn('inline-block h-3 w-3 rounded border', cls)} />{label}
                    </span>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-4 flex-wrap">
                <CardTitle>Feriados cadastrados</CardTitle>
                <Select value={scopeFilter} onValueChange={setScopeFilter}>
                  <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todas abrangências</SelectItem>
                    {Object.entries(SCOPE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Feriado</TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead>Abrangência</TableHead>
                      <TableHead>Peso</TableHead>
                      <TableHead>Base legal</TableHead>
                      <TableHead>Ativo</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading && <TableRow><TableCell colSpan={7} className="text-center py-6 text-muted-foreground">Carregando...</TableCell></TableRow>}
                    {filteredHolidays.map((h) => (
                      <TableRow key={h.id} className={cn(!h.is_active && 'opacity-50')}>
                        <TableCell className="font-medium">
                          {h.name}
                          {h.is_facultative && <Badge variant="outline" className="ml-2 text-[10px]">Facultativo</Badge>}
                        </TableCell>
                        <TableCell className="text-sm">
                          {h.is_movable
                            ? `Móvel (${h.movable_rule})`
                            : h.is_recurring
                              ? `${String(h.day).padStart(2, '0')}/${String(h.month).padStart(2, '0')}`
                              : h.date}
                        </TableCell>
                        <TableCell><Badge variant="secondary">{SCOPE_LABELS[h.scope]}</Badge></TableCell>
                        <TableCell>{h.day_weight}</TableCell>
                        <TableCell className="text-xs text-muted-foreground max-w-[240px]">{h.legal_basis}</TableCell>
                        <TableCell><Switch checked={h.is_active} onCheckedChange={() => toggleActive(h)} /></TableCell>
                        <TableCell className="text-right whitespace-nowrap">
                          <Button variant="ghost" size="icon" aria-label="Editar feriado" onClick={() => setHolidayDialog(h)}><Pencil className="h-4 w-4" /></Button>
                          <Button variant="ghost" size="icon" aria-label="Excluir feriado" onClick={() => setDeleting({ type: 'holiday', id: h.id, name: h.name })}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Exceções da empresa</CardTitle></CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Descrição</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Peso</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {exceptions.length === 0 ? (
                      <TableRow><TableCell colSpan={5} className="text-center py-6 text-muted-foreground">Nenhuma exceção cadastrada</TableCell></TableRow>
                    ) : exceptions.map((e) => (
                      <TableRow key={e.id}>
                        <TableCell>{format(keyToDate(e.date), 'dd/MM/yyyy')}</TableCell>
                        <TableCell className="font-medium">{e.description}</TableCell>
                        <TableCell><Badge variant="secondary">{EXCEPTION_LABELS[e.type]}</Badge></TableCell>
                        <TableCell>{e.day_weight}</TableCell>
                        <TableCell className="text-right whitespace-nowrap">
                          <Button variant="ghost" size="icon" aria-label="Editar exceção" onClick={() => setExceptionDialog(e)}><Pencil className="h-4 w-4" /></Button>
                          <Button variant="ghost" size="icon" aria-label="Excluir exceção" onClick={() => setDeleting({ type: 'exception', id: e.id, name: e.description })}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>

          {/* Painel lateral */}
          <div className="space-y-6">
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-base">Resumo — {MONTH_NAMES[month]}/{year}</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Dias úteis do mês</span><span className="font-semibold">{monthFullDays + monthHalfDays}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Dias úteis ponderados</span><span className="font-semibold text-primary">{formatWeighted(monthWeighted)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Dias integrais</span><span>{monthFullDays}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Meio expediente</span><span>{monthHalfDays}</span></div>
                <div className="flex justify-between border-t pt-2 mt-2"><span className="text-muted-foreground">Ponderados no ano</span><span className="font-semibold">{formatWeighted(yearDays.reduce((s, d) => s + d.weight, 0))}</span></div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-base">Jornada de trabalho</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {WEEKDAY_NAMES.map((name, wd) => {
                  const item = workSchedule.find((w) => w.weekday === wd);
                  return (
                    <div key={wd} className="flex items-center justify-between gap-2">
                      <Label className="text-sm">{name}</Label>
                      <div className="flex items-center gap-1">
                        <Input
                          key={`${wd}-${item?.hours ?? 'x'}`}
                          type="number" min={0} max={24} step={0.5}
                          defaultValue={item?.hours ?? 0}
                          onBlur={(e) => {
                            const v = Number(e.target.value);
                            if (item && v !== item.hours) handleHours(wd, v);
                          }}
                          className="w-20 h-8"
                        />
                        <span className="text-xs text-muted-foreground">h</span>
                      </div>
                    </div>
                  );
                })}
                <p className="text-xs text-muted-foreground pt-2">Peso do dia = horas ÷ 8</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-base">Configurações</CardTitle></CardHeader>
              <CardContent>
                <div className="flex items-center justify-between gap-3">
                  <Label className="text-sm">Considerar pontos facultativos</Label>
                  <Switch
                    checked={considerFacultative}
                    onCheckedChange={async (v) => {
                      if (!settings) return;
                      try { await updateCalendarSettings(settings.id, v); invalidate(); }
                      catch (e: any) { toast.error(e.message || 'Erro ao salvar'); }
                    }}
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Quando desligado, feriados facultativos não alteram o peso do dia.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Dialog Feriado */}
      <Dialog open={!!holidayDialog} onOpenChange={(o) => !o && setHolidayDialog(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{holidayDialog?.id ? 'Editar feriado' : 'Adicionar feriado'}</DialogTitle></DialogHeader>
          {holidayDialog && (
            <div className="space-y-4">
              <div>
                <Label>Nome</Label>
                <Input value={holidayDialog.name || ''} onChange={(e) => setHolidayDialog({ ...holidayDialog, name: e.target.value })} />
              </div>
              <div className="flex items-center justify-between">
                <Label>Feriado móvel (baseado na Páscoa)</Label>
                <Switch checked={!!holidayDialog.is_movable} onCheckedChange={(v) => setHolidayDialog({ ...holidayDialog, is_movable: v })} />
              </div>
              {holidayDialog.is_movable ? (
                <div>
                  <Label>Regra móvel</Label>
                  <Input placeholder="easter-2 / easter+60" value={holidayDialog.movable_rule || ''} onChange={(e) => setHolidayDialog({ ...holidayDialog, movable_rule: e.target.value })} />
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <Label>Recorrente todo ano</Label>
                    <Switch checked={!!holidayDialog.is_recurring} onCheckedChange={(v) => setHolidayDialog({ ...holidayDialog, is_recurring: v })} />
                  </div>
                  {holidayDialog.is_recurring ? (
                    <div className="grid grid-cols-2 gap-3">
                      <div><Label>Dia</Label><Input type="number" min={1} max={31} value={holidayDialog.day ?? ''} onChange={(e) => setHolidayDialog({ ...holidayDialog, day: Number(e.target.value) })} /></div>
                      <div><Label>Mês</Label><Input type="number" min={1} max={12} value={holidayDialog.month ?? ''} onChange={(e) => setHolidayDialog({ ...holidayDialog, month: Number(e.target.value) })} /></div>
                    </div>
                  ) : (
                    <div><Label>Data</Label><Input type="date" value={holidayDialog.date || ''} onChange={(e) => setHolidayDialog({ ...holidayDialog, date: e.target.value })} /></div>
                  )}
                </>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Abrangência</Label>
                  <Select value={holidayDialog.scope} onValueChange={(v) => setHolidayDialog({ ...holidayDialog, scope: v as HolidayScope })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{Object.entries(SCOPE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Peso do dia</Label>
                  <Select value={String(holidayDialog.day_weight ?? 0)} onValueChange={(v) => setHolidayDialog({ ...holidayDialog, day_weight: Number(v) })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">0 — não trabalha</SelectItem>
                      <SelectItem value="0.5">0,5 — meio expediente</SelectItem>
                      <SelectItem value="1">1 — expediente normal</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label>Base legal</Label>
                <Input value={holidayDialog.legal_basis || ''} onChange={(e) => setHolidayDialog({ ...holidayDialog, legal_basis: e.target.value })} />
              </div>
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-2">
                  <Switch checked={!!holidayDialog.is_facultative} onCheckedChange={(v) => setHolidayDialog({ ...holidayDialog, is_facultative: v })} />
                  <Label>Facultativo</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={holidayDialog.is_active !== false} onCheckedChange={(v) => setHolidayDialog({ ...holidayDialog, is_active: v })} />
                  <Label>Ativo</Label>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setHolidayDialog(null)}>Cancelar</Button>
            <Button onClick={handleSaveHoliday}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Exceção */}
      <Dialog open={!!exceptionDialog} onOpenChange={(o) => !o && setExceptionDialog(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{exceptionDialog?.id ? 'Editar exceção' : 'Adicionar exceção'}</DialogTitle></DialogHeader>
          {exceptionDialog && (
            <div className="space-y-4">
              <div><Label>Data</Label><Input type="date" value={exceptionDialog.date || ''} onChange={(e) => setExceptionDialog({ ...exceptionDialog, date: e.target.value })} /></div>
              <div><Label>Descrição</Label><Input value={exceptionDialog.description || ''} onChange={(e) => setExceptionDialog({ ...exceptionDialog, description: e.target.value })} /></div>
              <div>
                <Label>Tipo</Label>
                <Select
                  value={exceptionDialog.type}
                  onValueChange={(v) => setExceptionDialog({
                    ...exceptionDialog,
                    type: v as CalendarException['type'],
                    day_weight: v === 'folga' ? 0 : v === 'meio_expediente' ? 0.5 : 1,
                  })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(EXCEPTION_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Peso do dia</Label>
                <Select value={String(exceptionDialog.day_weight ?? 0)} onValueChange={(v) => setExceptionDialog({ ...exceptionDialog, day_weight: Number(v) })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">0 — não trabalha</SelectItem>
                    <SelectItem value="0.5">0,5 — meio expediente</SelectItem>
                    <SelectItem value="1">1 — expediente normal</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setExceptionDialog(null)}>Cancelar</Button>
            <Button onClick={handleSaveException}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover "{deleting?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>Essa ação não pode ser desfeita e afeta o cálculo de dias úteis.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={(e) => { e.preventDefault(); handleDelete(); }}>Remover</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Layout>
  );
};

export default Calendario;
