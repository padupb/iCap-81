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

export function AuthorizationProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();

  /**
   * REGRA DE NEGÓCIO SIMPLES:
   * 1. Consultar a "função cadastrada" (role) do usuário
   * 2. Consultar quais menus devem ser exibidos de acordo com a coluna "permissions" da tabela "user_roles"
   */
  const canView = (area: string): boolean => {
    console.log(`🔍 [AuthorizationContext] Verificando permissão view_${area} para usuário:`, {
      userId: user?.id,
      name: user?.name,
      roleName: user?.role?.name,
      permissions: user?.permissions || user?.role?.permissions
    });

    // Se não há usuário autenticado, nega acesso
    if (!user) {
      console.log(`❌ [AuthorizationContext] Usuário não autenticado - negando acesso a ${area}`);
      return false;
    }

    // REGRA ESPECIAL: KeyUser (ID = 9999) ou usuário ID = 1 tem acesso total
    if (user.id === 9999 || user.id === 1 || user.isKeyUser) {
      console.log(`✅ [AuthorizationContext] KeyUser detectado (ID=${user.id}) - permitindo acesso total a ${area}`);
      return true;
    }

    // REGRA PRINCIPAL: Verificar permissões baseadas na função do usuário
    let userPermissions: string[] = [];
    
    // 1. Priorizar permissões diretas do usuário (se existirem)
    if (user.permissions && Array.isArray(user.permissions)) {
      userPermissions = user.permissions;
      console.log(`📋 [AuthorizationContext] Usando permissões diretas do usuário:`, userPermissions);
    }
    // 2. Se não há permissões diretas, usar permissões da função (role)
    else if (user.role && user.role.permissions && Array.isArray(user.role.permissions)) {
      userPermissions = user.role.permissions;
      console.log(`📋 [AuthorizationContext] Usando permissões da função "${user.role.name}":`, userPermissions);
    }
    // 3. Se não há função ou permissões, negar acesso
    else {
      console.log(`❌ [AuthorizationContext] Usuário sem função ou permissões definidas - negando acesso a ${area}`);
      return false;
    }

    // Verificar se tem permissão total (*)
    if (userPermissions.includes("*")) {
      console.log(`✅ [AuthorizationContext] Permissão total (*) encontrada - permitindo acesso a ${area}`);
      return true;
    }

    // Verificar se tem a permissão específica para visualizar a área
    const requiredPermission = `view_${area}`;
    const hasPermission = userPermissions.includes(requiredPermission);
    
    console.log(`${hasPermission ? '✅' : '❌'} [AuthorizationContext] Permissão "${requiredPermission}" ${hasPermission ? 'encontrada' : 'não encontrada'} - ${hasPermission ? 'permitindo' : 'negando'} acesso a ${area}`);
    
    return hasPermission;
  };

  const canEdit = (area: string): boolean => {
    console.log(`🔍 [AuthorizationContext] Verificando permissão edit_${area} para usuário:`, {
      userId: user?.id,
      name: user?.name,
      roleName: user?.role?.name,
      permissions: user?.permissions || user?.role?.permissions
    });

    // Se não há usuário autenticado, nega acesso
    if (!user) return false;

    // REGRA ESPECIAL: KeyUser (ID = 9999) ou usuário ID = 1 tem acesso total
    if (user.id === 9999 || user.id === 1 || user.isKeyUser) return true;

    // REGRA PRINCIPAL: Verificar permissões baseadas na função do usuário
    let userPermissions: string[] = [];
    
    if (user.permissions && Array.isArray(user.permissions)) {
      userPermissions = user.permissions;
    } else if (user.role && user.role.permissions && Array.isArray(user.role.permissions)) {
      userPermissions = user.role.permissions;
    } else {
      return false;
    }

    // Verificar se tem permissão total (*)
    if (userPermissions.includes("*")) return true;

    // Verificar se tem a permissão específica para editar a área
    const requiredPermission = `edit_${area}`;
    return userPermissions.includes(requiredPermission);
  };

  const canCreate = (area: string): boolean => {
    console.log(`🔍 [AuthorizationContext] Verificando permissão create_${area} para usuário:`, {
      userId: user?.id,
      name: user?.name,
      roleName: user?.role?.name,
      permissions: user?.permissions || user?.role?.permissions
    });

    // Se não há usuário autenticado, nega acesso
    if (!user) return false;

    // REGRA ESPECIAL: KeyUser (ID = 9999) ou usuário ID = 1 tem acesso total
    if (user.id === 9999 || user.id === 1 || user.isKeyUser) return true;

    // REGRA PRINCIPAL: Verificar permissões baseadas na função do usuário
    let userPermissions: string[] = [];
    
    if (user.permissions && Array.isArray(user.permissions)) {
      userPermissions = user.permissions;
    } else if (user.role && user.role.permissions && Array.isArray(user.role.permissions)) {
      userPermissions = user.role.permissions;
    } else {
      return false;
    }

    // Verificar se tem permissão total (*)
    if (userPermissions.includes("*")) return true;

    // Verificar se tem a permissão específica para criar na área
    const requiredPermission = `create_${area}`;
    return userPermissions.includes(requiredPermission);
  };

  return (
    <AuthorizationContext.Provider value={{ canView, canEdit, canCreate }}>
      {children}
    </AuthorizationContext.Provider>
  );
}

export function useAuthorization() {
  const context = useContext(AuthorizationContext);
  if (context === undefined) {
    throw new Error("useAuthorization deve ser usado dentro de um AuthorizationProvider");
  }
  return context;
}