
const { Pool } = require('pg');

async function showKeyuserCredentials() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false
    }
  });

  try {
    console.log('🔍 Buscando credenciais do KeyUser...\n');
    
    const result = await pool.query(`
      SELECT key, value, description 
      FROM settings 
      WHERE key IN ('keyuser_email', 'keyuser_password')
      ORDER BY key;
    `);

    if (result.rows.length > 0) {
      console.log('📋 Credenciais encontradas:');
      console.log('─'.repeat(50));
      
      result.rows.forEach(row => {
        console.log(`${row.key}: ${row.value}`);
        console.log(`Descrição: ${row.description}`);
        console.log('─'.repeat(50));
      });
    } else {
      console.log('❌ Nenhuma credencial de keyuser encontrada no banco.');
    }

    console.log('\n📝 Credenciais padrão do sistema:');
    console.log('E-mail: padupb@admin.icap');
    console.log('Senha: 170824');
    
  } catch (error) {
    console.error('❌ Erro ao buscar credenciais:', error);
  } finally {
    await pool.end();
  }
}

showKeyuserCredentials();
