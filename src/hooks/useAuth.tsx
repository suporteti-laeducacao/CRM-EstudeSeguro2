import { useState, useEffect, createContext, useContext, ReactNode, useRef } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

type UserRole = 'admin' | 'gerente' | 'vendedor' | 'supervisor' | 'financeiro';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  userRoles: UserRole[];
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: any }>;
  loading: boolean;
  rolesLoading: boolean;
  hasRole: (role: UserRole) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [userRoles, setUserRoles] = useState<UserRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [rolesLoading, setRolesLoading] = useState(true);
  const currentUserIdRef = useRef<string | null>(null);
  const rolesUserIdRef = useRef<string | null>(null);
  const navigate = useNavigate();

  const fetchUserRoles = async (userId: string, force = false) => {
    if (!force && rolesUserIdRef.current === userId) {
      setRolesLoading(false);
      return;
    }

    setRolesLoading(true);
    const { data, error } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId);
    
    if (!error && data) {
      setUserRoles(data.map(r => r.role as UserRole));
      rolesUserIdRef.current = userId;
    } else {
      rolesUserIdRef.current = null;
    }
    setRolesLoading(false);
  };

  useEffect(() => {
    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        const nextUser = session?.user ?? null;
        const nextUserId = nextUser?.id ?? null;
        const userChanged = currentUserIdRef.current !== nextUserId;

        if (userChanged) {
          currentUserIdRef.current = nextUserId;
          setSession(session);
          setUser(nextUser);
        }
        setLoading(false);
        
        // Fetch user roles when session changes
        if (session?.user) {
          if (rolesUserIdRef.current !== session.user.id) {
            setRolesLoading(true);
            setTimeout(() => {
              fetchUserRoles(session.user.id, true);
            }, 0);
          }
        } else {
          setUserRoles([]);
          currentUserIdRef.current = null;
          rolesUserIdRef.current = null;
          setRolesLoading(false);
        }
      }
    );

    // Check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      currentUserIdRef.current = session?.user?.id ?? null;
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
      
      if (session?.user) {
        fetchUserRoles(session.user.id);
      } else {
        rolesUserIdRef.current = null;
        setRolesLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    
    if (!error) {
      toast.success('Login realizado com sucesso!');
      navigate('/');
    } else {
      toast.error('Erro ao fazer login. Verifique suas credenciais.');
    }
    
    return { error };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUserRoles([]);
    currentUserIdRef.current = null;
    rolesUserIdRef.current = null;
    toast.success('Logout realizado com sucesso!');
    navigate('/auth');
  };

  const resetPassword = async (email: string) => {
    const redirectUrl = `${window.location.origin}/auth?mode=reset`;
    
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: redirectUrl
    });
    
    if (!error) {
      toast.success('Email de recuperação enviado! Verifique sua caixa de entrada.');
    } else {
      toast.error('Erro ao enviar email de recuperação.');
    }
    
    return { error };
  };

  const hasRole = (role: UserRole) => {
    return userRoles.includes(role);
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      session, 
      userRoles, 
      signIn, 
      signOut, 
      resetPassword,
      loading,
      rolesLoading,
      hasRole 
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
