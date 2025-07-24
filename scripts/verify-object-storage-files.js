const fs = require('fs');
const path = require('path');

async function verifyObjectStorageFiles() {
  console.log('🔍 VERIFICANDO ARQUIVOS NO OBJECT STORAGE\n');

  try {
    // Verificar se o módulo está disponível
    let client;
    try {
      const { getClient } = require('@replit/object-storage');
      client = getClient();
      console.log('✅ Object Storage cliente inicializado');
    } catch (importError) {
      console.log('❌ Object Storage não disponível:', importError.message);
      console.log('💡 Verificando arquivos locais em uploads/...\n');

      // Verificar arquivos locais
      const uploadsDir = path.join(process.cwd(), 'uploads');
      if (fs.existsSync(uploadsDir)) {
        const directories = fs.readdirSync(uploadsDir, { withFileTypes: true })
          .filter(dirent => dirent.isDirectory())
          .map(dirent => dirent.name);

        console.log(`📁 Encontrados ${directories.length} diretórios de pedidos:`);

        for (const dir of directories) {
          const dirPath = path.join(uploadsDir, dir);
          const files = fs.readdirSync(dirPath);
          console.log(`   📦 ${dir}: ${files.length} arquivos - ${files.join(', ')}`);
        }
      } else {
        console.log('❌ Diretório uploads/ não encontrado');
      }
      return;
    }

    // Listar todos os objetos
    console.log('📦 Listando todos os objetos no storage...');
    const objects = await client.list();

    if (!objects || objects.length === 0) {
      console.log('❌ Nenhum objeto encontrado no Object Storage');
      return;
    }

    console.log(`✅ Encontrados ${objects.length} objetos:`);

    for (const obj of objects) {
      console.log(`   📄 ${obj.key} (${obj.size} bytes)`);
    }

  } catch (error) {
    console.error('❌ Erro ao verificar:', error.message);
  }
}

if (require.main === module) {
  verifyObjectStorageFiles()
    .then(() => {
      console.log('\n✅ Verificação concluída');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Erro na verificação:', error);
      process.exit(1);
    });
}

module.exports = { verifyObjectStorageFiles };