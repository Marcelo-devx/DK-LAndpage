import { createContext, useContext, useState, useEffect, useCallback, ReactNode, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { getSessionWithRetry, getSessionOrUser } from '@/lib/auth';
import { logger } from '@/lib/logger';
import type { Session, User } from '@supabase/supabase-js';

interface Profile {
  id: string;
  first_name?: string;
  last_name?: string;
  phone?: string;
  cpf_cnpj?: string;
  gender?: string;
  date_of_birth?: string;
  cep?: string;
  street?: string;
  number?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
  points?: number;
  current_tier_name?: string;
  role?: string;
  must_change_password?: boolean;
  referral_code?: string;
  [key: string]: any;
}

interface AuthContextType {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  isAdmin: boolean;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [initializing, setInitializing] = useState(true);

  // Ref to track current user ID and avoid stale closure issues
  const currentUserIdRef = useRef<string | null>(null);

  // Keep ref synced with user state to avoid stale closure in onAuthStateChange
  useEffect(() => {
    currentUserIdRef.current = user?.id ?? null;
  }, [user]);

  // Função para buscar perfil do usuário
  const fetchProfile = useCallback(async (userId: string): Promise<Profile | null> => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) {
        console.error('[AuthContext] Error fetching profile:', error);
        return null;
      }

      return data as Profile | null;
    } catch (error) {
      console.error('[AuthContext] Exception fetching profile:', error);
      return null;
    }
  }, []);

  // Função para recarregar dados do usuário
  const refresh = useCallback(async () => {
    try {
      const { session, user: currentUser } = await getSessionOrUser();

      if (currentUser) {
        const userId = session?.user?.id || currentUser.id;
        const userProfile = await fetchProfile(userId);
        const isAdminUser = userProfile?.role === 'adm';

        setSession(session);
        setUser(currentUser);
        setProfile(userProfile);
        setIsAdmin(isAdminUser);
      } else {
        setSession(null);
        setUser(null);
        setProfile(null);
        setIsAdmin(false);
      }
    } catch (error) {
      console.error('[AuthContext] Error refreshing auth state:', error);
    }
  }, [fetchProfile]);

  // Inicialização - carregar sessão e perfil
  useEffect(() => {
    let mounted = true;
    let initializationComplete = false;

    const initializeAuth = async () => {
      try {
        // Usa getSessionWithRetry para casos de renovação de token
        const session = await getSessionWithRetry(2, 800);

        if (mounted) {
          setSession(session);

          if (session?.user) {
            setUser(session.user);
            // Fetch profile com try/catch - se falhar, continua sem perfil
            try {
              const userProfile = await fetchProfile(session.user.id);

              if (mounted && userProfile) {
                setProfile(userProfile);
                setIsAdmin(userProfile.role === 'adm');
              }
            } catch (profileError) {
              logger.warn('[AuthContext] Failed to fetch profile during initialization - continuing without profile', profileError);
              // Não quebra a aplicação - continua sem perfil
              if (mounted) {
                setProfile(null);
                setIsAdmin(false);
              }
            }
          }
        }
      } catch (error) {
        console.error('[AuthContext] Error initializing auth:', error);
        // Mesmo com erro, libera o loading para app renderizar
      } finally {
        if (mounted) {
          initializationComplete = true;
          setInitializing(false);
          setLoading(false);
        }
      }
    };

    initializeAuth();

    // Listener único de auth state change
    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, currentSession) => {
      logger.log('[AuthContext] Auth state changed:', event, currentSession?.user?.id);

      if (!mounted) return;

      try {
        setSession(currentSession);
        setUser(currentSession?.user || null);

        if (event === 'SIGNED_IN' && currentSession?.user) {
          // Ignorar SIGNED_IN se já for o mesmo usuário (evita re-renderizações desnecessárias)
          if (currentUserIdRef.current === currentSession.user.id) {
            logger.log('[AuthContext] Ignoring redundant SIGNED_IN for same user');
            if (mounted) setLoading(false); // ← libera o loading antes de sair
            return;
          }
          try {
            const userProfile = await fetchProfile(currentSession.user.id);
            if (mounted) {
              setProfile(userProfile);
              setIsAdmin(userProfile?.role === 'adm' || false);
            }
          } catch (profileError) {
            logger.warn('[AuthContext] Failed to fetch profile on SIGNED_IN - continuing without profile', profileError);
            if (mounted) {
              setProfile(null);
              setIsAdmin(false);
            }
          }
        } else if (event === 'SIGNED_OUT') {
          if (mounted) {
            setProfile(null);
            setIsAdmin(false);
          }
        } else if (event === 'USER_UPDATED' && currentSession?.user) {
          try {
            const userProfile = await fetchProfile(currentSession.user.id);
            if (mounted) {
              setProfile(userProfile);
              setIsAdmin(userProfile?.role === 'adm' || false);
            }
          } catch (profileError) {
            logger.warn('[AuthContext] Failed to fetch profile on USER_UPDATED - continuing without profile', profileError);
          }
        }
        // TOKEN_REFRESHED e INITIAL_SESSION não fazem nada específico
        // Mantém o perfil atualizado para evitar desconexão visual
      } catch (error) {
        console.error('[AuthContext] Error handling auth state change:', error);
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    });

    return () => {
      mounted = false;
      try {
        authListener?.subscription?.unsubscribe();
      } catch (e) {
        // ignore
      }
    };
  }, [fetchProfile]);

  // Valores do contexto
  const value: AuthContextType = {
    session,
    user,
    profile,
    loading: loading || initializing,
    isAdmin,
    refresh,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// Hook customizado para usar o AuthContext
export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};