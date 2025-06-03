
const { Pool } = require('pg');

async function fixKeyuserCredentials() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false
    }
  });

  try {
    console.log('🔧 Corrigindo credenciais do keyuser...\n');
    
    // Criar ou atualizar email do keyuser
    await pool.query(`
      INSERT INTO settings (key, value, description)
      VALUES ('keyuser_email', 'padupb@admin.icap', 'E-mail do superadministrador')
      ON CONFLICT (key) DO UPDATE SET 
        value = EXCLUDED.value,
        description = EXCLUDED.description;
    `);
    console.log('✅ Email do keyuser configurado: padupb@admin.icap');
    
    // Criar ou atualizar senha do keyuser
    await pool.query(`
      INSERT INTO settings (key, value, description)
      VALUES ('keyuser_password', '170824', 'Senha do superadministrador')
      ON CONFLICT (key) DO UPDATE SET 
        value = EXCLUDED.value,
        description = EXCLUDED.description;
    `);
    console.log('✅ Senha do keyuser configurada: 170824');
    
    // Verificar se foram criadas
    const result = await pool.query(`
      SELECT key, value FROM settings 
      WHERE key IN ('keyuser_email', 'keyuser_password')
      ORDER BY key;
    `);
    
    console.log('\n📋 Credenciais verificadas:');
    result.rows.forEach(row => {
      console.log(`${row.key}: ${row.value}`);
    });
    
    console.log('\n🎉 Credenciais do keyuser corrigidas com sucesso!');
    console.log('Agora você pode fazer login com:');
    console.log('Email: padupb@admin.icap');
    console.log('Senha: 170824');
    
  } catch (error) {
    console.error('❌ Erro ao corrigir credenciais:', error);
  } finally {
    await pool.end();
  }
}

fixKeyuserCredentials();
