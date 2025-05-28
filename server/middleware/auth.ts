import { Request, Response, NextFunction } from "express";
import { storage } from "../storage";

// Middleware para verificar se o usuário está autenticado
export const isAuthenticated = async (req: Request, res: Response, next: NextFunction) => {
  if (!req.session.userId) {
    return res.status(401).json({ 
      success: false, 
      message: "Não autenticado" 
    });
  }
  
  try {
    // Verificar se é o administrador keyuser
    if (req.session.userId === 9999) {
      // O keyuser tem todas as permissões
      req.user = {
        id: 9999,
        name: "Paulo Eduardo (KeyUser)",
        email: "padupb@admin.icap",
        companyId: null,
        roleId: null,
        canConfirmDelivery: true,
        isKeyUser: true,
        isDeveloper: true, // Adicionar para compatibilidade
        permissions: ["*"] // Permissão total - sem restrições
      };
      return next();
    }
    
    // Buscar usuário normal
    const user = await storage.getUser(req.session.userId);
    
    if (!user) {
      // Limpar a sessão se o usuário não for encontrado
      req.session.destroy((err) => {
        if (err) {
          console.error("Erro ao destruir sessão:", err);
        }
      });
      
      return res.status(401).json({ 
        success: false, 
        message: "Usuário não encontrado" 
      });
    }

    // NOVA REGRA: Se o usuário tem ID = 1, dar permissões de keyuser
    const isKeyUser = user.id === 1;
    
    if (isKeyUser) {
      console.log("🔑 Usuário ID 1 detectado no middleware - Concedendo permissões de KeyUser");
      req.user = {
        ...user,
        isKeyUser: true,
        isDeveloper: true,
        permissions: ["*"] // Permissão total
      };
      return next();
    }

    // Buscar a função do usuário e suas permissões para usuários normais
    let permissions: string[] = [];
    if (user.roleId) {
      const role = await storage.getUserRole(user.roleId);
      if (role && role.permissions) {
        permissions = role.permissions;
        console.log(`🔐 Permissões carregadas no middleware para ${user.name}:`, permissions);
      }
    }

    // Adicionar o usuário com suas permissões ao objeto de requisição
    req.user = {
      ...user,
      permissions
    };
    
    next();
  } catch (error) {
    console.error("Erro ao verificar autenticação:", error);
    res.status(500).json({ 
      success: false, 
      message: "Erro ao verificar autenticação" 
    });
  }
};

// Middleware para verificar permissões específicas
export const hasPermission = (permission: string) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    console.log(`🔍 [hasPermission] Verificando permissão "${permission}" para usuário:`, {
      userId: req.user?.id,
      name: req.user?.name,
      isKeyUser: req.user?.isKeyUser,
      permissions: req.user?.permissions
    });

    if (!req.user) {
      console.log("❌ [hasPermission] Usuário não autenticado");
      return res.status(401).json({ 
        success: false, 
        message: "Não autenticado" 
      });
    }
    
    // KeyUser sempre tem acesso total
    if (req.user.isKeyUser === true || req.user.id === 9999 || req.user.id === 1) {
      console.log("✅ [hasPermission] Acesso liberado - KeyUser detectado");
      return next();
    }
    
    // VALIDAÇÃO BASEADA NO BANCO DE DADOS
    try {
      // Buscar as permissões atuais do usuário no banco
      let userPermissions: string[] = [];
      
      if (req.user.roleId) {
        console.log(`🔍 [hasPermission] Buscando permissões da função ${req.user.roleId} no banco...`);
        const role = await storage.getUserRole(req.user.roleId);
        
        if (role && role.permissions) {
          userPermissions = role.permissions;
          console.log(`🔐 [hasPermission] Permissões encontradas no banco:`, userPermissions);
        } else {
          console.log(`⚠️ [hasPermission] Função não encontrada ou sem permissões definidas`);
        }
      } else {
        console.log(`⚠️ [hasPermission] Usuário sem função definida (roleId: ${req.user.roleId})`);
      }
      
      // Se tem permissão total (*), permite acesso
      if (userPermissions.includes("*")) {
        console.log("✅ [hasPermission] Acesso liberado - Permissão total (*) encontrada no banco");
        return next();
      }
      
      // Verificar se tem a permissão específica
      if (userPermissions.includes(permission)) {
        console.log(`✅ [hasPermission] Acesso liberado - Permissão específica "${permission}" encontrada no banco`);
        return next();
      }
      
      // Se não tem permissão, negar acesso
      console.log(`❌ [hasPermission] Acesso negado - Permissão "${permission}" não encontrada no banco. Permissões do usuário:`, userPermissions);
      return res.status(403).json({ 
        success: false, 
        message: `Acesso negado - você não tem permissão para "${permission}"` 
      });
      
    } catch (error) {
      console.error(`❌ [hasPermission] Erro ao verificar permissões no banco:`, error);
      return res.status(500).json({ 
        success: false, 
        message: "Erro interno ao verificar permissões" 
      });
    }
  };
};

// Middleware especial para verificar se é o keyuser
export const isKeyUser = (req: Request, res: Response, next: NextFunction) => {
  if (!req.user) {
    return res.status(401).json({ 
      success: false, 
      message: "Não autenticado" 
    });
  }
  
  // Verificar se é o keyuser
  if (req.user.isKeyUser === true || req.user.id === 9999) {
    return next();
  }
  
  return res.status(403).json({ 
    success: false, 
    message: "Acesso restrito ao administrador" 
  });
};

// Adiciona a declaração do usuário ao objeto Request
declare global {
  namespace Express {
    interface Request {
      user?: any;
    }
  }
}