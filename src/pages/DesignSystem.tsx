import { useState } from 'react';
import Layout from '@/components/Layout';
import PageHeader from '@/components/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import MetricCard from '@/components/dashboard/MetricCard';
import { DollarSign } from 'lucide-react';
import { toast } from 'sonner';
import { LEAD_STATUS_CONFIG } from '@/lib/leads-types';
import { PRIORIDADE_CLASSES } from '@/lib/acompanhamento';
import { STATUS_BADGE_CLASS } from '@/lib/certificacoes-storage';
import { cn } from '@/lib/utils';

/* ---------- WCAG contrast ---------- */
const srgb = (c: number) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));

const luminance = (hex: string) => {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const r = parseInt(full.slice(0, 2), 16) / 255;
  const g = parseInt(full.slice(2, 4), 16) / 255;
  const b = parseInt(full.slice(4, 6), 16) / 255;
  return 0.2126 * srgb(r) + 0.7152 * srgb(g) + 0.0722 * srgb(b);
};

const contrast = (fg: string, bg: string) => {
  const l1 = luminance(fg);
  const l2 = luminance(bg);
  const [hi, lo] = l1 > l2 ? [l1, l2] : [l2, l1];
  return (hi + 0.05) / (lo + 0.05);
};

const selo = (ratio: number) => {
  if (ratio >= 7) return { label: 'AAA', className: 'bg-[#E7F7F0] text-[#07714E]' };
  if (ratio >= 4.5) return { label: 'AA', className: 'bg-[#FFF1E7] text-[#B44309]' };
  return { label: 'Reprovado', className: 'bg-[#FDECEC] text-[#B02121]' };
};

/* ---------- Tokens ---------- */
const BRAND = [
  { name: 'brand-400', hex: '#FEE600' },
  { name: 'brand-500', hex: '#FED106' },
  { name: 'brand-600', hex: '#E5BC00' },
  { name: 'brand-700', hex: '#C79F00' },
  { name: 'brand-ink', hex: '#7A6100' },
  { name: 'brand-tint', hex: '#FFFBEA' },
  { name: 'brand-tint2', hex: '#FFF3C4' },
];

const INK = [
  { name: 'ink-950', hex: '#0C0C0D' },
  { name: 'ink-900', hex: '#141416' },
  { name: 'ink-800', hex: '#1E1E21' },
  { name: 'ink-700', hex: '#2B2B30' },
  { name: 'ink-600', hex: '#4A4A52' },
  { name: 'ink-500', hex: '#6B6B73' },
  { name: 'ink-400', hex: '#9A9AA3' },
  { name: 'ink-300', hex: '#C9C9CF' },
  { name: 'ink-200', hex: '#E4E4E8' },
  { name: 'ink-100', hex: '#F1F1F4' },
  { name: 'ink-50', hex: '#F8F8FA' },
  { name: 'branco', hex: '#FFFFFF' },
];

const SEMANTICOS = [
  { name: 'success', hex: '#0E9F6E' },
  { name: 'success chip', hex: '#E7F7F0' },
  { name: 'success texto', hex: '#07714E' },
  { name: 'warning', hex: '#EA580C' },
  { name: 'warning chip', hex: '#FFF1E7' },
  { name: 'warning texto', hex: '#B44309' },
  { name: 'destructive', hex: '#DC2626' },
  { name: 'destructive chip', hex: '#FDECEC' },
  { name: 'destructive texto', hex: '#B02121' },
];

const PARES = [
  { fg: '#141416', bg: '#FFFFFF', label: 'ink-900 sobre branco' },
  { fg: '#6B6B73', bg: '#FFFFFF', label: 'ink-500 sobre branco' },
  { fg: '#0C0C0D', bg: '#FED106', label: 'ink-950 sobre brand-500' },
  { fg: '#FFFFFF', bg: '#FED106', label: 'branco sobre brand-500' },
  { fg: '#FED106', bg: '#FFFFFF', label: 'brand-500 sobre branco' },
  { fg: '#7A6100', bg: '#FFFFFF', label: 'brand-ink sobre branco' },
  { fg: '#FED106', bg: '#0C0C0D', label: 'brand-500 sobre ink-950' },
  { fg: '#FFFFFF', bg: '#0C0C0D', label: 'branco sobre ink-950' },
];

