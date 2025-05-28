const { Pool } = require('pg');

// Configuração do banco de dados
const pool = new Pool({
    connectionString: 'postgresql://neondb_owner:npg_sVLwi40aXDWd@ep-sparkling-surf-a6zclzez.us-west-2.aws.neon.tech:5432/neondb',
    ssl: {
        rejectUnauthorized: false
    }
});

async function checkTrackingTable() {
    try {
        console.log('🔍 Verificando estrutura da tabela tracking_points...\n');
        
        // 1. Verificar colunas da tabela
        console.log('1️⃣ Estrutura da tabela:');
        const columnsQuery = `
            SELECT column_name, data_type, is_nullable, column_default
            FROM information_schema.columns 
            WHERE table_name = 'tracking_points'
            ORDER BY ordinal_position;
        `;
        
        const columnsResult = await pool.query(columnsQuery);
        columnsResult.rows.forEach(col => {
            console.log(`   - ${col.column_name}: ${col.data_type} (${col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL'})`);
        });
        
        // 2. Verificar restrições de chave estrangeira
        console.log('\n2️⃣ Restrições de chave estrangeira:');
        const constraintsQuery = `
            SELECT 
                tc.constraint_name,
                tc.table_name,
                kcu.column_name,
                ccu.table_name AS foreign_table_name,
                ccu.column_name AS foreign_column_name
            FROM information_schema.table_constraints AS tc
            JOIN information_schema.key_column_usage AS kcu
                ON tc.constraint_name = kcu.constraint_name
            JOIN information_schema.constraint_column_usage AS ccu
                ON ccu.constraint_name = tc.constraint_name
            WHERE tc.constraint_type = 'FOREIGN KEY' 
                AND tc.table_name = 'tracking_points';
        `;
        
        const constraintsResult = await pool.query(constraintsQuery);
        constraintsResult.rows.forEach(constraint => {
            console.log(`   - ${constraint.constraint_name}: ${constraint.column_name} → ${constraint.foreign_table_name}.${constraint.foreign_column_name}`);
        });
        
        // 3. Verificar se user_id = 1 existe na tabela users
        console.log('\n3️⃣ Verificando se user_id = 1 existe:');
        const userQuery = 'SELECT id, name, email FROM users WHERE id = 1';
        const userResult = await pool.query(userQuery);
        
        if (userResult.rows.length > 0) {
            const user = userResult.rows[0];
            console.log(`   ✅ Usuário ID 1 existe: ${user.name} (${user.email})`);
        } else {
            console.log('   ❌ Usuário ID 1 NÃO EXISTE!');
            
            // Listar usuários disponíveis
            console.log('\n4️⃣ Usuários disponíveis:');
            const allUsersQuery = 'SELECT id, name, email FROM users ORDER BY id LIMIT 5';
            const allUsersResult = await pool.query(allUsersQuery);
            allUsersResult.rows.forEach(user => {
                console.log(`   - ID ${user.id}: ${user.name} (${user.email})`);
            });
        }
        
        // 5. Tentar inserção de teste
        console.log('\n5️⃣ Teste de inserção simples:');
        try {
            // Buscar um pedido válido
            const orderQuery = 'SELECT id, order_id FROM orders LIMIT 1';
            const orderResult = await pool.query(orderQuery);
            
            if (orderResult.rows.length > 0) {
                const order = orderResult.rows[0];
                console.log(`   📦 Usando pedido: ${order.order_id} (ID: ${order.id})`);
                
                // Buscar um usuário válido
                const validUserQuery = 'SELECT id FROM users LIMIT 1';
                const validUserResult = await pool.query(validUserQuery);
                
                if (validUserResult.rows.length > 0) {
                    const validUserId = validUserResult.rows[0].id;
                    console.log(`   👤 Usando usuário ID: ${validUserId}`);
                    
                    const testInsertQuery = `
                        INSERT INTO tracking_points (order_id, status, comment, user_id, created_at)
                        VALUES ($1, $2, $3, $4, NOW())
                        RETURNING id;
                    `;
                    
                    const insertResult = await pool.query(testInsertQuery, [
                        order.id,
                        'Teste',
                        'Teste de inserção',
                        validUserId
                    ]);
                    
                    console.log(`   ✅ Inserção bem-sucedida! ID: ${insertResult.rows[0].id}`);
                    
                    // Limpar teste
                    await pool.query('DELETE FROM tracking_points WHERE id = $1', [insertResult.rows[0].id]);
                    console.log('   🧹 Registro de teste removido');
                }
            }
        } catch (insertError) {
            console.log(`   ❌ Erro na inserção: ${insertError.message}`);
        }
        
    } catch (error) {
        console.error('❌ Erro:', error.message);
    } finally {
        await pool.end();
    }
}

checkTrackingTable(); 