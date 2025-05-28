const { Pool } = require('pg');

// Configuração do banco de dados
const pool = new Pool({
    connectionString: 'postgresql://neondb_owner:npg_sVLwi40aXDWd@ep-sparkling-surf-a6zclzez.us-west-2.aws.neon.tech:5432/neondb',
    ssl: {
        rejectUnauthorized: false
    }
});

async function testDatabaseStructure() {
    try {
        console.log('🔍 Verificando estrutura do banco de dados...\n');
        
        // 1. Verificar se a tabela tracking_points existe
        console.log('1️⃣ Verificando tabela tracking_points...');
        const trackingTableQuery = `
            SELECT column_name, data_type, is_nullable 
            FROM information_schema.columns 
            WHERE table_name = 'tracking_points'
            ORDER BY ordinal_position;
        `;
        
        const trackingResult = await pool.query(trackingTableQuery);
        
        if (trackingResult.rows.length === 0) {
            console.log('❌ Tabela tracking_points NÃO EXISTE!');
            console.log('💡 Criando tabela tracking_points...');
            
            const createTrackingTable = `
                CREATE TABLE IF NOT EXISTS tracking_points (
                    id SERIAL PRIMARY KEY,
                    order_id INTEGER REFERENCES orders(id),
                    status VARCHAR(50),
                    comment TEXT,
                    user_id INTEGER,
                    latitude DECIMAL(10, 8),
                    longitude DECIMAL(11, 8),
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
            `;
            
            await pool.query(createTrackingTable);
            console.log('✅ Tabela tracking_points criada com sucesso!');
        } else {
            console.log('✅ Tabela tracking_points existe!');
            console.log('📋 Colunas:');
            trackingResult.rows.forEach(row => {
                console.log(`   - ${row.column_name}: ${row.data_type} (${row.is_nullable === 'YES' ? 'NULL' : 'NOT NULL'})`);
            });
        }
        
        console.log('\n2️⃣ Verificando tabela orders...');
        const ordersTableQuery = `
            SELECT column_name, data_type, is_nullable 
            FROM information_schema.columns 
            WHERE table_name = 'orders'
            ORDER BY ordinal_position;
        `;
        
        const ordersResult = await pool.query(ordersTableQuery);
        console.log('✅ Tabela orders existe!');
        console.log('📋 Colunas principais:');
        ordersResult.rows.slice(0, 10).forEach(row => {
            console.log(`   - ${row.column_name}: ${row.data_type}`);
        });
        
        console.log('\n3️⃣ Testando inserção na tracking_points...');
        
        // Buscar um pedido real para teste
        const orderQuery = 'SELECT id, order_id FROM orders LIMIT 1';
        const orderResult = await pool.query(orderQuery);
        
        if (orderResult.rows.length > 0) {
            const testOrder = orderResult.rows[0];
            console.log(`📦 Usando pedido de teste: ${testOrder.order_id} (ID: ${testOrder.id})`);
            
            // Tentar inserir um ponto de rastreamento
            const insertQuery = `
                INSERT INTO tracking_points (order_id, status, comment, user_id, created_at)
                VALUES ($1, $2, $3, $4, NOW())
                RETURNING id;
            `;
            
            const insertResult = await pool.query(insertQuery, [
                testOrder.id,
                'Teste',
                'Teste de inserção via script',
                1
            ]);
            
            console.log(`✅ Inserção bem-sucedida! ID: ${insertResult.rows[0].id}`);
            
            // Limpar o teste
            await pool.query('DELETE FROM tracking_points WHERE id = $1', [insertResult.rows[0].id]);
            console.log('🧹 Registro de teste removido');
        }
        
        console.log('\n🎉 Estrutura do banco verificada com sucesso!');
        
    } catch (error) {
        console.error('❌ Erro ao verificar estrutura:', error);
        console.error('📋 Detalhes do erro:', error.message);
    } finally {
        await pool.end();
    }
}

testDatabaseStructure(); 