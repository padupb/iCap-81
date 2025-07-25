
async function listIcapBucketContents() {
  console.log('📂 LISTANDO CONTEÚDO DO BUCKET Icap-NF\n');

  try {
    // Verificar se Object Storage está disponível
    let objectStorage = null;
    try {
      const { Client } = require('@replit/object-storage');
      objectStorage = new Client();
      console.log('✅ Object Storage conectado');
    } catch (error) {
      console.error('❌ Object Storage não disponível:', error.message);
      console.log('\n💡 Instale com: npm install @replit/object-storage');
      return { success: false, error: error.message };
    }

    // Listar todos os objetos
    console.log('🔍 Buscando objetos no storage...');
    const allObjects = await objectStorage.list();
    
    console.log(`📊 Total de objetos no storage: ${allObjects.length}`);

    // Filtrar objetos do bucket Icap-NF
    const icapObjects = allObjects.filter(obj => 
      obj.key.includes('icap-nf') || 
      obj.key.includes('Icap-NF') || 
      obj.key.includes('orders/') ||
      obj.key.startsWith('CO') ||
      obj.key.startsWith('CAP') ||
      obj.key.startsWith('CNI')
    );

    if (icapObjects.length === 0) {
      console.log('\n❌ NENHUM OBJETO ENCONTRADO NO BUCKET Icap-NF');
      console.log('\n📋 Todos os objetos no storage:');
      
      if (allObjects.length === 0) {
        console.log('   (Nenhum objeto encontrado)');
      } else {
        allObjects.slice(0, 10).forEach((obj, index) => {
          console.log(`   ${index + 1}. ${obj.key} (${(obj.size / 1024).toFixed(2)} KB)`);
        });
        if (allObjects.length > 10) {
          console.log(`   ... e mais ${allObjects.length - 10} objetos`);
        }
      }
      
      console.log('\n💡 POSSÍVEIS SOLUÇÕES:');
      console.log('   1. Execute: node scripts/migrate-to-icap-bucket.js');
      console.log('   2. Os arquivos podem estar apenas localmente em uploads/');
      console.log('   3. Verifique se o bucket está configurado corretamente');
      
      return { success: true, count: 0, allObjectsCount: allObjects.length };
    }

    console.log(`\n✅ ENCONTRADOS ${icapObjects.length} OBJETOS NO BUCKET Icap-NF:`);

    // Agrupar por estrutura
    const groupedFiles = {};
    icapObjects.forEach(obj => {
      let category = 'Outros';
      
      if (obj.key.includes('/orders/')) {
        const pathParts = obj.key.split('/');
        const orderIndex = pathParts.findIndex(part => part === 'orders');
        if (orderIndex !== -1 && pathParts[orderIndex + 1]) {
          category = `Pedido: ${pathParts[orderIndex + 1]}`;
        }
      } else if (obj.key.match(/^(CO|CAP|CNI)/)) {
        category = `Pedido: ${obj.key.split('/')[0]}`;
      }

      if (!groupedFiles[category]) {
        groupedFiles[category] = [];
      }
      
      groupedFiles[category].push({
        key: obj.key,
        size: (obj.size / 1024).toFixed(2) + ' KB',
        filename: obj.key.split('/').pop()
      });
    });

    // Mostrar arquivos agrupados
    Object.keys(groupedFiles).sort().forEach(category => {
      console.log(`\n📁 ${category}:`);
      groupedFiles[category].forEach(file => {
        console.log(`   • ${file.filename} (${file.size})`);
        console.log(`     Chave: ${file.key}`);
      });
    });

    console.log(`\n📊 RESUMO:`);
    console.log(`   📦 Objetos no Icap-NF: ${icapObjects.length}`);
    console.log(`   📁 Categorias: ${Object.keys(groupedFiles).length}`);
    console.log(`   💾 Total no storage: ${allObjects.length}`);

    return { success: true, count: icapObjects.length, categories: Object.keys(groupedFiles).length };

  } catch (error) {
    console.error('❌ Erro ao listar bucket:', error);
    return { success: false, error: error.message };
  }
}

// Executar listagem
if (require.main === module) {
  listIcapBucketContents()
    .then((result) => {
      if (result.success) {
        if (result.count > 0) {
          console.log('\n🎉 Listagem concluída!');
        } else {
          console.log('\n⚠️ Bucket vazio - considere migrar arquivos locais');
        }
      } else {
        console.log('\n💥 Erro na listagem:', result.error);
      }
      process.exit(result.success ? 0 : 1);
    })
    .catch((error) => {
      console.error('\n💥 Erro crítico:', error);
      process.exit(1);
    });
}

module.exports = { listIcapBucketContents };
