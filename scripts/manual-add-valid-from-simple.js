
const { Pool } = require('pg');

async function addValidFromColumnManual() {
  console.log("🔧 Adicionando coluna valido_desde manualmente...");

  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL não configurada!');
    return;
  }

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    // Executar comandos um por vez
    console.log("1️⃣ Adicionando coluna valido_desde...");
    await pool.query(`
      ALTER TABLE ordens_compra 
      ADD COLUMN IF NOT EXISTS valido_desde TIMESTAMP
    `);

    console.log("2️⃣ Preenchendo valores padrão...");
    await pool.query(`
      UPDATE ordens_compra 
      SET valido_desde = valido_ate - INTERVAL '7 days'
      WHERE valido_desde IS NULL
    `);

    console.log("3️⃣ Definindo como NOT NULL...");
    await pool.query(`
      ALTER TABLE ordens_compra 
      ALTER COLUMN valido_desde SET NOT NULL
    `);

    console.log("4️⃣ Verificando estrutura da tabela...");
    const result = await pool.query(`
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'ordens_compra' 
      AND column_name IN ('valido_desde', 'valido_ate')
      ORDER BY column_name
    `);

    console.log("📋 Colunas de validade:");
    result.rows.forEach(row => {
      console.log(`  • ${row.column_name}: ${row.data_type} (nullable: ${row.is_nullable})`);
    });

    console.log("✅ Coluna valido_desde adicionada com sucesso!");

  } catch (error) {
    console.error("❌ Erro:", error.message);
  } finally {
    await pool.end();
  }
}

// Executar se chamado diretamente
if (require.main === module) {
  addValidFromColumnManual().catch(console.error);
}

module.exports = { addValidFromColumnManual };
