import { ReactNode, useState } from 'react';
import { NavLink } from '@/components/NavLink';
import { 
  LayoutDashboard, 
  ShoppingCart, 
  DollarSign, 
  Users, 
  Trophy, 
  BarChart3, 
  Settings, 
  LogOut, 
  Award, 
  Briefcase, 
  UserPlus,
  Menu,
  X,
  ChevronDown,
  Bell,
  Search,
  UserCog,
  GraduationCap,
  Target,
  Crosshair,
  FileSearch,
  ScrollText,
  CalendarDays,
  PhoneCall,
  HandCoins
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from './ui/button';
import { Avatar, AvatarFallback } from './ui/avatar';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuLabel, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from './ui/dropdown-menu';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { cn } from '@/lib/utils';
import BrandLogo from '@/components/BrandLogo';
import { BrasiliaClock } from '@/components/BrasiliaClock';
import { usePayablesPendingCount } from '@/hooks/usePayablesPendingCount';
import { useAcompanhamentoPendingCount } from '@/hooks/useAcompanhamentoPendingCount';

interface LayoutProps {
  children: ReactNode;
}

type UserRole = 'admin' | 'gerente' | 'vendedor' | 'supervisor' | 'financeiro';

interface NavItem {
  to: string;
  icon: React.ElementType;
  label: string;
  roles?: UserRole[];
}

const Layout = ({ children }: LayoutProps) => {
  const { signOut, userRoles, user } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const payablesPending = usePayablesPendingCount();
  const acompanhamentoPending = useAcompanhamentoPendingCount();
  
  const hasRole = (role: UserRole) => userRoles.includes(role);
  const isAdmin = hasRole('admin');
  const isGerente = hasRole('gerente');
  const isVendedor = hasRole('vendedor');
  const isSupervisor = hasRole('supervisor');
  const isFinanceiro = hasRole('financeiro');
  
  const getRoleLabel = () => {
    if (isAdmin) return 'Administrador';
    if (isGerente) return 'Gerente';
    if (isSupervisor) return 'Supervisor';
    if (isFinanceiro) return 'Financeiro';
    if (isVendedor) return 'Vendedor';
    return 'Usuário';
  };

  const getRoleBadgeColor = () => {
    if (isAdmin) return 'bg-brand text-brand-foreground';
    if (isGerente) return 'bg-ink-800 text-ink-300';
    if (isSupervisor) return 'bg-ink-800 text-ink-300';
    if (isFinanceiro) return 'bg-ink-800 text-ink-300';
    if (isVendedor) return 'bg-ink-800 text-ink-300';
    return 'bg-ink-800 text-ink-300';
  };

  const getUserInitials = () => {
    if (user?.email) {
      return user.email.substring(0, 2).toUpperCase();
    }
    return 'U';
  };
  
  const navItems: NavItem[] = [
    { 
      to: '/', 
      icon: LayoutDashboard, 
      label: 'Dashboard',
      roles: ['admin', 'gerente', 'supervisor', 'financeiro']
    },
    { 
      to: '/certificacao', 
      icon: Award, 
      label: 'Certificação',
      roles: ['admin', 'gerente', 'vendedor', 'supervisor']
    },
    { 
      to: '/acompanhamento', 
      icon: PhoneCall, 
      label: 'Fila de Contatos',
      roles: ['admin', 'gerente', 'vendedor', 'supervisor']
    },
    { 
      to: '/negocios', 
      icon: Briefcase, 
      label: 'Previsão de vendas',
      roles: ['admin', 'gerente', 'vendedor', 'supervisor', 'financeiro']
    },
    { 
      to: '/leads', 
      icon: UserPlus, 
      label: 'Gestão de Leads',
      roles: ['admin', 'gerente', 'vendedor', 'supervisor']
    },
    { 
      to: '/vendas', 
      icon: ShoppingCart, 
      label: 'Vendas',
      roles: ['admin', 'gerente', 'vendedor', 'supervisor', 'financeiro']
    },
    { 
      to: '/financeiro', 
      icon: DollarSign, 
      label: 'Financeiro',
      roles: ['admin', 'gerente', 'financeiro']
    },
    { 
      to: '/cobrancas', 
      icon: HandCoins, 
      label: 'Gestão de Cobranças',
      roles: ['admin', 'gerente', 'financeiro']
    },
    { 
      to: '/alunos', 
      icon: Users, 
      label: 'Alunos',
      roles: ['admin', 'gerente', 'supervisor', 'financeiro']
    },
    { 
      to: '/ranking', 
      icon: Trophy, 
      label: 'Ranking',
      roles: ['admin', 'gerente', 'vendedor', 'supervisor', 'financeiro']
    },
    { 
      to: '/acompanhamento-metas', 
      icon: Crosshair, 
      label: 'Acomp. Metas',
      roles: ['admin', 'gerente', 'supervisor', 'financeiro']
    },
    { 
      to: '/relatorios', 
      icon: BarChart3, 
      label: 'Relatórios',
      roles: ['admin', 'gerente', 'financeiro']
    },
  ];

  const adminItems: NavItem[] = [
    { 
      to: '/usuarios', 
      icon: UserCog, 
      label: 'Usuários',
      roles: ['admin', 'gerente']
    },
    { 
      to: '/cursos', 
      icon: GraduationCap, 
      label: 'Cursos',
      roles: ['admin', 'gerente']
    },
    { 
      to: '/metas', 
      icon: Target, 
      label: 'Metas',
      roles: ['admin', 'gerente']
    },
    { 
      to: '/calendario', 
      icon: CalendarDays, 
      label: 'Calendário',
      roles: ['admin', 'gerente', 'supervisor', 'financeiro']
    },
    { 
      to: '/auditoria-ranking', 
      icon: FileSearch, 
      label: 'Auditoria Ranking',
      roles: ['admin', 'gerente', 'financeiro']
    },
    { 
      to: '/logs-sistema', 
      icon: ScrollText, 
      label: 'Logs do Sistema',
      roles: ['admin']
    },
    {
      to: '/configuracoes',
      icon: Settings,
      label: 'Configurações',
      roles: ['admin']
    },
  ];

  const canAccessItem = (item: NavItem) => {
    if (!item.roles || item.roles.length === 0) return true;
    return item.roles.some(role => hasRole(role));
  };

  const filteredNavItems = navItems.filter(canAccessItem);
  const filteredAdminItems = adminItems.filter(canAccessItem);

  return (
    <div className="min-h-screen flex w-full bg-background print:block">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-[#0C0C0D]/55 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside data-sidebar-root className={cn(
        "fixed lg:static inset-y-0 left-0 z-50 w-64 bg-sidebar border-r border-ink-800 flex flex-col transform transition-transform duration-300 ease-in-out lg:translate-x-0 print:hidden",
        sidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        {/* Logo */}
        <div className="p-6 border-b border-sidebar-border flex items-center justify-between">
          <div className="flex-1">
            <div className="flex justify-center mb-2 empty:hidden">
              <BrandLogo className="h-10 w-auto" nameClassName="font-display text-lg leading-tight text-sidebar-foreground text-center" />
            </div>
            <p className="text-[12px] text-ink-400 text-center">CRM de Vendas</p>
          </div>
          <Button
            variant="ghost"
            size="icon" aria-label="Fechar menu"
            className="lg:hidden text-sidebar-foreground"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 overflow-y-auto">
          <ul className="space-y-1">
            {filteredNavItems.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  end={item.to === '/'}
                  className="flex h-10 items-center gap-3 px-3 rounded-[10px] text-[14px] font-medium text-ink-400 hover:bg-sidebar-accent hover:text-white transition-colors duration-150 group"
                  activeClassName="bg-sidebar-primary text-sidebar-primary-foreground hover:bg-sidebar-primary hover:text-sidebar-primary-foreground"
                  onClick={() => setSidebarOpen(false)}
                >
                  <item.icon className="w-[18px] h-[18px] shrink-0" />
                  <span>{item.label}</span>
                  {item.to === '/acompanhamento' && acompanhamentoPending > 0 && (
                    <span
                      className="ml-auto min-w-[20px] h-5 px-1.5 rounded-full bg-destructive text-white text-[11px] font-bold flex items-center justify-center"
                      title={`${acompanhamentoPending} aluno(s) a contatar`}
                    >
                      {acompanhamentoPending}
                    </span>
                  )}
                  {item.to === '/financeiro' && payablesPending > 0 && (
                    <span
                      className="ml-auto min-w-[20px] h-5 px-1.5 rounded-full bg-destructive text-white text-[11px] font-bold flex items-center justify-center"
                      title={`${payablesPending} conta(s) a pagar vencendo hoje ou em atraso`}
                    >
                      {payablesPending}
                    </span>
                  )}
                </NavLink>
              </li>
            ))}
            
            {filteredAdminItems.length > 0 && (
              <>
                <li className="pt-6 pb-2">
                  <p className="px-3 text-[11.5px] font-semibold text-ink-500">
                    Administração
                  </p>
                </li>
                {filteredAdminItems.map((item) => (
                  <li key={item.to}>
                    <NavLink
                      to={item.to}
                      end
                      className="flex h-10 items-center gap-3 px-3 rounded-[10px] text-[14px] font-medium text-ink-400 hover:bg-sidebar-accent hover:text-white transition-colors duration-150 group"
                      activeClassName="bg-sidebar-primary text-sidebar-primary-foreground hover:bg-sidebar-primary hover:text-sidebar-primary-foreground"
                      onClick={() => setSidebarOpen(false)}
                    >
                      <item.icon className="w-[18px] h-[18px] shrink-0" />
                      <span>{item.label}</span>
                    </NavLink>
                  </li>
                ))}
              </>
            )}
          </ul>
        </nav>

        {/* User Profile Footer */}
        <div className="p-4 border-t border-sidebar-border">
          <div className="flex items-center gap-3 px-3 py-3 rounded-lg bg-sidebar-accent/50">
            <Avatar className="h-10 w-10 ring-2 ring-brand">
              <AvatarFallback className="bg-ink-950 text-brand font-bold">
                {getUserInitials()}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-[14px] font-medium text-white truncate">
                {user?.email?.split('@')[0] || 'Usuário'}
              </p>
              <Badge className={cn("text-xs px-2 py-0", getRoleBadgeColor())}>
                {getRoleLabel()}
              </Badge>
            </div>
            <Button 
              variant="ghost" 
              size="icon" aria-label="Sair"
              onClick={signOut}
              className="text-ink-400 hover:text-destructive hover:bg-destructive/10"
              title="Sair"
            >
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 min-w-0 flex flex-col min-h-screen">
        {/* Topbar */}
        <header className="h-16 bg-white border-b border-ink-200 flex items-center justify-between px-4 lg:px-6 sticky top-0 z-30 print:hidden">
          {/* Left side */}
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon" aria-label="Abrir menu"
              className="lg:hidden"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu className="h-5 w-5" />
            </Button>
            
            {/* Search (hidden on mobile) */}
            <div className="hidden md:flex relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-400 z-10" />
              <Input
                placeholder="Buscar..."
                className="pl-9 h-9 w-64 bg-ink-50 border-0 rounded-[10px] focus-visible:ring-1"
              />
            </div>
          </div>

          {/* Right side */}
          <div className="flex items-center gap-2">
            <BrasiliaClock className="mr-2" />

            {/* Notifications */}
            <Button variant="ghost" size="icon" aria-label="Notificações" className="relative">
              <Bell className="h-5 w-5 text-ink-600" />
              <span className="absolute top-1 right-1 w-2 h-2 bg-destructive rounded-full" />
            </Button>

            {/* User dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="flex items-center gap-2 px-2">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="bg-ink-950 text-brand text-sm">
                      {getUserInitials()}
                    </AvatarFallback>
                  </Avatar>
                  <span className="hidden md:inline text-[13.5px] font-medium text-ink-800">
                    {user?.email?.split('@')[0]}
                  </span>
                  <ChevronDown className="h-4 w-4 text-ink-400" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium">{user?.email?.split('@')[0]}</p>
                    <p className="text-xs text-muted-foreground">{user?.email}</p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem>
                  <Users className="mr-2 h-4 w-4" />
                  Meu Perfil
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <Settings className="mr-2 h-4 w-4" />
                  Configurações
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem 
                  onClick={signOut}
                  className="text-destructive focus:text-destructive"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  Sair
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-auto bg-ink-50 print:overflow-visible print:bg-white">
          <div className="w-full min-w-0 p-6 lg:p-8 print:p-0">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};

export default Layout;
