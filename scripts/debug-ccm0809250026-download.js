
const { pool } = require('../server/db');

async function debugPedidoCCM() {
  try {
    console.log('🔍 Investigando pedido CCM0809250026...\n');

    // 1. Buscar dados do pedido no banco
    const pedidoResult = await pool.query(`
      SELECT id, order_id, documentoscarregados, documentosinfo 
      FROM orders 
      WHERE order_id = 'CCM0809250026'
    `);

    if (pedidoResult.rows.length === 0) {
      console.log('❌ Pedido não encontrado no banco');
      return;
    }

    const pedido = pedidoResult.rows[0];
    console.log('📦 Dados do pedido:', {
      id: pedido.id,
      order_id: pedido.order_id,
      documentoscarregados: pedido.documentoscarregados
    });

    // 2. Analisar documentosinfo
    if (pedido.documentosinfo) {
      console.log('\n📄 DocumentosInfo bruto:');
      console.log(typeof pedido.documentosinfo === 'string' ? pedido.documentosinfo : JSON.stringify(pedido.documentosinfo, null, 2));

      const documentosInfo = typeof pedido.documentosinfo === 'string' 
        ? JSON.parse(pedido.documentosinfo) 
        : pedido.documentosinfo;

      console.log('\n📋 DocumentosInfo parseado:', JSON.stringify(documentosInfo, null, 2));

      // Verificar cada tipo de documento
      ['nota_pdf', 'nota_xml', 'certificado_pdf'].forEach(tipo => {
        if (documentosInfo[tipo]) {
          console.log(`\n🎯 ${tipo.toUpperCase()}:`);
          console.log('  - Nome:', documentosInfo[tipo].name);
          console.log('  - Filename:', documentosInfo[tipo].filename);
          console.log('  - StorageKey:', documentosInfo[tipo].storageKey);
          console.log('  - Path:', documentosInfo[tipo].path);
          console.log('  - Size:', documentosInfo[tipo].size);
        } else {
          console.log(`\n❌ ${tipo.toUpperCase()}: não encontrado`);
        }
      });
    } else {
      console.log('❌ DocumentosInfo não encontrado');
    }

    // 3. Verificar diretório local
    const fs = require('fs');
    const path = require('path');
    const orderDir = path.join(process.cwd(), 'uploads', 'CCM0809250026');
    
    console.log(`\n📁 Verificando diretório local: ${orderDir}`);
    
    if (fs.existsSync(orderDir)) {
      console.log('✅ Diretório existe');
      const files = fs.readdirSync(orderDir);
      console.log(`📋 Arquivos encontrados (${files.length}):`, files);
      
      files.forEach(file => {
        const filePath = path.join(orderDir, file);
        const stats = fs.statSync(filePath);
        console.log(`  • ${file}: ${stats.size} bytes, modificado em ${stats.mtime}`);
      });
    } else {
      console.log('❌ Diretório não existe');
    }

    // 4. Testar Object Storage
    console.log('\n☁️ Testando Object Storage...');
    
    try {
      const { Client } = require('@replit/object-storage');
      const client = new Client();
      
      // Listar todos os objetos
      const allObjects = await client.list();
      console.log(`📊 Total de objetos no Object Storage: ${allObjects.length}`);
      
      // Filtrar objetos relacionados a CCM0809250026
      const ccmObjects = allObjects.filter(obj => 
        obj.key.includes('CCM0809250026') || 
        obj.key.includes('nota_pdf-1757620958729.pdf')
      );
      
      console.log(`🎯 Objetos relacionados a CCM0809250026:`);
      ccmObjects.forEach(obj => {
        console.log(`  • ${obj.key} (${obj.size || 'tamanho desconhecido'} bytes)`);
      });
      
      if (ccmObjects.length === 0) {
        console.log('❌ Nenhum objeto encontrado no Object Storage para este pedido');
        
        // Verificar se há objetos com nomes similares
        const similarObjects = allObjects.filter(obj => 
          obj.key.toLowerCase().includes('ccm') || 
          obj.key.includes('nota_pdf')
        );
        
        if (similarObjects.length > 0) {
          console.log('\n🔍 Objetos similares encontrados:');
          similarObjects.forEach(obj => {
            console.log(`  • ${obj.key}`);
          });
        }
      }
      
    } catch (storageError) {
      console.log(`❌ Erro ao acessar Object Storage: ${storageError.message}`);
    }

    console.log('\n✅ Debug concluído!');

  } catch (error) {
    console.error('❌ Erro no debug:', error);
  } finally {
    process.exit(0);
  }
}

debugPedidoCCM();
