
const { Pool } = require('pg');

async function verifyDatabaseStructure() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false
    }
  });

  try {
    console.log('🔍 Verificando estrutura do banco de dados...\n');
    
    // Verificar se a tabela settings existe e tem dados
    console.log('📋 Verificando tabela settings:');
    try {
      const settingsResult = await pool.query(`
        SELECT COUNT(*) as total, 
               COUNT(CASE WHEN key = 'keyuser_email' THEN 1 END) as has_email,
               COUNT(CASE WHEN key = 'keyuser_password' THEN 1 END) as has_password
        FROM settings;
      `);
      
      const counts = settingsResult.rows[0];
      console.log(`Total de configurações: ${counts.total}`);
      console.log(`Tem email do keyuser: ${counts.has_email > 0 ? 'SIM' : 'NÃO'}`);
      console.log(`Tem senha do keyuser: ${counts.has_password > 0 ? 'SIM' : 'NÃO'}`);
      
      if (counts.has_email > 0 || counts.has_password > 0) {
        const credentialsResult = await pool.query(`
          SELECT key, value FROM settings 
          WHERE key IN ('keyuser_email', 'keyuser_password')
          ORDER BY key;
        `);
        
        console.log('\n📝 Credenciais encontradas:');
        credentialsResult.rows.forEach(row => {
          console.log(`${row.key}: ${row.value}`);
        });
      }
    } catch (error) {
      console.error('❌ Erro ao verificar tabela settings:', error.message);
    }
    
    // Verificar se a tabela users existe
    console.log('\n📋 Verificando tabela users:');
    try {
      const usersResult = await pool.query(`
        SELECT COUNT(*) as total FROM users;
      `);
      console.log(`Total de usuários na tabela: ${usersResult.rows[0].total}`);
      
      if (parseInt(usersResult.rows[0].total) > 0) {
        const sampleUsers = await pool.query(`
          SELECT id, name, email FROM users LIMIT 3;
        `);
        console.log('\n👥 Amostra de usuários:');
        sampleUsers.rows.forEach(user => {
          console.log(`ID: ${user.id}, Nome: ${user.name}, Email: ${user.email}`);
        });
      }
    } catch (error) {
      console.error('❌ Erro ao verificar tabela users:', error.message);
    }
    
    // Listar todas as tabelas
    console.log('\n📋 Tabelas disponíveis no banco:');
    try {
      const tablesResult = await pool.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public'
        ORDER BY table_name;
      `);
      
      tablesResult.rows.forEach(row => {
        console.log(`- ${row.table_name}`);
      });
    } catch (error) {
      console.error('❌ Erro ao listar tabelas:', error.message);
    }
    
  } catch (error) {
    console.error('❌ Erro geral:', error);
  } finally {
    await pool.end();
  }
}

verifyDatabaseStructure();
