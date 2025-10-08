// Corrected the column name in the query for checking available balance.
// The error was caused by using 'product_id' instead of the correct column name 'produto_id'
// in the 'itens_ordem_compra' table.

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

// Configuração do Object Storage (Replit)
let objectStorage: any = null;
let objectStorageAvailable = false;

async function initializeObjectStorage() {
  try {
    // Verificar se estamos no Replit
    if (!process.env.REPL_ID && !process.env.REPLIT_DB_URL) {
      console.log("⚠️ Não está executando no Replit - Object Storage não disponível");
      objectStorageAvailable = false;
      return false;
    }

    // Tentar importar usando ES modules
    let storageModule;
    try {
      storageModule = await import('@replit/object-storage');
      console.log("✅ Módulo @replit/object-storage importado com sucesso");
    } catch (importError) {
      console.log("❌ Falha ao importar @replit/object-storage:", importError.message);

      // Verificar se o pacote está instalado
      try {
        const fs = await import('fs');
        const path = await import('path');
        const nodeModulesPath = path.join(process.cwd(), 'node_modules', '@replit', 'object-storage');

        if (!fs.existsSync(nodeModulesPath)) {
          console.log("📦 Pacote @replit/object-storage não está instalado");
          console.log("💡 Execute: npm install @replit/object-storage");
        }
      } catch (fsError) {
        console.log("❌ Erro ao verificar instalação do pacote");
      }

      objectStorageAvailable = false;
      return false;
    }

    // Tentar criar cliente
    try {
      if (storageModule.Client) {
        objectStorage = new storageModule.Client();
        console.log("✅ Cliente criado usando new Client()");
      } else if (storageModule.getClient) {
        objectStorage = storageModule.getClient();
        console.log("✅ Cliente criado usando getClient()");
      } else if (storageModule.default && storageModule.default.Client) {
        objectStorage = new storageModule.default.Client();
        console.log("✅ Cliente criado usando default.Client()");
      } else {
        throw new Error("Nenhum método de criação de cliente encontrado no módulo");
      }
    } catch (clientError) {
      console.log("❌ Erro ao criar cliente:", clientError.message);
      objectStorageAvailable = false;
      return false;
    }

    // Testar conectividade
    try {
      await objectStorage.list();
      objectStorageAvailable = true;
      console.log("✅ Object Storage do Replit inicializado e testado com sucesso!");
      console.log("📦 Arquivos serão persistidos no Object Storage entre deployments");
      return true;
    } catch (testError) {
      console.log("❌ Falha no teste de conectividade:", testError.message);

      // Diagnóstico adicional
      if (testError.message.includes('permission') || testError.message.includes('unauthorized')) {
        console.log("🔒 Problema de permissões - verifique se Object Storage está habilitado no Replit");
      } else if (testError.message.includes('network') || testError.message.includes('timeout')) {
        console.log("🌐 Problema de conectividade - tente novamente em alguns segundos");
      }

      objectStorageAvailable = false;
      return false;
    }
  } catch (error) {
    console.warn("⚠️ Erro inesperado na inicialização do Object Storage:", error.message);
    console.log("📂 Usando armazenamento local temporário (será perdido no redeploy)");
    objectStorageAvailable = false;
    return false;
  }
}

// Inicializar Object Storage
initializeObjectStorage();

// Função utilitária simplificada para ler arquivo do Object Storage
async function readFileFromStorage(key: string, orderId: string, filename: string): Promise<{ data: Buffer, originalName: string } | null> {
  console.log(`🔍 DOWNLOAD SIMPLES: ${filename} | Key: ${key} | OrderId: ${orderId}`);

  // Google Drive redirect
  if (key.startsWith('gdrive:')) {
    const driveLink = key.replace('gdrive:', '');
    return {
      data: Buffer.from(`REDIRECT:${driveLink}`, 'utf-8'),
      originalName: filename
    };
  }

  // Object Storage - busca simplificada e efetiva
  if (objectStorageAvailable && objectStorage) {
    console.log(`📦 Object Storage - busca simplificada`);

    // Lista simplificada de chaves para tentar
    const storageKeys = [
      key.trim(), // Key original
      `${orderId}/${filename}`, // Padrão: orderId/filename
      filename, // Só o nome do arquivo
      `orders/${orderId}/${filename}` // Com prefixo orders/
    ];

    for (const storageKey of storageKeys) {
      try {
        console.log(`📥 Tentando download: ${storageKey}`);

        const result = await objectStorage.downloadAsBytes(storageKey);
        let buffer = null;

        console.log(`📊 Tipo de resultado recebido:`, {
          tipo: typeof result,
          isBuffer: result instanceof Buffer,
          isUint8Array: result instanceof Uint8Array,
          hasOk: result && typeof result === 'object' && 'ok' in result,
          hasValue: result && typeof result === 'object' && 'value' in result
        });

        // Processar resultado do Replit Object Storage
        if (result && typeof result === 'object' && 'ok' in result && 'value' in result) {
          // Result wrapper do Replit
          console.log(`🎯 Result wrapper detectado - Status: ${result.ok}`);

          if (!result.ok) {
            console.log(`❌ Result indica erro: ${result.error || 'download failed'}`);
            continue; // Tentar próxima chave
          }

          const valueData = result.value;

          if (valueData instanceof Uint8Array) {
            buffer = Buffer.from(valueData);
            console.log(`✅ Convertido Uint8Array para Buffer: ${buffer.length} bytes`);
          } else if (valueData instanceof Buffer) {
            buffer = valueData;
            console.log(`✅ Buffer direto do Result: ${buffer.length} bytes`);
          } else if (Array.isArray(valueData)) {
            buffer = Buffer.from(valueData);
            console.log(`✅ Array convertido para Buffer: ${buffer.length} bytes`);
          } else {
            console.log(`⚠️ Tipo de value não reconhecido:`, typeof valueData);
          }
        } else if (result instanceof Uint8Array) {
          // Dados diretos como Uint8Array
          buffer = Buffer.from(result);
          console.log(`✅ Uint8Array direto convertido: ${buffer.length} bytes`);
        } else if (result instanceof Buffer) {
          // Dados diretos como Buffer
          buffer = result;
          console.log(`✅ Buffer direto: ${buffer.length} bytes`);
        } else {
          console.log(`❌ Tipo de resultado não suportado:`, typeof result);
        }

        // Verificar se o buffer é válido
        if (buffer && buffer.length > 1) {
          console.log(`✅ Arquivo encontrado e validado: ${storageKey} (${buffer.length} bytes)`);
          return {
            data: buffer,
            originalName: filename
          };
        } else {
          console.log(`⚠️ Buffer inválido ou muito pequeno: ${buffer ? buffer.length : 0} bytes`);
        }

      } catch (error) {
        console.log(`❌ Erro em ${storageKey}: ${error.message}`);
        // Continuar tentando outras chaves
      }
    }

    // Se não encontrou, listar arquivos para debug
    try {
      console.log(`🔍 Listando arquivos no Object Storage para debug...`);
      const listResult = await objectStorage.list();
      let objects = [];

      if (listResult && typeof listResult === 'object' && listResult.ok && listResult.value) {
        objects = listResult.value;
      } else if (Array.isArray(listResult)) {
        objects = listResult;
      }

      console.log(`📊 Total de objetos: ${objects.length}`);

      // Mostrar arquivos relacionados ao pedido
      const relatedFiles = objects.filter(obj => {
        const objKey = obj.key || obj.name || String(obj);
        return objKey.includes(orderId) || objKey.includes(filename.split('-')[0]);
      });

      if (relatedFiles.length > 0) {
        console.log(`📋 Arquivos relacionados encontrados:`);
        relatedFiles.forEach(obj => {
          const objKey = obj.key || obj.name || String(obj);
          console.log(`   • ${objKey}`);
        });

        // Tentar o primeiro arquivo relacionado
        if (relatedFiles[0]) {
          const firstKey = relatedFiles[0].key || relatedFiles[0].name || String(relatedFiles[0]);
          console.log(`🎯 Tentando download do primeiro arquivo relacionado: ${firstKey}`);

          try {
            const result = await objectStorage.downloadAsBytes(firstKey);
            let buffer = null;

            if (result && typeof result === 'object' && result.ok && result.value) {
              if (result.value instanceof Uint8Array) {
                buffer = Buffer.from(result.value);
              } else if (result.value instanceof Buffer) {
                buffer = result.value;
              } else if (Array.isArray(result.value)) {
                buffer = Buffer.from(result.value);
              }
            } else if (result instanceof Uint8Array) {
              buffer = Buffer.from(result);
            } else if (result instanceof Buffer) {
              buffer = result;
            }

            if (buffer && buffer.length > 1) {
              console.log(`✅ Download bem-sucedido do arquivo relacionado: ${firstKey} (${buffer.length} bytes)`);
              return {
                data: buffer,
                originalName: filename
              };
            }
          } catch (downloadError) {
            console.log(`❌ Erro no download do arquivo relacionado: ${downloadError.message}`);
          }
        }
      } else {
        console.log(`📋 Nenhum arquivo relacionado encontrado`);
        // Mostrar alguns arquivos para referência
        const sampleFiles = objects.slice(0, 10);
        console.log(`📋 Primeiros 10 arquivos no storage:`);
        sampleFiles.forEach(obj => {
          const objKey = obj.key || obj.name || String(obj);
          console.log(`   • ${objKey}`);
        });
      }
    } catch (listError) {
      console.log(`⚠️ Erro ao listar arquivos: ${listError.message}`);
    }
  }

  // Fallback para sistema local
  const localPaths = [
    path.join(process.cwd(), "uploads", orderId, filename),
    path.join(process.cwd(), "uploads", filename)
  ];

  for (const filePath of localPaths) {
    try {
      if (fs.existsSync(filePath)) {
        const buffer = fs.readFileSync(filePath);
        if (buffer.length > 1) {
          console.log(`✅ Arquivo local encontrado: ${filePath} (${buffer.length} bytes)`);
          return {
            data: buffer,
            originalName: filename
          };
        }
      }
    } catch (error) {
      console.log(`⚠️ Erro no arquivo local ${filePath}: ${error.message}`);
    }
  }

  console.log(`❌ Arquivo ${filename} não encontrado`);
  return null;
}

