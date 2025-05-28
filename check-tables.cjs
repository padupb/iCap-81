const { Pool } = require('pg');

const pool = new Pool({
  host: 'localhost',
  user: 'postgres',
  password: 'postgres',
  database: 'icap',
  port: 5432
});

async function checkTables() {
  try {
    console.log('🔍 VERIFICANDO ESTRUTURAS DAS TABELAS');
    
    // Verificar company_categories
    console.log('\n📋 Estrutura da tabela company_categories:');
    const ccStructure = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'company_categories' 
      ORDER BY ordinal_position
    `);
    ccStructure.rows.forEach(col => {
      console.log(`   - ${col.column_name}: ${col.data_type}`);
    });
    
    // Verificar users
    console.log('\n📋 Estrutura da tabela users:');
    const usersStructure = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'users' 
      ORDER BY ordinal_position
    `);
    usersStructure.rows.forEach(col => {
      console.log(`   - ${col.column_name}: ${col.data_type}`);
    });
    
    // Verificar dados existentes
    console.log('\n📊 DADOS EXISTENTES:');
    
    const users = await pool.query('SELECT COUNT(*) as count FROM users');
    console.log(`   Usuários: ${users.rows[0].count}`);
    
    const categories = await pool.query('SELECT COUNT(*) as count FROM company_categories');
    console.log(`   Categorias: ${categories.rows[0].count}`);
    
    const roles = await pool.query('SELECT COUNT(*) as count FROM user_roles');
    console.log(`   Funções: ${roles.rows[0].count}`);
    
  } catch (error) {
    console.error('❌ Erro:', error.message);
  } finally {
    await pool.end();
  }
}

checkTables(); 