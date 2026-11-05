import { useState } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { ChevronsUpDown, Search, X } from 'lucide-react';
import { useStudentSearch, maskCpf, StudentSearchResult } from '@/hooks/useStudentSearch';

interface Props {
  selected: StudentSearchResult | null;
  onSelect: (s: StudentSearchResult) => void;
  onClear: () => void;
}

export const StudentCombobox = ({ selected, onSelect, onClear }: Props) => {
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState('');
  const [highlight, setHighlight] = useState(0);
  const { results, loading, error, retry } = useStudentSearch(term);

  const choose = (s: StudentSearchResult) => {
    onSelect(s);
    setOpen(false);
    setTerm('');
  };

  return (
    <div className="flex gap-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" className="flex-1 justify-between font-normal">
            <span className={selected ? '' : 'text-muted-foreground'}>
              {selected ? selected.full_name : 'Busque por nome, CPF, e-mail ou telefone…'}
            </span>
            <ChevronsUpDown className="h-4 w-4 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
          <div className="flex items-center gap-2 border-b px-3 py-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input
              autoFocus
              value={term}
              onChange={(e) => {
                setTerm(e.target.value);
                setHighlight(0);
              }}
              onKeyDown={(e) => {
                if (e.key === 'ArrowDown') {
                  e.preventDefault();
                  setHighlight((h) => Math.min(h + 1, results.length - 1));
                } else if (e.key === 'ArrowUp') {
                  e.preventDefault();
                  setHighlight((h) => Math.max(h - 1, 0));
                } else if (e.key === 'Enter' && results[highlight]) {
                  e.preventDefault();
                  choose(results[highlight]);
                }
              }}
              placeholder="Busque por nome, CPF, e-mail ou telefone…"
              className="h-8 border-0 p-0 shadow-none focus-visible:ring-0"
            />
          </div>
          <div className="max-h-72 overflow-y-auto p-1">
            {term.trim().length < 2 && (
              <p className="px-3 py-4 text-sm text-muted-foreground">Digite ao menos 2 caracteres.</p>
            )}
            {loading && (
              <div className="space-y-2 p-2">
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
              </div>
            )}
            {error && (
              <div className="p-3 text-sm">
                <p className="text-destructive mb-2">Erro ao buscar alunos.</p>
                <Button size="sm" variant="outline" onClick={retry}>
                  Tentar novamente
                </Button>
              </div>
            )}
            {!loading && !error && term.trim().length >= 2 && results.length === 0 && (
              <p className="px-3 py-4 text-sm text-muted-foreground">Nenhum aluno encontrado</p>
            )}
            {!loading &&
              !error &&
              results.map((s, i) => (
                <button
                  key={s.id}
                  type="button"
                  onMouseEnter={() => setHighlight(i)}
                  onClick={() => choose(s)}
                  className={`w-full rounded-[8px] px-3 py-2 text-left text-sm ${
                    i === highlight ? 'bg-brand-tint text-ink-900' : ''
                  }`}
                >
                  <div className="font-medium">{s.full_name}</div>
                  <div className="text-xs text-muted-foreground">
                    {maskCpf(s.cpf)}
                    {s.academic_course ? ` · ${s.academic_course}` : ''}
                  </div>
                </button>
              ))}
          </div>
        </PopoverContent>
      </Popover>
      {selected && (
        <Button variant="ghost" size="icon" aria-label="Limpar seleção" onClick={onClear} title="Limpar seleção">
          <X className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
};
