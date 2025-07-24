
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

async function migrateExistingUploads() {
  console.log('🔄 MIGRANDO UPLOADS EXISTENTES PARA OBJECT STORAGE\n');
  
  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL não configurada nos Secrets!');
    return;
  }
  
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false
    }
  });

  // Configurar Object Storage
  let objectStorage = null;
  try {
    const { Client } = require('@replit/object-storage');
    objectStorage = new Client();
    console.log("✅ Object Storage do Replit configurado e inicializado");
  } catch (error) {
    console.error("❌ Object Storage não disponível:", error.message);
    console.log("📦 Certifique-se de que @replit/object-storage está instalado");
    return;
  }

  try {
    // Buscar todos os pedidos com documentos carregados
    const pedidosResult = await pool.query(`
      SELECT id, order_id, documentosinfo 
      FROM orders 
      WHERE documentoscarregados = true 
      AND documentosinfo IS NOT NULL
      ORDER BY created_at DESC
    `);

    console.log(`📋 Encontrados ${pedidosResult.rows.length} pedidos com documentos para migrar\n`);

    for (const pedido of pedidosResult.rows) {
      const orderId = pedido.order_id;
      console.log(`🔄 Migrando pedido ${orderId}...`);
      
      // Verificar se o diretório local existe
      const orderDir = path.join(process.cwd(), 'uploads', orderId);
      if (!fs.existsSync(orderDir)) {
        console.log(`⚠️ Diretório ${orderDir} não existe - pulando`);
        continue;
      }

      let documentosInfo = {};
      try {
        documentosInfo = typeof pedido.documentosinfo === 'string' 
          ? JSON.parse(pedido.documentosinfo) 
          : pedido.documentosinfo;
      } catch (error) {
        console.log(`❌ Erro ao parsear documentosinfo do pedido ${orderId}:`, error);
        continue;
      }

      // Migrar cada tipo de documento
      const tiposDocumento = ['nota_pdf', 'nota_xml', 'certificado_pdf', 'foto_confirmacao'];
      let migradoComSucesso = false;

      for (const tipo of tiposDocumento) {
        if (documentosInfo[tipo] && documentosInfo[tipo].filename) {
          const filename = documentosInfo[tipo].filename;
          const filePath = path.join(orderDir, filename);
          
          if (fs.existsSync(filePath)) {
            try {
              console.log(`  📤 Migrando ${tipo}: ${filename}...`);
              
              // Ler arquivo
              const buffer = fs.readFileSync(filePath);
              
              // Fazer upload para Object Storage
              const key = `orders/${orderId}/${filename}`;
              await objectStorage.uploadFromBuffer(key, buffer);
              
              // Atualizar informações do documento
              documentosInfo[tipo].storageKey = key;
              
              console.log(`  ✅ ${filename} migrado para Object Storage: ${key}`);
              migradoComSucesso = true;
              
            } catch (error) {
              console.error(`  ❌ Erro ao migrar ${filename}:`, error);
            }
          } else {
            console.log(`  ⚠️ Arquivo ${filePath} não encontrado localmente`);
          }
        }
      }

      // Atualizar banco de dados se houver migração bem-sucedida
      if (migradoComSucesso) {
        try {
          await pool.query(
            `UPDATE orders SET documentosinfo = $1 WHERE id = $2`,
            [JSON.stringify(documentosInfo), pedido.id]
          );
          console.log(`  ✅ Banco atualizado para pedido ${orderId}`);
        } catch (error) {
          console.error(`  ❌ Erro ao atualizar banco para pedido ${orderId}:`, error);
        }
      }

      console.log(`  📋 Pedido ${orderId} processado\n`);
    }

    console.log('🎉 Migração concluída!');
    
  } catch (error) {
    console.error('❌ Erro na migração:', error);
  } finally {
    await pool.end();
  }
}

// Executar migração
migrateExistingUploads().catch(console.error);
