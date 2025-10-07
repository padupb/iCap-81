
const { Pool } = require("@neondatabase/serverless");

async function addConfirmationTypeColumns() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    console.log("🔧 Adicionando coluna confirmation_type na tabela products...");
    
    await pool.query(`
      ALTER TABLE products 
      ADD COLUMN IF NOT EXISTS confirmation_type TEXT DEFAULT 'nota_fiscal'
    `);
    
    console.log("✅ Coluna confirmation_type adicionada com sucesso!");

    console.log("🔧 Adicionando coluna numero_pedido na tabela orders...");
    
    await pool.query(`
      ALTER TABLE orders 
      ADD COLUMN IF NOT EXISTS numero_pedido TEXT
    `);
    
    console.log("✅ Coluna numero_pedido adicionada com sucesso!");

    console.log("🔧 Atualizando produtos existentes para usar nota_fiscal como padrão...");
    
    await pool.query(`
      UPDATE products 
      SET confirmation_type = 'nota_fiscal' 
      WHERE confirmation_type IS NULL
    `);
    
    console.log("✅ Produtos atualizados com sucesso!");

    console.log("✅ Script executado com sucesso!");
  } catch (error) {
    console.error("❌ Erro ao executar script:", error);
  } finally {
    await pool.end();
  }
}

addConfirmationTypeColumns();
