const { Pool } = require('pg');

// Configuração do banco de dados
const pool = new Pool({
    connectionString: 'postgresql://neondb_owner:npg_sVLwi40aXDWd@ep-sparkling-surf-a6zclzez.us-west-2.aws.neon.tech:5432/neondb',
    ssl: {
        rejectUnauthorized: false
    }
});

async function checkUsers() {
    try {
        console.log('👥 Verificando usuários no banco de dados...\n');
        
        const query = 'SELECT id, name, email FROM users ORDER BY id';
        const result = await pool.query(query);
        
        if (result.rows.length > 0) {
            console.log(`✅ Encontrados ${result.rows.length} usuários:`);
            result.rows.forEach(user => {
                console.log(`   ID: ${user.id} | Nome: ${user.name || 'N/A'} | Email: ${user.email || 'N/A'}`);
            });
            
            console.log(`\n💡 Use um destes IDs na PWA em vez de 9999`);
            console.log(`📝 Sugestão: Use ID ${result.rows[0].id} (${result.rows[0].name || result.rows[0].email})`);
        } else {
            console.log('❌ Nenhum usuário encontrado!');
            console.log('💡 Criando usuário padrão para PWA...');
            
            const insertQuery = `
                INSERT INTO users (name, email, password, role, created_at)
                VALUES ($1, $2, $3, $4, NOW())
                RETURNING id, name, email;
            `;
            
            const newUser = await pool.query(insertQuery, [
                'PWA Tracker',
                'pwa@icap.system',
                'pwa_tracker_2025',
                'tracker'
            ]);
            
            console.log(`✅ Usuário PWA criado com ID: ${newUser.rows[0].id}`);
        }
        
    } catch (error) {
        console.error('❌ Erro ao verificar usuários:', error.message);
    } finally {
        await pool.end();
    }
}

checkUsers(); 