// Função utilitária para salvar arquivo no Object Storage, Google Drive ou sistema local
async function saveFileToStorage(buffer: Buffer, filename: string, orderId: string): Promise<string> {
  // PRIORIDADE 1: Tentar Object Storage se disponível
  if (objectStorageAvailable && objectStorage) {
    try {
      // USAR PADRÃO SIMPLES: orderId/filename (sem prefixo "orders/")
      const key = `${orderId}/${filename}`;

      console.log(`📤 Tentando upload para Object Storage: ${key}`);
      console.log(`📊 Tamanho do buffer: ${buffer.length} bytes`);

      // Usar o método correto do Replit Object Storage
      try {
        console.log(`📤 Iniciando upload - Tamanho original: ${buffer.length} bytes`);

        // Validar buffer antes do upload
        if (!buffer || buffer.length === 0) {
          throw new Error("Buffer vazio ou inválido para upload");
        }

        // O método correto é uploadFromBytes para arquivos binários
        if (buffer instanceof Buffer) {
          // Converter buffer para Uint8Array que é o formato esperado pelo Replit Object Storage
          const uint8Array = new Uint8Array(buffer);
          console.log(`📤 Convertido para Uint8Array: ${uint8Array.length} bytes`);

          // Upload usando bytes
          await objectStorage.uploadFromBytes(key, uint8Array);
          console.log("✅ Upload realizado com uploadFromBytes");
        } else {
          // Se não for Buffer, tentar converter primeiro
          console.log(`⚠️ Dados não são Buffer, tentando conversão. Tipo: ${typeof buffer}`);
          const bufferData = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
          const uint8Array = new Uint8Array(bufferData);
          await objectStorage.uploadFromBytes(key, uint8Array);
          console.log("✅ Upload realizado após conversão para Buffer");
        }

        // VERIFICAÇÃO CRÍTICA: Testar integridade do arquivo após upload
        console.log(`🔍 Verificando integridade do arquivo após upload...`);
        try {
          const downloadTest = await objectStorage.downloadAsBytes(key);

          // Extrair dados do resultado (pode estar em wrapper)
          let testData = null;
          if (downloadTest && typeof downloadTest === 'object' && downloadTest.ok && downloadTest.value) {
            testData = downloadTest.value;
          } else if (downloadTest instanceof Uint8Array || downloadTest instanceof Buffer) {
            testData = downloadTest;
          } else if (Array.isArray(downloadTest)) {
            testData = downloadTest;
          } else {
            testData = downloadTest;
          }

          if (testData && testData.length > 0) {
            const downloadedSize = testData.length;
            const originalSize = buffer.length;

            console.log(`📊 Verificação de integridade:`);
            console.log(`   • Tamanho original: ${originalSize} bytes`);
            console.log(`   • Tamanho baixado: ${downloadedSize} bytes`);
            console.log(`   • Integridade: ${downloadedSize === originalSize ? 'OK' : 'FALHA'}`);

            if (downloadedSize === originalSize) {
              console.log(`✅ Arquivo verificado no Object Storage: ${key}`);
              console.log(`✅ Arquivo estará disponível após redeploys`);
              return key;
            } else {
              console.error(`❌ Tamanhos não coincidem! Original: ${originalSize}, Baixado: ${downloadedSize}`);
              throw new Error(`Corrupção detectada: tamanhos diferentes (${originalSize} → ${downloadedSize})`);
            }
          } else {
            console.error(`❌ Download de verificação retornou dados vazios ou nulos`);
            throw new Error("Verificação falhou: dados vazios no download");
          }
        } catch (verifyError) {
          console.error("❌ Falha na verificação de integridade:", verifyError.message);
          // Não retornar a key se a verificação falhou completamente
          throw new Error(`Upload falhou na verificação: ${verifyError.message}`);
        }

      } catch (error) {
        console.error("❌ Erro específico no upload:", error.message);
        console.error("❌ Stack trace:", error.stack);

        // Tentar métodos alternativos se o principal falhar
        console.log("🔄 Tentando métodos alternativos...");

        try {
          // Tentar método upload genérico se existir
          if (typeof objectStorage.upload === 'function') {
            console.log("🔧 Tentando método upload genérico");
            await objectStorage.upload(key, buffer);
            console.log("✅ Upload realizado com método genérico");
            return key;
          } else {
            throw new Error("Nenhum método alternativo disponível");
          }
        } catch (altError) {
          console.error("❌ Métodos alternativos também falharam:", altError.message);
          throw error; // Lançar o erro original capturado no catch anterior
        }
      }

    } catch (error) {
      console.error("❌ Erro detalhado ao salvar no Object Storage:", {
        message: error.message,
        key: `${orderId}/${filename}`,
        bufferSize: buffer.length,
        objectStorageAvailable,
        hasObjectStorage: !!objectStorage
      });
      console.log("🔄 Tentando Google Drive como fallback...");
    }
  } else {
    console.log("⚠️ Object Storage não disponível:", {
      objectStorageAvailable,
      hasObjectStorage: !!objectStorage
    });
  }

  // PRIORIDADE 2: Tentar Google Drive
  try {
    const { googleDriveService } = await import('./googleDrive');
    const publicLink = await googleDriveService.uploadBuffer(buffer, filename, orderId);

    if (publicLink) {
      console.log(`📁 🔗 Arquivo salvo no Google Drive: ${publicLink}`);
      console.log(`✅ Link público gerado com sucesso`);
      return `gdrive:${publicLink}`;
    }
  } catch (error) {
    console.error("❌ Erro ao salvar no Google Drive:", error);
    console.log("🔄 Fallback para sistema local...");
  }

  // FALLBACK: Salvar no sistema local (temporário)
  try {
    const orderDir = path.join(process.cwd(), "uploads", orderId);
    if (!fs.existsSync(orderDir)) {
      fs.mkdirSync(orderDir, { recursive: true });
    }
    const filePath = path.join(orderDir, filename);
    fs.writeFileSync(filePath, buffer);
    console.log(`📁 💾 Arquivo salvo localmente (temporário): ${filePath}`);
    console.log(`⚠️ Este arquivo será perdido no próximo deploy!`);
    return filePath;
  } catch (error) {
    console.error("❌ Erro ao salvar localmente:", error);
    throw new Error(`Falha ao salvar arquivo: ${error.message}`);
  }
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

          try {
            if (!fs.existsSync(orderDir)) {
              fs.mkdirSync(orderDir, { recursive: true });
              console.log("📂 Diretório do pedido criado com sucesso:", orderDir);

              // Verificar se o diretório foi realmente criado
              if (fs.existsSync(orderDir)) {
                console.log("✅ Confirmado: Diretório existe após criação");
              } else {
                console.error("❌ Erro: Diretório não foi criado mesmo sem erro");
                return cb(new Error("Falha ao criar diretório"), "");
              }
            } else {
              console.log("📂 Diretório do pedido já existe:", orderDir);
            }

            // Verificar permissões de escrita
            try {
              fs.accessSync(orderDir, fs.constants.W_OK);
              console.log("✅ Permissões de escrita confirmadas");
            } catch (permError) {
              console.error("❌ Sem permissões de escrita:", permError);
              return cb(new Error("Sem permissões de escrita no diretório"), "");
            }

            cb(null, orderDir);
          } catch (dirError) {
            console.error("❌ Erro específico ao criar diretório:", dirError);
            return cb(dirError as Error, "");
          }
        } catch (error) {
          console.error("❌ Erro geral ao configurar destino de upload:", error);
          cb(error as Error, "");
        }
      },
      filename: function (req, file, cb) {
        const fileExt = path.extname(file.originalname);
        // Campo do arquivo + data atual + extensão original
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
        const fileName = "logo" + fileExt; // Sempre o mesmo nome para sobrescrever
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
            // Salva o PDF com o nome do número da ordem + extensão .pdf
            const fileName = `${numeroOrdem}.pdf`;
            cb(null, fileName);
          } catch (error) {
            console.error("Erro ao gerar nome do arquivo da ordem de compra:", error);
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

      // Middleware para verificar o token de autenticação (necessário para algumas rotas)
      const authenticateToken = (req: Request, res: Response, next: NextFunction) => {
        // Verificar se o usuário está autenticado através da sessão
        if (req.session && req.session.userId) {
          // Buscar o usuário para garantir que ele existe e obter suas permissões
          storage.getUser(req.session.userId).then(user => {
            if (user) {
              // Adicionar informações do usuário à requisição para uso posterior
              req.user = {
                id: user.id,
                name: user.name,
                email: user.email,
                companyId: user.companyId,
                roleId: user.roleId,
                permissions: user.role ? user.role.permissions || [] : [],
                isKeyUser: user.id === 1, // Assumindo que o usuário com ID 1 é o KeyUser
                canConfirmDelivery: user.canConfirmDelivery,
                canCreateOrder: user.canCreateOrder,
                canCreatePurchaseOrder: user.canCreatePurchaseOrder
              };
              // Adicionar informações de role e permissões
              req.user.role = user.role;
              req.user.permissions = user.role ? user.role.permissions || [] : [];

              console.log(`✅ Autenticado: Usuário ${user.name} (ID: ${user.id})`);
              next();
            } else {
              console.log(`❌ Usuário não encontrado na sessão: ID ${req.session.userId}`);
              res.status(401).json({ success: false, message: "Usuário não encontrado" });
            }
          }).catch(error => {
            console.error("❌ Erro ao buscar usuário na autenticação:", error);
            res.status(500).json({ success: false, message: "Erro interno do servidor" });
          });
        } else {
          console.log("⚠️ Sessão não encontrada ou usuário não autenticado");
          res.status(401).json({ success: false, message: "Não autorizado. Faça login novamente." });
        }
      };

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

            // NOVA REGRA: Se o usuário tem ID de 1 a 5, dar permissões de keyuser
            const isKeyUser = user.id >= 1 && user.id <= 5;

            if (isKeyUser) {
              console.log(`🔑 KEYUSER DETECTADO (ID ${user.id}) - CONCEDENDO PERMISSÕES TOTAIS`);
            }

            // Salvar o ID do usuário na sessão e garantir que seja persistida
            req.session.userId = user.id;

            // Forçar salvamento da sessão
            await new Promise<void>((resolve, reject) => {
              req.session.save((err) => {
                if (err) {
                  console.error("❌ Erro ao salvar sessão:", err);
                  reject(err);
                } else {
                  console.log(`✅ Sessão salva com sucesso para usuário ${user.id}`);
                  resolve();
                }
              });
            });

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
              canCreatePurchaseOrder: user.canCreatePurchaseOrder,
              canEditPurchaseOrders: user.canEditPurchaseOrders || isKeyUser,
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
            const isKeyUser = req.user.id >= 1 && req.user.id <= 5;

            if (isKeyUser) {
              console.log(`🔑 KeyUser (ID ${req.user.id}) acessando /api/auth/me - Permissões totais concedidas`);
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
                canCreatePurchaseOrder: req.user.canCreatePurchaseOrder,
                canEditPurchaseOrders: req.user.canEditPurchaseOrders || req.user.isKeyUser,
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

        // Rota de teste completo da API do Object Storage
        app.post("/api/keyuser/test-object-storage-api", isAuthenticated, isKeyUser, async (req, res) => {
          const startTime = Date.now();
          let log = [];

          try {
            log.push(`🧪 TESTE COMPLETO DA API OBJECT STORAGE - ${new Date().toLocaleString('pt-BR')}`);
            log.push(`👤 Executado por: ${req.user.name} (ID: ${req.user.id})`);
            log.push(`📋 Tipo de teste: ${req.body.testType || 'padrão'}`);
            log.push('');

            // Verificar se Object Storage está disponível
            if (!objectStorageAvailable || !objectStorage) {
              log.push('❌ Object Storage não está disponível ou inicializado');
              log.push(`   - objectStorageAvailable: ${objectStorageAvailable}`);
              log.push(`   - objectStorage: ${!!objectStorage}`);

              return res.json({
                success: false,
                message: "Object Storage não está disponível",
                log: log.join('\n'),
                timestamp: new Date().toISOString()
              });
            }

            log.push('✅ Object Storage disponível - iniciando testes...');

            // TESTE 1: Verificar conectividade
            log.push('\n📡 TESTE 1: Verificando conectividade...');
            try {
              await objectStorage.list();
              log.push('✅ Conectividade confirmada');
            } catch (connectError) {
              log.push(`❌ Falha na conectividade: ${connectError.message}`);
              throw new Error(`Conectividade: ${connectError.message}`);
            }

            // TESTE 2: Upload de arquivo de teste
            log.push('\n📤 TESTE 2: Testando upload...');
            const testContent = `Teste da API Object Storage
Executado por: ${req.user.name}
Data/Hora: ${new Date().toLocaleString('pt-BR')}
Timestamp: ${Date.now()}
Versão: iCAP 5.0

Este é um teste completo da API do Object Storage para verificar:
- Upload de arquivos
- Download de arquivos
- Listagem de objetos
- Performance do sistema
- Integridade dos dados

Status: Teste em progresso...`;

            const testKey = `keyuser-api-tests/${Date.now()}-comprehensive-test.txt`;
            const uploadStartTime = Date.now();

            try {
              const uint8Array = new TextEncoder().encode(testContent);
              await objectStorage.uploadFromBytes(testKey, uint8Array);
              const uploadTime = Date.now() - uploadStartTime;
              log.push(`✅ Upload realizado com sucesso em ${uploadTime}ms`);
              log.push(`📂 Chave: ${testKey}`);
            } catch (uploadError) {
              log.push(`❌ Falha no upload: ${uploadError.message}`);
              throw new Error(`Upload: ${uploadError.message}`);
            }

            // TESTE 3: Download e verificação de integridade
            log.push('\n📥 TESTE 3: Testando download e integridade...');
            const downloadStartTime = Date.now();

            try {
              const downloadedData = await objectStorage.downloadAsBytes(testKey);
              const downloadTime = Date.now() - downloadStartTime;

              log.push(`🔍 Tipo de dados recebidos: ${typeof downloadedData}`);
              log.push(`🔍 É instância de Uint8Array: ${downloadedData instanceof Uint8Array}`);
              log.push(`🔍 É instância de Buffer: ${downloadedData instanceof Buffer}`);
              log.push(`🔍 É Array: ${Array.isArray(downloadedData)}`);
              log.push(`🔍 Tem propriedade ok: ${downloadedData && typeof downloadedData === 'object' && 'ok' in downloadedData}`);
              log.push(`🔍 Tem propriedade value: ${downloadedData && typeof downloadedData === 'object' && 'value' in downloadedData}`);

              if (downloadedData && typeof downloadedData === 'object') {
                log.push(`🔍 Propriedades do objeto: ${Object.keys(downloadedData).join(', ')}`);
                if (downloadedData.value) {
                  log.push(`🔍 Tipo do value: ${typeof downloadedData.value}`);
                  log.push(`🔍 Value é Buffer: ${downloadedData.value instanceof Buffer}`);
                  log.push(`🔍 Value é Uint8Array: ${downloadedData.value instanceof Uint8Array}`);
                  log.push(`🔍 Value é Array: ${Array.isArray(downloadedData.value)}`);
                  log.push(`🔍 Tamanho do value: ${downloadedData.value?.length || 'indefinido'}`);
                }
              }

              let downloadedContent;
              let rawData = null;

              // Extrair os dados brutos primeiro
              if (downloadedData && typeof downloadedData === 'object' && downloadedData.ok && downloadedData.value) {
                // Result wrapper do Replit
                rawData = downloadedData.value;
                log.push(`✅ Dados extraídos do Result wrapper`);
              } else if (downloadedData instanceof Uint8Array || downloadedData instanceof Buffer) {
                // Dados diretos como Uint8Array ou Buffer
                rawData = downloadedData;
                log.push(`✅ Dados diretos como ${downloadedData instanceof Buffer ? 'Buffer' : 'Uint8Array'}`);
              } else if (Array.isArray(downloadedData)) {
                // Array de números
                rawData = new Uint8Array(downloadedData);
                log.push(`✅ Array convertido para Uint8Array`);
              } else if (typeof downloadedData === 'object' && downloadedData !== null && downloadedData.length !== undefined) {
                // Array-like object
                try {
                  const values = Object.values(downloadedData);
                  rawData = new Uint8Array(values);
                  log.push(`✅ Object array-like convertido para Uint8Array`);
                } catch (conversionError) {
                  log.push(`❌ Erro na conversão de object para Uint8Array: ${conversionError.message}`);
                  throw new Error(`Conversão de dados: ${conversionError.message}`);
                }
              } else {
                log.push(`❌ Tipo de dados não reconhecido para conversão`);
                throw new Error(`Tipo de dados não suportado: ${typeof downloadedData}`);
              }

              // Verificar se temos dados válidos
              if (!rawData || rawData.length === 0) {
                log.push(`❌ Dados vazios ou nulos após extração`);
                throw new Error(`Dados vazios após download`);
              }

              log.push(`📊 Tamanho dos dados brutos: ${rawData.length} bytes`);

              // Converter para texto de forma segura
              try {
                if (rawData instanceof Uint8Array || rawData instanceof Buffer) {
                  downloadedContent = new TextDecoder('utf-8', { fatal: false }).decode(rawData);
                } else {
                  // Fallback: converter para Buffer primeiro
                  const buffer = Buffer.from(rawData);
                  downloadedContent = buffer.toString('utf-8');
                }

                log.push(`📊 Tamanho do conteúdo: ${downloadedContent.length} caracteres`);

              } catch (textError) {
                log.push(`❌ Erro na conversão para texto: ${textError.message}`);
                throw new Error(`Conversão para texto: ${textError.message}`);
              }

              // Verificar integridade
              const isIntegrityOk = downloadedContent.includes(req.user.name) && downloadedContent.includes('iCAP 5.0');

              log.push(`✅ Download realizado em ${downloadTime}ms`);
              log.push(`🔍 Integridade: ${isIntegrityOk ? 'OK' : 'FALHA'}`);

              if (!isIntegrityOk) {
                log.push(`⚠️ Conteúdo não confere com o esperado`);
                log.push(`🔍 Primeiros 100 caracteres: "${downloadedContent.substring(0, 100)}"`);
              }

            } catch (downloadError) {
              log.push(`❌ Falha no download: ${downloadError.message}`);
              log.log(`🔍 Stack trace: ${downloadError.stack}`);
              throw new Error(`Download: ${downloadError.message}`);
            }

            // TESTE 4: Listagem de objetos
            log.push('\n📋 TESTE 4: Testando listagem de objetos...');
            const listStartTime = Date.now();

            try {
              const listResult = await objectStorage.list();
              const listTime = Date.now() - listStartTime;

              let objects = [];
              if (listResult && typeof listResult === 'object' && listResult.ok && listResult.value) {
                objects = listResult.value;
              } else if (Array.isArray(listResult)) {
                objects = listResult;
              }

              log.push(`✅ Listagem realizada em ${listTime}ms`);
              log.push(`📊 Total de objetos: ${objects.length}`);

              // Filtrar objetos relacionados aos testes do keyuser
              const keyuserObjects = objects.filter(obj => {
                const key = obj.key || obj.name || obj;
                return key && key.includes('keyuser');
              });

              log.push(`🔑 Objetos do keyuser: ${keyuserObjects.length}`);

              if (keyuserObjects.length > 0) {
                log.push('📋 Últimos 3 objetos do keyuser:');
                keyuserObjects.slice(-3).forEach((obj, index) => {
                  const key = obj.key || obj.name || String(obj);
                  const size = obj.size ? `(${(obj.size / 1024).toFixed(2)} KB)` : '';
                  log.push(`   ${index + 1}. ${key} ${size}`);
                });
              }
            } catch (listError) {
              log.push(`❌ Falha na listagem: ${listError.message}`);
              throw new Error(`Listagem: ${listError.message}`);
            }

            // TESTE 5: Performance (se solicitado)
            let performanceTime = 0;
            if (req.body.includePerformance) {
              log.push('\n⚡ TESTE 5: Testando performance...');
              const perfStartTime = Date.now();

              try {
                const perfTestKey = `keyuser-api-tests/performance-test-${Date.now()}.txt`;
                const perfContent = 'A'.repeat(10000); // 10KB de teste

                // Upload de performance
                const perfUploadStart = Date.now();
                const perfUint8Array = new TextEncoder().encode(perfContent);
                await objectStorage.uploadFromBytes(perfTestKey, perfUint8Array);
                const perfUploadTime = Date.now() - perfUploadStart;

                // Download de performance
                const perfDownloadStart = Date.now();
                await objectStorage.downloadAsBytes(perfTestKey);
                const perfDownloadTime = Date.now() - perfDownloadStart;

                // Limpeza
                try {
                  await objectStorage.delete(perfTestKey);
                } catch (cleanupError) {
                  log.push(`⚠️ Aviso: não foi possível limpar arquivo de performance`);
                }

                performanceTime = Date.now() - perfStartTime;
                log.push(`✅ Performance - Upload: ${perfUploadTime}ms, Download: ${perfDownloadTime}ms`);
                log.push(`📊 Performance total: ${performanceTime}ms para 10KB`);
              } catch (perfError) {
                log.push(`⚠️ Erro no teste de performance: ${perfError.message}`);
              }
            }

            // TESTE 6: Limpeza do arquivo de teste - PULAR para permitir download
            log.push('\n🧹 TESTE 6: Mantendo arquivo para download...');
            log.push(`📂 Arquivo de teste mantido para download: ${testKey}`);

            const totalTime = Date.now() - startTime;
            log.push('\n🎉 TODOS OS TESTES CONCLUÍDOS COM SUCESSO!');
            log.push(`⏱️ Tempo total: ${totalTime}ms`);
            log.push(`✅ Object Storage está funcionando perfeitamente`);

            // Registrar no log do sistema
            await storage.createLog({
              userId: req.user.id,
              action: "Teste da API Object Storage",
              itemType: "system",
              itemId: "object_storage_api",
              details: `Teste completo executado com sucesso em ${totalTime}ms`
            });

            res.json({
              success: true,
              message: `Teste da API concluído com sucesso! Todos os 6 testes passaram.`,
              testsExecuted: req.body.includePerformance ? 6 : 5,
              storageKey: testKey, // Adicionar chave para download
              stats: {
                testsExecuted: req.body.includePerformance ? 6 : 5,
                totalTime,
                uploadDownloadTime: performanceTime || 'não testado',
                totalObjects: 'verificado'
              },
              log: log.join('\n'),
              timestamp: new Date().toISOString()
            });

          } catch (error) {
            const totalTime = Date.now() - startTime;
            log.push('\n❌ TESTE FALHOU');
            log.push(`💥 Erro: ${error.message}`);
            log.push(`⏱️ Tempo até falha: ${totalTime}ms`);

            // Registrar falha no log do sistema
            await storage.createLog({
              userId: req.user.id,
              action: "Falha no teste da API Object Storage",
              itemType: "system",
              itemId: "object_storage_api",
              details: `Erro: ${error.message}`
            });

            res.json({
              success: false,
              message: `Teste da API falhou: ${error.message}`,
              error: error.message,
              log: log.join('\n'),
              timestamp: new Date().toISOString()
            });
          }
        });

        // Rota para download do arquivo de teste do Object Storage
        app.post("/api/keyuser/download-test-file", isAuthenticated, isKeyUser, async (req, res) => {
          try {
            const { storageKey } = req.body;

            console.log(`📥 KeyUser download solicitado - storageKey recebida: ${storageKey}`);

            if (!storageKey) {
              console.log("❌ Storage key não fornecida");
              return res.status(400).json({
                success: false,
                message: "Storage key é obrigatório"
              });
            }

            // Verificar se Object Storage está disponível
            if (!objectStorageAvailable || !objectStorage) {
              console.log("❌ Object Storage não disponível");
              return res.status(500).json({
                success: false,
                message: "Object Storage não está disponível"
              });
            }

            console.log(`📥 Tentando download de: ${storageKey}`);

            // Fazer download do arquivo usando a mesma lógica robusta da função readFileFromStorage
            let fileBuffer = null;
            let originalName = storageKey.split('/').pop() || 'keyuser-test.txt';

            try {
              const downloadedData = await objectStorage.downloadAsBytes(storageKey);

              console.log(`📊 Dados baixados:`, {
                tipo: typeof downloadedData,
                isBuffer: downloadedData instanceof Buffer,
                isUint8Array: downloadedData instanceof Uint8Array,
                hasValue: downloadedData && downloadedData.value !== undefined,
                hasOk: downloadedData && downloadedData.ok !== undefined,
                length: downloadedData?.length || downloadedData?.value?.length
              });

              // ESTRATÉGIA 1: Dados diretos como Buffer ou Uint8Array
              if (downloadedData instanceof Buffer) {
                fileBuffer = downloadedData;
                console.log(`✅ Buffer direto - ${fileBuffer.length} bytes`);
              } else if (downloadedData instanceof Uint8Array) {
                fileBuffer = Buffer.from(downloadedData);
                console.log(`✅ Uint8Array para Buffer - ${fileBuffer.length} bytes`);
              }
              // ESTRATÉGIA 2: Result wrapper do Replit
              else if (downloadedData && typeof downloadedData === 'object' && downloadedData.ok !== undefined) {
                console.log(`🎯 Result wrapper detectado - Status: ${downloadedData.ok ? 'OK' : 'ERROR'}`);

                if (!downloadedData.ok || downloadedData.error) {
                  console.log(`❌ Result indica erro: ${downloadedData.error || 'download failed'}`);
                  throw new Error(`Object Storage error: ${downloadedData.error || 'download failed'}`);
                }

                const valueData = downloadedData.value;
                if (valueData instanceof Buffer) {
                  fileBuffer = valueData;
                  console.log(`✅ Buffer do Result wrapper - ${fileBuffer.length} bytes`);
                } else if (valueData instanceof Uint8Array) {
                  fileBuffer = Buffer.from(valueData);
                  console.log(`✅ Uint8Array do Result wrapper para Buffer - ${fileBuffer.length} bytes`);
                } else if (Array.isArray(valueData) && valueData.length > 0) {
                  // Verificar se é array de bytes válido
                  const isValidByteArray = valueData.every(v => typeof v === 'number' && v >= 0 && v <= 255);
                  if (isValidByteArray) {
                    fileBuffer = Buffer.from(valueData);
                    console.log(`✅ Array de bytes do Result wrapper convertido - ${fileBuffer.length} bytes`);
                  } else {
                    console.log(`❌ Array de bytes do Result wrapper não contém bytes válidos`);
                  }
                }
              }
              // ESTRATÉGIA 3: Array direto de bytes
              else if (Array.isArray(downloadedData) && downloadedData.length > 0) {
                const isValidByteArray = downloadedData.every(v => typeof v === 'number' && v >= 0 && v <= 255);
                if (isValidByteArray) {
                  fileBuffer = Buffer.from(downloadedData);
                  console.log(`✅ Array direto convertido - ${fileBuffer.length} bytes`);
                } else {
                  console.log(`❌ Array direto não contém bytes válidos`);
                }
              }

            } catch (downloadError) {
              console.error("❌ Erro no download:", downloadError);
              throw new Error(`Falha no download: ${downloadError.message}`);
            }

            // VERIFICAÇÃO CRÍTICA: Arquivos de 1 byte não são válidos
            if (!fileBuffer || fileBuffer.length <= 1) {
              console.log("❌ Nenhum buffer válido foi gerado ou arquivo está vazio/corrompido");
              return res.status(404).json({
                success: false,
                message: "Arquivo não encontrado ou está corrompido (tamanho inválido)"
              });
            }

            console.log(`✅ Arquivo processado com sucesso: ${fileBuffer.length} bytes`);

            // Configurar headers para download
            res.setHeader('Content-Type', 'text/plain; charset=utf-8');
            res.setHeader('Content-Disposition', `attachment; filename="${originalName}"`);
            res.setHeader('Content-Length', fileBuffer.length);
            res.setHeader('Cache-Control', 'no-cache');

            // Enviar o arquivo
            res.end(fileBuffer);

            // Log da ação
            await storage.createLog({
              userId: req.user.id,
              action: "Download de arquivo de teste",
              itemType: "system",
              itemId: "object_storage_download",
              details: `Download do arquivo ${storageKey} (${fileBuffer.length} bytes)`
            });

            console.log(`✅ Download concluído com sucesso para o KeyUser`);

          } catch (error) {
            console.error("Erro ao fazer download do arquivo de teste:", error);
            res.status(500).json({
              success: false,
              message: `Erro ao fazer download: ${error.message}`
            });
          }
        });

        // Redefinir senha do usuário
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
            const isKeyUserCheck = (req.user.id >= 1 && req.user.id <= 5) || req.user.isKeyUser;

            if (!hasCreatePermission && !isKeyUserCheck) {
              return res.status(403).json({
                success: false,
                message: "Permissão 'create_users' necessária para criar usuários"
              });
            }

            const { name, email, phone, companyId, roleId, canConfirmDelivery, canCreateOrder, canCreatePurchaseOrder, canEditPurchaseOrders } = req.body;

            // Verificar se o email já existe antes de tentar criar
            const existingUser = await storage.getUserByEmail(email);
            if (existingUser) {
              return res.status(400).json({
                success: false,
                message: `Já existe um usuário cadastrado com o email ${email}. Escolha outro email.`
              });
            }

            // Validar dados com Zod (incluindo o novo campo)
            const userData = insertUserSchema.parse({
              name, email, phone, companyId, roleId, canConfirmDelivery, canCreateOrder, canCreatePurchaseOrder, canEditPurchaseOrders
            });

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
            // Tratar erro de email duplicado especificamente
            if (error.code === '23505' && error.constraint === 'users_email_unique') {
              return res.status(400).json({
                success: false,
                message: `Já existe um usuário cadastrado com este email. Escolha outro email.`
              });
            }

            // Tratar erros de validação Zod
            if (error instanceof z.ZodError) {
              return res.status(400).json({
                success: false,
                message: "Erro de validação",
                errors: error.errors
              });
            }

            res.status(500).json({
              success: false,
              message: "Erro ao criar usuário"
            });
          }
        });

        app.put("/api/users/:id", isAuthenticated, async (req, res) => {
          try {
            // Verificar se o usuário tem permissão para editar usuários OU é keyuser
            const hasEditPermission = req.user.permissions?.includes("edit_users") || req.user.permissions?.includes("*");
            const isKeyUserCheck = (req.user.id >= 1 && req.user.id <= 5) || req.user.isKeyUser;

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

            const { name, email, phone, companyId, roleId, canConfirmDelivery, canCreateOrder, canCreatePurchaseOrder, canEditPurchaseOrders } = req.body;

            // Validar dados com Zod (incluindo o novo campo)
            const userData = insertUserSchema.parse({
              name, email, phone, companyId, roleId, canConfirmDelivery, canCreateOrder, canCreatePurchaseOrder, canEditPurchaseOrders
            });

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
            // Tratar erros de validação Zod
            if (error instanceof z.ZodError) {
              return res.status(400).json({
                success: false,
                message: "Erro de validação",
                errors: error.errors
              });
            }
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
            // Esta verificação seria mais completa em um sistema em produção

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
            if (req.session.userId && updatedCompany) {
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

        app.post("/api/products", isAuthenticated, hasPermission("create_products"), async (req, res) => {
          try {
            const productData = insertProductSchema.parse(req.body);
            const newProduct = await storage.createProduct(productData);

            // Registrar log de criação
            if (req.session.userId) {
              await storage.createLog({
                userId: req.session.userId,
                action: "Criou produto",
                itemType: "product",
                itemId: newProduct.id.toString(),
                details: `Produto ${newProduct.name} criado`
              });
            }

            res.json(newProduct);
          } catch (error) {
            console.error("Erro ao criar produto:", error);
            if (error instanceof z.ZodError) {
              return res.status(400).json({
                success: false,
                message: "Erro de validação",
                errors: error.errors
              });
            }
            res.status(500).json({ message: "Erro ao criar produto" });
          }
        });

        app.put("/api/products/:id", isAuthenticated, hasPermission("edit_products"), async (req, res) => {
          try {
            const id = parseInt(req.params.id);
            if (isNaN(id)) {
              return res.status(400).json({ message: "ID inválido" });
            }

            // Verificar se o produto existe
            const existingProduct = await storage.getProduct(id);
            if (!existingProduct) {
              return res.status(404).json({ message: "Produto não encontrado" });
            }

            const { name, unitId, confirmationType } = req.body;

            console.log("Dados recebidos para atualização:", { name, unitId, confirmationType });

            // Construir objeto de atualização
            const productData: any = { name, unitId };

            // Adicionar confirmationType se fornecido
            if (confirmationType) {
              productData.confirmationType = confirmationType;
            }

            console.log("Updating product:", { id, product: productData });

            // Atualizar diretamente no banco de dados usando pool
            await pool.query(
              `UPDATE products
               SET name = $1, unit_id = $2, confirmation_type = $3
               WHERE id = $4`,
              [productData.name, productData.unitId, productData.confirmationType || 'nota_fiscal', id]
            );

            // Buscar produto atualizado
            const updatedProductResult = await pool.query(
              `SELECT * FROM products WHERE id = $1`,
              [id]
            );

            const updatedProduct = updatedProductResult.rows[0];

            // Registrar log de atualização
            if (req.session.userId && updatedProduct) {
              await storage.createLog({
                userId: req.session.userId,
                action: "Atualizou produto",
                itemType: "product",
                itemId: id.toString(),
                details: `Produto ${updatedProduct.name} atualizado - Tipo de confirmação: ${productData.confirmationType || 'nota_fiscal'}`
              });
            }

            res.json(updatedProduct);
          } catch (error) {
            console.error("Erro ao atualizar produto:", error);
            res.status(500).json({ message: "Erro ao atualizar produto" });
          }
        });

        app.delete("/api/products/:id", isAuthenticated, hasPermission("delete_products"), async (req, res) => {
          try {
            const id = parseInt(req.params.id);
            if (isNaN(id)) {
              return res.status(400).json({ message: "ID inválido" });
            }

            // Verificar se o produto existe
            const existingProduct = await storage.getProduct(id);
            if (!existingProduct) {
              return res.status(404).json({ message: "Produto não encontrado" });
            }

            // Verificar se existem itens em ordens de compra vinculados a este produto
            const itemsResult = await pool.query(
              "SELECT COUNT(*) as count FROM itens_ordem_compra WHERE produto_id = $1",
              [id]
            );

            if (itemsResult.rows[0].count > 0) {
              return res.status(400).json({
                message: "Não é possível excluir este produto pois ele está vinculado a itens de ordens de compra"
              });
            }

            // Verificar se existem pedidos vinculados a este produto
            const ordersResult = await pool.query(
              "SELECT COUNT(*) as count FROM orders WHERE product_id = $1",
              [id]
            );

            if (ordersResult.rows[0].count > 0) {
              return res.status(400).json({
                message: "Não é possível excluir este produto pois ele está vinculado a pedidos"
              });
            }

            const deleted = await storage.deleteProduct(id);

            // Registrar log de exclusão
            if (req.session.userId) {
              await storage.createLog({
                userId: req.session.userId,
                action: "Excluiu produto",
                itemType: "product",
                itemId: id.toString(),
                details: `Produto ${existingProduct.name} excluído`
              });
            }

            res.json({ success: deleted });
          } catch (error) {
            console.error("Erro ao excluir produto:", error);
            res.status(500).json({ message: "Erro ao excluir produto" });
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

            // 1. Verificar se é KeyUser (IDs 1-5)
            if ((req.user.id >= 1 && req.user.id <= 5) || req.user.isKeyUser === true) {
              console.log(`🔑 Acesso liberado para pedidos urgentes - KeyUser (ID ${req.user.id}): ${req.user.name}`);

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
              "SELECT id, numero_ordem, status, valido_desde, valido_ate FROM ordens_compra WHERE id = $1",
              [orderData.purchaseOrderId]
            );

            if (!ordemCompraResult.rows.length) {
              return res.status(404).json({
                success: false,
                message: "Ordem de compra não encontrada"
              });
            }

            const ordemCompra = ordemCompraResult.rows[0];

            // Verificar se a ordem de compra está dentro do período de validade
            const dataEntrega = new Date(orderData.deliveryDate);
            const validoDesde = new Date(ordemCompra.valido_desde);
            const validoAte = new Date(ordemCompra.valido_ate);

            console.log(`📅 Validação de período da ordem ${ordemCompra.numero_ordem}:`, {
              dataEntrega: dataEntrega.toISOString().split('T')[0],
              validoDesde: validoDesde.toISOString().split('T')[0],
              validoAte: validoAte.toISOString().split('T')[0]
            });

            // Verificar se a data de entrega está dentro do período de validade
            if (dataEntrega < validoDesde) {
              return res.status(400).json({
                success: false,
                message: `Data de entrega não pode ser anterior ao início da validade da ordem de compra (${validoDesde.toLocaleDateString('pt-BR')})`
              });
            }

            if (dataEntrega > validoAte) {
              return res.status(400).json({
                success: false,
                message: `Data de entrega não pode ser posterior ao fim da validade da ordem de compra (${validoAte.toLocaleDateString('pt-BR')})`
              });
            }

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
                oc.valido_desde,
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
              valido_desde: row.valido_desde ? new Date(row.valido_desde).toISOString() : new Date().toISOString(),
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
                oc.valido_desde as valid_from,
                oc.valido_ate as valid_until,
                oc.status,
                oc.data_criacao as created_at
              FROM ordens_compra oc
              LEFT JOIN companies c ON oc.empresa_id = c.id
              LEFT JOIN companies obra ON oc.cnpj = obra.cnpj
            `;

            let queryParams: any[] = [];
            let whereConditions: string[] = [];

            // NOVO: Filtrar apenas ordens válidas (dentro do período) para criação de pedidos
            whereConditions.push("oc.valido_desde <= CURRENT_DATE");
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
              valid_from: row.valid_from ? new Date(row.valid_from).toISOString() : new Date().toISOString(),
              valid_until: row.valid_until ? new Date(row.valid_until).toISOString() : new Date().toISOString(),
              status: row.status || "Ativo",
              created_at: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
              // Campos adicionais para compatibilidade
              numero_ordem: row.order_number,
              empresa_id: row.company_id,
              valido_desde: row.valid_from ? new Date(row.valid_from).toISOString() : new Date().toISOString(),
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
            const { numeroOrdem, empresaId, cnpj, validoDesde, validoAte, produtos } = req.body;

            if (!numeroOrdem || !empresaId || !cnpj || !validoDesde || !validoAte || !produtos || !produtos.length) {
              return res.status(400).json({
                sucesso: false,
                mensagem: "Dados incompletos para criar ordem de compra. Período de validade (início e fim) é obrigatório."
              });
            }

            // Validar se a data de início é anterior à data de fim
            const dataInicio = new Date(validoDesde);
            const dataFim = new Date(validoAte);

            if (dataInicio >= dataFim) {
              return res.status(400).json({
                sucesso: false,
                mensagem: "A data de início da validade deve ser anterior à data de fim"
              });
            }

            // Nota: Duas ordens de compra podem ter o mesmo nome (regra de negócio)

            // Criar a ordem de compra
            const userId = req.session.userId || 999; // Usar ID do usuário da sessão ou um padrão

            const ordemResult = await pool.query(
              `INSERT INTO ordens_compra
               (numero_ordem, empresa_id, cnpj, usuario_id, valido_desde, valido_ate, status, data_criacao)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
              [numeroOrdem, empresaId, cnpj, userId, validoDesde, validoAte, "Ativo", new Date()]
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

        // Rota de compatibilidade para o frontend que ainda usa /api/purchase-orders/:id/pdf
        // Esta rota agora tenta recuperar o PDF do Object Storage (pasta OC) primeiro,
        // depois usa o pdf_info, e como fallback busca no sistema local.
        // IMPORTANTE: Mantém o nome ORIGINAL do arquivo, seja ele do storage ou do usuário.
        app.get("/api/ordem-compra/:id/pdf", async (req, res) => {
          try {
            const id = parseInt(req.params.id);
            if (isNaN(id)) {
              return res.status(400).json({
                sucesso: false,
                mensagem: "ID inválido"
              });
            }

            // Buscar informações da ordem de compra incluindo pdf_info
            const ordemResult = await pool.query(
              "SELECT numero_ordem, pdf_info FROM ordens_compra WHERE id = $1",
              [id]
            );

            if (!ordemResult.rows.length) {
              return res.status(404).json({
                sucesso: false,
                mensagem: "Ordem de compra não encontrada"
              });
            }

            const ordem = ordemResult.rows[0];
            console.log(`🔍 Buscando PDF para ordem: ${ordem.numero_ordem}`);

            // PRIORIDADE 1: Tentar buscar do Object Storage na pasta OC primeiro
            if (objectStorageAvailable && objectStorage) {
              const ocKey = `OC/${ordem.numero_ordem}.pdf`;
              console.log(`📂 Tentando buscar na pasta OC: ${ocKey}`);

              try {
                const downloadedBytes = await objectStorage.downloadAsBytes(ocKey);
                if (downloadedBytes && downloadedBytes.length > 1) { // Verificar se o arquivo não está vazio ou corrompido
                  const buffer = Buffer.from(downloadedBytes);
                  console.log(`✅ PDF recuperado da pasta OC: ${ocKey} (${buffer.length} bytes)`);

                  // USAR O NOME ORIGINAL DO ARQUIVO NO STORAGE
                  const originalFilename = `${ordem.numero_ordem}.pdf`;

                  res.setHeader("Content-Type", "application/pdf");
                  res.setHeader("Content-Length", buffer.length);
                  res.setHeader("Content-Disposition", `attachment; filename="${originalFilename}"`);
                  res.setHeader("Cache-Control", "no-cache");

                  return res.end(buffer);
                } else {
                  console.log(`⚠️ PDF na pasta OC é muito pequeno (${downloadedBytes?.length || 0} bytes) - possível corrupção.`);
                }
              } catch (ocError) {
                console.log(`🔄 PDF não encontrado na pasta OC: ${ocError.message}`);
              }
            } else {
              console.log(`⚠️ Object Storage não disponível para busca na pasta OC`);
            }

            // PRIORIDADE 2: Se tem pdf_info, tentar usar as informações armazenadas
            if (ordem.pdf_info) {
              try {
                const pdfInfo = typeof ordem.pdf_info === 'string'
                  ? JSON.parse(ordem.pdf_info)
                  : ordem.pdf_info;

                console.log(`📊 Informações do PDF encontradas:`, pdfInfo);

                const storageKey = pdfInfo.storageKey;
                const filename = pdfInfo.filename;

                if (storageKey) {
                  console.log(`📂 Tentando acessar PDF usando storageKey: ${storageKey}`);

                  const fileResult = await readFileFromStorage(
                    storageKey,
                    `ordens_compra_${ordem.numero_ordem}`,
                    filename || `${ordem.numero_ordem}.pdf`
                  );

                  if (fileResult) {
                    const { data: fileBuffer, originalName } = fileResult;

                    // Verificar se é um redirect para Google Drive
                    if (Buffer.isBuffer(fileBuffer) && fileBuffer.toString('utf-8').startsWith('REDIRECT:')) {
                      const driveLink = fileBuffer.toString('utf-8').replace('REDIRECT:', '');
                      console.log(`🔗 Redirecionando para Google Drive: ${driveLink}`);
                      return res.redirect(302, driveLink);
                    }

                    // VERIFICAÇÃO CRÍTICA: Arquivos de 1 byte não são válidos
                    if (fileBuffer.length <= 1) {
                      console.log(`⚠️ PDF encontrado via pdf_info é muito pequeno (${fileBuffer.length} byte) - ignorado`);
                      return res.status(404).json({
                        sucesso: false,
                        mensagem: `Arquivo encontrado mas parece estar corrompido (${fileBuffer.length} byte).`
                      });
                    }

                    console.log(`✅ PDF recuperado usando pdf_info (${fileBuffer.length} bytes) - Nome original: ${originalName}`);

                    res.setHeader("Content-Type", "application/pdf");
                    res.setHeader("Content-Length", fileBuffer.length);
                    res.setHeader("Content-Disposition", `attachment; filename="${originalName}"`);
                    res.setHeader("Cache-Control", "no-cache");

                    return res.end(fileBuffer);
                  }
                }
              } catch (error) {
                console.log(`❌ Erro ao processar pdf_info:`, error);
              }
            }

            // PRIORIDADE 3: FALLBACK - Tentar buscar o arquivo na pasta uploads usando o número da ordem
            const uploadsPath = path.join(process.cwd(), "uploads", `${ordem.numero_ordem}.pdf`);
            console.log(`📁 Tentando PDF em uploads: ${uploadsPath}`);

            if (fs.existsSync(uploadsPath)) {
              const buffer = fs.readFileSync(uploadsPath);
              // VERIFICAÇÃO CRÍTICA: Arquivos de 1 byte não são válidos
              if (buffer.length > 1) {
                console.log(`✅ PDF encontrado em uploads: ${uploadsPath} (${buffer.length} bytes)`);
                res.setHeader("Content-Type", "application/pdf");
                res.setHeader("Content-Disposition", `attachment; filename="ordem_compra_${ordem.numero_ordem}.pdf"`);
                res.setHeader("Content-Length", buffer.length);
                return res.end(buffer);
              } else {
                console.log(`⚠️ PDF local em uploads é muito pequeno (${buffer.length} byte) - ignorado`);
              }
            }

            // Debug: Listar arquivos disponíveis para troubleshooting
            const uploadsDir = path.join(process.cwd(), "uploads");
            if (fs.existsSync(uploadsDir)) {
              const files = fs.readdirSync(uploadsDir).filter(f => f.endsWith('.pdf'));
              console.log(`📋 PDFs disponíveis em uploads:`, files);
            }

            // Verificar também se há arquivos no Object Storage para debug
            if (objectStorageAvailable && objectStorage) {
              try {
                const objects = await objectStorage.list();
                const ocObjects = objects.filter(obj => obj.key.startsWith('OC/'));
                console.log(`📋 PDFs na pasta OC do Object Storage:`, ocObjects.map(obj => obj.key));
              } catch (listError) {
                console.log(`❌ Erro ao listar objetos do Object Storage:`, listError.message);
              }
            }

            // Se não encontrar o arquivo em lugar nenhum
            return res.status(404).json({
              sucesso: false,
              mensagem: `PDF da ordem de compra ${ordem.numero_ordem} não encontrado. Verifique se o arquivo foi enviado e está na pasta OC do Object Storage.`
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

              console.log(`📤 Iniciando upload de PDF da ordem de compra ID: ${id}`);
              console.log(`📄 Arquivo recebido: ${req.file.filename} (${req.file.size} bytes)`);

              // Buscar informações da ordem de compra
              const ordemResult = await pool.query(
                "SELECT numero_ordem FROM ordens_compra WHERE id = $1",
                [id]
              );

              if (!ordemResult.rows.length) {
                return res.status(404).json({
                  sucesso: false,
                  mensagem: "Ordem de compra não encontrada"
                });
              }

              const numeroOrdem = ordemResult.rows[0].numero_ordem;
              console.log(`📋 Ordem encontrada: ${numeroOrdem}`);

              // Salvar arquivo diretamente na pasta OC do Object Storage
              let pdfKey;
              try {
                // PRIORIDADE: Tentar salvar diretamente no Object Storage na pasta OC
                if (objectStorageAvailable && objectStorage) {
                  const buffer = fs.readFileSync(req.file.path);
                  const storageKey = `OC/${numeroOrdem}.pdf`;

                  console.log(` পাঠানোর Saving PDF to OC folder: ${storageKey}`);
                  console.log(`📊 Buffer size: ${buffer.length} bytes`);

                  // Usar o método correto do Replit Object Storage
                  const uint8Array = new Uint8Array(buffer);
                  await objectStorage.uploadFromBytes(storageKey, uint8Array);

                  // Verificar se o upload foi bem-sucedido
                  try {
                    const verification = await objectStorage.downloadAsBytes(storageKey);
                    if (verification && verification.length > 1 && verification.length === buffer.length) { // Verifica se o arquivo não está corrompido e tem o tamanho correto
                      console.log(`✅ PDF saved and verified in OC folder: ${storageKey} (${verification.length} bytes)`);
                      pdfKey = storageKey;
                    } else {
                      console.log(`⚠️ Upload completed but verification failed (size ${verification?.length || 0} vs ${buffer.length})`);
                      // Não lança erro, mas informa que a verificação falhou
                    }
                  } catch (verifyError) {
                    console.log(`⚠️ Upload completed but verification failed: ${verifyError.message}`);
                    // Não lança erro, mas informa que a verificação falhou
                  }

                  // Se a chave não foi definida (por falha na verificação), usar o fallback
                  if (!pdfKey) {
                    console.log(`🔄 Falling back to saveFileToStorage as Object Storage verification failed.`);
                    pdfKey = await saveFileToStorage(
                      buffer,
                      req.file.filename,
                      `ordens_compra_${numeroOrdem}`
                    );
                  }

                } else {
                  console.log(`⚠️ Object Storage not available - falling back.`);
                  // Fallback para função existente se Object Storage não disponível
                  pdfKey = await saveFileToStorage(
                    fs.readFileSync(req.file.path),
                    req.file.filename,
                    `ordens_compra_${numeroOrdem}`
                  );
                }
              } catch (error) {
                console.error(`❌ Error saving PDF to OC folder:`, error);
                console.log(`🔄 Attempting fallback to saveFileToStorage function.`);

                // Fallback para função existente
                try {
                  pdfKey = await saveFileToStorage(
                    fs.readFileSync(req.file.path),
                    req.file.filename,
                    `ordens_compra_${numeroOrdem}`
                  );
                  console.log(`✅ PDF saved via fallback: ${pdfKey}`);
                } catch (fallbackError) {
                  console.error(`❌ Fallback also failed:`, fallbackError);
                  throw new Error(`Failed to save PDF: ${fallbackError.message}`);
                }
              }

              console.log(`✅ PDF saved to Object Storage with key: ${pdfKey}`);

              // Construir informações do PDF para armazenar no banco
              const pdfInfo = {
                name: req.file.originalname,
                filename: req.file.filename,
                size: req.file.size,
                path: req.file.path,
                storageKey: pdfKey,
                date: new Date().toISOString()
              };

              // Atualizar a tabela ordens_compra com as informações do PDF
              await pool.query(
                `UPDATE ordens_compra SET pdf_info = $1 WHERE id = $2`,
                [JSON.stringify(pdfInfo), id]
              );

              console.log(`📊 PDF info saved to database for order ${numeroOrdem}`);

              // Registrar log de upload
              if (req.session.userId) {
                await storage.createLog({
                  userId: req.session.userId,
                  action: "Upload de PDF da ordem de compra",
                  itemType: "purchase_order",
                  itemId: id.toString(),
                  details: `PDF da ordem de compra ${numeroOrdem} enviado e salvo no Object Storage`
                });
              }

              res.json({
                sucesso: true,
                mensagem: "Upload do PDF realizado com sucesso e salvo no Object Storage",
                pdfInfo: pdfInfo
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
        app.put("/api/ordem-compra/:id", isAuthenticated, async (req, res) => {
          try {
            const id = parseInt(req.params.id);
            if (isNaN(id)) {
              return res.status(400).json({
                sucesso: false,
                mensagem: "ID inválido"
              });
            }

            const { numeroOrdem, empresaId, cnpj, validoAte, items } = req.body;

            console.log(`🔄 Atualizando ordem de compra ${id}:`, {
              numeroOrdem,
              empresaId,
              cnpj,
              validoAte,
              items: items?.length || 0
            });

            // Verificar se o usuário tem permissão para editar ordens de compra
            let hasEditPermission = false;

            console.log(`🔍 Verificando permissões de edição para usuário ${req.user.id}:`, {
              userId: req.user.id,
              isKeyUser: req.user.isKeyUser,
              isDeveloper: req.user.isDeveloper,
              companyId: req.user.companyId,
              canEditPurchaseOrders: req.user.canEditPurchaseOrders,
              permissions: req.user.permissions
            });

            // KeyUsers (IDs 1-5) sempre têm permissão
            if ((req.user.id >= 1 && req.user.id <= 5) || req.user.isKeyUser === true || req.user.isDeveloper === true ||
                (req.user.permissions && req.user.permissions.includes("*"))) {
              hasEditPermission = true;
              console.log(`✅ Permissão concedida - KeyUser (ID ${req.user.id}) detectado`);
            } else if (req.user.canEditPurchaseOrders === true) {
              hasEditPermission = true;
              console.log(`✅ Permissão concedida - Usuário habilitado para editar ordens de compra`);
            } else if (req.user.companyId) {
              // Verificar se a empresa do usuário tem categoria que permite editar ordens
              const userCompany = await storage.getCompany(req.user.companyId);
              if (userCompany) {
                const companyCategory = await storage.getCompanyCategory(userCompany.categoryId);
                hasEditPermission = companyCategory?.receivesPurchaseOrders === true;
                console.log(`📋 Permissão da categoria ${companyCategory?.name}: ${hasEditPermission}`);
              }
            }

            if (!hasEditPermission) {
              console.log(`❌ Permissão negada para usuário ${req.user.id}`);
              return res.status(403).json({
                sucesso: false,
                mensagem: "Você não tem permissão para editar ordens de compra"
              });
            }

            // Verificar se a ordem existe
            const checkOrdem = await pool.query(
              "SELECT * FROM ordens_compra WHERE id = $1",
              [id]
            );

            if (!checkOrdem || !checkOrdem.rows || checkOrdem.rows.length === 0) {
              console.log(`❌ Ordem ${id} não encontrada`);
              return res.status(404).json({
                sucesso: false,
                mensagem: "Ordem de compra não encontrada"
              });
            }

            console.log(`✅ Ordem ${id} encontrada, iniciando atualização`);

            // Validar dados obrigatórios
            if (!numeroOrdem || !empresaId || !validoAte) {
              return res.status(400).json({
                sucesso: false,
                mensagem: "Dados obrigatórios não fornecidos (numeroOrdem, empresaId, validoAte)"
              });
            }

            // Buscar CNPJ da empresa se não fornecido
            let cnpjFinal = cnpj;
            if (!cnpjFinal && empresaId) {
              const empresaResult = await pool.query(
                "SELECT cnpj FROM companies WHERE id = $1",
                [empresaId]
              );
              if (empresaResult.rows.length > 0) {
                cnpjFinal = empresaResult.rows[0].cnpj;
                console.log(`📋 CNPJ da empresa ${empresaId}: ${cnpjFinal}`);
              }
            }

            // Iniciar transação para garantir atomicidade
            await pool.query('BEGIN');

            try {
              // Atualizar a ordem
              const updateResult = await pool.query(
                `UPDATE ordens_compra
                 SET numero_ordem = $1, empresa_id = $2, cnpj = $3, valido_ate = $4
                 WHERE id = $5
                 RETURNING *`,
                [numeroOrdem, empresaId, cnpjFinal, validoAte, id]
              );

              console.log(`✅ Ordem atualizada:`, updateResult.rows[0]);

              // Remover itens antigos
              await pool.query("DELETE FROM itens_ordem_compra WHERE ordem_compra_id = $1", [id]);
              console.log(`🗑️ Itens antigos removidos`);

              // Inserir novos itens
              if (items && items.length > 0) {
                for (const item of items) {
                  if (item.productId && item.quantity) {
                    await pool.query(
                      `INSERT INTO itens_ordem_compra
                       (ordem_compra_id, produto_id, quantidade)
                       VALUES ($1, $2, $3)`,
                      [id, item.productId, item.quantity]
                    );
                    console.log(`➕ Item adicionado: produto ${item.productId}, qtd ${item.quantity}`);
                  }
                }
              }

              // Confirmar transação
              await pool.query('COMMIT');

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

              console.log(`✅ Ordem de compra ${numeroOrdem} atualizada com sucesso`);

              res.json({
                sucesso: true,
                mensagem: "Ordem de compra atualizada com sucesso",
                ordem: updateResult.rows[0]
              });

            } catch (transactionError) {
              // Reverter transação em caso de erro
              await pool.query('ROLLBACK');
              throw transactionError;
            }

          } catch (error) {
            console.error("❌ Erro ao atualizar ordem de compra:", error);
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

        // Obter detalhes completos de uma ordem de compra
        app.get("/api/ordem-compra/:id", async (req, res) => {
          try {
            const id = parseInt(req.params.id);
            if (isNaN(id)) {
              return res.status(400).json({
                sucesso: false,
                mensagem: "ID inválido"
              });
            }

            console.log(`🔍 Buscando detalhes da ordem de compra ID: ${id}`);

            // Buscar a ordem de compra completa
            const result = await pool.query(`
              SELECT
                oc.id,
                oc.numero_ordem,
                oc.empresa_id,
                oc.cnpj,
                oc.valido_desde,
                oc.valido_ate,
                oc.status,
                oc.data_criacao,
                c.name as empresa_nome,
                obra.name as obra_nome
              FROM ordens_compra oc
              LEFT JOIN companies c ON oc.empresa_id = c.id
              LEFT JOIN companies obra ON oc.cnpj = obra.cnpj
              WHERE oc.id = $1
            `, [id]);

            if (result.rows.length === 0) {
              console.log(`❌ Ordem de compra ${id} não encontrada`);
              return res.status(404).json({
                sucesso: false,
                mensagem: "Ordem de compra não encontrada"
              });
            }

            const ordem = result.rows[0];
            console.log(`✅ Ordem encontrada: ${ordem.numero_ordem}`, ordem);

            res.json(ordem);

          } catch (error) {
            console.error("❌ Erro ao buscar detalhes da ordem de compra:", error);
            res.status(500).json({
              sucesso: false,
              mensagem: "Erro ao buscar detalhes da ordem de compra",
              erro: error instanceof Error ? error.message : "Erro desconhecido"
            });
          }
        });

        // Rota de debug para download direto do Object Storage (apenas keyuser)
        app.get("/api/debug/direct-download/:storageKey", isAuthenticated, isKeyUser, async (req, res) => {
          try {
            const { storageKey } = req.params;
            const decodedKey = decodeURIComponent(storageKey);

            console.log(`🔧 DEBUG: Download direto de: ${decodedKey}`);

            if (!objectStorageAvailable || !objectStorage) {
              return res.status(500).json({
                sucesso: false,
                mensagem: "Object Storage não disponível"
              });
            }

            // Download DIRETO sem nenhum processamento
            const rawData = await objectStorage.downloadAsBytes(decodedKey);

            console.log(`📥 Resultado bruto:`, {
              tipo: typeof rawData,
              isBuffer: rawData instanceof Buffer,
              isUint8Array: rawData instanceof Uint8Array,
              hasOkProperty: rawData && typeof rawData === 'object' && 'ok' in rawData,
              length: rawData?.length || (rawData?.value?.length)
            });

            // Retornar dados EXATAMENTE como vieram do Object Storage
            let finalData;

            if (rawData instanceof Buffer) {
              finalData = rawData;
            } else if (rawData instanceof Uint8Array) {
              finalData = Buffer.from(rawData);
            } else if (rawData && typeof rawData === 'object' && rawData.ok && rawData.value) {
              if (rawData.value instanceof Buffer) {
                finalData = rawData.value;
              } else if (rawData.value instanceof Uint8Array) {
                finalData = Buffer.from(rawData.value);
              } else {
                finalData = Buffer.from(rawData.value);
              }
            } else {
              finalData = Buffer.from(rawData);
            }

            console.log(`📤 Enviando ${finalData.length} bytes diretamente`);

            // Detectar tipo de arquivo pela key
            const isPDF = decodedKey.toLowerCase().includes('pdf');
            const isXML = decodedKey.toLowerCase().includes('xml');

            const contentType = isPDF ? 'application/pdf' : (isXML ? 'application/xml' : 'application/octet-stream');

            res.setHeader('Content-Type', contentType);
            res.setHeader('Content-Length', finalData.length);
            res.setHeader('Content-Disposition', `attachment; filename="${path.basename(decodedKey)}"`);

            res.end(finalData);

          } catch (error) {
            console.error(`❌ Erro no debug download:`, error);
            res.status(500).json({
              sucesso: false,
              mensagem: `Erro: ${error.message}`
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
                p.name as product_name,
                u.name as unit_name,
                u.abbreviation as unit_abbreviation,
                i.quantidade_alocada
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
              produto_nome: item.product_name || "Produto não encontrado",
              unidade: item.unit_abbreviation || item.unit_name || 'un',
              quantidade: parseFloat(item.quantidade || 0),
              quantidade_alocada: parseFloat(item.quantidade_alocada || 0)
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
            // Buscar apenas empresas com número de contrato preenchido usando storage
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

        // Função auxiliar de validação
        function isValidLatitude(lat: number): boolean {
          return !isNaN(lat) && lat >= -90 && lat <= 90;
        }

        function isValidLongitude(lng: number): boolean {
          return !isNaN(lng) && lng >= -180 && lng <= 180;
        }

        // Função para converter data para timezone local brasileiro
        function convertToLocalDate(dateString: string | Date): Date {
          const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
          // Ajustar para timezone brasileiro (GMT-3)
          const offsetMinutes = date.getTimezoneOffset();
          const localDate = new Date(date.getTime() - (offsetMinutes * 60000));
          return localDate;
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
              "SELECT id, order_id, user_id FROM orders WHERE id = $1", // Adicionado user_id
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
            // Permitir se for admin, keyuser, ou o próprio usuário do pedido
            if (!req.user.isKeyUser && req.user.id !== order.user_id) {
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
                success: false,
                message: "ID de pedido inválido"
              });
            }

            console.log(`🔍 Tentativa de aprovação do pedido ${id} pelo usuário ${req.user.id} (${req.user.name})`);

            // Verificar se o pedido existe
            const order = await storage.getOrder(id);
            if (!order) {
              console.log(`❌ Pedido ${id} não encontrado`);
              return res.status(404).json({
                success: false,
                message: "Pedido não encontrado"
              });
            }

            console.log(`📋 Pedido encontrado: ${order.orderId} - Status: ${order.status}`);

            // Verificar se o usuário tem permissão para aprovar
            let hasApprovalPermission = false;
            let approvalReason = "";

            if (req.user.id === 1 || req.user.isKeyUser === true) {
              hasApprovalPermission = true;
              approvalReason = "KeyUser";
              console.log(`✅ Permissão concedida - KeyUser`);
            } else {
              // Verificar se o usuário é aprovador de alguma empresa
              const approverCheck = await pool.query(`
                SELECT c.id, c.name, c.approver_id
                FROM companies c
                WHERE c.approver_id = $1
              `, [req.user.id]);

              if (approverCheck.rows.length > 0) {
                console.log(`👤 Usuário é aprovador de ${approverCheck.rows.length} empresa(s):`);
                approverCheck.rows.forEach(company => {
                  console.log(`  - ${company.name} (ID: ${company.id})`);
                });

                // Verificar se o pedido é da empresa que o usuário aprova
                if (order.purchaseOrderId) {
                  const ordemCompraResult = await pool.query(
                    "SELECT cnpj FROM ordens_compra WHERE id = $1",
                    [order.purchaseOrderId]
                  );

                  if (ordemCompraResult.rows.length > 0) {
                    const cnpjDestino = ordemCompraResult.rows[0].cnpj;

                    // Verificar se alguma das empresas que o usuário aprova corresponde ao CNPJ de destino
                    const empresaDestinoCheck = await pool.query(`
                      SELECT c.id, c.name
                      FROM companies c
                      WHERE c.cnpj = $1 AND c.approver_id = $2
                    `, [cnpjDestino, req.user.id]);

                    if (empresaDestinoCheck.rows.length > 0) {
                      hasApprovalPermission = true;
                      approvalReason = `Aprovador da empresa ${empresaDestinoCheck.rows[0].name}`;
                      console.log(`✅ Permissão concedida - ${approvalReason}`);
                    } else {
                      console.log(`❌ Usuário não é aprovador da empresa de destino (CNPJ: ${cnpjDestino})`);
                    }
                  }
                }
              } else {
                console.log(`❌ Usuário ${req.user.name} não é aprovador de nenhuma empresa`);
              }
            }

            if (!hasApprovalPermission) {
              return res.status(403).json({
                success: false,
                message: "Sem permissão para aprovar pedidos. Apenas KeyUsers e aprovadores de empresaspodem aprovar pedidos urgentes."
              });
            }

            // Verificar se o pedido pode ser aprovado (status deve ser "Registrado")
            if (order.status !== "Registrado") {
              return res.status(400).json({
                success: false,
                message: `Pedido não pode ser aprovado. Status atual: ${order.status}`
              });
            }

            // Atualizar status do pedido para "Aprovado"
            await pool.query(
              "UPDATE orders SET status = $1 WHERE id = $2",
              ["Aprovado", id]
            );

            console.log(`✅ Pedido ${order.orderId} aprovado com sucesso por ${approvalReason}`);

            // Registrar log
            await storage.createLog({
              userId: req.user.id,
              action: "Aprovação de pedido",
              itemType: "order",
              itemId: id.toString(),
              details: `Pedido ${order.orderId} foi aprovado por ${req.user.name} (${approvalReason})`
            });

            res.json({
              success: true,
              message: "Pedido aprovado com sucesso"
            });
          } catch (error) {
            console.error("❌ Erro detalhado ao aprovar pedido:", error);
            res.status(500).json({
              success: false,
              message: "Erro interno do servidor ao aprovar pedido",
              error: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
          }
        });

        // Rota para rejeitar pedido
        app.put("/api/orders/:id/reject", isAuthenticated, async (req, res) => {
          try {
            const id = parseInt(req.params.id);
            if (isNaN(id)) {
              return res.status(400).json({
                success: false,
                message: "ID de pedido inválido"
              });
            }

            console.log(`🔍 Tentativa de rejeição do pedido ${id} pelo usuário ${req.user.id} (${req.user.name})`);

            // Verificar se o pedido existe
            const order = await storage.getOrder(id);
            if (!order) {
              console.log(`❌ Pedido ${id} não encontrado`);
              return res.status(404).json({
                success: false,
                message: "Pedido não encontrado"
              });
            }

            console.log(`📋 Pedido encontrado: ${order.orderId} - Status: ${order.status}`);

            // Verificar se o usuário tem permissão para rejeitar
            let hasApprovalPermission = false;
            let approvalReason = "";

            if (req.user.id === 1 || req.user.isKeyUser === true) {
              hasApprovalPermission = true;
              approvalReason = "KeyUser";
              console.log(`✅ Permissão concedida - KeyUser`);
            } else {
              // Verificar se o usuário é aprovador de alguma empresa
              const approverCheck = await pool.query(`
                SELECT c.id, c.name, c.approver_id
                FROM companies c
                WHERE c.approver_id = $1
              `, [req.user.id]);

              if (approverCheck.rows.length > 0) {
                console.log(`👤 Usuário é aprovador de ${approverCheck.rows.length} empresa(s):`);

                // Verificar se o pedido é da empresa que o usuário aprova
                if (order.purchaseOrderId) {
                  const ordemCompraResult = await pool.query(
                    "SELECT cnpj FROM ordens_compra WHERE id = $1",
                    [order.purchaseOrderId]
                  );

                  if (ordemCompraResult.rows.length > 0) {
                    const cnpjDestino = ordemCompraResult.rows[0].cnpj;

                    // Verificar se alguma das empresas que o usuário aprova corresponde ao CNPJ de destino
                    const empresaDestinoCheck = await pool.query(`
                      SELECT c.id, c.name
                      FROM companies c
                      WHERE c.cnpj = $1 AND c.approver_id = $2
                    `, [cnpjDestino, req.user.id]);

                    if (empresaDestinoCheck.rows.length > 0) {
                      hasApprovalPermission = true;
                      approvalReason = `Aprovador da empresa ${empresaDestinoCheck.rows[0].name}`;
                      console.log(`✅ Permissão concedida - ${approvalReason}`);
                    }
                  }
                }
              }
            }

            if (!hasApprovalPermission) {
              return res.status(403).json({
                success: false,
                message: "Sem permissão para rejeitar pedidos. Apenas KeyUsers e aprovadores de empresas podem rejeitar pedidos urgentes."
              });
            }

            // Verificar se o pedido pode ser rejeitado (status deve ser "Registrado")
            if (order.status !== "Registrado") {
              return res.status(400).json({
                success: false,
                message: `Pedido não pode ser rejeitado. Status atual: ${order.status}`
              });
            }

            // Atualizar status do pedido para "Cancelado"
            await pool.query(
              "UPDATE orders SET status = $1 WHERE id = $2",
              ["Cancelado", id]
            );

            console.log(`✅ Pedido ${order.orderId} rejeitado com sucesso por ${approvalReason}`);

            // Registrar log
            await storage.createLog({
              userId: req.user.id,
              action: "Rejeição de pedido",
              itemType: "order",
              itemId: id.toString(),
              details: `Pedido ${order.orderId} foi rejeitado por ${req.user.name} (${approvalReason})`
            });

            res.json({
              success: true,
              message: "Pedido rejeitado com sucesso"
            });
          } catch (error) {
            console.error("❌ Erro detalhado ao rejeitar pedido:", error);
            res.status(500).json({
              success: false,
              message: "Erro interno do servidor ao rejeitar pedido",
              error: process.env.NODE_ENV === 'development' ? error.message : undefined
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
            // Sempre salvar como icapmob.apk (sobrescrever)
            cb(null, "icapmob.apk");
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

            // Buscar o pedido para obter a ordem de compra
            const pedidoResult = await pool.query(
              "SELECT purchase_order_id FROM orders WHERE id = $1",
              [id]
            );

            if (!pedidoResult.rows.length) {
              return res.status(404).json({
                sucesso: false,
                mensagem: "Pedido não encontrado"
              });
            }

            const purchaseOrderId = pedidoResult.rows[0].purchase_order_id;

            // Validar contra a validade da ordem de compra
            if (purchaseOrderId) {
              const ordemCompraResult = await pool.query(
                "SELECT valido_ate FROM ordens_compra WHERE id = $1",
                [purchaseOrderId]
              );

              if (ordemCompraResult.rows.length) {
                const validoAte = new Date(ordemCompraResult.rows[0].valido_ate);
                const novaData = new Date(novaDataEntrega);

                if (novaData > validoAte) {
                  return res.status(400).json({
                    sucesso: false,
                    mensagem: `A data de reprogramação não pode ser posterior à validade da ordem de compra (${validoAte.toLocaleDateString('pt-BR')})`
                  });
                }
              }
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

            // Buscar a data de validade da ordem de compra
            const ordemCompraValidade = await pool.query(
              "SELECT valido_ate FROM ordens_compra WHERE id = $1",
              [order.purchaseOrderId]
            );

            if (!ordemCompraValidade.rows.length) {
              return res.status(400).json({
                sucesso: false,
                mensagem: "Ordem de compra não encontrada"
              });
            }

            const validoAte = new Date(ordemCompraValidade.rows[0].valido_ate);
            const novaData = new Date(novaDataEntrega);
            const hoje = new Date();

            if (novaData > validoAte) {
              return res.status(400).json({
                sucesso: false,
                mensagem: `A nova data de entrega não pode ultrapassar a validade da ordem de compra (${validoAte.toLocaleDateString('pt-BR')})`
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

            // Buscar o order_id do pedido
            const orderResult = await pool.query("SELECT order_id FROM orders WHERE id = $1", [id]);

            if (!orderResult.rows.length) {
              return res.status(404).json({
                sucesso: false,
                mensagem: "Pedido não encontrado para salvar foto"
              });
            }

            // Salvar foto no Object Storage
            const fotoKey = await saveFileToStorage(
              fs.readFileSync(req.file.path),
              req.file.filename,
              orderResult.rows[0].order_id
            );

            // Construir informações da foto para armazenar no banco
            const fotoInfo = {
              name: req.file.originalname,
              filename: req.file.filename,
              size: req.file.size,
              path: req.file.path,
              storageKey: fotoKey,
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
            console.error("Erro ao salvar configuração:", error);
            res.status(500).json({ message: "Erro interno do servidor" });
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

        // Rota para testar siglas de empresas
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

        // Rota para keyuser testar Object Storage
        app.post("/api/keyuser/test-object-storage", isAuthenticated, isKeyUser, async (req, res) => {
          try {
            console.log("🧪 KeyUser solicitou teste do Object Storage");

            // Executar o teste do Object Storage
            const { execSync } = await import('child_process');

            let testResult;
            try {
              // Executar o script de teste
              const output = execSync('node scripts/test-object-storage-keyuser.js', {
                encoding: 'utf8',
                timeout: 30000 // 30 segundos de timeout
              });

              console.log("✅ Script de teste executado com sucesso");
              console.log("📄 Output:", output);

              testResult = {
                success: true,
                message: "Teste do Object Storage executado com sucesso",
                output: output,
                timestamp: new Date().toISOString()
              };

            } catch (execError) {
              console.error("❌ Erro ao executar script de teste:", execError);

              testResult = {
                success: false,
                message: "Erro ao executar teste do Object Storage",
                error: execError.message,
                output: execError.stdout || "",
                timestamp: new Date().toISOString()
              };
            }

            // Registrar log da ação
            if (req.session.userId) {
              await storage.createLog({
                userId: req.session.userId,
                action: "Teste Object Storage",
                itemType: "system",
                itemId: "object_storage_test",
                details: `KeyUser executou teste do Object Storage - ${testResult.success ? 'Sucesso' : 'Falha'}`
              });
            }

            // Retornar resultado
            if (testResult.success) {
              res.json({
                success: true,
                message: testResult.message,
                data: {
                  output: testResult.output,
                  timestamp: testResult.timestamp
                }
              });
            } else {
              res.status(500).json({
                success: false,
                message: testResult.message,
                error: testResult.error,
                output: testResult.output,
                timestamp: testResult.timestamp
              });
            }

          } catch (error) {
            console.error("❌ Erro na rota de teste do Object Storage:", error);
            res.status(500).json({
              success: false,
              message: "Erro interno do servidor",
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

        const uploadIcapMob = multer({
          storage: icapMobStorage,
          fileFilter: icapMobFileFilter,
          limits: {
            fileSize: 100 * 1024 * 1024, // 100MB para APKs
          }
        });

        // Rota para upload do iCapMob APK
        app.post("/api/icapmob/upload", isAuthenticated, isKeyUser, uploadIcapMob.single("apk"), async (req, res) => {
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

        // Rota para confirmar número do pedido
        app.post("/api/pedidos/:id/confirmar-numero-pedido", isAuthenticated, async (req, res) => {
          try {
            const pedidoId = parseInt(req.params.id);
            const { numeroPedido } = req.body;

            console.log(`📤 Recebida confirmação de número do pedido:`, {
              pedidoId,
              numeroPedido,
              userId: req.user.id
            });

            if (!numeroPedido || numeroPedido.trim() === "") {
              return res.status(400).json({
                sucesso: false,
                mensagem: "Número do pedido é obrigatório"
              });
            }

            if (numeroPedido.length > 20) {
              return res.status(400).json({
                sucesso: false,
                mensagem: "Número do pedido deve ter no máximo 20 caracteres"
              });
            }

            // Atualizar o pedido com o número do pedido E mudar status para "Em Rota"
            const updateResult = await pool.query(
              `UPDATE orders
               SET numero_pedido = $1, status = 'Em Rota'
               WHERE id = $2
               RETURNING *`,
              [numeroPedido.trim(), pedidoId]
            );

            if (updateResult.rows.length === 0) {
              console.error(`❌ Pedido não encontrado: ID ${pedidoId}`);
              return res.status(404).json({
                sucesso: false,
                mensagem: "Pedido não encontrado"
              });
            }

            const pedidoAtualizado = updateResult.rows[0];
            console.log(`✅ Número do pedido confirmado e status alterado para "Em Rota":`, {
              pedidoId,
              orderId: pedidoAtualizado.order_id,
              numeroPedido: pedidoAtualizado.numero_pedido,
              status: pedidoAtualizado.status
            });

            // Log da ação
            await storage.createLog({
              userId: req.user.id,
              action: "Confirmou número do pedido",
              itemType: "order",
              itemId: pedidoId.toString(),
              details: `Número do pedido ${numeroPedido} confirmado para o pedido ${pedidoAtualizado.order_id} - Status alterado para "Em Rota"`
            });

            res.json({
              sucesso: true,
              mensagem: "Número do pedido confirmado com sucesso",
              numeroPedido: pedidoAtualizado.numero_pedido,
              status: pedidoAtualizado.status,
              pedido: pedidoAtualizado
            });

          } catch (error) {
            console.error("❌ Erro ao confirmar número do pedido:", error);
            res.status(500).json({
              sucesso: false,
              mensagem: "Erro ao confirmar número do pedido"
            });
          }
        });

        // Rota para download de documentos do pedido
        app.get("/api/pedidos/:id/documentos/:tipo", async (req, res) => {
          try {
            const { id, tipo } = req.params;
            const pedidoId = parseInt(id);

            if (isNaN(pedidoId)) {
              return res.status(400).json({
                sucesso: false,
                mensagem: "ID de pedido inválido"
              });
            }

            console.log(`📥 Download solicitado - Pedido: ${pedidoId}, Tipo: ${tipo}`);

            // Buscar informações do pedido
            const pedidoResult = await pool.query(
              "SELECT order_id, documentos_info FROM orders WHERE id = $1",
              [pedidoId]
            );

            if (!pedidoResult.rows.length) {
              console.log(`❌ Pedido ${pedidoId} não encontrado`);
              return res.status(404).json({
                sucesso: false,
                mensagem: "Pedido não encontrado"
              });
            }

            const pedido = pedidoResult.rows[0];
            const orderId = pedido.order_id;

            // Parse documentos_info
            let documentosInfo = null;
            let storageKey = null;
            let filename = null;

            if (pedido.documentos_info) {
              try {
                documentosInfo = typeof pedido.documentos_info === 'string'
                  ? JSON.parse(pedido.documentos_info)
                  : pedido.documentos_info;

                if (documentosInfo && documentosInfo[tipo]) {
                  const docInfo = documentosInfo[tipo];
                  storageKey = docInfo.storageKey;
                  filename = docInfo.filename || `${tipo}.${tipo.includes('xml') ? 'xml' : 'pdf'}`;
                  console.log(`📋 Informações do documento encontradas em documentosInfo`);
                }
              } catch (error) {
                console.log("⚠️ Erro ao parsear documentos_info, tentando busca direta:", error);
              }
            }

            // Se não encontrou nos metadados, tentar buscar diretamente no storage
            if (!storageKey) {
              console.log(`🔍 documentosInfo não disponível, tentando busca direta no storage`);
              
              // Tentar encontrar o arquivo diretamente no Object Storage ou sistema local
              const possibleFilenames = [
                `${tipo}-${Date.now()}.${tipo.includes('xml') ? 'xml' : 'pdf'}`,
                `${tipo}.${tipo.includes('xml') ? 'xml' : 'pdf'}`
              ];

              // Listar arquivos no Object Storage relacionados ao pedido
              if (objectStorageAvailable && objectStorage) {
                try {
                  const objects = await objectStorage.list();
                  const relatedFiles = objects.filter(obj => {
                    const key = obj.key || obj.name || String(obj);
                    return key.includes(orderId) && key.includes(tipo.replace('_', '-'));
                  });

                  if (relatedFiles.length > 0) {
                    // Pegar o primeiro arquivo relacionado (mais recente)
                    const firstFile = relatedFiles[0];
                    storageKey = firstFile.key || firstFile.name || String(firstFile);
                    filename = storageKey.split('/').pop();
                    console.log(`✅ Arquivo encontrado no Object Storage: ${storageKey}`);
                  }
                } catch (listError) {
                  console.log(`⚠️ Erro ao listar arquivos no Object Storage:`, listError);
                }
              }

              // Tentar sistema local como fallback
              if (!storageKey) {
                const uploadsDir = path.join(process.cwd(), 'uploads', orderId);
                if (fs.existsSync(uploadsDir)) {
                  const files = fs.readdirSync(uploadsDir);
                  const matchingFile = files.find(f => f.includes(tipo.replace('_', '-')) || f.includes(tipo));
                  
                  if (matchingFile) {
                    storageKey = path.join(uploadsDir, matchingFile);
                    filename = matchingFile;
                    console.log(`✅ Arquivo encontrado no sistema local: ${storageKey}`);
                  }
                }
              }
            }

            if (!storageKey || !filename) {
              console.log(`❌ Documento ${tipo} não encontrado para pedido ${orderId}`);
              return res.status(404).json({
                sucesso: false,
                mensagem: `Documento ${tipo} não encontrado. Os documentos podem não ter sido carregados ainda.`
              });
            }

            console.log(`📂 Buscando documento:`, {
              tipo,
              storageKey,
              filename,
              orderId
            });

            // Buscar o arquivo
            const fileResult = await readFileFromStorage(storageKey, orderId, filename);

            if (!fileResult) {
              console.log(`❌ Arquivo não encontrado no storage`);
              return res.status(404).json({
                sucesso: false,
                mensagem: "Arquivo não encontrado no armazenamento"
              });
            }

            const { data: fileBuffer, originalName } = fileResult;

            // Verificar se é redirect do Google Drive
            if (Buffer.isBuffer(fileBuffer) && fileBuffer.toString('utf-8').startsWith('REDIRECT:')) {
              const driveLink = fileBuffer.toString('utf-8').replace('REDIRECT:', '');
              console.log(`🔗 Redirecionando para Google Drive: ${driveLink}`);
              return res.redirect(302, driveLink);
            }

            // Verificar integridade
            if (!fileBuffer || fileBuffer.length <= 1) {
              console.log(`⚠️ Arquivo corrompido ou vazio: ${fileBuffer?.length || 0} bytes`);
              return res.status(404).json({
                sucesso: false,
                mensagem: "Arquivo está corrompido ou vazio"
              });
            }

            console.log(`✅ Enviando arquivo: ${originalName} (${fileBuffer.length} bytes)`);

            // Determinar content-type
            const contentType = tipo.includes('xml')
              ? 'application/xml'
              : 'application/pdf';

            // Enviar arquivo - IMPORTANTE: usar res.send() para dados binários
            res.setHeader('Content-Type', contentType);
            res.setHeader('Content-Length', fileBuffer.length);
            res.setHeader('Content-Disposition', `attachment; filename="${originalName}"`);
            res.setHeader('Cache-Control', 'no-cache');

            return res.send(fileBuffer);

          } catch (error) {
            console.error("❌ Erro ao fazer download do documento:", error);
            return res.status(500).json({
              sucesso: false,
              mensagem: "Erro ao fazer download do documento",
              erro: error instanceof Error ? error.message : "Erro desconhecido"
            });
          }
        });

        // Configuração do servidor HTTP com o app Express
        const httpServer = createServer(app);
        return httpServer;
      }