import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Bot, User } from 'lucide-react';
import { agendarManual, getHistoricoCobranca, registrarInteracao, CanalCobranca } from '@/lib/cobrancas-storage';
import type { CobrancaItem } from '@/hooks/useCobrancas';
import { fmtMoeda } from './CobrancaCard';

export const CANAIS: Record<string, string> = {
  whatsapp: 'WhatsApp', phone: 'Ligação', email: 'E-mail', sms: 'SMS', presencial: 'Presencial', outro: 'Outro', sistema: 'Sistema',
};
export const RESULTADOS: Record<string, string> = {
  sem_resposta: 'Sem resposta', aguardando_retorno: 'Aguardando retorno', contato_realizado: 'Contato realizado',
  vai_pagar: 'Vai pagar', recusou: 'Recusou pagar', numero_invalido: 'Número inválido',
};

export const RegistrarCobrancaDialog = ({ alvo, onClose, onSaved }: {
  alvo: { c: CobrancaItem; tipo: 'cobranca' | 'retorno' } | null; onClose: () => void; onSaved: () => void;
}) => {
  const [canal, setCanal] = useState<CanalCobranca>('whatsapp');
  const [resultado, setResultado] = useState('sem_resposta');
  const [obs, setObs] = useState('');
  const [saving, setSaving] = useState(false);
  useEffect(() => { setCanal('whatsapp'); setResultado(alvo?.tipo === 'retorno' ? 'contato_realizado' : 'sem_resposta'); setObs(''); }, [alvo]);

  const salvar = async () => {
    if (!alvo) return;
    setSaving(true);
    try {
      await registrarInteracao(alvo.c.id, alvo.tipo, canal, resultado, obs || undefined);
      toast.success(alvo.tipo === 'retorno' ? 'Retorno registrado' : 'Cobrança registrada');
      onSaved(); onClose();
    } catch (e: any) { toast.error(e.message || 'Erro ao registrar'); } finally { setSaving(false); }
  };

  return (
    <Dialog open={!!alvo} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>{alvo?.tipo === 'retorno' ? 'Registrar retorno' : 'Registrar cobrança'} — {alvo?.c.alunoNome}</DialogTitle></DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-1.5"><Label>Canal</Label>
            <Select value={canal} onValueChange={(v) => setCanal(v as CanalCobranca)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{Object.entries(CANAIS).filter(([k]) => k !== 'sistema').map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5"><Label>Resultado</Label>
            <Select value={resultado} onValueChange={setResultado}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{Object.entries(RESULTADOS).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5"><Label>Observação</Label><Textarea value={obs} onChange={(e) => setObs(e.target.value)} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={salvar} disabled={saving}>{saving ? 'Salvando...' : 'Salvar'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export const AgendarDialog = ({ alvo, onClose, onSaved }: { alvo: CobrancaItem | null; onClose: () => void; onSaved: () => void }) => {
  const [data, setData] = useState('');
  const [motivo, setMotivo] = useState('');
  const [saving, setSaving] = useState(false);
  useEffect(() => { setData(''); setMotivo(''); }, [alvo]);
  const salvar = async () => {
    if (!alvo || !data) return toast.error('Escolha a data');
    setSaving(true);
    try { await agendarManual(alvo.id, data, 'contato', motivo || undefined); toast.success('Cobrança agendada'); onSaved(); onClose(); }
    catch (e: any) { toast.error(e.message || 'Erro ao agendar'); } finally { setSaving(false); }
  };
  return (
    <Dialog open={!!alvo} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Agendar nova cobrança — {alvo?.alunoNome}</DialogTitle></DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-1.5"><Label>Data</Label><Input type="date" value={data} onChange={(e) => setData(e.target.value)} /></div>
          <div className="grid gap-1.5"><Label>Motivo (opcional)</Label><Textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={salvar} disabled={saving}>{saving ? 'Salvando...' : 'Agendar'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const fmtDT = (iso: string) => new Date(iso).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' });

export const TimelineDialog = ({ alvo, onClose, nomes }: { alvo: CobrancaItem | null; onClose: () => void; nomes: Map<string, string> }) => {
  const [eventos, setEventos] = useState<any[] | null>(null);
  useEffect(() => {
    if (!alvo) return;
    setEventos(null);
    getHistoricoCobranca(alvo.id).then((h: any) => setEventos(h.eventos)).catch(() => setEventos([]));
  }, [alvo]);

  return (
    <Dialog open={!!alvo} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Histórico — {alvo?.alunoNome}</DialogTitle></DialogHeader>
        {alvo && (
          <p className="text-[13px] text-ink-500">{alvo.curso} · Em aberto {fmtMoeda(alvo.totalAberto)} ({alvo.parcelasAbertas} parcela(s))</p>
        )}
        {eventos === null ? <p className="text-muted-foreground">Carregando...</p> : eventos.length === 0 ? (
          <p className="text-muted-foreground py-6 text-center">Nenhum evento registrado.</p>
        ) : (
          <ol className="relative border-l border-ink-200 ml-3 space-y-4">
            {eventos.map((e) => (
              <li key={e.id} className="ml-5">
                <span className={`absolute -left-3 flex h-6 w-6 items-center justify-center rounded-full ${e.automatico ? 'bg-ink-100 text-ink-600' : 'bg-brand text-brand-foreground'}`}>
                  {e.automatico ? <Bot className="h-3.5 w-3.5" /> : <User className="h-3.5 w-3.5" />}
                </span>
                <p className="text-[12px] text-ink-500">
                  {fmtDT(e.created_at)} · {e.automatico ? 'Sistema (automático)' : nomes.get(e.user_id) || 'Usuário'}
                </p>
                <p className="text-[13.5px] font-medium text-ink-900 capitalize">{String(e.tipo).replace(/_/g, ' ')}</p>
                {e.descricao && <p className="text-[13px] text-ink-700">{e.descricao}</p>}
              </li>
            ))}
          </ol>
        )}
      </DialogContent>
    </Dialog>
  );
};
