
const fs = require('fs');
const path = require('path');

async function migrateToIcapBucket() {
  console.log('🔄 MIGRANDO ARQUIVOS PARA OBJECT STORAGE (Bucket Icap-NF)\n');

  try {
    // 1. Verificar se Object Storage está disponível
    let objectStorage = null;
    try {
      const { Client } = require('@replit/object-storage');
      objectStorage = new Client();
      console.log('✅ Object Storage do Replit inicializado');
    } catch (error) {
      console.error('❌ Object Storage não disponível:', error.message);
      console.log('\n💡 Para resolver, execute:');
      console.log('   npm install @replit/object-storage');
      return { success: false, error: 'Object Storage não instalado' };
    }

    // 2. Verificar diretório uploads
    const uploadsDir = path.join(process.cwd(), 'uploads');
    
    if (!fs.existsSync(uploadsDir)) {
      console.log('❌ Diretório uploads/ não encontrado');
      return { success: false, error: 'Diretório uploads não existe' };
    }

    // 3. Listar todos os pedidos no diretório uploads
    const orderDirs = fs.readdirSync(uploadsDir, { withFileTypes: true })
      .filter(dirent => dirent.isDirectory())
      .map(dirent => dirent.name);

    console.log(`📁 Encontrados ${orderDirs.length} diretórios de pedidos para migrar:`);
    orderDirs.forEach(dir => console.log(`   - ${dir}`));

    let totalFilesMigrated = 0;
    let totalErrors = 0;

    // 4. Migrar cada pedido
    for (const orderDir of orderDirs) {
      console.log(`\n📦 Processando pedido: ${orderDir}`);
      
      const orderPath = path.join(uploadsDir, orderDir);
      const files = fs.readdirSync(orderPath);

      if (files.length === 0) {
        console.log('   ⚠️ Nenhum arquivo encontrado');
        continue;
      }

      console.log(`   📄 Arquivos encontrados: ${files.join(', ')}`);

      // Migrar cada arquivo
      for (const filename of files) {
        const filePath = path.join(orderPath, filename);
        
        try {
          // Ler arquivo
          const buffer = fs.readFileSync(filePath);
          
          // Definir chave no Object Storage
          const storageKey = `icap-nf/orders/${orderDir}/${filename}`;
          
          // Upload para Object Storage
          await objectStorage.uploadFromBuffer(storageKey, buffer);
          
          console.log(`   ✅ ${filename} → ${storageKey}`);
          totalFilesMigrated++;
          
        } catch (error) {
          console.error(`   ❌ Erro ao migrar ${filename}:`, error.message);
          totalErrors++;
        }
      }
    }

    // 5. Verificar migração listando objetos
    console.log('\n🔍 Verificando arquivos migrados...');
    const objects = await objectStorage.list();
    const icapObjects = objects.filter(obj => obj.key.startsWith('icap-nf/'));
    
    console.log(`📊 RESUMO DA MIGRAÇÃO:`);
    console.log(`   ✅ Arquivos migrados: ${totalFilesMigrated}`);
    console.log(`   ❌ Erros: ${totalErrors}`);
    console.log(`   📦 Total no bucket Icap-NF: ${icapObjects.length}`);

    // 6. Mostrar estrutura migrada
    if (icapObjects.length > 0) {
      console.log('\n📋 ARQUIVOS NO BUCKET Icap-NF:');
      
      // Agrupar por pedido
      const groupedFiles = {};
      icapObjects.forEach(obj => {
        const pathParts = obj.key.split('/');
        if (pathParts.length >= 3) {
          const orderDir = pathParts[2];
          const filename = pathParts[3];
          
          if (!groupedFiles[orderDir]) {
            groupedFiles[orderDir] = [];
          }
          groupedFiles[orderDir].push({
            filename,
            size: (obj.size / 1024).toFixed(2) + ' KB',
            key: obj.key
          });
        }
      });

      Object.keys(groupedFiles).forEach(orderDir => {
        console.log(`\n📁 ${orderDir}:`);
        groupedFiles[orderDir].forEach(file => {
          console.log(`   • ${file.filename} (${file.size})`);
        });
      });
    }

    return {
      success: true,
      totalFilesMigrated,
      totalErrors,
      objectsInBucket: icapObjects.length
    };

  } catch (error) {
    console.error('❌ Erro crítico na migração:', error);
    return { success: false, error: error.message };
  }
}

// Executar migração
if (require.main === module) {
  migrateToIcapBucket()
    .then((result) => {
      if (result.success) {
        console.log('\n🎉 Migração concluída com sucesso!');
        console.log(`📊 ${result.totalFilesMigrated} arquivos agora estão disponíveis no bucket Icap-NF`);
      } else {
        console.log('\n💥 Migração falhou:', result.error);
      }
      process.exit(result.success ? 0 : 1);
    })
    .catch((error) => {
      console.error('\n💥 Erro crítico:', error);
      process.exit(1);
    });
}

module.exports = { migrateToIcapBucket };
