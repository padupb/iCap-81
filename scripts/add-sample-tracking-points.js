
const { Pool } = require('pg');

// Configuração do banco usando DATABASE_URL do arquivo env
require('dotenv').config({ path: './env' });

async function addSampleTrackingPoints() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL?.includes('localhost') ? false : { rejectUnauthorized: false }
  });

  try {
    console.log('🗺️ Adicionando pontos de rastreamento de exemplo...');

    // Verificar se a tabela tracking_points existe
    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'tracking_points'
      );
    `);

    if (!tableCheck.rows[0].exists) {
      console.log('❌ Tabela tracking_points não existe. Execute o script create-tracking-table.js primeiro.');
      return;
    }

    // Buscar um pedido para adicionar pontos de rastreamento
    const orderResult = await pool.query('SELECT id, order_id FROM orders LIMIT 1');
    
    if (orderResult.rows.length === 0) {
      console.log('❌ Nenhum pedido encontrado para adicionar pontos de rastreamento.');
      return;
    }

    const order = orderResult.rows[0];
    console.log(`📦 Adicionando pontos para o pedido ID: ${order.id} (${order.order_id})`);

    // Pontos de exemplo (rota hipotética de São Paulo para Brasília)
    const samplePoints = [
      { lat: -23.5505, lng: -46.6333, description: 'São Paulo - Origem' },
      { lat: -23.2081, lng: -46.8719, description: 'Jundiaí - Checkpoint 1' },
      { lat: -22.7077, lng: -47.1416, description: 'Campinas - Checkpoint 2' },
      { lat: -21.1619, lng: -47.8099, description: 'Ribeirão Preto - Checkpoint 3' },
      { lat: -19.9167, lng: -47.9167, description: 'Uberaba - Checkpoint 4' },
      { lat: -18.9186, lng: -48.2772, description: 'Uberlândia - Checkpoint 5' },
      { lat: -16.6789, lng: -49.2550, description: 'Anápolis - Checkpoint 6' },
      { lat: -15.7942, lng: -47.8825, description: 'Brasília - Destino' }
    ];

    // Limpar pontos existentes para este pedido
    await pool.query('DELETE FROM tracking_points WHERE order_id = $1', [order.id]);

    // Adicionar novos pontos com intervalos de tempo
    const baseDate = new Date();
    baseDate.setHours(baseDate.getHours() - samplePoints.length);

    for (let i = 0; i < samplePoints.length; i++) {
      const point = samplePoints[i];
      const timestamp = new Date(baseDate.getTime() + (i * 60 * 60 * 1000)); // 1 hora entre cada ponto

      await pool.query(
        'INSERT INTO tracking_points (order_id, latitude, longitude, created_at) VALUES ($1, $2, $3, $4)',
        [order.id, point.lat, point.lng, timestamp]
      );

      console.log(`📍 Ponto ${i + 1}: ${point.description} (${point.lat}, ${point.lng})`);
    }

    console.log('✅ Pontos de rastreamento de exemplo adicionados com sucesso!');
    console.log(`🔗 Acesse o pedido ${order.order_id} na aba "Rastreamento" para ver o mapa.`);

  } catch (error) {
    console.error('❌ Erro ao adicionar pontos de rastreamento:', error);
  } finally {
    await pool.end();
  }
}

addSampleTrackingPoints();
