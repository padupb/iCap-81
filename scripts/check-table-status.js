
const { Pool } = require('pg');

async function checkTableStatus() {
  console.log("🔍 Verificando status da tabela ordens_compra...");

  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL não configurada!');
    return;
  }

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    // Verificar estrutura da tabela
    console.log("📋 Estrutura atual da tabela:");
    const columns = await pool.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'ordens_compra' 
      ORDER BY ordinal_position
    `);

    columns.rows.forEach(col => {
      console.log(`  • ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable}, default: ${col.column_default})`);
    });

    // Verificar se existem registros com valido_desde NULL
    const nullCheck = await pool.query(`
      SELECT COUNT(*) as count_total,
             COUNT(valido_desde) as count_with_valido_desde,
             COUNT(*) - COUNT(valido_desde) as count_null_valido_desde
      FROM ordens_compra
    `);

    const stats = nullCheck.rows[0];
    console.log("\n📊 Estatísticas dos dados:");
    console.log(`  • Total de registros: ${stats.count_total}`);
    console.log(`  • Com valido_desde: ${stats.count_with_valido_desde}`);
    console.log(`  • Com valido_desde NULL: ${stats.count_null_valido_desde}`);

    if (stats.count_null_valido_desde > 0) {
      console.log("\n⚠️ Existem registros com valido_desde NULL!");
      
      // Mostrar alguns exemplos
      const examples = await pool.query(`
        SELECT id, numero_ordem, valido_ate, valido_desde
        FROM ordens_compra 
        WHERE valido_desde IS NULL
        LIMIT 5
      `);

      console.log("\n🔍 Exemplos de registros com valido_desde NULL:");
      examples.rows.forEach(row => {
        console.log(`  • ID ${row.id} - ${row.numero_ordem} - valido_ate: ${row.valido_ate}`);
      });
    }

  } catch (error) {
    console.error("❌ Erro:", error.message);
  } finally {
    await pool.end();
  }
}

checkTableStatus().catch(console.error);
