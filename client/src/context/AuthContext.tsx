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
  login: (email: string, password: string) => Promise<boolean>;
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
      console.log("🔍 [AuthContext] Verificando autenticação...");
      
      const response = await fetch("/api/auth/me", {
        credentials: "include"
      });

      if (!response.ok) {
        console.log("❌ [AuthContext] Resposta não OK:", response.status);
        setUser(null);
        return false;
      }

      const userData = await response.json();
      console.log("📥 [AuthContext] Dados recebidos do servidor:", userData);
      
      // Verificar se o usuário é o administrador/keyuser
      if (userData.success && userData.user && userData.user.isKeyUser) {
        console.log("🔑 [AuthContext] KeyUser detectado - adicionando propriedades especiais");
        // Adicionar propriedade isDeveloper para compatibilidade com o sistema de autorização
        userData.user.isDeveloper = true;
        userData.user.permissions = ['*']; // Permissão total
      }
      
      if (userData.success && userData.user) {
        console.log("✅ [AuthContext] Usuário autenticado:", {
          id: userData.user.id,
          name: userData.user.name,
          isKeyUser: userData.user.isKeyUser,
          permissions: userData.user.permissions
        });
        setUser(userData.user);
        return true;
      } else {
        throw new Error("Formato de resposta inválido");
      }
    } catch (error) {
      console.error("❌ [AuthContext] Erro ao verificar autenticação:", error);
      setUser(null);
      return false;
    }
  };

  // Fazer login
  const login = async (email: string, password: string) => {
    try {
      console.log("🔍 [AuthContext] Tentativa de login:", { email, passwordLength: password?.length });
      
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ email, password }),
        credentials: "include"
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: "Falha na autenticação" }));
        console.log("❌ [AuthContext] Falha no login:", errorData);
        throw new Error(errorData.message || "Credenciais inválidas");
      }

      const userData = await response.json();
      console.log("📥 [AuthContext] Dados de login recebidos:", userData);
      
      // Verificar se o usuário é o administrador/keyuser
      if (userData.user && userData.user.isKeyUser) {
        console.log("🔑 [AuthContext] KeyUser detectado no login - adicionando propriedades especiais");
        // Adicionar propriedade isDeveloper para compatibilidade com o sistema de autorização
        userData.user.isDeveloper = true;
      }
      
      console.log("✅ [AuthContext] Login realizado com sucesso:", {
        id: userData.user?.id,
        name: userData.user?.name,
        isKeyUser: userData.user?.isKeyUser,
        permissions: userData.user?.permissions
      });
      
      setUser(userData.user);
      return true;
    } catch (error) {
      console.error("❌ [AuthContext] Erro no login:", error);
      throw error;
    }
  };

  // Fazer logout
  const logout = async () => {
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include"
      });
      
      setUser(null);
      navigate("/login");
      toast({
        title: "Logout realizado",
        description: "Você foi desconectado com sucesso"
      });
    } catch (error) {
      console.error("Erro ao fazer logout", error);
      // Mesmo com erro, desconectar o usuário localmente
      setUser(null);
      navigate("/login");
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