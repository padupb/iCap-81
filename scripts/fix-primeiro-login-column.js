
const { Pool } = require('pg');

async function fixPrimeiroLoginColumn() {
  console.log('🔧 CORRIGINDO COLUNA primeiro_login NA TABELA users\n');
  
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
    console.log('🔍 Verificando se a coluna primeiro_login existe...');
    
    // Verificar se a coluna já existe
    const checkColumn = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'users' AND column_name = 'primeiro_login'
    `);

    if (checkColumn.rowCount === 0) {
      console.log('➕ Adicionando coluna primeiro_login à tabela users...');
      
      await pool.query(`
        ALTER TABLE users 
        ADD COLUMN primeiro_login BOOLEAN DEFAULT true
      `);
      
      console.log('✅ Coluna primeiro_login adicionada com sucesso!');
      
      // Atualizar usuários existentes para terem primeiro_login = false (exceto novos)
      console.log('🔄 Atualizando usuários existentes...');
      await pool.query(`
        UPDATE users 
        SET primeiro_login = false 
        WHERE id = 1
      `);
      
      console.log('✅ Usuário admin (ID=1) configurado com primeiro_login = false');
      
    } else {
      console.log('✅ Coluna primeiro_login já existe na tabela users');
    }

    console.log('\n🎉 Correção concluída! Agora você pode fazer login normalmente.');
    
  } catch (error) {
    console.error('❌ Erro ao corrigir coluna:', error.message);
  } finally {
    await pool.end();
  }
}

// Executar se chamado diretamente
if (require.main === module) {
  fixPrimeiroLoginColumn();
}

module.exports = { fixPrimeiroLoginColumn };
