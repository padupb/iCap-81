
const { Client } = require('pg');

async function addFotoConfirmacaoColumn() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL
  });

  try {
    await client.connect();
    console.log('🔗 Conectado ao banco de dados');

    // Verificar se a coluna já existe
    const checkColumn = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'orders' AND column_name = 'foto_confirmacao'
    `);

    if (checkColumn.rows.length === 0) {
      console.log('📋 Adicionando coluna foto_confirmacao na tabela orders...');
      
      await client.query(`
        ALTER TABLE orders 
        ADD COLUMN foto_confirmacao JSONB
      `);
      
      console.log('✅ Coluna foto_confirmacao adicionada com sucesso!');
    } else {
      console.log('ℹ️ Coluna foto_confirmacao já existe na tabela orders');
    }

  } catch (error) {
    console.error('❌ Erro ao adicionar coluna:', error);
  } finally {
    await client.end();
  }
}

addFotoConfirmacaoColumn();
