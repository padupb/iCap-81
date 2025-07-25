
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

async function checkCO12507250003Files() {
  console.log('🔍 VERIFICANDO ARQUIVOS DO PEDIDO CO12507250003\n');
  
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

  try {
    // 1. Verificar no banco de dados
    console.log('1️⃣ Verificando no banco de dados...');
    const pedidoResult = await pool.query(`
      SELECT id, order_id, documentoscarregados, documentosinfo, status, created_at
      FROM orders 
      WHERE order_id = $1
    `, ['CO12507250003']);

    if (pedidoResult.rows.length === 0) {
      console.log('❌ Pedido CO12507250003 não encontrado no banco');
      return;
    }

    const pedido = pedidoResult.rows[0];
    console.log('📋 Dados do pedido no banco:');
    console.log(`   - ID: ${pedido.id}`);
    console.log(`   - Order ID: ${pedido.order_id}`);
    console.log(`   - Status: ${pedido.status}`);
    console.log(`   - Documentos carregados: ${pedido.documentoscarregados}`);
    console.log(`   - Data criação: ${pedido.created_at}`);
    
    if (pedido.documentosinfo) {
      try {
        const documentosInfo = typeof pedido.documentosinfo === 'string' 
          ? JSON.parse(pedido.documentosinfo) 
          : pedido.documentosinfo;
        
        console.log('📄 Informações dos documentos no banco:');
        for (const [tipo, info] of Object.entries(documentosInfo)) {
          console.log(`   • ${tipo}:`);
          if (info && typeof info === 'object') {
            console.log(`     - Filename: ${info.filename || 'N/A'}`);
            console.log(`     - Storage Key: ${info.storageKey || 'N/A'}`);
            console.log(`     - Size: ${info.size || 'N/A'} bytes`);
          }
        }
      } catch (error) {
        console.error('❌ Erro ao parsear documentosinfo:', error);
      }
    } else {
      console.log('⚠️ Campo documentosinfo está vazio');
    }

    // 2. Verificar arquivos locais
    console.log('\n2️⃣ Verificando arquivos locais...');
    const localDir = path.join(process.cwd(), 'uploads', 'CO12507250003');
    
    if (fs.existsSync(localDir)) {
      const files = fs.readdirSync(localDir);
      console.log(`📁 Encontrados ${files.length} arquivos locais:`);
      
      for (const filename of files) {
        const filePath = path.join(localDir, filename);
        const stats = fs.statSync(filePath);
        console.log(`   • ${filename} (${(stats.size / 1024).toFixed(2)} KB)`);
      }
    } else {
      console.log('❌ Diretório local não existe');
    }

    // 3. Verificar Object Storage
    console.log('\n3️⃣ Verificando Object Storage...');
    try {
      const { Client } = require('@replit/object-storage');
      const objectStorage = new Client();
      
      // Listar todos os objetos para este pedido
      const objects = await objectStorage.list();
      const pedidoObjects = objects.filter(obj => obj.key.includes('CO12507250003'));
      
      if (pedidoObjects.length > 0) {
        console.log(`✅ Encontrados ${pedidoObjects.length} arquivos no Object Storage:`);
        for (const obj of pedidoObjects) {
          console.log(`   • ${obj.key} (${(obj.size / 1024).toFixed(2)} KB)`);
        }
      } else {
        console.log('❌ Nenhum arquivo encontrado no Object Storage para este pedido');
        
        // Mostrar todos os objetos para debug
        console.log(`\n🔍 Debug - Total de objetos no Object Storage: ${objects.length}`);
        if (objects.length > 0) {
          console.log('📋 Primeiros 10 objetos:');
          objects.slice(0, 10).forEach(obj => {
            console.log(`   • ${obj.key}`);
          });
        }
      }
      
    } catch (error) {
      console.log('❌ Object Storage não disponível:', error.message);
      console.log('💡 Para instalar: npm install @replit/object-storage');
    }

    // 4. Recomendações
    console.log('\n💡 DIAGNÓSTICO E RECOMENDAÇÕES:');
    
    if (!pedido.documentoscarregados) {
      console.log('❌ PROBLEMA: documentoscarregados = false');
      console.log('🔧 SOLUÇÃO: Recarregar os documentos');
    }
    
    if (!pedido.documentosinfo) {
      console.log('❌ PROBLEMA: documentosinfo está vazio');
      console.log('🔧 SOLUÇÃO: Upload não foi processado corretamente');
    }
    
    console.log('\n📋 PRÓXIMOS PASSOS:');
    console.log('1. Verificar se Object Storage está instalado e funcionando');
    console.log('2. Recarregar os documentos na aplicação');
    console.log('3. Verificar logs do servidor durante o upload');
    
  } catch (error) {
    console.error('❌ Erro na verificação:', error);
  } finally {
    await pool.end();
  }
}

// Executar verificação
checkCO12507250003Files().catch(console.error);
