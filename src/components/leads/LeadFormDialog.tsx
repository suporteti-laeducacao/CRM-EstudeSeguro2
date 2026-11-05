import { useState, useEffect, useRef } from 'react';
import { Lead, LeadStatus, LeadOrigem, LEAD_STATUS_CONFIG, LEAD_ORIGEM_CONFIG } from '@/lib/leads-types';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Check, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { getMyVendedorId } from '@/lib/vendedores-storage';

interface LeadFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lead?: Lead | null;
  onSave: (data: Partial<Lead>) => Promise<boolean>;
}

interface Vendedor {
  id: string;
  nome: string;
}

interface Curso {
  id: string;
  nome: string;
  nivel_ensino: string | null;
}

const formatTelefone = (value: string): string => {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (digits.length === 0) return '';
  if (digits.length <= 2) return `(${digits}`;
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
};

const DRAFT_KEY = 'lead-form-draft-v1';
const DRAFT_MAX_AGE_MS = 6 * 60 * 60 * 1000;

const readDraft = (): Partial<Lead> | null => {
  try {
    const raw = sessionStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { ts: number; data: Partial<Lead> };
    if (!parsed?.data || Date.now() - (parsed.ts || 0) > DRAFT_MAX_AGE_MS) return null;
    return parsed.data;
  } catch {
    return null;
  }
};

const clearDraft = () => {
  try {
    sessionStorage.removeItem(DRAFT_KEY);
  } catch {
    // ignore
  }
};

