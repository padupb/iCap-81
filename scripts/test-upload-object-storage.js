
import { Client } from '@replit/object-storage';
import fs from 'fs';
import path from 'path';

async function testUploadObjectStorage() {
  console.log('🧪 TESTANDO UPLOAD NO OBJECT STORAGE\n');

  try {
    // Inicializar cliente do Object Storage
    console.log('1. Inicializando cliente Object Storage...');
    const client = new Client();
    console.log('✅ Cliente inicializado com sucesso');

    // Criar um arquivo de teste temporário
    console.log('\n2. Criando arquivo de teste...');
    const testContent = `Arquivo de teste criado em ${new Date().toISOString()}
Este é um teste do Object Storage no Replit.
Sistema: i-CAP 5.0
Usuário: Sistema de teste
Data: ${new Date().toLocaleDateString('pt-BR')}
Hora: ${new Date().toLocaleTimeString('pt-BR')}

Detalhes do teste:
- Object Storage: Replit
- Ambiente: ${process.env.NODE_ENV || 'development'}
- Repl ID: ${process.env.REPL_ID || 'N/A'}
`;

    const tempFileName = 'teste-arquivo-temporario.txt';
    const tempFilePath = path.join(process.cwd(), tempFileName);
    
    fs.writeFileSync(tempFilePath, testContent, 'utf8');
    console.log(`✅ Arquivo criado: ${tempFileName}`);

    // Fazer upload para Object Storage
    console.log('\n3. Fazendo upload para Object Storage...');
    const storageKey = `test/uploads/${Date.now()}-${tempFileName}`;
    
    await client.uploadFromText(storageKey, testContent);
    console.log(`✅ Upload realizado com sucesso!`);
    console.log(`📂 Chave no storage: ${storageKey}`);

    // Verificar se o arquivo foi carregado
    console.log('\n4. Verificando se o arquivo foi carregado...');
    const downloadedContent = await client.downloadAsText(storageKey);
    console.log('✅ Download realizado com sucesso!');
    
    // Verificar se o conteúdo está correto
    if (downloadedContent === testContent) {
      console.log('✅ Conteúdo verificado - arquivo íntegro!');
    } else {
      console.log('⚠️ Conteúdo diferente do esperado');
    }

    // Listar arquivos no storage
    console.log('\n5. Listando arquivos no Object Storage...');
    const objects = await client.list();
    console.log(`📂 Total de objetos encontrados: ${objects.length}`);
    
    // Mostrar alguns arquivos como exemplo
    if (objects.length > 0) {
      console.log('\n📋 Últimos 5 objetos no storage:');
      objects.slice(-5).forEach((obj, index) => {
        const size = obj.size ? `(${(obj.size / 1024).toFixed(2)} KB)` : '';
        console.log(`   ${index + 1}. ${obj.key} ${size}`);
      });
    }

    // Limpar arquivo temporário local
    console.log('\n6. Limpando arquivo temporário local...');
    if (fs.existsSync(tempFilePath)) {
      fs.unlinkSync(tempFilePath);
      console.log('✅ Arquivo temporário removido');
    }

    console.log('\n🎉 TESTE CONCLUÍDO COM SUCESSO!');
    console.log(`📦 Arquivo "${storageKey}" está disponível no Object Storage`);
    console.log('✅ Object Storage está funcionando perfeitamente!');

    return {
      success: true,
      storageKey,
      totalObjects: objects.length,
      message: 'Upload realizado com sucesso'
    };

  } catch (error) {
    console.error('\n❌ ERRO NO TESTE:', error.message);
    
    if (error.message.includes('Cannot find module')) {
      console.log('\n💡 SOLUÇÃO:');
      console.log('   npm install @replit/object-storage');
    } else {
      console.log('\n🔍 POSSÍVEIS CAUSAS:');
      console.log('   - Problemas de conectividade');
      console.log('   - Object Storage não habilitado no Repl');
      console.log('   - Permissões insuficientes');
    }

    return {
      success: false,
      error: error.message
    };
  }
}

// Executar o teste
testUploadObjectStorage()
  .then((result) => {
    if (result.success) {
      console.log(`\n🎯 RESULTADO: ${result.message}`);
      console.log(`📂 Arquivo salvo em: ${result.storageKey}`);
      console.log(`📊 Total de objetos no storage: ${result.totalObjects}`);
    } else {
      console.log(`\n💥 FALHA: ${result.error}`);
    }
    process.exit(result.success ? 0 : 1);
  })
  .catch((error) => {
    console.error('\n💥 ERRO CRÍTICO:', error);
    process.exit(1);
  });
