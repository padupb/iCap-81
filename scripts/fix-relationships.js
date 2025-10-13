
import { pool } from '../server/db.js';

async function fixRelationships() {
  try {
    console.log('🔍 Verificando relacionamentos...\n');

    // 1. Verificar produtos sem unidade válida
    console.log('📦 PRODUTOS:');
    const productsResult = await pool.query(`
      SELECT p.id, p.name, p.unit_id, u.name as unit_name, u.abbreviation
      FROM products p
      LEFT JOIN units u ON p.unit_id = u.id
      ORDER BY p.id
    `);

    const productsWithoutUnit = productsResult.rows.filter(p => !p.unit_name);
    console.log(`   Total de produtos: ${productsResult.rows.length}`);
    console.log(`   Produtos sem unidade válida: ${productsWithoutUnit.length}\n`);

    if (productsWithoutUnit.length > 0) {
      console.log('   ⚠️ Produtos com problema:');
      productsWithoutUnit.forEach(p => {
        console.log(`      - ID ${p.id}: ${p.name} (unit_id: ${p.unit_id})`);
      });
      console.log('');
    }

    // 2. Verificar usuários sem função válida
    console.log('👤 USUÁRIOS:');
    const usersResult = await pool.query(`
      SELECT u.id, u.name, u.role_id, r.name as role_name
      FROM users u
      LEFT JOIN user_roles r ON u.role_id = r.id
      ORDER BY u.id
    `);

    const usersWithoutRole = usersResult.rows.filter(u => !u.role_name && u.role_id);
    console.log(`   Total de usuários: ${usersResult.rows.length}`);
    console.log(`   Usuários sem função válida: ${usersWithoutRole.length}\n`);

    if (usersWithoutRole.length > 0) {
      console.log('   ⚠️ Usuários com problema:');
      usersWithoutRole.forEach(u => {
        console.log(`      - ID ${u.id}: ${u.name} (role_id: ${u.role_id})`);
      });
      console.log('');
    }

    // 3. Listar unidades disponíveis
    console.log('📏 UNIDADES DISPONÍVEIS:');
    const unitsResult = await pool.query('SELECT * FROM units ORDER BY id');
    console.log(`   Total: ${unitsResult.rows.length}`);
    unitsResult.rows.forEach(u => {
      console.log(`      - ID ${u.id}: ${u.name} (${u.abbreviation})`);
    });
    console.log('');

    // 4. Listar funções disponíveis
    console.log('🎭 FUNÇÕES DISPONÍVEIS:');
    const rolesResult = await pool.query('SELECT * FROM user_roles ORDER BY id');
    console.log(`   Total: ${rolesResult.rows.length}`);
    rolesResult.rows.forEach(r => {
      console.log(`      - ID ${r.id}: ${r.name}`);
    });
    console.log('');

    // 5. Sugestões de correção
    if (productsWithoutUnit.length > 0) {
      console.log('💡 SUGESTÃO DE CORREÇÃO PARA PRODUTOS:');
      console.log('   Execute o seguinte SQL para corrigir (substitua os valores conforme necessário):');
      productsWithoutUnit.forEach(p => {
        console.log(`   UPDATE products SET unit_id = 1 WHERE id = ${p.id}; -- ${p.name}`);
      });
      console.log('');
    }

    if (usersWithoutRole.length > 0) {
      console.log('💡 SUGESTÃO DE CORREÇÃO PARA USUÁRIOS:');
      console.log('   Execute o seguinte SQL para corrigir (substitua os valores conforme necessário):');
      usersWithoutRole.forEach(u => {
        console.log(`   UPDATE users SET role_id = 3 WHERE id = ${u.id}; -- ${u.name}`);
      });
      console.log('');
    }

    console.log('✅ Diagnóstico concluído!');

  } catch (error) {
    console.error('❌ Erro ao verificar relacionamentos:', error);
  } finally {
    await pool.end();
  }
}

fixRelationships();
