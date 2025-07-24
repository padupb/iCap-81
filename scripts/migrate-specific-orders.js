
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

async function migrateSpecificOrders() {
  console.log('🔄 MIGRANDO PEDIDOS ESPECÍFICOS PARA OBJECT STORAGE\n');
  
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

  const pedidosEspecificos = ['CO12407250007', 'CO12407250008'];

  try {
    for (const orderId of pedidosEspecificos) {
      console.log(`\n🔍 Migrando pedido ${orderId}:`);
      
      // Buscar no banco
      const pedidoResult = await pool.query(`
        SELECT id, order_id, documentoscarregados, documentosinfo 
        FROM orders 
        WHERE order_id = $1
      `, [orderId]);

      if (pedidoResult.rows.length === 0) {
        console.log(`❌ Pedido ${orderId} não encontrado no banco`);
        continue;
      }

      const pedido = pedidoResult.rows[0];
      console.log(`📦 Pedido encontrado: ID ${pedido.id}, documentos carregados: ${pedido.documentoscarregados}`);

      // Verificar diretório local
      const orderDir = path.join(process.cwd(), 'uploads', orderId);
      
      if (!fs.existsSync(orderDir)) {
        console.log(`❌ Diretório ${orderDir} não existe`);
        continue;
      }

      const files = fs.readdirSync(orderDir);
      console.log(`📁 Encontrados ${files.length} arquivos: ${files.join(', ')}`);

      const documentosInfo = {};
      let migradoComSucesso = false;

      for (const filename of files) {
        const filePath = path.join(orderDir, filename);
        
        try {
          console.log(`  📤 Migrando ${filename}...`);
          
          // Ler arquivo
          const buffer = fs.readFileSync(filePath);
          
          // Fazer upload para Object Storage
          const key = `orders/${orderId}/${filename}`;
          await objectStorage.uploadFromBuffer(key, buffer);
          
          console.log(`  ✅ ${filename} migrado para Object Storage: ${key}`);
          
          // Determinar o tipo do documento
          let docType = 'outro';
          if (filename.includes('nota_pdf')) docType = 'nota_pdf';
          else if (filename.includes('nota_xml')) docType = 'nota_xml';
          else if (filename.includes('certificado_pdf')) docType = 'certificado_pdf';
          else if (filename.includes('nota_assinada')) docType = 'foto_confirmacao';
          
          // Obter stats do arquivo
          const stats = fs.statSync(filePath);
          
          if (docType !== 'outro') {
            documentosInfo[docType] = {
              name: filename,
              filename: filename,
              size: stats.size,
              path: filePath,
              storageKey: key,
              date: stats.birthtime.toISOString()
            };
          }
          
          migradoComSucesso = true;
          
        } catch (error) {
          console.error(`  ❌ Erro ao migrar ${filename}:`, error);
        }
      }

      // Atualizar banco de dados se houver migração bem-sucedida
      if (migradoComSucesso) {
        try {
          await pool.query(
            `UPDATE orders SET 
             documentoscarregados = true, 
             documentosinfo = $1 
             WHERE order_id = $2`,
            [JSON.stringify(documentosInfo), orderId]
          );
          console.log(`  ✅ Banco de dados atualizado para pedido ${orderId}`);
          console.log(`  📄 Documentos migrados: ${Object.keys(documentosInfo).join(', ')}`);
        } catch (error) {
          console.error(`  ❌ Erro ao atualizar banco para pedido ${orderId}:`, error);
        }
      }

      console.log(`  📋 Pedido ${orderId} processado\n`);
    }

    console.log('🎉 Migração específica concluída!');
    
  } catch (error) {
    console.error('❌ Erro na migração:', error);
  } finally {
    await pool.end();
  }
}

// Executar se chamado diretamente
if (require.main === module) {
  migrateSpecificOrders();
}

module.exports = { migrateSpecificOrders };
