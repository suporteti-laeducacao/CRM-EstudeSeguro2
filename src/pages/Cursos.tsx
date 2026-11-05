import Layout from '@/components/Layout';
import PageHeader from '@/components/PageHeader';
import CursosManagement from '@/components/settings/CursosManagement';

const Cursos = () => {
  return (
    <Layout>
      <div className="space-y-6">
        <PageHeader
          title="Cadastro de Cursos"
          subtitle="Gerencie os cursos disponíveis no sistema"
          className="mb-0"
        />
        <CursosManagement />
      </div>
    </Layout>
  );
};

export default Cursos;
