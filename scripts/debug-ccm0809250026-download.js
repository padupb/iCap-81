
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
const { Pool } = require('pg');

async function debugCCM0809250026Download() {
  let pool;
  
  try {
    // Configurar conexão com banco
    const connectionString = process.env.DATABASE_URL || process.env.PGDATABASE;
    if (!connectionString) {
      console.log('❌ Variável DATABASE_URL não encontrada');
      return;
    }

    pool = new Pool({ connectionString });
    console.log('✅ Conectado ao banco de dados');

    // 1. Verificar dados no banco
    console.log('\n1️⃣ Verificando dados do pedido CCM0809250026 no banco...');
    const orderResult = await pool.query(
      `SELECT id, order_id, status, documentoscarregados, documentosinfo 
       FROM orders 
       WHERE order_id = 'CCM0809250026'`
    );

    if (orderResult.rows.length === 0) {
      console.log('❌ Pedido CCM0809250026 não encontrado');
      return;
    }

    const order = orderResult.rows[0];
    console.log('📋 Pedido encontrado:', {
      id: order.id,
      orderId: order.order_id,
      status: order.status,
      hasDocuments: order.documentoscarregados
    });

    if (order.documentosinfo) {
      const docsInfo = typeof order.documentosinfo === 'string' 
        ? JSON.parse(order.documentosinfo) 
        : order.documentosinfo;
      
      console.log('\n📄 Documentos no banco:');
      Object.keys(docsInfo).forEach(docType => {
        const doc = docsInfo[docType];
        console.log(`   ${docType}:`, {
          filename: doc.filename,
          storageKey: doc.storageKey,
          size: doc.size
        });
      });
    }

    // 2. Testar Object Storage
    console.log('\n2️⃣ Testando Object Storage...');
    try {
      const { Client } = require('@replit/object-storage');
      const objectStorage = new Client();
      
      // Testar listagem
      console.log('📋 Testando listagem de objetos...');
      const objects = await objectStorage.list();
      
      if (!objects) {
        console.log('❌ Listagem retornou null/undefined');
      } else if (!Array.isArray(objects)) {
        console.log('❌ Listagem não retornou array:', typeof objects);
        console.log('🔍 Conteúdo:', objects);
      } else {
        console.log(`✅ Listagem retornou ${objects.length} objetos`);
        
        // Procurar arquivos do pedido CCM0809250026
        const ccmFiles = objects.filter(obj => 
          obj.key && obj.key.includes('CCM0809250026')
        );
        
        console.log(`📁 Arquivos do CCM0809250026 encontrados: ${ccmFiles.length}`);
        ccmFiles.forEach(file => {
          console.log(`   • ${file.key} (${file.size} bytes)`);
        });

        // Testar download específico
        if (order.documentosinfo) {
          const docsInfo = typeof order.documentosinfo === 'string' 
            ? JSON.parse(order.documentosinfo) 
            : order.documentosinfo;
          
          for (const [docType, docInfo] of Object.entries(docsInfo)) {
            console.log(`\n📥 Testando download de ${docType}...`);
            console.log(`   StorageKey: ${docInfo.storageKey}`);
            
            try {
              const data = await objectStorage.downloadAsBytes(docInfo.storageKey);
              if (data && data.length > 0) {
                console.log(`   ✅ Download OK: ${data.length} bytes`);
              } else {
                console.log(`   ❌ Download retornou dados vazios`);
              }
            } catch (downloadError) {
              console.log(`   ❌ Erro no download: ${downloadError.message}`);
            }
          }
        }
      }
      
    } catch (storageError) {
      console.log('❌ Erro ao conectar Object Storage:', storageError.message);
    }

    // 3. Verificar arquivos locais
    console.log('\n3️⃣ Verificando arquivos locais...');
    const fs = require('fs');
    const path = require('path');
    
    const localDir = path.join(process.cwd(), 'uploads', 'CCM0809250026');
    console.log(`📂 Diretório local: ${localDir}`);
    
    if (fs.existsSync(localDir)) {
      const files = fs.readdirSync(localDir);
      console.log(`📁 Arquivos encontrados: ${files.length}`);
      files.forEach(file => {
        const filePath = path.join(localDir, file);
        const stats = fs.statSync(filePath);
        console.log(`   • ${file} (${stats.size} bytes)`);
      });
    } else {
      console.log('❌ Diretório local não existe');
    }

    console.log('\n🎯 CONCLUSÃO:');
    console.log('- Verifique se os arquivos estão realmente no Object Storage');
    console.log('- Se não estiverem, execute o script de migração');
    console.log('- Se estiverem, o problema pode ser na API do Object Storage');

  } catch (error) {
    console.error('❌ Erro no debug:', error);
  } finally {
    if (pool) {
      await pool.end();
    }
  }
}

// Executar se chamado diretamente
if (require.main === module) {
  debugCCM0809250026Download();
}

module.exports = { debugCCM0809250026Download };
