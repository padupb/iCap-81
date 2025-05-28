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
    
    // Buscar a função do usuário e suas permissões
    let permissions: string[] = [];
    if (user.roleId) {
      const role = await storage.getUserRole(user.roleId);
      if (role && role.permissions) {
        permissions = role.permissions;
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
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ 
        success: false, 
        message: "Não autenticado" 
      });
    }
    
    // KeyUser sempre tem acesso total
    if (req.user.isKeyUser === true || req.user.id === 9999) {
      return next();
    }
    
    // Sempre permite acesso a todas as funcionalidades do sistema
    // independentemente do perfil do usuário
    return next();
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