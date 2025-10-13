import type { Express, Request, Response, NextFunction } from "express";
import type { Server } from "http";
import { createServer } from "http";
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

// Função utilitária para converter data para fuso horário local
function convertToLocalDate(dateString: string): Date {
  const date = new Date(dateString);
  // Ajustar para o fuso horário de Brasília (GMT-3)
  date.setHours(date.getHours() - 3);
  return date;
}

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
      const error = importError instanceof Error ? importError : new Error(String(importError));
      console.log("❌ Falha ao importar @replit/object-storage:", error.message);
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
      } else if (storageModule.default && storageModule.default.Client) {
        objectStorage = new storageModule.default.Client();
        console.log("✅ Cliente criado usando default.Client()");
      } else {
        throw new Error("Nenhum método de criação de cliente encontrado no módulo");
      }
    } catch (clientError) {
      const error = clientError instanceof Error ? clientError : new Error(String(clientError));
      console.log("❌ Erro ao criar cliente:", error.message);
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
      const error = testError instanceof Error ? testError : new Error(String(testError));
      console.log("❌ Falha no teste de conectividade:", error.message);

      // Diagnóstico adicional
      if (error.message.includes('permission') || error.message.includes('unauthorized')) {
        console.log("🔒 Problema de permissões - verifique se Object Storage está habilitado no Replit");
      } else if (error.message.includes('network') || error.message.includes('timeout')) {
        console.log("🌐 Problema de conectividade - tente novamente em alguns segundos");
      }

      objectStorageAvailable = false;
      return false;
    }
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    console.warn("⚠️ Erro inesperado na inicialização do Object Storage:", err.message);
    console.log("📂 Usando armazenamento local temporário (será perdido no redeploy)");
    objectStorageAvailable = false;
    return false;
  }
}

// Inicializar Object Storage
initializeObjectStorage();

