import React, { createContext, useContext, ReactNode, useCallback } from "react";
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

  /**
   * Verifica se pode acessar Google Maps
   */
  canAccessGoogleMaps: () => boolean;

  /**
   * Verifica se pode acessar dados para dropdowns (sem visualizar a página completa)
   * @param dataType Tipo de dados (companies, products, etc)
   */
  canAccessDropdownData: (dataType: string) => boolean;

  /**
   * Verifica se o usuário pode criar ordens de compra
   */
  canCreatePurchaseOrders: () => boolean;
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
  const { user, isAuthenticated } = useAuth();

  const canView = (area: string): boolean => {
    // Se não há usuário autenticado, nega acesso
    if (!user) {
      console.log(`❌ [AuthorizationContext] Usuário não autenticado - negando acesso a ${area}`);
      return false;
    }

    // APENAS o usuário keyuser (ID = 1) tem acesso total
    if (user.id === 1 || (user.isKeyUser === true && user.isDeveloper === true)) {
      console.log(`🔑 [AuthorizationContext] KeyUser detectado - liberando acesso total a ${area}`);
      return true;
    }

    // Apenas dados essenciais do sistema são liberados automaticamente
    const systemData = ['user_roles', 'units'];
    if (systemData.includes(area)) {
      console.log(`✅ [AuthorizationContext] Dados do sistema ${area} - liberando acesso para usuário autenticado`);
      return true;
    }

    // Se o usuário não tem permissões definidas, nega acesso para outras áreas
    if (!user.permissions || !Array.isArray(user.permissions)) {
      console.log(`❌ [AuthorizationContext] Usuário sem permissões definidas - negando acesso a ${area}`);
      return false;
    }

    // Para usuários normais, verificar apenas permissões específicas da role
    const rolePermissions = user.role?.permissions || [];
    console.log(`🔐 [AuthorizationContext] Verificando permissões da role:`, rolePermissions);

    // Verificar se tem permissão específica na role
    const hasRolePermission = rolePermissions.includes(`view_${area}`);

    if (hasRolePermission) {
      console.log(`✅ [AuthorizationContext] Permissão view_${area} encontrada na role - liberando acesso`);
      return true;
    }

    console.log(`❌ [AuthorizationContext] Permissão view_${area} não encontrada - negando acesso`);
    return false;
  };

  const canEdit = (area: string): boolean => {
    // Se não há usuário autenticado, nega acesso
    if (!user) return false;

    // APENAS o usuário keyuser (ID = 1) tem acesso total
    if (user.id === 1 || (user.isKeyUser === true && user.isDeveloper === true)) {
      return true;
    }

    // Se o usuário não tem permissões definidas, nega acesso
    if (!user.permissions || !Array.isArray(user.permissions)) return false;

    // Para usuários normais, verificar apenas permissões específicas da role
    const rolePermissions = user.role?.permissions || [];
    return rolePermissions.includes(`edit_${area}`);
  };

  const canCreate = (area: string): boolean => {
    // Se não há usuário autenticado, nega acesso
    if (!user) {
      console.log(`❌ [AuthorizationContext] Usuário não autenticado - negando criação de ${area}`);
      return false;
    }

    // APENAS o usuário keyuser (ID = 1) tem acesso total
    if (user.id === 1 || (user.isKeyUser === true && user.isDeveloper === true)) {
      console.log(`🔑 [AuthorizationContext] KeyUser detectado - liberando criação de ${area}`);
      return true;
    }

    // Se o usuário não tem permissões definidas, nega acesso
    if (!user.permissions || !Array.isArray(user.permissions)) {
      console.log(`❌ [AuthorizationContext] Usuário sem permissões definidas - negando criação de ${area}`);
      return false;
    }

    // Para usuários normais, verificar apenas permissões específicas da role
    const rolePermissions = user.role?.permissions || [];
    const hasPermission = rolePermissions.includes(`create_${area}`);

    if (hasPermission) {
      console.log(`✅ [AuthorizationContext] Permissão create_${area} encontrada na role - liberando criação`);
      return true;
    }

    console.log(`❌ [AuthorizationContext] Permissão create_${area} não encontrada - negando criação`);
    return false;
  };

    // Função para verificar se pode acessar Google Maps
  const canAccessGoogleMaps = useCallback(() => {
    // Verificar se o usuário está autenticado E se a API key está configurada
    if (!isAuthenticated) {
      return false;
    }
    
    // Verificar se a chave da API do Google Maps está configurada no sistema
    // Esta verificação será feita nos componentes que usam o Maps
    return true;
  }, [isAuthenticated]);

  // Função para verificar acesso a dados para dropdowns
  const canAccessDropdownData = useCallback((dataType: string) => {
    // Se não há usuário autenticado, nega acesso
    if (!user) return false;

    // APENAS o usuário keyuser (ID = 1) tem acesso total
    if (user.id === 1 || (user.isKeyUser === true && user.isDeveloper === true)) {
      return true;
    }

    // Dados necessários para formulários são sempre acessíveis para usuários autenticados
    const allowedDropdownData = ['companies', 'products', 'user_roles', 'units'];
    return allowedDropdownData.includes(dataType);
  }, [user]);

  // Função para verificar se pode criar ordens de compra
  const canCreatePurchaseOrders = useCallback(() => {
    // Se não há usuário autenticado, nega acesso
    if (!user) {
      console.log(`❌ [AuthorizationContext] Usuário não autenticado - negando criação de ordens de compra`);
      return false;
    }

    // APENAS o usuário keyuser (ID = 1) tem acesso total
    if (user.id === 1 || (user.isKeyUser === true && user.isDeveloper === true)) {
      console.log(`🔑 [AuthorizationContext] KeyUser detectado - liberando criação de ordens de compra`);
      return true;
    }

    // Para usuários normais, verificar permissão específica canCreatePurchaseOrder
    const hasPermission = user.canCreatePurchaseOrder === true;

    if (hasPermission) {
      console.log(`✅ [AuthorizationContext] Permissão canCreatePurchaseOrder encontrada - liberando criação`);
      return true;
    }

    console.log(`❌ [AuthorizationContext] Permissão canCreatePurchaseOrder não encontrada - negando criação`);
    return false;
  }, [user]);

  const menuPermissions = {
    dashboard: true, // Dashboard é sempre visível para usuários autenticados
    orders: canView || canCreate,
    approvals: true, // Qualquer usuário pode ver se há aprovações (o backend filtra)
    reprogramacoes: true, // Qualquer usuário pode ver se há reprogramações (o backend filtra)
    purchase_orders: canView || canCreate,
    companies: canView || canCreate,
    users: canView || canCreate,
    products: canView || canCreate,
    logs: canView || canCreate,
  };

  return (
    <AuthorizationContext.Provider value={{ canView, canEdit, canCreate, canAccessGoogleMaps, canAccessDropdownData, canCreatePurchaseOrders }}>
      {children}
    </AuthorizationContext.Provider>
  );
};