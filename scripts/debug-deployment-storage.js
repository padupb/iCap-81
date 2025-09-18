
const { Pool } = require('pg');

async function debugDeploymentStorage() {
  console.log('🔍 DEBUG: VERIFICANDO OBJECT STORAGE NO DEPLOYMENT\n');

  // Verificar se estamos no ambiente correto
  console.log('🌍 Ambiente:', {
    nodeEnv: process.env.NODE_ENV,
    replId: process.env.REPL_ID,
    hasDatabase: !!process.env.DATABASE_URL,
    isProduction: process.env.NODE_ENV === 'production'
  });

  // Testar Object Storage
  let objectStorage = null;
  let storageWorking = false;
  
  try {
    console.log('\n📦 Testando Object Storage...');
    const { Client } = require('@replit/object-storage');
    objectStorage = new Client();
    
    const objects = await objectStorage.list();
    storageWorking = true;
    
    console.log(`✅ Object Storage funcionando - ${objects.length} objetos encontrados`);
    
    // Filtrar objetos relevantes para pedidos
    const orderFiles = objects.filter(obj => 
      obj.key.includes('orders/') || 
      obj.key.match(/^(CAP|CNI|CO|CCB)/) ||
      obj.key.includes('.pdf') ||
      obj.key.includes('.xml')
    );
    
    console.log(`📋 Arquivos de pedidos encontrados: ${orderFiles.length}`);
    
    if (orderFiles.length > 0) {
      console.log('\n📄 Primeiros 10 arquivos de pedidos:');
      orderFiles.slice(0, 10).forEach((obj, index) => {
        console.log(`  ${index + 1}. ${obj.key} (${(obj.size / 1024).toFixed(2)} KB)`);
      });
    }
    
  } catch (error) {
    console.error('❌ Erro no Object Storage:', error.message);
  }

  // Testar conexão com banco de dados
  if (process.env.DATABASE_URL) {
    try {
      console.log('\n💾 Testando conexão com banco de dados...');
      const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
      });

      const result = await pool.query('SELECT COUNT(*) as total FROM orders');
      console.log(`✅ Banco de dados funcionando - ${result.rows[0].total} pedidos encontrados`);

      // Buscar alguns pedidos com documentos
      const ordersWithDocs = await pool.query(`
        SELECT id, order_id, documents 
        FROM orders 
        WHERE documents IS NOT NULL AND documents != '{}' 
        LIMIT 5
      `);

      console.log(`📋 Pedidos com documentos: ${ordersWithDocs.rows.length}`);
      
      if (ordersWithDocs.rows.length > 0) {
        console.log('\n📄 Pedidos com documentos:');
        ordersWithDocs.rows.forEach(order => {
          try {
            const docs = JSON.parse(order.documents);
            console.log(`  • ${order.order_id}:`);
            if (docs.notaPdf) console.log(`    - Nota PDF: ${docs.notaPdf.storageKey || docs.notaPdf.path}`);
            if (docs.notaXml) console.log(`    - Nota XML: ${docs.notaXml.storageKey || docs.notaXml.path}`);
            if (docs.certificadoPdf) console.log(`    - Certificado: ${docs.certificadoPdf.storageKey || docs.certificadoPdf.path}`);
          } catch (parseError) {
            console.log(`    - Erro ao parsear documentos: ${parseError.message}`);
          }
        });
      }

      await pool.end();
      
    } catch (dbError) {
      console.error('❌ Erro no banco de dados:', dbError.message);
    }
  }

  // Resumo
  console.log('\n📊 RESUMO:');
  console.log(`  Object Storage: ${storageWorking ? '✅ Funcionando' : '❌ Com problemas'}`);
  console.log(`  Banco de dados: ${process.env.DATABASE_URL ? '✅ Configurado' : '❌ Não configurado'}`);
  
  if (!storageWorking) {
    console.log('\n💡 SOLUÇÕES POSSÍVEIS:');
    console.log('  1. Verificar se Object Storage está habilitado no Repl');
    console.log('  2. Verificar se @replit/object-storage está instalado');
    console.log('  3. Verificar se os arquivos foram migrados corretamente');
    console.log('  4. Executar: node scripts/migrate-to-object-storage.js');
  }
}

// Executar debug
if (require.main === module) {
  debugDeploymentStorage()
    .then(() => {
      console.log('\n✅ Debug concluído');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Erro no debug:', error);
      process.exit(1);
    });
}

module.exports = { debugDeploymentStorage };
