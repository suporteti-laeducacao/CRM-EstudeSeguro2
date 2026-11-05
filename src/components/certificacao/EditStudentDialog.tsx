import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { StudentSearchResult } from '@/hooks/useStudentSearch';

interface Props {
  student: StudentSearchResult | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSaved: (s: StudentSearchResult) => void;
}

export const EditStudentDialog = ({ student, open, onOpenChange, onSaved }: Props) => {
  const [form, setForm] = useState({ full_name: '', email: '', phone: '', cpf: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (student && open) {
      setForm({
        full_name: student.full_name || '',
        email: student.email || '',
        phone: student.phone || '',
        cpf: student.cpf || '',
      });
    }
  }, [student, open]);

  const save = async () => {
    if (!student) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('students')
        .update({
          full_name: form.full_name,
          email: form.email,
          phone: form.phone,
          cpf: form.cpf,
        })
        .eq('id', student.id);
      if (error) throw error;
      toast.success('Cadastro do aluno atualizado');
      onSaved({ ...student, ...form });
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao atualizar aluno');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar dados do aluno</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>Nome completo</Label>
            <Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
          </div>
          <div className="space-y-1">
            <Label>E-mail</Label>
            <Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
          <div className="space-y-1">
            <Label>Telefone</Label>
            <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </div>
          <div className="space-y-1">
            <Label>CPF</Label>
            <Input value={form.cpf} onChange={(e) => setForm({ ...form, cpf: e.target.value })} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={save} disabled={saving}>Salvar alterações</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
