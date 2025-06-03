
import pkg from 'pg';
const { Pool } = pkg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function checkPedidoAprovador() {
  try {
    console.log('🔍 Analisando pedido CAP0106250248...');
    
    // 1. Buscar o pedido
    const pedidoResult = await pool.query(
      "SELECT * FROM orders WHERE order_id = $1",
      ['CAP0106250248']
    );
    
    if (pedidoResult.rows.length === 0) {
      console.log('❌ Pedido CAP0106250248 não encontrado');
      return;
    }
    
    const pedido = pedidoResult.rows[0];
    console.log('📦 Pedido encontrado:', {
      id: pedido.id,
      order_id: pedido.order_id,
      status: pedido.status,
      is_urgent: pedido.is_urgent,
      purchase_order_id: pedido.purchase_order_id
    });
    
    // 2. Buscar a ordem de compra vinculada
    if (pedido.purchase_order_id) {
      const ordemCompraResult = await pool.query(
        "SELECT * FROM ordens_compra WHERE id = $1",
        [pedido.purchase_order_id]
      );
      
      if (ordemCompraResult.rows.length > 0) {
        const ordemCompra = ordemCompraResult.rows[0];
        console.log('📋 Ordem de compra vinculada:', {
          id: ordemCompra.id,
          numero_ordem: ordemCompra.numero_ordem,
          cnpj: ordemCompra.cnpj,
          empresa_id: ordemCompra.empresa_id
        });
        
        // 3. Buscar a obra de destino (empresa com o CNPJ da ordem)
        if (ordemCompra.cnpj) {
          const obraResult = await pool.query(
            "SELECT * FROM companies WHERE cnpj = $1",
            [ordemCompra.cnpj]
          );
          
          if (obraResult.rows.length > 0) {
            const obra = obraResult.rows[0];
            console.log('🏗️ Obra de destino:', {
              id: obra.id,
              name: obra.name,
              cnpj: obra.cnpj,
              approver_id: obra.approver_id
            });
            
            // 4. Buscar o aprovador
            if (obra.approver_id) {
              const aprovadorResult = await pool.query(
                "SELECT * FROM users WHERE id = $1",
                [obra.approver_id]
              );
              
              if (aprovadorResult.rows.length > 0) {
                const aprovador = aprovadorResult.rows[0];
                console.log('✅ APROVADOR ENCONTRADO:', {
                  id: aprovador.id,
                  name: aprovador.name,
                  email: aprovador.email,
                  company_id: aprovador.company_id
                });
                
                // Verificar a empresa do aprovador
                if (aprovador.company_id) {
                  const empresaAprovadorResult = await pool.query(
                    "SELECT name FROM companies WHERE id = $1",
                    [aprovador.company_id]
                  );
                  
                  if (empresaAprovadorResult.rows.length > 0) {
                    console.log('🏢 Empresa do aprovador:', empresaAprovadorResult.rows[0].name);
                  }
                }
              } else {
                console.log('❌ Aprovador não encontrado com ID:', obra.approver_id);
              }
            } else {
              console.log('⚠️ Obra não possui aprovador definido');
            }
          } else {
            console.log('❌ Obra de destino não encontrada com CNPJ:', ordemCompra.cnpj);
          }
        } else {
          console.log('⚠️ Ordem de compra não possui CNPJ definido');
        }
      } else {
        console.log('❌ Ordem de compra não encontrada com ID:', pedido.purchase_order_id);
      }
    } else {
      console.log('⚠️ Pedido não possui ordem de compra vinculada');
    }
    
    // 5. Resumo final
    console.log('\n📊 RESUMO:');
    console.log(`Pedido: ${pedido.order_id}`);
    console.log(`Status: ${pedido.status}`);
    console.log(`Urgente: ${pedido.is_urgent ? 'Sim' : 'Não'}`);
    
    // 6. Query completa para debug
    console.log('\n🔍 QUERY COMPLETA:');
    const queryCompleta = await pool.query(`
      SELECT 
        o.order_id as "pedido",
        o.status as "status_pedido",
        oc.numero_ordem as "ordem_compra",
        oc.cnpj as "cnpj_destino",
        obra.name as "nome_obra",
        obra.approver_id as "aprovador_id",
        u.name as "nome_aprovador",
        u.email as "email_aprovador"
      FROM orders o
      LEFT JOIN ordens_compra oc ON o.purchase_order_id = oc.id
      LEFT JOIN companies obra ON oc.cnpj = obra.cnpj
      LEFT JOIN users u ON obra.approver_id = u.id
      WHERE o.order_id = $1
    `, ['CAP0106250248']);
    
    if (queryCompleta.rows.length > 0) {
      const resultado = queryCompleta.rows[0];
      console.log('📋 Resultado completo:', resultado);
      
      if (resultado.nome_aprovador) {
        console.log(`\n🎯 RESPOSTA: O aprovador do pedido ${resultado.pedido} é ${resultado.nome_aprovador} (${resultado.email_aprovador})`);
      } else {
        console.log(`\n❌ RESPOSTA: O pedido ${resultado.pedido} não possui aprovador definido`);
      }
    }
    
  } catch (error) {
    console.error('❌ Erro na análise:', error);
  } finally {
    await pool.end();
  }
}

checkPedidoAprovador();
