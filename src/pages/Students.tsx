import { useState, useEffect } from 'react';
import Layout from '@/components/Layout';
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import PageHeader from '@/components/PageHeader';
import { Plus, Search, Edit, Trash2, User } from 'lucide-react';
import { storage } from '@/lib/storage';
import { Student, COURSES, PAYMENT_MODES, STUDENT_STATUS, BRAZILIAN_STATES } from '@/lib/types';
import { toast } from 'sonner';

const Students = () => {
  const [students, setStudents] = useState<Student[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [formData, setFormData] = useState<{
    fullName: string;
    email: string;
    phone: string;
    cpf: string;
    birthDate: string;
    cep: string;
    street: string;
    number: string;
    complement: string;
    neighborhood: string;
    city: string;
    state: string;
    course: string;
    class: string;
    enrollmentDate: string;
    status: 'active' | 'suspended' | 'completed' | 'cancelled';
    defaultPaymentMode: string;
    observation: string;
  }>({
    fullName: '',
    email: '',
    phone: '',
    cpf: '',
    birthDate: '',
    cep: '',
    street: '',
    number: '',
    complement: '',
    neighborhood: '',
    city: '',
    state: '',
    course: '',
    class: '',
    enrollmentDate: new Date().toISOString().split('T')[0],
    status: 'active',
    defaultPaymentMode: '',
    observation: '',
  });

  useEffect(() => {
    loadStudents();
  }, []);

  const loadStudents = async () => {
    const loadedStudents = await storage.getStudents();
    const sortedStudents = loadedStudents.sort((a, b) => a.fullName.localeCompare(b.fullName));
    setStudents(sortedStudents);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.fullName || !formData.email || !formData.course) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }

    const student: Student = {
      id: editingStudent?.id || `student-${Date.now()}`,
      fullName: formData.fullName,
      email: formData.email,
      phone: formData.phone,
      cpf: formData.cpf,
      birthDate: formData.birthDate,
      address: {
        cep: formData.cep,
        street: formData.street,
        number: formData.number,
        complement: formData.complement,
        neighborhood: formData.neighborhood,
        city: formData.city,
        state: formData.state,
      },
      academic: {
        course: formData.course,
        class: formData.class,
        enrollmentDate: formData.enrollmentDate,
        status: formData.status,
        defaultPaymentMode: formData.defaultPaymentMode,
      },
      observation: formData.observation,
    };

    storage.saveStudent(student);
    loadStudents();
    resetForm();
    setIsDialogOpen(false);
    toast.success(editingStudent ? 'Aluno atualizado!' : 'Aluno cadastrado!');
  };

  const handleEdit = (student: Student) => {
    setEditingStudent(student);
    setFormData({
      fullName: student.fullName,
      email: student.email,
      phone: student.phone,
      cpf: student.cpf,
      birthDate: student.birthDate,
      cep: student.address.cep,
      street: student.address.street,
      number: student.address.number,
      complement: student.address.complement || '',
      neighborhood: student.address.neighborhood,
      city: student.address.city,
      state: student.address.state,
      course: student.academic.course,
      class: student.academic.class,
      enrollmentDate: student.academic.enrollmentDate,
      status: student.academic.status,
      defaultPaymentMode: student.academic.defaultPaymentMode,
      observation: student.observation || '',
    });
    setIsDialogOpen(true);
  };

  const handleDelete = (id: string) => {
    if (confirm('Tem certeza que deseja excluir este aluno?')) {
      storage.deleteStudent(id);
      loadStudents();
      toast.success('Aluno excluído!');
    }
  };

  const resetForm = () => {
    setFormData({
      fullName: '',
      email: '',
      phone: '',
      cpf: '',
      birthDate: '',
      cep: '',
      street: '',
      number: '',
      complement: '',
      neighborhood: '',
      city: '',
      state: '',
      course: '',
      class: '',
      enrollmentDate: new Date().toISOString().split('T')[0],
      status: 'active',
      defaultPaymentMode: '',
      observation: '',
    });
    setEditingStudent(null);
  };

  const filteredStudents = students.filter((student) =>
    student.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    student.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    student.academic.course.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-success text-success-foreground';
      case 'suspended': return 'bg-warning text-warning-foreground';
      case 'completed': return 'bg-primary text-primary-foreground';
      case 'cancelled': return 'bg-destructive text-destructive-foreground';
      default: return 'bg-secondary text-secondary-foreground';
    }
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex justify-between items-start gap-3">
          <PageHeader
            title="Cadastro de Alunos"
            subtitle="Gerencie os dados dos alunos matriculados"
            className="mb-0"
          />
          <Dialog open={isDialogOpen} onOpenChange={(open) => {
            setIsDialogOpen(open);
            if (!open) resetForm();
          }}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="w-4 h-4" />
                Novo Aluno
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingStudent ? 'Editar Aluno' : 'Cadastrar Novo Aluno'}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold mb-3">Dados Pessoais</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="col-span-2">
                      <Label htmlFor="fullName">Nome Completo *</Label>
                      <Input
                        id="fullName"
                        value={formData.fullName}
                        onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                        placeholder="Digite o nome completo"
                      />
                    </div>
                    <div>
                      <Label htmlFor="email">E-mail *</Label>
                      <Input
                        id="email"
                        type="email"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        placeholder="email@exemplo.com"
                      />
                    </div>
                    <div>
                      <Label htmlFor="phone">Telefone</Label>
                      <Input
                        id="phone"
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        placeholder="(00) 00000-0000"
                      />
                    </div>
                    <div>
                      <Label htmlFor="cpf">CPF</Label>
                      <Input
                        id="cpf"
                        value={formData.cpf}
                        onChange={(e) => setFormData({ ...formData, cpf: e.target.value })}
                        placeholder="000.000.000-00"
                      />
                    </div>
                    <div>
                      <Label htmlFor="birthDate">Data de Nascimento</Label>
                      <Input
                        id="birthDate"
                        type="date"
                        value={formData.birthDate}
                        onChange={(e) => setFormData({ ...formData, birthDate: e.target.value })}
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-semibold mb-3">Endereço</h3>
                  <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
                    <div>
                      <Label htmlFor="cep">CEP</Label>
                      <Input
                        id="cep"
                        value={formData.cep}
                        onChange={(e) => setFormData({ ...formData, cep: e.target.value })}
                        placeholder="00000-000"
                      />
                    </div>
                    <div className="col-span-2">
                      <Label htmlFor="street">Rua/Avenida</Label>
                      <Input
                        id="street"
                        value={formData.street}
                        onChange={(e) => setFormData({ ...formData, street: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label htmlFor="number">Número</Label>
                      <Input
                        id="number"
                        value={formData.number}
                        onChange={(e) => setFormData({ ...formData, number: e.target.value })}
                      />
                    </div>
                    <div className="col-span-2">
                      <Label htmlFor="neighborhood">Bairro</Label>
                      <Input
                        id="neighborhood"
                        value={formData.neighborhood}
                        onChange={(e) => setFormData({ ...formData, neighborhood: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label htmlFor="city">Cidade</Label>
                      <Input
                        id="city"
                        value={formData.city}
                        onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label htmlFor="state">Estado</Label>
                      <Select value={formData.state} onValueChange={(value) => setFormData({ ...formData, state: value })}>
                        <SelectTrigger>
                          <SelectValue placeholder="UF" />
                        </SelectTrigger>
                        <SelectContent>
                          {BRAZILIAN_STATES.map((state) => (
                            <SelectItem key={state} value={state}>
                              {state}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-semibold mb-3">Dados Acadêmicos</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="course">Curso *</Label>
                      <Select value={formData.course} onValueChange={(value) => setFormData({ ...formData, course: value })}>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o curso" />
                        </SelectTrigger>
                        <SelectContent>
                          {COURSES.map((course) => (
                            <SelectItem key={course} value={course}>
                              {course}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="class">Turma/Período</Label>
                      <Input
                        id="class"
                        value={formData.class}
                        onChange={(e) => setFormData({ ...formData, class: e.target.value })}
                        placeholder="Ex: 1º Período"
                      />
                    </div>
                    <div>
                      <Label htmlFor="enrollmentDate">Data de Matrícula</Label>
                      <Input
                        id="enrollmentDate"
                        type="date"
                        value={formData.enrollmentDate}
                        onChange={(e) => setFormData({ ...formData, enrollmentDate: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label htmlFor="status">Status</Label>
                      <Select value={formData.status} onValueChange={(value: any) => setFormData({ ...formData, status: value })}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(STUDENT_STATUS).map(([key, label]) => (
                            <SelectItem key={key} value={key}>
                              {label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="col-span-2">
                      <Label htmlFor="defaultPaymentMode">Forma de Pagamento Padrão</Label>
                      <Select value={formData.defaultPaymentMode} onValueChange={(value) => setFormData({ ...formData, defaultPaymentMode: value })}>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                        <SelectContent>
                          {PAYMENT_MODES.map((mode) => (
                            <SelectItem key={mode} value={mode}>
                              {mode}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="col-span-2">
                      <Label htmlFor="observation">Observações</Label>
                      <Textarea
                        id="observation"
                        value={formData.observation}
                        onChange={(e) => setFormData({ ...formData, observation: e.target.value })}
                        placeholder="Anotações importantes..."
                        rows={3}
                      />
                    </div>
                  </div>
                </div>

                <div className="flex gap-2 justify-end">
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                    Cancelar
                  </Button>
                  <Button type="submit">
                    {editingStudent ? 'Atualizar' : 'Cadastrar'} Aluno
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="bg-card rounded-[14px] shadow-card border border-ink-200 p-6">
          <div className="flex gap-4 mb-6">
            <div className="relative w-full max-w-[420px]">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-ink-400 w-4 h-4" />
              <Input
                placeholder="Buscar por nome, e-mail ou curso..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 h-10"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredStudents.map((student) => (
              <div key={student.id} className="border border-ink-200 rounded-[14px] p-4 shadow-card transition-colors hover:bg-ink-50">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-7 h-7 shrink-0 rounded-full bg-ink-950 flex items-center justify-center text-[11px] font-semibold text-brand">
                      {student.fullName
                        .split(' ')
                        .filter(Boolean)
                        .slice(0, 2)
                        .map((p) => p[0])
                        .join('')
                        .toUpperCase() || <User className="w-3.5 h-3.5" />}
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-[14.5px] font-semibold text-ink-900">{student.fullName}</h3>
                      <p className="text-[13px] text-ink-500">{student.academic.course}</p>
                    </div>
                  </div>
                  <Badge className={getStatusColor(student.academic.status)}>
                    {STUDENT_STATUS[student.academic.status]}
                  </Badge>
                </div>
                <div className="space-y-1 text-[13px] text-ink-500 mb-3">
                  <p>{student.email}</p>
                  {student.phone && <p>{student.phone}</p>}
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" className="flex-1" onClick={() => handleEdit(student)}>
                    <Edit className="w-4 h-4 mr-1" />
                    Editar
                  </Button>
                  <Button aria-label="Excluir aluno" size="sm" variant="destructive" onClick={() => handleDelete(student.id)}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
            {filteredStudents.length === 0 && (
              <div className="col-span-full text-center py-12 text-muted-foreground">
                Nenhum aluno encontrado
              </div>
            )}
          </div>

          <div className="mt-4">
            <p className="text-sm text-muted-foreground">
              {filteredStudents.length} aluno(s) encontrado(s)
            </p>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default Students;
