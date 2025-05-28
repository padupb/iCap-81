
const { Pool } = require('pg');

async function completeDebug() {
  console.log('🔍 DEPURAÇÃO COMPLETA DO BANCO DE DADOS\n');
  console.log('=' .repeat(50));
  
  // Verificar se DATABASE_URL está configurada
  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL não está configurada nos Secrets!');
    console.log('💡 Configure a DATABASE_URL na aba Secrets antes de continuar.');
    return;
  }
  
  console.log('✅ DATABASE_URL encontrada nos Secrets');
  console.log(`🔗 Conectando em: ${process.env.DATABASE_URL.substring(0, 50)}...`);
  
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false
    }
  });

  try {
    // 1. TESTAR CONEXÃO
    console.log('\n1️⃣ TESTANDO CONEXÃO...');
    const connectionTest = await pool.query('SELECT NOW() as current_time, version() as pg_version');
    console.log('✅ Conexão bem-sucedida!');
    console.log(`⏰ Hora do servidor: ${connectionTest.rows[0].current_time}`);
    console.log(`🗄️ Versão PostgreSQL: ${connectionTest.rows[0].pg_version.split(' ')[0]}`);
    
    // 2. LISTAR TODAS AS TABELAS
    console.log('\n2️⃣ LISTANDO TODAS AS TABELAS...');
    const tablesResult = await pool.query(`
      SELECT 
        table_name,
        table_type
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name;
    `);
    
    if (tablesResult.rows.length === 0) {
      console.log('❌ Nenhuma tabela encontrada no banco!');
    } else {
      console.log(`📋 Encontradas ${tablesResult.rows.length} tabelas:`);
      tablesResult.rows.forEach((row, index) => {
        console.log(`   ${index + 1}. ${row.table_name} (${row.table_type})`);
      });
    }
    
    // 3. VERIFICAR TABELAS ESSENCIAIS
    console.log('\n3️⃣ VERIFICANDO TABELAS ESSENCIAIS...');
    const essentialTables = ['settings', 'users', 'companies', 'products', 'orders', 'purchase_orders'];
    
    for (const tableName of essentialTables) {
      try {
        const checkTable = await pool.query(`
          SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = $1
          );
        `, [tableName]);
        
        if (checkTable.rows[0].exists) {
          const countResult = await pool.query(`SELECT COUNT(*) as total FROM ${tableName}`);
          console.log(`✅ ${tableName}: ${countResult.rows[0].total} registros`);
        } else {
          console.log(`❌ ${tableName}: TABELA NÃO EXISTE`);
        }
      } catch (error) {
        console.log(`❌ ${tableName}: ERRO - ${error.message}`);
      }
    }
    
    // 4. VERIFICAR CREDENCIAIS DO KEYUSER
    console.log('\n4️⃣ VERIFICANDO CREDENCIAIS DO KEYUSER...');
    try {
      const settingsCheck = await pool.query(`
        SELECT key, value 
        FROM settings 
        WHERE key IN ('keyuser_email', 'keyuser_password')
        ORDER BY key;
      `);
      
      if (settingsCheck.rows.length === 0) {
        console.log('❌ Credenciais do keyuser NÃO ENCONTRADAS!');
        console.log('💡 Será necessário criar as credenciais...');
      } else {
        console.log('✅ Credenciais do keyuser encontradas:');
        settingsCheck.rows.forEach(row => {
          console.log(`   ${row.key}: ${row.value}`);
        });
      }
    } catch (error) {
      console.log(`❌ Erro ao verificar credenciais: ${error.message}`);
    }
    
    // 5. VERIFICAR ESTRUTURA DA TABELA SETTINGS
    console.log('\n5️⃣ ESTRUTURA DA TABELA SETTINGS...');
    try {
      const settingsStructure = await pool.query(`
        SELECT 
          column_name, 
          data_type, 
          is_nullable,
          column_default
        FROM information_schema.columns 
        WHERE table_name = 'settings'
        ORDER BY ordinal_position;
      `);
      
      if (settingsStructure.rows.length > 0) {
        console.log('📋 Colunas da tabela settings:');
        settingsStructure.rows.forEach(col => {
          console.log(`   ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable})`);
        });
        
        // Mostrar todas as configurações
        const allSettings = await pool.query('SELECT * FROM settings ORDER BY key');
        console.log(`\n📝 Todas as configurações (${allSettings.rows.length} registros):`);
        allSettings.rows.forEach(setting => {
          console.log(`   ${setting.key}: ${setting.value}`);
        });
      } else {
        console.log('❌ Tabela settings não possui colunas ou não existe');
      }
    } catch (error) {
      console.log(`❌ Erro ao verificar estrutura settings: ${error.message}`);
    }
    
    // 6. VERIFICAR USUÁRIOS
    console.log('\n6️⃣ VERIFICANDO USUÁRIOS...');
    try {
      const usersCount = await pool.query('SELECT COUNT(*) as total FROM users');
      console.log(`👥 Total de usuários: ${usersCount.rows[0].total}`);
      
      if (parseInt(usersCount.rows[0].total) > 0) {
        const sampleUsers = await pool.query(`
          SELECT id, name, email, role, created_at 
          FROM users 
          ORDER BY created_at DESC 
          LIMIT 5
        `);
        
        console.log('📋 Últimos 5 usuários:');
        sampleUsers.rows.forEach(user => {
          console.log(`   ID: ${user.id} | ${user.name} | ${user.email} | ${user.role}`);
        });
      }
    } catch (error) {
      console.log(`❌ Erro ao verificar usuários: ${error.message}`);
    }
    
    // 7. VERIFICAR DADOS DE TESTE
    console.log('\n7️⃣ VERIFICANDO DADOS IMPORTANTES...');
    const importantTables = ['companies', 'products', 'orders'];
    
    for (const table of importantTables) {
      try {
        const count = await pool.query(`SELECT COUNT(*) as total FROM ${table}`);
        console.log(`📊 ${table}: ${count.rows[0].total} registros`);
        
        if (parseInt(count.rows[0].total) > 0 && table === 'orders') {
          const recentOrders = await pool.query(`
            SELECT id, order_number, status, created_at 
            FROM orders 
            ORDER BY created_at DESC 
            LIMIT 3
          `);
          
          console.log('   📋 Últimos pedidos:');
          recentOrders.rows.forEach(order => {
            console.log(`     ${order.order_number} - ${order.status} (${order.created_at})`);
          });
        }
      } catch (error) {
        console.log(`❌ Erro ao verificar ${table}: ${error.message}`);
      }
    }
    
    console.log('\n' + '=' .repeat(50));
    console.log('🎉 DEPURAÇÃO CONCLUÍDA!');
    console.log('=' .repeat(50));
    
  } catch (error) {
    console.error('❌ ERRO CRÍTICO:', error);
    console.error('📋 Detalhes:', error.message);
  } finally {
    await pool.end();
  }
}

// Executar depuração
completeDebug().catch(console.error);
