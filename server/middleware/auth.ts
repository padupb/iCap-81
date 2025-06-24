
import { Request, Response, NextFunction } from "express";
import { storage } from "../storage";

// Middleware para verificar se o usuário está autenticado
export const isAuthenticated = async (req: Request, res: Response, next: NextFunction) => {
  try {
    console.log("🔍 Verificando autenticação:", {
      sessionExists: !!req.session,
      userId: req.session?.userId,
      url: req.url
    });

    if (!req.session?.userId) {
      console.log("❌ Usuário não autenticado - sem session.userId");
      return res.status(401).json({ 
        success: false, 
        message: "Não autenticado" 
      });
    }

    try {
      // Buscar usuário
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

      // Verificar se é o usuário KeyUser (ID = 1)
      const isRealKeyUser = user.id === 1;

      // Buscar a função do usuário e suas permissões
      let permissions: string[] = [];
      let role = null;

      if (user.roleId && !isRealKeyUser) {
        role = await storage.getUserRole(user.roleId);
        if (role && role.permissions) {
          permissions = role.permissions;
        }
      } else if (isRealKeyUser) {
        // Para o keyuser real, criar função virtual
        role = { id: 9999, name: "Super Administrador", permissions: ["*"] };
        permissions = ["*"];
      }

      // Adicionar o usuário com suas permissões ao objeto de requisição
      req.user = {
        ...user,
        isKeyUser: isRealKeyUser,
        isDeveloper: isRealKeyUser,
        permissions,
        role
      };

      next();
    } catch (error) {
      console.error("Erro ao verificar autenticação:", error);
      res.status(500).json({ 
        success: false, 
        message: "Erro ao verificar autenticação" 
      });
    }
  } catch (error) {
    console.error("Erro geral no middleware de autenticação:", error);
    res.status(500).json({ 
      success: false, 
      message: "Erro interno do servidor" 
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

    // KeyUser (ID = 1) sempre tem acesso total
    if (req.user.id === 1 || req.user.isKeyUser === true) {
      return next();
    }

    // Verificar se o usuário tem a permissão específica
    if (!req.user.permissions || !Array.isArray(req.user.permissions)) {
      return res.status(403).json({ 
        success: false, 
        message: "Sem permissões definidas" 
      });
    }

    // Verificar se tem a permissão específica
    if (req.user.permissions.includes(permission)) {
      return next();
    }

    return res.status(403).json({ 
      success: false, 
      message: `Permissão '${permission}' necessária` 
    });
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
  if (req.user.isKeyUser === true || req.user.id === 1) {
    return next();
  }

  return res.status(403).json({ 
    success: false, 
    message: "Acesso restrito ao administrador" 
  });
};

// Middleware para verificar se o usuário tem uma das permissões especificadas
export const hasAnyPermission = (permissions: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ 
        success: false, 
        message: "Não autenticado" 
      });
    }

    // KeyUser (ID = 1) sempre tem acesso total
    if (req.user.id === 1 || req.user.isKeyUser === true) {
      return next();
    }

    // Verificar se o usuário tem pelo menos uma das permissões
    if (!req.user.permissions || !Array.isArray(req.user.permissions)) {
      return res.status(403).json({ 
        success: false, 
        message: "Sem permissões definidas" 
      });
    }

    // Verificar se tem pelo menos uma das permissões especificadas
    const hasPermission = permissions.some(permission => 
      req.user.permissions.includes(permission)
    );

    if (hasPermission) {
      return next();
    }

    return res.status(403).json({ 
      success: false, 
      message: `Permissão necessária: ${permissions.join(' ou ')}` 
    });
  };
};

// Middleware para autenticar usuário (usado pelo app mobile)
export const authenticateUser = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Para compatibilidade com apps mobile, verificar token no header Authorization
    const authHeader = req.headers.authorization;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      // Implementação simplificada para desenvolvimento
      // Em produção, você validaria o JWT token aqui
      const token = authHeader.substring(7);
      
      // Por enquanto, assumir que é um usuário válido se o token existe
      // Você pode implementar validação JWT aqui se necessário
      req.user = {
        id: 1,
        role: 'admin'
      };
      
      return next();
    }

    // Se não há token, verificar se há sessão ativa
    if (req.session?.userId) {
      const user = await storage.getUser(req.session.userId);
      if (user) {
        req.user = user;
        return next();
      }
    }

    return res.status(401).json({
      success: false,
      message: 'Token de autenticação necessário'
    });
  } catch (error) {
    console.error("Erro no middleware authenticateUser:", error);
    return res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
};

// Adiciona a declaração do usuário ao objeto Request
declare global {
  namespace Express {
    interface Request {
      user?: any;
    }
  }
}
