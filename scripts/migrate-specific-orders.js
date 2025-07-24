const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

async function migrateSpecificOrders() {
  console.log('🔄 VERIFICANDO PEDIDOS ESPECÍFICOS\n');

  const specificOrders = ['CO12407250007', 'CO12407250008'];

  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL não encontrada');
    return;
  }

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    // Verificar se o Object Storage está disponível
    let client;
    let hasObjectStorage = false;

    try {
      const { getClient } = require('@replit/object-storage');
      client = getClient();
      hasObjectStorage = true;
      console.log('✅ Object Storage disponível');
    } catch (error) {
      console.log('⚠️ Object Storage não disponível, verificando arquivos locais');
      hasObjectStorage = false;
    }

    for (const orderId of specificOrders) {
      console.log(`\n🔍 Verificando pedido ${orderId}:`);

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
          console.log(`  📄 Verificando ${filename}...`);

          // Ler arquivo
          const buffer = fs.readFileSync(filePath);

          if (hasObjectStorage) {
            // Fazer upload para Object Storage
            const key = `orders/${orderId}/${filename}`;
            await client.uploadFromBuffer(key, buffer);

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
          } else {
            console.log(`  ⚠️ Object Storage não disponível, arquivo ${filename} mantido localmente.`);
          }

        } catch (error) {
          console.error(`  ❌ Erro ao verificar ${filename}:`, error);
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

    console.log('🎉 Verificação específica concluída!');

  } catch (error) {
    console.error('❌ Erro na verificação:', error);
  } finally {
    await pool.end();
  }
}

// Executar se chamado diretamente
if (require.main === module) {
  migrateSpecificOrders();
}

module.exports = { migrateSpecificOrders };