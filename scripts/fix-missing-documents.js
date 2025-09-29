
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

async function fixMissingDocuments() {
  console.log('🔧 DIAGNÓSTICO E CORREÇÃO DE DOCUMENTOS PERDIDOS\n');

  let pool = null;
  let objectStorage = null;

  try {
    // Conectar ao banco
    if (process.env.DATABASE_URL) {
      pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
      });
      console.log('✅ Conexão com banco estabelecida');
    } else {
      console.log('❌ DATABASE_URL não configurada');
      return;
    }

    // Conectar ao Object Storage
    try {
      const { Client } = require('@replit/object-storage');
      objectStorage = new Client();
      console.log('✅ Object Storage inicializado');
    } catch (error) {
      console.log('⚠️ Object Storage não disponível:', error.message);
    }

    // Buscar pedidos com documentos
    const pedidosComDocs = await pool.query(`
      SELECT id, order_id, documents, documents_info 
      FROM orders 
      WHERE (documents IS NOT NULL AND documents != '{}') 
         OR (documents_info IS NOT NULL AND documents_info != '{}')
      ORDER BY id DESC
      LIMIT 20
    `);

    console.log(`\n📋 Encontrados ${pedidosComDocs.rows.length} pedidos com documentos`);

    for (const pedido of pedidosComDocs.rows) {
      console.log(`\n🔍 Analisando pedido ${pedido.order_id} (ID: ${pedido.id})`);
      
      let documentsData = null;
      try {
        if (pedido.documents_info) {
          documentsData = typeof pedido.documents_info === 'string' 
            ? JSON.parse(pedido.documents_info) 
            : pedido.documents_info;
        } else if (pedido.documents) {
          documentsData = typeof pedido.documents === 'string' 
            ? JSON.parse(pedido.documents) 
            : pedido.documents;
        }
      } catch (parseError) {
        console.log(`   ❌ Erro ao parsear documentos: ${parseError.message}`);
        continue;
      }

      if (!documentsData) {
        console.log('   ⚠️ Nenhum documento encontrado');
        continue;
      }

      // Verificar cada tipo de documento
      for (const [docType, docInfo] of Object.entries(documentsData)) {
        if (!docInfo || typeof docInfo !== 'object') continue;
        
        console.log(`   📄 Verificando ${docType}:`);
        console.log(`      StorageKey: ${docInfo.storageKey || 'N/A'}`);
        console.log(`      Filename: ${docInfo.filename || 'N/A'}`);
        console.log(`      Path: ${docInfo.path || 'N/A'}`);
        
        let fileFound = false;
        
        // Verificar no Object Storage
        if (objectStorage && docInfo.storageKey) {
          try {
            const data = await objectStorage.downloadAsBytes(docInfo.storageKey);
            if (data && ((data.length > 0) || (data.ok && data.value))) {
              console.log(`      ✅ Encontrado no Object Storage`);
              fileFound = true;
            }
          } catch (storageError) {
            console.log(`      ❌ Não encontrado no Object Storage: ${storageError.message}`);
          }
        }
        
        // Verificar no sistema local se não encontrou no storage
        if (!fileFound && docInfo.path) {
          if (fs.existsSync(docInfo.path)) {
            const stats = fs.statSync(docInfo.path);
            console.log(`      ✅ Encontrado localmente (${(stats.size / 1024).toFixed(2)} KB)`);
            fileFound = true;
            
            // Tentar migrar para Object Storage se disponível
            if (objectStorage) {
              try {
                console.log(`      📤 Tentando migrar para Object Storage...`);
                const buffer = fs.readFileSync(docInfo.path);
                const newStorageKey = `${pedido.order_id}/${docInfo.filename}`;
                
                // Upload usando bytes
                const uint8Array = new Uint8Array(buffer);
                await objectStorage.uploadFromBytes(newStorageKey, uint8Array);
                
                // Verificar se o upload funcionou
                const verification = await objectStorage.downloadAsBytes(newStorageKey);
                if (verification && verification.ok && verification.value) {
                  console.log(`      ✅ Migrado com sucesso para: ${newStorageKey}`);
                  
                  // Atualizar o registro no banco
                  const updatedDocInfo = { ...docInfo, storageKey: newStorageKey };
                  const updatedDocs = { ...documentsData, [docType]: updatedDocInfo };
                  
                  await pool.query(`
                    UPDATE orders 
                    SET documents_info = $1 
                    WHERE id = $2
                  `, [JSON.stringify(updatedDocs), pedido.id]);
                  
                  console.log(`      ✅ Banco atualizado com nova storageKey`);
                } else {
                  console.log(`      ❌ Falha na verificação do upload`);
                }
              } catch (migrateError) {
                console.log(`      ❌ Erro na migração: ${migrateError.message}`);
              }
            }
          } else {
            console.log(`      ❌ Não encontrado localmente: ${docInfo.path}`);
          }
        }
        
        if (!fileFound) {
          console.log(`      🔍 Tentando busca alternativa...`);
          
          // Buscar na pasta do pedido
          const orderDir = path.join(process.cwd(), 'uploads', pedido.order_id);
          if (fs.existsSync(orderDir)) {
            const files = fs.readdirSync(orderDir);
            const docTypePrefix = docType.replace(/([A-Z])/g, '_$1').toLowerCase().replace(/^_/, '');
            const matchingFile = files.find(file => 
              file.toLowerCase().includes(docTypePrefix) || 
              file.includes(docInfo.filename?.split('-')[0] || '')
            );
            
            if (matchingFile) {
              const matchingPath = path.join(orderDir, matchingFile);
              console.log(`      🎯 Arquivo similar encontrado: ${matchingFile}`);
              
              if (objectStorage) {
                try {
                  const buffer = fs.readFileSync(matchingPath);
                  const newStorageKey = `${pedido.order_id}/${matchingFile}`;
                  
                  const uint8Array = new Uint8Array(buffer);
                  await objectStorage.uploadFromBytes(newStorageKey, uint8Array);
                  console.log(`      ✅ Arquivo similar migrado: ${newStorageKey}`);
                } catch (altMigrateError) {
                  console.log(`      ❌ Erro na migração do arquivo similar: ${altMigrateError.message}`);
                }
              }
            }
          }
        }
      }
    }

    console.log('\n✅ Diagnóstico concluído');

  } catch (error) {
    console.error('❌ Erro no diagnóstico:', error);
  } finally {
    if (pool) {
      await pool.end();
    }
  }
}

if (require.main === module) {
  fixMissingDocuments()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('💥 Erro crítico:', error);
      process.exit(1);
    });
}

module.exports = { fixMissingDocuments };
