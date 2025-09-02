
const { Pool } = require('pg');

async function addValidFromColumn() {
  console.log("🔄 Iniciando migração para adicionar período de validade...");

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });

  try {
    // 1. Verificar se a coluna já existe
    const columnExists = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'ordens_compra' AND column_name = 'valido_desde'
    `);

    if (columnExists.rows.length > 0) {
      console.log("✅ Coluna 'valido_desde' já existe na tabela ordens_compra");
      return;
    }

    // 2. Adicionar coluna valid_from na tabela ordens_compra
    await pool.query(`
      ALTER TABLE ordens_compra 
      ADD COLUMN valido_desde TIMESTAMP
    `);
    console.log("✅ Coluna 'valido_desde' adicionada à tabela ordens_compra");

    // 3. Preencher valores padrão (7 dias antes da data de validade atual)
    await pool.query(`
      UPDATE ordens_compra 
      SET valido_desde = valido_ate - INTERVAL '7 days'
      WHERE valido_desde IS NULL
    `);
    console.log("✅ Valores padrão definidos para ordens existentes");

    // 4. Tornar a coluna NOT NULL
    await pool.query(`
      ALTER TABLE ordens_compra 
      ALTER COLUMN valido_desde SET NOT NULL
    `);
    console.log("✅ Coluna 'valido_desde' definida como NOT NULL");

    // 5. Verificar se existe tabela purchase_orders e fazer a mesma alteração
    const purchaseOrdersExists = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_name = 'purchase_orders'
    `);

    if (purchaseOrdersExists.rows.length > 0) {
      const poColumnExists = await pool.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'purchase_orders' AND column_name = 'valid_from'
      `);

      if (poColumnExists.rows.length === 0) {
        await pool.query(`
          ALTER TABLE purchase_orders 
          ADD COLUMN valid_from TIMESTAMP
        `);
        
        await pool.query(`
          UPDATE purchase_orders 
          SET valid_from = valid_until - INTERVAL '7 days'
          WHERE valid_from IS NULL
        `);
        
        await pool.query(`
          ALTER TABLE purchase_orders 
          ALTER COLUMN valid_from SET NOT NULL
        `);
        console.log("✅ Coluna 'valid_from' adicionada à tabela purchase_orders");
      }
    }

    console.log("🎉 Migração concluída com sucesso!");

  } catch (error) {
    console.error("❌ Erro durante a migração:", error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Executar se chamado diretamente
if (require.main === module) {
  addValidFromColumn().catch(console.error);
}

module.exports = { addValidFromColumn };
