
const { Pool } = require('pg');

async function verifyObjectStorage() {
  console.log('🔍 VERIFICANDO OBJECT STORAGE\n');
  
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

  try {
    // Verificar pedidos específicos CO12407250007 e CO12407250008
    const pedidosEspecificos = ['CO12407250007', 'CO12407250008'];
    
    for (const orderId of pedidosEspecificos) {
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
      console.log(`📋 Status: documentoscarregados = ${pedido.documentoscarregados}`);
      
      if (pedido.documentosinfo) {
        try {
          const documentosInfo = typeof pedido.documentosinfo === 'string' 
            ? JSON.parse(pedido.documentosinfo) 
            : pedido.documentosinfo;
          
          console.log('📄 Documentos registrados:');
          
          for (const [tipo, info] of Object.entries(documentosInfo)) {
            if (info && typeof info === 'object') {
              console.log(`  • ${tipo}:`);
              console.log(`    - Arquivo: ${info.filename || 'N/A'}`);
              console.log(`    - Storage Key: ${info.storageKey || 'N/A'}`);
              
              // Tentar acessar no Object Storage
              if (info.storageKey) {
                try {
                  const buffer = await objectStorage.downloadAsBuffer(info.storageKey);
                  console.log(`    - ✅ Acessível no Object Storage (${buffer.length} bytes)`);
                } catch (error) {
                  console.log(`    - ❌ Erro ao acessar no Object Storage: ${error.message}`);
                }
              } else {
                console.log(`    - ⚠️ Sem storage key - não migrado`);
              }
            }
          }
          
        } catch (error) {
          console.error(`❌ Erro ao parsear documentosinfo:`, error);
        }
      } else {
        console.log('⚠️ Nenhuma informação de documentos encontrada');
      }
    }
    
  } catch (error) {
    console.error('❌ Erro na verificação:', error);
  } finally {
    await pool.end();
  }
}

// Executar verificação
verifyObjectStorage().catch(console.error);
