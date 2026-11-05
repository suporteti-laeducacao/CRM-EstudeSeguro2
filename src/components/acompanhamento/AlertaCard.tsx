import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MessageCircle, Phone, Mail, HeartHandshake, CalendarClock } from 'lucide-react';
import {
  AlertaAcompanhamento,
  MARCOS_ORDEM,
  PRIORIDADE_CLASSES,
  PRIORIDADE_LABELS,
  RESULTADO_LABELS,
  ResultadoContato,
  seloDe,
} from '@/lib/acompanhamento';

const fmt = (iso?: string | null) => (iso ? iso.split('-').reverse().join('/') : '—');
const digits = (v?: string | null) => (v || '').replace(/\D/g, '');

interface Props {
  alerta: AlertaAcompanhamento;
  onRegistrar: (a: AlertaAcompanhamento) => void;
}

const AlertaCard = ({ alerta, onRegistrar }: Props) => {
  const cls = alerta.prioridade ? PRIORIDADE_CLASSES[alerta.prioridade] : null;
  const tel = digits(alerta.telefone);

  return (
    <Card
      className={`overflow-hidden rounded-[12px] border-ink-200 shadow-card transition-colors hover:border-ink-300 ${alerta.acompanhamentoEspecial ? 'border-2 border-ink-300' : ''}`}
    >
      <div className="flex">
        <div className={`w-1.5 shrink-0 ${cls?.bar || 'bg-muted'}`} />
        <CardContent className="p-4 flex-1 space-y-3">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-[14.5px] font-semibold text-ink-950 truncate">{alerta.alunoNome}</p>
              <p className="text-[13px] text-ink-600 truncate">
                {alerta.curso}
                {alerta.nivel ? ` · ${alerta.nivel}` : ''}
              </p>
              <p className="text-[12.5px] text-ink-500">
                Vendedor: {alerta.vendedorNome || 'Sem responsável'}
              </p>
            </div>
            <div className="flex flex-col items-end gap-1">
              {alerta.cancelado && (
                <Badge variant="outline" className="text-destructive border-destructive">
                  Cancelado
                </Badge>
              )}
              {!alerta.cancelado && alerta.prioridade && (
                <Badge className={cls?.badge}>{PRIORIDADE_LABELS[alerta.prioridade]}</Badge>
              )}
              {alerta.acompanhamentoEspecial && (
                <Badge variant="outline" className="bg-ink-100 text-ink-700 border-transparent">
                  <HeartHandshake className="h-3 w-3 mr-1" /> Acompanhamento especial
                </Badge>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`text-sm font-bold px-2 py-1 rounded ${cls?.badge || 'bg-muted text-muted-foreground'}`}
            >
              {seloDe(alerta.diasRestantes)}
            </span>
            <span className="text-[12.5px] text-ink-500 tabular-nums">
              Previsão: <strong className="text-foreground">{fmt(alerta.previsaoConclusao)}</strong>
            </span>
            {alerta.adiadoAte && (
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <CalendarClock className="h-3 w-3" /> Agendado para {fmt(alerta.adiadoAte)}
              </span>
            )}
          </div>

          <div className="flex flex-wrap gap-1">
            {MARCOS_ORDEM.map((m) => {
              const feito = alerta.marcosContatados.includes(m);
              const atual = alerta.marcoAtual === m;
              return (
                <span
                  key={m}
                  className={`text-[11px] px-2 py-0.5 rounded-full border ${
                    feito
                      ? 'bg-[#E7F7F0] text-[#07714E] border-[#BFE7D6]'
                      : atual
                        ? 'bg-primary text-primary-foreground border-primary animate-pulse'
                        : 'bg-muted text-muted-foreground border-transparent'
                  }`}
                >
                  {m}
                </span>
              );
            })}
            {alerta.marcoAtual === 'VENCIDO' && (
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-[#7F1D1D] text-white animate-pulse">
                VENCIDO
              </span>
            )}
          </div>

          {alerta.contatos.length > 0 && (
            <div className="rounded-md bg-muted/40 p-2 space-y-1">
              {alerta.contatos.slice(0, 3).map((c) => (
                <p key={c.id} className="text-xs text-muted-foreground">
                  <strong className="text-foreground">{fmt(c.data_contato)}</strong> · {c.marco} ·{' '}
                  {RESULTADO_LABELS[c.resultado as ResultadoContato] || c.resultado}
                  {c.observacao ? ` — ${c.observacao}` : ''}
                </p>
              ))}
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            {tel && (
              <>
                <Button variant="outline" size="sm" asChild>
                  <a href={`https://wa.me/55${tel}`} target="_blank" rel="noreferrer">
                    <MessageCircle className="h-4 w-4 mr-1" /> WhatsApp
                  </a>
                </Button>
                <Button variant="outline" size="sm" asChild>
                  <a href={`tel:+55${tel}`}>
                    <Phone className="h-4 w-4 mr-1" /> Ligar
                  </a>
                </Button>
              </>
            )}
            {alerta.email && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigator.clipboard.writeText(alerta.email as string)}
              >
                <Mail className="h-4 w-4 mr-1" /> Copiar e-mail
              </Button>
            )}
            {!alerta.cancelado && (
              <Button size="sm" onClick={() => onRegistrar(alerta)}>
                Registrar contato
              </Button>
            )}
          </div>
        </CardContent>
      </div>
    </Card>
  );
};

export default AlertaCard;
