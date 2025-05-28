import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { db, pool } from "./db";
import { isAuthenticated, hasPermission, isKeyUser } from "./middleware/auth";
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

// Configuração avançada do multer para upload de arquivos
const storage_upload = multer.diskStorage({
  destination: async function (req, file, cb) {
    try {
      // Buscar o order_id do pedido pelo ID
      const pedidoId = req.params.id;
      const uploadDir = path.join(process.cwd(), "uploads");

      console.log("Diretório de upload:", uploadDir);

      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
        console.log("Diretório de upload criado:", uploadDir);
      }

      // Buscar o order_id do pedido
      const result = await pool.query("SELECT order_id FROM orders WHERE id = $1", [pedidoId]);

      if (result.rows.length === 0) {
        return cb(new Error("Pedido não encontrado"), "");
      }

      const orderId = result.rows[0].order_id;
      console.log("Order ID encontrado:", orderId);

      const orderDir = path.join(uploadDir, orderId);
      if (!fs.existsSync(orderDir)) {
        fs.mkdirSync(orderDir, { recursive: true });
        console.log("Diretório do pedido criado:", orderDir);
      }

      cb(null, orderDir);
    } catch (error) {
      console.error("Erro ao criar diretório do pedido:", error);
      cb(error as Error, "");
    }
  },
  filename: function (req, file, cb) {
    const fileExt = path.extname(file.originalname);
    const fileName = file.fieldname + "-" + Date.now() + fileExt;
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
        // Verificar a senha fornecida com a senha armazenada
        senhaCorreta = password === user.password;
      }

      if (!senhaCorreta) {
        console.log("❌ Senha incorreta para usuário:", email);
        return res.status(401).json({ 
          success: false, 
          message: "Senha incorreta" 
        });
      }

      console.log("✅ Senha correta para usuário:", email);

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
    if (req.session.userId) {
      req.session.destroy((err) => {
        if (err) {
          console.error("Erro ao fazer logout:", err);
          return res.status(500).json({ 
            success: false, 
            message: "Erro ao fazer logout" 
          });
        }

        res.json({ 
          success: true, 
          message: "Logout realizado com sucesso" 
        });
      });
    } else {
      res.status(401).json({ 
        success: false, 
        message: "Não autenticado" 
      });
    }
  });

  // Users routes
  app.get("/api/users", isAuthenticated, hasPermission("view_users"), async (req, res) => {
    try {
      const users = await storage.getAllUsers();
      res.json(users);
    } catch (error) {
      console.error("Erro ao buscar usuários:", error);
      res.status(500).json({ message: "Erro ao buscar usuários" });
    }
  });

  app.post("/api/users", isAuthenticated, hasPermission("create_users"), async (req, res) => {
    try {
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

  app.put("/api/users/:id", async (req, res) => {
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

  app.delete("/api/users/:id", async (req, res) => {
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

  app.post("/api/companies", async (req, res) => {
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

  app.put("/api/companies/:id", async (req, res) => {
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

  app.delete("/api/companies/:id", async (req, res) => {
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
  app.get("/api/orders", async (req, res) => {
    try {
      const orders = await storage.getAllOrders();
      res.json(orders);
    } catch (error) {
      console.error("Erro ao buscar pedidos:", error);
      res.status(500).json({ message: "Erro ao buscar pedidos" });
    }
  });

  app.get("/api/orders/urgent", async (req, res) => {
    try {
      const urgentOrders = await storage.getUrgentOrders();
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

        // Buscar quantidade já usada em pedidos
        const usadoResult = await pool.query(
          `SELECT COALESCE(SUM(CAST(quantity AS DECIMAL)), 0) as total_usado
           FROM orders 
           WHERE purchase_order_id = $1 AND product_id = $2`,
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

      // Criar o pedido usando o storage
      const newOrder = await storage.createOrder({
        purchaseOrderId: orderData.purchaseOrderId,
        productId: orderData.productId,
        quantity: orderData.quantity,
        supplierId: orderData.supplierId,
        deliveryDate: new Date(orderData.deliveryDate),
        userId: orderData.userId || req.session.userId || 1,
        status: "Registrado",
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
  app.get("/api/ordens-compra", async (req, res) => {
    try {
      // Usar query SQL direta na tabela ordens_compra em vez do storage obsoleto
      if (!pool) {
        // Se não há banco de dados, retornar array vazio para desenvolvimento local
        return res.json([]);
      }

      const result = await pool.query(`
        SELECT 
          oc.id,
          oc.numero_ordem,
          oc.empresa_id,
          c.name as empresa_nome,
          oc.valido_ate,
          oc.status,
          oc.data_criacao
        FROM ordens_compra oc
        LEFT JOIN companies c ON oc.empresa_id = c.id
        ORDER BY oc.data_criacao DESC
      `);

      // Formatar os dados para o frontend
      const formattedOrders = result.rows.map((row: any) => ({
        id: row.id,
        numero_ordem: row.numero_ordem,
        empresa_id: row.empresa_id,
        empresa_nome: row.empresa_nome || "Empresa não encontrada",
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
  app.get("/api/purchase-orders", async (req, res) => {
    try {
      // Usar query SQL direta na tabela ordens_compra em vez do storage obsoleto
      if (!pool) {
        // Se não há banco de dados, retornar array vazio para desenvolvimento local
        return res.json([]);
      }

      const result = await pool.query(`
        SELECT 
          oc.id,
          oc.numero_ordem as order_number,
          oc.empresa_id as company_id,
          c.name as empresa_nome,
          oc.valido_ate as valid_until,
          oc.status,
          oc.data_criacao as created_at
        FROM ordens_compra oc
        LEFT JOIN companies c ON oc.empresa_id = c.id
        ORDER BY oc.data_criacao DESC
      `);

      // Formatar os dados para o frontend no formato esperado
      const formattedOrders = result.rows.map((row: any) => ({
        id: row.id,
        order_number: row.order_number,
        company_id: row.company_id,
        empresa_nome: row.empresa_nome || "Empresa não encontrada",
        valid_until: row.valid_until ? new Date(row.valid_until).toISOString() : new Date().toISOString(),
        status: row.status || "Ativo",
        created_at: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
        // Campos adicionais para compatibilidade
        numero_ordem: row.order_number,
        empresa_id: row.company_id,
        valido_ate: row.valid_until ? new Date(row.valid_until).toISOString() : new Date().toISOString(),
        data_criacao: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString()
      }));

      res.json(formattedOrders);
    } catch (error) {
      console.error("Erro ao buscar ordens de compra:", error);
      res.status(500).json({ message: "Erro ao buscar ordens de compra" });
    }
  });

  // Criar nova ordem de compra
  app.post("/api/ordem-compra-nova", async (req, res) => {
    try {
      const { numeroOrdem, empresaId, obraId, validoAte, produtos } = req.body;

      if (!numeroOrdem || !empresaId || !validoAte || !produtos || !produtos.length) {
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
         (numero_ordem, empresa_id, obra_id, usuario_id, valido_ate, status, data_criacao) 
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
        [numeroOrdem, empresaId, obraId, userId, validoAte, "Ativo", new Date()]
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

      // Buscar informações da ordem de compra
      const ordemResult = await pool.query(
        "SELECT numero_ordem, pdf_url FROM ordens_compra WHERE id = $1",
        [id]
      );

      if (!ordemResult.rows.length) {
        return res.status(404).json({
          sucesso: false,
          mensagem: "Ordem de compra não encontrada"
        });
      }

      const ordem = ordemResult.rows[0];
      
      // Verificar se existe PDF_URL na base de dados
      if (ordem.pdf_url) {
        const pdfPath = path.join(process.cwd(), "public", ordem.pdf_url);
        if (fs.existsSync(pdfPath)) {
          res.setHeader("Content-Type", "application/pdf");
          res.setHeader("Content-Disposition", `attachment; filename="ordem_compra_${ordem.numero_ordem}.pdf"`);
          return res.sendFile(pdfPath);
        }
      }

      // Tentar buscar o arquivo na pasta uploads usando o número da ordem
      const uploadsPath = path.join(process.cwd(), "uploads", `${ordem.numero_ordem}.pdf`);
      if (fs.existsSync(uploadsPath)) {
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", `attachment; filename="ordem_compra_${ordem.numero_ordem}.pdf"`);
        return res.sendFile(uploadsPath);
      }

      // Se não encontrar o arquivo
      return res.status(404).json({
        sucesso: false,
        mensagem: "PDF da ordem de compra não encontrado"
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

      const { numeroOrdem, empresaId, obraId, validoAte, items } = req.body;

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
         SET numero_ordem = $1, empresa_id = $2, obra_id = $3, valido_ate = $4
         WHERE id = $5`,
        [numeroOrdem, empresaId, obraId, validoAte, id]
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

      // Buscar os itens da ordem com informações do produto
      const result = await pool.query(`
        SELECT i.*, p.name as produto_nome, u.abbreviation as unidade
        FROM itens_ordem_compra i
        LEFT JOIN products p ON i.produto_id = p.id
        LEFT JOIN units u ON p.unit_id = u.id
        WHERE i.ordem_compra_id = $1
      `, [id]);

      // Formatar os dados para o frontend
      const itens = result.rows.map((item: any) => ({
        id: item.id,
        ordem_compra_id: item.ordem_compra_id,
        produto_id: item.produto_id,
        produto_nome: item.produto_nome || "Produto não encontrado",
        unidade: item.unidade || "un",
        quantidade: item.quantidade
      }));

      res.json(itens);

    } catch (error) {
      console.error("Erro ao buscar itens da ordem de compra:", error);
      res.status(500).json({
        sucesso: false,
        mensagem: "Erro ao buscar itens da ordem de compra"
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
         WHERE purchase_order_id = $1 AND product_id = $2`,
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
  app.get("/api/user-roles", isAuthenticated, hasPermission("view_user_roles"), async (req, res) => {
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
  app.get("/api/settings", async (req, res) => {
    try {
      const settings = await storage.getAllSettings();
      res.json(settings);
    } catch (error) {
      console.error("Erro ao buscar configurações:", error);
      res.status(500).json({ message: "Erro ao buscar configurações" });
    }
  });

  app.put("/api/settings", async (req, res) => {
    try {
      const settingsArray = req.body;

      if (!Array.isArray(settingsArray)) {
        return res.status(400).json({ message: "Dados inválidos. Esperado um array de configurações." });
      }

      // Atualizar cada configuração
      for (const setting of settingsArray) {
        if (!setting.key || setting.value === undefined) {
          continue; // Pular configurações inválidas
        }

        await storage.createOrUpdateSetting({
          key: setting.key,
          value: setting.value,
          description: setting.description || ""
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

  // Configuração do upload com multer
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
      console.log("Iniciando upload de documentos para o pedido:", req.params.id);
      console.log("Arquivos recebidos:", req.files);
      console.log("Sessão do usuário:", req.session.userId);

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
            date: new Date().toISOString()
          },
          certificado_pdf: {
            name: files.certificado_pdf[0].originalname,
            filename: files.certificado_pdf[0].filename,
            size: files.certificado_pdf[0].size,
            path: files.certificado_pdf[0].path,
            date: new Date().toISOString()
          }
        };

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
          details: `Documentos carregados para o pedido ${order.orderId}`
        });

        // Responder com sucesso
        return res.status(200).json({
          sucesso: true,
          mensagem: "Documentos enviados com sucesso",
          documentos: documentosInfo
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

      // Construir o caminho do arquivo usando o order_id
      const uploadDir = path.join(process.cwd(), "uploads");
      const orderDir = path.join(uploadDir, orderId);
      const documentoPath = path.join(orderDir, documentosInfo[tipo].filename);

      console.log("Tentando acessar arquivo:", documentoPath);

      // Verificar se o arquivo existe no sistema de arquivos
      if (!fs.existsSync(documentoPath)) {
        // Tentar o caminho antigo como fallback (para arquivos já existentes)
        const oldPath = documentosInfo[tipo].path;
        if (fs.existsSync(oldPath)) {
          console.log("Usando caminho antigo:", oldPath);
          const fileStream = fs.createReadStream(oldPath);
          fileStream.pipe(res);
          return;
        }

        return res.status(404).json({
          sucesso: false,
          mensagem: "Arquivo não encontrado no servidor"
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
      res.setHeader("Content-Disposition", `attachment; filename=${documentosInfo[tipo].name}`);

      // Enviar o arquivo
      const fileStream = fs.createReadStream(documentoPath);
      fileStream.pipe(res);
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

  // Rota para confirmar entrega de pedido
  app.post("/api/pedidos/:id/confirmar", async (req, res) => {
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

      // Atualizar o pedido
      const updatedOrder = await storage.updateOrder(id, {
        status: "Entregue",
        quantidadeRecebida
      });

      // Registrar no log do sistema
      await storage.createLog({
        userId: req.session.userId || 0,
        action: "Confirmação de entrega",
        itemType: "order",
        itemId: id.toString(),
        details: `Pedido ${order.orderId} foi confirmado como entregue. Quantidade recebida: ${quantidadeRecebida}`
      });

      res.json({ 
        sucesso: true, 
        mensagem: "Entrega confirmada com sucesso", 
        pedido: updatedOrder 
      });
    } catch (error) {
      console.error("Erro ao confirmar entrega:", error);
      res.status(500).json({ 
        sucesso: false, 
        mensagem: "Erro ao confirmar entrega" 
      });
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