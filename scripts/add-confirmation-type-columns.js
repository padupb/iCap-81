
import pkg from "pg";
const { Client } = pkg;

async function addConfirmationTypeColumns() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false
    }
  });

  try {
    await client.connect();
    console.log("✅ Conectado ao banco de dados");

    // Verificar se a coluna confirmation_type existe na tabela products
    console.log("🔍 Verificando coluna confirmation_type na tabela products...");
    const checkProductsColumn = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'products' AND column_name = 'confirmation_type'
    `);

    if (checkProductsColumn.rows.length === 0) {
      console.log("➕ Adicionando coluna confirmation_type na tabela products...");
      await client.query(`
        ALTER TABLE products 
        ADD COLUMN confirmation_type TEXT DEFAULT 'nota_fiscal'
      `);
      console.log("✅ Coluna confirmation_type adicionada com sucesso!");
    } else {
      console.log("ℹ️  Coluna confirmation_type já existe na tabela products");
    }

    // Verificar se a coluna numero_pedido existe na tabela orders
    console.log("🔍 Verificando coluna numero_pedido na tabela orders...");
    const checkOrdersColumn = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'orders' AND column_name = 'numero_pedido'
    `);

    if (checkOrdersColumn.rows.length === 0) {
      console.log("➕ Adicionando coluna numero_pedido na tabela orders...");
      await client.query(`
        ALTER TABLE orders 
        ADD COLUMN numero_pedido TEXT
      `);
      console.log("✅ Coluna numero_pedido adicionada com sucesso!");
    } else {
      console.log("ℹ️  Coluna numero_pedido já existe na tabela orders");
    }

    // Atualizar produtos existentes para usar nota_fiscal como padrão
    console.log("🔄 Atualizando produtos existentes...");
    await client.query(`
      UPDATE products 
      SET confirmation_type = 'nota_fiscal' 
      WHERE confirmation_type IS NULL
    `);
    console.log("✅ Produtos atualizados com sucesso!");

    // Verificar estrutura final
    console.log("\n📊 Estrutura da tabela products:");
    const productsStructure = await client.query(`
      SELECT column_name, data_type, column_default
      FROM information_schema.columns 
      WHERE table_name = 'products'
      ORDER BY ordinal_position
    `);
    productsStructure.rows.forEach(row => {
      console.log(`  - ${row.column_name}: ${row.data_type} (default: ${row.column_default || 'null'})`);
    });

    console.log("\n📊 Estrutura da tabela orders:");
    const ordersStructure = await client.query(`
      SELECT column_name, data_type, column_default
      FROM information_schema.columns 
      WHERE table_name = 'orders'
      ORDER BY ordinal_position
    `);
    ordersStructure.rows.forEach(row => {
      console.log(`  - ${row.column_name}: ${row.data_type} (default: ${row.column_default || 'null'})`);
    });

    console.log("\n✅ Script executado com sucesso!");
  } catch (error) {
    console.error("❌ Erro ao executar script:", error);
    throw error;
  } finally {
    await client.end();
  }
}

addConfirmationTypeColumns()
  .then(() => {
    console.log("\n🎉 Processo concluído!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n💥 Erro na execução:", error);
    process.exit(1);
  });