const TIPOGRAFIA = [
  { papel: 'Título de página', fonte: 'Archivo', peso: '700', tamanho: '30px', entrelinha: '36px', className: 'font-display text-[30px] leading-9 font-bold' },
  { papel: 'Título de seção', fonte: 'Archivo', peso: '600', tamanho: '22px', entrelinha: '28px', className: 'font-display text-[22px] leading-7 font-semibold' },
  { papel: 'Número grande', fonte: 'Archivo', peso: '800', tamanho: '34px', entrelinha: '36px', className: 'font-display text-[34px] leading-9 font-extrabold tabular-nums' },
  { papel: 'Corpo', fonte: 'Public Sans', peso: '400', tamanho: '14.5px', entrelinha: '22px', className: 'text-[14.5px] leading-[22px]' },
  { papel: 'Rótulo', fonte: 'Public Sans', peso: '500', tamanho: '13px', entrelinha: '18px', className: 'text-[13px] leading-[18px] font-medium' },
  { papel: 'Auxiliar', fonte: 'Public Sans', peso: '400', tamanho: '12.5px', entrelinha: '16px', className: 'text-[12.5px] leading-4 text-ink-500' },
];

const ARQUIVOS_REDESIGN = [
  'index.html', 'src/index.css', 'tailwind.config.ts',
  'src/components/ui/ (button, input, textarea, select, checkbox, radio-group, switch, badge, card, table, dialog, alert-dialog, sheet, drawer, dropdown-menu, context-menu, command, tooltip, toast, sonner, tabs, progress, avatar, skeleton, calendar, pagination, navigation-menu, chart)',
  'src/components/Layout.tsx', 'src/components/PageHeader.tsx', 'src/components/NavLink.tsx',
  'src/components/PayablesAlertDialog.tsx', 'src/components/AcompanhamentoAlertDialog.tsx',
  'src/pages/Index.tsx', 'src/pages/Sales.tsx', 'src/pages/Financial.tsx', 'src/pages/Students.tsx',
  'src/pages/Negocios.tsx', 'src/pages/Leads.tsx', 'src/pages/Ranking.tsx', 'src/pages/AcompanhamentoMetas.tsx',
  'src/pages/Metas.tsx', 'src/pages/Reports.tsx', 'src/pages/Certificacao.tsx', 'src/pages/Acompanhamento.tsx',
  'src/pages/Auth.tsx', 'src/pages/NotFound.tsx', 'src/pages/UserManagement.tsx', 'src/pages/Cursos.tsx',
  'src/pages/GruposRepasse.tsx', 'src/pages/Calendario.tsx', 'src/pages/RankingAudit.tsx', 'src/pages/SystemLogs.tsx',
  'src/pages/Settings.tsx',
  'src/components/dashboard/ (MetricCard, SalesChart, RecentSales, MetaGeralWidget)',
  'src/components/financial/ (ReceivablesTab, ReceivedTab, OverdueTab, LockedTab, CashFlowTab, ConfirmPaymentDialog, InstallmentTimeline, payables/*)',
  'src/components/leads/ (KanbanColumn, LeadCard, LeadsToolbar, LeadDetailDialog)',
  'src/components/ranking/ (RankingPodium, RankingTable, RankingMetrics, DualProgress, DailyGoalCards, DailyGoalTable, GoalDiagnosticsDialog)',
  'src/components/reports/ (Reports tabs, FinancialReportPreview, MetaReportTab, MonthlyClosingReport)',
  'src/components/sales/ (CancelSaleDialog, DeleteSaleDialog, LockEnrollmentDialog, RecalculateInstallmentsDialog)',
  'src/components/certificacao/ (CertificacaoKPIs, CertificacaoDiagnostics, StudentCombobox)',
  'src/components/acompanhamento/ (AlertaCard, RegistrarContatoDialog)',
  'src/components/settings/ (CursosManagement, CustoOperacionalCategorias)',
  'src/lib/leads-types.ts (só cores)', 'src/lib/acompanhamento.ts (só cores)', 'src/lib/certificacoes-storage.ts (só cores)',
  'src/pages/DesignSystem.tsx (novo)', 'src/App.tsx (rota /design-system)',
];

const Swatch = ({ name, hex }: { name: string; hex: string }) => (
  <div className="space-y-1">
    <div className="h-[72px] w-[72px] rounded-[10px] border border-ink-200" style={{ backgroundColor: hex }} />
    <p className="text-[12.5px] font-medium text-ink-800">{name}</p>
    <p className="text-[12px] text-ink-500 tabular-nums">{hex}</p>
  </div>
);

const Secao = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <Card className="rounded-[14px] border-ink-200 shadow-card">
    <CardHeader>
      <CardTitle className="font-display text-[22px] leading-7 text-ink-950">{title}</CardTitle>
    </CardHeader>
    <CardContent className="space-y-5">{children}</CardContent>
  </Card>
);