const LeadFormDialog = ({ open, onOpenChange, lead, onSave }: LeadFormDialogProps) => {
  const { hasRole } = useAuth();
  const canChooseVendedor = hasRole('admin') || hasRole('supervisor') || hasRole('gerente');
  const initializedRef = useRef(false);
  const [loading, setLoading] = useState(false);

  const [vendedores, setVendedores] = useState<Vendedor[]>([]);
  const [myVendedorNome, setMyVendedorNome] = useState<string>('');
  const [cursos, setCursos] = useState<Curso[]>([]);
  const [nivelEnsino, setNivelEnsino] = useState<string>('');
  const [cursoComboboxOpen, setCursoComboboxOpen] = useState(false);
  const [formData, setFormData] = useState<Partial<Lead>>({
    nome: '',
    email: '',
    telefone: '',
    empresa: '',
    curso_interesse: '',
    valor_estimado: undefined,
    origem: 'organico',
    status: 'novo',
    vendedor_id: undefined,
    tags: [],
  });

  useEffect(() => {
    const fetchData = async () => {
      // Busca todos os vendedores (ativos + inativo atribuído ao lead)
      const vendedoresRes = await supabase
        .from('vendedores')
        .select('id, nome, ativo')
        .order('nome');
      if (vendedoresRes.data) {
        const list = (vendedoresRes.data as Array<Vendedor & { ativo: boolean }>).filter(
          (v) => v.ativo || v.id === lead?.vendedor_id
        );
        setVendedores(list);
      }

      // Recursive pagination to bypass 1000-record limit
      const PAGE_SIZE = 1000;
      let all: Curso[] = [];
      let from = 0;
      while (true) {
        const { data, error } = await supabase
          .from('cursos')
          .select('id, nome, nivel_ensino')
          .eq('ativo', true)
          .range(from, from + PAGE_SIZE - 1);
        if (error || !data) break;
        all = all.concat(data as Curso[]);
        if (data.length < PAGE_SIZE) break;
        from += PAGE_SIZE;
      }
      setCursos(all);
    };

    if (open) fetchData();
  }, [open, lead?.vendedor_id]);

  useEffect(() => {
    if (!open) {
      initializedRef.current = false;
      return;
    }
    // Inicializa apenas uma vez por abertura — evita que re-renders externos
    // (troca de aba, refetch de leads, refresh de sessão) apaguem o preenchimento
    if (initializedRef.current) return;
    initializedRef.current = true;

    if (lead) {
      setFormData({
        nome: lead.nome,
        email: lead.email || '',
        telefone: lead.telefone || '',
        empresa: lead.empresa || '',
        curso_interesse: lead.curso_interesse || '',
        valor_estimado: lead.valor_estimado,
        origem: lead.origem,
        status: lead.status,
        vendedor_id: lead.vendedor_id ?? undefined,
        tags: lead.tags || [],
      });
    } else {
      const draft = readDraft();
      if (draft) setFormData(draft);
      // Para novo lead, pré-preenche vendedor com o usuário atual
      getMyVendedorId().then(async (myId) => {
        let nome = '';
        if (myId) {
          const { data } = await supabase.from('vendedores').select('nome').eq('id', myId).maybeSingle();
          nome = data?.nome || '';
        }
        setMyVendedorNome(nome);
        setFormData((prev) => ({
          nome: '',
          email: '',
          telefone: '',
          empresa: '',
          curso_interesse: '',
          valor_estimado: undefined,
          origem: 'organico',
          status: 'novo',
          tags: [],
          ...(draft || {}),
          vendedor_id: draft?.vendedor_id ?? myId ?? undefined,
        }));
      });
    }
  }, [lead, open]);

  // Salva rascunho do novo lead para sobreviver a troca de aba / recarregamento
  useEffect(() => {
    if (!open || lead || !initializedRef.current) return;
    try {
      sessionStorage.setItem(
        DRAFT_KEY,
        JSON.stringify({ ts: Date.now(), data: formData })
      );
    } catch {
      // ignore
    }
  }, [formData, open, lead]);


  // Sincroniza nível de ensino quando o curso já está definido (edição) ou cursos carregam
  useEffect(() => {
    if (formData.curso_interesse && cursos.length > 0) {
      const found = cursos.find(c => c.nome === formData.curso_interesse);
      if (found?.nivel_ensino && nivelEnsino !== found.nivel_ensino) {
        setNivelEnsino(found.nivel_ensino);
      }
    }
    if (!formData.curso_interesse && !lead) {
      setNivelEnsino('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.curso_interesse, cursos, lead]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const telDigits = (formData.telefone || '').replace(/\D/g, '');
    const { toast } = await import('sonner');

    if (telDigits.length < 10 || telDigits.length > 11) {
      toast.error('Telefone inválido. Informe DDD + número (10 ou 11 dígitos).');
      return;
    }

    setLoading(true);

    try {
      // Verifica telefone duplicado (qualquer vendedor) — bloqueio obrigatório
      const { data: dup, error: dupErr } = await supabase.rpc('check_lead_telefone_duplicado', {
        _telefone: formData.telefone || '',
        _exclude_lead_id: lead?.id ?? null,
      });

      if (!dupErr && dup && dup.length > 0) {
        const existing = dup[0] as { lead_nome: string; vendedor_nome: string; arquivado: boolean };
        toast.error(
          `Telefone já cadastrado para "${existing.lead_nome}"${existing.arquivado ? ' (arquivado)' : ''} — Vendedor: ${existing.vendedor_nome}.`,
          { duration: 8000, description: 'Não é permitido cadastrar mais de um lead com o mesmo telefone.' }
        );
        setLoading(false);
        return;
      }

      const success = await onSave(formData);
      if (success) {
        clearDraft();
        onOpenChange(false);
      }

    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{lead ? 'Editar Lead' : 'Novo Lead'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="nome">Nome *</Label>
              <Input
                id="nome"
                value={formData.nome}
                onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="telefone">Telefone *</Label>
              <Input
                id="telefone"
                value={formatTelefone(formData.telefone || '')}
                onChange={(e) => setFormData({ ...formData, telefone: formatTelefone(e.target.value) })}
                placeholder="(00) 00000-0000"
                inputMode="tel"
                maxLength={15}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="empresa">Empresa</Label>
              <Input
                id="empresa"
                value={formData.empresa}
                onChange={(e) => setFormData({ ...formData, empresa: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="nivel_ensino">Nível de Ensino</Label>
              <Select
                value={nivelEnsino}
                onValueChange={(value) => {
                  setNivelEnsino(value);
                  setFormData({ ...formData, curso_interesse: '' });
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  {Array.from(new Set(cursos.map(c => c.nivel_ensino).filter(Boolean) as string[]))
                    .sort()
                    .map((nivel) => (
                      <SelectItem key={nivel} value={nivel}>{nivel}</SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="curso_interesse">Curso de Interesse</Label>
              <Popover open={cursoComboboxOpen} onOpenChange={setCursoComboboxOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    type="button"
                    className="w-full justify-between font-normal"
                    disabled={!nivelEnsino}
                  >
                    <span className="truncate">
                      {formData.curso_interesse || (nivelEnsino ? 'Selecione um curso' : 'Nível primeiro')}
                    </span>
                    <ChevronsUpDown className="ml-1 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[350px] p-0" onWheel={(e) => e.stopPropagation()}>
                  <Command>
                    <CommandInput placeholder="Pesquisar curso..." />
                    <CommandList className="max-h-[250px] overflow-y-auto overscroll-contain">
                      <CommandEmpty>Nenhum curso encontrado.</CommandEmpty>
                      <CommandGroup>
                        {cursos
                          .filter(c => c.nivel_ensino === nivelEnsino)
                          .map(c => c.nome)
                          .sort()
                          .map((nome) => (
                            <CommandItem
                              key={nome}
                              value={nome}
                              onSelect={() => {
                                setFormData({ ...formData, curso_interesse: nome });
                                setCursoComboboxOpen(false);
                              }}
                            >
                              <Check
                                className={cn(
                                  'mr-2 h-4 w-4',
                                  formData.curso_interesse === nome ? 'opacity-100' : 'opacity-0'
                                )}
                              />
                              {nome}
                            </CommandItem>
                          ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label htmlFor="valor_estimado">Valor Estimado (R$)</Label>
              <Input
                id="valor_estimado"
                type="number"
                step="0.01"
                value={formData.valor_estimado || ''}
                onChange={(e) => setFormData({ 
                  ...formData, 
                  valor_estimado: e.target.value ? parseFloat(e.target.value) : undefined 
                })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="origem">Origem</Label>
              <Select
                value={formData.origem}
                onValueChange={(value) => setFormData({ ...formData, origem: value as LeadOrigem })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(LEAD_ORIGEM_CONFIG)
                    .sort(([, a], [, b]) => a.label.localeCompare(b.label))
                    .map(([key, config]) => (
                      <SelectItem key={key} value={key}>
                        {config.label}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select
                value={formData.status}
                onValueChange={(value) => setFormData({ ...formData, status: value as LeadStatus })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(LEAD_STATUS_CONFIG).map(([key, config]) => (
                    <SelectItem key={key} value={key}>
                      {config.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2 col-span-2">
              <Label htmlFor="vendedor">Vendedor Responsável</Label>
              {canChooseVendedor ? (
                <Select
                  value={formData.vendedor_id || 'none'}
                  onValueChange={(value) => setFormData({ 
                    ...formData, 
                    vendedor_id: value === 'none' ? undefined : value 
                  })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um vendedor" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sem vendedor</SelectItem>
                    {vendedores.map((vendedor) => (
                      <SelectItem key={vendedor.id} value={vendedor.id}>
                        {vendedor.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <>
                  <Input
                    value={
                      lead
                        ? (vendedores.find(v => v.id === formData.vendedor_id)?.nome || '—')
                        : (myVendedorNome || 'Carregando...')
                    }
                    readOnly
                    disabled
                    className="bg-muted"
                  />
                  <p className="text-xs text-muted-foreground">
                    O lead será atribuído automaticamente ao seu usuário. Apenas supervisor, gerente ou administrador podem alterar o vendedor.
                  </p>
                </>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                if (!lead) clearDraft();
                onOpenChange(false);
              }}
            >

              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Salvando...' : 'Salvar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default LeadFormDialog;
