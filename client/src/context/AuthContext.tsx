import React, { createContext, useContext, useState, useEffect } from "react";
import { useLocation } from "wouter";
import { toast } from "@/hooks/use-toast";

type User = {
  id: number;
  name: string;
  email: string;
  companyId?: number;
  isDeveloper?: boolean;
  isKeyUser?: boolean;
  permissions?: string[];
  canConfirmDelivery?: boolean;
  canCreateOrder?: boolean;
  role?: {
    id: number;
    name: string;
    permissions?: string[];
  };
};

type AuthContextType = {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<boolean | { success: boolean; requiresPasswordChange: boolean; message?: string; }>;
  logout: () => void;
  checkAuth: () => Promise<boolean>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [, navigate] = useLocation();

  // Verificar autenticação no carregamento inicial
  useEffect(() => {
    const initAuth = async () => {
      setIsLoading(true);
      try {
        await checkAuth();
      } catch (error) {
        console.error("Erro na verificação inicial de autenticação", error);
      } finally {
        setIsLoading(false);
      }
    };

    initAuth();
  }, []);

  // Verificar se o usuário está autenticado
  const checkAuth = async () => {
    try {
      const response = await fetch("/api/auth/me", {
        credentials: "include",
        cache: 'no-cache'
      });

      if (!response.ok) {
        setUser(null);
        return false;
      }

      const userData = await response.json();

      // Verificar se o usuário é o administrador/keyuser
      if (userData.success && userData.user && userData.user.isKeyUser) {
        // Adicionar propriedade isDeveloper para compatibilidade com o sistema de autorização
        userData.user.isDeveloper = true;
        userData.user.permissions = ['*']; // Permissão total
      }

      if (userData.success && userData.user) {
        setUser(userData.user);
        return true;
      } else {
        setUser(null);
        return false;
      }
    } catch (error) {
      console.error("Erro ao verificar autenticação", error);
      setUser(null);
      return false;
    }
  };

  // Fazer login
  const login = async (email: string, password: string) => {
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
        credentials: "include"
      });

      const data = await response.json();

      if (data.success) {
        if (data.requiresPasswordChange) {
          // Definir usuário temporariamente para a tela de mudança de senha
          setUser(data.user);
          return { 
            success: true, 
            requiresPasswordChange: true,
            message: data.message
          };
        } else {
          setUser(data.user);
          return { 
            success: true, 
            requiresPasswordChange: false 
          };
        }
      } else {
        return { success: false, message: data.message };
      }
    } catch (error) {
      return { success: false, message: 'Erro ao fazer login' };
    }
  };

  // Fazer logout
  const logout = async () => {
    try {
      console.log("🚪 Iniciando processo de logout...");
      
      // Fazer requisição de logout
      const response = await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include"
      });

      console.log("📡 Resposta do logout:", response.status);

      // Limpar estado local independente da resposta
      setUser(null);
      
      // Navegar para login
      navigate("/login");
      
      // Mostrar toast apenas se não estiver em um processo de reset de senha
      if (!window.location.pathname.includes('reset')) {
        toast({
          title: "Logout realizado",
          description: "Você foi desconectado com sucesso"
        });
      }
      
      console.log("✅ Logout concluído com sucesso");
      
    } catch (error) {
      console.error("❌ Erro ao fazer logout:", error);
      
      // Mesmo com erro, desconectar o usuário localmente
      setUser(null);
      navigate("/login");
      
      console.log("🔄 Logout forçado devido a erro");
    }
  };

  const value = {
    user,
    isAuthenticated: !!user,
    isLoading,
    login,
    logout,
    checkAuth
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth deve ser usado dentro de um AuthProvider");
  }
  return context;
};