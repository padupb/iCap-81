
const { Pool } = require('pg');

// Configuração do banco de dados
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('neon.tech') ? { rejectUnauthorized: false } : false
});

async function addTrackingPointsForOrder21() {
  try {
    console.log('🔄 Adicionando pontos de rastreamento para o pedido ID 21...');

    // Verificar se o pedido 21 existe
    const orderCheck = await pool.query('SELECT id, order_id FROM orders WHERE id = 21');
    
    if (!orderCheck.rows.length) {
      console.log('❌ Pedido 21 não encontrado');
      return;
    }

    const order = orderCheck.rows[0];
    console.log(`📦 Pedido encontrado: ${order.order_id}`);

    // Limpar pontos existentes para este pedido
    await pool.query('DELETE FROM tracking_points WHERE order_id = 21');
    console.log('🗑️ Pontos antigos removidos');

    // Pontos de exemplo - rota de São Paulo para Brasília
    const trackingPoints = [
      { lat: -23.5505, lng: -46.6333, desc: 'São Paulo - Centro de Distribuição' },
      { lat: -23.2081, lng: -46.8719, desc: 'Jundiaí - Checkpoint 1' },
      { lat: -22.7077, lng: -47.1416, desc: 'Campinas - Checkpoint 2' },
      { lat: -21.1619, lng: -47.8099, desc: 'Ribeirão Preto - Checkpoint 3' },
      { lat: -19.9167, lng: -47.9167, desc: 'Uberaba - Checkpoint 4' },
      { lat: -18.9186, lng: -48.2772, desc: 'Uberlândia - Checkpoint 5' },
      { lat: -16.6789, lng: -49.2550, desc: 'Anápolis - Checkpoint 6' },
      { lat: -15.7942, lng: -47.8825, desc: 'Brasília - Destino Final' }
    ];

    // Adicionar pontos com intervalos de tempo (1 hora entre cada ponto)
    const baseTime = new Date();
    baseTime.setHours(baseTime.getHours() - trackingPoints.length);

    for (let i = 0; i < trackingPoints.length; i++) {
      const point = trackingPoints[i];
      const timestamp = new Date(baseTime.getTime() + (i * 60 * 60 * 1000));

      await pool.query(
        'INSERT INTO tracking_points (order_id, latitude, longitude, created_at) VALUES ($1, $2, $3, $4)',
        [21, point.lat, point.lng, timestamp]
      );

      console.log(`📍 Ponto ${i + 1}: ${point.desc} (${point.lat}, ${point.lng})`);
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
  } finally {
    await pool.end();
  }
}

// Executar se chamado diretamente
if (require.main === module) {
  addTrackingPointsForOrder21();
}

module.exports = { addTrackingPointsForOrder21 };
