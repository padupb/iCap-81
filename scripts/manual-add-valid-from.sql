
-- Script para adicionar coluna valido_desde na tabela ordens_compra
-- Execute este comando diretamente no seu banco de dados

-- 1. Adicionar a coluna valido_desde
ALTER TABLE ordens_compra 
ADD COLUMN IF NOT EXISTS valido_desde TIMESTAMP;

-- 2. Preencher valores padrão (7 dias antes da data de validade atual)
UPDATE ordens_compra 
SET valido_desde = valido_ate - INTERVAL '7 days'
WHERE valido_desde IS NULL;

-- 3. Tornar a coluna NOT NULL
ALTER TABLE ordens_compra 
ALTER COLUMN valido_desde SET NOT NULL;

-- 4. Verificar se a tabela purchase_orders existe e fazer a mesma alteração
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'purchase_orders') THEN
        -- Adicionar coluna valid_from se não existir
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'purchase_orders' AND column_name = 'valid_from') THEN
            ALTER TABLE purchase_orders ADD COLUMN valid_from TIMESTAMP;
            
            -- Preencher valores padrão
            UPDATE purchase_orders 
            SET valid_from = valid_until - INTERVAL '7 days'
            WHERE valid_from IS NULL;
            
            -- Tornar NOT NULL
            ALTER TABLE purchase_orders ALTER COLUMN valid_from SET NOT NULL;
        END IF;
    END IF;
END $$;

-- 5. Verificar a estrutura final
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'ordens_compra' 
ORDER BY ordinal_position;
