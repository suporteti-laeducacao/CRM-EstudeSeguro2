import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { CalendarPlus, CheckCircle2, Copy, ExternalLink, MessageCircle, MoreVertical, Phone, PhoneCall, Reply } from 'lucide-react';
import type { CobrancaItem } from '@/hooks/useCobrancas';

export const fmtData = (iso?: string | null) => (iso ? iso.slice(0, 10).split('-').reverse().join('/') : '—');
export const MEDIDA_LABEL: Record<string, string> = { inativacao: 'INATIVAÇÃO PENDENTE', aviso_negativacao: 'AVISO DE POSSÍVEL NEGATIVAÇÃO', negativacao: 'NEGATIVAÇÃO PENDENTE' };
export const fmtMoeda = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export const badgesDe = (c: CobrancaItem) => {
  const b: { label: string; tone: 'warn' | 'danger' | 'info' | 'muted' }[] = [];
  if (c.carteiraInicial) b.push({ label: 'Carteira inicial', tone: 'muted' });
  if (c.promessaAtiva) b.push({ label: c.promessaParcial ? 'Promessa parcialmente cumprida' : 'Promessa ativa', tone: 'info' });
  if (c.aguardandoRetorno) b.push({ label: 'Aguardando retorno', tone: 'muted' });
  if (c.promessaNaoCumprida) b.push({ label: 'Promessa não cumprida', tone: 'danger' });
  if (c.renegociacaoAtiva) b.push({ label: 'Renegociação', tone: 'info' });
  for (const a of c.acoes) {
    if (a.tipo === 'inativacao' && a.status === 'pendente') b.push({ label: 'Inativação pendente', tone: 'warn' });
    if (a.tipo === 'inativacao' && a.status === 'confirmada') b.push({ label: 'Plataforma inativada', tone: 'danger' });
    if (a.tipo === 'aviso_negativacao' && ['pendente', 'confirmada'].includes(a.status)) b.push({ label: 'Aviso de possível negativação', tone: 'warn' });
    if (a.tipo === 'negativacao' && a.status === 'pendente') b.push({ label: 'Negativação pendente', tone: 'warn' });
    if (a.tipo === 'negativacao' && a.status === 'confirmada') b.push({ label: 'Negativado', tone: 'danger' });
  }
  if (c.situacao === 'ativa' && !c.proximaAcaoEm) b.push({ label: 'Sem agendamento', tone: 'muted' });
  return b;
};

const toneCls = {
  warn: 'bg-warning/15 text-ink-900 border-warning/40',
  danger: 'bg-destructive/10 text-destructive border-destructive/30',
  info: 'bg-brand-tint text-ink-900 border-brand/40',
  muted: 'bg-ink-100 text-ink-700 border-ink-200',
};

interface Props {
  cobranca: CobrancaItem;
  onAbrir: (c: CobrancaItem) => void;
  onRegistrar: (c: CobrancaItem, tipo: 'cobranca' | 'retorno') => void;
  onAgendar: (c: CobrancaItem) => void;
  onResolver: (c: CobrancaItem, modo: 'promessa' | 'renegociacao') => void;
  onMedida?: (c: CobrancaItem, tipo: string) => void;
  onPagar?: (c: CobrancaItem) => void;
  hoje: string;
}

const Info = ({ label, value, danger }: { label: string; value: React.ReactNode; danger?: boolean }) => (
  <div className="min-w-0">
    <p className="text-[11.5px] text-ink-500">{label}</p>
    <p className={`text-[13.5px] font-medium tabular-nums truncate ${danger ? 'text-destructive' : 'text-ink-900'}`}>{value}</p>
  </div>
);

export const fmtTelefone = (t?: string | null) => {
  if (!t) return null;
  const d = t.replace(/\D/g, '');
  const n = d.startsWith('55') ? d.slice(2) : d;
  if (n.length === 11) return `(${n.slice(0, 2)}) ${n.slice(2, 7)}-${n.slice(7)}`;
  if (n.length === 10) return `(${n.slice(0, 2)}) ${n.slice(2, 6)}-${n.slice(6)}`;
  return t;
};

