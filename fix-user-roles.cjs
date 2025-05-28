const { Pool } = require('pg');

console.log('🔧 CORREÇÃO DO SISTEMA DE FUNÇÕES - i-CAP 7.0');
console.log('===============================================');

const pool = new Pool({
  host: 'localhost',
  user: 'postgres',
  password: 'postgres',
  database: 'icap',
  port: 5432
});

async function fixUserRoles() {
  try {
    console.log('\n1️⃣ VERIFICANDO USUÁRIOS EXISTENTES...');
    
    // Verificar usuários existentes
    const users = await pool.query('SELECT id, name, email, role_id FROM users ORDER BY id');
    console.log(`👥 Total de usuários: ${users.rows.length}`);
    
    if (users.rows.length > 0) {
      console.log('\n📋 Usuários encontrados:');
      users.rows.forEach(user => {
        console.log(`   ID: ${user.id} | Nome: ${user.name} | Email: ${user.email} | role_id: ${user.role_id || 'NULL'}`);
      });
    } else {
      console.log('⚠️ Nenhum usuário encontrado no banco de dados');
      console.log('💡 Você precisa criar usuários primeiro');
      
      // Criar usuário KeyUser padrão
      console.log('\n🔧 Criando usuário KeyUser padrão...');
      await pool.query(`
        INSERT INTO users (id, name, email, password, can_confirm_delivery, created_at) 
        VALUES (1, 'KeyUser', 'padupb@admin.icap', '$2b$10$8K1p/a0dClpsuwfgEXs4Ou6L1hX9LfkfBdRsMGFGhkxqiMlFqPXTm', true, NOW())
        ON CONFLICT (id) DO NOTHING
      `);
      console.log('✅ Usuário KeyUser criado (ID: 1, senha: 170824)');
    }
    
    console.log('\n2️⃣ VERIFICANDO CATEGORIAS DE EMPRESA...');
    
    // Verificar categorias existentes
    const categories = await pool.query('SELECT * FROM company_categories ORDER BY id');
    console.log(`🏢 Total de categorias: ${categories.rows.length}`);
    
    if (categories.rows.length === 0) {
      console.log('⚠️ Criando categoria padrão...');
      await pool.query(`
        INSERT INTO company_categories (name, requires_approver, receives_purchase_orders, requires_contract) 
        VALUES ('Geral', false, true, false)
      `);
      console.log('✅ Categoria "Geral" criada');
    }
    
    // Buscar primeira categoria
    const firstCategory = await pool.query('SELECT id FROM company_categories ORDER BY id LIMIT 1');
    const categoryId = firstCategory.rows[0].id;
    
    console.log('\n3️⃣ CRIANDO FUNÇÕES BÁSICAS...');
    
    // Definir funções básicas
    const basicRoles = [
      {
        name: 'Administrador',
        permissions: ['*'] // Acesso total
      },
      {
        name: 'Gerente',
        permissions: [
          'view_dashboard',
          'view_orders',
          'view_approvals', 
          'view_purchase_orders',
          'view_companies',
          'view_users',
          'view_products',
          'view_logs',
          'view_settings'
        ]
      },
      {
        name: 'Operador',
        permissions: [
          'view_dashboard',
          'view_orders',
          'view_purchase_orders',
          'view_products'
        ]
      },
      {
        name: 'Visualizador',
        permissions: [
          'view_dashboard',
          'view_orders'
        ]
      }
    ];
    
    // Criar funções
    for (const role of basicRoles) {
      try {
        const result = await pool.query(`
          INSERT INTO user_roles (name, category_id, permissions) 
          VALUES ($1, $2, $3) 
          RETURNING id, name
        `, [role.name, categoryId, role.permissions]);
        
        console.log(`✅ Função "${role.name}" criada (ID: ${result.rows[0].id})`);
        console.log(`   Permissões: ${JSON.stringify(role.permissions)}`);
      } catch (error) {
        if (error.code === '23505') { // Duplicate key
          console.log(`⚠️ Função "${role.name}" já existe`);
        } else {
          console.error(`❌ Erro ao criar função "${role.name}":`, error.message);
        }
      }
    }
    
    console.log('\n4️⃣ VERIFICANDO FUNÇÕES CRIADAS...');
    
    // Verificar funções criadas
    const roles = await pool.query('SELECT * FROM user_roles ORDER BY id');
    console.log(`📊 Total de funções: ${roles.rows.length}`);
    
    if (roles.rows.length > 0) {
      console.log('\n📋 Funções disponíveis:');
      roles.rows.forEach(role => {
        console.log(`   ID: ${role.id} | Nome: ${role.name}`);
        console.log(`   Permissões: ${role.permissions ? JSON.stringify(role.permissions) : 'NULL'}`);
        console.log('   ---');
      });
    }
    
    console.log('\n5️⃣ ATRIBUINDO FUNÇÃO PARA USUÁRIOS SEM FUNÇÃO...');
    
    // Buscar função de Administrador
    const adminRole = await pool.query(`
      SELECT id FROM user_roles 
      WHERE name = 'Administrador' 
      ORDER BY id LIMIT 1
    `);
    
    if (adminRole.rows.length > 0) {
      const adminRoleId = adminRole.rows[0].id;
      
      // Atribuir função de Administrador para usuários sem função
      const usersWithoutRole = await pool.query('SELECT id, name FROM users WHERE role_id IS NULL');
      
      for (const user of usersWithoutRole.rows) {
        await pool.query('UPDATE users SET role_id = $1 WHERE id = $2', [adminRoleId, user.id]);
        console.log(`✅ Usuário "${user.name}" (ID: ${user.id}) agora é Administrador`);
      }
      
      // Verificar se existe usuário KeyUser (ID = 1)
      const keyUser = await pool.query('SELECT * FROM users WHERE id = 1');
      if (keyUser.rows.length > 0) {
        await pool.query('UPDATE users SET role_id = $1 WHERE id = 1', [adminRoleId]);
        console.log(`✅ KeyUser (ID: 1) configurado como Administrador`);
      }
    }
    
    console.log('\n6️⃣ VERIFICAÇÃO FINAL...');
    
    // Verificação final
    const finalCheck = await pool.query(`
      SELECT u.id, u.name, u.email, u.role_id, ur.name as role_name, ur.permissions
      FROM users u
      LEFT JOIN user_roles ur ON u.role_id = ur.id
      ORDER BY u.id
    `);
    
    console.log('\n📋 Estado final dos usuários:');
    finalCheck.rows.forEach(user => {
      console.log(`   ID: ${user.id} | Nome: ${user.name}`);
      console.log(`   Email: ${user.email}`);
      console.log(`   Função: ${user.role_name || 'SEM FUNÇÃO'} (ID: ${user.role_id || 'NULL'})`);
      console.log(`   Permissões: ${user.permissions ? JSON.stringify(user.permissions) : 'NULL'}`);
      console.log('   ---');
    });
    
    console.log('\n🎉 CORREÇÃO CONCLUÍDA COM SUCESSO!');
    console.log('\n📝 PRÓXIMOS PASSOS:');
    console.log('1. Reiniciar o servidor i-CAP');
    console.log('2. Fazer login com: padupb@admin.icap / 170824');
    console.log('3. Testar as permissões no sistema');
    
  } catch (error) {
    console.error('❌ Erro durante a correção:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    await pool.end();
  }
}

// Executar a correção
fixUserRoles(); 