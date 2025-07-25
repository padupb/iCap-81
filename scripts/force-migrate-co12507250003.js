
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

async function forceMigrateCO12507250003() {
  console.log('🔄 FORÇANDO MIGRAÇÃO DO PEDIDO CO12507250003\n');
  
  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL não configurada nos Secrets!');
    return;
  }
  
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false
    }
  });

  try {
    // 1. Verificar Object Storage
    let objectStorage = null;
    try {
      const { Client } = require('@replit/object-storage');
      objectStorage = new Client();
      console.log('✅ Object Storage inicializado');
    } catch (error) {
      console.error('❌ Object Storage não disponível:', error.message);
      console.log('💡 Execute: npm install @replit/object-storage');
      return;
    }

    // 2. Verificar arquivos locais
    const localDir = path.join(process.cwd(), 'uploads', 'CO12507250003');
    
    if (!fs.existsSync(localDir)) {
      console.log('❌ Diretório local não existe:', localDir);
      return;
    }

    const files = fs.readdirSync(localDir);
    console.log(`📁 Encontrados ${files.length} arquivos para migrar:`, files);

    const documentosInfo = {};

    // 3. Migrar cada arquivo
    for (const filename of files) {
      const filePath = path.join(localDir, filename);
      
      try {
        console.log(`📤 Migrando ${filename}...`);
        
        // Ler arquivo
        const buffer = fs.readFileSync(filePath);
        
        // Definir chave no Object Storage
        const storageKey = `orders/CO12507250003/${filename}`;
        
        // Upload para Object Storage
        await objectStorage.uploadFromBuffer(storageKey, buffer);
        
        console.log(`✅ ${filename} migrado para: ${storageKey}`);
        
        // Determinar tipo do documento
        let docType = 'outro';
        if (filename.includes('nota_pdf')) docType = 'nota_pdf';
        else if (filename.includes('nota_xml')) docType = 'nota_xml';
        else if (filename.includes('certificado_pdf')) docType = 'certificado_pdf';
        else if (filename.includes('nota_assinada')) docType = 'foto_confirmacao';
        
        // Obter stats do arquivo
        const stats = fs.statSync(filePath);
        
        if (docType !== 'outro') {
          documentosInfo[docType] = {
            name: filename,
            filename: filename,
            size: stats.size,
            path: filePath,
            storageKey: storageKey,
            date: stats.birthtime.toISOString()
          };
        }
        
      } catch (error) {
        console.error(`❌ Erro ao migrar ${filename}:`, error);
      }
    }

    // 4. Atualizar banco de dados
    if (Object.keys(documentosInfo).length > 0) {
      console.log('\n📊 Atualizando banco de dados...');
      
      await pool.query(`
        UPDATE orders SET 
        documentoscarregados = true, 
        documentosinfo = $1 
        WHERE order_id = $2
      `, [JSON.stringify(documentosInfo), 'CO12507250003']);
      
      console.log('✅ Banco de dados atualizado');
      console.log('📄 Documentos migrados:', Object.keys(documentosInfo));
      
      // Mostrar estrutura final
      console.log('\n📋 Estrutura final dos documentos:');
      for (const [tipo, info] of Object.entries(documentosInfo)) {
        console.log(`   • ${tipo}:`);
        console.log(`     - Storage Key: ${info.storageKey}`);
        console.log(`     - Size: ${(info.size / 1024).toFixed(2)} KB`);
      }
    }

    console.log('\n🎉 Migração concluída com sucesso!');
    
  } catch (error) {
    console.error('❌ Erro durante a migração:', error);
  } finally {
    await pool.end();
  }
}

// Executar migração
forceMigrateCO12507250003().catch(console.error);
