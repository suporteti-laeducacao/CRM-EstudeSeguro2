import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { agendarManual, registrarAcaoEspecial, resolverPromessa, resolverRenegociacao, registrarInteracao, registrarPromessa, registrarRenegociacao, getParcelasAbertas, CanalCobranca } from '@/lib/cobrancas-storage';
import type { CobrancaItem } from '@/hooks/useCobrancas';
import { fmtMoeda, fmtData, MEDIDA_LABEL } from './CobrancaCard';

export const TIPOS_RETORNO: Record<string, string> = {
  prometeu_pagamento: 'Prometeu pagamento',
  solicitou_renegociacao: 'Solicitou renegociação',
  informou_pagamento: 'Informou que já pagou',
  solicitou_boleto: 'Solicitou boleto/link',
  contestou: 'Contestou cobrança',
  dificuldade_financeira: 'Informou dificuldade financeira',
  outro: 'Outro',
};

const CANAIS_COBRANCA: Record<string, string> = { whatsapp: 'WhatsApp', phone: 'Ligação', email: 'E-mail', outro: 'Outro' };
const hojeISO = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());

interface RetornoState { tipo: string; obs: string; dataPromessa: string; valorPromessa: string; suspensaAte: string; inicio: string; parcelas: string[] }
const retornoVazio: RetornoState = { tipo: 'prometeu_pagamento', obs: '', dataPromessa: '', valorPromessa: '', suspensaAte: '', inicio: '', parcelas: [] };

