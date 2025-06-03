
const { Pool } = require('pg');

// Configurar conexão com o banco usando as variáveis de ambiente
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

async function createMissingTables() {
  try {
    console.log('🔧 Verificando e criando tabelas faltantes...');
    
    // Criar tabela settings se não existir
    await pool.query(`
      CREATE TABLE IF NOT EXISTS settings (
        id SERIAL PRIMARY KEY,
        key VARCHAR(255) UNIQUE NOT NULL,
        value TEXT,
        description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ Tabela settings criada/verificada');
    
    // Inserir configurações padrão
    const defaultSettings = [
      ['keyuser_email', 'padupb@admin.icap', 'E-mail do superadministrador'],
      ['keyuser_password', '170824', 'Senha do superadministrador'],
      ['urgent_days_threshold', '7', 'Dias para considerar pedido urgente'],
      ['app_name', 'i-CAP 5.0', 'Nome da aplicação']
    ];
    
    for (const [key, value, description] of defaultSettings) {
      await pool.query(`
        INSERT INTO settings (key, value, description)
        VALUES ($1, $2, $3)
        ON CONFLICT (key) DO NOTHING;
      `, [key, value, description]);
    }
    console.log('✅ Configurações padrão inseridas');
    
    // Verificar outras tabelas essenciais
    const tables = ['users', 'companies', 'products', 'orders', 'company_categories', 'user_roles', 'units'];
    
    for (const table of tables) {
      const result = await pool.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_name = $1
        );
      `, [table]);
      
      if (result.rows[0].exists) {
        console.log(`✅ Tabela ${table} existe`);
      } else {
        console.log(`❌ Tabela ${table} NÃO existe`);
      }
    }
    
    console.log('🎉 Verificação concluída!');
    
  } catch (error) {
    console.error('❌ Erro:', error);
  } finally {
    await pool.end();
  }
}

createMissingTables();
