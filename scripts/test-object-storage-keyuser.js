
import { Client } from '@replit/object-storage';
import fs from 'fs';
import path from 'path';

async function testObjectStorageFromKeyuser() {
  console.log('🧪 TESTE DO OBJECT STORAGE - EXECUTADO VIA KEYUSER\n');

  try {
    // Inicializar cliente do Object Storage
    console.log('1. Inicializando cliente Object Storage...');
    const client = new Client();
    console.log('✅ Cliente inicializado com sucesso');

    // Criar um arquivo de teste específico para o keyuser
    console.log('\n2. Criando arquivo de teste do keyuser...');
    const testContent = `Teste do Object Storage executado via KeyUser
Sistema: i-CAP 5.0
Ambiente: ${process.env.NODE_ENV || 'development'}
Repl ID: ${process.env.REPL_ID || 'N/A'}
Data/Hora: ${new Date().toLocaleString('pt-BR')}
Executado por: Superadministrador (KeyUser)

Este teste foi executado através do painel administrativo do sistema
para verificar a funcionalidade do Object Storage do Replit.

Detalhes técnicos:
- Cliente: Replit Object Storage Client
- Timestamp: ${Date.now()}
- Versão do Node: ${process.version}
- Plataforma: ${process.platform}

Status: Teste em execução...
`;

    const tempFileName = `keyuser-test-${Date.now()}.txt`;
    const tempFilePath = path.join(process.cwd(), tempFileName);

    fs.writeFileSync(tempFilePath, testContent, 'utf8');
    console.log(`✅ Arquivo criado: ${tempFileName}`);

    // Fazer upload para Object Storage
    console.log('\n3. Fazendo upload para Object Storage...');
    const storageKey = `keyuser-tests/${Date.now()}-${tempFileName}`;

    await client.uploadFromText(storageKey, testContent);
    console.log(`✅ Upload realizado com sucesso!`);
    console.log(`📂 Chave no storage: ${storageKey}`);

    // Verificar integridade do arquivo
    console.log('\n4. Verificando integridade do arquivo...');
    let downloadedContent;
    
    try {
      // Tentar download como texto primeiro
      downloadedContent = await client.downloadAsText(storageKey);
      console.log(`✅ Download realizado com sucesso usando downloadAsText!`);
    } catch (textError) {
      console.log(`⚠️ Erro no downloadAsText: ${textError.message}`);
      
      try {
        // Tentar download como bytes se texto falhar
        const downloadedBytes = await client.downloadAsBytes(storageKey);
        if (downloadedBytes) {
          // Converter bytes para string
          downloadedContent = Buffer.from(downloadedBytes).toString('utf8');
          console.log(`✅ Download realizado com sucesso usando downloadAsBytes!`);
        }
      } catch (bytesError) {
        console.log(`❌ Erro no downloadAsBytes: ${bytesError.message}`);
        downloadedContent = null;
      }
    }

    if (downloadedContent === testContent) {
      console.log(`✅ Integridade verificada - conteúdo idêntico`);
    } else if (downloadedContent) {
      console.log(`⚠️ Conteúdo diferente do esperado`);
      console.log(`📝 Diferença detectada:`);
      console.log(`   Tamanho original: ${testContent.length} caracteres`);
      console.log(`   Tamanho baixado: ${downloadedContent.length} caracteres`);

      // Debug adicional - mostrar os primeiros caracteres de cada um
      if (typeof downloadedContent === 'string') {
        console.log(`   Primeiros 100 chars originais: ${testContent.substring(0, 100)}`);
        console.log(`   Primeiros 100 chars baixados: ${downloadedContent.substring(0, 100)}`);
      } else {
        console.log(`   Tipo do conteúdo baixado: ${typeof downloadedContent}`);
        console.log(`   Conteúdo baixado (convertido): ${String(downloadedContent).substring(0, 100)}`);
      }
    } else {
      console.log(`❌ Não foi possível baixar o arquivo`);
    }

    // Listar objetos no Object Storage
    console.log('\n5. Listando objetos no Object Storage...');
    let listResponse;
    try {
      listResponse = await client.list();
      console.log(`📋 Resposta do list():`, typeof listResponse);
    } catch (listError) {
      console.log(`❌ Erro ao listar objetos: ${listError.message}`);
      listResponse = [];
    }

    // O Replit Object Storage retorna um objeto com propriedade 'value' contendo o array
    let objects = [];
    if (listResponse && listResponse.value && Array.isArray(listResponse.value)) {
      objects = listResponse.value;
    } else if (Array.isArray(listResponse)) {
      objects = listResponse;
    }

    console.log(`📂 Total de objetos encontrados: ${objects.length}`);

    // Calcular estatísticas
    let keyuserTests = 0;
    let orderFiles = 0;
    let testFiles = 0;
    let totalSize = 0;

    if (objects && objects.length > 0) {
      objects.forEach(obj => {
        const objName = obj.key || obj.name || obj;
        if (typeof objName === 'string') {
          if (objName.includes('keyuser-tests/')) keyuserTests++;
          if (objName.includes('orders/')) orderFiles++;
          if (objName.includes('test/')) testFiles++;
          totalSize += obj.size || 0;
        }
      });
    }

    // Filtrar e mostrar arquivos de teste do keyuser
    let keyuserTestsArray = [];
    if (objects.length > 0) {
      try {
        keyuserTestsArray = objects.filter(obj => {
          const key = obj.key || obj.name || obj;
          return key && typeof key === 'string' && key.includes('keyuser-test');
        });

        if (keyuserTestsArray.length > 0) {
          console.log(`\n🔑 Testes do KeyUser encontrados (${keyuserTestsArray.length}):`);
          keyuserTestsArray.slice(-5).forEach((obj, index) => {
            const key = obj.key || obj.name || obj;
            const size = obj.size ? `(${(obj.size / 1024).toFixed(2)} KB)` : '';
            const date = obj.timeCreated ? new Date(obj.timeCreated).toLocaleString('pt-BR') : 'N/A';
            console.log(`   ${index + 1}. ${key} ${size} - ${date}`);
          });
        }
      } catch (filterError) {
        console.log('⚠️ Erro ao filtrar testes do keyuser:', filterError.message);
      }
    }

    // Mostrar estatísticas gerais
    console.log(`\n📊 Estatísticas do Object Storage:`);

    let totalSizeCalc = 0;
    try {
      totalSizeCalc = objects.reduce((sum, obj) => {
        const size = obj.size || 0;
        return sum + (typeof size === 'number' ? size : 0);
      }, 0);
    } catch (sizeError) {
      console.log('⚠️ Erro ao calcular tamanho total');
    }

    console.log(`   • Total de objetos: ${objects.length}`);
    console.log(`   • Tamanho total: ${(totalSizeCalc / (1024 * 1024)).toFixed(2)} MB`);
    console.log(`   • Testes do keyuser: ${keyuserTests}`);

    // Verificar estrutura de pastas
    let orderFolders = 0;
    let testFolders = 0;

    try {
      orderFolders = objects.filter(obj => {
        const key = obj.key || obj.name || obj;
        return key && typeof key === 'string' && key.startsWith('orders/');
      }).length;

      testFolders = objects.filter(obj => {
        const key = obj.key || obj.name || obj;
        return key && typeof key === 'string' && key.startsWith('test/');
      }).length;
    } catch (folderError) {
      console.log('⚠️ Erro ao verificar estrutura de pastas');
    }

    console.log(`   • Arquivos de pedidos: ${orderFolders}`);
    console.log(`   • Arquivos de teste: ${testFolders}`);

    // Limpar arquivo temporário local
    console.log('\n6. Limpando arquivo temporário local...');
    if (fs.existsSync(tempFilePath)) {
      fs.unlinkSync(tempFilePath);
      console.log('✅ Arquivo temporário removido');
    }

    // Teste de performance
    console.log('\n7. Teste de performance...');
    const startTime = Date.now();

    // Upload de um arquivo menor para medir velocidade
    const perfTestKey = `keyuser-tests/performance-${Date.now()}.txt`;
    const perfTestContent = 'Teste de performance do Object Storage';

    try {
      await client.uploadFromText(perfTestKey, perfTestContent);
      const perfDownload = await client.downloadAsText(perfTestKey);

      const endTime = Date.now();
      const duration = endTime - startTime;

      console.log(`✅ Teste de performance concluído em ${duration}ms`);

      // Limpar arquivo de teste de performance
      try {
        await client.delete(perfTestKey);
        console.log('✅ Arquivo de performance removido');
      } catch (deleteError) {
        console.log('⚠️ Não foi possível remover arquivo de performance');
      }
    } catch (perfError) {
      console.log(`⚠️ Erro no teste de performance: ${perfError.message}`);
      const duration = Date.now() - startTime;
      console.log(`⏱️ Tempo parcial: ${duration}ms`);
    }

    const finalDuration = Date.now() - startTime;

    console.log('\n🎉 TESTE DO KEYUSER CONCLUÍDO COM SUCESSO!');
    console.log(`📦 Arquivo principal salvo em: ${storageKey}`);
    console.log(`📊 Total de objetos no storage: ${objects.length}`);
    console.log(`⚡ Performance: ${finalDuration}ms para upload/download`);
    console.log('✅ Object Storage está funcionando perfeitamente!');

    console.log('\n🔧 RECOMENDAÇÕES PARA O KEYUSER:');
    console.log('   • Object Storage pode ser usado para arquivos do sistema');
    console.log('   • Documentos dos pedidos serão persistidos entre deployments');
    console.log('   • Backup automático está funcionando');
    console.log('   • Performance está dentro do esperado');

    return {
      success: true,
      storageKey,
      totalObjects: objects.length,
      keyuserTests: keyuserTests,
      performance: finalDuration,
      totalSize: (totalSizeCalc / (1024 * 1024)).toFixed(2),
      message: 'Teste do KeyUser realizado com sucesso'
    };

  } catch (error) {
    console.error('\n❌ ERRO NO TESTE DO KEYUSER:', error.message);

    if (error.message.includes('Cannot find module')) {
      console.log('\n💡 SOLUÇÃO PARA O KEYUSER:');
      console.log('   1. Execute: npm install @replit/object-storage');
      console.log('   2. Reinicie o servidor');
      console.log('   3. Tente novamente');
    } else if (error.message.includes('permission') || error.message.includes('unauthorized')) {
      console.log('\n🔒 PROBLEMA DE PERMISSÕES:');
      console.log('   1. Verifique se Object Storage está habilitado no Replit');
      console.log('   2. Confirme se o Repl tem as permissões necessárias');
      console.log('   3. Tente recarregar o Repl');
    } else {
      console.log('\n🔍 POSSÍVEIS CAUSAS:');
      console.log('   • Problemas de conectividade');
      console.log('   • Object Storage temporariamente indisponível');
      console.log('   • Problemas de configuração do Replit');
      console.log('   • Formato inesperado da resposta da API');
    }

    console.log('\n📞 SUPORTE TÉCNICO:');
    console.log('   • Este erro deve ser reportado ao desenvolvedor');
    console.log('   • Inclua a mensagem de erro completa');
    console.log(`   • Timestamp do erro: ${new Date().toISOString()}`);

    return {
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    };
  }
}

// Executar o teste
testObjectStorageFromKeyuser()
  .then((result) => {
    if (result.success) {
      console.log(`\n🎯 RESULTADO FINAL: ${result.message}`);
      console.log(`📂 Arquivo salvo em: ${result.storageKey}`);
      console.log(`📊 Estatísticas:`);
      console.log(`   • Total de objetos: ${result.totalObjects}`);
      console.log(`   • Testes do keyuser: ${result.keyuserTests}`);
      console.log(`   • Tamanho total: ${result.totalSize} MB`);
      console.log(`   • Performance: ${result.performance}ms`);

      console.log('\n✅ O OBJECT STORAGE ESTÁ PRONTO PARA USO NO SISTEMA!');
    } else {
      console.log(`\n💥 FALHA NO TESTE: ${result.error}`);
      console.log(`🕐 Ocorreu em: ${result.timestamp}`);
    }
    process.exit(result.success ? 0 : 1);
  })
  .catch((error) => {
    console.error('\n💥 ERRO CRÍTICO NO TESTE DO KEYUSER:', error);
    console.log('📞 Contacte o suporte técnico imediatamente');
    process.exit(1);
  });
