import { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import {
  AlertaAcompanhamento,
  CANAIS,
  CANAL_LABELS,
  Canal,
  RESULTADOS_ESPECIAIS,
  RESULTADO_LABELS,
  ROTEIRO,
  ResultadoContato,
} from '@/lib/acompanhamento';
import { atualizarPrevisao, registrarContato } from '@/lib/acompanhamento-storage';

interface Props {
  alerta: AlertaAcompanhamento | null;
  onClose: () => void;
  onSaved: () => void;
}

const RegistrarContatoDialog = ({ alerta, onClose, onSaved }: Props) => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [canal, setCanal] = useState<Canal | ''>('');
  const [resultado, setResultado] = useState<ResultadoContato | ''>('');
  const [observacao, setObservacao] = useState('');
  const [proximo, setProximo] = useState('');
  const [novaPrevisao, setNovaPrevisao] = useState('');
  const [marcados, setMarcados] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (alerta) {
      setCanal('');
      setResultado('');
      setObservacao('');
      setProximo('');
      setNovaPrevisao('');
      setMarcados([]);
    }
  }, [alerta]);

  const roteiro = useMemo(() => (alerta?.marcoAtual ? ROTEIRO[alerta.marcoAtual] : []), [alerta]);

  if (!alerta) return null;

  const exigeProximo = RESULTADOS_ESPECIAIS.includes(resultado as ResultadoContato);
  const exigeObservacao = !!resultado && resultado !== 'tudo_certo_concluindo';
  const exigePrevisao = resultado === 'prazo_prorrogado';

  const salvar = async () => {
    if (!canal) return toast({ title: 'Informe o canal do contato', variant: 'destructive' });
    if (!resultado) return toast({ title: 'Informe o resultado do contato', variant: 'destructive' });
    if (exigeObservacao && !observacao.trim())
      return toast({ title: 'A observação é obrigatória para este resultado', variant: 'destructive' });
    if (exigeProximo && !proximo)
      return toast({ title: 'Informe a data do próximo contato', variant: 'destructive' });
    if (exigePrevisao && !novaPrevisao)
      return toast({ title: 'Informe a nova previsão de conclusão', variant: 'destructive' });

    setSaving(true);
    try {
      const roteiroNota = roteiro.length
        ? `\n[Roteiro: ${marcados.length}/${roteiro.length} itens abordados]`
        : '';
      await registrarContato({
        alerta,
        canal,
        resultado,
        observacao: `${observacao.trim()}${roteiroNota}`.trim() || undefined,
        proximoContatoEm: proximo || undefined,
      });
      if (exigePrevisao) await atualizarPrevisao(alerta.saleId, novaPrevisao);

      toast({ title: 'Contato registrado' });
      const gerarCert = resultado === 'ja_concluiu';
      onSaved();
      onClose();
      if (gerarCert) navigate(`/certificacao?aluno_id=${alerta.alunoId || ''}`);
    } catch (e) {
      toast({ title: 'Erro ao registrar contato', description: String(e), variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Registrar contato — {alerta.alunoNome}</DialogTitle>
        </DialogHeader>

        {roteiro.length > 0 && (
          <div className="rounded-md border bg-muted/40 p-3 space-y-2">
            <p className="text-sm font-medium">Roteiro de atendimento ({alerta.marcoAtual})</p>
            {roteiro.map((item) => (
              <label key={item} className="flex items-start gap-2 text-sm">
                <Checkbox
                  checked={marcados.includes(item)}
                  onCheckedChange={(v) =>
                    setMarcados((prev) => (v ? [...prev, item] : prev.filter((i) => i !== item)))
                  }
                />
                <span>{item}</span>
              </label>
            ))}
          </div>
        )}

        <div className="space-y-3">
          <div>
            <Label>Canal *</Label>
            <Select value={canal} onValueChange={(v) => setCanal(v as Canal)}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {CANAIS.map((c) => (
                  <SelectItem key={c} value={c}>{CANAL_LABELS[c]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Resultado *</Label>
            <Select value={resultado} onValueChange={(v) => setResultado(v as ResultadoContato)}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {(Object.keys(RESULTADO_LABELS) as ResultadoContato[]).map((r) => (
                  <SelectItem key={r} value={r}>{RESULTADO_LABELS[r]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {exigePrevisao && (
            <div>
              <Label>Nova previsão de conclusão *</Label>
              <Input type="date" value={novaPrevisao} onChange={(e) => setNovaPrevisao(e.target.value)} />
            </div>
          )}

          <div>
            <Label>Observação {exigeObservacao && '*'}</Label>
            <Textarea
              rows={3}
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              placeholder="O que o aluno relatou e o que foi combinado"
            />
          </div>

          <div>
            <Label>Próximo contato em {exigeProximo && '*'}</Label>
            <Input type="date" value={proximo} onChange={(e) => setProximo(e.target.value)} />
          </div>

          {resultado === 'ja_concluiu' && (
            <p className="text-xs text-muted-foreground">
              Ao salvar, você será levado à tela de Certificação com o aluno já selecionado.
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={salvar} disabled={saving}>{saving ? 'Salvando...' : 'Salvar contato'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default RegistrarContatoDialog;
