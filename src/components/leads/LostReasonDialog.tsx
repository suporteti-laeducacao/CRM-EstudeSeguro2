import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';

type ReasonMode = 'perdido' | 'reciclagem' | 'potencial';

interface LostReasonDialogProps {
  open: boolean;
  leadName?: string;
  mode?: ReasonMode;
  onCancel: () => void;
  onConfirm: (reason: string) => void | Promise<void>;
}

const COPY: Record<ReasonMode, {
  title: string;
  descWithName: (n: string) => string;
  desc: string;
  label: string;
  placeholder: string;
  confirm: string;
}> = {
  perdido: {
    title: 'Motivo da perda',
    descWithName: (n) => `Informe o motivo de declarar o lead "${n}" como perdido. Esta informação é obrigatória.`,
    desc: 'Informe o motivo de declarar este lead como perdido. Esta informação é obrigatória.',
    label: 'Motivo da perda *',
    placeholder: 'Ex.: Cliente sem interesse no momento, optou por concorrente, fora do perfil...',
    confirm: 'Confirmar perda',
  },
  reciclagem: {
    title: 'Motivo da reciclagem',
    descWithName: (n) => `Informe o motivo de mover o lead "${n}" para reciclagem. Esta informação é obrigatória.`,
    desc: 'Informe o motivo de mover este lead para reciclagem. Esta informação é obrigatória.',
    label: 'Motivo da reciclagem *',
    placeholder: 'Ex.: Sem retorno após várias tentativas, retomar contato em outro momento...',
    confirm: 'Confirmar reciclagem',
  },
  potencial: {
    title: 'Classificar como Potencial',
    descWithName: (n) => `Explique por que o lead "${n}" foi classificado como potencial e descreva os detalhes da negociação para acompanhamento. Esta informação é obrigatória.`,
    desc: 'Explique por que este lead foi classificado como potencial e descreva os detalhes da negociação para acompanhamento. Esta informação é obrigatória.',
    label: 'Justificativa e detalhes da negociação *',
    placeholder: 'Ex.: Cliente demonstrou forte interesse no curso X, já enviou documentos parciais, prefere parcelar em 12x, retomar contato na próxima semana após receber proposta formal...',
    confirm: 'Confirmar como Potencial',
  },
};

const LostReasonDialog = ({ open, leadName, mode = 'perdido', onCancel, onConfirm }: LostReasonDialogProps) => {
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const copy = COPY[mode];

  useEffect(() => {
    if (open) {
      setReason('');
      setSubmitting(false);
    }
  }, [open]);

  const handleConfirm = async () => {
    if (!reason.trim()) return;
    setSubmitting(true);
    try {
      await onConfirm(reason.trim());
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o && !submitting) onCancel();
      }}
    >
      <DialogContent
        onEscapeKeyDown={(e) => e.preventDefault()}
        onPointerDownOutside={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>{copy.title}</DialogTitle>
          <DialogDescription>
            {leadName ? copy.descWithName(leadName) : copy.desc}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label htmlFor="lost-reason">{copy.label}</Label>
          <Textarea
            id="lost-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={copy.placeholder}
            rows={4}
            autoFocus
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onCancel} disabled={submitting}>
            Cancelar
          </Button>
          <Button onClick={handleConfirm} disabled={!reason.trim() || submitting}>
            {submitting ? 'Salvando...' : copy.confirm}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default LostReasonDialog;
