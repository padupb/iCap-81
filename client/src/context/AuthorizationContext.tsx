import React, { createContext, useContext, ReactNode } from "react";
import { useAuth } from "./AuthContext";

interface AuthorizationContextType {
  /**
   * Verifica se o usuário tem permissão para visualizar determinada área
   * @param area Identificador da área (dashboard, orders, etc)
   */
  canView: (area: string) => boolean;

  /**
   * Verifica se o usuário tem permissão para editar determinada área
   * @param area Identificador da área (dashboard, orders, etc)
   */
  canEdit: (area: string) => boolean;
  
  /**
   * Verifica se o usuário tem permissão para cadastrar em determinada área
   * @param area Identificador da área (orders, purchase_orders, companies, users, products)
   */
  canCreate: (area: string) => boolean;
}

const AuthorizationContext = createContext<AuthorizationContextType | undefined>(undefined);

export const useAuthorization = () => {
  const context = useContext(AuthorizationContext);
  if (context === undefined) {
    throw new Error("useAuthorization deve ser usado dentro de um AuthorizationProvider");
  }
  return context;
};

interface AuthorizationProviderProps {
  children: ReactNode;
}

export const AuthorizationProvider: React.FC<AuthorizationProviderProps> = ({ children }) => {
  const { user } = useAuth();

  const canView = (area: string): boolean => {
    // Se não há usuário autenticado, nega acesso
    if (!user) return false;

    // O usuário keyuser (administrator) tem acesso a tudo
    if (user.isDeveloper || user.isKeyUser) return true;

    // Se o usuário tem permissão total (*), permite acesso
    if (user.permissions && user.permissions.includes("*")) return true;

    // Se o usuário não tem permissões definidas, nega acesso
    if (!user.permissions || !Array.isArray(user.permissions)) return false;

    // Verifica se o usuário tem permissão para visualizar a área
    return user.permissions.includes(`view_${area}`) || user.permissions.includes("*");
  };

  const canEdit = (area: string): boolean => {
    // Se não há usuário autenticado, nega acesso
    if (!user) return false;

    // O usuário keyuser (administrator) tem acesso a tudo
    if (user.isDeveloper || user.isKeyUser) return true;

    // Se o usuário tem permissão total (*), permite acesso
    if (user.permissions && user.permissions.includes("*")) return true;

    // Se o usuário não tem permissões definidas, nega acesso
    if (!user.permissions || !Array.isArray(user.permissions)) return false;

    // Verifica se o usuário tem permissão para editar a área
    return user.permissions.includes(`edit_${area}`) || user.permissions.includes("*");
  };

  const canCreate = (area: string): boolean => {
    // Se não há usuário autenticado, nega acesso
    if (!user) return false;

    // O usuário keyuser (administrator) tem acesso a tudo
    if (user.isDeveloper || user.isKeyUser) return true;

    // Se o usuário tem permissão total (*), permite acesso
    if (user.permissions && user.permissions.includes("*")) return true;

    // Se o usuário não tem permissões definidas, nega acesso
    if (!user.permissions || !Array.isArray(user.permissions)) return false;

    // Verifica se o usuário tem permissão para cadastrar na área
    return user.permissions.includes(`create_${area}`) || user.permissions.includes("*");
  };

  return (
    <AuthorizationContext.Provider value={{ canView, canEdit, canCreate }}>
      {children}
    </AuthorizationContext.Provider>
  );
};