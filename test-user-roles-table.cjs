const { Pool } = require('pg');

console.log('🔍 TESTE DA TABELA USER_ROLES - i-CAP 7.0');
console.log('==========================================');

const pool = new Pool({
  host: 'localhost',
  user: 'postgres',
  password: 'postgres',
  database: 'icap',
  port: 5432
});

async function testUserRolesTable() {
  try {
    console.log('\n1️⃣ VERIFICANDO SE A TABELA USER_ROLES EXISTE...');
    
    // Verificar se a tabela existe
    const tableCheck = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = 'user_roles'
    `);
    
    if (tableCheck.rows.length === 0) {
      console.log('❌ PROBLEMA: Tabela user_roles NÃO EXISTE!');
      
      // Verificar se existe com nome em português
      const tableCheckPt = await pool.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND (table_name LIKE '%role%' OR table_name LIKE '%funcao%' OR table_name LIKE '%função%')
      `);
      
      console.log('📋 Tabelas relacionadas a roles/funções encontradas:');
      tableCheckPt.rows.forEach(row => {
        console.log(`   - ${row.table_name}`);
      });
      
      return;
    }
    
    console.log('✅ Tabela user_roles EXISTE');
    
    console.log('\n2️⃣ VERIFICANDO ESTRUTURA DA TABELA...');
    
    // Verificar estrutura da tabela
    const structure = await pool.query(`
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'user_roles' 
      ORDER BY ordinal_position
    `);
    
    console.log('📋 Estrutura da tabela user_roles:');
    structure.rows.forEach(col => {
      console.log(`   - ${col.column_name}: ${col.data_type} (${col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL'})`);
    });
    
    console.log('\n3️⃣ VERIFICANDO DADOS NA TABELA...');
    
    // Verificar dados existentes
    const data = await pool.query('SELECT * FROM user_roles ORDER BY id');
    
    console.log(`📊 Total de funções cadastradas: ${data.rows.length}`);
    
    if (data.rows.length > 0) {
      console.log('\n📋 Funções encontradas:');
      data.rows.forEach(role => {
        console.log(`   ID: ${role.id}`);
        console.log(`   Nome: ${role.name}`);
        console.log(`   Categoria: ${role.category_id || 'N/A'}`);
        console.log(`   Permissões: ${role.permissions ? JSON.stringify(role.permissions) : 'NULL'}`);
        console.log('   ---');
      });
    } else {
      console.log('⚠️ Nenhuma função cadastrada na tabela');
    }
    
    console.log('\n4️⃣ TESTANDO CONSULTA DE PERMISSÕES...');
    
    // Testar consulta específica de uma função
    if (data.rows.length > 0) {
      const firstRole = data.rows[0];
      console.log(`🔍 Testando consulta da função ID ${firstRole.id}:`);
      
      const roleQuery = await pool.query('SELECT * FROM user_roles WHERE id = $1', [firstRole.id]);
      
      if (roleQuery.rows.length > 0) {
        const role = roleQuery.rows[0];
        console.log(`✅ Função encontrada: ${role.name}`);
        console.log(`📋 Permissões: ${role.permissions ? JSON.stringify(role.permissions) : 'NULL'}`);
        console.log(`🔧 Tipo das permissões: ${typeof role.permissions}`);
        console.log(`📊 É array? ${Array.isArray(role.permissions)}`);
      } else {
        console.log('❌ Erro: Função não encontrada na consulta');
      }
    }
    
    console.log('\n5️⃣ VERIFICANDO USUÁRIOS COM FUNÇÕES...');
    
    // Verificar usuários que têm funções
    const usersWithRoles = await pool.query(`
      SELECT u.id, u.name, u.email, u.role_id, ur.name as role_name, ur.permissions
      FROM users u
      LEFT JOIN user_roles ur ON u.role_id = ur.id
      WHERE u.role_id IS NOT NULL
      ORDER BY u.id
    `);
    
    console.log(`👥 Usuários com funções: ${usersWithRoles.rows.length}`);
    
    if (usersWithRoles.rows.length > 0) {
      console.log('\n📋 Usuários e suas funções:');
      usersWithRoles.rows.forEach(user => {
        console.log(`   ID: ${user.id} | Nome: ${user.name}`);
        console.log(`   Email: ${user.email}`);
        console.log(`   Função ID: ${user.role_id} | Função: ${user.role_name || 'N/A'}`);
        console.log(`   Permissões: ${user.permissions ? JSON.stringify(user.permissions) : 'NULL'}`);
        console.log('   ---');
      });
    }
    
    console.log('\n🏁 TESTE CONCLUÍDO');
    
  } catch (error) {
    console.error('❌ Erro durante o teste:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    await pool.end();
  }
}

// Executar o teste
testUserRolesTable(); 