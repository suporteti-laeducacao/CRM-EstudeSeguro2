import { useState, useEffect, useRef, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Plus, Edit, Power, PowerOff, Search, Upload, Loader2, FileSpreadsheet } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';

interface Curso {
  id: string;
  nome: string;
  nivel_ensino: string | null;
  instituicao: string | null;
  ativo: boolean;
  created_at: string;
}

const CursosManagement = () => {
  const [cursos, setCursos] = useState<Curso[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCurso, setEditingCurso] = useState<Curso | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterNivel, setFilterNivel] = useState('_all_');
  const [filterInstituicao, setFilterInstituicao] = useState('_all_');
  const [showInactive, setShowInactive] = useState(false);
  const [importing, setImporting] = useState(false);
  const [showNewNivel, setShowNewNivel] = useState(false);
  const [newNivelValue, setNewNivelValue] = useState('');
  const [customNiveis, setCustomNiveis] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState({
    nome: '',
    nivel_ensino: '',
    instituicao: '',
  });

  useEffect(() => {
    loadCursos();
  }, [showInactive]);

  const loadCursos = async () => {
    setLoading(true);
    try {
      let allData: Curso[] = [];
      const pageSize = 1000;
      let from = 0;
      let hasMore = true;

      while (hasMore) {
        let query = supabase.from('cursos').select('*').order('nome').range(from, from + pageSize - 1);
        if (!showInactive) query = query.eq('ativo', true);
        const { data, error } = await query;
        if (error) throw error;
        if (data && data.length > 0) {
          allData = [...allData, ...data];
          from += pageSize;
          hasMore = data.length === pageSize;
        } else {
          hasMore = false;
        }
      }

      setCursos(allData);
    } catch (error) {
      console.error('Error loading cursos:', error);
      toast.error('Erro ao carregar cursos');
    } finally {
      setLoading(false);
    }
  };

  const niveisEnsino = useMemo(() => {
    const set = new Set([
      ...cursos.map(c => c.nivel_ensino).filter(Boolean) as string[],
      ...customNiveis.filter(Boolean),
    ]);
    return Array.from(set).sort();
  }, [cursos, customNiveis]);

  const instituicoes = useMemo(() => {
    const set = new Set(cursos.map(c => c.instituicao).filter(Boolean) as string[]);
    return Array.from(set).sort();
  }, [cursos]);

  const filteredCursos = useMemo(() => {
    return cursos.filter(c => {
      if (searchTerm && !c.nome.toLowerCase().includes(searchTerm.toLowerCase())) return false;
      if (filterNivel !== '_all_' && c.nivel_ensino !== filterNivel) return false;
      if (filterInstituicao !== '_all_' && c.instituicao !== filterInstituicao) return false;
      return true;
    });
  }, [cursos, searchTerm, filterNivel, filterInstituicao]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.nome.trim()) {
      toast.error('Nome do curso é obrigatório');
      return;
    }
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Não autenticado');

      if (editingCurso) {
        const { error } = await supabase.from('cursos').update({
          nome: formData.nome.toUpperCase(),
          nivel_ensino: formData.nivel_ensino || null,
          instituicao: formData.instituicao || null,
        }).eq('id', editingCurso.id);
        if (error) throw error;
        toast.success('Curso atualizado!');
      } else {
        const { error } = await supabase.from('cursos').insert({
          nome: formData.nome.toUpperCase(),
          nivel_ensino: formData.nivel_ensino || null,
          instituicao: formData.instituicao || null,
          user_id: user.id,
          ativo: true,
        });
        if (error) throw error;
        toast.success('Curso cadastrado!');
      }
      loadCursos();
      resetForm();
      setIsDialogOpen(false);
    } catch (error) {
      console.error('Error saving curso:', error);
      toast.error('Erro ao salvar curso');
    }
  };

  const handleEdit = (curso: Curso) => {
    setEditingCurso(curso);
    setFormData({
      nome: curso.nome,
      nivel_ensino: curso.nivel_ensino || '',
      instituicao: curso.instituicao || '',
    });
    setIsDialogOpen(true);
  };

  const handleToggleAtivo = async (id: string, ativo: boolean) => {
    try {
      const { error } = await supabase.from('cursos').update({ ativo: !ativo }).eq('id', id);
      if (error) throw error;
      toast.success(ativo ? 'Curso desativado' : 'Curso reativado');
      loadCursos();
    } catch (error) {
      console.error('Error toggling curso:', error);
      toast.error('Erro ao alterar status do curso');
    }
  };

  const resetForm = () => {
    setFormData({ nome: '', nivel_ensino: '', instituicao: '' });
    setEditingCurso(null);
    setShowNewNivel(false);
    setNewNivelValue('');
    setCustomNiveis([]);
  };

  const handleImportExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Não autenticado');

      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<Record<string, string>>(sheet);

      if (rows.length === 0) {
        toast.error('Planilha vazia');
        return;
      }

      const cursosToInsert = rows.map(row => {
        const nome = (row['Curso'] || row['curso'] || row['CURSO'] || row['Nome'] || row['nome'] || '').toString().trim().toUpperCase();
        const nivel = (row['Nível de Ensino'] || row['nivel_ensino'] || row['Nivel'] || row['nivel'] || row['NIVEL'] || row['Nível'] || '').toString().trim();
        const inst = (row['Instituição'] || row['instituicao'] || row['Instituicao'] || row['INSTITUIÇÃO'] || row['INSTITUICAO'] || '').toString().trim();
        return {
          nome,
          nivel_ensino: nivel || null,
          instituicao: inst || null,
          user_id: user.id,
          ativo: true,
        };
      }).filter(c => c.nome);

      if (cursosToInsert.length === 0) {
        toast.error('Nenhum curso válido encontrado. Verifique se a planilha tem colunas: Curso, Nível de Ensino, Instituição');
        return;
      }

      const { error } = await supabase.from('cursos').insert(cursosToInsert);
      if (error) throw error;

      toast.success(`${cursosToInsert.length} curso(s) importado(s) com sucesso!`);
      loadCursos();
    } catch (error) {
      console.error('Error importing:', error);
      toast.error('Erro ao importar planilha');
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center flex-wrap gap-2">
          <CardTitle>Cadastro de Cursos</CardTitle>
          <div className="flex gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={handleImportExcel}
            />
            <Button
              variant="outline"
              className="gap-2"
              onClick={() => fileInputRef.current?.click()}
              disabled={importing}
            >
              {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileSpreadsheet className="w-4 h-4" />}
              Importar Excel
            </Button>
            <Dialog open={isDialogOpen} onOpenChange={(open) => {
              setIsDialogOpen(open);
              if (!open) resetForm();
            }}>
              <DialogTrigger asChild>
                <Button className="gap-2">
                  <Plus className="w-4 h-4" />
                  Novo Curso
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>{editingCurso ? 'Editar Curso' : 'Cadastrar Novo Curso'}</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <Label htmlFor="curso_nome">Nome do Curso *</Label>
                    <Input
                      id="curso_nome"
                      value={formData.nome}
                      onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                      placeholder="Ex: Engenharia Civil"
                    />
                  </div>
                  <div>
                    <Label htmlFor="curso_nivel">Nível de Ensino</Label>
                    <div className="flex gap-2">
                      <Select
                        value={formData.nivel_ensino || ''}
                        onValueChange={(val) => {
                          if (val === '_add_new_') {
                            setShowNewNivel(true);
                          } else {
                            setFormData({ ...formData, nivel_ensino: val });
                          }
                        }}
                      >
                        <SelectTrigger className="flex-1">
                          <SelectValue placeholder="Selecione o nível de ensino" />
                        </SelectTrigger>
                        <SelectContent>
                          {(() => {
                            const allNiveis = new Set(niveisEnsino);
                            if (formData.nivel_ensino) allNiveis.add(formData.nivel_ensino);
                            return Array.from(allNiveis).sort().map(n => (
                              <SelectItem key={n} value={n}>{n}</SelectItem>
                            ));
                          })()}
                          <SelectItem value="_add_new_" className="text-primary font-medium">
                            <span className="flex items-center gap-1"><Plus className="w-3 h-3" /> Adicionar novo nível</span>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      {formData.nivel_ensino && (
                        <Button type="button" variant="ghost" size="icon" aria-label="Limpar" onClick={() => setFormData({ ...formData, nivel_ensino: '' })} title="Limpar">
                          ×
                        </Button>
                      )}
                    </div>
                    {showNewNivel && (
                      <div className="flex gap-2 mt-2">
                        <Input
                          value={newNivelValue}
                          onChange={(e) => setNewNivelValue(e.target.value)}
                          placeholder="Digite o novo nível de ensino"
                          autoFocus
                        />
                        <Button type="button" size="sm" onClick={() => {
                          const trimmedNivel = newNivelValue.trim();
                          if (trimmedNivel) {
                            setCustomNiveis(prev => prev.includes(trimmedNivel) ? prev : [...prev, trimmedNivel]);
                            setFormData({ ...formData, nivel_ensino: trimmedNivel });
                            setNewNivelValue('');
                            setShowNewNivel(false);
                          }
                        }}>OK</Button>
                        <Button type="button" size="sm" variant="outline" onClick={() => { setShowNewNivel(false); setNewNivelValue(''); }}>
                          Cancelar
                        </Button>
                      </div>
                    )}
                  </div>
                  <div>
                    <Label htmlFor="curso_instituicao">Instituição</Label>
                    <Input
                      id="curso_instituicao"
                      value={formData.instituicao}
                      onChange={(e) => setFormData({ ...formData, instituicao: e.target.value })}
                      placeholder="Ex: UNIP, Anhanguera"
                    />
                  </div>
                  <div className="flex gap-2 justify-end">
                    <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                      Cancelar
                    </Button>
                    <Button type="submit">
                      {editingCurso ? 'Atualizar' : 'Cadastrar'}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Filters */}
        <div className="flex flex-wrap gap-3 mb-6">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input
              placeholder="Buscar por nome do curso..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={filterNivel} onValueChange={setFilterNivel}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Nível de Ensino" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="_all_">Todos os Níveis</SelectItem>
              {niveisEnsino.map(n => (
                <SelectItem key={n} value={n}>{n}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filterInstituicao} onValueChange={setFilterInstituicao}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Instituição" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="_all_">Todas as Instituições</SelectItem>
              {instituicoes.map(i => (
                <SelectItem key={i} value={i}>{i}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={() => setShowInactive(!showInactive)}>
            {showInactive ? 'Ver Apenas Ativos' : 'Ver Todos'}
          </Button>
        </div>

        {/* Table */}
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Curso</TableHead>
                <TableHead>Nível de Ensino</TableHead>
                <TableHead>Instituição</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8">
                    <Loader2 className="w-5 h-5 animate-spin mx-auto" />
                  </TableCell>
                </TableRow>
              ) : filteredCursos.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    Nenhum curso encontrado
                  </TableCell>
                </TableRow>
              ) : filteredCursos.map((curso) => (
                <TableRow key={curso.id}>
                  <TableCell className="font-medium">{curso.nome}</TableCell>
                  <TableCell>{curso.nivel_ensino || '-'}</TableCell>
                  <TableCell>{curso.instituicao || '-'}</TableCell>
                  <TableCell>
                    {curso.ativo ? (
                      <Badge variant="default">Ativo</Badge>
                    ) : (
                      <Badge variant="secondary">Inativo</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex gap-2 justify-end">
                      <Button aria-label="Editar" size="sm" variant="outline" onClick={() => handleEdit(curso)} title="Editar">
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button aria-label="Ativar ou desativar curso"
                        size="sm"
                        variant={curso.ativo ? "destructive" : "default"}
                        onClick={() => handleToggleAtivo(curso.id, curso.ativo)}
                        title={curso.ativo ? "Desativar" : "Reativar"}
                      >
                        {curso.ativo ? <PowerOff className="w-4 h-4" /> : <Power className="w-4 h-4" />}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <div className="mt-4 flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {filteredCursos.length} curso(s) encontrado(s)
          </p>
          <p className="text-xs text-muted-foreground">
            Para importar, use uma planilha com colunas: <strong>Curso</strong>, <strong>Nível de Ensino</strong>, <strong>Instituição</strong>
          </p>
        </div>
      </CardContent>
    </Card>
  );
};

export default CursosManagement;
