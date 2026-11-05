import { supabase } from '@/integrations/supabase/client';

interface AuditLogEntry {
  installment_id: string;
  campo: string;
  valor_anterior?: string | null;
  valor_novo?: string | null;
  descricao: string;
}

interface AuditOptions {
  /** When false, the change is not mirrored into sale_change_logs */
  mirrorToSale?: boolean;
}

const saleFieldFromCampo = (campo: string) => {
  switch (campo) {
    case 'due_date':
      return 'installment_due_date';
    case 'value':
      return 'installment_value';
    default:
      return `installment_${campo}`;
  }
};

export const logInstallmentChange = async (
  entries: AuditLogEntry | AuditLogEntry[],
  options: AuditOptions = {},
) => {
  const { mirrorToSale = true } = options;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const items = Array.isArray(entries) ? entries : [entries];
  if (items.length === 0) return;

  const rows = items.map(e => ({
    ...e,
    user_id: user.id,
  }));

  const { error } = await supabase.from('installment_change_logs').insert(rows);
  if (error) {
    console.error('Error logging installment change:', error);
  }

  if (!mirrorToSale) return;

  // Mirror into the sale history so the same information shows up everywhere
  try {
    const installmentIds = [...new Set(items.map(i => i.installment_id))];
    const { data: insts } = await supabase
      .from('installments')
      .select('id, sale_id, installment_number')
      .in('id', installmentIds);

    if (!insts || insts.length === 0) return;
    const map = new Map(insts.map(i => [i.id, i]));

    const saleRows = items
      .map(item => {
        const inst = map.get(item.installment_id);
        if (!inst) return null;
        const label = inst.installment_number === 0 ? 'Entrada' : `Parcela ${inst.installment_number}`;
        return {
          sale_id: inst.sale_id,
          user_id: user.id,
          field_name: saleFieldFromCampo(item.campo),
          old_value: item.valor_anterior ? `${label}: ${item.valor_anterior}` : `${label} — ${item.descricao}`,
          new_value: item.valor_novo ? `${label}: ${item.valor_novo}` : null,
        };
      })
      .filter(Boolean) as Record<string, unknown>[];

    if (saleRows.length > 0) {
      await supabase.from('sale_change_logs').insert(saleRows as never);
    }
  } catch (err) {
    console.error('Error mirroring installment change to sale log:', err);
  }
};
