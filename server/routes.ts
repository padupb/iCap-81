import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { db, pool } from "./db";
import { isAuthenticated, hasPermission, isKeyUser, authenticateUser } from "./middleware/auth";
import { 
  insertUserSchema, insertCompanySchema, insertCompanyCategorySchema,
  insertUserRoleSchema, insertProductSchema, insertUnitSchema,
  insertOrderSchema, insertPurchaseOrderSchema, insertPurchaseOrderItemSchema,
  insertSystemLogSchema, insertSettingSchema
} from "@shared/schema";
import multer from "multer";
import fs from "fs";
import path from "path";
import { z } from "zod";

// Função utilitária para converter data preservando o dia selecionado no calendário
function convertToLocalDate(dateString: string): Date {
  console.log(`🔍 convertToLocalDate - entrada: ${dateString}`);
  
  // Para datas com timezone (como as do frontend), manter a data original
  if (dateString.includes('Z') || dateString.includes('+') || dateString.includes('-', 10)) {
    const originalDate = new Date(dateString);
    
    // Extrair os componentes da data original (UTC)
    const year = originalDate.getUTCFullYear();
    const month = originalDate.getUTCMonth();
    const day = originalDate.getUTCDate();
    
    // Criar uma nova data preservando exatamente o dia selecionado no calendário
    // Usando 12:00 UTC para evitar problemas de fuso horário
    const preservedDate = new Date(Date.UTC(year, month, day, 12, 0, 0, 0));
    
    console.log(`📅 Data recebida: ${originalDate.toISOString()}`);
    console.log(`📅 Dia extraído (UTC): ${day}/${month + 1}/${year}`);
    console.log(`📅 Data preservada: ${preservedDate.toISOString()}`);
    console.log(`📅 Data em formato brasileiro: ${preservedDate.toLocaleDateString('pt-BR')}`);
    
    return preservedDate;
  }
  
  // Para datas sem timezone (formato YYYY-MM-DD)
  const dateParts = dateString.split('T')[0].split('-');
  if (dateParts.length === 3) {
    const year = parseInt(dateParts[0]);
    const month = parseInt(dateParts[1]) - 1; // Mês é 0-indexed no JavaScript
    const day = parseInt(dateParts[2]);
    
    // Criar a data exatamente como selecionada (sem ajustes)
    const exactDate = new Date(Date.UTC(year, month, day, 12, 0, 0, 0));
    
    console.log(`📅 Data parseada: ${day}/${month + 1}/${year}`);
    console.log(`📅 Data UTC exata: ${exactDate.toISOString()}`);
    console.log(`📅 Data em formato brasileiro: ${exactDate.toLocaleDateString('pt-BR')}`);
    
    return exactDate;
  }
  
  // Fallback para outros formatos
  const fallbackDate = new Date(dateString);
  console.log(`📅 Fallback date: ${fallbackDate.toISOString()}`);
  return fallbackDate;
}

// Configuração avançada do multer para upload de arquivos
const storage_upload = multer.diskStorage({
  destination: async function (req, file, cb) {
    try {
      // Buscar o order_id do pedido pelo ID
      const pedidoId = req.params.id;
      const uploadDir = path.join(process.cwd(), "uploads");

      console.log("📂 Configurando destino de upload para pedido ID:", pedidoId);
      console.log("📂 Diretório base de upload:", uploadDir);

      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
        console.log("📂 Diretório de upload criado:", uploadDir);
      }

      // Buscar o order_id do pedido
      const result = await pool.query("SELECT order_id FROM orders WHERE id = $1", [pedidoId]);

      if (result.rows.length === 0) {
        console.error("❌ Pedido não encontrado para ID:", pedidoId);
        return cb(new Error("Pedido não encontrado"), "");
      }

      const orderId = result.rows[0].order_id;
      console.log("📋 Order ID encontrado:", orderId);

      // Criar diretório com o order_id (número do pedido)
      const orderDir = path.join(uploadDir, orderId);
      console.log("📂 Diretório final do pedido:", orderDir);
      
      if (!fs.existsSync(orderDir)) {
        fs.mkdirSync(orderDir, { recursive: true });
        console.log("📂 Diretório do pedido criado:", orderDir);
      }

      cb(null, orderDir);
    } catch (error) {
      console.error("❌ Erro ao criar diretório do pedido:", error);
      cb(error as Error, "");
    }
  },
  filename: function (req, file, cb) {
    const fileExt = path.extname(file.originalname);
    const fileName = file.fieldname + "-" + Date.now() + fileExt;
    console.log("📄 Nome do arquivo gerado:", fileName);
    cb(null, fileName);
  }
});

// Filtro para validar tipos de arquivo
const fileFilter = function(req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) {
  // Verificar o tipo do arquivo baseado no campo (fieldname)
  if (file.fieldname === "nota_pdf" || file.fieldname === "certificado_pdf") {
    // Para PDFs, verificar o mimetype
    if (file.mimetype === "application/pdf") {
      cb(null, true);
    } else {
      cb(new Error(`O arquivo ${file.fieldname} deve ser um PDF`));
    }
  } else if (file.fieldname === "nota_xml") {
    // Para XMLs, verificar o mimetype ou extensão
    if (file.mimetype === "text/xml" || file.mimetype === "application/xml" || file.originalname.endsWith(".xml")) {
      cb(null, true);
    } else {
      cb(new Error(`O arquivo ${file.fieldname} deve ser um XML`));
    }
  } else {
    // Para outros tipos de arquivo, rejeitar
    cb(new Error(`Tipo de arquivo não suportado: ${file.fieldname}`));
  }
};

const upload = multer({ 
  storage: storage_upload,
  fileFilter: fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  }
});

// Configuração específica para upload de logo
const logoStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(process.cwd(), "public", "uploads");

    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const fileExt = path.extname(file.originalname);
    const fileName = "logo" + fileExt;
    cb(null, fileName);
  }
});

  // Configuração específica para upload de PDF de ordem de compra
  const ordemCompraStorage = multer.diskStorage({
    destination: function (req, file, cb) {
      const uploadDir = path.join(process.cwd(), "uploads");

      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }

      cb(null, uploadDir);
    },
    filename: async function (req, file, cb) {
      try {
        // Buscar o número da ordem de compra pelo ID
        const ordemId = req.params.id;
        const result = await pool.query("SELECT numero_ordem FROM ordens_compra WHERE id = $1", [ordemId]);

        if (result.rows.length === 0) {
          return cb(new Error("Ordem de compra não encontrada"), "");
        }

        const numeroOrdem = result.rows[0].numero_ordem;
        const fileName = `${numeroOrdem}.pdf`;
        cb(null, fileName);
      } catch (error) {
        console.error("Erro ao gerar nome do arquivo:", error);
        cb(error as Error, "");
      }
    }
  });

const logoFileFilter = function(req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) {
  // Aceitar apenas imagens
  if (file.mimetype.startsWith("image/")) {
    cb(null, true);
  } else {
    cb(new Error("O arquivo deve ser uma imagem (PNG, JPG, JPEG, etc.)"));
  }
};

const uploadLogo = multer({ 
    storage: logoStorage,
    fileFilter: logoFileFilter,
    limits: {
      fileSize: 5 * 1024 * 1024, // 5MB
    }
  });

  const ordemCompraPdfFilter = function(req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) {
    // Aceitar apenas PDFs
    if (file.mimetype === "application/pdf") {
      cb(null, true);
    } else {
      cb(new Error("O arquivo deve ser um PDF"));
    }
  };

  const uploadOrdemCompraPdf = multer({ 
    storage: ordemCompraStorage,
    fileFilter: ordemCompraPdfFilter,
    limits: {
      fileSize: 10 * 1024 * 1024, // 10MB
    }
  });

