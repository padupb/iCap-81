
const path = require('path');
const fs = require('fs');
const { pool } = require('../server/db.js');

async function checkCO12407250007Files() {
  try {
    console.log('🔍 Verificando arquivos do pedido CO12407250007...\n');
    
    // 1. Buscar o pedido no banco
    const pedidoResult = await pool.query(
      "SELECT * FROM orders WHERE order_id = $1",
      ['CO12407250007']
    );
    
    if (pedidoResult.rows.length === 0) {
      console.log('❌ Pedido CO12407250007 não encontrado no banco');
      return;
    }
    
    const pedido = pedidoResult.rows[0];
    console.log('📦 Pedido encontrado:', {
      id: pedido.id,
      order_id: pedido.order_id,
      status: pedido.status,
      documentoscarregados: pedido.documentoscarregados,
      temDocumentosInfo: !!pedido.documentosinfo
    });
    
    // 2. Verificar se há informações de documentos
    if (pedido.documentosinfo) {
      console.log('\n📄 Informações dos documentos encontradas:');
      try {
        const documentosInfo = JSON.parse(pedido.documentosinfo);
        
        for (const [tipo, info] of Object.entries(documentosInfo)) {
          console.log(`\n📋 ${tipo.toUpperCase()}:`);
          console.log(`  • Nome: ${info.name}`);
          console.log(`  • Filename: ${info.filename}`);
          console.log(`  • Tamanho: ${info.size} bytes`);
          console.log(`  • Path local: ${info.path}`);
          console.log(`  • Storage Key: ${info.storageKey || 'Não definido'}`);
          console.log(`  • Data: ${info.date}`);
          
          // Verificar se arquivo existe localmente
          if (info.path && fs.existsSync(info.path)) {
            console.log(`  ✅ Arquivo existe localmente`);
          } else {
            console.log(`  ❌ Arquivo NÃO existe localmente`);
          }
        }
      } catch (error) {
        console.error('❌ Erro ao parsear documentosinfo:', error);
      }
    } else {
      console.log('\n⚠️ Nenhuma informação de documentos encontrada no banco');
    }
    
    // 3. Verificar diretório local do pedido
    const orderDir = path.join(process.cwd(), 'uploads', 'CO12407250007');
    console.log(`\n📂 Verificando diretório local: ${orderDir}`);
    
    if (fs.existsSync(orderDir)) {
      console.log('✅ Diretório existe');
      const files = fs.readdirSync(orderDir);
      console.log(`📁 Arquivos no diretório (${files.length}):`, files);
      
      // Detalhes de cada arquivo
      files.forEach(file => {
        const filePath = path.join(orderDir, file);
        const stats = fs.statSync(filePath);
        console.log(`  • ${file}: ${stats.size} bytes, criado em ${stats.birthtime}`);
      });
    } else {
      console.log('❌ Diretório não existe');
    }
    
    // 4. Verificar configuração do Object Storage
    console.log('\n🔧 Verificando Object Storage...');
    
    let objectStorageAvailable = false;
    try {
      const { Client } = require('@replit/object-storage');
      const client = new Client();
      console.log('✅ Object Storage Client disponível');
      objectStorageAvailable = true;
      
      // Tentar listar objetos para o pedido
      try {
        // Esta é uma operação que pode falhar se não houver objetos
        console.log('🔍 Tentando verificar objetos no bucket...');
        // Nota: não temos uma função de listagem direta, então vamos tentar acessar um arquivo conhecido
      } catch (listError) {
        console.log('⚠️ Não foi possível listar objetos:', listError.message);
      }
      
    } catch (error) {
      console.log('❌ Object Storage não disponível:', error.message);
    }
    
    // 5. Sugestões de correção
    console.log('\n💡 Diagnóstico e Sugestões:');
    
    if (!pedido.documentoscarregados) {
      console.log('❌ PROBLEMA: documentoscarregados = false no banco');
      console.log('🔧 SOLUÇÃO: Documentos podem não ter sido salvos corretamente');
    }
    
    if (!pedido.documentosinfo) {
      console.log('❌ PROBLEMA: documentosinfo está vazio no banco');
      console.log('🔧 SOLUÇÃO: Upload não foi concluído com sucesso');
    }
    
    if (!objectStorageAvailable) {
      console.log('❌ PROBLEMA: Object Storage não está disponível');
      console.log('🔧 SOLUÇÃO: Instalar @replit/object-storage ou verificar configuração');
    }
    
    console.log('\n✅ Verificação concluída!');
    
  } catch (error) {
    console.error('❌ Erro durante a verificação:', error);
  } finally {
    if (pool) {
      await pool.end();
    }
  }
}

checkCO12407250007Files();
