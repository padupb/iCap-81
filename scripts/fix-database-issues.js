
const { Pool } = require('pg');

async function fixDatabaseIssues() {
  console.log('🔧 CORRIGINDO PROBLEMAS DO BANCO DE DADOS\n');
  
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
    console.log('1️⃣ Verificando e criando tabela settings...');
    
    // Criar tabela settings se não existir
    await pool.query(`
      CREATE TABLE IF NOT EXISTS settings (
        key VARCHAR(255) PRIMARY KEY,
        value TEXT NOT NULL,
        description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ Tabela settings verificada/criada');
    
    console.log('\n2️⃣ Inserindo credenciais do keyuser...');
    
    // Inserir credenciais do keyuser
    await pool.query(`
      INSERT INTO settings (key, value, description)
      VALUES 
        ('keyuser_email', 'padupb@admin.icap', 'E-mail do superadministrador'),
        ('keyuser_password', '170824', 'Senha do superadministrador')
      ON CONFLICT (key) DO UPDATE SET 
        value = EXCLUDED.value,
        description = EXCLUDED.description,
        updated_at = CURRENT_TIMESTAMP;
    `);
    console.log('✅ Credenciais do keyuser configuradas');
    
    console.log('\n3️⃣ Verificando outras tabelas essenciais...');
    
    // Verificar se tabela users existe
    const usersExists = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'users'
      );
    `);
    
    if (!usersExists.rows[0].exists) {
      console.log('⚠️ Tabela users não existe - será necessário executar migrações');
    } else {
      console.log('✅ Tabela users existe');
    }
    
    // Verificar credenciais finais
    console.log('\n4️⃣ Verificando credenciais finais...');
    const finalCheck = await pool.query(`
      SELECT key, value FROM settings 
      WHERE key IN ('keyuser_email', 'keyuser_password')
      ORDER BY key;
    `);
    
    console.log('📋 Credenciais configuradas:');
    finalCheck.rows.forEach(row => {
      console.log(`   ${row.key}: ${row.value}`);
    });
    
    console.log('\n🎉 CORREÇÕES APLICADAS COM SUCESSO!');
    console.log('Agora você pode fazer login com:');
    console.log('📧 Email: padupb@admin.icap');
    console.log('🔑 Senha: 170824');
    
  } catch (error) {
    console.error('❌ Erro:', error);
  } finally {
    await pool.end();
  }
}

fixDatabaseIssues().catch(console.error);