const ParcelasPromessa = ({ c, v, set }: { c: CobrancaItem; v: RetornoState; set: (p: Partial<RetornoState>) => void }) => {
  const [lista, setLista] = useState<{ id: string; installment_number: number; due_date: string; value: number }[]>([]);
  useEffect(() => {
    getParcelasAbertas(c.saleId).then((l) => {
      setLista(l);
      if (!v.parcelas.length) set({ parcelas: c.parcelaReferenciaId && l.some((x) => x.id === c.parcelaReferenciaId) ? [c.parcelaReferenciaId] : l[0] ? [l[0].id] : [] });
    }).catch(() => setLista([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [c.saleId]);
  const total = lista.filter((x) => v.parcelas.includes(x.id)).reduce((s, x) => s + Number(x.value), 0);
  const toggle = (id: string) => set({ parcelas: v.parcelas.includes(id) ? v.parcelas.filter((x) => x !== id) : [...v.parcelas, id] });
  return (
    <div className="grid gap-1.5"><Label>Parcelas prometidas</Label>
      <div className="grid gap-1 rounded-[8px] border border-ink-200 p-2 max-h-40 overflow-y-auto">
        {lista.map((x) => (
          <label key={x.id} className="flex items-center gap-2 text-[13px]">
            <input type="checkbox" checked={v.parcelas.includes(x.id)} onChange={() => toggle(x.id)} />
            Parcela {x.installment_number} · venc. {fmtData(x.due_date)} · {fmtMoeda(Number(x.value))}
          </label>
        ))}
        {!lista.length && <span className="text-[12.5px] text-ink-500">Nenhuma parcela em aberto.</span>}
      </div>
      <span className="text-[12px] text-ink-500">Total das parcelas selecionadas: {fmtMoeda(total)}</span>
    </div>
  );
};

const CamposRetorno = ({ v, set, c }: { v: RetornoState; set: (p: Partial<RetornoState>) => void; c?: CobrancaItem | null }) => (
  <div className="grid gap-3 rounded-[10px] border border-ink-200 p-3">
    <div className="grid gap-1.5"><Label>Tipo de retorno</Label>
      <Select value={v.tipo} onValueChange={(t) => set({ tipo: t })}>
        <SelectTrigger><SelectValue /></SelectTrigger>
        <SelectContent>{Object.entries(TIPOS_RETORNO).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent>
      </Select>
    </div>
    {v.tipo === 'prometeu_pagamento' && c && <ParcelasPromessa c={c} v={v} set={set} />}
    {v.tipo === 'prometeu_pagamento' && (
      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-1.5"><Label>Data prometida</Label><Input type="date" min={hojeISO()} value={v.dataPromessa} onChange={(e) => set({ dataPromessa: e.target.value })} /></div>
        <div className="grid gap-1.5"><Label>Valor (opcional)</Label><Input type="number" step="0.01" value={v.valorPromessa} onChange={(e) => set({ valorPromessa: e.target.value })} /></div>
      </div>
    )}
    {v.tipo === 'solicitou_renegociacao' && (
      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-1.5"><Label>Data de início</Label><Input type="date" value={v.inicio || hojeISO()} onChange={(e) => set({ inicio: e.target.value })} /></div>
        <div className="grid gap-1.5"><Label>Suspender até</Label><Input type="date" min={hojeISO()} value={v.suspensaAte} onChange={(e) => set({ suspensaAte: e.target.value })} /></div>
      </div>
    )}
    <div className="grid gap-1.5"><Label>Observação do retorno</Label><Textarea value={v.obs} onChange={(e) => set({ obs: e.target.value })} /></div>
  </div>
);

const validarRetorno = (v: RetornoState) => {
  if (v.tipo === 'prometeu_pagamento' && !v.dataPromessa) return 'Informe a data prometida';
  if (v.tipo === 'prometeu_pagamento' && !v.obs.trim()) return 'Informe a observação da promessa';
  if (v.tipo === 'prometeu_pagamento' && !v.parcelas.length) return 'Selecione ao menos uma parcela da promessa';
  return null;
};

const salvarRetorno = async (c: CobrancaItem, canal: CanalCobranca, v: RetornoState) => {
  const obs = [TIPOS_RETORNO[v.tipo], v.obs].filter(Boolean).join(' — ');
  await registrarInteracao(c.id, 'retorno', canal, v.tipo, obs);
  if (v.tipo === 'prometeu_pagamento') {
    await registrarPromessa(c.id, v.dataPromessa, v.valorPromessa ? Number(v.valorPromessa) : undefined, v.obs || undefined, v.parcelas);
  } else if (v.tipo === 'solicitou_renegociacao') {
    await registrarRenegociacao(c.id, v.inicio || hojeISO(), v.suspensaAte || null, v.obs || undefined);
  }
};

const Resumo = ({ c }: { c: CobrancaItem }) => (
  <div className="grid grid-cols-2 gap-x-4 gap-y-1 rounded-[10px] bg-ink-50 p-3 text-[13px]">
    <span className="text-ink-500">Curso</span><span className="text-ink-900">{c.curso}</span>
    <span className="text-ink-500">Em aberto</span><span className="text-ink-900">{fmtMoeda(c.totalAberto)}</span>
    <span className="text-ink-500">Parcelas</span><span className="text-ink-900">{c.parcelasAbertas}{c.parcelaVencimento ? ` · mais antiga ${fmtData(c.parcelaVencimento)}` : ''}</span>
    <span className="text-ink-500">Etapa atual</span><span className="text-ink-900">{c.etapaCodigo || '—'}</span>
    <span className="text-ink-500">Dias de atraso</span><span className="text-ink-900">{c.diasAtraso}</span>
  </div>
);

export const RegistrarCobrancaFluxoDialog = ({ alvo, onClose, onSaved }: { alvo: CobrancaItem | null; onClose: () => void; onSaved: () => void }) => {
  const [canal, setCanal] = useState<CanalCobranca>('whatsapp');
  const [obs, setObs] = useState('');
  const [situacao, setSituacao] = useState<'aguardando' | 'imediato'>('aguardando');
  const [atendeu, setAtendeu] = useState<'sim' | 'nao'>('nao');
  const [ret, setRet] = useState<RetornoState>(retornoVazio);
  const [saving, setSaving] = useState(false);
  const [proxManual, setProxManual] = useState('');

  useEffect(() => { setCanal('whatsapp'); setObs(''); setSituacao('aguardando'); setAtendeu('nao'); setRet(retornoVazio); setProxManual(''); }, [alvo]);
  const modoManual = !!alvo && (!alvo.proximaAcaoTipo || alvo.proximaAcaoTipo === 'manual');

  const ligacao = canal === 'phone';
  const comRetorno = ligacao ? atendeu === 'sim' : situacao === 'imediato';

  const salvar = async () => {
    if (!alvo) return;
    if (comRetorno) { const err = validarRetorno(ret); if (err) return toast.error(err); }
    setSaving(true);
    try {
      const resultado = ligacao ? (atendeu === 'sim' ? 'contato_realizado' : 'nao_atendeu') : comRetorno ? 'contato_realizado' : 'aguardando_retorno';
      await registrarInteracao(alvo.id, 'cobranca', canal, resultado, obs || undefined);
      if (comRetorno) await salvarRetorno(alvo, canal, ret);
      if (modoManual && proxManual) await agendarManual(alvo.id, proxManual, 'contato', 'Próxima cobrança manual');
      toast.success(comRetorno ? 'Cobrança e retorno registrados' : ligacao ? 'Tentativa de ligação registrada' : 'Cobrança registrada — aguardando retorno');
      onSaved(); onClose();
    } catch (e: any) { toast.error(e.message || 'Erro ao registrar'); } finally { setSaving(false); }
  };

  return (
    <Dialog open={!!alvo} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Registrar cobrança — {alvo?.alunoNome}</DialogTitle></DialogHeader>
        {alvo && <Resumo c={alvo} />}
        <div className="grid gap-3">
          <div className="grid gap-1.5"><Label>Canal</Label>
            <Select value={canal} onValueChange={(v) => setCanal(v as CanalCobranca)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{Object.entries(CANAIS_COBRANCA).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5"><Label>Observação (opcional)</Label><Textarea value={obs} onChange={(e) => setObs(e.target.value)} /></div>
          {ligacao ? (
            <div className="grid gap-1.5"><Label>Houve contato com o aluno?</Label>
              <RadioGroup value={atendeu} onValueChange={(v) => setAtendeu(v as any)} className="flex gap-6">
                <label className="flex items-center gap-2 text-[13.5px]"><RadioGroupItem value="sim" /> Sim</label>
                <label className="flex items-center gap-2 text-[13.5px]"><RadioGroupItem value="nao" /> Não (não atendeu)</label>
              </RadioGroup>
            </div>
          ) : (
            <div className="grid gap-1.5"><Label>Situação imediata</Label>
              <RadioGroup value={situacao} onValueChange={(v) => setSituacao(v as any)} className="flex gap-6">
                <label className="flex items-center gap-2 text-[13.5px]"><RadioGroupItem value="aguardando" /> Aguardando retorno</label>
                <label className="flex items-center gap-2 text-[13.5px]"><RadioGroupItem value="imediato" /> Houve retorno imediato</label>
              </RadioGroup>
            </div>
          )}
          {comRetorno && <CamposRetorno c={alvo} v={ret} set={(p) => setRet((s) => ({ ...s, ...p }))} />}
          {modoManual ? (
            <div className="grid gap-1.5"><Label>Agendar próxima cobrança manual (opcional)</Label>
              <Input type="date" min={hojeISO()} value={proxManual} onChange={(e) => setProxManual(e.target.value)} />
              <p className="text-[12px] text-ink-500">Sem data, a cobrança volta para Sem Agendamento.</p>
            </div>
          ) : (
            <p className="text-[12px] text-ink-500">Ao salvar, a etapa atual é concluída e a próxima etapa da régua é agendada automaticamente.</p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={salvar} disabled={saving}>{saving ? 'Salvando...' : 'Salvar'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export const RegistrarRetornoDialog = ({ alvo, onClose, onSaved }: { alvo: CobrancaItem | null; onClose: () => void; onSaved: () => void }) => {
  const [canal, setCanal] = useState<CanalCobranca>('whatsapp');
  const [ret, setRet] = useState<RetornoState>(retornoVazio);
  const [saving, setSaving] = useState(false);
  useEffect(() => { setCanal('whatsapp'); setRet(retornoVazio); }, [alvo]);

  const salvar = async () => {
    if (!alvo) return;
    const err = validarRetorno(ret); if (err) return toast.error(err);
    setSaving(true);
    try { await salvarRetorno(alvo, canal, ret); toast.success('Retorno registrado'); onSaved(); onClose(); }
    catch (e: any) { toast.error(e.message || 'Erro ao registrar'); } finally { setSaving(false); }
  };

  return (
    <Dialog open={!!alvo} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Registrar retorno — {alvo?.alunoNome}</DialogTitle></DialogHeader>
        {alvo && <Resumo c={alvo} />}
        <div className="grid gap-3">
          <div className="grid gap-1.5"><Label>Canal do retorno</Label>
            <Select value={canal} onValueChange={(v) => setCanal(v as CanalCobranca)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{Object.entries(CANAIS_COBRANCA).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <CamposRetorno c={alvo} v={ret} set={(p) => setRet((s) => ({ ...s, ...p }))} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={salvar} disabled={saving}>{saving ? 'Salvando...' : 'Salvar'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

type ModoResolver = 'promessa' | 'renegociacao';

export const ResolverEstadoDialog = ({ alvo, modo, onClose, onSaved, onPedirBaixa }: { alvo: CobrancaItem | null; modo: ModoResolver; onClose: () => void; onSaved: () => void; onPedirBaixa?: (c: CobrancaItem, obs: string) => void }) => {
  const promessa = modo === 'promessa';
  const [acao, setAcao] = useState('');
  const [obs, setObs] = useState('');
  const [novaData, setNovaData] = useState('');
  const [saving, setSaving] = useState(false);
  useEffect(() => { setAcao(''); setObs(''); setNovaData(''); }, [alvo, modo]);

  const opcoes: [string, string][] = promessa
    ? [['pago', 'Pagamento confirmado'], ['nao_pagou', 'Não pagou'], ['prorrogar', 'Prorrogar promessa']]
    : [['regularizado', 'Regularizado'], ['nao_regularizado', 'Não regularizado'], ['prorrogar', 'Prorrogar renegociação']];

  const salvar = async () => {
    if (!alvo) return;
    if (!acao) return toast.error('Escolha uma opção');
    if (acao === 'prorrogar' && !novaData) return toast.error('Informe a nova data');
    if (acao === 'prorrogar' && !obs.trim()) return toast.error('Informe o motivo');
    if (promessa && acao === 'pago' && onPedirBaixa) { onPedirBaixa(alvo, obs); onClose(); return; }
    setSaving(true);
    try {
      if (promessa) {
        if (acao === 'prorrogar') await registrarPromessa(alvo.id, novaData, alvo.promessaAtiva?.valor ?? undefined, obs);
        else await resolverPromessa(alvo.id, acao as any, obs || undefined);
      } else {
        if (acao === 'prorrogar') await registrarRenegociacao(alvo.id, alvo.renegociacao?.inicio || hojeISO(), novaData, obs);
        else await resolverRenegociacao(alvo.id, acao as any, obs || undefined);
      }
      toast.success(acao === 'pago' ? 'Pagamento confirmado — lembre de dar baixa no Financeiro' : 'Registrado');
      onSaved(); onClose();
    } catch (e: any) { toast.error(e.message || 'Erro ao registrar'); } finally { setSaving(false); }
  };

  const p = alvo?.promessaAtiva; const r = alvo?.renegociacao;
  return (
    <Dialog open={!!alvo} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{promessa ? 'Resolver promessa' : 'Resolver renegociação'} — {alvo?.alunoNome}</DialogTitle></DialogHeader>
        {alvo && (
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 rounded-[10px] bg-ink-50 p-3 text-[13px]">
            <span className="text-ink-500">Em aberto</span><span className="text-ink-900">{fmtMoeda(alvo.totalAberto)} · {alvo.parcelasAbertas} parcela(s)</span>
            {promessa && p && (<>
              <span className="text-ink-500">Valor prometido</span><span className="text-ink-900">{p.valor != null ? fmtMoeda(Number(p.valor)) : '—'}</span>
              <span className="text-ink-500">Criada em</span><span className="text-ink-900">{fmtData(p.criadaEm)}</span>
              <span className="text-ink-500">Data prometida</span><span className="text-ink-900">{fmtData(p.data)}</span>
              <span className="text-ink-500">Observação</span><span className="text-ink-900">{p.observacao || '—'}</span>
            </>)}
            {!promessa && r && (<>
              <span className="text-ink-500">Início</span><span className="text-ink-900">{fmtData(r.inicio)}</span>
              <span className="text-ink-500">Suspensa até</span><span className="text-ink-900">{fmtData(r.suspensaAte)}</span>
              <span className="text-ink-500">Observação</span><span className="text-ink-900">{r.observacao || '—'}</span>
            </>)}
          </div>
        )}
        <div className="grid gap-3">
          <RadioGroup value={acao} onValueChange={setAcao} className="grid gap-2">
            {opcoes.map(([k, l]) => <label key={k} className="flex items-center gap-2 text-[13.5px]"><RadioGroupItem value={k} /> {l}</label>)}
          </RadioGroup>
          {acao === 'prorrogar' && <div className="grid gap-1.5"><Label>Nova data</Label><Input type="date" min={hojeISO()} value={novaData} onChange={(e) => setNovaData(e.target.value)} /></div>}
          <div className="grid gap-1.5"><Label>{acao === 'prorrogar' ? 'Motivo' : 'Observação (opcional)'}</Label><Textarea value={obs} onChange={(e) => setObs(e.target.value)} /></div>
          {(acao === 'nao_pagou' || acao === 'nao_regularizado') && <p className="text-[12px] text-ink-500">A régua será retomada automaticamente na próxima etapa futura. Etapas que passaram durante a suspensão não serão cobradas.</p>}
          {acao === 'pago' && <p className="text-[12px] text-ink-500">Em seguida você escolhe a parcela paga e faz a baixa pela mesma janela do Financeiro. A promessa só fica cumprida depois que a parcela estiver paga.</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={salvar} disabled={saving}>{saving ? 'Salvando...' : 'Salvar'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export const MedidaEspecialDialog = ({ alvo, onClose, onSaved }: { alvo: { c: CobrancaItem; tipo: string } | null; onClose: () => void; onSaved: () => void }) => {
  const [acao, setAcao] = useState<'confirmar' | 'suspender' | ''>('');
  const [obs, setObs] = useState('');
  const [ate, setAte] = useState('');
  const [saving, setSaving] = useState(false);
  useEffect(() => { setAcao(''); setObs(''); setAte(''); }, [alvo]);
  const tipo = alvo?.tipo || '';
  const confirmarLabel = tipo === 'inativacao' ? 'Confirmar inativação' : tipo === 'aviso_negativacao' ? 'Confirmar aviso de possível negativação' : 'Confirmar negativação';

  const salvar = async () => {
    if (!alvo) return;
    if (!acao) return toast.error('Escolha uma opção');
    if (!obs.trim()) return toast.error('Informe a observação');
    if (acao === 'suspender' && !ate) return toast.error('Informe até quando a renegociação suspende');
    setSaving(true);
    try {
      if (acao === 'suspender') {
        await registrarRenegociacao(alvo.c.id, hojeISO(), ate, obs);
        await registrarAcaoEspecial(alvo.c.id, tipo as any, 'suspensa', obs);
      } else {
        await registrarAcaoEspecial(alvo.c.id, tipo as any, 'confirmada', obs);
      }
      toast.success(acao === 'suspender' ? 'Suspensa por renegociação' : tipo === 'inativacao' ? 'Plataforma inativada por inadimplência.' : 'Confirmado');
      onSaved(); onClose();
    } catch (e: any) { toast.error(e.message || 'Erro ao registrar'); } finally { setSaving(false); }
  };

  return (
    <Dialog open={!!alvo} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{MEDIDA_LABEL[tipo] || tipo} — {alvo?.c.alunoNome}</DialogTitle></DialogHeader>
        {alvo && <Resumo c={alvo.c} />}
        <div className="grid gap-3">
          <RadioGroup value={acao} onValueChange={(v) => setAcao(v as any)} className="grid gap-2">
            <label className="flex items-center gap-2 text-[13.5px]"><RadioGroupItem value="confirmar" /> {confirmarLabel}</label>
            <label className="flex items-center gap-2 text-[13.5px]"><RadioGroupItem value="suspender" /> Suspender por renegociação</label>
          </RadioGroup>
          {acao === 'suspender' && <div className="grid gap-1.5"><Label>Renegociação suspende até</Label><Input type="date" min={hojeISO()} value={ate} onChange={(e) => setAte(e.target.value)} /></div>}
          <div className="grid gap-1.5"><Label>Observação</Label><Textarea value={obs} onChange={(e) => setObs(e.target.value)} /></div>
          <p className="text-[12px] text-ink-500">Nada é executado automaticamente. Usuário, data, horário e observação ficam no histórico permanente.</p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={salvar} disabled={saving}>{saving ? 'Salvando...' : 'Salvar'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
