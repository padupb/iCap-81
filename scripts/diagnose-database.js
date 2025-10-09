
const { Pool } = require('pg');

async function diagnoseBD() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    console.log('🔍 DIAGNÓSTICO DO BANCO DE DADOS\n');

    // Verificar pedidos
    const pedidosResult = await pool.query('SELECT COUNT(*) as total FROM orders');
    console.log(`📦 Total de pedidos: ${pedidosResult.rows[0].total}`);

    if (pedidosResult.rows[0].total > 0) {
      const samplePedidos = await pool.query('SELECT id, order_id, status FROM orders LIMIT 5');
      console.log('\n📋 Amostra de pedidos:');
      samplePedidos.rows.forEach(p => {
        console.log(`   • ID: ${p.id}, Order ID: ${p.order_id}, Status: ${p.status}`);
      });
    }

    // Verificar ordens de compra
    const ordensResult = await pool.query('SELECT COUNT(*) as total FROM ordens_compra');
    console.log(`\n📋 Total de ordens de compra: ${ordensResult.rows[0].total}`);

    if (ordensResult.rows[0].total > 0) {
      const sampleOrdens = await pool.query('SELECT id, numero_ordem, status FROM ordens_compra LIMIT 5');
      console.log('\n📦 Amostra de ordens de compra:');
      sampleOrdens.rows.forEach(o => {
        console.log(`   • ID: ${o.id}, Número: ${o.numero_ordem}, Status: ${o.status}`);
      });
    }

    // Verificar produtos
    const produtosResult = await pool.query('SELECT COUNT(*) as total FROM products');
    console.log(`\n🏷️ Total de produtos: ${produtosResult.rows[0].total}`);

    // Verificar empresas
    const empresasResult = await pool.query('SELECT COUNT(*) as total FROM companies');
    console.log(`🏢 Total de empresas: ${empresasResult.rows[0].total}\n`);

    console.log('✅ Diagnóstico concluído');
  } catch (error) {
    console.error('❌ Erro no diagnóstico:', error);
  } finally {
    await pool.end();
  }
}

diagnoseBD();
