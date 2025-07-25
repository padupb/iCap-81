
const fs = require('fs');
const path = require('path');

async function listObjectStorageFiles() {
  console.log('📂 LISTANDO TODOS OS ARQUIVOS NO OBJECT STORAGE\n');

  try {
    // Configurar Object Storage
    let objectStorage = null;
    try {
      const { Client } = require('@replit/object-storage');
      objectStorage = new Client();
      console.log("✅ Object Storage do Replit configurado e inicializado");
    } catch (error) {
      console.error("❌ Object Storage não disponível:", error.message);
      console.log("📦 Para usar Object Storage, instale: npm install @replit/object-storage");
      return;
    }

    // Listar todos os objetos
    console.log('📋 Listando todos os objetos no storage...');
    const objects = await objectStorage.list();

    if (!objects || objects.length === 0) {
      console.log('❌ Nenhum objeto encontrado no Object Storage');
      return;
    }

    console.log(`✅ Encontrados ${objects.length} objetos:`);
    console.log('==========================================');

    // Agrupar por pedido (orderId)
    const groupedFiles = {};
    
    for (const obj of objects) {
      // Extrair orderId do caminho (formato: orders/{orderId}/{filename})
      const pathParts = obj.key.split('/');
      if (pathParts.length >= 3 && pathParts[0] === 'orders') {
        const orderId = pathParts[1];
        const filename = pathParts[2];
        
        if (!groupedFiles[orderId]) {
          groupedFiles[orderId] = [];
        }
        
        groupedFiles[orderId].push({
          filename: filename,
          size: obj.size,
          key: obj.key
        });
      } else {
        // Arquivo não segue o padrão de orders
        if (!groupedFiles['outros']) {
          groupedFiles['outros'] = [];
        }
        groupedFiles['outros'].push({
          filename: obj.key,
          size: obj.size,
          key: obj.key
        });
      }
    }

    // Exibir arquivos agrupados por pedido
    for (const [orderId, files] of Object.entries(groupedFiles)) {
      console.log(`\n📦 Pedido: ${orderId}`);
      console.log(`   📁 ${files.length} arquivo(s):`);
      
      files.forEach(file => {
        const sizeKB = (file.size / 1024).toFixed(2);
        console.log(`   📄 ${file.filename} (${sizeKB} KB)`);
        console.log(`      🔗 Key: ${file.key}`);
      });
    }

    console.log('\n==========================================');
    console.log(`📊 Resumo: ${objects.length} arquivos em ${Object.keys(groupedFiles).length} pedidos`);

  } catch (error) {
    console.error('❌ Erro ao listar arquivos:', error.message);
  }
}

// Função para fazer download de um arquivo específico
async function downloadFile(key, outputPath) {
  try {
    const { Client } = require('@replit/object-storage');
    const objectStorage = new Client();
    
    console.log(`📥 Baixando arquivo: ${key}`);
    const buffer = await objectStorage.downloadAsBuffer(key);
    
    // Criar diretório se não existir
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    fs.writeFileSync(outputPath, buffer);
    console.log(`✅ Arquivo salvo em: ${outputPath}`);
    
  } catch (error) {
    console.error(`❌ Erro ao baixar arquivo ${key}:`, error.message);
  }
}

if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.length === 2 && args[0] === 'download') {
    // Modo download: node script.js download orders/CO12407250008/nota_pdf-1753400107399.pdf
    const key = args[1];
    const filename = path.basename(key);
    const outputPath = path.join(process.cwd(), 'downloads', filename);
    
    downloadFile(key, outputPath)
      .then(() => console.log('\n✅ Download concluído'))
      .catch((error) => console.error('\n❌ Erro no download:', error));
  } else {
    // Modo listagem
    listObjectStorageFiles()
      .then(() => {
        console.log('\n✅ Listagem concluída');
        console.log('\n💡 Para baixar um arquivo, use:');
        console.log('   node scripts/list-object-storage-files.js download orders/{orderId}/{filename}');
        process.exit(0);
      })
      .catch((error) => {
        console.error('\n❌ Erro na listagem:', error);
        process.exit(1);
      });
  }
}

module.exports = { listObjectStorageFiles, downloadFile };
