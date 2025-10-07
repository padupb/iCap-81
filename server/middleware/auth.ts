import { Request, Response, NextFunction } from "express";
import { storage } from "../storage";

// Middleware para verificar se o usuário está autenticado
export const isAuthenticated = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.session?.userId) {
      console.log("❌ Usuário não autenticado - sessão sem userId");
      console.log("🔍 Detalhes da sessão:", {
        session: req.session,
        cookies: req.headers.cookie
      });
      return res.status(401).json({
        success: false,
        message: "Não autenticado"
      });
    }

    console.log(`🔍 Verificando usuário da sessão: ${req.session.userId}`);

    // Buscar dados completos do usuário
    const user = await storage.getUser(req.session.userId);
    if (!user) {
      // Limpar a sessão se o usuário não for encontrado
      req.session.destroy((err) => {
        if (err) {
          console.error("Erro ao destruir sessão:", err);
        }
      });
      console.log(`❌ Usuário ${req.session.userId} não encontrado no banco`);
      return res.status(401).json({
        success: false,
        message: "Usuário não encontrado"
      });
    }

    // NOVA REGRA: Se o usuário tem ID entre 1 e 5, dar permissões de keyuser
    const isKeyUser = user.id >= 1 && user.id <= 5;
    let permissions: string[] = [];
    let role = null;

    if (user.roleId && !isKeyUser) {
      role = await storage.getUserRole(user.roleId);
      if (role && role.permissions) {
        permissions = role.permissions;
      }
    } else if (isKeyUser) {
      // Para o keyuser real, criar função virtual
      console.log("🔑 USUÁRIO KEYUSER DETECTADO - CONCEDENDO PERMISSÕES DE KEYUSER");
      role = { id: 9999, name: "Super Administrador", permissions: ["*"] };
      permissions = ["*"];
    }

    // Adicionar dados do usuário ao objeto req para uso em outras rotas
    req.user = {
      ...user,
      isKeyUser: isKeyUser,
      isDeveloper: isKeyUser,
      permissions,
      role
    };

    console.log(`✅ Usuário autenticado: ${user.name} (ID: ${user.id})${isKeyUser ? ' - KeyUser' : ''}`);
    next();
  } catch (error) {
    console.error("❌ Erro na verificação de autenticação:", error);
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

    // KeyUsers (IDs 1-5) sempre têm acesso total
    if ((req.user.id >= 1 && req.user.id <= 5) || req.user.isKeyUser === true) {
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
  if ((req.user.id >= 1 && req.user.id <= 5) || req.user.isKeyUser === true) {
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

    // KeyUsers (IDs 1-5) sempre têm acesso total
    if ((req.user.id >= 1 && req.user.id <= 5) || req.user.isKeyUser === true) {
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