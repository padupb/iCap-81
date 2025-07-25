
const fs = require('fs');

async function testObjectStorage() {
  console.log('🔧 TESTANDO OBJECT STORAGE\n');

  try {
    // Tentar importar o Client do Object Storage
    console.log('1. Verificando se @replit/object-storage está instalado...');
    const { Client } = require('@replit/object-storage');
    console.log('✅ Pacote @replit/object-storage encontrado');

    // Tentar inicializar o cliente
    console.log('2. Inicializando cliente Object Storage...');
    const objectStorage = new Client();
    console.log('✅ Cliente Object Storage inicializado');

    // Tentar listar objetos
    console.log('3. Tentando listar objetos...');
    const objects = await objectStorage.list();
    console.log(`✅ Listagem concluída - ${objects.length} objetos encontrados`);

    // Mostrar alguns objetos como exemplo
    if (objects.length > 0) {
      console.log('\n📋 Primeiros 5 objetos:');
      objects.slice(0, 5).forEach((obj, index) => {
        console.log(`   ${index + 1}. ${obj.key} (${(obj.size / 1024).toFixed(2)} KB)`);
      });
    }

    return { success: true, count: objects.length };

  } catch (error) {
    console.error('❌ Erro no teste:', error.message);
    
    if (error.message.includes('Cannot find module')) {
      console.log('\n💡 Solução: Execute o comando:');
      console.log('   npm install @replit/object-storage');
    }
    
    return { success: false, error: error.message };
  }
}

// Testar também o sistema de arquivos local
async function testLocalStorage() {
  console.log('\n🗂️ TESTANDO SISTEMA DE ARQUIVOS LOCAL\n');

  const uploadsDir = './uploads';
  
  if (!fs.existsSync(uploadsDir)) {
    console.log('❌ Diretório uploads não encontrado');
    return { success: false, error: 'Diretório não encontrado' };
  }

  try {
    const folders = fs.readdirSync(uploadsDir, { withFileTypes: true })
      .filter(dirent => dirent.isDirectory())
      .map(dirent => dirent.name);

    console.log(`✅ Encontradas ${folders.length} pastas de pedidos:`);
    
    let totalFiles = 0;
    folders.forEach(folder => {
      const folderPath = `${uploadsDir}/${folder}`;
      const files = fs.readdirSync(folderPath);
      totalFiles += files.length;
      console.log(`   📁 ${folder}: ${files.length} arquivo(s)`);
    });

    console.log(`📊 Total: ${totalFiles} arquivos em ${folders.length} pedidos`);
    
    return { success: true, folders: folders.length, files: totalFiles };

  } catch (error) {
    console.error('❌ Erro ao listar arquivos locais:', error.message);
    return { success: false, error: error.message };
  }
}

// Executar testes
async function runTests() {
  console.log('🧪 INICIANDO TESTES DE STORAGE\n');
  console.log('='.repeat(50));

  const objectStorageResult = await testObjectStorage();
  console.log('\n' + '='.repeat(50));
  
  const localStorageResult = await testLocalStorage();
  console.log('\n' + '='.repeat(50));

  console.log('\n📊 RESUMO DOS TESTES:');
  console.log(`   Object Storage: ${objectStorageResult.success ? '✅ OK' : '❌ FALHOU'}`);
  console.log(`   Sistema Local: ${localStorageResult.success ? '✅ OK' : '❌ FALHOU'}`);

  if (objectStorageResult.success && localStorageResult.success) {
    console.log('\n🎉 Todos os testes passaram!');
    console.log(`   📦 Object Storage: ${objectStorageResult.count} objetos`);
    console.log(`   🗂️ Sistema Local: ${localStorageResult.files} arquivos em ${localStorageResult.folders} pedidos`);
  } else {
    console.log('\n⚠️ Alguns testes falharam - verifique os logs acima');
  }

  process.exit(objectStorageResult.success && localStorageResult.success ? 0 : 1);
}

if (require.main === module) {
  runTests()
    .catch((error) => {
      console.error('\n💥 Erro crítico nos testes:', error);
      process.exit(1);
    });
}

module.exports = { testObjectStorage, testLocalStorage };
