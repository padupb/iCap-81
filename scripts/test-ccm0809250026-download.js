
const { Pool } = require('pg');

async function testCCM0809250026Download() {
  console.log('🔍 TESTANDO DOWNLOAD ESPECÍFICO DO PEDIDO CCM0809250026\n');

  try {
    // Verificar banco de dados
    if (!process.env.DATABASE_URL) {
      console.error('❌ DATABASE_URL não configurada!');
      return;
    }

    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false }
    });

    // Verificar Object Storage
    console.log('1. Verificando Object Storage...');
    const { Client } = require('@replit/object-storage');
    const objectStorage = new Client();
    console.log('✅ Object Storage inicializado');

    // Buscar informações do pedido no banco
    console.log('\n2. Buscando pedido CCM0809250026 no banco...');
    const pedidoResult = await pool.query(`
      SELECT id, order_id, documentoscarregados, documentosinfo 
      FROM orders 
      WHERE order_id = 'CCM0809250026'
    `);

    if (pedidoResult.rows.length === 0) {
      console.log('❌ Pedido CCM0809250026 não encontrado no banco');
      return;
    }

    const pedido = pedidoResult.rows[0];
    console.log(`✅ Pedido encontrado: ID ${pedido.id}`);
    console.log(`📄 Documentos carregados: ${pedido.documentoscarregados}`);

    if (!pedido.documentosinfo) {
      console.log('❌ Nenhuma informação de documentos encontrada');
      return;
    }

    const documentosInfo = typeof pedido.documentosinfo === 'string' 
      ? JSON.parse(pedido.documentosinfo) 
      : pedido.documentosinfo;

    console.log('\n3. Informações dos documentos:');
    Object.keys(documentosInfo).forEach(tipo => {
      const doc = documentosInfo[tipo];
      console.log(`   ${tipo}:`);
      console.log(`     - Nome: ${doc.name}`);
      console.log(`     - Arquivo: ${doc.filename}`);
      console.log(`     - Storage Key: ${doc.storageKey}`);
      console.log(`     - Tamanho: ${doc.size} bytes`);
    });

    // Testar busca no Object Storage
    console.log('\n4. Testando busca no Object Storage...');
    const objects = await objectStorage.list();
    console.log(`✅ Total de objetos no storage: ${objects.length}`);

    // Procurar arquivos relacionados ao pedido
    const relatedObjects = objects.filter(obj => 
      obj.key.includes('CCM0809250026') || 
      obj.key.includes('orders/CCM0809250026')
    );

    console.log(`\n📋 Arquivos relacionados a CCM0809250026 (${relatedObjects.length}):`);
    relatedObjects.forEach(obj => {
      console.log(`   • ${obj.key} (${(obj.size / 1024).toFixed(2)} KB)`);
    });

    // Testar download de cada documento
    console.log('\n5. Testando downloads...');
    for (const [tipo, doc] of Object.entries(documentosInfo)) {
      console.log(`\n📥 Testando download de ${tipo}:`);
      console.log(`   Storage Key: ${doc.storageKey}`);

      try {
        const result = await objectStorage.downloadAsBytes(doc.storageKey);
        
        let rawData;
        if (result && typeof result === 'object' && result.ok && result.value) {
          rawData = result.value;
        } else if (result && result.length !== undefined) {
          rawData = result;
        } else {
          rawData = result;
        }

        if (rawData && rawData.length > 0) {
          console.log(`   ✅ Download bem-sucedido: ${rawData.length} bytes`);
          
          // Verificar se é PDF válido
          if (tipo.includes('pdf')) {
            const isValidPdf = rawData[0] === 0x25 && 
                              rawData[1] === 0x50 && 
                              rawData[2] === 0x44 && 
                              rawData[3] === 0x46;
            console.log(`   📄 PDF válido: ${isValidPdf ? 'Sim' : 'Não'}`);
          }
        } else {
          console.log(`   ❌ Download retornou dados vazios`);
        }
      } catch (error) {
        console.log(`   ❌ Erro no download: ${error.message}`);
        
        // Tentar chaves alternativas
        const alternativeKeys = [
          `orders/CCM0809250026/${doc.filename}`,
          `CCM0809250026/${doc.filename}`,
          doc.filename
        ];

        for (const altKey of alternativeKeys) {
          if (altKey !== doc.storageKey) {
            try {
              console.log(`   🔄 Tentando chave alternativa: ${altKey}`);
              const altResult = await objectStorage.downloadAsBytes(altKey);
              
              let altRawData;
              if (altResult && typeof altResult === 'object' && altResult.ok && altResult.value) {
                altRawData = altResult.value;
              } else if (altResult && altResult.length !== undefined) {
                altRawData = altResult;
              } else {
                altRawData = altResult;
              }

              if (altRawData && altRawData.length > 0) {
                console.log(`   ✅ Encontrado com chave alternativa: ${altRawData.length} bytes`);
                console.log(`   💡 Chave correta: ${altKey}`);
                break;
              }
            } catch (altError) {
              console.log(`   ⚠️ Chave alternativa falhou: ${altError.message}`);
            }
          }
        }
      }
    }

    console.log('\n✅ Teste concluído');
    
  } catch (error) {
    console.error('\n❌ ERRO NO TESTE:', error.message);
    console.error('Stack:', error.stack);
  }
}

// Executar teste
testCCM0809250026Download()
  .then(() => {
    console.log('\n🏁 Teste finalizado');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Erro fatal:', error);
    process.exit(1);
  });
