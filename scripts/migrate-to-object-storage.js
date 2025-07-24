
const path = require('path');
const fs = require('fs');
const { pool } = require('../server/db.js');

async function migrateToObjectStorage(orderId) {
  try {
    console.log(`🔄 Migrando arquivos do pedido ${orderId} para Object Storage...`);
    
    // Verificar se Object Storage está disponível
    let objectStorage = null;
    try {
      const { Client } = require('@replit/object-storage');
      objectStorage = new Client();
      console.log("✅ Object Storage do Replit configurado e inicializado");
    } catch (error) {
      console.log("❌ Object Storage não disponível:", error.message);
      console.log("📦 Para usar Object Storage, instale: npm install @replit/object-storage");
      return;
    }
    
    // Buscar o pedido
    const pedidoResult = await pool.query(
      "SELECT * FROM orders WHERE order_id = $1",
      [orderId]
    );
    
    if (pedidoResult.rows.length === 0) {
      console.log(`❌ Pedido ${orderId} não encontrado`);
      return;
    }
    
    const pedido = pedidoResult.rows[0];
    const orderDir = path.join(process.cwd(), 'uploads', orderId);
    
    if (!fs.existsSync(orderDir)) {
      console.log(`❌ Diretório ${orderDir} não existe`);
      return;
    }
    
    const files = fs.readdirSync(orderDir);
    console.log(`📁 Encontrados ${files.length} arquivos para migrar`);
    
    const documentosInfo = {};
    
    for (const filename of files) {
      const filePath = path.join(orderDir, filename);
      
      try {
        console.log(`📤 Migrando ${filename}...`);
        
        // Ler o arquivo
        const buffer = fs.readFileSync(filePath);
        
        // Fazer upload para Object Storage
        const key = `orders/${orderId}/${filename}`;
        await objectStorage.uploadFromBuffer(key, buffer);
        
        console.log(`✅ ${filename} migrado para Object Storage: ${key}`);
        
        // Determinar o tipo do documento
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
            storageKey: key,
            date: stats.birthtime.toISOString()
          };
        }
        
      } catch (error) {
        console.error(`❌ Erro ao migrar ${filename}:`, error);
      }
    }
    
    // Atualizar o banco com as informações dos documentos
    if (Object.keys(documentosInfo).length > 0) {
      console.log('\n📊 Atualizando banco de dados...');
      
      await pool.query(
        `UPDATE orders SET 
         documentoscarregados = true, 
         documentosinfo = $1 
         WHERE order_id = $2`,
        [JSON.stringify(documentosInfo), orderId]
      );
      
      console.log('✅ Banco de dados atualizado');
      console.log('📄 Documentos migrados:', Object.keys(documentosInfo));
    }
    
    console.log(`\n🎉 Migração do pedido ${orderId} concluída com sucesso!`);
    
  } catch (error) {
    console.error('❌ Erro durante a migração:', error);
  } finally {
    if (pool) {
      await pool.end();
    }
  }
}

// Executar para o pedido específico
migrateToObjectStorage('CO12407250007');