const DesignSystem = () => {
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <Layout>
      <div className="space-y-6">
        <PageHeader
          title="Design System"
          subtitle="Referência visual dos tokens, componentes e mapas de status do sistema"
          className="mb-0"
        />

        <Secao title="Cores">
          <div>
            <p className="text-[13px] font-medium text-ink-600 mb-3">Marca</p>
            <div className="flex flex-wrap gap-4">
              {BRAND.map((c) => <Swatch key={c.name} {...c} />)}
            </div>
          </div>
          <div>
            <p className="text-[13px] font-medium text-ink-600 mb-3">Neutros</p>
            <div className="flex flex-wrap gap-4">
              {INK.map((c) => <Swatch key={c.name} {...c} />)}
            </div>
          </div>
          <div>
            <p className="text-[13px] font-medium text-ink-600 mb-3">Semânticos</p>
            <div className="flex flex-wrap gap-4">
              {SEMANTICOS.map((c) => <Swatch key={c.name} {...c} />)}
            </div>
          </div>
        </Secao>

        <Secao title="Contraste (WCAG 2.1)">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Par</TableHead>
                <TableHead>Amostra</TableHead>
                <TableHead className="text-right">Razão</TableHead>
                <TableHead>Selo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {PARES.map((p) => {
                const ratio = contrast(p.fg, p.bg);
                const s = selo(ratio);
                return (
                  <TableRow key={p.label}>
                    <TableCell className="font-medium">{p.label}</TableCell>
                    <TableCell>
                      <span
                        className="inline-flex items-center rounded-[10px] border border-ink-200 px-3 py-1 text-[13px]"
                        style={{ color: p.fg, backgroundColor: p.bg }}
                      >
                        Texto exemplo
                      </span>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{ratio.toFixed(2).replace('.', ',')}:1</TableCell>
                    <TableCell>
                      <Badge className={cn('border-transparent', s.className)}>{s.label}</Badge>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Secao>

        <Secao title="Tipografia">
          <div className="space-y-5">
            {TIPOGRAFIA.map((t) => (
              <div key={t.papel} className="border-b border-ink-100 pb-4 last:border-0 last:pb-0">
                <p className={t.className}>{t.papel} — Exemplo 1.234,56</p>
                <p className="text-[12.5px] text-ink-500 mt-1 tabular-nums">
                  {t.fonte} · peso {t.peso} · {t.tamanho} / {t.entrelinha}
                </p>
              </div>
            ))}
          </div>
        </Secao>

        <Secao title="Componentes">
          <div>
            <p className="text-[13px] font-medium text-ink-600 mb-3">Botões</p>
            <div className="space-y-3">
              {(['default', 'secondary', 'outline', 'ghost', 'link', 'destructive'] as const).map((v) => (
                <div key={v} className="flex flex-wrap items-center gap-3">
                  <span className="w-24 text-[12.5px] text-ink-500">{v}</span>
                  <Button variant={v} size="sm">Pequeno</Button>
                  <Button variant={v} size="default">Padrão</Button>
                  <Button variant={v} size="lg">Grande</Button>
                  <Button variant={v} size="icon" aria-label={`Ícone ${v}`}>
                    <DollarSign className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-1.5">
              <Label>Campo normal</Label>
              <Input placeholder="Digite algo" />
            </div>
            <div className="space-y-1.5">
              <Label>Campo em foco</Label>
              <Input placeholder="Digite algo" className="ring-2 ring-ink-900 ring-offset-2" />
            </div>
            <div className="space-y-1.5">
              <Label>Campo com erro</Label>
              <Input placeholder="Digite algo" className="border-destructive" />
              <p className="text-[12.5px] text-destructive">Campo obrigatório</p>
            </div>
            <div className="space-y-1.5">
              <Label>Campo desabilitado</Label>
              <Input placeholder="Indisponível" disabled />
            </div>
          </div>

          <div>
            <p className="text-[13px] font-medium text-ink-600 mb-3">Chips</p>
            <div className="flex flex-wrap gap-2">
              <Badge className="bg-[#E7F7F0] text-[#07714E] border-transparent">Sucesso</Badge>
              <Badge className="bg-[#FFF1E7] text-[#B44309] border-transparent">Atenção</Badge>
              <Badge className="bg-[#FDECEC] text-[#B02121] border-transparent">Erro</Badge>
              <Badge className="bg-[#F1F1F4] text-[#2B2B30] border-transparent">Neutro</Badge>
              <Badge className="bg-brand-tint text-brand-ink border-transparent">Marca</Badge>
            </div>
          </div>

          <div>
            <p className="text-[13px] font-medium text-ink-600 mb-3">Linhas de tabela</p>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Estado</TableHead>
                  <TableHead>Aluno</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell>Normal</TableCell>
                  <TableCell>Maria Souza</TableCell>
                  <TableCell className="text-right tabular-nums">R$ 1.200,00</TableCell>
                </TableRow>
                <TableRow className="bg-ink-50">
                  <TableCell>Hover</TableCell>
                  <TableCell>João Lima</TableCell>
                  <TableCell className="text-right tabular-nums">R$ 980,00</TableCell>
                </TableRow>
                <TableRow className="bg-brand-tint">
                  <TableCell>Selecionada</TableCell>
                  <TableCell>Ana Dias</TableCell>
                  <TableCell className="text-right tabular-nums">R$ 2.450,00</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <MetricCard title="Total a Receber" value="R$ 128.400,00" icon={DollarSign} />
            <MetricCard title="Meta do mês" value="R$ 90.000,00" icon={DollarSign} highlight subtitle="12 vendas" />
          </div>

          <div className="space-y-3 max-w-md">
            <div>
              <p className="text-[12.5px] text-ink-500 mb-1 tabular-nums">Abaixo de 100% — 64%</p>
              <Progress value={64} />
            </div>
            <div>
              <p className="text-[12.5px] text-ink-500 mb-1 tabular-nums">Acima de 100% — 118%</p>
              <Progress value={100} className="[&>div]:bg-brand" />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Dialog open={modalOpen} onOpenChange={setModalOpen}>
              <DialogTrigger asChild>
                <Button variant="outline">Abrir modal</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Exemplo de modal</DialogTitle>
                  <DialogDescription>
                    Raio de 18px, sombra pop e transição de 200ms.
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setModalOpen(false)}>Cancelar</Button>
                  <Button onClick={() => setModalOpen(false)}>Confirmar</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            <Button variant="outline" onClick={() => toast.success('Exemplo de toast')}>Mostrar toast</Button>
          </div>

          <div className="space-y-2 max-w-md">
            <p className="text-[13px] font-medium text-ink-600">Skeleton</p>
            <Skeleton className="h-5 w-2/3" />
            <Skeleton className="h-5 w-1/2" />
            <Skeleton className="h-24 w-full" />
          </div>

          <div>
            <p className="text-[13px] font-medium text-ink-600 mb-3">Avatares</p>
            <div className="flex items-center gap-3">
              {['MS', 'JL', 'AD'].map((i) => (
                <Avatar key={i} className="h-9 w-9">
                  <AvatarFallback className="bg-ink-950 text-brand text-[12.5px]">{i}</AvatarFallback>
                </Avatar>
              ))}
            </div>
          </div>
        </Secao>

        <Secao title="Mapas de status do sistema">
          <div className="grid gap-6 lg:grid-cols-3">
            <div>
              <p className="text-[13px] font-medium text-ink-600 mb-3">LEAD_STATUS_CONFIG</p>
              <div className="space-y-2">
                {Object.entries(LEAD_STATUS_CONFIG).map(([key, cfg]) => (
                  <div key={key} className="flex items-center justify-between gap-3">
                    <span className="text-[12.5px] text-ink-500">{key}</span>
                    <span className={cn('rounded-full px-2.5 py-0.5 text-[12.5px] font-medium', cfg.color, cfg.bgColor)}>
                      {cfg.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <p className="text-[13px] font-medium text-ink-600 mb-3">PRIORIDADE_CLASSES</p>
              <div className="space-y-2">
                {Object.entries(PRIORIDADE_CLASSES).map(([key, cfg]) => (
                  <div key={key} className="flex items-center justify-between gap-3">
                    <span className="text-[12.5px] text-ink-500">{key}</span>
                    <span className={cn('rounded-full px-2.5 py-0.5 text-[12.5px] font-medium', cfg.badge)}>{key}</span>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <p className="text-[13px] font-medium text-ink-600 mb-3">STATUS_BADGE_CLASS</p>
              <div className="space-y-2">
                {Object.entries(STATUS_BADGE_CLASS).map(([key, cls]) => (
                  <div key={key} className="flex items-center justify-between gap-3">
                    <span className="text-[12.5px] text-ink-500">{key}</span>
                    <span className={cn('rounded-full px-2.5 py-0.5 text-[12.5px] font-medium', cls)}>{key}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Secao>

        <Secao title="Auditoria do redesign">
          <ul className="space-y-1.5 text-[13px] text-ink-700">
            {ARQUIVOS_REDESIGN.map((f) => (
              <li key={f} className="border-b border-ink-100 pb-1.5 last:border-0">{f}</li>
            ))}
          </ul>
        </Secao>
      </div>
    </Layout>
  );
};

export default DesignSystem;
