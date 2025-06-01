
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function testCoordCcbr163() {
  try {
    console.log('🔍 Testando usuário coord1@ccbr163.com...');
    
    // 1. Verificar se o usuário existe
    const userResult = await pool.query(
      "SELECT * FROM users WHERE email = $1",
      ['coord1@ccbr163.com']
    );
    
    if (userResult.rows.length === 0) {
      console.log('❌ Usuário coord1@ccbr163.com não encontrado');
      return;
    }
    
    const user = userResult.rows[0];
    console.log('👤 Usuário encontrado:', {
      id: user.id,
      name: user.name,
      email: user.email,
      company_id: user.company_id
    });
    
    // 2. Verificar a empresa do usuário
    if (user.company_id) {
      const companyResult = await pool.query(
        "SELECT * FROM companies WHERE id = $1",
        [user.company_id]
      );
      
      if (companyResult.rows.length > 0) {
        const company = companyResult.rows[0];
        console.log('🏢 Empresa do usuário:', {
          id: company.id,
          name: company.name,
          cnpj: company.cnpj,
          approver_id: company.approver_id
        });
        
        // 3. Verificar se o usuário é aprovador da sua própria empresa
        const isApproverOfOwnCompany = company.approver_id === user.id;
        console.log('✅ É aprovador da própria empresa?', isApproverOfOwnCompany);
      }
    }
    
    // 4. Verificar em quantas empresas ele é aprovador
    const approverResult = await pool.query(
      "SELECT * FROM companies WHERE approver_id = $1",
      [user.id]
    );
    
    console.log(`📊 Usuário é aprovador de ${approverResult.rows.length} empresa(s):`);
    approverResult.rows.forEach(company => {
      console.log(`  - ${company.name} (ID: ${company.id}, CNPJ: ${company.cnpj})`);
    });
    
    // 5. Verificar pedidos urgentes que ele deveria ver
    const urgentOrdersResult = await pool.query(`
      SELECT DISTINCT
        o.id,
        o.order_id,
        o.status,
        o.is_urgent,
        oc.numero_ordem,
        oc.cnpj as ordem_cnpj,
        c_obra.name as obra_nome,
        c_obra.approver_id as obra_approver
      FROM orders o
      LEFT JOIN ordens_compra oc ON o.purchase_order_id = oc.id
      LEFT JOIN companies c_obra ON oc.cnpj = c_obra.cnpj
      WHERE o.is_urgent = true 
        AND o.status = 'Registrado'
        AND c_obra.approver_id = $1
    `, [user.id]);
    
    console.log(`🔥 Pedidos urgentes que ele deve visualizar: ${urgentOrdersResult.rows.length}`);
    urgentOrdersResult.rows.forEach(order => {
      console.log(`  - Pedido ${order.order_id}: obra "${order.obra_nome}" (aprovador: ${order.obra_approver})`);
    });
    
  } catch (error) {
    console.error('❌ Erro no teste:', error);
  } finally {
    await pool.end();
  }
}

testCoordCcbr163();
