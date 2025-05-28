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
    console.log(`🔍 [AuthorizationContext] Verificando permissão view_${area} para usuário:`, {
      userId: user?.id,
      name: user?.name,
      isKeyUser: user?.isKeyUser,
      isDeveloper: user?.isDeveloper,
      permissions: user?.permissions,
      role: user?.role
    });

    // Se não há usuário autenticado, nega acesso
    if (!user) {
      console.log(`❌ [AuthorizationContext] Usuário não autenticado - negando acesso a ${area}`);
      return false;
    }

    // REGRA ESPECIAL: Usuário ID = 1, ID = 9999 ou KeyUser tem acesso total
    if (user.id === 1 || user.id === 9999 || user.isDeveloper || user.isKeyUser) {
      console.log(`✅ [AuthorizationContext] Usuário especial (ID=${user.id}, isKeyUser=${user.isKeyUser}, isDeveloper=${user.isDeveloper}) - liberando acesso total a ${area}`);
      return true;
    }

    // Verificar permissões do usuário
    let userPermissions: string[] = [];
    
    // Priorizar permissões diretas do usuário
    if (user.permissions && Array.isArray(user.permissions)) {
      userPermissions = user.permissions;
      console.log(`🔐 [AuthorizationContext] Usando permissões diretas do usuário:`, userPermissions);
    }
    // Se não há permissões diretas, tentar usar permissões da função
    else if (user.role && user.role.permissions && Array.isArray(user.role.permissions)) {
      userPermissions = user.role.permissions;
      console.log(`🔐 [AuthorizationContext] Usando permissões da função ${user.role.name}:`, userPermissions);
    }
    // Se não há permissões definidas, negar acesso
    else {
      console.log(`❌ [AuthorizationContext] Usuário sem permissões definidas - negando acesso a ${area}`);
      return false;
    }

    // Se o usuário tem permissão total (*), permite acesso
    if (userPermissions.includes("*")) {
      console.log(`✅ [AuthorizationContext] Permissão total (*) encontrada - liberando acesso a ${area}`);
      return true;
    }

    // Verifica se o usuário tem permissão para visualizar a área
    const hasPermission = userPermissions.includes(`view_${area}`);
    console.log(`${hasPermission ? '✅' : '❌'} [AuthorizationContext] Permissão view_${area} ${hasPermission ? 'encontrada' : 'não encontrada'} - ${hasPermission ? 'liberando' : 'negando'} acesso`);
    
    return hasPermission;
  };

  const canEdit = (area: string): boolean => {
    console.log(`🔍 [AuthorizationContext] Verificando permissão edit_${area} para usuário:`, {
      userId: user?.id,
      name: user?.name,
      permissions: user?.permissions,
      role: user?.role
    });

    // Se não há usuário autenticado, nega acesso
    if (!user) return false;

    // REGRA ESPECIAL: Usuário ID = 1, ID = 9999 ou KeyUser tem acesso total
    if (user.id === 1 || user.id === 9999 || user.isDeveloper || user.isKeyUser) return true;

    // Verificar permissões do usuário
    let userPermissions: string[] = [];
    
    // Priorizar permissões diretas do usuário
    if (user.permissions && Array.isArray(user.permissions)) {
      userPermissions = user.permissions;
    }
    // Se não há permissões diretas, tentar usar permissões da função
    else if (user.role && user.role.permissions && Array.isArray(user.role.permissions)) {
      userPermissions = user.role.permissions;
    }
    // Se não há permissões definidas, negar acesso
    else {
      return false;
    }

    // Se o usuário tem permissão total (*), permite acesso
    if (userPermissions.includes("*")) return true;

    // Verifica se o usuário tem permissão para editar a área
    return userPermissions.includes(`edit_${area}`);
  };

  const canCreate = (area: string): boolean => {
    console.log(`🔍 [AuthorizationContext] Verificando permissão create_${area} para usuário:`, {
      userId: user?.id,
      name: user?.name,
      permissions: user?.permissions,
      role: user?.role
    });

    // Se não há usuário autenticado, nega acesso
    if (!user) return false;

    // REGRA ESPECIAL: Usuário ID = 1, ID = 9999 ou KeyUser tem acesso total
    if (user.id === 1 || user.id === 9999 || user.isDeveloper || user.isKeyUser) return true;

    // Verificar permissões do usuário
    let userPermissions: string[] = [];
    
    // Priorizar permissões diretas do usuário
    if (user.permissions && Array.isArray(user.permissions)) {
      userPermissions = user.permissions;
    }
    // Se não há permissões diretas, tentar usar permissões da função
    else if (user.role && user.role.permissions && Array.isArray(user.role.permissions)) {
      userPermissions = user.role.permissions;
    }
    // Se não há permissões definidas, negar acesso
    else {
      return false;
    }

    // Se o usuário tem permissão total (*), permite acesso
    if (userPermissions.includes("*")) return true;

    // Verifica se o usuário tem permissão para cadastrar na área
    return userPermissions.includes(`create_${area}`);
  };

  return (
    <AuthorizationContext.Provider value={{ canView, canEdit, canCreate }}>
      {children}
    </AuthorizationContext.Provider>
  );
};