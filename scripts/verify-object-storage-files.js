
const { Pool } = require('pg');

async function verifyObjectStorageFiles() {
  console.log('🔍 VERIFICANDO ARQUIVOS NO OBJECT STORAGE\n');
  
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
    return;
  }

  const pedidosEspecificos = ['CO12407250007', 'CO12407250008'];

  try {
    for (const orderId of pedidosEspecificos) {
      console.log(`\n🔍 Verificando pedido ${orderId} no Object Storage:`);
      
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
      console.log(`📦 Pedido encontrado: ID ${pedido.id}`);
      console.log(`📄 Documentos carregados: ${pedido.documentoscarregados}`);

      if (pedido.documentosinfo) {
        try {
          const documentosInfo = typeof pedido.documentosinfo === 'string' 
            ? JSON.parse(pedido.documentosinfo) 
            : pedido.documentosinfo;
          
          console.log(`📋 Informações dos documentos:`, Object.keys(documentosInfo));
          
          for (const [tipo, info] of Object.entries(documentosInfo)) {
            console.log(`\n  📄 ${tipo}:`);
            console.log(`    • Nome: ${info.name}`);
            console.log(`    • Storage Key: ${info.storageKey}`);
            
            if (info.storageKey && info.storageKey.startsWith('orders/')) {
              try {
                // Tentar acessar o arquivo no Object Storage
                const buffer = await objectStorage.downloadAsBuffer(info.storageKey);
                console.log(`    ✅ Arquivo ENCONTRADO no Object Storage (${buffer.length} bytes)`);
              } catch (error) {
                console.log(`    ❌ Arquivo NÃO ENCONTRADO no Object Storage:`, error.message);
              }
            } else {
              console.log(`    ⚠️ Storage Key inválida ou arquivo não migrado`);
            }
          }
        } catch (error) {
          console.error(`❌ Erro ao processar documentosinfo:`, error);
        }
      } else {
        console.log(`⚠️ Nenhuma informação de documentos encontrada`);
      }
    }

    console.log('\n🎉 Verificação concluída!');
    
  } catch (error) {
    console.error('❌ Erro na verificação:', error);
  } finally {
    await pool.end();
  }
}

// Executar se chamado diretamente
if (require.main === module) {
  verifyObjectStorageFiles();
}

module.exports = { verifyObjectStorageFiles };
