// Script para listar pedidos existentes no banco de dados
const { Pool } = require('pg');

const DATABASE_URL = 'postgresql://neondb_owner:npg_sVLwi40aXDWd@ep-sparkling-surf-a6zclzez.us-west-2.aws.neon.tech:5432/neondb';

const pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

async function listOrders() {
    try {
        console.log('🔍 Buscando pedidos no banco de dados...\n');
        
        const query = `
            SELECT 
                o.id,
                o.order_id,
                o.status,
                o.work_location,
                o.delivery_date,
                o.quantity,
                p.name as product_name,
                c.name as supplier_name,
                u.name as user_name,
                o.created_at
            FROM orders o
            LEFT JOIN products p ON o.product_id = p.id
            LEFT JOIN companies c ON o.supplier_id = c.id
            LEFT JOIN users u ON o.user_id = u.id
            ORDER BY o.created_at DESC
            LIMIT 10
        `;
        
        const result = await pool.query(query);
        
        if (result.rows.length === 0) {
            console.log('❌ Nenhum pedido encontrado no banco de dados!');
            console.log('\n💡 Para criar um pedido:');
            console.log('1. Acesse http://localhost:3000');
            console.log('2. Faça login: padupb@admin.icap / 170824');
            console.log('3. Vá em "Pedidos" → "Novo Pedido"');
            console.log('4. Preencha os dados e salve');
            console.log('5. Use o código gerado na PWA');
        } else {
            console.log(`✅ Encontrados ${result.rows.length} pedidos:\n`);
            
            result.rows.forEach((order, index) => {
                console.log(`${index + 1}. 📦 CÓDIGO: ${order.order_id}`);
                console.log(`   Status: ${order.status}`);
                console.log(`   Produto: ${order.product_name || 'N/A'}`);
                console.log(`   Fornecedor: ${order.supplier_name || 'N/A'}`);
                console.log(`   Local: ${order.work_location}`);
                console.log(`   Criado: ${new Date(order.created_at).toLocaleString('pt-BR')}`);
                console.log('   ─────────────────────────────────────');
            });
            
            console.log('\n🎯 COMO TESTAR NA PWA:');
            console.log(`1. Acesse: http://localhost:8080`);
            console.log(`2. Digite um dos códigos acima (ex: ${result.rows[0].order_id})`);
            console.log(`3. O status mudará automaticamente para "Em Transporte"`);
            console.log(`4. O GPS começará a ser rastreado`);
            
            console.log('\n📱 TESTE NO CELULAR:');
            console.log(`1. Acesse: http://192.168.0.40:8080`);
            console.log(`2. Use o mesmo código do pedido`);
        }
        
    } catch (error) {
        console.error('❌ Erro ao buscar pedidos:', error.message);
        console.log('\n💡 Verifique se:');
        console.log('1. O servidor PWA está rodando: node pwa-api.js');
        console.log('2. A conexão com internet está funcionando');
        console.log('3. O banco de dados está acessível');
    } finally {
        await pool.end();
    }
}

listOrders(); 