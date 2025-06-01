
# PRD - i-CAP 5.0
## Product Requirements Document

**Versão:** 5.0  
**Data:** Janeiro 2025  
**Responsável:** Equipe de Desenvolvimento i-CAP  

---

## 1. Visão Geral do Produto

### 1.1 Descrição
O i-CAP 5.0 é um sistema de gestão logística completo destinado ao controle de pedidos, ordens de compra, produtos e empresas em obras de infraestrutura. O sistema foi projetado para otimizar a cadeia de suprimentos com funcionalidades robustas de gestão de documentos, rastreamento e processamento de pedidos.

### 1.2 Objetivos
- Centralizar o controle de pedidos e ordens de compra
- Automatizar fluxos de aprovação e entrega
- Garantir rastreabilidade completa de materiais
- Facilitar a gestão documental de certificados e notas fiscais
- Fornecer dashboard analítico para tomada de decisões

### 1.3 Público-Alvo
- **Gestores de Obra:** Controle geral de pedidos e aprovações
- **Equipe de Suprimentos:** Criação e acompanhamento de pedidos
- **Fornecedores:** Confirmação de entregas e upload de documentos
- **Administradores:** Gestão de usuários e configurações do sistema

---

## 2. Arquitetura Técnica

### 2.1 Stack Tecnológico
- **Frontend:** React 18 + TypeScript + Tailwind CSS + shadcn/ui
- **Backend:** Node.js + Express + TypeScript
- **Banco de Dados:** PostgreSQL (Neon)
- **ORM:** Drizzle
- **Autenticação:** Express Session + Passport.js
- **Upload de Arquivos:** Multer
- **Mapas:** Google Maps API
- **QR Code:** qrcode library

### 2.2 Estrutura de Banco de Dados
```sql
-- Principais entidades
users (id, name, email, password, role_id, company_id, can_confirm_delivery, primeiro_login)
companies (id, name, cnpj, address, category_id, approver_id, contract_number)
company_categories (id, name, requires_contract, receives_purchase_orders)
user_roles (id, name, permissions)
products (id, name, description, code, unit_id)
units (id, name, symbol)
purchase_orders (id, numero_ordem, empresa_id, cnpj, valido_ate, status)
itens_ordem_compra (id, ordem_compra_id, produto_id, quantidade)
orders (id, order_id, product_id, quantity, company_id, purchase_order_id, priority, status, is_urgent, documentoscarregados, documentosinfo)
tracking_points (id, order_id, user_id, status, comment, latitude, longitude, timestamp)
system_logs (id, user_id, action, item_type, item_id, details, timestamp)
settings (id, key, value)
```

---

## 3. Funcionalidades Principais

### 3.1 Gestão de Usuários
**Objetivo:** Controlar acesso e permissões no sistema

**Funcionalidades:**
- Cadastro de usuários com diferentes perfis (KeyUser, Administrador, Suprimentos, etc.)
- Sistema de roles com permissões granulares
- Autenticação por email/senha
- Primeiro login obrigatório com troca de senha
- Gestão de permissões específicas (can_confirm_delivery)

**Regras de Negócio:**
- KeyUser tem acesso total ao sistema (email @admin.icap)
- Usuários devem trocar senha no primeiro login
- Permissões são herdadas da role associada
- Apenas administradores podem criar/editar usuários

### 3.2 Gestão de Empresas
**Objetivo:** Centralizar informações de fornecedores, obras e clientes

**Funcionalidades:**
- Cadastro completo de empresas (nome, CNPJ, endereço, categoria)
- Categorização (Fornecedor, Obra, Cliente)
- Vinculação de contratos
- Definição de aprovadores por empresa
- Validação de CNPJ

**Regras de Negócio:**
- Empresas de categoria "Obra" podem receber ordens de compra
- Algumas categorias exigem contrato obrigatório
- Aprovadores devem ser usuários válidos do sistema

### 3.3 Gestão de Produtos
**Objetivo:** Manter catálogo de produtos e unidades de medida

**Funcionalidades:**
- Cadastro de produtos com código, nome e descrição
- Vinculação a unidades de medida
- Busca e filtros avançados
- Histórico de utilização em pedidos

**Regras de Negócio:**
- Produtos devem ter unidade de medida válida
- Códigos de produtos devem ser únicos
- Não é possível excluir produtos com pedidos associados

### 3.4 Gestão de Ordens de Compra
**Objetivo:** Controlar ordens de compra e seus itens

**Funcionalidades:**
- Criação de ordens com número único (5 dígitos)
- Vinculação a fornecedor e obra
- Adição de múltiplos produtos com quantidades
- Controle de validade e status
- Verificação de saldo disponível
- Exclusão de ordens (com validações)