export async function registerRoutes(app: Express): Promise<Server> {

  // Rotas de autenticação
  app.post("/api/auth/login", async (req, res) => {
    try {
      const { email, password } = req.body;

      console.log("🔍 Tentativa de login:", { email: email, passwordLength: password?.length });

      if (!email || !password) {
        return res.status(400).json({ 
          success: false, 
          message: "Email e senha são obrigatórios" 
        });
      }

      // Buscar usuário no banco de dados
      console.log("🔍 Buscando usuário no banco:", email);

      const user = await storage.getUserByEmail(email);

      if (!user) {
        console.log("❌ Usuário não encontrado:", email);
        return res.status(401).json({ 
          success: false, 
          message: "Usuário não encontrado" 
        });
      }

      console.log("👤 Usuário encontrado:", { id: user.id, name: user.name, email: user.email });

      // Verificar a senha do usuário
      let senhaCorreta = false;

      if (!user.password) {
        // Se o usuário não tem senha, por compatibilidade, verificamos se a senha é igual ao email
        senhaCorreta = password === email;
      } else {
        // Verificar se a senha está hasheada ou em texto plano
        try {
          const bcrypt = await import('bcrypt');
          // Tentar verificar como hash bcrypt
          senhaCorreta = await bcrypt.compare(password, user.password);
        } catch (error) {
          // Se falhar, verificar como texto plano (compatibilidade)
          senhaCorreta = password === user.password;
        }
      }

      if (!senhaCorreta) {
        console.log("❌ Senha incorreta para usuário:", email);
        return res.status(401).json({ 
          success: false, 
          message: "Senha incorreta" 
        });
      }

      console.log("✅ Senha correta para usuário:", email);

      // Verificar se é o primeiro login
      if (user.primeiroLogin) {
        console.log("🔑 Primeiro login detectado para usuário:", user.name);
        
        // Salvar o ID do usuário na sessão mesmo no primeiro login
        req.session.userId = user.id;
        
        return res.json({
          success: true,
          requiresPasswordChange: true,
          user: {
            id: user.id,
            name: user.name,
            email: user.email
          },
          message: "Primeiro login detectado - altere sua senha"
        });
      }

      // NOVA REGRA: Se o usuário tem ID = 1, dar permissões de keyuser
      const isKeyUser = user.id === 1;

      if (isKeyUser) {
        console.log("🔑 USUÁRIO ID 1 DETECTADO - CONCEDENDO PERMISSÕES DE KEYUSER");
      }

      // Salvar o ID do usuário na sessão
      req.session.userId = user.id;

      // Log de atividade
      await storage.createLog({
        userId: user.id,
        action: "Login",
        itemType: "session",
        itemId: user.id.toString(),
        details: `Login do usuário ${user.name}${isKeyUser ? ' (KeyUser)' : ''}`
      });

      // Buscar informações da role para usuários normais
      let role = null;
      let permissions: string[] = [];

      if (user.roleId && !isKeyUser) {
        role = await storage.getUserRole(user.roleId);
        if (role && role.permissions) {
          permissions = role.permissions;
        }
      } else if (isKeyUser) {
        // Para o keyuser, criar role virtual
        role = { id: 9999, name: "Super Administrador", permissions: ["*"] };
        permissions = ["*"];
      }

      // Preparar resposta do usuário
      const userResponse = {
        id: user.id,
        name: user.name,
        email: user.email,
        companyId: user.companyId,
        roleId: user.roleId,
        canConfirmDelivery: user.canConfirmDelivery,
        canCreateOrder: user.canCreateOrder,
        // Adicionar propriedades de keyuser apenas se ID = 1
        isKeyUser: isKeyUser,
        isDeveloper: isKeyUser,
        permissions: permissions,
        role: role
      };

      console.log("📤 Resposta do login:", userResponse);

      res.json({ 
        success: true, 
        user: userResponse
      });
    } catch (error) {
      console.error("Erro ao fazer login:", error);
      res.status(500).json({ 
        success: false, 
        message: "Erro ao fazer login" 
      });
    }
  });

  app.get("/api/auth/me", isAuthenticated, async (req, res) => {
    try {
      // O middleware isAuthenticated já definiu corretamente as permissões
      const isKeyUser = req.user.id === 1;

      if (isKeyUser) {
        console.log("🔑 Usuário ID 1 acessando /api/auth/me - Permissões de KeyUser concedidas");
      }

      return res.json({
        success: true,
        user: {
          id: req.user.id,
          name: req.user.name,
          email: req.user.email,
          companyId: req.user.companyId,
          roleId: req.user.roleId,
          canConfirmDelivery: req.user.canConfirmDelivery,
          canCreateOrder: req.user.canCreateOrder,
          isKeyUser: req.user.isKeyUser,
          isDeveloper: req.user.isDeveloper,
          // Incluir informações da função
          role: req.user.role ? {
            id: req.user.role.id,
            name: req.user.role.name,
            permissions: req.user.role.permissions || []
          } : null,
          // Enviamos as permissões para o frontend (já definidas no middleware)
          permissions: req.user.permissions || []
        }
      });
    } catch (error) {
      console.error("Erro ao buscar informações do usuário:", error);
      return res.status(500).json({
        success: false,
        message: "Erro ao buscar informações do usuário"
      });
    }
  });

  app.post("/api/auth/logout", (req, res) => {
    console.log("🚪 Requisição de logout recebida. Session userId:", req.session.userId);
    
    if (req.session.userId) {
      const userId = req.session.userId;
      
      req.session.destroy((err) => {
        if (err) {
          console.error("❌ Erro ao destruir sessão no logout:", err);
          return res.status(500).json({ 
            success: false, 
            message: "Erro ao fazer logout" 
          });
        }

        console.log(`✅ Logout realizado com sucesso para usuário ${userId}`);
        
        res.json({ 
          success: true, 
          message: "Logout realizado com sucesso" 
        });
      });
    } else {
      console.log("⚠️ Tentativa de logout sem sessão ativa");
      
      // Mesmo sem sessão, retornar sucesso para não bloquear o logout no frontend
      res.json({ 
        success: true, 
        message: "Logout realizado (sem sessão ativa)" 
      });
    }
  });

  // Rota para alterar senha no primeiro login
  app.post("/api/auth/change-first-password", async (req, res) => {
    try {
      console.log("📝 Dados recebidos para alteração de senha:", req.body);
      console.log("📝 Session userId:", req.session.userId);
      
      const { userId, newPassword, confirmPassword } = req.body;

      // Validação mais detalhada dos dados
      console.log("🔍 Verificando dados:", {
        userId: userId,
        hasNewPassword: !!newPassword,
        newPasswordLength: newPassword?.length,
        hasConfirmPassword: !!confirmPassword,
        confirmPasswordLength: confirmPassword?.length
      });

      // Usar userId do body ou da sessão como fallback
      const finalUserId = userId || req.session.userId;
      
      if (!finalUserId) {
        console.log("❌ UserId não fornecido nem na requisição nem na sessão");
        return res.status(400).json({
          success: false,
          message: "ID do usuário é obrigatório"
        });
      }
      
      console.log("✅ Usando userId:", finalUserId);

      if (!newPassword || newPassword.trim() === "") {
        console.log("❌ Nova senha não fornecida");
        return res.status(400).json({
          success: false,
          message: "Nova senha é obrigatória"
        });
      }

      if (!confirmPassword || confirmPassword.trim() === "") {
        console.log("❌ Confirmação de senha não fornecida");
        return res.status(400).json({
          success: false,
          message: "Confirmação de senha é obrigatória"
        });
      }

      if (newPassword !== confirmPassword) {
        console.log("❌ Senhas não coincidem");
        return res.status(400).json({
          success: false,
          message: "As senhas não coincidem"
        });
      }

      if (newPassword.length < 6) {
        console.log("❌ Senha muito curta");
        return res.status(400).json({
          success: false,
          message: "A senha deve ter pelo menos 6 caracteres"
        });
      }

      // Buscar o usuário
      const user = await storage.getUser(finalUserId);
      if (!user) {
        console.log("❌ Usuário não encontrado:", finalUserId);
        return res.status(404).json({
          success: false,
          message: "Usuário não encontrado"
        });
      }

      console.log("👤 Usuário encontrado:", user.name);

      // Hash da nova senha
      const bcrypt = await import('bcrypt');
      const hashedPassword = await bcrypt.hash(newPassword, 10);

      console.log("🔐 Senha hasheada com sucesso");

      // Atualizar senha e marcar primeiro_login como false
      await storage.updateUser(finalUserId, {
        password: hashedPassword,
        primeiroLogin: false
      });

      console.log("✅ Usuário atualizado no banco de dados");

      // Log da ação
      await storage.createLog({
        userId: finalUserId,
        action: "Alteração de senha no primeiro login",
        itemType: "user",
        itemId: finalUserId.toString(),
        details: "Usuário alterou senha no primeiro acesso"
      });

      console.log("📝 Log criado com sucesso");

      res.json({
        success: true,
        message: "Senha alterada com sucesso"
      });

    } catch (error) {
      console.error("❌ Erro ao alterar senha no primeiro login:", error);
      res.status(500).json({
        success: false,
        message: "Erro interno do servidor"
      });
    }
  });

  // Rota para redefinir senha do usuário
  app.post("/api/auth/reset-password", isAuthenticated, async (req, res) => {
    try {
      const { userId } = req.body;

      console.log("🔄 Reset de senha solicitado para usuário:", userId);
      console.log("📝 Usuário da sessão:", req.session.userId);

      if (!userId) {
        return res.status(400).json({
          success: false,
          message: "ID do usuário é obrigatório"
        });
      }

      // Verificar se o usuário pode resetar a própria senha ou se é um administrador
      if (req.user.id !== parseInt(userId) && !req.user.isKeyUser) {
        return res.status(403).json({
          success: false,
          message: "Você só pode resetar sua própria senha"
        });
      }

      // Buscar o usuário
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: "Usuário não encontrado"
        });
      }

      console.log("👤 Usuário encontrado para reset:", user.name);

      // Hash da senha padrão
      const bcrypt = await import('bcrypt');
      const hashedPassword = await bcrypt.hash('icap123', 10);

      console.log("🔐 Hash da senha padrão gerado");

      // Atualizar senha para padrão e marcar primeiro_login como true
      await storage.updateUser(parseInt(userId), {
        password: hashedPassword,
        primeiroLogin: true
      });

      console.log("✅ Usuário atualizado - senha resetada e primeiro_login = true");

      // Log da ação
      await storage.createLog({
        userId: req.session.userId || req.user.id,
        action: "Redefinição de senha",
        itemType: "user",
        itemId: userId.toString(),
        details: `Senha do usuário ${user.name} foi redefinida para icap123`
      });

      console.log("📝 Log da ação criado");

      res.json({
        success: true,
        message: "Senha redefinida com sucesso para 'icap123'"
      });

    } catch (error) {
      console.error("❌ Erro ao redefinir senha:", error);
      res.status(500).json({
        success: false,
        message: "Erro interno do servidor",
        error: error instanceof Error ? error.message : "Erro desconhecido"
      });
    }
  });

  // Users routes  
  app.get("/api/users", isAuthenticated, async (req, res) => {
    try {
      const users = await storage.getAllUsers();
      res.json(users);
    } catch (error) {
      console.error("Erro ao buscar usuários:", error);
      res.status(500).json({ message: "Erro ao buscar usuários" });
    }
  });

  app.post("/api/users", isAuthenticated, async (req, res) => {
    try {
      // Verificar se o usuário tem permissão para criar usuários OU é keyuser
      const hasCreatePermission = req.user.permissions?.includes("create_users") || req.user.permissions?.includes("*");
      const isKeyUserCheck = req.user.id === 1 || req.user.isKeyUser;
      
      if (!hasCreatePermission && !isKeyUserCheck) {
        return res.status(403).json({ 
          success: false, 
          message: "Permissão 'create_users' necessária para criar usuários" 
        });
      }

      const userData = insertUserSchema.parse(req.body);
      const newUser = await storage.createUser(userData);

      // Registrar log de criação
      await storage.createLog({
        userId: req.user.id,
        action: "Criou usuário",
        itemType: "user",
        itemId: newUser.id.toString(),
        details: `Usuário ${newUser.name} criado`
      });

      res.json(newUser);
    } catch (error) {
      console.error("Erro ao criar usuário:", error);
      res.status(500).json({ message: "Erro ao criar usuário" });
    }
  });

  app.put("/api/users/:id", isAuthenticated, async (req, res) => {
    try {
      // Verificar se o usuário tem permissão para editar usuários OU é keyuser
      const hasEditPermission = req.user.permissions?.includes("edit_users") || req.user.permissions?.includes("*");
      const isKeyUserCheck = req.user.id === 1 || req.user.isKeyUser;
      
      if (!hasEditPermission && !isKeyUserCheck) {
        return res.status(403).json({ 
          success: false, 
          message: "Permissão 'edit_users' necessária para editar usuários" 
        });
      }

      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "ID inválido" });
      }

      // Verificar se o usuário existe
      const existingUser = await storage.getUser(id);
      if (!existingUser) {
        return res.status(404).json({ message: "Usuário não encontrado" });
      }

      const userData = req.body;
      console.log("Updating user:", { id, user: userData });
      const updatedUser = await storage.updateUser(id, userData);

      // Registrar log de atualização
      if (req.session.userId && updatedUser) {
        await storage.createLog({
          userId: req.session.userId,
          action: "Atualizou usuário",
          itemType: "user",
          itemId: id.toString(),
          details: `Usuário ${updatedUser.name} atualizado`
        });
      }

      res.json(updatedUser);
    } catch (error) {
      console.error("Erro ao atualizar usuário:", error);
      res.status(500).json({ message: "Erro ao atualizar usuário" });
    }
  });

  app.delete("/api/users/:id", isAuthenticated, hasPermission("delete_users"), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "ID inválido" });
      }

      // Verificar se o usuário existe
      const existingUser = await storage.getUser(id);
      if (!existingUser) {
        return res.status(404).json({ message: "Usuário não encontrado" });
      }

      // Verificar se o usuário está tentando excluir a si mesmo
      if (req.session.userId === id) {
        return res.status(400).json({ 
          message: "Não é possível excluir seu próprio usuário" 
        });
      }

      // Verificar se é o último usuário administrador
      // Esta seria uma verificação mais completa em um sistema em produção

      const deleted = await storage.deleteUser(id);

      // Registrar log de exclusão
      if (req.session.userId) {
        await storage.createLog({
          userId: req.session.userId,
          action: "Excluiu usuário",
          itemType: "user",
          itemId: id.toString(),
          details: `Usuário ${existingUser.name} excluído`
        });
      }

      res.json({ success: deleted });
    } catch (error) {
      console.error("Erro ao excluir usuário:", error);
      res.status(500).json({ message: "Erro ao excluir usuário" });
    }
  });

  // Companies routes
  app.get("/api/companies", async (req, res) => {
    try {
      const companies = await storage.getAllCompanies();
      res.json(companies);
    } catch (error) {
      console.error("Erro ao buscar empresas:", error);
      res.status(500).json({ message: "Erro ao buscar empresas" });
    }
  });

  app.post("/api/companies", isAuthenticated, hasPermission("create_companies"), async (req, res) => {
    try {
      const companyData = insertCompanySchema.parse(req.body);
      const newCompany = await storage.createCompany(companyData);

      // Registrar log de criação
      if (req.session.userId) {
        await storage.createLog({
          userId: req.session.userId,
          action: "Criou empresa",
          itemType: "company",
          itemId: newCompany.id.toString(),
          details: `Empresa ${newCompany.name} criada`
        });
      }

      res.json(newCompany);
    } catch (error) {
      console.error("Erro ao criar empresa:", error);
      res.status(500).json({ message: "Erro ao criar empresa" });
    }
  });

  app.put("/api/companies/:id", isAuthenticated, hasPermission("edit_companies"), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "ID inválido" });
      }

      // Verificar se a empresa existe
      const existingCompany = await storage.getCompany(id);
      if (!existingCompany) {
        return res.status(404).json({ message: "Empresa não encontrada" });
      }

      const companyData = req.body;
      const updatedCompany = await storage.updateCompany(id, companyData);

      // Registrar log de atualização
      if (req.session.userId) {
        await storage.createLog({
          userId: req.session.userId,
          action: "Atualizou empresa",
          itemType: "company",
          itemId: id.toString(),
          details: `Empresa ${updatedCompany?.name} atualizada`
        });
      }

      res.json(updatedCompany);
    } catch (error) {
      console.error("Erro ao atualizar empresa:", error);
      res.status(500).json({ message: "Erro ao atualizar empresa" });
    }
  });

  app.delete("/api/companies/:id", isAuthenticated, hasPermission("delete_companies"), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "ID inválido" });
      }

      // Verificar se a empresa existe
      const existingCompany = await storage.getCompany(id);
      if (!existingCompany) {
        return res.status(404).json({ message: "Empresa não encontrada" });
      }

      // Verificar se há pedidos ou ordens de compra vinculados a esta empresa
      // Esta verificação seria mais completa em um sistema em produção

      const deleted = await storage.deleteCompany(id);

      // Registrar log de exclusão
      if (req.session.userId) {
        await storage.createLog({
          userId: req.session.userId,
          action: "Excluiu empresa",
          itemType: "company",
          itemId: id.toString(),
          details: `Empresa ${existingCompany.name} excluída`
        });
      }

      res.json({ success: deleted });
    } catch (error) {
      console.error("Erro ao excluir empresa:", error);
      res.status(500).json({ message: "Erro ao excluir empresa" });
    }
  });

  // Products routes
  app.get("/api/products", async (req, res) => {
    try {
      const products = await storage.getAllProducts();
      res.json(products);
    } catch (error) {
      console.error("Erro ao buscar produtos:", error);
      res.status(500).json({ message: "Erro ao buscar produtos" });
    }
  });

  // Orders routes (Pedidos)
  app.get("/api/orders", isAuthenticated, async (req, res) => {
    try {
      let orders = await storage.getAllOrders();

      // NOVA REGRA: Se o usuário é aprovador, só pode ver pedidos onde ele é o aprovador
      const isApprover = await pool.query(`
        SELECT COUNT(*) as total
        FROM companies 
        WHERE approver_id = $1
      `, [req.user.id]);

      const userIsApprover = parseInt(isApprover.rows[0].total) > 0;

      if (userIsApprover && req.user.id !== 1 && !req.user.isKeyUser) {
        console.log(`🔒 Usuário ${req.user.name} (ID: ${req.user.id}) é aprovador - aplicando filtro restritivo`);
        
        // Filtrar apenas pedidos onde o usuário é aprovador da obra de destino
        const filteredOrders = [];
        
        for (const order of orders) {
          if (order.purchaseOrderId) {
            try {
              // Verificar se o usuário é aprovador da obra de destino
              const approverCheck = await pool.query(`
                SELECT c.id, c.name, c.approver_id
                FROM orders o
                LEFT JOIN ordens_compra oc ON o.purchase_order_id = oc.id
                LEFT JOIN companies c ON oc.cnpj = c.cnpj
                WHERE o.id = $1 AND c.approver_id = $2
              `, [order.id, req.user.id]);
              
              if (approverCheck.rows.length > 0) {
                filteredOrders.push(order);
                console.log(`✅ Pedido ${order.orderId} incluído - usuário é aprovador da obra ${approverCheck.rows[0].name}`);
              }
            } catch (error) {
              console.error(`Erro ao verificar aprovação do pedido ${order.orderId}:`, error);
            }
          }
        }
        
        orders = filteredOrders;
        console.log(`🔒 Aprovador ${req.user.name} - visualização restrita a ${orders.length} pedidos onde é aprovador`);
        
      } else {
        // Aplicar restrição baseada nos critérios da empresa do usuário (para não-aprovadores)
        if (req.user && req.user.companyId && req.user.id !== 1 && !req.user.isKeyUser) {
          // Buscar a empresa do usuário
          const userCompany = await storage.getCompany(req.user.companyId);
          
          if (userCompany) {
            // Buscar a categoria da empresa
            const companyCategory = await storage.getCompanyCategory(userCompany.categoryId);
            
            if (companyCategory) {
              // Verificar se a empresa tem pelo menos 1 critério ativo
              const hasAnyCriteria = companyCategory.requiresApprover || 
                                   companyCategory.requiresContract || 
                                   companyCategory.receivesPurchaseOrders;
              
              if (hasAnyCriteria) {
                // Filtrar pedidos onde a empresa é fornecedora OU obra de destino
                const filteredOrders = [];
                
                for (const order of orders) {
                  // 1. Incluir pedidos criados pela empresa (fornecedor)
                  if (order.supplierId === req.user.companyId) {
                    filteredOrders.push(order);
                    continue;
                  }
                  
                  // 2. Incluir pedidos destinados à empresa (obra de destino)
                  if (order.purchaseOrderId) {
                    try {
                      // Buscar a ordem de compra para verificar o CNPJ de destino
                      const ordemCompraResult = await pool.query(
                        "SELECT cnpj FROM ordens_compra WHERE id = $1",
                        [order.purchaseOrderId]
                      );
                      
                      if (ordemCompraResult.rows.length > 0) {
                        const cnpjDestino = ordemCompraResult.rows[0].cnpj;
                        
                        // Verificar se o CNPJ de destino corresponde à empresa do usuário
                        if (cnpjDestino === userCompany.cnpj) {
                          filteredOrders.push(order);
                        }
                      }
                    } catch (error) {
                      console.error(`Erro ao verificar destino do pedido ${order.orderId}:`, error);
                    }
                  }
                }
                
                orders = filteredOrders;
                console.log(`🔒 Usuário da empresa ${userCompany.name} - visualização restrita a pedidos próprios e destinados à empresa`);
              } else {
                console.log(`🔓 Usuário da empresa ${userCompany.name} - visualização irrestrita (empresa sem critérios)`);
              }
            }
          }
        } else {
          console.log(`🔓 Usuário ${req.user.name} (ID: ${req.user.id}) - visualização irrestrita (KeyUser ou não tem empresa)`);
        }
      }

      res.json(orders);
    } catch (error) {
      console.error("Erro ao buscar pedidos:", error);
      res.status(500).json({ message: "Erro ao buscar pedidos" });
    }
  });

  app.get("/api/orders/urgent", isAuthenticated, async (req, res) => {
    try {
      // CONTROLE DE ACESSO PARA PEDIDOS URGENTES
      // Apenas usuários com perfil específico podem visualizar pedidos urgentes
      
      // 1. Verificar se é o usuário KeyUser (ID = 1)
      if (req.user.id === 1 || req.user.isKeyUser === true) {
        console.log(`🔑 Acesso liberado para pedidos urgentes - KeyUser: ${req.user.name}`);
        
        // KeyUser vê todos os pedidos urgentes
        const urgentOrders = await storage.getUrgentOrders();
        console.log(`🔑 KeyUser - exibindo todos os ${urgentOrders.length} pedidos urgentes`);
        return res.json(urgentOrders);
      }

      // 2. Verificar se o usuário é aprovador de alguma empresa/obra
      const approverResult = await pool.query(`
        SELECT COUNT(*) as total
        FROM companies 
        WHERE approver_id = $1
      `, [req.user.id]);

      const isApprover = parseInt(approverResult.rows[0].total) > 0;
      
      if (!isApprover) {
        console.log(`🔒 Acesso negado para pedidos urgentes - Usuário ${req.user.name} (ID: ${req.user.id}) não é aprovador`);
        return res.json([]);
      }

      console.log(`✅ Acesso liberado para pedidos urgentes - Usuário ${req.user.name} é aprovador`);

      // 3. Buscar pedidos urgentes específicos para este aprovador
      const urgentOrders = await storage.getUrgentOrdersForApprover(req.user.id);
      
      console.log(`📊 Total de pedidos urgentes para aprovador ${req.user.name}: ${urgentOrders.length}`);

      res.json(urgentOrders);
    } catch (error) {
      console.error("Erro ao buscar pedidos urgentes:", error);
      res.status(500).json({ message: "Erro ao buscar pedidos urgentes" });
    }
  });

  // Criar novo pedido
  app.post("/api/orders", async (req, res) => {
    try {
      const orderData = req.body;
      console.log("Creating order:", orderData);

      // Validar dados obrigatórios
      if (!orderData.purchaseOrderId || !orderData.productId || !orderData.quantity || !orderData.deliveryDate) {
        return res.status(400).json({
          success: false,
          message: "Dados incompletos para criar pedido"
        });
      }

      // Verificar se a ordem de compra existe na tabela ordens_compra
      const ordemCompraResult = await pool.query(
        "SELECT id, numero_ordem, status FROM ordens_compra WHERE id = $1",
        [orderData.purchaseOrderId]
      );

      if (!ordemCompraResult.rows.length) {
        return res.status(404).json({
          success: false,
          message: "Ordem de compra não encontrada"
        });
      }

      const ordemCompra = ordemCompraResult.rows[0];

      // Para armazenamento em memória, vamos simular a verificação de saldo
      // Em produção com banco, isso seria feito com queries SQL
      let quantidadeTotal = 0;
      let quantidadeUsada = 0;

      if (pool) {
        // Se temos banco de dados, usar queries SQL
        const saldoResult = await pool.query(
          `SELECT quantidade FROM itens_ordem_compra 
           WHERE ordem_compra_id = $1 AND produto_id = $2`,
          [orderData.purchaseOrderId, orderData.productId]
        );

        if (!saldoResult.rows.length) {
          return res.status(400).json({
            success: false,
            message: "Produto não encontrado na ordem de compra"
          });
        }

        quantidadeTotal = parseFloat(saldoResult.rows[0].quantidade);

        // Buscar quantidade já usada em pedidos (excluindo cancelados)
        const usadoResult = await pool.query(
          `SELECT COALESCE(SUM(CAST(quantity AS DECIMAL)), 0) as total_usado
           FROM orders 
           WHERE purchase_order_id = $1 AND product_id = $2 AND status != 'Cancelado'`,
          [orderData.purchaseOrderId, orderData.productId]
        );

                 quantidadeUsada = parseFloat(usadoResult.rows[0].total_usado || 0);
       } else {
         // Para armazenamento em memória, assumir que há saldo suficiente
         quantidadeTotal = 1000; // Valor padrão para desenvolvimento
         quantidadeUsada = 0;
       }
      const saldoDisponivel = quantidadeTotal - quantidadeUsada;
      const quantidadePedido = parseFloat(orderData.quantity);

      console.log(`Verificação de saldo ao criar pedido:`, {
        purchaseOrderId: orderData.purchaseOrderId,
        productId: orderData.productId,
        quantidadeTotal,
        quantidadeUsada,
        saldoDisponivel,
        quantidadePedido
      });

      if (quantidadePedido > saldoDisponivel) {
        console.log(`Saldo insuficiente: pedido ${quantidadePedido} > disponível ${saldoDisponivel}`);
        return res.status(400).json({
          success: false,
          message: `Saldo insuficiente. Disponível: ${saldoDisponivel.toFixed(2)}`
        });
      }

      // Calcular se o pedido é urgente baseado na data de entrega
      const now = new Date();
      const deliveryDate = convertToLocalDate(orderData.deliveryDate); // Conversão para fuso brasileiro
      
      console.log(`📅 Debug conversão de data:`, {
        original: orderData.deliveryDate,
        converted: deliveryDate.toISOString(),
        localString: deliveryDate.toLocaleDateString('pt-BR'),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
      });
      
      const daysDiff = Math.ceil((deliveryDate.getTime() - now.getTime()) / (1000 * 3600 * 24));
      const isUrgent = daysDiff <= 7;
      
      // Definir status baseado na urgência:
      // - Pedidos urgentes: "Registrado" (precisam de aprovação)
      // - Pedidos não urgentes: "Aprovado" (aprovação automática)
      const status = isUrgent ? "Registrado" : "Aprovado";

      console.log(`📋 Criando pedido:`, {
        deliveryDate: deliveryDate.toISOString(),
        daysDiff,
        isUrgent,
        status: status,
        autoApproved: !isUrgent
      });

      // Criar o pedido usando o storage
      const newOrder = await storage.createOrder({
        purchaseOrderId: orderData.purchaseOrderId,
        productId: orderData.productId,
        quantity: orderData.quantity,
        supplierId: orderData.supplierId,
        deliveryDate: deliveryDate,
        userId: orderData.userId || req.session.userId || 1,
        workLocation: orderData.workLocation || "Conforme ordem de compra"
      });

      // Registrar log de criação
      if (req.session.userId) {
        await storage.createLog({
          userId: req.session.userId,
          action: "Criou pedido",
          itemType: "order",
          itemId: newOrder.id.toString(),
          details: `Pedido ${newOrder.orderId} criado`
        });
      }

      res.json({
        success: true,
        message: "Pedido criado com sucesso",
        order: newOrder
      });

    } catch (error) {
      console.error("Erro ao criar pedido:", error);
      res.status(500).json({
        success: false,
        message: "Erro ao criar pedido",
        error: error instanceof Error ? error.message : "Erro desconhecido"
      });
    }
  });

  // Excluir pedido (apenas keyuser)
  app.delete("/api/orders/:id", isAuthenticated, isKeyUser, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({
          success: false,
          message: "ID inválido"
        });
      }

      // Verificar se o pedido existe
      const checkOrder = await pool.query(
        "SELECT * FROM orders WHERE id = $1",
        [id]
      );

      if (!checkOrder.rows.length) {
        return res.status(404).json({
          success: false,
          message: "Pedido não encontrado"
        });
      }

      const order = checkOrder.rows[0];

      // Excluir o pedido diretamente (documentos são armazenados como JSON no próprio pedido)
      await pool.query("DELETE FROM orders WHERE id = $1", [id]);

      // Registrar log de exclusão
      if (req.session.userId) {
        await storage.createLog({
          userId: req.session.userId,
          action: "Excluiu pedido",
          itemType: "order",
          itemId: id.toString(),
          details: `Pedido ${order.order_id} excluído`
        });
      }

      res.json({
        success: true,
        message: "Pedido excluído com sucesso"
      });

    } catch (error) {
      console.error("Erro ao excluir pedido:", error);
      res.status(500).json({
        success: false,
        message: "Erro ao excluir pedido",
        error: error instanceof Error ? error.message : "Erro desconhecido"
      });
    }
  });

  // Purchase Orders routes
  app.get("/api/ordens-compra", isAuthenticated, async (req, res) => {
    try {
      // Usar query SQL direta na tabela ordens_compra em vez do storage obsoleto
      if (!pool) {
        // Se não há banco de dados, retornar array vazio para desenvolvimento local
        return res.json([]);
      }

      let query = `
        SELECT 
          oc.id,
          oc.numero_ordem,
          oc.empresa_id,
          oc.cnpj,
          c.name as empresa_nome,
          obra.name as obra_nome,
          oc.valido_ate,
          oc.status,
          oc.data_criacao
        FROM ordens_compra oc
        LEFT JOIN companies c ON oc.empresa_id = c.id
        LEFT JOIN companies obra ON oc.cnpj = obra.cnpj
      `;

      let queryParams: any[] = [];

      // Aplicar restrição baseada nos critérios da empresa do usuário
      if (req.user && req.user.companyId) {
        // Buscar a empresa do usuário
        const userCompany = await storage.getCompany(req.user.companyId);
        
        if (userCompany) {
          // Buscar a categoria da empresa
          const companyCategory = await storage.getCompanyCategory(userCompany.categoryId);
          
          if (companyCategory) {
            // Verificar se a empresa tem pelo menos 1 critério ativo
            const hasAnyCriteria = companyCategory.requiresApprover || 
                                 companyCategory.requiresContract || 
                                 companyCategory.receivesPurchaseOrders;
            
            if (hasAnyCriteria) {
              // Filtrar ordens de compra onde:
              // 1. A empresa é a fornecedora (empresa_id = companyId do usuário)
              // 2. OU a empresa é a obra de destino (cnpj corresponde ao CNPJ da empresa do usuário)
              query += ` WHERE (oc.empresa_id = $1 OR oc.cnpj = $2)`;
              queryParams.push(req.user.companyId, userCompany.cnpj);
              console.log(`🔒 Ordens de compra - visualização restrita à empresa ${userCompany.name} (fornecedora ou obra)`);
            } else {
              console.log(`🔓 Ordens de compra - visualização irrestrita (empresa ${userCompany.name} sem critérios)`);
            }
          }
        }
      }

      query += ` ORDER BY oc.data_criacao DESC`;

      const result = await pool.query(query, queryParams);

      console.log("📊 Debug: ordens de compra com cnpj:", result.rows.map(row => ({
        id: row.id,
        numero_ordem: row.numero_ordem,
        empresa_id: row.empresa_id,
        cnpj: row.cnpj,
        obra_nome: row.obra_nome
      })));

      // Formatar os dados para o frontend
      const formattedOrders = result.rows.map((row: any) => ({
        id: row.id,
        numero_ordem: row.numero_ordem,
        empresa_id: row.empresa_id,
        cnpj: row.cnpj,
        empresa_nome: row.empresa_nome || "Empresa não encontrada",
        obra_nome: row.obra_nome || null,
        valido_ate: row.valido_ate ? new Date(row.valido_ate).toISOString() : new Date().toISOString(),
        status: row.status || "Ativo",
        data_criacao: row.data_criacao ? new Date(row.data_criacao).toISOString() : new Date().toISOString()
      }));

      res.json(formattedOrders);
    } catch (error) {
      console.error("Erro ao buscar ordens de compra:", error);
      res.status(500).json({ message: "Erro ao buscar ordens de compra" });
    }
  });

  // Rota de compatibilidade para o frontend que ainda usa /api/purchase-orders
  // IMPORTANTE: Esta rota agora filtra apenas ordens válidas para criação de pedidos
  app.get("/api/purchase-orders", isAuthenticated, async (req, res) => {
    try {
      // Usar query SQL direta na tabela ordens_compra em vez do storage obsoleto
      if (!pool) {
        // Se não há banco de dados, retornar array vazio para desenvolvimento local
        return res.json([]);
      }

      let query = `
        SELECT 
          oc.id,
          oc.numero_ordem as order_number,
          oc.empresa_id as company_id,
          oc.cnpj,
          c.name as empresa_nome,
          obra.name as obra_nome,
          oc.valido_ate as valid_until,
          oc.status,
          oc.data_criacao as created_at
        FROM ordens_compra oc
        LEFT JOIN companies c ON oc.empresa_id = c.id
        LEFT JOIN companies obra ON oc.cnpj = obra.cnpj
      `;

      let queryParams: any[] = [];
      let whereConditions: string[] = [];

      // NOVO: Filtrar apenas ordens válidas (não expiradas) para criação de pedidos
      whereConditions.push("oc.valido_ate >= CURRENT_DATE");
      whereConditions.push("oc.status = 'Ativo'");

      // Aplicar restrição baseada nos critérios da empresa do usuário
      if (req.user && req.user.companyId) {
        // Buscar a empresa do usuário
        const userCompany = await storage.getCompany(req.user.companyId);
        
        if (userCompany) {
          // Buscar a categoria da empresa
          const companyCategory = await storage.getCompanyCategory(userCompany.categoryId);
          
          if (companyCategory) {
            // Verificar se a empresa tem pelo menos 1 critério ativo
            const hasAnyCriteria = companyCategory.requiresApprover || 
                                 companyCategory.requiresContract || 
                                 companyCategory.receivesPurchaseOrders;
            
            if (hasAnyCriteria) {
              // Filtrar ordens de compra onde:
              // 1. A empresa é a fornecedora (empresa_id = companyId do usuário)
              // 2. OU a empresa é a obra de destino (cnpj corresponde ao CNPJ da empresa do usuário)
              whereConditions.push("(oc.empresa_id = $" + (queryParams.length + 1) + " OR oc.cnpj = $" + (queryParams.length + 2) + ")");
              queryParams.push(req.user.companyId, userCompany.cnpj);
              console.log(`🔒 Purchase orders (compatibilidade) - visualização restrita à empresa ${userCompany.name} (fornecedora ou obra) e apenas válidas`);
            }
          }
        }
      }

      if (whereConditions.length > 0) {
        query += ` WHERE ` + whereConditions.join(' AND ');
      }

      query += ` ORDER BY oc.data_criacao DESC`;

      const result = await pool.query(query, queryParams);

      // Formatar os dados para o frontend no formato esperado
      const formattedOrders = result.rows.map((row: any) => ({
        id: row.id,
        order_number: row.order_number,
        company_id: row.company_id,
        cnpj: row.cnpj,
        empresa_nome: row.empresa_nome || "Empresa não encontrada",
        obra_nome: row.obra_nome || null,
        valid_until: row.valid_until ? new Date(row.valid_until).toISOString() : new Date().toISOString(),
        status: row.status || "Ativo",
        created_at: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
        // Campos adicionais para compatibilidade
        numero_ordem: row.order_number,
        empresa_id: row.company_id,
        valido_ate: row.valid_until ? new Date(row.valid_until).toISOString() : new Date().toISOString(),
        data_criacao: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString()
      }));

      console.log(`📋 Purchase orders para criação de pedidos: ${formattedOrders.length} ordens válidas retornadas`);

      res.json(formattedOrders);
    } catch (error) {
      console.error("Erro ao buscar ordens de compra:", error);
      res.status(500).json({ message: "Erro ao buscar ordens de compra" });
    }
  });

  // Criar nova ordem de compra
  app.post("/api/ordem-compra-nova", async (req, res) => {
    try {
      const { numeroOrdem, empresaId, cnpj, validoAte, produtos } = req.body;

      if (!numeroOrdem || !empresaId || !cnpj || !validoAte || !produtos || !produtos.length) {
        return res.status(400).json({
          sucesso: false,
          mensagem: "Dados incompletos para criar ordem de compra"
        });
      }

      // Nota: Duas ordens de compra podem ter o mesmo nome (regra de negócio)

      // Criar a ordem de compra
      const userId = req.session.userId || 999; // Usar ID do usuário da sessão ou um padrão

      const ordemResult = await pool.query(
        `INSERT INTO ordens_compra 
         (numero_ordem, empresa_id, cnpj, usuario_id, valido_ate, status, data_criacao) 
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
        [numeroOrdem, empresaId, cnpj, userId, validoAte, "Ativo", new Date()]
      );

      const novaOrdem = ordemResult.rows[0];

      // Inserir os itens da ordem
      for (const produto of produtos) {
        await pool.query(
          `INSERT INTO itens_ordem_compra 
           (ordem_compra_id, produto_id, quantidade) 
           VALUES ($1, $2, $3)`,
          [novaOrdem.id, produto.id, produto.qtd.toString()]
        );
      }

      // Registrar log de criação
      if (req.session.userId) {
        await storage.createLog({
          userId: req.session.userId,
          action: "Criou ordem de compra",
          itemType: "purchase_order",
          itemId: novaOrdem.id.toString(),
          details: `Ordem de compra ${numeroOrdem} criada`
        });
      }

      res.json({
        sucesso: true,
        mensagem: "Ordem de compra criada com sucesso",
        ordem: novaOrdem
      });

    } catch (error) {
      console.error("Erro ao criar ordem de compra:", error);
      res.status(500).json({
        sucesso: false,
        mensagem: "Erro ao criar ordem de compra",
        erro: error instanceof Error ? error.message : "Erro desconhecido"
      });
    }
  });

  // Rota para download do PDF da ordem de compra
  app.get("/api/ordem-compra/:id/pdf", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({
          sucesso: false,
          mensagem: "ID inválido"
        });
      }

      // Buscar informações da ordem de compra (verificar se coluna pdf_url existe)
      let ordemResult;
      try {
        ordemResult = await pool.query(
          "SELECT numero_ordem, pdf_url FROM ordens_compra WHERE id = $1",
          [id]
        );
      } catch (columnError) {
        // Se a coluna pdf_url não existir, buscar apenas o número da ordem
        console.log("⚠️ Coluna pdf_url não existe, buscando apenas numero_ordem");
        ordemResult = await pool.query(
          "SELECT numero_ordem FROM ordens_compra WHERE id = $1",
          [id]
        );
      }

      if (!ordemResult.rows.length) {
        return res.status(404).json({
          sucesso: false,
          mensagem: "Ordem de compra não encontrada"
        });
      }

      const ordem = ordemResult.rows[0];
      console.log(`🔍 Buscando PDF para ordem: ${ordem.numero_ordem}`);

      // 1. Verificar se existe PDF_URL na base de dados (se a coluna existir)
      if (ordem.pdf_url) {
        console.log(`📁 Tentando PDF pelo pdf_url: ${ordem.pdf_url}`);
        let pdfPath;
        
        // Se começar com /, é um caminho absoluto do sistema
        if (ordem.pdf_url.startsWith('/')) {
          pdfPath = path.join(process.cwd(), "public", ordem.pdf_url);
        } else {
          pdfPath = path.join(process.cwd(), ordem.pdf_url);
        }
        
        if (fs.existsSync(pdfPath)) {
          console.log(`✅ PDF encontrado em: ${pdfPath}`);
          res.setHeader("Content-Type", "application/pdf");
          res.setHeader("Content-Disposition", `attachment; filename="ordem_compra_${ordem.numero_ordem}.pdf"`);
          return res.sendFile(pdfPath);
        } else {
          console.log(`❌ PDF não encontrado em: ${pdfPath}`);
        }
      }

      // 2. Tentar buscar o arquivo na pasta uploads usando o número da ordem
      const uploadsPath = path.join(process.cwd(), "uploads", `${ordem.numero_ordem}.pdf`);
      console.log(`📁 Tentando PDF em uploads: ${uploadsPath}`);
      
      if (fs.existsSync(uploadsPath)) {
        console.log(`✅ PDF encontrado em uploads: ${uploadsPath}`);
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", `attachment; filename="ordem_compra_${ordem.numero_ordem}.pdf"`);
        return res.sendFile(uploadsPath);
      } else {
        console.log(`❌ PDF não encontrado em uploads: ${uploadsPath}`);
      }

      // 3. Listar arquivos disponíveis para debug
      const uploadsDir = path.join(process.cwd(), "uploads");
      if (fs.existsSync(uploadsDir)) {
        const files = fs.readdirSync(uploadsDir).filter(f => f.endsWith('.pdf'));
        console.log(`📋 PDFs disponíveis em uploads:`, files);
      }

      // Se não encontrar o arquivo
      return res.status(404).json({
        sucesso: false,
        mensagem: `PDF da ordem de compra ${ordem.numero_ordem} não encontrado. Verifique se o arquivo foi enviado.`
      });

    } catch (error) {
      console.error("Erro ao buscar PDF da ordem de compra:", error);
      res.status(500).json({
        sucesso: false,
        mensagem: "Erro interno do servidor"
      });
    }
  });

  // Rota para upload de PDF da ordem de compra
  app.post(
    "/api/ordem-compra/:id/upload-pdf",
    uploadOrdemCompraPdf.single("ordem_pdf"),
    async (req, res) => {
      try {
        const id = parseInt(req.params.id);
        if (isNaN(id)) {
          return res.status(400).json({
            sucesso: false,
            mensagem: "ID inválido"
          });
        }

        if (!req.file) {
          return res.status(400).json({
            sucesso: false,
            mensagem: "Nenhum arquivo PDF foi enviado"
          });
        }

        // Atualizar o campo pdf_url na tabela ordens_compra
        const pdfUrl = `/uploads/${req.file.filename}`; // Caminho para o arquivo
        await pool.query(
          `UPDATE ordens_compra SET pdf_url = $1 WHERE id = $2`,
          [pdfUrl, id]
        );

        // Registrar log de upload
        if (req.session.userId) {
          await storage.createLog({
            userId: req.session.userId,
            action: "Upload de PDF da ordem de compra",
            itemType: "purchase_order",
            itemId: id.toString(),
            details: `PDF da ordem de compra ${id} enviado`
          });
        }

        res.json({
          sucesso: true,
          mensagem: "Upload do PDF realizado com sucesso",
          pdfUrl: pdfUrl
        });
      } catch (error) {
        console.error("Erro ao fazer upload do PDF:", error);
        res.status(500).json({
          sucesso: false,
          mensagem: "Erro ao fazer upload do PDF",
          erro: error instanceof Error ? error.message : "Erro desconhecido"
        });
      }
    }
  );

  // Atualizar ordem de compra existente
  app.put("/api/ordem-compra/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({
          sucesso: false,
          mensagem: "ID inválido"
        });
      }

      const { numeroOrdem, empresaId, cnpj, validoAte, items } = req.body;

      // Verificar se a ordem existe
      const checkOrdem = await pool.query(
        "SELECT * FROM ordens_compra WHERE id = $1",
        [id]
      );

      if (!checkOrdem || !checkOrdem.rows || checkOrdem.rows.length === 0) {
        return res.status(404).json({
          sucesso: false,
          mensagem: "Ordem de compra não encontrada"
        });
      }

      // Atualizar a ordem
      await pool.query(
        `UPDATE ordens_compra 
         SET numero_ordem = $1, empresa_id = $2, cnpj = $3, valido_ate = $4
         WHERE id = $5`,
        [numeroOrdem, empresaId, cnpj, validoAte, id]
      );

      // Remover itens antigos
      await pool.query("DELETE FROM itens_ordem_compra WHERE ordem_compra_id = $1", [id]);

      // Inserir novos itens
      if (items && items.length > 0) {
        for (const item of items) {
          await pool.query(
            `INSERT INTO itens_ordem_compra 
             (ordem_compra_id, produto_id, quantidade) 
             VALUES ($1, $2, $3)`,
            [id, item.productId, item.quantity]
          );
        }
      }

      // Registrar log de atualização
      if (req.session.userId) {
        await storage.createLog({
          userId: req.session.userId,
          action: "Atualizou ordem de compra",
          itemType: "purchase_order",
          itemId: id.toString(),
          details: `Ordem de compra ${numeroOrdem} atualizada`
        });
      }

      res.json({
        sucesso: true,
        mensagem: "Ordem de compra atualizada com sucesso"
      });

    } catch (error) {
      console.error("Erro ao atualizar ordem de compra:", error);
      res.status(500).json({
        sucesso: false,
        mensagem: "Erro ao atualizar ordem de compra",
        erro: error instanceof Error ? error.message : "Erro desconhecido"
      });
    }
  });

  // Excluir ordem de compra (apenas keyuser)
  app.delete("/api/ordem-compra/:id", isAuthenticated, isKeyUser, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({
          sucesso: false,
          mensagem: "ID inválido"
        });
      }

      // Verificar se a ordem existe
      const checkOrdem = await pool.query(
        "SELECT * FROM ordens_compra WHERE id = $1",
        [id]
      );

      if (!checkOrdem || !checkOrdem.rows || checkOrdem.rows.length === 0) {
        return res.status(404).json({
          sucesso: false,
          mensagem: "Ordem de compra não encontrada"
        });
      }

      // Verificar se há pedidos vinculados a esta ordem
      try {
        const checkPedidos = await pool.query(
          "SELECT order_id, status FROM orders WHERE purchase_order_id = $1",
          [id]
        );

        if (checkPedidos.rows.length > 0) {
          const pedidosVinculados = checkPedidos.rows.map((row: any) => row.order_id).join(", ");
          return res.status(400).json({
            sucesso: false,
            mensagem: `Não é possível excluir esta ordem pois existem ${checkPedidos.rows.length} pedido(s) vinculado(s) a ela: ${pedidosVinculados}. Exclua os pedidos primeiro.`
          });
        }
      } catch (err) {
        console.error("Erro ao verificar pedidos vinculados:", err);
        // Continuar mesmo se houver erro na verificação
      }

      // Excluir os itens da ordem
      await pool.query("DELETE FROM itens_ordem_compra WHERE ordem_compra_id = $1", [id]);

      // Excluir a ordem
      await pool.query("DELETE FROM ordens_compra WHERE id = $1", [id]);

      // Registrar log de exclusão
      if (req.session.userId) {
        const ordemInfo = checkOrdem.rows[0];
        await storage.createLog({
          userId: req.session.userId,
          action: "Excluiu ordem de compra",
          itemType: "purchase_order",
          itemId: id.toString(),
          details: `Ordem de compra ${ordemInfo.numero_ordem} excluída`
        });
      }

      res.json({
        sucesso: true,
        mensagem: "Ordem de compra excluída com sucesso"
      });

    } catch (error) {
      console.error("Erro ao excluir ordem de compra:", error);
      res.status(500).json({
        sucesso: false,
        mensagem: "Erro ao excluir ordem de compra",
        erro: error instanceof Error ? error.message : "Erro desconhecido"
      });
    }
  });

  // Obter itens de uma ordem de compra
  app.get("/api/ordem-compra/:id/itens", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({
          sucesso: false,
          mensagem: "ID inválido"
        });
      }

      console.log(`🔍 Buscando itens da ordem de compra ID: ${id}`);

      // Verificar se a ordem de compra existe
      const ordemCheck = await pool.query(
        "SELECT id, numero_ordem FROM ordens_compra WHERE id = $1",
        [id]
      );

      if (!ordemCheck.rows.length) {
        console.log(`❌ Ordem de compra ${id} não encontrada`);
        return res.status(404).json({
          sucesso: false,
          mensagem: "Ordem de compra não encontrada"
        });
      }

      console.log(`✅ Ordem encontrada: ${ordemCheck.rows[0].numero_ordem}`);

      // Buscar os itens da ordem com informações do produto
      const result = await pool.query(`
        SELECT 
          i.id,
          i.ordem_compra_id,
          i.produto_id,
          i.quantidade,
          p.name as produto_nome,
          u.name as unidade_nome,
          u.abbreviation as unidade
        FROM itens_ordem_compra i
        LEFT JOIN products p ON i.produto_id = p.id
        LEFT JOIN units u ON p.unit_id = u.id
        WHERE i.ordem_compra_id = $1
        ORDER BY p.name
      `, [id]);

      console.log(`📦 Encontrados ${result.rows.length} itens na ordem ${id}`);

      // Formatar os dados para o frontend
      const itens = result.rows.map((item: any) => ({
        id: item.id,
        ordem_compra_id: item.ordem_compra_id,
        produto_id: item.produto_id,
        produto_nome: item.produto_nome || "Produto não encontrado",
        unidade: item.unidade || item.unidade_nome || "un",
        quantidade: parseFloat(item.quantidade || 0)
      }));

      console.log(`📊 Itens formatados:`, itens);

      res.json(itens);

    } catch (error) {
      console.error("❌ Erro ao buscar itens da ordem de compra:", error);
      res.status(500).json({
        sucesso: false,
        mensagem: "Erro ao buscar itens da ordem de compra",
        erro: error instanceof Error ? error.message : "Erro desconhecido"
      });
    }
  });

  // Obter empresas disponíveis para ordens de compra
  app.get("/api/empresas-para-ordens-compra", async (req, res) => {
    try {
      // Buscar todas as empresas usando o storage
      const companies = await storage.getAllCompanies();
      const categories = await storage.getAllCompanyCategories();

      // Processar os resultados para formar objetos completos
      const empresas = companies.map(company => {
        const category = categories.find(cat => cat.id === company.categoryId);

        return {
          id: company.id,
          name: company.name,
          cnpj: company.cnpj,
          contractNumber: company.contractNumber,
          category: {
            name: category?.name || "Sem categoria",
            receivesPurchaseOrders: category?.receivesPurchaseOrders || false,
            requiresContract: category?.requiresContract || false
          }
        };
      });

      res.json(empresas);
    } catch (error) {
      console.error("Erro ao buscar empresas para ordens de compra:", error);
      res.status(500).json({
        sucesso: false,
        mensagem: "Erro ao buscar empresas para ordens de compra"
      });
    }
  });

  // Obter obras (empresas com número de contrato) para ordens de compra
  app.get("/api/obras-para-ordens-compra", async (req, res) => {
    try {
      // Buscar apenas empresas que possuem número de contrato preenchido usando storage
      const companies = await storage.getAllCompanies();

      // Filtrar empresas com número de contrato
      const obras = companies
        .filter(company => company.contractNumber && company.contractNumber.trim() !== '')
        .map(company => ({
          id: company.id,
          name: company.name,
          contractNumber: company.contractNumber
        }));

      // Log para debug
      console.log("Obras disponíveis:", obras);

      res.json(obras);
    } catch (error) {
      console.error("Erro ao buscar empresas para ordens de compra:", error);
      res.status(500).json({
        sucesso: false,
        mensagem: "Erro ao buscar empresas para ordens de compra"
      });
    }
  });

  // Função auxiliar para obter a unidade de um produto
  async function getUnidadeProduto(produtoId: number): Promise<string> {
    try {
      const result = await pool.query(`
        SELECT u.name, u.abbreviation
        FROM products p
        JOIN units u ON p.unit_id = u.id
        WHERE p.id = $1
      `, [produtoId]);

      if (result.rows.length > 0) {
        return result.rows[0].abbreviation || result.rows[0].name || 'un';
      }

      return 'un';
    } catch (error) {
      console.error("Erro ao buscar unidade do produto:", error);
      return 'un';
    }
  }

  // Rota de compatibilidade para buscar itens de ordem de compra
  app.get("/api/purchase-orders/:id/items", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({
          success: false,
          message: "ID inválido"
        });
      }

      console.log(`🔍 Rota de compatibilidade - Buscando itens da ordem ${id}`);

      // Buscar os itens da ordem com informações do produto
      const result = await pool.query(`
        SELECT 
          i.id,
          i.ordem_compra_id as purchase_order_id,
          i.produto_id as product_id,
          i.quantidade as quantity,
          p.name as product_name,
          u.name as unit_name,
          u.abbreviation as unit
        FROM itens_ordem_compra i
        LEFT JOIN products p ON i.produto_id = p.id
        LEFT JOIN units u ON p.unit_id = u.id
        WHERE i.ordem_compra_id = $1
        ORDER BY p.name
      `, [id]);

      console.log(`📦 Compatibilidade - Encontrados ${result.rows.length} itens`);

      // Formatar no padrão esperado pelo frontend
      const items = result.rows.map((item: any) => ({
        id: item.id,
        purchaseOrderId: item.purchase_order_id,
        productId: item.product_id,
        productName: item.product_name || "Produto não encontrado",
        unit: item.unit || item.unit_name || "un",
        quantity: parseFloat(item.quantity || 0)
      }));

      res.json(items);

    } catch (error) {
      console.error("❌ Erro na rota de compatibilidade:", error);
      res.status(500).json({
        success: false,
        message: "Erro ao buscar itens da ordem de compra"
      });
    }
  });

  // Verificar saldo disponível em uma ordem de compra para um produto
  app.get("/api/ordens-compra/:id/produtos/:produtoId/saldo", async (req, res) => {
    try {
      const ordemId = parseInt(req.params.id);
      const produtoId = parseInt(req.params.produtoId);

      if (isNaN(ordemId) || isNaN(produtoId)) {
        return res.status(400).json({
          sucesso: false,
          mensagem: "IDs inválidos"
        });
      }

      // 1. Buscar a quantidade total na ordem de compra
      const itemOrdemResult = await pool.query(
        `SELECT quantidade FROM itens_ordem_compra 
         WHERE ordem_compra_id = $1 AND produto_id = $2`,
        [ordemId, produtoId]
      );

      // Se não encontrar o produto na ordem
      if (!itemOrdemResult.rows.length) {
        return res.json({
          sucesso: true,
          saldoDisponivel: 0,
          saldo_disponivel: 0,
          quantidadeTotal: 0,
          quantidadeUsada: 0
        });
      }

      const quantidadeTotal = parseFloat(itemOrdemResult.rows[0].quantidade);

      // 2. Buscar a quantidade já usada em pedidos (MESMA LÓGICA DA CRIAÇÃO DE PEDIDOS)
      const pedidosResult = await pool.query(
        `SELECT COALESCE(SUM(CAST(quantity AS DECIMAL)), 0) as total_usado
         FROM orders 
         WHERE purchase_order_id = $1 AND product_id = $2 AND status != 'Cancelado'`,
        [ordemId, produtoId]
      );

      const quantidadeUsada = parseFloat(pedidosResult.rows[0].total_usado || 0);

      // 3. Calcular o saldo disponível (MESMA LÓGICA DA CRIAÇÃO DE PEDIDOS)
      const saldoDisponivel = quantidadeTotal - quantidadeUsada;

      console.log(`Saldo calculado para ordem ${ordemId}, produto ${produtoId}:`, {
        quantidadeTotal,
        quantidadeUsada,
        saldoDisponivel
      });

      // Formatar valores para exibição com até 3 casas decimais
      res.json({
        sucesso: true,
        saldoDisponivel: parseFloat(saldoDisponivel.toFixed(3)),
        saldo_disponivel: parseFloat(saldoDisponivel.toFixed(3)), // Compatibilidade com frontend
        quantidadeTotal: parseFloat(quantidadeTotal.toFixed(3)),
        quantidadeUsada: parseFloat(quantidadeUsada.toFixed(3)),
        unidade: await getUnidadeProduto(produtoId)
      });

    } catch (error) {
      console.error("Erro ao verificar saldo disponível:", error);
      res.status(500).json({
        sucesso: false,
        mensagem: "Erro ao verificar saldo disponível"
      });
    }
  });

  // Verificar quantidade entregue em uma ordem de compra para um produto
  app.get("/api/ordens-compra/:id/produtos/:produtoId/entregue", async (req, res) => {
    try {
      const ordemId = parseInt(req.params.id);
      const produtoId = parseInt(req.params.produtoId);

      if (isNaN(ordemId) || isNaN(produtoId)) {
        return res.status(400).json({
          sucesso: false,
          mensagem: "IDs inválidos"
        });
      }

      // Buscar a quantidade entregue (somatório de pedidos com status "Entregue")
      const entregueResult = await pool.query(
        `SELECT COALESCE(SUM(
          CASE 
            WHEN quantidade_recebida IS NOT NULL 
                 AND quantidade_recebida != '' 
                 AND quantidade_recebida ~ '^[0-9]*\.?[0-9]+$'
            THEN CAST(quantidade_recebida AS DECIMAL)
            ELSE CAST(quantity AS DECIMAL)
          END
        ), 0) as total_entregue
         FROM orders 
         WHERE purchase_order_id = $1 AND product_id = $2 AND status = 'Entregue'`,
        [ordemId, produtoId]
      );

      const quantidadeEntregue = parseFloat(entregueResult.rows[0].total_entregue || 0);

      console.log(`Quantidade entregue para ordem ${ordemId}, produto ${produtoId}: ${quantidadeEntregue}`);

      res.json({
        sucesso: true,
        quantidadeEntregue: parseFloat(quantidadeEntregue.toFixed(3)),
        unidade: await getUnidadeProduto(produtoId)
      });

    } catch (error) {
      console.error("Erro ao verificar quantidade entregue:", error);
      res.status(500).json({
        sucesso: false,
        mensagem: "Erro ao verificar quantidade entregue"
      });
    }
  });

  // Company Categories routes
  app.get("/api/company-categories", async (req, res) => {
    try {
      const categories = await storage.getAllCompanyCategories();
      res.json(categories);
    } catch (error) {
      console.error("Erro ao buscar categorias de empresas:", error);
      res.status(500).json({ message: "Erro ao buscar categorias de empresas" });
    }
  });

  app.post("/api/company-categories", async (req, res) => {
    try {
      const categoryData = insertCompanyCategorySchema.parse(req.body);
      const newCategory = await storage.createCompanyCategory(categoryData);

      // Registrar log de criação
      if (req.session.userId) {
        await storage.createLog({
          userId: req.session.userId,
          action: "Criou categoria de empresa",
          itemType: "company_category",
          itemId: newCategory.id.toString(),
          details: `Categoria ${newCategory.name} criada`
        });
      }

      res.json(newCategory);
    } catch (error) {
      console.error("Erro ao criar categoria de empresa:", error);
      res.status(500).json({ message: "Erro ao criar categoria de empresa" });
    }
  });

  app.put("/api/company-categories/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "ID inválido" });
      }

      const categoryData = req.body;
      const updatedCategory = await storage.updateCompanyCategory(id, categoryData);

      // Registrar log de atualização
      if (req.session.userId && updatedCategory) {
        await storage.createLog({
          userId: req.session.userId,
          action: "Atualizou categoria de empresa",
          itemType: "company_category",
          itemId: id.toString(),
          details: `Categoria ${updatedCategory.name} atualizada`
        });
      }

      res.json(updatedCategory);
    } catch (error) {
      console.error("Erro ao atualizar categoria de empresa:", error);
      res.status(500).json({ message: "Erro ao atualizar categoria de empresa" });
    }
  });

  app.delete("/api/company-categories/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "ID inválido" });
      }

      // Verificar se existem empresas usando esta categoria
      const companies = await storage.getAllCompanies();
      const hasCompanies = companies.some(company => company.categoryId === id);

      if (hasCompanies) {
        return res.status(400).json({ 
          message: "Não é possível excluir esta categoria porque existem empresas associadas a ela" 
        });
      }

      const deleted = await storage.deleteCompanyCategory(id);

      // Registrar log de exclusão
      if (req.session.userId) {
        await storage.createLog({
          userId: req.session.userId,
          action: "Excluiu categoria de empresa",
          itemType: "company_category",
          itemId: id.toString(),
          details: `Categoria de ID ${id} excluída`
        });
      }

      res.json({ success: deleted });
    } catch (error) {
      console.error("Erro ao excluir categoria de empresa:", error);
      res.status(500).json({ message: "Erro ao excluir categoria de empresa" });
    }
  });

  // User Roles routes
  app.get("/api/user-roles", isAuthenticated, async (req, res) => {
    try {
      const roles = await storage.getAllUserRoles();
      res.json(roles);
    } catch (error) {
      console.error("Erro ao buscar funções de usuários:", error);
      res.status(500).json({ message: "Erro ao buscar funções de usuários" });
    }
  });

  app.post("/api/user-roles", isAuthenticated, hasPermission("create_user_roles"), async (req, res) => {
    try {
      const roleData = insertUserRoleSchema.parse(req.body);
      const newRole = await storage.createUserRole(roleData);

      // Registrar log de criação
      if (req.session.userId) {
        await storage.createLog({
          userId: req.session.userId,
          action: "Criou função de usuário",
          itemType: "user_role",
          itemId: newRole.id.toString(),
          details: `Função ${newRole.name} criada`
        });
      }

      res.json(newRole);
    } catch (error) {
      console.error("Erro ao criar função de usuário:", error);
      res.status(500).json({ message: "Erro ao criar função de usuário" });
    }
  });

  app.put("/api/user-roles/:id", isAuthenticated, hasPermission("edit_user_roles"), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "ID inválido" });
      }

      const roleData = req.body;
      const updatedRole = await storage.updateUserRole(id, roleData);

      // Registrar log de atualização
      if (req.session.userId && updatedRole) {
        await storage.createLog({
          userId: req.session.userId,
          action: "Atualizou função de usuário",
          itemType: "user_role",
          itemId: id.toString(),
          details: `Função ${updatedRole.name} atualizada`
        });
      }

      res.json(updatedRole);
    } catch (error) {
      console.error("Erro ao atualizar função de usuário:", error);
      res.status(500).json({ message: "Erro ao atualizar função de usuário" });
    }
  });

  app.delete("/api/user-roles/:id", isAuthenticated, hasPermission("delete_user_roles"), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "ID inválido" });
      }

      // Verificar se existem usuários usando esta função
      const users = await storage.getAllUsers();
      const hasUsers = users.some(user => user.roleId === id);

      if (hasUsers) {
        return res.status(400).json({ 
          message: "Não é possível excluir esta função porque existem usuários associados a ela" 
        });
      }

      const deleted = await storage.deleteUserRole(id);

      // Registrar log de exclusão
      if (req.session.userId) {
        await storage.createLog({
          userId: req.session.userId,
          action: "Excluiu função de usuário",
          itemType: "user_role",
          itemId: id.toString(),
          details: `Função de ID ${id} excluída`
        });
      }

      res.json({ success: deleted });
    } catch (error) {
      console.error("Erro ao excluir função de usuário:", error);
      res.status(500).json({ message: "Erro ao excluir função de usuário" });
    }
  });

  // Units routes
  app.get("/api/units", async (req, res) => {
    try {
      const units = await storage.getAllUnits();
      res.json(units);
    } catch (error) {
      console.error("Erro ao buscar unidades:", error);
      res.status(500).json({ message: "Erro ao buscar unidades" });
    }
  });

  app.post("/api/units", async (req, res) => {
    try {
      const unitData = insertUnitSchema.parse(req.body);
      const newUnit = await storage.createUnit(unitData);

      // Registrar log de criação
      if (req.session.userId) {
        await storage.createLog({
          userId: req.session.userId,
          action: "Criou unidade",
          itemType: "unit",
          itemId: newUnit.id.toString(),
          details: `Unidade ${newUnit.name} (${newUnit.abbreviation}) criada`
        });
      }

      res.json(newUnit);
    } catch (error) {
      console.error("Erro ao criar unidade:", error);
      res.status(500).json({ message: "Erro ao criar unidade" });
    }
  });

  app.put("/api/units/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "ID inválido" });
      }

      const unitData = req.body;
      const updatedUnit = await storage.updateUnit(id, unitData);

      // Registrar log de atualização
      if (req.session.userId && updatedUnit) {
        await storage.createLog({
          userId: req.session.userId,
          action: "Atualizou unidade",
          itemType: "unit",
          itemId: id.toString(),
          details: `Unidade ${updatedUnit.name} (${updatedUnit.abbreviation}) atualizada`
        });
      }

      res.json(updatedUnit);
    } catch (error) {
      console.error("Erro ao atualizar unidade:", error);
      res.status(500).json({ message: "Erro ao atualizar unidade" });
    }
  });

  app.delete("/api/units/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "ID inválido" });
      }

      // Verificar se existem produtos usando esta unidade
      const products = await storage.getAllProducts();
      const hasProducts = products.some(product => product.unitId === id);

      if (hasProducts) {
        return res.status(400).json({ 
          message: "Não é possível excluir esta unidade porque existem produtos associados a ela" 
        });
      }

      const deleted = await storage.deleteUnit(id);

      // Registrar log de exclusão
      if (req.session.userId) {
        await storage.createLog({
          userId: req.session.userId,
          action: "Excluiu unidade",
          itemType: "unit",
          itemId: id.toString(),
          details: `Unidade de ID ${id} excluída`
        });
      }

      res.json({ success: deleted });
    } catch (error) {
      console.error("Erro ao excluir unidade:", error);
      res.status(500).json({ message: "Erro ao excluir unidade" });
    }
  });

  // System Logs routes
  app.get("/api/logs", async (req, res) => {
    try {
      const logs = await storage.getAllLogs();
      res.json(logs);
    } catch (error) {
      console.error("Erro ao buscar logs do sistema:", error);
      res.status(500).json({ message: "Erro ao buscar logs do sistema" });
    }
  });

  // Settings routes
  app.get("/api/settings", isAuthenticated, async (req, res) => {
    try {
      const settings = await storage.getAllSettings();
      
      console.log(`🔍 [Settings API] Usuário ${req.user.name} (ID: ${req.user.id}) solicitou configurações`);
      console.log(`🔍 [Settings API] Total de configurações: ${settings.length}`);
      
      // Se não é KeyUser, filtrar configurações sensíveis (exceto google_maps_api_key que é necessária no frontend)
      if (req.user.id !== 1 && !req.user.isKeyUser) {
        const publicSettings = settings.filter(setting => 
          setting.key === 'google_maps_api_key' || // Permitir Google Maps API Key para todos
          (!setting.key.includes('database') && 
           !setting.key.includes('pg') && 
           !setting.key.includes('token') && 
           !setting.key.includes('smtp') &&
           !setting.key.includes('password') &&
           setting.key !== 'openai_api_key' && // Bloquear outras API keys específicas
           setting.key !== 'github_token')
        );
        
        console.log(`🔒 [Settings API] Usuário não-KeyUser - configurações filtradas: ${publicSettings.length}`);
        console.log(`🔍 [Settings API] Configurações públicas disponíveis:`, publicSettings.map(s => s.key));
        
        const googleMapsConfig = publicSettings.find(s => s.key === 'google_maps_api_key');
        console.log(`🗝️ [Settings API] Google Maps API Key disponível para usuário:`, !!googleMapsConfig?.value);
        
        res.json(publicSettings);
      } else {
        console.log(`🔑 [Settings API] KeyUser - todas as configurações disponíveis`);
        const googleMapsConfig = settings.find(s => s.key === 'google_maps_api_key');
        console.log(`🗝️ [Settings API] Google Maps API Key presente:`, !!googleMapsConfig?.value);
        
        res.json(settings);
      }
    } catch (error) {
      console.error("Erro ao buscar configurações:", error);
      res.status(500).json({ message: "Erro ao buscar configurações" });
    }
  });

  app.put("/api/settings", isAuthenticated, async (req, res) => {
    try {
      const settingsArray = req.body;

      if (!Array.isArray(settingsArray)) {
        return res.status(400).json({ message: "Dados inválidos. Esperado um array de configurações." });
      }

      // Configurações sensíveis que só o KeyUser pode alterar
      const sensitiveKeys = [
        'database_url', 'pgdatabase', 'pghost', 'pgport', 'pguser', 'pgpassword',
        'github_token', 'openai_api_key', 'smtp_host', 'smtp_port', 'smtp_user', 'smtp_password'
      ];

      // Verificar se há configurações sensíveis sendo alteradas
      const hasSensitiveSettings = settingsArray.some(setting => 
        sensitiveKeys.includes(setting.key)
      );

      // Se há configurações sensíveis e não é KeyUser, negar acesso
      if (hasSensitiveSettings && req.user.id !== 1 && !req.user.isKeyUser) {
        return res.status(403).json({ 
          message: "Apenas o administrador pode alterar configurações de banco de dados e API keys" 
        });
      }

      // Atualizar cada configuração
      for (const setting of settingsArray) {
        if (!setting.key || setting.value === undefined) {
          continue; // Pular configurações inválidas
        }

        // Definir descrições para as novas configurações
        let description = setting.description || "";
        
        switch (setting.key) {
          case 'database_url':
            description = "String de conexão completa do PostgreSQL";
            break;
          case 'pgdatabase':
            description = "Nome do banco de dados PostgreSQL";
            break;
          case 'pghost':
            description = "Servidor do banco de dados PostgreSQL";
            break;
          case 'pgport':
            description = "Porta do banco de dados PostgreSQL";
            break;
          case 'pguser':
            description = "Usuário do banco de dados PostgreSQL";
            break;
          case 'pgpassword':
            description = "Senha do banco de dados PostgreSQL";
            break;
          case 'github_token':
            description = "Token de acesso do GitHub";
            break;
          case 'openai_api_key':
            description = "Chave de API do OpenAI";
            break;
          case 'smtp_host':
            description = "Servidor SMTP para envio de e-mails";
            break;
          case 'smtp_port':
            description = "Porta do servidor SMTP";
            break;
          case 'smtp_user':
            description = "Usuário para autenticação SMTP";
            break;
          case 'smtp_password':
            description = "Senha para autenticação SMTP";
            break;
        }

        await storage.createOrUpdateSetting({
          key: setting.key,
          value: setting.value,
          description: description
        });
      }

      // Registrar log da ação
      if (req.session.userId) {
        await storage.createLog({
          userId: req.session.userId,
          action: "Atualizou configurações do sistema",
          itemType: "settings",
          itemId: "system",
          details: `${settingsArray.length} configuração(ões) atualizada(s)${hasSensitiveSettings ? ' (incluindo configurações sensíveis)' : ''}`
        });
      }

      res.json({ message: "Configurações atualizadas com sucesso" });
    } catch (error) {
      console.error("Erro ao atualizar configurações:", error);
      res.status(500).json({ message: "Erro ao atualizar configurações" });
    }
  });

  // Upload de logo
  app.post("/api/upload/logo", uploadLogo.single("logo"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "Nenhum arquivo foi enviado" });
      }

      // Gerar URL do logo
      const logoUrl = `/public/uploads/${req.file.filename}`;

      // Atualizar a configuração logo_url no banco
      await storage.createOrUpdateSetting({
        key: "logo_url",
        value: logoUrl,
        description: "URL do logo da aplicação"
      });

      res.json({ 
        message: "Logo enviado com sucesso",
        logoUrl: logoUrl,
        filename: req.file.filename
      });
    } catch (error) {
      console.error("Erro ao fazer upload do logo:", error);
      res.status(500).json({ message: "Erro ao fazer upload do logo" });
    }
  });

  // Configuração do upload com multer (usando storage_upload que cria pastas por order_id)
  const upload = multer({ 
    storage: storage_upload,
    fileFilter: fileFilter,
    limits: {
      fileSize: 10 * 1024 * 1024 // Limite de 10MB por arquivo
    }
  });

  // Rota para upload de documentos (versão completa com validação)
  app.post(
    "/api/pedidos/:id/documentos", 
    upload.fields([
      { name: 'nota_pdf', maxCount: 1 },
      { name: 'nota_xml', maxCount: 1 },
      { name: 'certificado_pdf', maxCount: 1 }
    ]), 
    async (req, res) => {
      console.log("📤 Iniciando upload de documentos para o pedido ID:", req.params.id);
      console.log("📄 Arquivos recebidos:", req.files);
      console.log("👤 Sessão do usuário:", req.session.userId);
      
      // Log adicional para verificar os caminhos dos arquivos
      if (req.files) {
        const files = req.files as { [fieldname: string]: Express.Multer.File[] };
        Object.keys(files).forEach(fieldname => {
          files[fieldname].forEach(file => {
            console.log(`📁 Arquivo ${fieldname} salvo em: ${file.path}`);
            console.log(`📁 Diretório: ${path.dirname(file.path)}`);
          });
        });
      }

      try {
        // Verificar se o pedido existe antes de iniciar o upload
        const id = parseInt(req.params.id);
        if (isNaN(id)) {
          return res.status(400).json({ 
            sucesso: false, 
            mensagem: "ID de pedido inválido" 
          });
        }

        // Buscar o pedido no banco de dados
        const order = await storage.getOrder(id);
        if (!order) {
          return res.status(404).json({
            sucesso: false,
            mensagem: "Pedido não encontrado"
          });
        }

        // Verificar se é pedido urgente não aprovado
        const deliveryDate = new Date(order.deliveryDate);
        const today = new Date();
        const daysDiff = Math.ceil((deliveryDate.getTime() - today.getTime()) / (1000 * 3600 * 24));
        const isUrgent = daysDiff <= 7;
        
        if (isUrgent && order.status === "Registrado") {
          return res.status(403).json({
            sucesso: false,
            mensagem: "Pedidos urgentes devem ser aprovados antes de permitir upload de documentos"
          });
        }

        // Verificar se o usuário está autenticado
        if (!req.session.userId) {
          return res.status(401).json({
            sucesso: false,
            mensagem: "Usuário não autenticado"
          });
        }

        // Verificar se os três documentos foram enviados
        const files = req.files as { [fieldname: string]: Express.Multer.File[] };

        if (!files || !files.nota_pdf || !files.nota_xml || !files.certificado_pdf) {
          return res.status(400).json({ 
            sucesso: false, 
            mensagem: "Todos os três documentos são obrigatórios (nota fiscal PDF, nota fiscal XML e certificado PDF)" 
          });
        }

        // Extrair quantidade comercial do XML da nota fiscal
        let quantidadeComercial = null;
        let xmlAnalysis = null;
        
        try {
          const xmlContent = fs.readFileSync(files.nota_xml[0].path, 'utf8');
          console.log("📄 Analisando XML da nota fiscal...");
          
          // Extrair quantidade comercial usando regex (buscar por qCom)
          const qComMatch = xmlContent.match(/<qCom>([\d.,]+)<\/qCom>/);
          if (qComMatch) {
            // Converter vírgula para ponto e parsear como número
            quantidadeComercial = parseFloat(qComMatch[1].replace(',', '.'));
            console.log(`📊 Quantidade comercial encontrada no XML: ${quantidadeComercial}`);
            
            xmlAnalysis = {
              quantidadeOriginal: order.quantity,
              quantidadeXML: quantidadeComercial,
              alteracaoNecessaria: quantidadeComercial !== order.quantity
            };
          } else {
            console.log("⚠️ Quantidade comercial não encontrada no XML");
            xmlAnalysis = {
              quantidadeOriginal: order.quantity,
              quantidadeXML: null,
              alteracaoNecessaria: false,
              erro: "Quantidade comercial não encontrada no XML"
            };
          }
        } catch (xmlError) {
          console.error("❌ Erro ao processar XML:", xmlError);
          xmlAnalysis = {
            quantidadeOriginal: order.quantity,
            quantidadeXML: null,
            alteracaoNecessaria: false,
            erro: "Erro ao processar XML da nota fiscal"
          };
        }

        // Verificar se os arquivos foram salvos no diretório correto
        const orderIdFromDB = await pool.query("SELECT order_id FROM orders WHERE id = $1", [id]);
        const expectedOrderId = orderIdFromDB.rows[0]?.order_id;
        const expectedDir = path.join(process.cwd(), "uploads", expectedOrderId);
        
        console.log(`🔍 Verificação do diretório:`);
        console.log(`📋 Order ID esperado: ${expectedOrderId}`);
        console.log(`📂 Diretório esperado: ${expectedDir}`);
        console.log(`📂 Diretório existe: ${fs.existsSync(expectedDir)}`);
        
        // Construir informações dos documentos para armazenar no banco
        const documentosInfo = {
          nota_pdf: {
            name: files.nota_pdf[0].originalname,
            filename: files.nota_pdf[0].filename,
            size: files.nota_pdf[0].size,
            path: files.nota_pdf[0].path,
            date: new Date().toISOString()
          },
          nota_xml: {
            name: files.nota_xml[0].originalname,
            filename: files.nota_xml[0].filename,
            size: files.nota_xml[0].size,
            path: files.nota_xml[0].path,
            date: new Date().toISOString(),
            analise: xmlAnalysis
          },
          certificado_pdf: {
            name: files.certificado_pdf[0].originalname,
            filename: files.certificado_pdf[0].filename,
            size: files.certificado_pdf[0].size,
            path: files.certificado_pdf[0].path,
            date: new Date().toISOString()
          }
        };

        // Se foi encontrada quantidade comercial diferente, atualizar o pedido
        let mensagemQuantidade = "";
        if (quantidadeComercial && quantidadeComercial !== order.quantity) {
          try {
            await pool.query(
              "UPDATE orders SET quantity = $1 WHERE id = $2",
              [quantidadeComercial, id]
            );
            
            mensagemQuantidade = ` Quantidade do pedido atualizada de ${order.quantity} para ${quantidadeComercial} (conforme XML da nota fiscal).`;
            
            console.log(`✅ Quantidade do pedido ${order.orderId} atualizada: ${order.quantity} → ${quantidadeComercial}`);
            
            // Registrar log específico da alteração de quantidade
            await storage.createLog({
              userId: req.session.userId,
              action: "Alteração de quantidade por XML",
              itemType: "order",
              itemId: id.toString(),
              details: `Quantidade do pedido ${order.orderId} alterada de ${order.quantity} para ${quantidadeComercial} baseada no XML da nota fiscal`
            });
          } catch (updateError) {
            console.error("❌ Erro ao atualizar quantidade do pedido:", updateError);
            mensagemQuantidade = " (Erro ao atualizar quantidade baseada no XML)";
          }
        }

        // Atualizar o pedido com as informações dos documentos
        await pool.query(
          "UPDATE orders SET status = $1, documentoscarregados = $2, documentosinfo = $3 WHERE id = $4",
          ["Carregado", true, JSON.stringify(documentosInfo), id]
        );

        // Registrar no log do sistema
        await storage.createLog({
          userId: req.session.userId,
          action: "Upload de documentos",
          itemType: "order",
          itemId: id.toString(),
          details: `Documentos carregados para o pedido ${order.orderId}${mensagemQuantidade}`
        });

        // Responder com sucesso
        return res.status(200).json({
          sucesso: true,
          mensagem: `Documentos enviados com sucesso.${mensagemQuantidade}`,
          documentos: documentosInfo,
          xmlAnalysis: xmlAnalysis
        });
      } catch (error) {
        console.error("Erro ao processar upload de documentos:", error);
        return res.status(500).json({
          sucesso: false,
mensagem: "Erro interno do servidor ao processar o upload",
          erro: error instanceof Error ? error.message : "Erro desconhecido"
        });
      }
    }
  );

  // Rota para download da foto de confirmação de entrega
  app.get("/api/pedidos/:id/foto-confirmacao", async (req, res) => {
    try {
      const id = parseInt(req.params.id);

      if (isNaN(id)) {
        return res.status(400).json({ 
          sucesso: false, 
          mensagem: "ID de pedido inválido" 
        });
      }

      // Buscar informações da foto de confirmação
      const result = await pool.query(
        "SELECT foto_confirmacao, order_id FROM orders WHERE id = $1",
        [id]
      );

      if (result.rowCount === 0 || !result.rows[0].foto_confirmacao) {
        return res.status(404).json({
          sucesso: false,
          mensagem: "Foto de confirmação não encontrada"
        });
      }

      const fotoInfo = typeof result.rows[0].foto_confirmacao === 'string' 
        ? JSON.parse(result.rows[0].foto_confirmacao) 
        : result.rows[0].foto_confirmacao;
      const orderId = result.rows[0].order_id;

      // Construir o caminho do arquivo
      const orderDir = path.join(process.cwd(), "uploads", orderId);
      const fotoPath = path.join(orderDir, fotoInfo.filename);

      // Verificar se o arquivo existe
      if (!fs.existsSync(fotoPath)) {
        return res.status(404).json({
          sucesso: false,
          mensagem: "Arquivo da foto não encontrado no servidor"
        });
      }

      // Configurar headers para download da imagem
      res.setHeader("Content-Type", "image/jpeg");
      res.setHeader("Content-Disposition", `attachment; filename=${fotoInfo.name}`);

      // Enviar o arquivo
      const fileStream = fs.createReadStream(fotoPath);
      fileStream.pipe(res);
    } catch (error) {
      console.error("Erro ao fazer download da foto de confirmação:", error);
      res.status(500).json({
        sucesso: false,
        mensagem: "Erro interno do servidor ao processar o download"
      });
    }
  });

  // Rota para download de documentos
  app.get("/api/pedidos/:id/documentos/:tipo", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const tipo = req.params.tipo;

      if (isNaN(id)) {
        return res.status(400).json({ 
          sucesso: false, 
          mensagem: "ID de pedido inválido" 
        });
      }

      // Verificar se o tipo é válido
      if (!["nota_pdf", "nota_xml", "certificado_pdf"].includes(tipo)) {
        return res.status(400).json({
          sucesso: false,
          mensagem: "Tipo de documento inválido"
        });
      }

      // Buscar o pedido para verificar se tem documentos
      const order = await storage.getOrder(id);
      if (!order) {
        return res.status(404).json({
          sucesso: false,
          mensagem: "Pedido não encontrado"
        });
      }

      // Verificar se o pedido tem documentos carregados
      // Aceitar pedidos com status "Carregado", "Em Rota" ou "Entregue" mesmo se a flag não estiver definida
      const hasDocuments = order.documentosCarregados || 
                          order.status === 'Carregado' || 
                          order.status === 'Em Rota' || 
                          order.status === 'Entregue';

      if (!hasDocuments) {
        return res.status(404).json({
          sucesso: false,
          mensagem: "Este pedido não possui documentos carregados"
        });
      }

      // Buscar as informações dos documentos do banco de dados
      const result = await pool.query(
        "SELECT documentosinfo, order_id FROM orders WHERE id = $1",
        [id]
      );

      console.log("Resultado da consulta:", result.rows[0]);

      if (result.rowCount === 0 || !result.rows[0].documentosinfo) {
        return res.status(404).json({
          sucesso: false,
          mensagem: "Informações dos documentos não encontradas"
        });
      }

      const documentosInfo = typeof result.rows[0].documentosinfo === 'string' 
        ? JSON.parse(result.rows[0].documentosinfo) 
        : result.rows[0].documentosinfo;
      const orderId = result.rows[0].order_id;

      console.log("Informações dos documentos:", documentosInfo);
      console.log("Order ID:", orderId);
      console.log("Tipo solicitado:", tipo);

      // Verificar se o documento solicitado existe
      if (!documentosInfo[tipo]) {
        return res.status(404).json({
          sucesso: false,
          mensagem: `Documento ${tipo} não encontrado para este pedido`
        });
      }

      // Tentar múltiplos caminhos possíveis para o arquivo
      let documentoPath = null;
      const possiblePaths = [
        // Caminho atual baseado no order_id
        path.join(process.cwd(), "uploads", orderId, documentosInfo[tipo].filename),
        // Caminho direto salvo no banco
        documentosInfo[tipo].path,
        // Caminho absoluto se começar com /
        documentosInfo[tipo].path?.startsWith('/') ? documentosInfo[tipo].path : null,
        // Caminho relativo ao projeto
        path.join(process.cwd(), documentosInfo[tipo].path?.replace(/^\/[^\/]+\/[^\/]+\//, '') || ''),
      ].filter(Boolean);

      console.log("📂 Tentando acessar arquivo nos caminhos:", possiblePaths);
      console.log("📋 Informações do documento:", {
        tipo: tipo,
        filename: documentosInfo[tipo].filename,
        originalPath: documentosInfo[tipo].path,
        orderId: orderId
      });

      // Verificar qual caminho existe
      for (const testPath of possiblePaths) {
        console.log(`🔍 Testando caminho: ${testPath}`);
        if (fs.existsSync(testPath)) {
          documentoPath = testPath;
          console.log("✅ Arquivo encontrado em:", documentoPath);
          break;
        } else {
          console.log("❌ Arquivo não existe em:", testPath);
        }
      }

      if (!documentoPath) {
        console.log("❌ Arquivo não encontrado em nenhum dos caminhos testados");
        
        // Debug adicional: listar arquivos no diretório do pedido
        const orderDir = path.join(process.cwd(), "uploads", orderId);
        console.log("🔍 Verificando diretório:", orderDir);
        
        if (fs.existsSync(orderDir)) {
          const files = fs.readdirSync(orderDir);
          console.log(`📁 Arquivos disponíveis no diretório ${orderDir}:`, files);
        } else {
          console.log(`❌ Diretório ${orderDir} não existe`);
          
          // Verificar se o diretório uploads existe
          const uploadsDir = path.join(process.cwd(), "uploads");
          if (fs.existsSync(uploadsDir)) {
            const uploadsDirs = fs.readdirSync(uploadsDir, { withFileTypes: true })
              .filter(dirent => dirent.isDirectory())
              .map(dirent => dirent.name);
            console.log(`📁 Diretórios disponíveis em uploads:`, uploadsDirs);
          } else {
            console.log(`❌ Diretório uploads não existe em: ${uploadsDir}`);
          }
        }

        return res.status(404).json({
          sucesso: false,
          mensagem: "Arquivo não encontrado no servidor",
          debug: {
            orderId: orderId,
            tipo: tipo,
            filename: documentosInfo[tipo].filename,
            pathsTestados: possiblePaths
          }
        });
      }

      // Definir o Content-Type apropriado
      let contentType = "application/octet-stream";
      if (tipo === "nota_pdf" || tipo === "certificado_pdf") {
        contentType = "application/pdf";
      } else if (tipo === "nota_xml") {
        contentType = "application/xml";
      }

      // Configurar os headers para download
      res.setHeader("Content-Type", contentType);
      res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(documentosInfo[tipo].name)}"`);

      // Enviar o arquivo
      try {
        const fileStream = fs.createReadStream(documentoPath);
        
        fileStream.on('error', (error) => {
          console.error("Erro ao ler arquivo:", error);
          if (!res.headersSent) {
            res.status(500).json({
              sucesso: false,
              mensagem: "Erro ao ler arquivo do servidor"
            });
          }
        });

        fileStream.pipe(res);
      } catch (error) {
        console.error("Erro ao criar stream do arquivo:", error);
        res.status(500).json({
          sucesso: false,
          mensagem: "Erro ao processar arquivo"
        });
      }
    } catch (error) {
      console.error("Erro ao fazer download do documento:", error);
      res.status(500).json({
        sucesso: false,
        mensagem: "Erro interno do servidor ao processar o download",
        erro: error instanceof Error ? error.message : "Erro desconhecido"
      });
    }
  });

  // Rota para obter informações sobre os documentos de um pedido
  app.get("/api/pedidos/:id/documentos", async (req, res) => {
    try {
      const id = parseInt(req.params.id);

      if (isNaN(id)) {
        return res.status(400).json({ 
          sucesso: false, 
          mensagem: "ID de pedido inválido" 
        });
      }

      // Buscar o pedido para verificar se tem documentos
      const order = await storage.getOrder(id);
      if (!order) {
        return res.status(404).json({
          sucesso: false,
          mensagem: "Pedido não encontrado"
        });
      }

      // Verificar se o pedido tem documentos carregados
      if (!order.documentosCarregados) {
        return res.json({
          sucesso: true,
          temDocumentos: false,
          mensagem: "Este pedido não possui documentos carregados"
        });
      }

      // Buscar as informações dos documentos do banco de dados
      const result = await pool.query(
        "SELECT documentosinfo FROM orders WHERE id = $1",
        [id]
      );

      if (result.rowCount === 0 || !result.rows[0].documentosinfo) {
        return res.json({
          sucesso: true,
          temDocumentos: false,
          mensagem: "Informações dos documentos não encontradas"
        });
      }

      const documentosInfo = result.rows[0].documentosinfo;

      return res.json({
        sucesso: true,
        temDocumentos: true,
        documentos: documentosInfo
      });
    } catch (error) {
      console.error("Erro ao buscar informações dos documentos:", error);
      res.status(500).json({
        sucesso: false,
        mensagem: "Erro interno do servidor ao buscar informações dos documentos",
        erro: error instanceof Error ? error.message : "Erro desconhecido"
      });
    }
  });

  // Rota para buscar pontos de rastreamento de um pedido
  app.get("/api/tracking-points/:orderId", async (req, res) => {
    try {
      const orderId = parseInt(req.params.orderId);

      if (isNaN(orderId)) {
        return res.status(400).json({ 
          sucesso: false, 
          mensagem: "ID de pedido inválido" 
        });
      }

      console.log(`🔍 Buscando pontos de rastreamento para pedido ID: ${orderId}`);

      // Verificar se o pedido existe
      const orderCheck = await pool.query(
        "SELECT id, order_id FROM orders WHERE id = $1",
        [orderId]
      );

      if (!orderCheck.rows.length) {
        console.log(`❌ Pedido ${orderId} não encontrado`);
        return res.status(404).json({
          sucesso: false,
          mensagem: "Pedido não encontrado"
        });
      }

      console.log(`📦 Pedido encontrado: ${orderCheck.rows[0].order_id}`);

      // Primeiro buscar o order_id (número do pedido) usando o ID
      const orderResult = await pool.query(
        "SELECT order_id FROM orders WHERE id = $1",
        [orderId]
      );

      if (!orderResult.rows.length) {
        console.log(`❌ Pedido ID ${orderId} não encontrado`);
        return res.status(404).json({
          sucesso: false,
          mensagem: "Pedido não encontrado"
        });
      }

      const orderNumber = orderResult.rows[0].order_id;
      console.log(`🔍 Buscando pontos para número do pedido: ${orderNumber}`);

      // Buscar pontos de rastreamento usando o número do pedido
      const result = await pool.query(
        `SELECT 
          id, 
          order_id as "orderId", 
          CAST(latitude AS DECIMAL(10,6)) as latitude, 
          CAST(longitude AS DECIMAL(11,6)) as longitude, 
          created_at as "createdAt"
         FROM tracking_points 
         WHERE order_id = $1 
         ORDER BY created_at ASC`,
        [orderNumber]
      );

      console.log(`📍 Encontrados ${result.rows.length} pontos de rastreamento`);

      const trackingPoints = result.rows.map((row: any) => {
        const latitude = parseFloat(row.latitude);
        const longitude = parseFloat(row.longitude);
        
        console.log(`🔍 Processando ponto: lat=${latitude}, lng=${longitude}`);
        
        return {
          id: row.id,
          orderId: row.orderId,
          latitude: isNaN(latitude) ? 0 : latitude,
          longitude: isNaN(longitude) ? 0 : longitude,
          createdAt: row.createdAt
        };
      });

      // Log detalhado dos dados brutos do banco
      if (result.rows.length > 0) {
        console.log(`🔍 Dados brutos do banco:`, result.rows[0]);
        console.log(`🔍 Primeiro ponto formatado:`, trackingPoints[0]);
      }

      console.log(`📊 Total de pontos válidos:`, trackingPoints.filter(p => p.latitude !== 0 && p.longitude !== 0).length);

      res.json(trackingPoints);
    } catch (error) {
      console.error("Erro ao buscar pontos de rastreamento:", error);
      res.status(500).json({ 
        sucesso: false, 
        mensagem: "Erro ao buscar pontos de rastreamento" 
      });
    }
  });

  // Rota otimizada para buscar coordenadas de todos os pedidos
  app.get("/api/tracking-points-summary", async (req, res) => {
    try {
      console.log(`🔍 Buscando resumo de coordenadas de todos os pedidos`);

      // Buscar o último ponto de rastreamento de cada pedido
      const result = await pool.query(
        `SELECT DISTINCT ON (order_id)
          order_id as "orderId",
          CAST(latitude AS DECIMAL(10,6)) as latitude, 
          CAST(longitude AS DECIMAL(11,6)) as longitude, 
          created_at as "createdAt",
          (SELECT COUNT(*) FROM tracking_points tp2 WHERE tp2.order_id = tp1.order_id) as "totalPoints"
         FROM tracking_points tp1
         ORDER BY order_id, created_at DESC`
      );

      console.log(`📍 Encontrados pontos para ${result.rows.length} pedidos`);

      const summary = result.rows.reduce((acc: any, row: any) => {
        const latitude = parseFloat(row.latitude);
        const longitude = parseFloat(row.longitude);
        
        acc[row.orderId] = {
          latitude: isNaN(latitude) ? 0 : latitude,
          longitude: isNaN(longitude) ? 0 : longitude,
          lastUpdate: row.createdAt,
          totalPoints: parseInt(row.totalPoints)
        };
        
        return acc;
      }, {});

      console.log(`📊 Resumo criado para ${Object.keys(summary).length} pedidos`);

      res.json(summary);
    } catch (error) {
      console.error("Erro ao buscar resumo de coordenadas:", error);
      res.status(500).json({ 
        sucesso: false, 
        mensagem: "Erro ao buscar resumo de coordenadas" 
      });
    }
  });

  // Funções auxiliares de validação
  function isValidLatitude(lat: number): boolean {
    return !isNaN(lat) && lat >= -90 && lat <= 90;
  }

  function isValidLongitude(lng: number): boolean {
    return !isNaN(lng) && lng >= -180 && lng <= 180;
  }

  // Rota para adicionar ponto de rastreamento (usado pelo app mobile)
  app.post("/api/tracking-points", authenticateUser, async (req, res) => {
    try {
      const { orderId, latitude, longitude, status, comment } = req.body;

      if (!orderId || latitude === undefined || longitude === undefined) {
        return res.status(400).json({
          sucesso: false,
          mensagem: "Dados incompletos: orderId, latitude e longitude são obrigatórios"
        });
      }

      // Validação rigorosa das coordenadas
      if (!isValidLatitude(latitude) || !isValidLongitude(longitude)) {
        return res.status(400).json({
          sucesso: false,
          mensagem: "Coordenadas inválidas. Latitude deve estar entre -90 e 90, e Longitude entre -180 e 180"
        });
      }

      // Verificar se o pedido existe e se o usuário tem permissão
      const orderCheck = await pool.query(
        "SELECT id, order_id, user_id FROM orders WHERE id = $1",
        [orderId]
      );

      if (!orderCheck.rows.length) {
        return res.status(404).json({
          sucesso: false,
          mensagem: "Pedido não encontrado"
        });
      }

      // Verificar permissão do usuário
      const order = orderCheck.rows[0];
      if (req.user.role !== 'admin' && req.user.id !== order.user_id) {
        return res.status(403).json({
          sucesso: false,
          mensagem: "Sem permissão para adicionar pontos a este pedido"
        });
      }

      // Inserir novo ponto de rastreamento com informações adicionais
      const result = await pool.query(
        `INSERT INTO tracking_points (
          order_id, 
          latitude, 
          longitude, 
          status,
          comment,
          user_id,
          created_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, NOW())
        RETURNING 
          id, 
          order_id as "orderId", 
          latitude, 
          longitude, 
          status,
          comment,
          user_id as "userId",
          created_at as "createdAt"`,
        [orderId, latitude, longitude, status || 'Em Rota', comment, req.user.id]
      );

      // Registrar no log do sistema
      await pool.query(
        `INSERT INTO system_logs (
          item_type,
          item_id,
          action,
          details,
          user_id
        ) VALUES ($1, $2, $3, $4, $5)`,
        [
          'order',
          orderId,
          'tracking_update',
          `Novo ponto de rastreamento adicionado: ${status || 'Em Rota'}`,
          req.user.id
        ]
      );

      res.json({
        sucesso: true,
        mensagem: "Ponto de rastreamento adicionado com sucesso",
        dados: result.rows[0]
      });

    } catch (error) {
      console.error("Erro ao adicionar ponto de rastreamento:", error);
      res.status(500).json({ 
        sucesso: false, 
        mensagem: "Erro ao adicionar ponto de rastreamento",
        erro: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  });

  // Rota para aprovar pedido
  app.put("/api/orders/:id/approve", isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ 
          sucesso: false, 
          mensagem: "ID de pedido inválido" 
        });
      }

      // Verificar se o usuário tem permissão para aprovar
      let hasApprovalPermission = false;
      
      if (req.user.id === 1 || req.user.isKeyUser === true) {
        hasApprovalPermission = true;
      } else if (req.user.companyId) {
        const userCompany = await storage.getCompany(req.user.companyId);
        if (userCompany && userCompany.approverId === req.user.id) {
          hasApprovalPermission = true;
        }
      }

      if (!hasApprovalPermission) {
        return res.status(403).json({ 
          sucesso: false, 
          mensagem: "Sem permissão para aprovar pedidos" 
        });
      }

      // Verificar se o pedido existe
      const order = await storage.getOrder(id);
      if (!order) {
        return res.status(404).json({ 
          sucesso: false, 
          mensagem: "Pedido não encontrado" 
        });
      }

      // Atualizar status do pedido para "Aprovado"
      await pool.query(
        "UPDATE orders SET status = $1 WHERE id = $2",
        ["Aprovado", id]
      );

      // Registrar log
      await storage.createLog({
        userId: req.user.id,
        action: "Aprovação de pedido",
        itemType: "order",
        itemId: id.toString(),
        details: `Pedido ${order.orderId} foi aprovado`
      });

      res.json({ 
        sucesso: true, 
        mensagem: "Pedido aprovado com sucesso" 
      });
    } catch (error) {
      console.error("Erro ao aprovar pedido:", error);
      res.status(500).json({ 
        sucesso: false, 
        mensagem: "Erro ao aprovar pedido" 
      });
    }
  });

  // Rota para rejeitar pedido
  app.put("/api/orders/:id/reject", isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ 
          sucesso: false, 
          mensagem: "ID de pedido inválido" 
        });
      }

      // Verificar se o usuário tem permissão para rejeitar
      let hasApprovalPermission = false;
      
      if (req.user.id === 1 || req.user.isKeyUser === true) {
        hasApprovalPermission = true;
      } else if (req.user.companyId) {
        const userCompany = await storage.getCompany(req.user.companyId);
        if (userCompany && userCompany.approverId === req.user.id) {
          hasApprovalPermission = true;
        }
      }

      if (!hasApprovalPermission) {
        return res.status(403).json({ 
          sucesso: false, 
          mensagem: "Sem permissão para rejeitar pedidos" 
        });
      }

      // Verificar se o pedido existe
      const order = await storage.getOrder(id);
      if (!order) {
        return res.status(404).json({ 
          sucesso: false, 
          mensagem: "Pedido não encontrado" 
        });
      }

      // Atualizar status do pedido para "Cancelado"
      await pool.query(
        "UPDATE orders SET status = $1 WHERE id = $2",
        ["Cancelado", id]
      );

      // Registrar log
      await storage.createLog({
        userId: req.user.id,
        action: "Rejeição de pedido",
        itemType: "order",
        itemId: id.toString(),


  // Rota de teste para Google Maps API
  app.get("/api/debug/google-maps-test", isAuthenticated, async (req, res) => {
    try {
      console.log("🔍 [Google Maps Test] Iniciando teste da API Google Maps");
      
      const settings = await storage.getAllSettings();
      const googleMapsKeySetting = settings.find(setting => setting.key === 'google_maps_api_key');
      
      if (!googleMapsKeySetting || !googleMapsKeySetting.value) {
        return res.json({
          success: false,
          message: "Google Maps API Key não configurada",
          hasApiKey: false,
          userType: req.user.id === 1 ? 'KeyUser' : 'Regular',
          userId: req.user.id,
          userName: req.user.name
        });
      }

      const apiKey = googleMapsKeySetting.value.trim();
      
      // Teste básico da API Key (sem fazer requisição real para não gastar quota)
      const testResult = {
        success: true,
        message: "Google Maps API Key encontrada",
        hasApiKey: true,
        apiKeyLength: apiKey.length,
        apiKeyPreview: apiKey.substring(0, 8) + '...',
        userType: req.user.id === 1 ? 'KeyUser' : 'Regular',
        userId: req.user.id,
        userName: req.user.name,
        settingsTotal: settings.length
      };

      console.log("✅ [Google Maps Test] Resultado:", testResult);
      
      res.json(testResult);
    } catch (error) {
      console.error("❌ [Google Maps Test] Erro:", error);
      res.status(500).json({
        success: false,
        message: "Erro ao testar Google Maps API",
        error: error instanceof Error ? error.message : "Erro desconhecido"
      });
    }
  });

        details: `Pedido ${order.orderId} foi rejeitado`
      });

      res.json({ 
        sucesso: true, 
        mensagem: "Pedido rejeitado com sucesso" 
      });
    } catch (error) {
      console.error("Erro ao rejeitar pedido:", error);
      res.status(500).json({ 
        sucesso: false, 
        mensagem: "Erro ao rejeitar pedido" 
      });
    }
  });

  // Configuração do multer para upload de foto de confirmação de entrega
  const confirmDeliveryStorage = multer.diskStorage({
    destination: async function (req, file, cb) {
      try {
        const pedidoId = req.params.id;
        
        // Buscar o order_id do pedido pelo ID
        const result = await pool.query("SELECT order_id FROM orders WHERE id = $1", [pedidoId]);

        if (result.rows.length === 0) {
          return cb(new Error("Pedido não encontrado"), "");
        }

        const orderId = result.rows[0].order_id;
        const orderDir = path.join(process.cwd(), "uploads", orderId);
        
        // Verificar se o diretório existe, caso contrário criar
        if (!fs.existsSync(orderDir)) {
          fs.mkdirSync(orderDir, { recursive: true });
        }

        cb(null, orderDir);
      } catch (error) {
        console.error("Erro ao criar diretório do pedido:", error);
        cb(error as Error, "");
      }
    },
    filename: function (req, file, cb) {
      const fileExt = path.extname(file.originalname);
      const fileName = `nota_assinada-${Date.now()}${fileExt}`;
      cb(null, fileName);
    }
  });

  const confirmDeliveryFileFilter = function(req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) {
    // Aceitar apenas imagens
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("O arquivo deve ser uma imagem (PNG, JPG, JPEG, etc.)"));
    }
  };

  const uploadConfirmDelivery = multer({ 
    storage: confirmDeliveryStorage,
    fileFilter: confirmDeliveryFileFilter,
    limits: {
      fileSize: 10 * 1024 * 1024, // 10MB
    }
  });

  // Rota para solicitar reprogramação de entrega
  app.post("/api/pedidos/:id/reprogramar", isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { novaDataEntrega, justificativa } = req.body;

      if (isNaN(id)) {
        return res.status(400).json({ 
          sucesso: false, 
          mensagem: "ID de pedido inválido" 
        });
      }

      if (!novaDataEntrega || !justificativa) {
        return res.status(400).json({ 
          sucesso: false, 
          mensagem: "Nova data de entrega e justificativa são obrigatórias" 
        });
      }

      if (justificativa.length > 100) {
        return res.status(400).json({ 
          sucesso: false, 
          mensagem: "Justificativa deve ter no máximo 100 caracteres" 
        });
      }

      // Verificar se o pedido existe
      const order = await storage.getOrder(id);
      if (!order) {
        return res.status(404).json({ 
          sucesso: false, 
          mensagem: "Pedido não encontrado" 
        });
      }

      // Verificar se o usuário pertence à empresa de destino
      if (!req.user.companyId) {
        return res.status(403).json({ 
          sucesso: false, 
          mensagem: "Usuário não possui empresa associada" 
        });
      }

      // Buscar a empresa de destino através da ordem de compra
      const ordemCompraResult = await pool.query(
        "SELECT cnpj FROM ordens_compra WHERE id = $1",
        [order.purchaseOrderId]
      );

      if (!ordemCompraResult.rows.length) {
        return res.status(400).json({ 
          sucesso: false, 
          mensagem: "Ordem de compra não encontrada" 
        });
      }

      const cnpjDestino = ordemCompraResult.rows[0].cnpj;
      
      // Verificar se a empresa do usuário é a empresa de destino
      const userCompany = await storage.getCompany(req.user.companyId);
      if (!userCompany || userCompany.cnpj !== cnpjDestino) {
        return res.status(403).json({ 
          sucesso: false, 
          mensagem: "Apenas a empresa de destino pode solicitar reprogramação" 
        });
      }

      // Verificar se a nova data está dentro do limite de 7 dias
      const novaData = new Date(novaDataEntrega);
      const hoje = new Date();
      const limite = new Date(hoje.getTime() + (7 * 24 * 60 * 60 * 1000)); // 7 dias a partir de hoje

      if (novaData > limite) {
        return res.status(400).json({ 
          sucesso: false, 
          mensagem: "A nova data de entrega deve ser no máximo 7 dias a partir de hoje" 
        });
      }

      if (novaData <= hoje) {
        return res.status(400).json({ 
          sucesso: false, 
          mensagem: "A nova data de entrega deve ser futura" 
        });
      }

      // Atualizar o pedido com os dados da reprogramação
      await pool.query(
        `UPDATE orders SET 
          status = $1, 
          nova_data_entrega = $2, 
          justificativa_reprogramacao = $3, 
          data_solicitacao_reprogramacao = $4,
          usuario_reprogramacao = $5
        WHERE id = $6`,
        ["Suspenso", novaData, justificativa, new Date(), req.user.id, id]
      );

      // Registrar no log do sistema
      await storage.createLog({
        userId: req.user.id,
        action: "Solicitação de reprogramação",
        itemType: "order",
        itemId: id.toString(),
        details: `Pedido ${order.orderId} - Reprogramação solicitada para ${novaData.toLocaleDateString('pt-BR')}. Justificativa: ${justificativa}`
      });

      res.json({ 
        sucesso: true, 
        mensagem: "Reprogramação solicitada com sucesso" 
      });
    } catch (error) {
      console.error("Erro ao solicitar reprogramação:", error);
      res.status(500).json({ 
        sucesso: false, 
        mensagem: "Erro ao solicitar reprogramação" 
      });
    }
  });

  // Rota para buscar pedidos com reprogramação pendente
  app.get("/api/orders/reprogramacoes", isAuthenticated, async (req, res) => {
    try {
      // Buscar pedidos com status "Suspenso" que possuem reprogramação
      const result = await pool.query(`
        SELECT 
          o.*,
          p.name as product_name,
          u_nome.name as unit_name,
          u_nome.abbreviation as unit_abbreviation,
          c_fornecedor.name as supplier_name,
          oc.numero_ordem as purchase_order_number,
          c_empresa.name as purchase_order_company_name,
          c_destino.name as destination_company_name,
          u_solicitante.name as requester_name
        FROM orders o
        LEFT JOIN products p ON o.product_id = p.id
        LEFT JOIN units u_nome ON p.unit_id = u_nome.id
        LEFT JOIN companies c_fornecedor ON o.supplier_id = c_fornecedor.id
        LEFT JOIN ordens_compra oc ON o.purchase_order_id = oc.id
        LEFT JOIN companies c_empresa ON oc.empresa_id = c_empresa.id
        LEFT JOIN companies c_destino ON oc.cnpj = c_destino.cnpj
        LEFT JOIN users u_solicitante ON o.usuario_reprogramacao = u_solicitante.id
        WHERE o.status = 'Suspenso' AND o.nova_data_entrega IS NOT NULL
        ORDER BY o.data_solicitacao_reprogramacao DESC
      `);

      // Formatar os dados para o frontend
      const reprogramacoes = result.rows.map((row: any) => ({
        id: row.id,
        orderId: row.order_id,
        productName: row.product_name,
        unit: row.unit_abbreviation || row.unit_name,
        quantity: row.quantity,
        supplierName: row.supplier_name,
        purchaseOrderNumber: row.purchase_order_number,
        purchaseOrderCompanyName: row.purchase_order_company_name,
        destinationCompanyName: row.destination_company_name,
        originalDeliveryDate: row.delivery_date,
        newDeliveryDate: row.nova_data_entrega,
        justification: row.justificativa_reprogramacao,
        requestDate: row.data_solicitacao_reprogramacao,
        requesterName: row.requester_name
      }));

      res.json(reprogramacoes);
    } catch (error) {
      console.error("Erro ao buscar reprogramações:", error);
      res.status(500).json({ message: "Erro ao buscar reprogramações" });
    }
  });

  // Rota para aprovar reprogramação
  app.put("/api/orders/:id/reprogramacao/aprovar", isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ 
          sucesso: false, 
          mensagem: "ID de pedido inválido" 
        });
      }

      // Verificar se o pedido existe e está suspenso
      const order = await storage.getOrder(id);
      if (!order) {
        return res.status(404).json({ 
          sucesso: false, 
          mensagem: "Pedido não encontrado" 
        });
      }

      if (order.status !== "Suspenso") {
        return res.status(400).json({ 
          sucesso: false, 
          mensagem: "Pedido não está suspenso para reprogramação" 
        });
      }

      // Verificar se o usuário é o fornecedor do pedido
      if (req.user.companyId !== order.supplierId && !req.user.isKeyUser) {
        return res.status(403).json({ 
          sucesso: false, 
          mensagem: "Apenas o fornecedor pode aprovar reprogramações" 
        });
      }

      // Buscar a nova data de entrega
      const reprogramacaoResult = await pool.query(
        "SELECT nova_data_entrega FROM orders WHERE id = $1",
        [id]
      );

      if (!reprogramacaoResult.rows.length || !reprogramacaoResult.rows[0].nova_data_entrega) {
        return res.status(400).json({ 
          sucesso: false, 
          mensagem: "Dados de reprogramação não encontrados" 
        });
      }

      const novaDataEntrega = reprogramacaoResult.rows[0].nova_data_entrega;

      // Aprovar a reprogramação: atualizar data de entrega e status
      await pool.query(
        `UPDATE orders SET 
          delivery_date = $1, 
          status = $2,
          nova_data_entrega = NULL,
          justificativa_reprogramacao = NULL,
          data_solicitacao_reprogramacao = NULL,
          usuario_reprogramacao = NULL
        WHERE id = $3`,
        [novaDataEntrega, "Aprovado", id]
      );

      // Registrar no log do sistema
      await storage.createLog({
        userId: req.user.id,
        action: "Aprovação de reprogramação",
        itemType: "order",
        itemId: id.toString(),
        details: `Pedido ${order.orderId} - Reprogramação aprovada para ${new Date(novaDataEntrega).toLocaleDateString('pt-BR')}`
      });

      res.json({ 
        sucesso: true, 
        mensagem: "Reprogramação aprovada com sucesso" 
      });
    } catch (error) {
      console.error("Erro ao aprovar reprogramação:", error);
      res.status(500).json({ 
        sucesso: false, 
        mensagem: "Erro ao aprovar reprogramação" 
      });
    }
  });

  // Rota para rejeitar reprogramação
  app.put("/api/orders/:id/reprogramacao/rejeitar", isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ 
          sucesso: false, 
          mensagem: "ID de pedido inválido" 
        });
      }

      // Verificar se o pedido existe e está suspenso
      const order = await storage.getOrder(id);
      if (!order) {
        return res.status(404).json({ 
          sucesso: false, 
          mensagem: "Pedido não encontrado" 
        });
      }

      if (order.status !== "Suspenso") {
        return res.status(400).json({ 
          sucesso: false, 
          mensagem: "Pedido não está suspenso para reprogramação" 
        });
      }

      // Verificar se o usuário é o fornecedor do pedido
      if (req.user.companyId !== order.supplierId && !req.user.isKeyUser) {
        return res.status(403).json({ 
          sucesso: false, 
          mensagem: "Apenas o fornecedor pode rejeitar reprogramações" 
        });
      }

      // Rejeitar a reprogramação: cancelar o pedido
      await pool.query(
        `UPDATE orders SET 
          status = $1,
          quantity = 0,
          nova_data_entrega = NULL,
          justificativa_reprogramacao = NULL,
          data_solicitacao_reprogramacao = NULL,
          usuario_reprogramacao = NULL
        WHERE id = $2`,
        ["Cancelado", id]
      );

      // Registrar no log do sistema
      await storage.createLog({
        userId: req.user.id,
        action: "Rejeição de reprogramação",
        itemType: "order",
        itemId: id.toString(),
        details: `Pedido ${order.orderId} - Reprogramação rejeitada, pedido cancelado`
      });

      res.json({ 
        sucesso: true, 
        mensagem: "Reprogramação rejeitada, pedido cancelado" 
      });
    } catch (error) {
      console.error("Erro ao rejeitar reprogramação:", error);
      res.status(500).json({ 
        sucesso: false, 
        mensagem: "Erro ao rejeitar reprogramação" 
      });
    }
  });

  // Rota para confirmar entrega de pedido com foto da nota assinada
  app.post("/api/pedidos/:id/confirmar", uploadConfirmDelivery.single("fotoNotaAssinada"), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { quantidadeRecebida } = req.body;

      if (isNaN(id)) {
        return res.status(400).json({ 
          sucesso: false, 
          mensagem: "ID de pedido inválido" 
        });
      }

      if (!quantidadeRecebida) {
        return res.status(400).json({ 
          sucesso: false, 
          mensagem: "Quantidade recebida é obrigatória" 
        });
      }

      if (!req.file) {
        return res.status(400).json({ 
          sucesso: false, 
          mensagem: "Foto da nota fiscal assinada é obrigatória" 
        });
      }

      // Verificar se o pedido existe e se está em rota
      const order = await storage.getOrder(id);
      if (!order) {
        return res.status(404).json({ 
          sucesso: false, 
          mensagem: "Pedido não encontrado" 
        });
      }

      if (order.status !== "Em Rota") {
        return res.status(400).json({ 
          sucesso: false, 
          mensagem: "Pedido não está em rota" 
        });
      }

      // Construir informações da foto para armazenar no banco
      const fotoInfo = {
        name: req.file.originalname,
        filename: req.file.filename,
        size: req.file.size,
        path: req.file.path,
        date: new Date().toISOString()
      };

      // Atualizar o pedido com a foto da confirmação
      await pool.query(
        "UPDATE orders SET status = $1, quantidade_recebida = $2, foto_confirmacao = $3 WHERE id = $4",
        ["Entregue", quantidadeRecebida, JSON.stringify(fotoInfo), id]
      );

      // Registrar no log do sistema
      await storage.createLog({
        userId: req.session.userId || 0,
        action: "Confirmação de entrega",
        itemType: "order",
        itemId: id.toString(),
        details: `Pedido ${order.orderId} foi confirmado como entregue. Quantidade recebida: ${quantidadeRecebida}. Foto da nota assinada enviada.`
      });

      res.json({ 
        sucesso: true, 
        mensagem: "Entrega confirmada com sucesso", 
        fotoInfo: fotoInfo
      });
    } catch (error) {
      console.error("Erro ao confirmar entrega:", error);
      res.status(500).json({ 
        sucesso: false, 
        mensagem: "Erro ao confirmar entrega" 
      });
    }
  });

  // Configurações
  app.get('/api/settings', async (req, res) => {
    try {
      const settings = await storage.getAllSettings();
      res.json(settings);
    } catch (error) {
      console.error("Erro ao buscar configurações:", error);
      res.status(500).json({ message: "Erro ao buscar configurações" });
    }
  });

  app.post('/api/settings', isAuthenticated, async (req, res) => {
    try {
      const { key, value, description } = req.body;

      if (!key || value === undefined) {
        return res.status(400).json({ message: 'Chave e valor são obrigatórios' });
      }

      // Criar ou atualizar a configuração
      await storage.createOrUpdateSetting({
        key: key,
        value: value,
        description: description || ""
      });

      res.json({ success: true, message: 'Configuração salva com sucesso' });
    } catch (error) {
      console.error('Erro ao salvar configuração:', error);
      res.status(500).json({ message: 'Erro interno do servidor' });
    }
  });

  // Rota de debug para verificar configurações do keyuser
  app.get("/api/debug/keyuser-config", async (req, res) => {
    try {
      console.log("🔍 Debug: Verificando configurações do keyuser");

      const allSettings = await storage.getAllSettings();
      console.log("📊 Todas as configurações:", allSettings);

      const keyUserEmailSetting = await storage.getSetting("keyuser_email");
      const keyUserPasswordSetting = await storage.getSetting("keyuser_password");

      res.json({
        success: true,
        allSettings: allSettings,
        keyUserEmail: keyUserEmailSetting,
        keyUserPassword: keyUserPasswordSetting ? { 
          key: keyUserPasswordSetting.key, 
          hasValue: !!keyUserPasswordSetting.value,
          valueLength: keyUserPasswordSetting.value?.length 
        } : null
      });
    } catch (error) {
      console.error("❌ Erro ao verificar configurações:", error);
      res.status(500).json({ 
        success: false, 
        message: "Erro ao verificar configurações",
        error: error instanceof Error ? error.message : "Erro desconhecido"
      });
    }
  });

  // Rota para testar geração de siglas de empresas
  app.get("/api/debug/company-acronyms", async (req, res) => {
    try {
      console.log("🔍 Debug: Testando geração de siglas das empresas");

      const companies = await storage.getAllCompanies();
      
      const acronyms = companies.map(company => {
        // Simular a função de geração de sigla
        const generateCompanyAcronym = (companyName: string): string => {
          const commonWords = ['ltda', 'sa', 'me', 'epp', 'eireli', 'do', 'da', 'de', 'dos', 'das', 'e', 'em', 'com', 'para', 'por', 'sobre'];
          
          const words = companyName
            .toLowerCase()
            .replace(/[^\w\s]/g, '')
            .split(/\s+/)
            .filter(word => word.length > 0 && !commonWords.includes(word));

          let acronym = '';
          
          if (words.length === 1) {
            acronym = words[0].substring(0, 3).toUpperCase();
          } else if (words.length === 2) {
            acronym = words[0].substring(0, 2).toUpperCase() + words[1].substring(0, 1).toUpperCase();
          } else if (words.length >= 3) {
            acronym = words.slice(0, 3).map(word => word.charAt(0).toUpperCase()).join('');
          }

          if (acronym.length < 2) {
            acronym = companyName.substring(0, 3).toUpperCase().replace(/[^\w]/g, '');
          }
          if (acronym.length > 4) {
            acronym = acronym.substring(0, 4);
          }

          return acronym;
        };

        return {
          id: company.id,
          name: company.name,
          acronym: generateCompanyAcronym(company.name),
          contractNumber: company.contractNumber
        };
      });

      res.json({
        success: true,
        message: "Siglas geradas com sucesso",
        companies: acronyms,
        examples: [
          "Concessionária Nova Rota do Oeste → CNRO",
          "Consórcio Nova Imigrantes → CNI", 
          "Consórcio Construtor BR163 → CCB"
        ]
      });
    } catch (error) {
      console.error("❌ Erro ao testar siglas:", error);
      res.status(500).json({ 
        success: false, 
        message: "Erro ao testar siglas",
        error: error instanceof Error ? error.message : "Erro desconhecido"
      });
    }
  });

  // Rota de debug para investigar pedidos urgentes
  app.get("/api/debug/urgent-orders", async (req, res) => {
    try {
      console.log("🔍 Debug: Investigando pedidos urgentes");

      // Buscar todos os pedidos diretamente do banco
      const allOrdersResult = await pool.query(`
        SELECT 
          id, order_id, status, is_urgent, delivery_date, created_at,
          EXTRACT(DAY FROM (delivery_date - CURRENT_DATE)) as days_to_delivery
        FROM orders 
        ORDER BY created_at DESC
      `);

      const allOrders = allOrdersResult.rows;
      console.log(`📊 Total de pedidos na base: ${allOrders.length}`);

      // Analisar urgência
      const urgentOrders = allOrders.filter(order => order.is_urgent);
      const registeredUrgent = urgentOrders.filter(order => order.status === 'Registrado');
      
      console.log(`🔥 Pedidos marcados como urgentes: ${urgentOrders.length}`);
      console.log(`📋 Pedidos urgentes com status Registrado: ${registeredUrgent.length}`);

      // Debug detalhado
      const analysis = allOrders.map(order => {
        const daysToDelivery = order.days_to_delivery;
        const shouldBeUrgent = daysToDelivery !== null && daysToDelivery <= 7;
        
        return {
          id: order.id,
          orderId: order.order_id,
          status: order.status,
          isUrgent: order.is_urgent,
          deliveryDate: order.delivery_date,
          daysToDelivery: daysToDelivery,
          shouldBeUrgent: shouldBeUrgent,
          urgencyMismatch: shouldBeUrgent !== order.is_urgent
        };
      });

      const mismatchedOrders = analysis.filter(order => order.urgencyMismatch);

      res.json({
        success: true,
        totalOrders: allOrders.length,
        urgentOrders: urgentOrders.length,
        registeredUrgentOrders: registeredUrgent.length,
        mismatchedOrders: mismatchedOrders.length,
        analysis: analysis.slice(0, 10), // Primeiros 10 para debug
        urgentOrdersDetails: urgentOrders,
        mismatchedOrdersDetails: mismatchedOrders
      });
    } catch (error) {
      console.error("❌ Erro ao investigar pedidos urgentes:", error);
      res.status(500).json({ 
        success: false, 
        message: "Erro ao investigar pedidos urgentes",
        error: error instanceof Error ? error.message : "Erro desconhecido"
      });
    }
  });

  // Rota para configurar sigla personalizada de uma empresa
  app.post("/api/companies/:id/acronym", isAuthenticated, isKeyUser, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { acronym } = req.body;

      if (isNaN(id)) {
        return res.status(400).json({ message: "ID inválido" });
      }

      if (!acronym || acronym.length < 2 || acronym.length > 4) {
        return res.status(400).json({ 
          message: "Sigla deve ter entre 2 e 4 caracteres" 
        });
      }

      // Verificar se a empresa existe
      const company = await storage.getCompany(id);
      if (!company) {
        return res.status(404).json({ message: "Empresa não encontrada" });
      }

      // Salvar a sigla personalizada nas configurações
      const settingKey = `company_${id}_acronym`;
      await storage.createOrUpdateSetting({
        key: settingKey,
        value: acronym.toUpperCase(),
        description: `Sigla personalizada para a empresa ${company.name}`
      });

      // Registrar log
      if (req.session.userId) {
        await storage.createLog({
          userId: req.session.userId,
          action: "Configurou sigla personalizada",
          itemType: "company",
          itemId: id.toString(),
          details: `Sigla "${acronym.toUpperCase()}" configurada para empresa ${company.name}`
        });
      }

      res.json({
        success: true,
        message: "Sigla personalizada configurada com sucesso",
        company: company.name,
        acronym: acronym.toUpperCase()
      });
    } catch (error) {
      console.error("Erro ao configurar sigla personalizada:", error);
      res.status(500).json({ message: "Erro ao configurar sigla personalizada" });
    }
  });

  // Configuração do multer para upload de APK
  const icapMobStorage = multer.diskStorage({
    destination: function (req, file, cb) {
      const icapMobDir = path.join(process.cwd(), "icapmob");
      
      // Criar diretório se não existir
      if (!fs.existsSync(icapMobDir)) {
        fs.mkdirSync(icapMobDir, { recursive: true });
      }
      
      cb(null, icapMobDir);
    },
    filename: function (req, file, cb) {
      // Sempre salvar como icapmob.apk (sobrescrever)
      cb(null, "icapmob.apk");
    }
  });

  const icapMobFileFilter = function(req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) {
    if (file.mimetype === "application/vnd.android.package-archive" || file.originalname.endsWith('.apk')) {
      cb(null, true);
    } else {
      cb(new Error("O arquivo deve ser um APK"));
    }
  };

  const uploadIcapMobAPK = multer({ 
    storage: icapMobStorage,
    fileFilter: icapMobFileFilter,
    limits: {
      fileSize: 100 * 1024 * 1024, // 100MB
    }
  });

  // Rota para upload do APK do iCapMob
  app.post("/api/icapmob/upload", isAuthenticated, isKeyUser, uploadIcapMobAPK.single("apk"), async (req, res) => {
    try {
      const { version } = req.body;

      if (!version) {
        return res.status(400).json({
          success: false,
          message: "Versão é obrigatória"
        });
      }

      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: "Nenhum arquivo APK foi enviado"
        });
      }

      // Atualizar registro na tabela icapmob
      await pool.query(
        `INSERT INTO icapmob (versao, data, created_at) 
         VALUES ($1, CURRENT_DATE, CURRENT_TIMESTAMP)`,
        [version]
      );

      // Registrar log
      if (req.session.userId) {
        await storage.createLog({
          userId: req.session.userId,
          action: "Upload iCapMob APK",
          itemType: "icapmob",
          itemId: version,
          details: `APK versão ${version} enviado com sucesso`
        });
      }

      res.json({
        success: true,
        message: "APK atualizado com sucesso!",
        version: version,
        filename: req.file.filename,
        size: req.file.size
      });

    } catch (error) {
      console.error("Erro no upload do APK:", error);
      res.status(500).json({
        success: false,
        message: "Erro interno do servidor",
        error: error instanceof Error ? error.message : "Erro desconhecido"
      });
    }
  });

  // Rota para obter informações da versão atual do iCapMob
  app.get("/api/icapmob/version", async (req, res) => {
    try {
      const result = await pool.query(
        `SELECT versao, data, created_at 
         FROM icapmob 
         ORDER BY created_at DESC 
         LIMIT 1`
      );

      if (result.rows.length === 0) {
        return res.json({
          success: true,
          version: "1.0.0",
          date: new Date().toISOString(),
          hasAPK: false
        });
      }

      const currentVersion = result.rows[0];
      
      // Verificar se o arquivo APK existe
      const apkPath = path.join(process.cwd(), "icapmob", "icapmob.apk");
      const hasAPK = fs.existsSync(apkPath);

      res.json({
        success: true,
        version: currentVersion.versao,
        date: currentVersion.data,
        createdAt: currentVersion.created_at,
        hasAPK: hasAPK
      });

    } catch (error) {
      console.error("Erro ao buscar versão do iCapMob:", error);
      res.status(500).json({
        success: false,
        message: "Erro ao buscar informações da versão"
      });
    }
  });

  // Rota para listar histórico de versões do iCapMob
  app.get("/api/icapmob/history", isAuthenticated, isKeyUser, async (req, res) => {
    try {
      const result = await pool.query(
        `SELECT id, versao, data, created_at 
         FROM icapmob 
         ORDER BY created_at DESC`
      );

      res.json({
        success: true,
        history: result.rows
      });

    } catch (error) {
      console.error("Erro ao buscar histórico do iCapMob:", error);
      res.status(500).json({
        success: false,
        message: "Erro ao buscar histórico de versões"
      });
    }
  });

  // System menus route - para configuração de permissões
  app.get("/api/system-menus", async (req, res) => {
    try {
      const systemMenus = [
        { id: "dashboard", name: "Dashboard", description: "Página inicial com visão geral" },
        { id: "orders", name: "Pedidos", description: "Gerenciar pedidos de compra" },
        { id: "approvals", name: "Aprovações", description: "Aprovar pedidos pendentes" },
        { id: "purchase_orders", name: "Ordens de Compra", description: "Gerenciar ordens de compra" },
        { id: "companies", name: "Empresas", description: "Cadastro e gestão de empresas" },
        { id: "users", name: "Usuários", description: "Gerenciar usuários do sistema" },
        { id: "products", name: "Produtos", description: "Cadastro e gestão de produtos" },
        { id: "logs", name: "Logs do Sistema", description: "Visualizar logs de atividades" },
      ];

      res.json(systemMenus);
    } catch (error) {
      console.error("Erro ao buscar menus do sistema:", error);
      res.status(500).json({ message: "Erro ao buscar menus do sistema" });
    }
  });

  // Configurar servidor HTTP com o app Express
  const server = createServer(app);
  return server;
}