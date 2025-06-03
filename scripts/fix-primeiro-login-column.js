
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
    console.log('🔍 Verificando estrutura da tabela users...');
    
    // Verificar se a tabela users existe
    const tableExists = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'users'
      );
    `);

    if (!tableExists.rows[0].exists) {
      console.error('❌ Tabela users não existe! Execute as migrações primeiro.');
      return;
    }

    console.log('✅ Tabela users existe');

    // Verificar se a coluna primeiro_login existe
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
      
      // Verificar se existe usuário com ID 1
      const userCheck = await pool.query('SELECT id FROM users WHERE id = 1');
      
      if (userCheck.rows.length > 0) {
        // Atualizar usuário ID=1 para primeiro_login = false
        console.log('🔄 Configurando usuário ID=1 como primeiro_login = false...');
        await pool.query(`
          UPDATE users 
          SET primeiro_login = false 
          WHERE id = 1
        `);
        console.log('✅ Usuário ID=1 configurado com primeiro_login = false');
      } else {
        console.log('⚠️ Usuário ID=1 não encontrado na tabela');
      }
      
    } else {
      console.log('✅ Coluna primeiro_login já existe na tabela users');
    }

    // Verificação final
    const finalCheck = await pool.query(`
      SELECT id, name, email, primeiro_login 
      FROM users 
      WHERE id = 1
    `);

    if (finalCheck.rows.length > 0) {
      const user = finalCheck.rows[0];
      console.log('\n📋 Usuário ID=1 configurado:');
      console.log(`   Nome: ${user.name}`);
      console.log(`   Email: ${user.email}`);
      console.log(`   Primeiro Login: ${user.primeiro_login}`);
    }

    console.log('\n🎉 Correção concluída! Agora você pode fazer login normalmente.');
    
  } catch (error) {
    console.error('❌ Erro ao corrigir coluna:', error.message);
    console.error('Stack trace:', error.stack);
  } finally {
    await pool.end();
  }
}

// Executar se chamado diretamente
if (require.main === module) {
  fixPrimeiroLoginColumn();
}

module.exports = { fixPrimeiroLoginColumn };
