
const { Pool } = require('pg');

// Configuração do banco de dados mais robusta
async function getPool() {
  const databaseUrl = process.env.DATABASE_URL;
  
  if (!databaseUrl) {
    console.error('❌ DATABASE_URL não encontrada nas variáveis de ambiente');
    process.exit(1);
  }

  console.log('🔗 Conectando ao banco de dados...');
  
  const pool = new Pool({
    connectionString: databaseUrl,
    ssl: databaseUrl.includes('neon.tech') ? { rejectUnauthorized: false } : false,
    max: 1, // Limite de conexões
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
  });

  // Testar conexão
  try {
    const client = await pool.connect();
    console.log('✅ Conexão com banco estabelecida');
    client.release();
    return pool;
  } catch (error) {
    console.error('❌ Erro ao conectar com o banco:', error.message);
    throw error;
  }
}

async function addTrackingPointsForOrder21() {
  let pool;
  
  try {
    pool = await getPool();
    
    console.log('🔄 Adicionando pontos de rastreamento para o pedido ID 21...');

    // Verificar se o pedido 21 existe
    const orderCheck = await pool.query('SELECT id, "orderId" FROM orders WHERE id = 21');
    
    if (!orderCheck.rows.length) {
      console.log('❌ Pedido 21 não encontrado');
      
      // Mostrar pedidos disponíveis
      const availableOrders = await pool.query('SELECT id, "orderId" FROM orders ORDER BY id LIMIT 5');
      console.log('📋 Pedidos disponíveis:');
      availableOrders.rows.forEach(order => {
        console.log(`   ID: ${order.id} - Order: ${order.orderId}`);
      });
      return;
    }

    const order = orderCheck.rows[0];
    console.log(`📦 Pedido encontrado: ${order.orderId}`);

    // Verificar se a tabela tracking_points existe
    const tableExists = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'tracking_points'
      );
    `);

    if (!tableExists.rows[0].exists) {
      console.log('🏗️ Criando tabela tracking_points...');
      await pool.query(`
        CREATE TABLE tracking_points (
          id SERIAL PRIMARY KEY,
          order_id INTEGER NOT NULL,
          latitude DECIMAL(10, 8) NOT NULL,
          longitude DECIMAL(11, 8) NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
        )
      `);
      console.log('✅ Tabela tracking_points criada');
    }

    // Limpar pontos existentes para este pedido
    const deleteResult = await pool.query('DELETE FROM tracking_points WHERE order_id = 21');
    console.log(`🗑️ ${deleteResult.rowCount} pontos antigos removidos`);

    // Pontos de exemplo - rota de Cuiabá para Campo Grande
    const trackingPoints = [
      { lat: -15.6014, lng: -56.0979, desc: 'Cuiabá - Centro de Distribuição' },
      { lat: -15.8267, lng: -56.0581, desc: 'Várzea Grande - Checkpoint 1' },
      { lat: -16.2631, lng: -54.7253, desc: 'Rondonópolis - Checkpoint 2' },
      { lat: -17.7311, lng: -53.1194, desc: 'Chapadão do Sul - Checkpoint 3' },
      { lat: -19.0208, lng: -52.1664, desc: 'Camapuã - Checkpoint 4' },
      { lat: -19.7633, lng: -53.2367, desc: 'Ribas do Rio Pardo - Checkpoint 5' },
      { lat: -20.4486, lng: -54.6295, desc: 'Campo Grande - Destino Final' }
    ];

    // Adicionar pontos com intervalos de tempo (2 horas entre cada ponto)
    const baseTime = new Date();
    baseTime.setHours(baseTime.getHours() - (trackingPoints.length * 2));

    console.log('📍 Inserindo pontos de rastreamento...');

    for (let i = 0; i < trackingPoints.length; i++) {
      const point = trackingPoints[i];
      const timestamp = new Date(baseTime.getTime() + (i * 2 * 60 * 60 * 1000));

      await pool.query(
        'INSERT INTO tracking_points (order_id, latitude, longitude, created_at) VALUES ($1, $2, $3, $4)',
        [21, point.lat, point.lng, timestamp]
      );

      console.log(`   ✓ Ponto ${i + 1}: ${point.desc} (${point.lat}, ${point.lng})`);
    }

    // Verificar se os pontos foram inseridos
    const verifyResult = await pool.query(
      'SELECT COUNT(*) as total FROM tracking_points WHERE order_id = 21'
    );

    console.log('✅ Pontos de rastreamento adicionados com sucesso!');
    console.log(`📊 Total de pontos inseridos: ${verifyResult.rows[0].total}`);
    console.log('🔄 Atualize a página para ver os pontos no mapa.');

  } catch (error) {
    console.error('❌ Erro ao adicionar pontos de rastreamento:', error);
    console.error('📋 Detalhes do erro:', {
      message: error.message,
      code: error.code,
      detail: error.detail
    });
  } finally {
    if (pool) {
      await pool.end();
      console.log('🔌 Conexão com banco encerrada');
    }
  }
}

// Executar se chamado diretamente
if (require.main === module) {
  addTrackingPointsForOrder21();
}

module.exports = { addTrackingPointsForOrder21 };
