
const { Pool } = require('pg');

async function fixConcessionariaPermissions() {
  console.log('🔧 Corrigindo permissões de edição para concessionárias...');
  
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
    // 1. Verificar estrutura atual das categorias
    console.log('📊 Verificando categorias existentes...');
    const categoriesResult = await pool.query(`
      SELECT id, name, receives_purchase_orders, can_edit_purchase_orders, requires_contract
      FROM company_categories 
      ORDER BY name
    `);

    console.log('📋 Categorias encontradas:');
    categoriesResult.rows.forEach(cat => {
      console.log(`  - ${cat.name}: recebe_ordens=${cat.receives_purchase_orders}, pode_editar=${cat.can_edit_purchase_orders}, requer_contrato=${cat.requires_contract}`);
    });

    // 2. Atualizar categoria Concessionária para permitir edição
    console.log('\n🔄 Atualizando permissões da categoria Concessionária...');
    await pool.query(`
      UPDATE company_categories 
      SET receives_purchase_orders = true, 
          can_edit_purchase_orders = true
      WHERE name ILIKE '%concession%' OR name ILIKE '%concess%'
    `);

    // 3. Atualizar categoria Construtora para permitir edição
    console.log('🔄 Atualizando permissões da categoria Construtora...');
    await pool.query(`
      UPDATE company_categories 
      SET receives_purchase_orders = true, 
          can_edit_purchase_orders = true
      WHERE name ILIKE '%constru%'
    `);

    // 4. Verificar empresas da categoria concessionária
    console.log('\n🏢 Verificando empresas por categoria...');
    const companiesResult = await pool.query(`
      SELECT c.id, c.name, cc.name as category_name, cc.can_edit_purchase_orders, cc.receives_purchase_orders
      FROM companies c
      LEFT JOIN company_categories cc ON c.category_id = cc.id
      WHERE cc.name ILIKE '%concession%' OR cc.name ILIKE '%constru%' OR cc.name ILIKE '%concess%'
      ORDER BY cc.name, c.name
    `);

    console.log(`📊 Encontradas ${companiesResult.rows.length} empresas de categorias relevantes:`);
    companiesResult.rows.forEach(company => {
      console.log(`  - ${company.name} (${company.category_name}): pode_editar=${company.can_edit_purchase_orders}`);
    });

    // 5. Verificar resultado final
    console.log('\n✅ Verificação final das categorias:');
    const finalCheck = await pool.query(`
      SELECT name, receives_purchase_orders, can_edit_purchase_orders
      FROM company_categories 
      WHERE can_edit_purchase_orders = true
      ORDER BY name
    `);

    console.log('📋 Categorias com permissão de edição habilitada:');
    finalCheck.rows.forEach(cat => {
      console.log(`  ✅ ${cat.name}: recebe_ordens=${cat.receives_purchase_orders}, pode_editar=${cat.can_edit_purchase_orders}`);
    });

    console.log('\n🎉 Correção de permissões concluída com sucesso!');
    console.log('💡 Usuários de concessionárias agora podem editar ordens de compra');

  } catch (error) {
    console.error('❌ Erro:', error);
  } finally {
    await pool.end();
  }
}

fixConcessionariaPermissions();