const CobrancaCard = ({ cobranca: c, onAbrir, onRegistrar, onAgendar, onResolver, onMedida, onPagar, hoje }: Props) => {
  const navigate = useNavigate();
  const ativa = c.situacao === 'ativa';
  const tel = c.telefone?.replace(/\D/g, '');
  const telBR = tel ? (tel.startsWith('55') ? tel : `55${tel}`) : null;
  const abrirFinanceiro = () => navigate(`/financeiro?busca=${encodeURIComponent(c.alunoNome)}`);

  const dias = (a: string, b: string) => Math.round((Date.parse(a) - Date.parse(b)) / 86400000);
  const pData = c.promessaAtiva?.data;
  const rFim = !c.promessaAtiva ? c.renegociacao?.suspensaAte : null;
  const destaque = ativa && pData && pData <= hoje
    ? { modo: 'promessa' as const, titulo: pData === hoje ? 'PROMESSA DE PAGAMENTO VENCE HOJE' : `Promessa vencida há ${dias(hoje, pData)} dia(s)`, atrasada: pData < hoje }
    : ativa && rFim && rFim <= hoje
      ? { modo: 'renegociacao' as const, titulo: rFim === hoje ? 'RENEGOCIAÇÃO TERMINA HOJE' : `Renegociação encerrada há ${dias(hoje, rFim)} dia(s)`, atrasada: rFim < hoje }
      : null;

  return (
    <Card className="rounded-[14px] border-ink-200 shadow-card cursor-pointer hover:border-ink-300 transition-colors" onClick={() => onAbrir(c)}>
      <CardContent className="p-4 space-y-3">
        {ativa && onMedida && c.acoes.filter((a) => a.status === 'pendente').map((a) => {
          const atras = !!a.dataPrevista && a.dataPrevista < hoje;
          return (
            <div key={a.tipo} className={`flex flex-wrap items-center justify-between gap-2 rounded-[10px] border px-3 py-2 ${atras ? 'border-destructive/30 bg-destructive/10' : 'border-warning/40 bg-warning/15'}`} onClick={(e) => e.stopPropagation()}>
              <div className="text-[12.5px]">
                <p className={`font-bold ${atras ? 'text-destructive' : 'text-ink-950'}`}>{MEDIDA_LABEL[a.tipo] || a.tipo}</p>
                <p className="text-ink-600">Aguardando confirmação manual · previsto para {fmtData(a.dataPrevista)}</p>
              </div>
              <Button size="sm" variant="outline" onClick={() => onMedida(c, a.tipo)}>Tratar</Button>
            </div>
          );
        })}
        {destaque && (
          <div className={`flex flex-wrap items-center justify-between gap-2 rounded-[10px] border px-3 py-2 ${destaque.atrasada ? 'border-destructive/30 bg-destructive/10' : 'border-brand/40 bg-brand-tint'}`} onClick={(e) => e.stopPropagation()}>
            <div className="text-[12.5px]">
              <p className={`font-bold ${destaque.atrasada ? 'text-destructive' : 'text-ink-950'}`}>{destaque.titulo}</p>
              {destaque.modo === 'promessa' && c.promessaAtiva && (
                <p className="text-ink-600">Criada em {fmtData(c.promessaAtiva.criadaEm)} · prometida para {fmtData(c.promessaAtiva.data)}{c.promessaAtiva.valor != null ? ` · ${fmtMoeda(Number(c.promessaAtiva.valor))}` : ''}{c.promessaAtiva.observacao ? ` · ${c.promessaAtiva.observacao}` : ''}</p>
              )}
              {destaque.modo === 'renegociacao' && c.renegociacao && (
                <p className="text-ink-600">Início {fmtData(c.renegociacao.inicio)} · suspensa até {fmtData(c.renegociacao.suspensaAte)}{c.renegociacao.observacao ? ` · ${c.renegociacao.observacao}` : ''}</p>
              )}
            </div>
            <Button size="sm" variant="outline" onClick={() => onResolver(c, destaque.modo)}>Resolver</Button>
          </div>
        )}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-semibold text-ink-950 truncate">{c.alunoNome}</p>
            <p className="text-[12.5px] text-ink-500 truncate">{c.curso} · Matrícula {fmtData(c.saleDate)}</p>
            {c.telefone && (
              <a
                href={telBR ? `https://wa.me/${telBR}` : `tel:${tel}`}
                target="_blank"
                rel="noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="inline-flex items-center gap-1 text-[12.5px] font-medium text-ink-600 hover:text-brand-600"
              >
                <Phone className="h-3.5 w-3.5" /> {fmtTelefone(c.telefone)}
              </a>
            )}
          </div>
          <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
            {ativa && !c.promessaAtiva && !c.renegociacao && (
              <Button size="sm" onClick={() => onRegistrar(c, 'cobranca')}>
                <PhoneCall className="h-4 w-4 mr-1" /> Registrar cobrança
              </Button>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="icon" variant="ghost" aria-label="Mais ações"><MoreVertical className="h-4 w-4" /></Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {telBR && (
                  <DropdownMenuItem onClick={() => window.open(`https://wa.me/${telBR}`, '_blank')}>
                    <MessageCircle className="h-4 w-4 mr-2" /> WhatsApp
                  </DropdownMenuItem>
                )}
                {tel && (
                  <DropdownMenuItem onClick={() => (window.location.href = `tel:${tel}`)}>
                    <Phone className="h-4 w-4 mr-2" /> Ligar
                  </DropdownMenuItem>
                )}
                {c.email && (
                  <DropdownMenuItem onClick={() => { navigator.clipboard.writeText(c.email!); toast.success('E-mail copiado'); }}>
                    <Copy className="h-4 w-4 mr-2" /> Copiar e-mail
                  </DropdownMenuItem>
                )}
                {ativa && (
                  <DropdownMenuItem onClick={() => onRegistrar(c, 'retorno')}>
                    <Reply className="h-4 w-4 mr-2" /> Registrar retorno
                  </DropdownMenuItem>
                )}
                {ativa && c.promessaAtiva && (
                  <DropdownMenuItem onClick={() => onResolver(c, 'promessa')}>
                    <CheckCircle2 className="h-4 w-4 mr-2" /> Resolver promessa
                  </DropdownMenuItem>
                )}
                {ativa && c.renegociacao && !c.promessaAtiva && (
                  <DropdownMenuItem onClick={() => onResolver(c, 'renegociacao')}>
                    <CheckCircle2 className="h-4 w-4 mr-2" /> Resolver renegociação
                  </DropdownMenuItem>
                )}
                {ativa && (
                  <DropdownMenuItem onClick={() => onAgendar(c)}>
                    <CalendarPlus className="h-4 w-4 mr-2" /> Agendar nova cobrança
                  </DropdownMenuItem>
                )}
                {ativa && c.parcelasAbertas > 0 && (
                  <DropdownMenuItem onClick={() => (onPagar ? onPagar(c) : abrirFinanceiro())}>
                    <CheckCircle2 className="h-4 w-4 mr-2" /> Marcar como Pago
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={abrirFinanceiro}>
                  <ExternalLink className="h-4 w-4 mr-2" /> Abrir Financeiro
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <div className="grid gap-3 grid-cols-1 sm:grid-cols-3">
          <div className={`rounded-[10px] border px-3 py-2 ${c.parcelasVencidas > 0 ? 'border-destructive/30 bg-destructive/5' : 'border-ink-200'}`}>
            <p className="text-[11.5px] font-semibold uppercase tracking-wide text-ink-500">Em atraso</p>
            <p className={`text-[17px] font-bold tabular-nums ${c.parcelasVencidas > 0 ? 'text-destructive' : 'text-ink-900'}`}>{fmtMoeda(c.valorAtraso)}</p>
            <p className={`text-[12.5px] font-medium ${c.parcelasVencidas > 0 ? 'text-destructive' : 'text-ink-500'}`}>{c.parcelasVencidas} parcela{c.parcelasVencidas === 1 ? '' : 's'} vencida{c.parcelasVencidas === 1 ? '' : 's'}</p>
          </div>
          <div className="rounded-[10px] border border-ink-200 px-3 py-2">
            <p className="text-[11.5px] font-semibold uppercase tracking-wide text-ink-500">A vencer</p>
            <p className="text-[15px] font-semibold tabular-nums text-ink-900">{fmtMoeda(c.valorAVencer)}</p>
            <p className="text-[12.5px] text-ink-500">{c.parcelasAVencer} parcela{c.parcelasAVencer === 1 ? '' : 's'}</p>
          </div>
          <div className="rounded-[10px] border border-ink-200 px-3 py-2">
            <p className="text-[11.5px] font-semibold uppercase tracking-wide text-ink-500">Total em aberto</p>
            <p className="text-[15px] font-semibold tabular-nums text-ink-900">{fmtMoeda(c.totalAberto)}</p>
            <p className="text-[12.5px] text-ink-500">{c.parcelasAbertas} parcela{c.parcelasAbertas === 1 ? '' : 's'} em aberto</p>
          </div>
        </div>

        <div className="grid gap-3 grid-cols-2 md:grid-cols-3 xl:grid-cols-6">
          {c.parcelaVencimento && c.parcelaVencimento >= hoje && c.parcelasVencidas === 0
            ? <Info label="Próxima parcela" value={`${c.parcelaNumero ?? '—'}ª · ${fmtData(c.parcelaVencimento)}`} />
            : <Info label="Vencida mais antiga" value={c.vencidaMaisAntiga ? `${c.vencidaMaisAntigaNumero ?? '—'}ª · ${fmtData(c.vencidaMaisAntiga)}` : '—'} />}
          <Info label="Maior atraso" value={c.maiorAtraso > 0 ? `${c.maiorAtraso} dias` : '—'} danger={c.maiorAtraso > 0} />
          <Info label="Etapa atual" value={c.etapaCodigo || c.proximaEtapaCodigo || '—'} />
          <Info label="Próxima ação" value={!c.proximaAcaoEm ? '—'
            : c.proximaAcaoTipo === 'regua' && c.proximaAcaoEm < hoje ? `${c.etapaCodigo || 'Etapa'} — atrasada há ${dias(hoje, c.proximaAcaoEm)} dia(s)`
            : `${fmtData(c.proximaAcaoEm)}${c.proximaAcaoTipo ? ` · ${c.proximaAcaoTipo}` : ''}`} />
          <Info label="Última cobrança" value={fmtData(c.ultimaAcaoEm)} />
          <Info label="Responsável" value={c.responsavelNome} />
        </div>

        {badgesDe(c).length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {badgesDe(c).map((b) => (
              <Badge key={b.label} variant="outline" className={`text-[11.5px] font-medium ${toneCls[b.tone]}`}>{b.label}</Badge>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default CobrancaCard;