**Regras de Negócio:**
- Número da ordem deve ter exatamente 5 dígitos
- Máximo 4 produtos por ordem
- Data de validade não pode ser anterior a hoje
- Ordens expiradas são marcadas automaticamente como "Expirado"
- Não é possível excluir ordens com pedidos associados

### 3.5 Gestão de Pedidos
**Objetivo:** Processar solicitações de materiais

**Funcionalidades:**
- Criação de pedidos vinculados a ordens de compra
- Verificação automática de saldo disponível
- Controle de prioridade e urgência
- Upload de documentos (Nota PDF, XML, Certificado)
- Rastreamento geográfico
- Confirmação de entrega
- Sistema de aprovações para pedidos urgentes

**Regras de Negócio:**
- Pedidos só podem ser criados se houver saldo na ordem de compra
- Pedidos urgentes (diferença ≤ 3 dias) requerem aprovação
- Pedidos não urgentes são automaticamente aprovados
- Upload de documentos é obrigatório para gerar QR Code
- Apenas usuários com can_confirm_delivery podem confirmar entregas
- Quantidade usada exclui pedidos cancelados do cálculo

### 3.6 Sistema de Aprovações
**Objetivo:** Controlar aprovação de pedidos urgentes

**Funcionalidades:**
- Visualização de pedidos urgentes pendentes
- Aprovação/rejeição com comentários
- Notificações para aprovadores
- Histórico de decisões

**Regras de Negócio:**
- Apenas KeyUsers e aprovadores das empresas envolvidas podem ver pedidos urgentes
- Aprovadores devem pertencer à empresa solicitante ou fornecedora
- Pedidos urgentes só liberam QR Code e aba "Documentos" após aprovação

### 3.7 Upload e Gestão de Documentos
**Objetivo:** Centralizar documentos relacionados aos pedidos

**Funcionalidades:**
- Upload de até 3 tipos: Nota PDF, Nota XML, Certificado PDF
- Armazenamento organizado por pedido
- Download de documentos
- Validação de tipos de arquivo
- Informações detalhadas dos arquivos (nome, tamanho, data)

**Regras de Negócio:**
- Apenas arquivos PDF e XML são aceitos
- Documentos são salvos em pastas por ID do pedido
- QR Code só é liberado após upload completo
- Aba "Confirmar Entrega" só aparece após upload e para usuários autorizados

### 3.8 Rastreamento e QR Code
**Objetivo:** Permitir rastreamento de pedidos em campo

**Funcionalidades:**
- Geração de QR Code único por pedido
- Rastreamento via coordenadas GPS
- Histórico de pontos de rastreamento
- Integração com Google Maps
- Confirmação de entrega via QR Code

**Regras de Negócio:**
- QR Code só é gerado após upload de documentos
- Para pedidos urgentes, QR Code só aparece após aprovação
- Rastreamento registra localização, usuário e timestamp
- Confirmação pode ser "Entregue" ou "Recusado" com comentário

### 3.9 Dashboard e Relatórios
**Objetivo:** Fornecer visão analítica do sistema

**Funcionalidades:**
- Estatísticas de pedidos por status
- Gráficos de desempenho temporal
- Mapa de rastreamento em tempo real
- Alertas de pedidos urgentes
- Relatórios de saldo de ordens de compra

**Regras de Negócio:**
- Dados são atualizados em tempo real
- Filtros por período, empresa, produto
- Acesso controlado por permissões

### 3.10 Logs e Auditoria
**Objetivo:** Manter histórico completo de operações

**Funcionalidades:**
- Log automático de todas as operações críticas
- Rastreabilidade de mudanças por usuário
- Histórico de login/logout
- Logs de aprovações e rejeições
- Exportação de logs para auditoria

**Regras de Negócio:**
- Todos os logs incluem usuário, timestamp e detalhes
- Logs não podem ser editados ou excluídos
- Acesso aos logs é restrito por permissão

---

## 4. Fluxos de Trabalho

### 4.1 Fluxo de Criação de Pedido Normal
1. Usuário acessa "Criar Pedido"
2. Seleciona produto, empresa e ordem de compra
3. Sistema verifica saldo disponível
4. Define quantidade (≤ saldo disponível)
5. Sistema calcula urgência baseado na data de entrega
6. Se não urgente: pedido é automaticamente aprovado
7. Usuário pode fazer upload de documentos
8. QR Code é gerado após upload completo

### 4.2 Fluxo de Pedido Urgente
1. Sistema detecta pedido urgente (≤ 3 dias)
2. Pedido fica pendente de aprovação
3. Notificação para aprovadores elegíveis
4. Aprovador analisa e aprova/rejeita
5. Se aprovado: libera QR Code e aba "Documentos"
6. Se rejeitado: pedido é cancelado

