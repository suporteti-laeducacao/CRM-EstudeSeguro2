import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import ProtectedRoute from "@/components/ProtectedRoute";
import Index from "./pages/Index";
import Sales from "./pages/Sales";
import Financial from "./pages/Financial";
import Students from "./pages/Students";
import Ranking from "./pages/Ranking";
import Reports from "./pages/Reports";
import Auth from "./pages/Auth";
import UserManagement from "./pages/UserManagement";
import NotFound from "./pages/NotFound";
import Certificacao from "./pages/Certificacao";
import Negocios from "./pages/Negocios";
import GruposRepasse from "./pages/GruposRepasse";
import Leads from "./pages/Leads";
import Cursos from "./pages/Cursos";
import Metas from "./pages/Metas";
import AcompanhamentoMetas from "./pages/AcompanhamentoMetas";
import RankingAudit from "./pages/RankingAudit";
import SystemLogs from "./pages/SystemLogs";
import Calendario from "./pages/Calendario";
import Acompanhamento from "./pages/Acompanhamento";
import Cobrancas from "./pages/Cobrancas";
import DesignSystem from "./pages/DesignSystem";
import Configuracoes from "./pages/Configuracoes";
import { BrandDocumentTitle } from "./components/BrandLogo";
import PayablesAlertDialog from "./components/PayablesAlertDialog";
import AcompanhamentoAlertDialog from "./components/AcompanhamentoAlertDialog";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
        <BrandDocumentTitle />
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <PayablesAlertDialog />
          <AcompanhamentoAlertDialog />
          <Routes>
            <Route path="/auth" element={<Auth />} />
            <Route path="/" element={<ProtectedRoute allowedRoles={['admin','gerente','supervisor','financeiro']}><Index /></ProtectedRoute>} />
            <Route path="/certificacao" element={<ProtectedRoute allowedRoles={['admin','gerente','supervisor','vendedor']}><Certificacao /></ProtectedRoute>} />
            <Route path="/negocios" element={<ProtectedRoute allowedRoles={['admin','gerente','supervisor','vendedor','financeiro']}><Negocios /></ProtectedRoute>} />
            <Route path="/leads" element={<ProtectedRoute allowedRoles={['admin','gerente','supervisor','vendedor']}><Leads /></ProtectedRoute>} />
            <Route path="/vendas" element={<ProtectedRoute allowedRoles={['admin','gerente','supervisor','vendedor','financeiro']}><Sales /></ProtectedRoute>} />
            <Route path="/cobrancas" element={<ProtectedRoute allowedRoles={['admin','gerente','financeiro']}><Cobrancas /></ProtectedRoute>} />
            <Route path="/financeiro" element={<ProtectedRoute allowedRoles={['admin','gerente','financeiro']}><Financial /></ProtectedRoute>} />
            <Route path="/alunos" element={<ProtectedRoute allowedRoles={['admin','gerente','supervisor','financeiro']}><Students /></ProtectedRoute>} />
            <Route path="/ranking" element={<ProtectedRoute allowedRoles={['admin','gerente','supervisor','vendedor','financeiro']}><Ranking /></ProtectedRoute>} />
            <Route path="/relatorios" element={<ProtectedRoute allowedRoles={['admin','gerente','financeiro']}><Reports /></ProtectedRoute>} />
            <Route path="/usuarios" element={<ProtectedRoute allowedRoles={['admin','gerente']}><UserManagement /></ProtectedRoute>} />
            <Route path="/cursos" element={<ProtectedRoute allowedRoles={['admin','gerente']}><Cursos /></ProtectedRoute>} />
            <Route path="/grupos-repasse" element={<ProtectedRoute allowedRoles={['admin','gerente']}><GruposRepasse /></ProtectedRoute>} />
            <Route path="/metas" element={<ProtectedRoute allowedRoles={['admin','gerente']}><Metas /></ProtectedRoute>} />
            <Route path="/acompanhamento-metas" element={<ProtectedRoute allowedRoles={['admin','gerente','supervisor','financeiro']}><AcompanhamentoMetas /></ProtectedRoute>} />
            <Route path="/auditoria-ranking" element={<ProtectedRoute allowedRoles={['admin','gerente','financeiro']}><RankingAudit /></ProtectedRoute>} />
            <Route path="/logs-sistema" element={<ProtectedRoute allowedRoles={['admin']}><SystemLogs /></ProtectedRoute>} />
            <Route path="/calendario" element={<ProtectedRoute allowedRoles={['admin','gerente','supervisor','financeiro']}><Calendario /></ProtectedRoute>} />
            <Route path="/acompanhamento" element={<ProtectedRoute allowedRoles={['admin','gerente','supervisor','vendedor']}><Acompanhamento /></ProtectedRoute>} />
            <Route path="/configuracoes" element={<ProtectedRoute allowedRoles={['admin']}><Configuracoes /></ProtectedRoute>} />
            <Route path="/design-system" element={<ProtectedRoute allowedRoles={['admin']}><DesignSystem /></ProtectedRoute>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
