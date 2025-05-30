const { Pool } = require('pg');

async function createTrackingTable() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });

  try {
    console.log('Verificando e criando tabela tracking_points...');

    // Criar tabela se não existir
    await pool.query(`
      CREATE TABLE IF NOT EXISTS tracking_points (
        id SERIAL PRIMARY KEY,
        order_id INTEGER NOT NULL,
        latitude DECIMAL(10, 8) NOT NULL,
        longitude DECIMAL(11, 8) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
      )
    `);

    // Criar índices para performance
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_tracking_points_order_id 
      ON tracking_points(order_id)
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_tracking_points_created_at 
      ON tracking_points(created_at)
    `);

    // Adicionar índice composto para melhorar performance das queries de rastreamento
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_tracking_points_order_created 
      ON tracking_points(order_id, created_at)
    `);

    console.log('✅ Tabela tracking_points criada/verificada com sucesso');

    // Inserir alguns pontos de teste se a tabela estiver vazia
    const countResult = await pool.query('SELECT COUNT(*) FROM tracking_points');
    const count = parseInt(countResult.rows[0].count);

    if (count === 0) {
      console.log('Inserindo pontos de rastreamento de exemplo...');
      
      // Buscar um pedido existente para usar como exemplo
      const orderResult = await pool.query('SELECT id FROM orders LIMIT 1');
      
      if (orderResult.rows.length > 0) {
        const orderId = orderResult.rows[0].id;
        
        // Simular uma rota de São Paulo para Rio de Janeiro
        const routePoints = [
          { lat: -23.5505, lng: -46.6333 }, // São Paulo
          { lat: -23.4000, lng: -46.0000 }, // Saindo de SP
          { lat: -22.9000, lng: -44.5000 }, // Meio do caminho
          { lat: -22.9068, lng: -43.1729 }  // Rio de Janeiro
        ];

        for (let i = 0; i < routePoints.length; i++) {
          const point = routePoints[i];
          const timestamp = new Date(Date.now() - (routePoints.length - i - 1) * 60 * 60 * 1000); // 1 hora entre pontos
          
          await pool.query(
            'INSERT INTO tracking_points (order_id, latitude, longitude, created_at) VALUES ($1, $2, $3, $4)',
            [orderId, point.lat, point.lng, timestamp]
          );
        }
        
        console.log(`✅ Inseridos ${routePoints.length} pontos de exemplo para o pedido ${orderId}`);
      }
    }

  } catch (error) {
    console.error('❌ Erro ao criar tabela tracking_points:', error);
  } finally {
    await pool.end();
  }
}

// Executar se chamado diretamente
if (require.main === module) {
  createTrackingTable();
}

module.exports = { createTrackingTable };