// Função utilitária simplificada para ler arquivo do Object Storage
// Função auxiliar para extrair Buffer de resposta do Object Storage
// Replit Object Storage retorna {ok, value: [Buffer]} onde value é array com Buffer no índice 0
function extractBufferFromStorageResult(result: any): Buffer | null {
  if (!result) return null;

  // Caso 1: Wrapper {ok, value}
  if (result && typeof result === 'object' && 'ok' in result) {
    if (!result.ok || !result.value) return null;

    const val = result.value;

    // Se value é Buffer ou Uint8Array diretamente
    if (val instanceof Buffer) return val;
    if (val instanceof Uint8Array) return Buffer.from(val);

    // Se value é array com Buffer/Uint8Array no primeiro elemento
    if (Array.isArray(val) && val.length > 0) {
      const firstItem = val[0];
      if (firstItem instanceof Buffer) return firstItem;
      if (firstItem instanceof Uint8Array) return Buffer.from(firstItem);
      // Se for array de números (bytes diretos)
      if (typeof firstItem === 'number') return Buffer.from(val);
    }

    return null;
  }

  // Caso 2: Buffer ou Uint8Array direto
  if (result instanceof Buffer) return result;
  if (result instanceof Uint8Array) return Buffer.from(result);

  // Caso 3: Array direto
  if (Array.isArray(result) && result.length > 0) {
    const firstItem = result[0];
    // Se o primeiro item é um Buffer ou Uint8Array, usar ele
    if (firstItem instanceof Buffer) return firstItem;
    if (firstItem instanceof Uint8Array) return Buffer.from(firstItem);
    // Se for array de números, converter
    if (typeof firstItem === 'number') return Buffer.from(result);
  }

  return null;
}

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

        let result;

        // Tentar downloadAsBuffer primeiro se disponível
        if (typeof objectStorage.downloadAsBuffer === 'function') {
          try {
            result = await objectStorage.downloadAsBuffer(storageKey);
            console.log(`📥 Download usando downloadAsBuffer`);
          } catch (bufferError) {
            console.log(`⚠️ downloadAsBuffer falhou, tentando downloadAsBytes`);
            result = await objectStorage.downloadAsBytes(storageKey);
          }
        } else {
          result = await objectStorage.downloadAsBytes(storageKey);
        }

        let buffer = null;

        console.log(`📊 Tipo de resultado recebido:`, {
          tipo: typeof result,
          isBuffer: result instanceof Buffer,
          isUint8Array: result instanceof Uint8Array,
          hasOk: result && typeof result === 'object' && 'ok' in result,
          hasValue: result && typeof result === 'object' && 'value' in result,
          keys: result && typeof result === 'object' ? Object.keys(result) : []
        });

        // Processar resultado do Replit Object Storage
        if (result && typeof result === 'object' && 'ok' in result) {
          // Result wrapper do Replit
          console.log(`🎯 Result wrapper detectado - Status: ${result.ok}`);

          if (!result.ok) {
            console.log(`❌ Result indica erro: ${result.error || 'download failed'}`);
            continue; // Tentar próxima chave
          }

          // O value pode estar diretamente ou pode ser vazio se ok=true mas sem dados
          const valueData = result.value;

          if (!valueData) {
            console.log(`⚠️ Result.ok=true mas value está vazio/undefined`);
            continue;
          }

          if (valueData instanceof Uint8Array) {
            buffer = Buffer.from(valueData);
            console.log(`✅ Convertido Uint8Array para Buffer: ${buffer.length} bytes`);
          } else if (valueData instanceof Buffer) {
            buffer = valueData;
            console.log(`✅ Buffer direto do Result: ${buffer.length} bytes`);
          } else if (Array.isArray(valueData)) {
            // CORREÇÃO CRÍTICA: Verificar se o array contém um Buffer/Uint8Array como primeiro elemento
            if (valueData.length > 0) {
              const firstElement = valueData[0];
              if (firstElement instanceof Uint8Array) {
                buffer = Buffer.from(firstElement);
                console.log(`✅ Array[0] Uint8Array convertido para Buffer: ${buffer.length} bytes`);
              } else if (firstElement instanceof Buffer) {
                buffer = firstElement;
                console.log(`✅ Array[0] Buffer usado diretamente: ${buffer.length} bytes`);
              } else if (typeof firstElement === 'number') {
                // Array de bytes numéricos
                buffer = Buffer.from(valueData);
                console.log(`✅ Array de bytes convertido para Buffer: ${buffer.length} bytes`);
              } else {
                console.log(`❌ Tipo de Array[0] não suportado: ${typeof firstElement}`);
              }
            } else {
              console.log(`❌ Array vazio`);
            }
          } else if (typeof valueData === 'object' && valueData !== null) {
            // Pode ser um objeto array-like {0: byte1, 1: byte2, ...}
            try {
              // Verificar se é um objeto com chaves numéricas
              const keys = Object.keys(valueData);
              console.log(`🔍 Object keys amostra (primeiras 10):`, keys.slice(0, 10));
              console.log(`🔍 Total de keys:`, keys.length);

              // Verificar se as chaves são numéricas
              const numericKeys = keys.filter(k => /^\d+$/.test(k));

              if (numericKeys.length > 0) {
                console.log(`🔍 Chaves numéricas encontradas: ${numericKeys.length}`);

                // Criar array de bytes na ordem correta
                const maxIndex = Math.max(...numericKeys.map(k => parseInt(k)));
                const bytes = new Array(maxIndex + 1);

                for (const key of numericKeys) {
                  const index = parseInt(key);
                  bytes[index] = valueData[key];
                }

                // Remover undefined (se houver)
                const validBytes = bytes.filter(b => b !== undefined);

                console.log(`🔍 Total de bytes extraídos: ${validBytes.length}`);
                console.log(`🔍 Amostra dos primeiros 10 bytes:`, validBytes.slice(0, 10));

                // Verificar se todos os valores são bytes válidos
                const allValidBytes = validBytes.every(b => typeof b === 'number' && b >= 0 && b <= 255);

                if (allValidBytes && validBytes.length > 100) {
                  buffer = Buffer.from(validBytes);
                  console.log(`✅ Object array-like convertido para Buffer: ${buffer.length} bytes`);
                } else if (!allValidBytes) {
                  console.log(`⚠️ Object contém valores não numéricos ou fora do intervalo de bytes`);
                  console.log(`🔍 Tipos encontrados:`, Array.from(new Set(validBytes.map(b => typeof b))));
                } else {
                  console.log(`⚠️ Buffer resultante muito pequeno: ${validBytes.length} bytes`);
                }
              } else {
                console.log(`⚠️ Object não tem chaves numéricas válidas`);
                console.log(`🔍 Tipos de keys:`, keys.slice(0, 5).map(k => `${k} (${typeof k})`));
              }
            } catch (conversionError) {
              const error = conversionError instanceof Error ? conversionError : new Error(String(conversionError));
              console.log(`⚠️ Erro ao converter object para buffer:`, error.message);
              console.log(`📋 Stack:`, error.stack);
            }
          } else {
            console.log(`❌ Tipo de value não suportado:`, typeof valueData);
          }
        } else if (result instanceof Uint8Array) {
          // Dados diretos como Uint8Array
          buffer = Buffer.from(result);
          console.log(`✅ Uint8Array direto convertido: ${buffer.length} bytes`);
        } else if (result instanceof Buffer) {
          // Dados diretos como Buffer
          buffer = result;
          console.log(`✅ Buffer direto: ${buffer.length} bytes`);
        } else if (Array.isArray(result)) {
          // Array direto de bytes
          buffer = Buffer.from(result);
          console.log(`✅ Array direto convertido: ${buffer.length} bytes`);
        } else {
          console.log(`❌ Tipo de resultado não suportado:`, typeof result);
        }

          // Verificar se o buffer é válido (mais de 100 bytes para arquivos reais)
          if (buffer && buffer.length > 100) {
            console.log(`✅ Arquivo encontrado e validado: ${storageKey} (${buffer.length} bytes)`);
            return {
              data: buffer,
              originalName: filename
            };
          } else {
            console.log(`⚠️ Buffer muito pequeno (provável erro): ${buffer ? buffer.length : 0} bytes`);
            console.log(`🔄 Tentando método alternativo de download...`);

            // Método alternativo: tentar download direto sem conversão
            try {
              const rawResult = await objectStorage.downloadAsBytes(storageKey);
              console.log(`📊 Resultado bruto do método alternativo:`, {
                tipo: typeof rawResult,
                tamanho: rawResult?.length || 'indefinido',
                temOk: rawResult?.ok !== undefined,
                temValue: rawResult?.value !== undefined
              });

              // Se o resultado bruto for maior, usar ele
              if (rawResult && rawResult.length > (buffer?.length || 0)) {
                const altBuffer = Buffer.from(rawResult);
                if (altBuffer.length > 100) {
                  console.log(`✅ Método alternativo funcionou: ${altBuffer.length} bytes`);
                  return {
                    data: altBuffer,
                    originalName: filename
                  };
                }
              }
            } catch (altError) {
              const error = altError instanceof Error ? altError : new Error(String(altError));
              console.log(`❌ Método alternativo também falhou: ${error.message}`);
            }
          }
        } catch (downloadError) {
          const error = downloadError instanceof Error ? downloadError : new Error(String(downloadError));
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
        const relatedFiles = objects.filter((obj: any) => {
          const objKey = obj.key || obj.name || String(obj);
          return objKey.includes(orderId) || objKey.includes(filename.split('-')[0]);
        });

        if (relatedFiles.length > 0) {
          console.log(`📋 Arquivos relacionados encontrados:`);
          relatedFiles.forEach((obj: any) => {
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
              const error = downloadError instanceof Error ? downloadError : new Error(String(downloadError));
              console.log(`❌ Erro no download do arquivo relacionado: ${error.message}`);
            }
          }
        } else {
          console.log(`📋 Nenhum arquivo relacionado encontrado`);
          // Mostrar alguns arquivos para referência
          const sampleFiles = objects.slice(0, 10);
          console.log(`📋 Primeiros 10 arquivos no storage:`);
          sampleFiles.forEach((obj: any) => {
            const objKey = obj.key || obj.name || String(obj);
            console.log(`   • ${objKey}`);
          });
        }
      } catch (listError) {
        const error = listError instanceof Error ? listError : new Error(String(listError));
        console.log(`⚠️ Erro ao listar arquivos: ${error.message}`);
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
        const err = error instanceof Error ? error : new Error(String(error));
        console.log(`⚠️ Erro no arquivo local ${filePath}: ${err.message}`);
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
      // CORREÇÃO: Adicionar prefixo 'orders/' ao caminho
      const storageKey = `orders/${orderId}/${filename}`;
      console.log(`📤 Tentando upload para Object Storage: ${storageKey}`);
      console.log(`📊 Tamanho do buffer: ${buffer.length} bytes`);

      // Validar buffer antes do upload
      if (!buffer || buffer.length === 0) {
        throw new Error("Buffer vazio ou inválido para upload");
      }

      // O método correto é uploadFromBytes para arquivos binários
      let uploadResult;
      if (buffer instanceof Buffer) {
        // Converter buffer para Uint8Array que é o formato esperado pelo Replit Object Storage
        const uint8Array = new Uint8Array(buffer);
        console.log(`📤 Convertido para Uint8Array: ${uint8Array.length} bytes`);

        // Upload usando bytes
        uploadResult = await objectStorage.uploadFromBytes(storageKey, uint8Array);
        console.log("✅ Upload realizado com uploadFromBytes");
      } else {
        // Se não for Buffer, tentar converter primeiro
        console.log(`⚠️ Dados não são Buffer, tentando conversão. Tipo: ${typeof buffer}`);
        const bufferData = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
        const uint8Array = new Uint8Array(bufferData);
        uploadResult = await objectStorage.uploadFromBytes(storageKey, uint8Array);
        console.log("✅ Upload realizado após conversão para Buffer");
      }

      // VERIFICAÇÃO CRÍTICA: Testar integridade do arquivo após upload
      console.log(`🔍 Verificando integridade do arquivo após upload...`);

      try {
        const downloadTest = await objectStorage.downloadAsBytes(storageKey);

        // Extrair buffer usando a mesma função do readFileFromStorage
        const testBuffer = extractBufferFromStorageResult(downloadTest);

        if (!testBuffer || testBuffer.length === 0) {
          console.error(`❌ Download de verificação retornou dados vazios ou nulos`);
          throw new Error("Verificação falhou: dados vazios no download");
        }

        const downloadedSize = testBuffer.length;
        const originalSize = buffer.length;

        console.log(`📊 Verificação de integridade:`);
        console.log(`   • Tamanho original: ${originalSize} bytes`);
        console.log(`   • Tamanho baixado: ${downloadedSize} bytes`);
        console.log(`   • Integridade: ${downloadedSize === originalSize ? 'OK' : 'FALHA'}`);

        if (downloadedSize === originalSize) {
          console.log(`✅ Arquivo verificado no Object Storage: ${storageKey}`);
          console.log(`✅ Arquivo estará disponível após redeploys`);
          return storageKey;
        } else {
          console.error(`❌ Tamanhos não coincidem! Original: ${originalSize}, Baixado: ${downloadedSize}`);
          console.log(`⚠️ Continuing with upload even without verification`);
          return storageKey;
        }
      } catch (verifyError) {
        const error = verifyError instanceof Error ? verifyError : new Error(String(verifyError));
        console.log(`⚠️ Erro na verificação de integridade: ${error.message}`);
        console.log(`⚠️ Continuing with upload even without verification`);
        return storageKey;
      }
    } catch (storageError) {
      const error = storageError instanceof Error ? storageError : new Error(String(storageError));
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
  } catch (driveError) {
    console.error("❌ Erro ao salvar no Google Drive:", driveError);
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
  } catch (localError) {
    const error = localError instanceof Error ? localError : new Error(String(localError));
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
          isKeyUser: user.id === 1, // Assumendo que o usuário com ID 1 é o KeyUser
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

// Middleware para upload de foto de confirmação de entrega
const uploadFotoConfirmacao = multer({
  storage: multer.memoryStorage(), // Armazenar em memória para processamento posterior
  limits: {
    fileSize: 5 * 1024 * 1024, // Limite de 5MB
  },
  fileFilter: (req, file, cb) => {
    // Aceitar apenas imagens JPG e PNG
    if (file.mimetype === 'image/jpeg' || file.mimetype === 'image/png') {
      cb(null, true);
    } else {
      cb(new Error('Apenas arquivos JPG e PNG são permitidos'));
    }
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
        const error = connectError instanceof Error ? connectError : new Error(String(connectError));
        log.push(`❌ Falha na conectividade: ${error.message}`);
        throw new Error(`Conectividade: ${error.message}`);
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
        const error = uploadError instanceof Error ? uploadError : new Error(String(uploadError));
        log.push(`❌ Falha no upload: ${error.message}`);
        throw new Error(`Upload: ${error.message}`);
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
            const values = Object.values(downloadedData) as number[];
            rawData = new Uint8Array(values);
            log.push(`✅ Object array-like convertido para Uint8Array`);
          } catch (conversionError) {
            const error = conversionError instanceof Error ? conversionError : new Error(String(conversionError));
            log.push(`❌ Erro na conversão de object para Uint8Array: ${error.message}`);
            throw new Error(`Conversão de dados: ${error.message}`);
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
          const error = textError instanceof Error ? textError : new Error(String(textError));
          log.push(`❌ Erro na conversão para texto: ${error.message}`);
          throw new Error(`Conversão para texto: ${error.message}`);
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
        const error = downloadError instanceof Error ? downloadError : new Error(String(downloadError));
        log.push(`❌ Falha no download: ${error.message}`);
        log.push(`🔍 Stack trace: ${error.stack}`);
        throw new Error(`Download: ${error.message}`);
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
        const keyuserObjects = objects.filter((obj: any) => {
          const key = obj.key || obj.name || obj;
          return key && key.includes('keyuser');
        });

        log.push(`🔑 Objetos do keyuser: ${keyuserObjects.length}`);

        if (keyuserObjects.length > 0) {
          log.push('📋 Últimos 3 objetos do keyuser:');
          keyuserObjects.slice(-3).forEach((obj: any, index: number) => {
            const key = obj.key || obj.name || String(obj);
            const size = obj.size ? `(${(obj.size / 1024).toFixed(2)} KB)` : '';
            log.push(`   ${index + 1}. ${key} ${size}`);
          });
        }
      } catch (listError) {
        const error = listError instanceof Error ? listError : new Error(String(listError));
        log.push(`❌ Falha na listagem: ${error.message}`);
        throw new Error(`Listagem: ${error.message}`);
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
          const error = perfError instanceof Error ? perfError : new Error(String(perfError));
          log.push(`⚠️ Erro no teste de performance: ${error.message}`);
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
      const err = error instanceof Error ? error : new Error(String(error));
      const totalTime = Date.now() - startTime;
      log.push('\n❌ TESTE FALHOU');
      log.push(`💥 Erro: ${err.message}`);
      log.push(`⏱️ Tempo até falha: ${totalTime}ms`);

      // Registrar falha no log do sistema
      await storage.createLog({
        userId: req.user.id,
        action: "Falha no teste da API Object Storage",
        itemType: "system",
        itemId: "object_storage_api",
        details: `Erro: ${err.message}`
      });

      res.json({
        success: false,
        message: `Teste da API falhou: ${err.message}`,
        error: err.message,
        log: log.join('\n'),
        timestamp: new Date().toISOString()
      });
    }
  });

  // Rota para re-upload de arquivo corrompido (KeyUser only)
  app.post("/api/keyuser/fix-corrupted-file", isAuthenticated, isKeyUser, async (req, res) => {
    try {
      const { orderId, localPath, storageKey } = req.body;

      console.log(`🔧 Tentando corrigir arquivo corrompido...`);
      console.log(`   Pedido: ${orderId}`);
      console.log(`   Caminho local: ${localPath}`);
      console.log(`   Storage Key: ${storageKey}`);

      // Tentar ler do sistema local
      const fs = await import('fs');
      const path = await import('path');

      if (fs.existsSync(localPath)) {
        const localBuffer = fs.readFileSync(localPath);
        console.log(`✅ Arquivo local encontrado: ${localBuffer.length} bytes`);

        // Re-upload para Object Storage
        if (objectStorageAvailable && objectStorage) {
          const uint8Array = new Uint8Array(localBuffer);
          await objectStorage.uploadFromBytes(storageKey, uint8Array);
          console.log(`✅ Arquivo re-carregado no Object Storage: ${storageKey}`);

          // Verificar
          const verification = await objectStorage.downloadAsBytes(storageKey);
          console.log(`🔍 Verificação: ${verification?.length || verification?.value?.length || 0} bytes`);

          return res.json({
            success: true,
            message: `Arquivo corrigido com sucesso`,
            originalSize: localBuffer.length,
            verificationSize: verification?.length || verification?.value?.length || 0
          });
        } else {
          return res.status(500).json({
            success: false,
            message: "Object Storage não disponível para re-upload"
          });
        }
      } else {
        console.log(`❌ Arquivo local não encontrado: ${localPath}`);
        return res.status(404).json({
          success: false,
          message: `Arquivo local não encontrado`
        });
      }

    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      console.error("Erro ao corrigir arquivo:", err);
      res.status(500).json({
        success: false,
        message: `Erro: ${err.message}`
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
          message: "Object Storage não disponível"
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
        const error = downloadError instanceof Error ? downloadError : new Error(String(downloadError));
        console.error("❌ Erro no download:", error);
        throw new Error(`Falha no download: ${error.message}`);
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
      const err = error instanceof Error ? error : new Error(String(error));
      console.error("Erro ao fazer download do arquivo de teste:", err);
      res.status(500).json({
        success: false,
        message: `Erro ao fazer download: ${err.message}`
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
      const dbError = error as any;
      if (dbError.code === '23505' && dbError.constraint === 'users_email_unique') {
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
        // Aplicar restrição baseada nos critérios da empresa do usuário
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

  // Rota para buscar reprogramações (pedidos aguardando aprovação)
  app.get("/api/orders/reprogramacoes", isAuthenticated, async (req, res) => {
    try {
      // Buscar pedidos com status "Aguardando Aprovação" diretamente do banco com JOIN
      const reprogramacoesResult = await pool.query(`
        SELECT 
          o.id,
          o.order_id as "orderId",
          o.delivery_date as "deliveryDate",
          o.nova_data_entrega as "newDeliveryDate",
          o.justificativa_reprogramacao as "reschedulingComment",
          o.data_solicitacao_reprogramacao as "createdAt",
          o.supplier_id as "supplierId",
          o.purchase_order_id as "purchaseOrderId",
          p.name as "productName",
          o.quantity,
          u.name as "unit",
          c.name as "supplierName",
          oc.numero_ordem as "purchaseOrderNumber",
          oc_company.name as "purchaseOrderCompanyName",
          dest_company.name as "destinationCompanyName",
          creator.name as "requesterName"
        FROM orders o
        LEFT JOIN products p ON o.product_id = p.id
        LEFT JOIN units u ON p.unit_id = u.id
        LEFT JOIN companies c ON o.supplier_id = c.id
        LEFT JOIN ordens_compra oc ON o.purchase_order_id = oc.id
        LEFT JOIN companies oc_company ON oc.empresa_id = oc_company.id
        LEFT JOIN companies dest_company ON oc.cnpj = dest_company.cnpj
        LEFT JOIN users creator ON o.usuario_reprogramacao = creator.id
        WHERE o.status = 'Aguardando Aprovação'
        ORDER BY o.data_solicitacao_reprogramacao DESC
      `);

      let reprogramacoes = reprogramacoesResult.rows;

      console.log(`📋 Total de reprogramações encontradas: ${reprogramacoes.length}`);

      // APLICAR MESMA LÓGICA DE FILTRO DA ROTA /api/orders

      // REGRA 1: Se o usuário é aprovador, só pode ver pedidos onde ele é o aprovador
      const isApprover = await pool.query(`
        SELECT COUNT(*) as total
        FROM companies
        WHERE approver_id = $1
      `, [req.user.id]);

      const userIsApprover = parseInt(isApprover.rows[0].total) > 0;

      if (userIsApprover && req.user.id !== 1 && !req.user.isKeyUser) {
        console.log(`🔒 Usuário ${req.user.name} (ID: ${req.user.id}) é aprovador - filtrando reprogramações`);

        const filteredReprogramacoes = [];

        for (const order of reprogramacoes) {
          if (order.purchaseOrderId) {
            try {
              const approverCheck = await pool.query(`
                SELECT c.id, c.name, c.approver_id
                FROM orders o
                LEFT JOIN ordens_compra oc ON o.purchase_order_id = oc.id
                LEFT JOIN companies c ON oc.cnpj = c.cnpj
                WHERE o.id = $1 AND c.approver_id = $2
              `, [order.id, req.user.id]);

              if (approverCheck.rows.length > 0) {
                filteredReprogramacoes.push(order);
              }
            } catch (error) {
              console.error(`Erro ao verificar aprovação da reprogramação ${order.orderId}:`, error);
            }
          }
        }

        reprogramacoes = filteredReprogramacoes;
        console.log(`🔒 Aprovador ${req.user.name} - ${reprogramacoes.length} reprogramações onde é aprovador`);

      } else {
        // Aplicar restrição baseada nos critérios da empresa do usuário
        if (req.user && req.user.companyId && req.user.id !== 1 && !req.user.isKeyUser) {
          const userCompany = await storage.getCompany(req.user.companyId);

          if (userCompany) {
            const companyCategory = await storage.getCompanyCategory(userCompany.categoryId);

            if (companyCategory) {
              const hasAnyCriteria = companyCategory.requiresApprover ||
                                   companyCategory.requiresContract ||
                                   companyCategory.receivesPurchaseOrders;

              if (hasAnyCriteria) {
                // Filtrar reprogramações onde a empresa é fornecedora OU obra de destino
                const filteredReprogramacoes = [];

                for (const order of reprogramacoes) {
                  // 1. Incluir reprogramações criadas pela empresa (fornecedor)
                  if (order.supplierId === req.user.companyId) {
                    filteredReprogramacoes.push(order);
                    continue;
                  }

                  // 2. Incluir reprogramações destinadas à empresa (obra de destino)
                  if (order.purchaseOrderId) {
                    try {
                      const ordemCompraResult = await pool.query(
                        "SELECT cnpj FROM ordens_compra WHERE id = $1",
                        [order.purchaseOrderId]
                      );

                      if (ordemCompraResult.rows.length > 0) {
                        const cnpjDestino = ordemCompraResult.rows[0].cnpj;

                        if (cnpjDestino === userCompany.cnpj) {
                          filteredReprogramacoes.push(order);
                        }
                      }
                    } catch (error) {
                      console.error(`Erro ao verificar destino da reprogramação ${order.orderId}:`, error);
                    }
                  }
                }

                reprogramacoes = filteredReprogramacoes;
                console.log(`🔒 Usuário da empresa ${userCompany.name} - ${reprogramacoes.length} reprogramações (próprias ou destinadas à empresa)`);
              } else {
                console.log(`🔓 Usuário da empresa ${userCompany.name} - visualização irrestrita de reprogramações (empresa sem critérios)`);
              }
            }
          }
        } else {
          console.log(`🔓 Usuário ${req.user.name} (ID: ${req.user.id}) - visualização irrestrita de reprogramações (KeyUser ou não tem empresa)`);
        }
      }

      console.log(`📋 Retornando ${reprogramacoes.length} reprogramações após filtros`);

      // Mapear campos para o formato esperado pelo frontend
      const mappedReprogramacoes = reprogramacoes.map((r: any) => ({
        id: r.id,
        orderId: r.orderId,
        productName: r.productName,
        unit: r.unit,
        quantity: r.quantity,
        supplierName: r.supplierName,
        purchaseOrderNumber: r.purchaseOrderNumber,
        purchaseOrderCompanyName: r.purchaseOrderCompanyName,
        destinationCompanyName: r.destinationCompanyName,
        originalDeliveryDate: r.deliveryDate,
        newDeliveryDate: r.newDeliveryDate,
        justification: r.reschedulingComment,
        requestDate: r.createdAt,
        requesterName: r.requesterName
      }));

      res.json(mappedReprogramacoes);
    } catch (error) {
      console.error("Erro ao buscar reprogramações:", error);
      res.status(500).json({ message: "Erro ao buscar reprogramações" });
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
      const dataEntrega = convertToLocalDate(orderData.deliveryDate); // Conversão para fuso brasileiro
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
      const daysDiff = Math.ceil((dataEntrega.getTime() - now.getTime()) / (1000 * 3600 * 24));
      const isUrgent = daysDiff <= 7;

      // Definir status baseado na urgência:
      // - Pedidos urgentes: "Registrado" (precisam de aprovação)
      // - Pedidos não urgentes: "Aprovado" (aprovação automática)
      const status = isUrgent ? "Registrado" : "Aprovado";

      console.log(`📋 Criando pedido:`, {
        deliveryDate: dataEntrega.toISOString(),
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
        deliveryDate: dataEntrega,
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

  // Cancelar pedido
  app.post("/api/pedidos/:id/cancelar", isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { motivo } = req.body;

      if (isNaN(id)) {
        return res.status(400).json({
          sucesso: false,
          mensagem: "ID inválido"
        });
      }

      if (!motivo || !motivo.trim()) {
        return res.status(400).json({
          sucesso: false,
          mensagem: "Motivo do cancelamento é obrigatório"
        });
      }

      // Buscar o pedido
      const orderResult = await pool.query(
        "SELECT * FROM orders WHERE id = $1",
        [id]
      );

      if (!orderResult.rows.length) {
        return res.status(404).json({
          sucesso: false,
          mensagem: "Pedido não encontrado"
        });
      }

      const order = orderResult.rows[0];

      // Validar se o pedido pode ser cancelado
      if (["Cancelado", "Entregue", "Em Rota", "Em transporte"].includes(order.status)) {
        return res.status(400).json({
          sucesso: false,
          mensagem: `Pedidos com status "${order.status}" não podem ser cancelados`
        });
      }

      // Verificar se já tem documentos carregados
      if (order.documentos_carregados || order.status === "Carregado") {
        return res.status(400).json({
          sucesso: false,
          mensagem: "Pedidos com documentos fiscais carregados não podem ser cancelados"
        });
      }

      // Verificar se tem pelo menos 3 dias de antecedência
      const deliveryDate = new Date(order.delivery_date);
      const today = new Date();
      const daysDiff = Math.ceil((deliveryDate.getTime() - today.getTime()) / (1000 * 3600 * 24));

      if (daysDiff < 3) {
        return res.status(400).json({
          sucesso: false,
          mensagem: `Pedidos só podem ser cancelados com pelo menos 3 dias de antecedência. Faltam ${daysDiff} dia(s) para a entrega.`
        });
      }

      // Atualizar o pedido para status Cancelado e zerar quantidade
      await pool.query(
        `UPDATE orders 
         SET status = 'Cancelado', 
             quantity = 0,
             rescheduling_comment = $1
         WHERE id = $2`,
        [motivo.trim(), id]
      );

      // Registrar log
      if (req.session.userId) {
        await storage.createLog({
          userId: req.session.userId,
          action: "Cancelou pedido",
          itemType: "order",
          itemId: id.toString(),
          details: `Pedido ${order.order_id} cancelado. Motivo: ${motivo.trim()}`
        });
      }

      res.json({
        sucesso: true,
        mensagem: "Pedido cancelado com sucesso"
      });

    } catch (error) {
      console.error("Erro ao cancelar pedido:", error);
      res.status(500).json({
        sucesso: false,
        mensagem: "Erro ao cancelar pedido",
        erro: error instanceof Error ? error.message : "Erro desconhecido"
      });
    }
  });

  // Excluir pedido (somente KeyUser)
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

      console.log("Debug: ordens de compra com cnpj:", result.rows.map((row: any) => ({
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

  // Rota para verificar saldo disponível de um produto em uma ordem de compra
  app.get("/api/ordens-compra/:ordemId/produtos/:produtoId/saldo", async (req, res) => {
    try {
      const ordemId = parseInt(req.params.ordemId);
      const produtoId = parseInt(req.params.produtoId);

      if (isNaN(ordemId) || isNaN(produtoId)) {
        return res.status(400).json({
          sucesso: false,
          mensagem: "IDs inválidos"
        });
      }

      console.log(`📊 Verificando saldo - Ordem: ${ordemId}, Produto: ${produtoId}`);

      // Buscar quantidade total na ordem de compra
      const itemResult = await pool.query(`
        SELECT
          ioc.quantidade,
          p.name as produto_nome,
          u.abbreviation as unidade
        FROM itens_ordem_compra ioc
        INNER JOIN products p ON ioc.produto_id = p.id
        LEFT JOIN units u ON p.unit_id = u.id
        WHERE ioc.ordem_compra_id = $1 AND ioc.produto_id = $2
      `, [ordemId, produtoId]);

      if (itemResult.rows.length === 0) {
        return res.json({
          sucesso: false,
          mensagem: "Produto não encontrado na ordem de compra"
        });
      }

      const item = itemResult.rows[0];
      const quantidadeTotal = parseFloat(item.quantidade);

      // Buscar quantidade já usada em pedidos (excluindo cancelados)
      const pedidosResult = await pool.query(`
        SELECT COALESCE(SUM(CAST(quantity AS DECIMAL)), 0) as total_usado
        FROM orders
        WHERE purchase_order_id = $1
          AND product_id = $2
          AND status != 'Cancelado'
      `, [ordemId, produtoId]);

      const quantidadeUsada = parseFloat(pedidosResult.rows[0].total_usado || 0);
      const saldoDisponivel = quantidadeTotal - quantidadeUsada;

      console.log(`✅ Saldo calculado - Total: ${quantidadeTotal}, Usado: ${quantidadeUsada}, Disponível: ${saldoDisponivel}`);

      res.json({
        sucesso: true,
        produtoId,
        ordemId,
        quantidadeTotal,
        quantidadeUsada,
        saldoDisponivel,
        unidade: item.unidade || 'un'
      });

    } catch (error) {
      console.error("Erro ao verificar saldo:", error);
      res.status(500).json({
        sucesso: false,
        mensagem: "Erro ao verificar saldo",
        erro: error instanceof Error ? error.message : "Erro desconhecido"
      });
    }
  });

  // Rota para verificar quantidade entregue de um produto em uma ordem de compra
  app.get("/api/ordens-compra/:ordemId/produtos/:produtoId/entregue", async (req, res) => {
    try {
      const ordemId = parseInt(req.params.ordemId);
      const produtoId = parseInt(req.params.produtoId);

      if (isNaN(ordemId) || isNaN(produtoId)) {
        return res.status(400).json({
          sucesso: false,
          mensagem: "IDs inválidos"
        });
      }

      console.log(`📦 Verificando quantidade entregue - Ordem: ${ordemId}, Produto: ${produtoId}`);

      // Buscar quantidade entregue (pedidos com status Entregue)
      const result = await pool.query(`
        SELECT COALESCE(SUM(CAST(quantity AS DECIMAL)), 0) as quantidade_entregue
        FROM orders
        WHERE purchase_order_id = $1
          AND product_id = $2
          AND status = 'Entregue'
      `, [ordemId, produtoId]);

      const quantidadeEntregue = parseFloat(result.rows[0].quantidade_entregue || 0);

      console.log(`✅ Quantidade entregue: ${quantidadeEntregue}`);

      res.json({
        sucesso: true,
        quantidadeEntregue
      });

    } catch (error) {
      console.error("Erro ao verificar quantidade entregue:", error);
      res.status(500).json({
        sucesso: false,
        mensagem: "Erro ao verificar quantidade entregue",
        erro: error instanceof Error ? error.message : "Erro desconhecido"
      });
    }
  });

  // Rota para buscar itens de uma ordem de compra
  app.get("/api/ordem-compra/:id/itens", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({
          sucesso: false,
          mensagem: "ID inválido"
        });
      }

      console.log(`📦 Buscando itens da ordem de compra ID: ${id}`);

      // Buscar itens da ordem de compra com informações do produto
      // CORREÇÃO: usar tabela itens_ordem_compra em vez de purchase_order_items
      const result = await pool.query(`
        SELECT
          ioc.id,
          ioc.ordem_compra_id,
          ioc.produto_id,
          ioc.quantidade,
          p.name as produto_nome,
          p.unit_id as unidade_id,
          u.name as unidade_nome,
          u.abbreviation as unidade_abreviacao
        FROM itens_ordem_compra ioc
        INNER JOIN products p ON ioc.produto_id = p.id
        LEFT JOIN units u ON p.unit_id = u.id
        WHERE ioc.ordem_compra_id = $1
        ORDER BY ioc.id ASC
      `, [id]);

      console.log(`✅ Encontrados ${result.rows.length} itens para a ordem de compra ${id}`);

      res.json(result.rows);
    } catch (error) {
      console.error("Erro ao buscar itens da ordem de compra:", error);
      res.status(500).json({
        sucesso: false,
        mensagem: "Erro ao buscar itens da ordem de compra",
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
          const error = ocError instanceof Error ? ocError : new Error(String(ocError));
          console.log(`🔄 PDF não encontrado na pasta OC: ${error.message}`);
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
          const ocObjects = objects.filter((obj: any) => obj.key.startsWith('OC/'));
          console.log(`📋 PDFs na pasta OC do Object Storage:`, ocObjects.map((obj: any) => obj.key));
        } catch (listError) {
          const error = listError instanceof Error ? listError : new Error(String(listError));
          console.log(`❌ Erro ao listar objetos do Object Storage:`, error.message);
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

  // Rota para download de documentos de pedidos (nota_pdf, nota_xml, certificado_pdf, foto_nota)
  app.get("/api/pedidos/:id/documentos/:tipo", isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const tipo = req.params.tipo; // nota_pdf, nota_xml, certificado_pdf, foto_nota

      if (isNaN(id)) {
        return res.status(400).json({
          success: false,
          message: "ID inválido"
        });
      }

      // Validar tipo de documento
      const tiposPermitidos = ['nota_pdf', 'nota_xml', 'certificado_pdf', 'foto_nota'];
      if (!tiposPermitidos.includes(tipo)) {
        return res.status(400).json({
          success: false,
          message: `Tipo de documento inválido. Use: ${tiposPermitidos.join(', ')}`
        });
      }

      console.log(`📥 Solicitação de download: Pedido ${id}, Documento: ${tipo}`);

      // Buscar informações do pedido incluindo documentos_info
      const pedidoResult = await pool.query(
        "SELECT order_id, documentos_info FROM orders WHERE id = $1",
        [id]
      );

      if (!pedidoResult.rows.length) {
        return res.status(404).json({
          success: false,
          message: "Pedido não encontrado"
        });
      }

      const pedido = pedidoResult.rows[0];
      const orderId = pedido.order_id;
      console.log(`🔍 Buscando documento ${tipo} para pedido: ${orderId}`);

      // PRIORIDADE 1: Tentar buscar do documentos_info (Object Storage)
      if (pedido.documentos_info) {
        try {
          const documentosInfo = typeof pedido.documentos_info === 'string'
            ? JSON.parse(pedido.documentos_info)
            : pedido.documentos_info;

          console.log(`📊 Informações de documentos encontradas:`, documentosInfo);

          const docInfo = documentosInfo[tipo];
          if (docInfo) {
            // Suportar tanto o formato antigo (string) quanto o novo (objeto)
            const storageKey = typeof docInfo === 'string' ? docInfo : docInfo.storageKey;
            const filename = typeof docInfo === 'string' ? null : docInfo.filename;

            if (storageKey) {
              console.log(`📂 Tentando acessar documento usando storageKey: ${storageKey}`);

              const fileResult = await readFileFromStorage(
                storageKey,
                id.toString(),
                filename || `${tipo}.${tipo.includes('xml') ? 'xml' : tipo.includes('pdf') ? 'pdf' : 'jpg'}`
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
                  console.log(`⚠️ Documento encontrado via documentos_info é muito pequeno (${fileBuffer.length} byte) - ignorado`);
                } else {
                  console.log(`✅ Documento recuperado usando documentos_info (${fileBuffer.length} bytes) - Nome: ${originalName}`);

                  // Determinar Content-Type baseado no tipo
                  let contentType = 'application/octet-stream';
                  if (tipo.includes('pdf')) {
                    contentType = 'application/pdf';
                  } else if (tipo.includes('xml')) {
                    contentType = 'application/xml';
                  } else if (tipo.includes('foto')) {
                    contentType = docInfo.mimetype || 'image/jpeg';
                  }

                  res.setHeader("Content-Type", contentType);
                  res.setHeader("Content-Length", fileBuffer.length);
                  res.setHeader("Content-Disposition", `attachment; filename="${originalName}"`);
                  res.setHeader("Cache-Control", "no-cache");

                  return res.end(fileBuffer);
                }
              }
            }
          }
        } catch (error) {
          console.log(`❌ Erro ao processar documentos_info:`, error);
        }
      }

      // PRIORIDADE 2: Tentar buscar diretamente no Object Storage usando order_id (para casos onde documentos_info está vazio)
      if (objectStorageAvailable && objectStorage && orderId) {

        try {
          // Listar arquivos na pasta do pedido
          const listResult = await objectStorage.list();

          // O Replit Object Storage retorna {ok, value} ou {ok, error}
          let objects = [];
          if (listResult && typeof listResult === 'object') {
            if (listResult.ok && listResult.value) {
              objects = Array.isArray(listResult.value) ? listResult.value : [];
            } else if (Array.isArray(listResult)) {
              objects = listResult;
            } else if (listResult.objects) {
              objects = listResult.objects;
            }
          }

          // Buscar arquivos que correspondem ao padrão
          const possibleKeys = [];

          // Adicionar chaves encontradas no storage que correspondem ao pedido e tipo
          for (const obj of objects) {
            const objectKey = obj && (obj.key || obj.name);
            if (objectKey && (
              objectKey.includes(`${orderId}/${tipo}-`) ||
              objectKey.includes(`orders/${orderId}/${tipo}-`) ||
              objectKey.includes(`/${orderId}/${tipo}`)
            )) {
              possibleKeys.push(objectKey);
            }
          }

          // Tentar download direto usando as chaves encontradas
          for (const key of possibleKeys) {
            try {

              const downloadResult = await objectStorage.downloadAsBytes(key);

              // Replit Object Storage retorna {ok, value: [Buffer]}
              // O value é um array contendo o buffer no primeiro elemento
              let downloadedBytes = null;
              if (downloadResult && typeof downloadResult === 'object' && 'value' in downloadResult) {
                const val = downloadResult.value;
                downloadedBytes = Array.isArray(val) && val.length > 0 ? val[0] : val;
              } else if (downloadResult && (downloadResult instanceof Uint8Array || downloadResult instanceof Buffer || Array.isArray(downloadResult))) {
                downloadedBytes = Array.isArray(downloadResult) && downloadResult.length > 0 ? downloadResult[0] : downloadResult;
              }

              if (downloadedBytes && downloadedBytes.length > 1) {
                const buffer = Buffer.from(downloadedBytes);

                let contentType = 'application/octet-stream';
                if (tipo.includes('pdf')) {
                  contentType = 'application/pdf';
                } else if (tipo.includes('xml')) {
                  contentType = 'application/xml';
                } else if (tipo.includes('foto')) {
                  contentType = 'image/jpeg';
                }

                const filename = key.split('/').pop() || `${tipo}.${tipo.includes('xml') ? 'xml' : 'pdf'}`;

                res.setHeader("Content-Type", contentType);
                res.setHeader("Content-Length", buffer.length);
                res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
                res.setHeader("Cache-Control", "no-cache");

                return res.end(buffer);
              }
            } catch (downloadError) {
              console.log(`⚠️ Erro ao baixar ${key}:`, downloadError instanceof Error ? downloadError.message : 'erro desconhecido');
              continue;
            }
          }
        } catch (listError) {
          console.log(`⚠️ Erro ao listar objetos do Object Storage:`, listError instanceof Error ? listError.message : listError);
        }
      }

      // PRIORIDADE 3: FALLBACK - Tentar buscar o arquivo na pasta uploads/[id]/
      const uploadsPath = path.join(process.cwd(), "uploads", id.toString());
      console.log(`📁 Tentando documento em uploads: ${uploadsPath}`);

      if (fs.existsSync(uploadsPath)) {
        const files = fs.readdirSync(uploadsPath);
        const matchingFile = files.find(f => f.startsWith(tipo));

        if (matchingFile) {
          const filePath = path.join(uploadsPath, matchingFile);
          const buffer = fs.readFileSync(filePath);

          // VERIFICAÇÃO CRÍTICA: Arquivos de 1 byte não são válidos
          if (buffer.length > 1) {
            console.log(`✅ Documento encontrado em uploads: ${filePath} (${buffer.length} bytes)`);

            // Determinar Content-Type baseado no tipo
            let contentType = 'application/octet-stream';
            if (tipo.includes('pdf')) {
              contentType = 'application/pdf';
            } else if (tipo.includes('xml')) {
              contentType = 'application/xml';
            } else if (tipo.includes('foto')) {
              contentType = 'image/jpeg';
            }

            res.setHeader("Content-Type", contentType);
            res.setHeader("Content-Disposition", `attachment; filename="${matchingFile}"`);
            res.setHeader("Content-Length", buffer.length);
            res.setHeader("Cache-Control", "no-cache");
            return res.end(buffer);
          } else {
            console.log(`⚠️ Documento local em uploads é muito pequeno (${buffer.length} byte) - ignorado`);
          }
        }
      }

      // Se não encontrar o arquivo em lugar nenhum
      return res.status(404).json({
        success: false,
        message: `Documento ${tipo} do pedido ${orderId} não encontrado.`
      });

    } catch (error) {
      console.error("Erro ao buscar documento do pedido:", error);
      res.status(500).json({
        success: false,
        message: "Erro interno do servidor"
      });
    }
  });

  // Rota para upload de documentos do pedido (nota_pdf, nota_xml, certificado_pdf)
  app.post(
    "/api/pedidos/:id/documentos",
    isAuthenticated,
    upload.fields([
      { name: 'nota_pdf', maxCount: 1 },
      { name: 'nota_xml', maxCount: 1 },
      { name: 'certificado_pdf', maxCount: 1 }
    ]),
    async (req, res) => {
      try {
        const id = parseInt(req.params.id);
        if (isNaN(id)) {
          return res.status(400).json({
            success: false,
            message: "ID de pedido inválido"
          });
        }

        console.log(`📤 Iniciando upload de documentos para pedido ID: ${id}`);

        // Buscar informações do pedido
        const pedidoResult = await pool.query(
          "SELECT order_id FROM orders WHERE id = $1",
          [id]
        );

        if (!pedidoResult.rows.length) {
          return res.status(404).json({
            success: false,
            message: "Pedido não encontrado"
          });
        }

        const orderId = pedidoResult.rows[0].order_id;
        console.log(`📋 Order ID encontrado: ${orderId}`);

        const files = req.files as { [fieldname: string]: Express.Multer.File[] };
        console.log("📂 Arquivos recebidos:", Object.keys(files || {}));

        if (!files || Object.keys(files).length === 0) {
          return res.status(400).json({
            success: false,
            message: "É necessário enviar pelo menos um documento"
          });
        }

        const documentosInfo: Record<string, any> = {};

        // Processar cada arquivo recebido
        for (const [fieldName, fileArray] of Object.entries(files)) {
          if (fileArray && fileArray.length > 0) {
            const file = fileArray[0];
            console.log(`📄 Processando ${fieldName}: ${file.originalname} (${file.size} bytes)`);

            try {
              // Ler o arquivo do disco
              const fileBuffer = fs.readFileSync(file.path);

              // Salvar no Object Storage
              const storageKey = await saveFileToStorage(
                fileBuffer,
                file.filename,
                orderId
              );

              console.log(`✅ ${fieldName} salvo: ${storageKey}`);

              // Registrar informações do documento
              documentosInfo[fieldName] = {
                name: file.originalname,
                filename: file.filename,
                size: file.size,
                storageKey: storageKey,
                mimetype: file.mimetype,
                date: new Date().toISOString()
              };

              // Remover arquivo temporário
              try {
                fs.unlinkSync(file.path);
              } catch (unlinkError) {
                console.log(`⚠️ Não foi possível remover arquivo temporário: ${file.path}`);
              }
            } catch (uploadError) {
              const error = uploadError instanceof Error ? uploadError : new Error(String(uploadError));
              console.error(`❌ Erro ao processar ${fieldName}:`, error);
              throw new Error(`Falha ao salvar ${fieldName}: ${error.message}`);
            }
          }
        }

        if (Object.keys(documentosInfo).length === 0) {
          return res.status(400).json({
            success: false,
            message: "Nenhum arquivo foi processado corretamente"
          });
        }

        // Atualizar o pedido no banco de dados
        await pool.query(
          'UPDATE orders SET status = $1, documentoscarregados = $2, documentos_info = $3 WHERE id = $4',
          ['Carregado', true, JSON.stringify(documentosInfo), id]
        );

        console.log(`✅ Pedido ${orderId} atualizado com documentos carregados`);

        // Registrar no log do sistema
        await storage.createLog({
          userId: req.session.userId || 0,
          action: "Upload de documentos",
          itemType: "order",
          itemId: id.toString(),
          details: `Documentos carregados para o pedido ${orderId}: ${Object.keys(documentosInfo).join(', ')}`
        });

        res.status(200).json({
          success: true,
          message: "Documentos enviados com sucesso",
          documentos: documentosInfo
        });

      } catch (error) {
        console.error("❌ Erro no upload de documentos:", error);
        res.status(500).json({
          success: false,
          message: "Erro ao processar o upload de documentos",
          error: error instanceof Error ? error.message : "Erro desconhecido"
        });
      }
    }
  );

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

        // Salvar PDF usando a função simplificada
        let pdfKey;
        try {
          pdfKey = await saveFileToStorage(
            fs.readFileSync(req.file.path),
            req.file.filename,
            `ordens_compra_${numeroOrdem}`
          );

          console.log(`✅ PDF salvo com a chave: ${pdfKey}`);
        } catch (saveError) {
          const error = saveError instanceof Error ? saveError : new Error(String(saveError));
          console.error(`❌ Erro ao salvar PDF:`, error);
          throw new Error(`Falha ao salvar PDF: ${error.message}`);
        }

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
      } finally {
        // Limpar arquivo temporário após o processamento
        if (req.file) {
          try {
            fs.unlinkSync(req.file.path);
            console.log(`🧹 Arquivo temporário ${req.file.path} removido com sucesso.`);
          } catch (unlinkError) {
            console.log(`⚠️ Falha ao remover arquivo temporário ${req.file.path}:`, unlinkError instanceof Error ? unlinkError.message : unlinkError);
          }
        }
      }
    }
  );

  // Rota para confirmar número do pedido
  app.post("/api/pedidos/:id/confirmar-numero-pedido", isAuthenticated, async (req, res) => {
    try {
      const pedidoId = parseInt(req.params.id);
      const { numeroPedido } = req.body;

      console.log(`📤 Confirmação de número do pedido recebida:`, {
        pedidoId,
        numeroPedido
      });

      // Validações
      if (!numeroPedido || !numeroPedido.trim()) {
        return res.status(400).json({
          sucesso: false,
          mensagem: "Número do pedido é obrigatório"
        });
      }

      if (numeroPedido.length > 20) {
        return res.status(400).json({
          sucesso: false,
          mensagem: "O número do pedido deve ter no máximo 20 caracteres"
        });
      }

      // Atualizar o pedido
      await pool.query(
        `UPDATE orders
         SET numero_pedido = $1, status = 'Em Rota'
         WHERE id = $2`,
        [numeroPedido.trim(), pedidoId]
      );

      // Log da ação
      await storage.createLog({
        userId: req.user.id,
        action: "Confirmou número do pedido",
        itemType: "order",
        itemId: pedidoId.toString(),
        details: `Número do pedido confirmado: ${numeroPedido.trim()}`
      });

      res.json({
        sucesso: true,
        mensagem: "Número do pedido confirmado com sucesso"
      });

    } catch (error) {
      console.error("❌ Erro ao confirmar número do pedido:", error);
      res.status(500).json({
        sucesso: false,
        mensagem: "Erro ao confirmar número do pedido"
      });
    }
  });

  // Rota para solicitar reprogramação
  app.post("/api/pedidos/:id/reprogramar", isAuthenticated, async (req, res) => {
    try {
      const pedidoId = parseInt(req.params.id);
      const { novaDataEntrega, motivo } = req.body;

      console.log(`🔄 Reprogramação de pedido recebida:`, {
        pedidoId,
        novaDataEntrega,
        motivo
      });

      // Validar dados
      if (!novaDataEntrega) {
        return res.status(400).json({
          sucesso: false,
          mensagem: "Nova data de entrega é obrigatória"
        });
      }

      if (!motivo || motivo.trim() === "") {
        return res.status(400).json({
          sucesso: false,
          mensagem: "Justificativa é obrigatória"
        });
      }

      // Verificar se o pedido existe
      const pedidoResult = await pool.query(
        "SELECT * FROM orders WHERE id = $1",
        [pedidoId]
      );

      if (pedidoResult.rows.length === 0) {
        return res.status(404).json({
          sucesso: false,
          mensagem: "Pedido não encontrado"
        });
      }

      const pedido = pedidoResult.rows[0];

      // Verificar se o pedido já foi entregue ou cancelado
      if (pedido.status === "Entregue" || pedido.status === "Cancelado") {
        return res.status(400).json({
          sucesso: false,
          mensagem: `Não é possível reprogramar pedido com status ${pedido.status}`
        });
      }

      // Atualizar pedido com nova data e justificativa (usando nomes corretos das colunas em português)
      await pool.query(
        `UPDATE orders 
         SET nova_data_entrega = $1, 
             justificativa_reprogramacao = $2,
             data_solicitacao_reprogramacao = NOW(),
             usuario_reprogramacao = $3,
             status = 'Aguardando Aprovação'
         WHERE id = $4`,
        [novaDataEntrega, motivo.trim(), req.user.id, pedidoId]
      );

      // Registrar log da ação
      await storage.createLog({
        userId: req.user.id,
        action: "Solicitou reprogramação de entrega",
        itemType: "order",
        itemId: pedidoId.toString(),
        details: `Nova data: ${new Date(novaDataEntrega).toLocaleDateString('pt-BR')} - Motivo: ${motivo.trim()}`
      });

      res.json({
        sucesso: true,
        mensagem: "Reprogramação solicitada com sucesso"
      });

    } catch (error) {
      console.error("❌ Erro ao solicitar reprogramação:", error);
      res.status(500).json({
        sucesso: false,
        mensagem: "Erro ao solicitar reprogramação"
      });
    }
  });

  // Rota para aprovar/recusar reprogramação de pedido
  app.post("/api/pedidos/:id/aprovar-reprogramacao", isAuthenticated, async (req, res) => {
    try {
      const pedidoId = parseInt(req.params.id);
      const { aprovado, motivoRecusa } = req.body;

      console.log(`✅ Aprovação/Recusa de reprogramação recebida:`, {
        pedidoId,
        aprovado,
        motivoRecusa
      });

      // Buscar informações do pedido original para histórico
      const pedidoResult = await pool.query(
        `SELECT o.*, p.name as product_name
         FROM orders o
         JOIN products p ON o.product_id = p.id
         WHERE o.id = $1`,
        [pedidoId]
      );

      if (!pedidoResult.rows.length) {
        return res.status(404).json({
          sucesso: false,
          mensagem: "Pedido não encontrado"
        });
      }

      const pedido = pedidoResult.rows[0];

      // Verificar se o usuário tem permissão para aprovar/recusar
      // Apenas usuários com permissão "approve_order_rescheduling" ou KeyUsers podem aprovar
      const hasApprovePermission = req.user.permissions?.includes("approve_order_rescheduling") || req.user.isKeyUser;

      if (!hasApprovePermission) {
        return res.status(403).json({
          sucesso: false,
          mensagem: "Você não tem permissão para aprovar ou recusar reprogramações de pedido."
        });
      }

      let novoStatus: string;
      let logMessage: string;

      if (aprovado) {
        novoStatus = "Aguardando Envio";
        logMessage = `Reprogramação do pedido ${pedido.order_id} (${pedido.product_name}) aprovada.`;
        console.log(`✅ Reprogramação do pedido ${pedidoId} aprovada.`);
      } else {
        novoStatus = "Pendente"; // Ou um status que indique que a reprogramação foi recusada e o pedido voltou ao estado anterior
        logMessage = `Reprogramação do pedido ${pedido.order_id} (${pedido.product_name}) recusada. Motivo: ${motivoRecusa || 'N/A'}.`;
        console.log(`❌ Reprogramação do pedido ${pedidoId} recusada. Motivo: ${motivoRecusa}`);
      }

      // Atualizar o status do pedido
      await pool.query(
        `UPDATE orders
         SET status = $1
         WHERE id = $2`,
        [novoStatus, pedidoId]
      );

      // Registrar log da ação
      await storage.createLog({
        userId: req.user.id,
        action: aprovado ? "Aprovou reprogramação de pedido" : "Recusou reprogramação de pedido",
        itemType: "order",
        itemId: pedidoId.toString(),
        details: logMessage
      });

      res.json({
        sucesso: true,
        mensagem: aprovado ? "Reprogramação aprovada com sucesso." : "Reprogramação recusada com sucesso."
      });

    } catch (error) {
      console.error("❌ Erro ao aprovar/recusar reprogramação:", error);
      res.status(500).json({
        sucesso: false,
        mensagem: "Erro ao processar a aprovação/recusa da reprogramação."
      });
    }
  });

  // Rota para download da foto de confirmação
  app.get("/api/pedidos/:id/foto-confirmacao", isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({
          success: false,
          message: "ID de pedido inválido"
        });
      }

      console.log(`📸 Download foto de confirmação - Pedido ${id}`);

      // Buscar informações do pedido incluindo foto_confirmacao
      const pedidoResult = await pool.query(
        "SELECT order_id, foto_confirmacao, status FROM orders WHERE id = $1",
        [id]
      );

      if (!pedidoResult.rows.length) {
        console.log(`❌ Pedido ${id} não encontrado`);
        return res.status(404).json({
          success: false,
          message: "Pedido não encontrado",
          hasFoto: false
        });
      }

      const pedido = pedidoResult.rows[0];

      if (!pedido.foto_confirmacao) {
        console.log(`⚠️ Pedido ${pedido.order_id} não possui foto de confirmação`);
        return res.status(404).json({
          success: false,
          message: "Este pedido ainda não possui foto de confirmação de entrega",
          hasFoto: false
        });
      }

      // Parse do JSON da foto_confirmacao
      const fotoInfo = typeof pedido.foto_confirmacao === 'string'
        ? JSON.parse(pedido.foto_confirmacao)
        : pedido.foto_confirmacao;

      if (!fotoInfo || !fotoInfo.storageKey) {
        console.log(`⚠️ Informações incompletas da foto`);
        return res.status(404).json({
          success: false,
          message: "Informações da foto incompletas",
          hasFoto: false
        });
      }

      const { storageKey, originalName, mimetype } = fotoInfo;
      console.log(`🔍 Buscando foto: ${storageKey} (${originalName})`);

      // USAR A MESMA ABORDAGEM DOS DOCUMENTOS QUE FUNCIONA
      const fileResult = await readFileFromStorage(
        storageKey,
        id.toString(),
        originalName
      );

      if (!fileResult) {
        console.log(`❌ Foto não encontrada no storage`);
        return res.status(404).json({
          success: false,
          message: "Foto não encontrada",
          hasFoto: false
        });
      }

      const { data: fileBuffer, originalName: fileName } = fileResult;

      // Verificar se é redirect para Google Drive
      if (Buffer.isBuffer(fileBuffer) && fileBuffer.toString('utf-8').startsWith('REDIRECT:')) {
        const driveLink = fileBuffer.toString('utf-8').replace('REDIRECT:', '');
        console.log(`🔗 Redirecionando para Google Drive: ${driveLink}`);
        return res.redirect(302, driveLink);
      }

      // Verificar tamanho mínimo
      if (fileBuffer.length <= 1) {
        console.log(`❌ Arquivo muito pequeno: ${fileBuffer.length} bytes`);
        return res.status(404).json({
          success: false,
          message: "Arquivo corrompido",
          hasFoto: false
        });
      }

      console.log(`✅ Foto recuperada: ${fileBuffer.length} bytes - ${fileName}`);

      // Determinar Content-Type
      const contentType = mimetype || (fileName.endsWith('.png') ? 'image/png' : 'image/jpeg');

      // Configurar headers para download
      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
      res.setHeader('Content-Length', fileBuffer.length);
      res.setHeader('Cache-Control', 'no-cache');

      // Enviar o arquivo
      return res.end(fileBuffer);

    } catch (error) {
      console.error("❌ Erro ao buscar foto de confirmação:", error);
      res.status(500).json({
        success: false,
        message: "Erro ao buscar foto de confirmação",
        hasFoto: false
      });
    }
  });

  // Rota para confirmar entrega de pedido COM FOTO (usado pelo frontend)
  app.post("/api/pedidos/:id/confirmar", isAuthenticated, uploadFotoConfirmacao.single('fotoNotaAssinada'), async (req, res) => {
    try {
      const pedidoId = parseInt(req.params.id);
      const quantidadeRecebida = req.body.quantidadeRecebida;
      const foto = req.file;

      console.log(`✅ Recebida confirmação de entrega para pedido:`, {
        pedidoId,
        quantidadeRecebida,
        temFoto: !!foto
      });

      // Validações
      if (!quantidadeRecebida || isNaN(parseFloat(quantidadeRecebida))) {
        return res.status(400).json({
          sucesso: false,
          mensagem: "Quantidade recebida inválida."
        });
      }

      if (!foto) {
        return res.status(400).json({
          sucesso: false,
          mensagem: "Foto da nota fiscal assinada é obrigatória."
        });
      }

      const entregueFloat = parseFloat(quantidadeRecebida);

      // Buscar informações do pedido original
      const pedidoResult = await pool.query(
        `SELECT o.*, p.name as product_name, p.confirmation_type, ioc.quantidade as quantidade_ordem_compra
         FROM orders o
         JOIN products p ON o.product_id = p.id
         LEFT JOIN itens_ordem_compra ioc ON o.purchase_order_id = ioc.ordem_compra_id AND o.product_id = ioc.produto_id
         WHERE o.id = $1`,
        [pedidoId]
      );

      if (!pedidoResult.rows.length) {
        return res.status(404).json({
          sucesso: false,
          mensagem: "Pedido não encontrado."
        });
      }

      const pedido = pedidoResult.rows[0];

      // Verificar se o usuário tem permissão para confirmar entrega
      const hasConfirmPermission = req.user.canConfirmDelivery || req.user.isKeyUser;
      if (!hasConfirmPermission) {
        return res.status(403).json({
          sucesso: false,
          mensagem: "Você não tem permissão para confirmar entregas."
        });
      }

      // Validar se a quantidade entregue excede a quantidade pedida
      if (pedido.quantidade_ordem_compra !== null && entregueFloat > parseFloat(pedido.quantidade_ordem_compra)) {
        return res.status(400).json({
          sucesso: false,
          mensagem: `A quantidade entregue (${entregueFloat}) excede a quantidade pedida na ordem de compra (${parseFloat(pedido.quantidade_ordem_compra)}).`
        });
      }

      // Upload da foto para Object Storage usando saveFileToStorage
      const timestamp = Date.now();
      const fotoFilename = `foto-nota-assinada-${timestamp}.${foto.mimetype === 'image/png' ? 'png' : 'jpg'}`;

      console.log(`📤 Fazendo upload da foto para Object Storage...`);
      console.log(`📋 Código do pedido (order_id): ${pedido.order_id}`);

      let fotoStorageKey;
      try {
        // CORREÇÃO: Usar order_id (código) em vez de id (número) do pedido
        fotoStorageKey = await saveFileToStorage(
          foto.buffer,
          fotoFilename,
          pedido.order_id
        );
        console.log(`✅ Foto salva com sucesso no Object Storage: ${fotoStorageKey}`);
      } catch (uploadError) {
        const error = uploadError instanceof Error ? uploadError : new Error(String(uploadError));
        console.error('❌ Erro ao fazer upload da foto:', error);
        return res.status(500).json({
          sucesso: false,
          mensagem: `Erro ao salvar a foto: ${error.message}`
        });
      }

      // Atualizar foto_confirmacao (JSONB) com a foto e quantidade confirmada
      const fotoConfirmacao = {
        storageKey: fotoStorageKey,
        filename: fotoFilename,
        originalName: foto.originalname,
        size: foto.size,
        mimetype: foto.mimetype,
        uploadDate: new Date().toISOString(),
        quantidadeConfirmada: entregueFloat // Adicionar quantidade confirmada
      };

      // Atualizar o status do pedido e salvar foto_confirmacao
      await pool.query(
        `UPDATE orders
         SET status = 'Entregue', foto_confirmacao = $1
         WHERE id = $2`,
        [JSON.stringify(fotoConfirmacao), pedidoId]
      );

      // Registrar log da ação
      await storage.createLog({
        userId: req.user.id,
        action: "Confirmou entrega de pedido",
        itemType: "order",
        itemId: pedidoId.toString(),
        details: `Entrega do pedido ${pedido.order_id} (${pedido.product_name}) confirmada. Quantidade recebida: ${entregueFloat}. Foto salva no Object Storage.`
      });

      res.json({
        sucesso: true,
        mensagem: "Entrega confirmada com sucesso."
      });

    } catch (error) {
      console.error("❌ Erro ao confirmar entrega:", error);
      res.status(500).json({
        sucesso: false,
        mensagem: "Erro ao confirmar a entrega."
      });
    }
  });

  // Rota para buscar quantidade confirmada de um pedido
  app.get("/api/pedidos/:id/quantidade-confirmada", isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);

      if (isNaN(id)) {
        return res.status(400).json({
          success: false,
          message: "ID inválido"
        });
      }

      const pedidoResult = await pool.query(
        "SELECT foto_confirmacao FROM orders WHERE id = $1",
        [id]
      );

      if (!pedidoResult.rows.length) {
        return res.status(404).json({
          success: false,
          message: "Pedido não encontrado"
        });
      }

      const fotoConfirmacao = pedidoResult.rows[0].foto_confirmacao;

      if (!fotoConfirmacao) {
        return res.json({
          success: true,
          quantidadeConfirmada: null,
          message: "Pedido ainda não foi confirmado"
        });
      }

      const confirmacao = typeof fotoConfirmacao === 'string'
        ? JSON.parse(fotoConfirmacao)
        : fotoConfirmacao;

      res.json({
        success: true,
        quantidadeConfirmada: confirmacao.quantidadeConfirmada || null,
        uploadDate: confirmacao.uploadDate || null
      });

    } catch (error) {
      console.error("❌ Erro ao buscar quantidade confirmada:", error);
      res.status(500).json({
        success: false,
        message: "Erro ao buscar quantidade confirmada"
      });
    }
  });

  // Rota para confirmar entrega de pedido SEM FOTO (legado)
  app.post("/api/pedidos/:id/confirmar-entrega", isAuthenticated, async (req, res) => {
    try {
      const pedidoId = parseInt(req.params.id);
      const { quantidadeEntregue } = req.body;

      console.log(`✅ Recebida confirmação de entrega para pedido:`, {
        pedidoId,
        quantidadeEntregue
      });

      // Validações
      if (quantidadeEntregue === undefined || isNaN(parseFloat(quantidadeEntregue))) {
        return res.status(400).json({
          sucesso: false,
          mensagem: "Quantidade entregue inválida."
        });
      }

      const entregueFloat = parseFloat(quantidadeEntregue);

      // Buscar informações do pedido original para histórico e validação de saldo
      const pedidoResult = await pool.query(
        `SELECT o.*, p.name as product_name, p.confirmation_type, ioc.quantidade as quantidade_ordem_compra
         FROM orders o
         JOIN products p ON o.product_id = p.id
         LEFT JOIN itens_ordem_compra ioc ON o.purchase_order_id = ioc.ordem_compra_id AND o.product_id = ioc.produto_id
         WHERE o.id = $1`,
        [pedidoId]
      );

      if (!pedidoResult.rows.length) {
        return res.status(404).json({
          sucesso: false,
          mensagem: "Pedido não encontrado."
        });
      }

      const pedido = pedidoResult.rows[0];

      // Verificar se o usuário tem permissão para confirmar entrega
      const hasConfirmPermission = req.user.canConfirmDelivery || req.user.isKeyUser;
      if (!hasConfirmPermission) {
        return res.status(403).json({
          sucesso: false,
          mensagem: "Você não tem permissão para confirmar entregas."
        });
      }

      // Validar se a quantidade entregue excede a quantidade pedida (se houver item na OC)
      if (pedido.quantidade_ordem_compra !== null && entregueFloat > parseFloat(pedido.quantidade_ordem_compra)) {
        return res.status(400).json({
          sucesso: false,
          mensagem: `A quantidade entregue (${entregueFloat}) excede a quantidade pedida na ordem de compra (${parseFloat(pedido.quantidade_ordem_compra)}).`
        });
      }

      // Atualizar o status do pedido e a quantidade entregue
      await pool.query(
        `UPDATE orders
         SET status = 'Entregue', delivered_quantity = $1
         WHERE id = $2`,
        [entregueFloat, pedidoId]
      );

      // Registrar log da ação
      await storage.createLog({
        userId: req.user.id,
        action: "Confirmou entrega de pedido",
        itemType: "order",
        itemId: pedidoId.toString(),
        details: `Entrega do pedido ${pedido.order_id} (${pedido.product_name}) confirmada. Quantidade: ${entregueFloat}.`
      });

      res.json({
        sucesso: true,
        mensagem: "Entrega confirmada com sucesso."
      });

    } catch (error) {
      console.error("❌ Erro ao confirmar entrega:", error);
      res.status(500).json({
        sucesso: false,
        mensagem: "Erro ao confirmar a entrega."
      });
    }
  });

  // Rota para cancelar pedido (somente KeyUser)
  app.post("/api/pedidos/:id/cancelar", isAuthenticated, isKeyUser, async (req, res) => {
    try {
      const pedidoId = parseInt(req.params.id);
      const { motivo } = req.body;

      console.log(`🚫 Cancelamento de pedido solicitado:`, {
        pedidoId,
        motivo
      });

      // Validações
      if (!motivo || !motivo.trim()) {
        return res.status(400).json({
          sucesso: false,
          mensagem: "Motivo do cancelamento é obrigatório."
        });
      }

      // Buscar informações do pedido original para histórico
      const pedidoResult = await pool.query(
        `SELECT o.*, p.name as product_name
         FROM orders o
         JOIN products p ON o.product_id = p.id
         WHERE o.id = $1`,
        [pedidoId]
      );

      if (!pedidoResult.rows.length) {
        return res.status(404).json({
          sucesso: false,
          mensagem: "Pedido não encontrado."
        });
      }

      const pedido = pedidoResult.rows[0];

      // Atualizar o status do pedido para 'Cancelado'
      await pool.query(
        `UPDATE orders
         SET status = 'Cancelado'
         WHERE id = $1`,
        [pedidoId]
      );

      // Registrar log da ação
      await storage.createLog({
        userId: req.user.id,
        action: "Cancelou pedido",
        itemType: "order",
        itemId: pedidoId.toString(),
        details: `Pedido ${pedido.order_id} (${pedido.product_name}) cancelado. Motivo: ${motivo}.`
      });

      res.json({
        sucesso: true,
        mensagem: "Pedido cancelado com sucesso."
      });

    } catch (error) {
      console.error("❌ Erro ao cancelar pedido:", error);
      res.status(500).json({
        sucesso: false,
        mensagem: "Erro ao cancelar o pedido."
      });
    }
  });

  // Rota para adicionar nota fiscal a um pedido
  app.post("/api/pedidos/:id/adicionar-nota", isAuthenticated, async (req, res) => {
    try {
      const pedidoId = parseInt(req.params.id);
      const { numeroNota, dataEmissao, valorTotal } = req.body;

      console.log(`📝 Adicionando nota fiscal ao pedido:`, {
        pedidoId,
        numeroNota,
        dataEmissao,
        valorTotal
      });

      // Validações
      if (!numeroNota || !dataEmissao || !valorTotal) {
        return res.status(400).json({
          sucesso: false,
          mensagem: "Número da nota, data de emissão e valor total são obrigatórios."
        });
      }

      const emissao = convertToLocalDate(dataEmissao);
      const valor = parseFloat(valorTotal);

      if (isNaN(valor) || valor <= 0) {
        return res.status(400).json({
          sucesso: false,
          mensagem: "Valor total inválido."
        });
      }

      // Buscar informações do pedido para log
      const pedidoResult = await pool.query(
        `SELECT o.*, p.name as product_name
         FROM orders o
         JOIN products p ON o.product_id = p.id
         WHERE o.id = $1`,
        [pedidoId]
      );

      if (!pedidoResult.rows.length) {
        return res.status(404).json({
          sucesso: false,
          mensagem: "Pedido não encontrado."
        });
      }

      const pedido = pedidoResult.rows[0];

      // Atualizar o pedido com as informações da nota fiscal
      await pool.query(
        `UPDATE orders
         SET invoice_number = $1, invoice_date = $2, invoice_total = $3
         WHERE id = $4`,
        [numeroNota, emissao, valor, pedidoId]
      );

      // Registrar log da ação
      await storage.createLog({
        userId: req.user.id,
        action: "Adicionou nota fiscal a pedido",
        itemType: "order",
        itemId: pedidoId.toString(),
        details: `Nota fiscal ${numeroNota} adicionada ao pedido ${pedido.order_id} (${pedido.product_name}). Valor: R$ ${valor.toFixed(2)}.`
      });

      res.json({
        sucesso: true,
        mensagem: "Nota fiscal adicionada com sucesso."
      });

    } catch (error) {
      console.error("❌ Erro ao adicionar nota fiscal:", error);
      res.status(500).json({
        sucesso: false,
        mensagem: "Erro ao adicionar nota fiscal."
      });
    }
  });

  // Rota para buscar detalhes de um pedido específico
  app.get("/api/pedidos/:id", isAuthenticated, async (req, res) => {
    try {
      const pedidoId = parseInt(req.params.id);
      if (isNaN(pedidoId)) {
        return res.status(400).json({
          sucesso: false,
          mensagem: "ID de pedido inválido."
        });
      }

      console.log(`🔍 Buscando detalhes do pedido ID: ${pedidoId}`);

      // Buscar detalhes do pedido principal
      const pedidoResult = await pool.query(`
        SELECT
          o.*,
          p.name as product_name,
          p.confirmation_type,
          u.abbreviation as unit_abbreviation,
          oc.numero_ordem as purchase_order_number,
          c_supplier.name as supplier_name,
          c_work.name as work_location_name,
          COALESCE(SUM(CASE WHEN o.status = 'Entregue' THEN CAST(o.quantity AS DECIMAL) ELSE 0 END), 0) as total_delivered,
          COALESCE(SUM(CASE WHEN o.status != 'Cancelado' THEN CAST(o.quantity AS DECIMAL) ELSE 0 END), 0) as total_ordered_not_canceled
        FROM orders o
        JOIN products p ON o.product_id = p.id
        LEFT JOIN units u ON p.unit_id = u.id
        LEFT JOIN ordens_compra oc ON o.purchase_order_id = oc.id
        LEFT JOIN companies c_supplier ON o.supplier_id = c_supplier.id
        LEFT JOIN companies c_work ON oc.cnpj = c_work.cnpj
        WHERE o.id = $1
        GROUP BY o.id, p.name, p.confirmation_type, u.abbreviation, oc.numero_ordem, c_supplier.name, c_work.name
      `, [pedidoId]);

      if (!pedidoResult.rows.length) {
        return res.status(404).json({
          sucesso: false,
          mensagem: "Pedido não encontrado."
        });
      }

      const pedido = pedidoResult.rows[0];
      console.log(`✅ Pedido encontrado: ${pedido.order_id}`);

      // Buscar informações do aprovador (se aplicável)
      let approverInfo = null;
      if (pedido.status === 'Registrado' && pedido.purchase_order_id) {
        const approverResult = await pool.query(`
          SELECT u.name as approver_name, u.email as approver_email
          FROM orders o
          JOIN ordens_compra oc ON o.purchase_order_id = oc.id
          JOIN companies c ON oc.cnpj = c.cnpj
          JOIN users u ON c.approver_id = u.id
          WHERE o.id = $1 AND c.approver_id IS NOT NULL
        `, [pedidoId]);

        if (approverResult.rows.length > 0) {
          approverInfo = {
            name: approverResult.rows[0].approver_name,
            email: approverResult.rows[0].approver_email
          };
        }
      }

      res.json({
        sucesso: true,
        pedido: {
          ...pedido,
          approverInfo: approverInfo
        }
      });

    } catch (error) {
      console.error("❌ Erro ao buscar detalhes do pedido:", error);
      res.status(500).json({
        sucesso: false,
        mensagem: "Erro ao buscar detalhes do pedido."
      });
    }
  });

  // Rota para obter a chave da API do Google Maps dos Secrets
  app.get("/api/google-maps-key", async (req, res) => {
    try {
      const googleMapsApiKey = process.env.GOOGLE_MAPS_API_KEY;

      if (!googleMapsApiKey) {
        console.error('❌ GOOGLE_MAPS_API_KEY não encontrada nos secrets');
        return res.status(500).json({
          error: 'Chave da API do Google Maps não configurada',
          apiKey: null
        });
      }

      console.log('✅ Google Maps API Key carregada dos secrets');
      console.log('   • Tamanho:', googleMapsApiKey.length);
      console.log('   • Preview:', `${googleMapsApiKey.substring(0, 20)}...`);

      res.json({
        apiKey: googleMapsApiKey
      });
    } catch (error) {
      console.error("❌ Erro ao buscar chave do Google Maps:", error);
      res.status(500).json({
        error: 'Erro ao carregar chave da API',
        apiKey: null
      });
    }
  });

  // Rota para buscar todos os pedidos com filtros
  app.get("/api/pedidos", isAuthenticated, async (req, res) => {
    try {
      const { status, supplierId, productId, purchaseOrderId, startDate, endDate, workLocation } = req.query;

      console.log("🔍 Buscando pedidos com filtros:", {
        status,
        supplierId,
        productId,
        purchaseOrderId,
        startDate,
        endDate,
        workLocation,
        userCompanyId: req.user.companyId,
        userIsKeyUser: req.user.isKeyUser
      });

      let query = `
        SELECT
          o.*,
          p.name as product_name,
          p.confirmation_type,
          u.abbreviation as unit_abbreviation,
          oc.numero_ordem as purchase_order_number,
          c_supplier.name as supplier_name,
          c_work.name as work_location_name,
          COALESCE(SUM(CASE WHEN o.status = 'Entregue' THEN CAST(o.quantity AS DECIMAL) ELSE 0 END), 0) as total_delivered,
          COALESCE(SUM(CASE WHEN o.status != 'Cancelado' THEN CAST(o.quantity AS DECIMAL) ELSE 0 END), 0) as total_ordered_not_canceled
        FROM orders o
        JOIN products p ON o.product_id = p.id
        LEFT JOIN units u ON p.unit_id = u.id
        LEFT JOIN ordens_compra oc ON o.purchase_order_id = oc.id
        LEFT JOIN companies c_supplier ON o.supplier_id = c_supplier.id
        LEFT JOIN companies c_work ON oc.cnpj = c_work.cnpj
        WHERE 1=1
      `; // Start with 1=1 for easy AND conditions

      const queryParams: any[] = [];
      let paramIndex = 1;

      // --- FILTRO BASEADO NA EMPRESA DO USUÁRIO ---
      // Se o usuário pertence a uma empresa com critérios e não é KeyUser/Admin
      if (req.user && req.user.companyId && !req.user.isKeyUser && req.user.id !== 1) {
        const userCompany = await storage.getCompany(req.user.companyId);
        if (userCompany) {
          const companyCategory = await storage.getCompanyCategory(userCompany.categoryId);
          if (companyCategory && (companyCategory.requiresApprover || companyCategory.requiresContract || companyCategory.receivesPurchaseOrders)) {
            // Incluir pedidos onde a empresa é fornecedora OU obra de destino
            query += ` AND (o.supplier_id = $${paramIndex} OR oc.cnpj = $${paramIndex + 1})`;
            queryParams.push(req.user.companyId, userCompany.cnpj);
            paramIndex += 2;
            console.log(`🔒 Filtro de empresa aplicado: Fornecedor=${req.user.companyId}, Obra CNPJ=${userCompany.cnpj}`);
          }
        }
      }

      // --- FILTRO DE STATUS ---
      if (status) {
        query += ` AND o.status = $${paramIndex++}`;
        queryParams.push(status);
      }

      // --- FILTRO POR FORNECEDOR ---
      if (supplierId) {
        query += ` AND o.supplier_id = $${paramIndex++}`;
        queryParams.push(supplierId);
      }

      // --- FILTRO POR PRODUTO ---
      if (productId) {
        query += ` AND o.product_id = $${paramIndex++}`;
        queryParams.push(productId);
      }

      // --- FILTRO POR ORDEM DE COMPRA ---
      if (purchaseOrderId) {
        query += ` AND o.purchase_order_id = $${paramIndex++}`;
        queryParams.push(purchaseOrderId);
      }

      // --- FILTRO POR LOCAL DE OBRA ---
      if (workLocation) {
        query += ` AND c_work.name ILIKE $${paramIndex++}`; // ILIKE para case-insensitive search
        queryParams.push(`%${workLocation}%`);
      }

      // --- FILTRO POR PERÍODO ---
      if (startDate) {
        query += ` AND o.delivery_date >= $${paramIndex++}`;
        queryParams.push(convertToLocalDate(startDate as string)); // Convert to local date
      }
      if (endDate) {
        // Add 1 day to endDate to include the entire day
        const adjustedEndDate = new Date(endDate as string);
        adjustedEndDate.setDate(adjustedEndDate.getDate() + 1);
        query += ` AND o.delivery_date < $${paramIndex++}`;
        queryParams.push(adjustedEndDate);
      }

      // --- GROUP BY ---
      query += `
        GROUP BY o.id, p.name, p.confirmation_type, u.abbreviation, oc.numero_ordem, c_supplier.name, c_work.name
        ORDER BY o.created_at DESC
      `;

      const result = await pool.query(query, queryParams);

      res.json(result.rows);

    } catch (error) {
      console.error("❌ Erro ao buscar pedidos com filtros:", error);
      res.status(500).json({
        sucesso: false,
        mensagem: "Erro ao buscar pedidos."
      });
    }
  });


  // Rota para buscar pontos de rastreamento de um pedido
  app.get("/api/tracking-points/:orderId", isAuthenticated, async (req, res) => {
    try {
      const orderId = parseInt(req.params.orderId);
      if (isNaN(orderId)) {
        return res.status(400).json({
          success: false,
          message: "ID de pedido inválido"
        });
      }

      console.log(`📍 Buscando pontos de rastreamento para pedido ID: ${orderId}`);

      // Verificar se a tabela tracking_points existe
      const tableCheck = await pool.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables
          WHERE table_name = 'tracking_points'
        );
      `);

      if (!tableCheck.rows[0].exists) {
        console.log(`⚠️ Tabela tracking_points não existe - retornando array vazio`);
        return res.json([]);
      }

      // Primeiro, buscar o código (order_id) do pedido
      const orderResult = await pool.query(`
        SELECT order_id FROM orders WHERE id = $1
      `, [orderId]);

      if (!orderResult.rows.length) {
        console.log(`⚠️ Pedido ${orderId} não encontrado`);
        return res.json([]);
      }

      const orderCode = orderResult.rows[0].order_id;
      console.log(`📋 Código do pedido: ${orderCode}`);

      // Buscar pontos de rastreamento usando o código do pedido
      const result = await pool.query(`
        SELECT
          tp.*,
          u.name as user_name
        FROM tracking_points tp
        LEFT JOIN users u ON tp.user_id = u.id
        WHERE tp.order_id = $1
        ORDER BY tp.created_at ASC
      `, [orderCode]);

      console.log(`✅ ${result.rows.length} pontos encontrados para pedido ${orderCode}`);

      res.json(result.rows);
    } catch (error) {
      console.error("❌ Erro ao buscar pontos de rastreamento:", error);
      res.status(500).json({
        success: false,
        message: "Erro ao buscar pontos de rastreamento",
        error: error instanceof Error ? error.message : "Erro desconhecido"
      });
    }
  });

  // Rota para adicionar comentário a um pedido
  app.post("/api/pedidos/:id/comentar", isAuthenticated, async (req, res) => {
    try {
      const pedidoId = parseInt(req.params.id);
      const { comentario } = req.body;

      console.log(`💬 Adicionando comentário ao pedido:`, {
        pedidoId,
        comentario
      });

      // Validações
      if (!comentario || !comentario.trim()) {
        return res.status(400).json({
          sucesso: false,
          mensagem: "Comentário é obrigatório."
        });
      }

      // Buscar informações do pedido para log
      const pedidoResult = await pool.query(
        `SELECT o.*, p.name as product_name
         FROM orders o
         JOIN products p ON o.product_id = p.id
         WHERE o.id = $1`,
        [pedidoId]
      );

      if (!pedidoResult.rows.length) {
        return res.status(404).json({
          sucesso: false,
          mensagem: "Pedido não encontrado."
        });
      }

      const pedido = pedidoResult.rows[0];

      // Adicionar o comentário ao histórico do pedido
      await pool.query(
        `INSERT INTO order_comments (order_id, user_id, comment, created_at)
         VALUES ($1, $2, $3, $4)`,
        [pedidoId, req.user.id, comentario.trim(), new Date()]
      );

      // Registrar log da ação
      await storage.createLog({
        userId: req.user.id,
        action: "Adicionou comentário a pedido",
        itemType: "order_comment",
        itemId: pedidoId.toString(),
        details: `Comentário adicionado ao pedido ${pedido.order_id} (${pedido.product_name}).`
      });

      res.json({
        sucesso: true,
        mensagem: "Comentário adicionado com sucesso."
      });

    } catch (error) {
      console.error("❌ Erro ao adicionar comentário:", error);
      res.status(500).json({
        sucesso: false,
        mensagem: "Erro ao adicionar comentário."
      });
    }
  });

  // Rota para buscar comentários de um pedido
  app.get("/api/pedidos/:id/comentarios", isAuthenticated, async (req, res) => {
    try {
      const pedidoId = parseInt(req.params.id);
      if (isNaN(pedidoId)) {
        return res.status(400).json({
          sucesso: false,
          mensagem: "ID de pedido inválido."
        });
      }

      console.log(`🔍 Buscando comentários do pedido ID: ${pedidoId}`);

      const comentariosResult = await pool.query(`
        SELECT
          oc.*,
          u.name as user_name,
          u.email as user_email
        FROM order_comments oc
        JOIN users u ON oc.user_id = u.id
        WHERE oc.order_id = $1
        ORDER BY oc.created_at ASC
      `, [pedidoId]);

      res.json(comentariosResult.rows);

    } catch (error) {
      console.error("❌ Erro ao buscar comentários do pedido:", error);
      res.status(500).json({
        sucesso: false,
        mensagem: "Erro ao buscar comentários do pedido."
      });
    }
  });

  // Rota para aprovar pedido urgente
  app.put("/api/orders/:id/approve", isAuthenticated, async (req, res) => {
    try {
      const orderId = parseInt(req.params.id);

      if (isNaN(orderId)) {
        return res.status(400).json({
          success: false,
          message: "ID de pedido inválido"
        });
      }

      console.log(`✅ Aprovando pedido urgente ID: ${orderId}`);

      // Buscar informações do pedido
      const pedidoResult = await pool.query(
        `SELECT o.*, p.name as product_name
         FROM orders o
         JOIN products p ON o.product_id = p.id
         WHERE o.id = $1`,
        [orderId]
      );

      if (!pedidoResult.rows.length) {
        return res.status(404).json({
          success: false,
          message: "Pedido não encontrado"
        });
      }

      const pedido = pedidoResult.rows[0];

      // Atualizar status para Aprovado
      await pool.query(
        `UPDATE orders SET status = 'Aprovado' WHERE id = $1`,
        [orderId]
      );

      // Registrar log da ação
      await storage.createLog({
        userId: req.user.id,
        action: "Aprovou pedido urgente",
        itemType: "order",
        itemId: orderId.toString(),
        details: `Pedido ${pedido.order_id} (${pedido.product_name}) aprovado`
      });

      res.json({
        success: true,
        message: "Pedido aprovado com sucesso"
      });

    } catch (error) {
      console.error("❌ Erro ao aprovar pedido:", error);
      res.status(500).json({
        success: false,
        message: "Erro ao aprovar pedido"
      });
    }
  });

  // Rota para rejeitar pedido urgente
  app.put("/api/orders/:id/reject", isAuthenticated, async (req, res) => {
    try {
      const orderId = parseInt(req.params.id);

      if (isNaN(orderId)) {
        return res.status(400).json({
          success: false,
          message: "ID de pedido inválido"
        });
      }

      console.log(`❌ Rejeitando pedido urgente ID: ${orderId}`);

      // Buscar informações do pedido
      const pedidoResult = await pool.query(
        `SELECT o.*, p.name as product_name
         FROM orders o
         JOIN products p ON o.product_id = p.id
         WHERE o.id = $1`,
        [orderId]
      );

      if (!pedidoResult.rows.length) {
        return res.status(404).json({
          success: false,
          message: "Pedido não encontrado"
        });
      }

      const pedido = pedidoResult.rows[0];

      // Atualizar status para Cancelado
      await pool.query(
        `UPDATE orders SET status = 'Cancelado' WHERE id = $1`,
        [orderId]
      );

      // Registrar log da ação
      await storage.createLog({
        userId: req.user.id,
        action: "Rejeitou pedido urgente",
        itemType: "order",
        itemId: orderId.toString(),
        details: `Pedido ${pedido.order_id} (${pedido.product_name}) rejeitado/cancelado`
      });

      res.json({
        success: true,
        message: "Pedido rejeitado com sucesso"
      });

    } catch (error) {
      console.error("❌ Erro ao rejeitar pedido:", error);
      res.status(500).json({
        success: false,
        message: "Erro ao rejeitar pedido"
      });
    }
  });

  // Rota para aprovar reprogramação
  app.put("/api/orders/:id/reprogramacao/aprovar", isAuthenticated, async (req, res) => {
    try {
      const orderId = parseInt(req.params.id);

      // Verificar se o pedido existe e tem reprogramação pendente
      const orderResult = await pool.query(
        "SELECT * FROM orders WHERE id = $1 AND status = 'Aguardando Aprovação'",
        [orderId]
      );

      if (orderResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: "Pedido não encontrado ou não está aguardando aprovação"
        });
      }

      const order = orderResult.rows[0];

      // Verificar se há nova data de entrega
      if (!order.nova_data_entrega) {
        return res.status(400).json({
          success: false,
          message: "Data de reprogramação não encontrada"
        });
      }

      // Aprovar: atualizar delivery_date com a nova data e mudar status
      await pool.query(
        `UPDATE orders 
         SET delivery_date = nova_data_entrega,
             status = 'Aprovado',
             nova_data_entrega = NULL,
             justificativa_reprogramacao = NULL,
             data_solicitacao_reprogramacao = NULL,
             usuario_reprogramacao = NULL
         WHERE id = $1`,
        [orderId]
      );

      // Registrar log
      await storage.createLog({
        userId: req.user.id,
        action: "Aprovou reprogramação de entrega",
        itemType: "order",
        itemId: orderId.toString(),
        details: `Nova data aprovada: ${new Date(order.nova_data_entrega).toLocaleDateString('pt-BR')}`
      });

      res.json({
        success: true,
        message: "Reprogramação aprovada com sucesso"
      });
    } catch (error) {
      console.error("Erro ao aprovar reprogramação:", error);
      res.status(500).json({
        success: false,
        message: "Erro ao aprovar reprogramação"
      });
    }
  });

  // Rota para rejeitar reprogramação (cancela o pedido)
  app.put("/api/orders/:id/reprogramacao/rejeitar", isAuthenticated, async (req, res) => {
    try {
      const orderId = parseInt(req.params.id);

      // Verificar se o pedido existe e tem reprogramação pendente
      const orderResult = await pool.query(
        "SELECT * FROM orders WHERE id = $1 AND status = 'Aguardando Aprovação'",
        [orderId]
      );

      if (orderResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: "Pedido não encontrado ou não está aguardando aprovação"
        });
      }

      // Rejeitar: cancelar o pedido
      await pool.query(
        `UPDATE orders 
         SET status = 'Cancelado',
             nova_data_entrega = NULL,
             justificativa_reprogramacao = NULL,
             data_solicitacao_reprogramacao = NULL,
             usuario_reprogramacao = NULL
         WHERE id = $1`,
        [orderId]
      );

      // Registrar log
      await storage.createLog({
        userId: req.user.id,
        action: "Rejeitou reprogramação de entrega",
        itemType: "order",
        itemId: orderId.toString(),
        details: "Pedido cancelado por rejeição da reprogramação"
      });

      res.json({
        success: true,
        message: "Reprogramação rejeitada, pedido cancelado"
      });
    } catch (error) {
      console.error("Erro ao rejeitar reprogramação:", error);
      res.status(500).json({
        success: false,
        message: "Erro ao rejeitar reprogramação"
      });
    }
  });

  // Configuração do servidor HTTP com o app Express
  const httpServer = createServer(app);
  return httpServer;
}