### 4.3 Fluxo de Confirmação de Entrega
1. Usuario com permissão acessa pedido via QR Code
2. Verifica documentos carregados
3. Confirma recebimento (Entregue/Recusado)
4. Registra quantidade recebida e comentários
5. Sistema atualiza status e registra rastreamento
6. Log é criado automaticamente

---

## 5. Critérios de Acesso e Segurança

### 5.1 Controle de Acesso por Funcionalidade

| Funcionalidade | KeyUser | Admin | Suprimentos | Aprovador | Básico |
|---|---|---|---|---|---|
| Dashboard | ✅ | ✅ | ✅ | ✅ | ❌ |
| Criar Pedido | ✅ | ✅ | ✅ | ❌ | ❌ |
| Ver Pedidos | ✅ | ✅ | ✅ | ❌ | ❌ |
| Aprovações | ✅ | ✅ | ❌ | ✅* | ❌ |
| Ordens de Compra | ✅ | ✅ | ✅ | ❌ | ❌ |
| Empresas | ✅ | ✅ | ✅ | ❌ | ❌ |
| Produtos | ✅ | ✅ | ❌ | ❌ | ❌ |
| Usuários | ✅ | ✅ | ❌ | ❌ | ❌ |
| Configurações | ✅ | ✅ | ❌ | ❌ | ❌ |
| Logs | ✅ | ✅ | ❌ | ❌ | ❌ |
| Confirmar Entrega | ✅ | ✅ | Por permissão | Por permissão | ❌ |

*Aprovadores só veem pedidos das empresas que estão vinculados

### 5.2 Regras de Exibição de Abas

**Aba "Documentos":**
- Sempre visível para pedidos não urgentes
- Para pedidos urgentes: só após aprovação

**Aba "Confirmar Entrega":**
- Só para usuários com `can_confirm_delivery = true`
- Só após upload completo de documentos

**QR Code:**
- Só após upload completo de documentos
- Para pedidos urgentes: só após aprovação

---

## 6. Configurações do Sistema

### 6.1 Configurações Principais
- `urgent_days_threshold`: Limite de dias para considerar pedido urgente (padrão: 3)
- `keyuser_email`: Email do super administrador
- `app_name`: Nome da aplicação exibido na interface
- `google_maps_api_key`: Chave para funcionalidades de mapa

### 6.2 Credenciais KeyUser
- **Email:** padupb@admin.icap
- **Senha:** 170824
- **Permissões:** Acesso total ao sistema

---

## 7. Requisitos Técnicos

### 7.1 Performance
- Carregamento inicial < 3 segundos
- Consultas de banco < 500ms
- Upload de arquivos < 30 segundos

### 7.2 Compatibilidade
- Responsivo para mobile/tablet
- Suporte a PWA (Progressive Web App)
- Compatível com navegadores modernos

### 7.3 Segurança
- Autenticação obrigatória para todas as funcionalidades
- Validação de dados no frontend e backend
- Logs de auditoria completos
- Upload de arquivos com validação de tipo

### 7.4 Escalabilidade
- Suporte a múltiplas empresas e obras
- Estrutura modular para adição de novas funcionalidades
- API RESTful para integrações futuras

---

## 8. Roadmap e Melhorias Futuras

### 8.1 Versão 5.1 (Próxima)
- Notificações push em tempo real
- Relatórios avançados com exportação
- Integração com sistemas ERP externos
- API mobile dedicada

### 8.2 Versão 5.2
- Workflow de aprovação customizável
- Gestão de contratos digitais
- Dashboard executivo avançado
- Integração com fornecedores via API

---

## 9. Critérios de Sucesso

### 9.1 Métricas de Negócio
- Redução de 50% no tempo de processamento de pedidos
- 95% de precisão na gestão de estoques
- 100% de rastreabilidade de documentos
- Redução de 30% em retrabalho

### 9.2 Métricas Técnicas
- 99.5% de uptime
- < 2 segundos tempo de resposta médio
- 0 perda de dados
- < 5 bugs críticos por release

---

## 10. Glossário

- **KeyUser:** Super administrador com acesso total
- **Ordem de Compra:** Documento que autoriza a compra de produtos
- **Pedido Urgente:** Solicitação com prazo ≤ 3 dias
- **QR Code:** Código de barras bidimensional para rastreamento
- **Saldo:** Quantidade disponível = Total da ordem - Quantidade usada
- **Rastreamento:** Registro de localização geográfica do pedido

---

**Documento elaborado em:** Janeiro 2025  
**Última atualização:** Janeiro 2025  
**Próxima revisão:** Março 2025
