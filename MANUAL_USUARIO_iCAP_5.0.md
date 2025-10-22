
# 📘 Manual do Usuário - Sistema i-CAP 5.0

## Logística Inteligente para Obras Rodoviárias

---

## 📋 Índice

1. [Visão Geral do Sistema](#visão-geral)
2. [Como Acessar](#como-acessar)
3. [Módulos do Sistema](#módulos-do-sistema)
4. [Guia Passo a Passo](#guia-passo-a-passo)
5. [Perguntas Frequentes](#perguntas-frequentes)
6. [Suporte](#suporte)

---

## 🎯 Visão Geral

### O que é o i-CAP 5.0?

O **i-CAP 5.0** é um sistema completo de gestão logística desenvolvido especificamente para controlar pedidos, ordens de compra e entregas em obras de infraestrutura rodoviária.

### Benefícios Principais

✅ **Controle Total de Pedidos** - Acompanhe cada pedido desde a criação até a entrega  
✅ **Rastreamento GPS em Tempo Real** - Visualize onde estão seus materiais  
✅ **Gestão de Documentos** - Centralize notas fiscais, certificados e XMLs  
✅ **Aprovações Automáticas** - Pedidos urgentes com fluxo de aprovação  
✅ **QR Code para Confirmação** - Entregadores confirmam recebimento via celular  
✅ **Relatórios e Dashboard** - Visualize estatísticas e métricas importantes  

---

## 🔐 Como Acessar

### 1. Primeiro Acesso

**Passo 1:** Acesse o sistema através do link fornecido pela sua empresa

**Passo 2:** Na tela de login, insira:
- **Email:** Fornecido pelo administrador
- **Senha:** Senha temporária recebida

**Passo 3:** No primeiro login, você será obrigado a criar uma nova senha
- Mínimo 8 caracteres
- Pelo menos 1 letra maiúscula
- Pelo menos 1 número
- Pelo menos 1 caractere especial (@, #, $, etc.)

### 2. Logins Subsequentes

Basta usar seu email e a senha que você criou.

---

## 📦 Módulos do Sistema

### 1️⃣ Dashboard (Painel Principal)

**O que você vê:**
- Total de pedidos (aprovados, pendentes, em trânsito, entregues)
- Gráfico de pedidos por dia (últimos 30 dias)
- Pedidos urgentes aguardando aprovação
- Mapa de rastreamento em tempo real

**Para quem serve:**
Todos os usuários - é a primeira tela ao entrar no sistema

**Como usar:**
- Clique nos cards para ver detalhes
- Navegue pelo mapa para ver localização dos pedidos
- Clique nos marcadores do mapa para ver detalhes do pedido

---

### 2️⃣ Pedidos

**O que você faz aqui:**
- Criar novos pedidos de material
- Visualizar todos os pedidos
- Acompanhar status de cada pedido
- Fazer upload de documentos (notas fiscais, certificados)
- Gerar QR Code para confirmação de entrega

#### 📝 Como Criar um Pedido

**Passo 1:** Clique em "Novo Pedido"

**Passo 2:** Preencha as informações:
- **Produto:** Selecione o material desejado
- **Quantidade:** Digite a quantidade necessária
- **Empresa:** Selecione a obra/empresa solicitante
- **Ordem de Compra:** Selecione a ordem de compra relacionada
- **Data de Entrega:** Quando precisa do material
- **Prioridade:** Normal, Alta ou Urgente
- **Observações:** Informações adicionais (opcional)

**Passo 3:** Clique em "Criar Pedido"

**O que acontece depois:**
- Se o prazo for **maior que 3 dias**: Pedido aprovado automaticamente
- Se o prazo for **3 dias ou menos**: Pedido fica pendente de aprovação

#### 📤 Como Fazer Upload de Documentos

**Passo 1:** Na lista de pedidos, clique no pedido desejado

**Passo 2:** Vá na aba "Documentos"

**Passo 3:** Faça upload de:
- **Nota Fiscal (PDF):** Obrigatório
- **Nota Fiscal (XML):** Obrigatório
- **Certificado (PDF):** Obrigatório

**Passo 4:** Após upload completo, o QR Code é gerado automaticamente

#### 📱 QR Code para Entrega

**Como funciona:**
1. Após upload dos documentos, um QR Code é gerado
2. O entregador escaneia o QR Code ao chegar na obra
3. Sistema mostra os documentos para conferência
4. Entregador confirma: "Entregue" ou "Recusado"
5. Pode tirar foto da nota assinada
6. Localização GPS é registrada automaticamente

---

### 3️⃣ Ordens de Compra

**O que você faz aqui:**
- Criar ordens de compra
- Visualizar saldo disponível por produto
- Controlar validade das ordens
- Gerar PDF da ordem de compra

#### 📋 Como Criar uma Ordem de Compra

**Passo 1:** Clique em "Nova Ordem de Compra"

**Passo 2:** Preencha:
- **Número da Ordem:** 5 dígitos (ex: 12345)
- **Fornecedor:** Selecione o fornecedor (apenas com contrato)
- **Obra:** Selecione a obra de destino
- **Válido Até:** Data de validade da ordem

**Passo 3:** Adicione produtos (até 4 produtos):
- Selecione o produto
- Digite a quantidade
- Clique em "Adicionar Produto"

**Passo 4:** Revise e clique em "Criar Ordem de Compra"

#### 💰 Controle de Saldo

**Como funciona:**
- Cada ordem tem uma quantidade total por produto
- Quando você cria um pedido, usa parte desse saldo
- O sistema mostra sempre o saldo disponível
- Você não pode criar pedidos acima do saldo

**Exemplo:**
- Ordem de Compra: 1000 toneladas de asfalto
- Pedidos já criados: 300 toneladas
- Saldo disponível: 700 toneladas

---

### 4️⃣ Aprovações (Apenas para Aprovadores)

**O que você faz aqui:**
- Aprovar ou rejeitar pedidos urgentes
- Ver detalhes completos do pedido
- Adicionar comentários na aprovação

#### ✅ Como Aprovar um Pedido Urgente

**Passo 1:** Na lista de aprovações, clique no pedido

**Passo 2:** Revise todas as informações:
- Produto e quantidade
- Empresa solicitante
- Data de entrega
- Justificativa da urgência

**Passo 3:** Decida:
- **Aprovar:** Pedido segue para upload de documentos
- **Rejeitar:** Pedido é cancelado

**Passo 4:** Adicione comentários (opcional)

**Passo 5:** Confirme a decisão

---

### 5️⃣ Reprogramações

**O que você faz aqui:**
- Solicitar nova data de entrega para pedidos
- Aprovar/rejeitar solicitações de reprogramação

#### 🔄 Como Solicitar Reprogramação

**Passo 1:** Abra o pedido que precisa reprogramar

**Passo 2:** Clique em "Solicitar Reprogramação"

**Passo 3:** Preencha:
- **Nova Data de Entrega:** A data desejada
- **Justificativa:** Explique o motivo

**Passo 4:** Clique em "Solicitar"

**O que acontece:**
- Solicitação fica pendente de aprovação
- Aprovador analisa e decide
- Você recebe notificação da decisão

#### ✅ Como Aprovar Reprogramação (Aprovadores)

**Passo 1:** Acesse "Reprogramações"

**Passo 2:** Veja pedidos com reprogramação pendente (badge vermelho)

**Passo 3:** Clique no pedido

**Passo 4:** Revise:
- Data original
- Nova data solicitada
- Justificativa

**Passo 5:** Aprove ou rejeite

---

### 6️⃣ Empresas

**O que você faz aqui:**
- Cadastrar fornecedores, obras e clientes
- Editar informações de empresas
- Associar contratos e categorias

#### 🏢 Como Cadastrar uma Empresa

**Passo 1:** Clique em "Nova Empresa"

**Passo 2:** Preencha:
- **Nome:** Razão social da empresa
- **CNPJ:** Apenas números
- **Email:** Email de contato
- **Telefone:** Telefone principal
- **Endereço:** Endereço completo
- **Categoria:** Fornecedor, Obra ou Cliente
- **Número do Contrato:** (se for fornecedor)

**Passo 3:** Clique em "Salvar"

---

### 7️⃣ Produtos

**O que você faz aqui:**
- Cadastrar materiais/produtos
- Definir unidades de medida
- Gerenciar catálogo de produtos

#### 📦 Como Cadastrar um Produto

**Passo 1:** Clique em "Novo Produto"

**Passo 2:** Preencha:
- **Nome:** Nome do produto
- **Descrição:** Detalhes do produto
- **Código:** Código único (opcional)
- **Unidade:** Tonelada, m³, unidade, etc.

**Passo 3:** Clique em "Salvar"

---

### 8️⃣ Usuários (Apenas Administradores)

**O que você faz aqui:**
- Criar novos usuários
- Definir permissões
- Resetar senhas

#### 👤 Como Criar um Usuário

**Passo 1:** Clique em "Novo Usuário"

**Passo 2:** Preencha:
- **Nome:** Nome completo
- **Email:** Email corporativo
- **Telefone:** Celular
- **Empresa:** Empresa do usuário
- **Perfil:** Escolha o nível de acesso

**Passo 3:** O sistema gera senha temporária

**Passo 4:** Envie as credenciais para o novo usuário

---

## 📖 Guia Passo a Passo

### Cenário 1: Solicitar Material para Obra

**Situação:** Você precisa de 100 toneladas de asfalto para amanhã.

1. Acesse "Pedidos" → "Novo Pedido"
2. Selecione "Asfalto CAP 50/70"
3. Digite quantidade: 100
4. Selecione sua obra
5. Escolha a ordem de compra ativa
6. Defina data de entrega: amanhã
7. Sistema detecta urgência automaticamente
8. Clique em "Criar Pedido"
9. Pedido fica pendente de aprovação
10. Aguarde aprovação do responsável

### Cenário 2: Confirmar Recebimento de Material

**Situação:** Caminhão chegou na obra com material.

1. Escaneie o QR Code no canhoto da nota
2. Sistema abre página de confirmação
3. Confira documentos exibidos
4. Clique em "Entregue"
5. Digite quantidade recebida
6. Tire foto da nota assinada (opcional)
7. Clique em "Confirmar"
8. Sistema registra entrega com localização GPS

### Cenário 3: Criar Ordem de Compra

**Situação:** Fechar contrato com fornecedor para fornecer materiais.

1. Acesse "Ordens de Compra" → "Nova Ordem"
2. Digite número da ordem: 12345
3. Selecione fornecedor com contrato
4. Selecione obra de destino
5. Defina validade: 31/12/2025
6. Adicione produto: Brita 1, 500 ton
7. Adicione produto: Areia, 200 ton
8. Clique em "Criar Ordem de Compra"
9. Sistema gera PDF da ordem
10. Baixe e envie para o fornecedor

---

## ❓ Perguntas Frequentes

### 1. O que fazer se esquecer a senha?

**R:** Entre em contato com o administrador do sistema para resetar sua senha.

### 2. Por que meu pedido precisa de aprovação?

**R:** Pedidos com prazo de entrega igual ou inferior a 3 dias são considerados urgentes e precisam de aprovação de um responsável.

### 3. Posso editar um pedido após criar?

**R:** Não é possível editar pedidos já criados. Você pode cancelá-lo e criar um novo, desde que ainda não tenha sido entregue.

### 4. Como sei se minha ordem de compra ainda tem saldo?

**R:** Ao criar um pedido, o sistema mostra automaticamente o saldo disponível para cada produto da ordem selecionada.

### 5. Quem pode ver meus pedidos?

**R:** 
- **KeyUser/Admin:** Veem todos os pedidos
- **Aprovadores:** Veem pedidos das suas empresas
- **Usuários normais:** Veem apenas pedidos da sua empresa

### 6. O QR Code expira?

**R:** Não, o QR Code permanece ativo até a confirmação da entrega.

### 7. É obrigatório fazer upload de documentos?

**R:** Sim, é obrigatório fazer upload da Nota Fiscal (PDF e XML) e Certificado para gerar o QR Code.

### 8. Posso acompanhar onde está meu pedido?

**R:** Sim! No Dashboard, você pode ver no mapa a localização em tempo real de todos os pedidos em trânsito.

### 9. Como funciona a reprogramação de entrega?

**R:** 
- Solicite nova data através do pedido
- Justifique o motivo
- Aprovador analisa e decide
- Se aprovado, a data é atualizada
- A nova data deve estar dentro da validade da ordem de compra

### 10. O que são os status dos pedidos?

**R:**
- **Pendente:** Aguardando aprovação
- **Aprovado:** Aprovado, aguardando documentos
- **Em Trânsito:** Material saiu para entrega
- **Entregue:** Material recebido na obra
- **Cancelado:** Pedido foi cancelado
- **Suspenso:** Aguardando reprogramação

---

## 🎨 Interface do Sistema

### Cores e Status

**Verde:** Sucesso, aprovado, ativo  
**Amarelo:** Atenção, pendente, aguardando  
**Vermelho:** Erro, cancelado, rejeitado  
**Azul:** Informação, em andamento  

### Ícones Principais

📊 **Dashboard:** Visão geral  
📦 **Pedidos:** Gestão de pedidos  
✅ **Aprovações:** Aprovar pedidos urgentes  
🔄 **Reprogramações:** Alterar datas  
📋 **Ordens de Compra:** Controlar ordens  
🏢 **Empresas:** Cadastro de fornecedores/obras  
📦 **Produtos:** Catálogo de materiais  
👥 **Usuários:** Gestão de acessos  
🔧 **Configurações:** Ajustes do sistema  
📝 **Logs:** Histórico de ações  

---

## 👥 Perfis de Usuário

### KeyUser (Super Administrador)
- Acesso total ao sistema
- Página de desenvolvimento
- Configurações avançadas

### Administrador
- Gerenciar usuários e empresas
- Criar produtos
- Visualizar logs
- Configurações do sistema

### Suprimentos
- Criar pedidos
- Fazer upload de documentos
- Criar ordens de compra
- Visualizar relatórios

### Aprovador
- Aprovar/rejeitar pedidos urgentes
- Aprovar reprogramações
- Apenas pedidos das empresas vinculadas

### Básico
- Visualizar dashboard
- Ver pedidos (limitado)

---

## 📊 Relatórios e Análises

### Dashboard Analytics

**Métricas Disponíveis:**
- Total de pedidos por status
- Pedidos criados nos últimos 30 dias
- Taxa de pedidos urgentes
- Tempo médio de entrega
- Ordens de compra ativas vs expiradas

**Filtros:**
- Por período
- Por empresa
- Por produto
- Por status

---

## 🔒 Segurança e Privacidade

### Proteção de Dados

✅ Senhas criptografadas  
✅ Sessões seguras  
✅ Logs de auditoria  
✅ Acesso controlado por permissões  
✅ Backup automático diário  

### Boas Práticas

1. **Nunca compartilhe sua senha**
2. **Faça logout ao sair**
3. **Use senha forte**
4. **Revise documentos antes de fazer upload**
5. **Confirme informações antes de criar pedidos**

---

## 📱 Aplicativo Mobile (iCapMob)

### Funcionalidades

- Escanear QR Code
- Confirmar entregas
- Ver documentos
- Registrar localização GPS
- Tirar fotos de confirmação

### Como Instalar

1. Acesse a página "Keyuser" (apenas admin)
2. Baixe o arquivo APK
3. Instale no celular Android
4. Permita instalação de fontes desconhecidas
5. Faça login com suas credenciais

---

## 🆘 Suporte

### Em caso de dúvidas ou problemas:

📧 **Email:** suporte@icap.com.br  
📞 **Telefone:** (65) 1234-5678  
💬 **Chat:** Disponível no sistema (canto inferior direito)  

### Horário de Atendimento

Segunda a Sexta: 8h às 18h  
Sábado: 8h às 12h  
Urgências: 24h através do email

---

## 📝 Glossário

**Ordem de Compra:** Documento que autoriza compra de produtos de um fornecedor  
**Pedido:** Solicitação de material para uma obra  
**Pedido Urgente:** Pedido com prazo ≤ 3 dias  
**Saldo:** Quantidade disponível em uma ordem de compra  
**QR Code:** Código de barras 2D para confirmar entrega  
**Rastreamento:** Acompanhamento via GPS  
**Reprogramação:** Alteração da data de entrega  

---

## 🎓 Treinamento

### Materiais Disponíveis

📹 Vídeos tutoriais  
📄 Guias em PDF  
🎯 Exercícios práticos  
👨‍🏫 Treinamento presencial (sob demanda)  

### Certificação

Ao concluir o treinamento, você recebe certificado de capacitação no sistema i-CAP 5.0.

---

## 📈 Atualizações

### Versão Atual: 5.0

**Novidades:**
- Rastreamento GPS em tempo real
- QR Code para confirmação de entregas
- Sistema de reprogramações
- Upload de documentos melhorado
- Dashboard interativo com mapas

### Próximas Atualizações (5.1)

- Notificações push em tempo real
- Integração com sistemas ERP
- Relatórios avançados com exportação
- App mobile nativo iOS

---

## ✨ Dicas e Truques

### 1. Atalhos de Teclado

`Ctrl + K` → Busca rápida  
`Esc` → Fechar modal  

### 2. Filtros Rápidos

Use os filtros no topo das tabelas para encontrar pedidos rapidamente:
- Por status
- Por data
- Por empresa
- Por produto

### 3. Salvar Tempo

- Favorite pedidos frequentes
- Use templates para pedidos recorrentes
- Configure notificações para não perder aprovações

### 4. Evitar Erros

- Sempre confira o saldo antes de criar pedido
- Revise documentos antes de fazer upload
- Valide datas de validade das ordens de compra

---

**© 2025 i-CAP 5.0 - Sistema de Gestão Logística**  
**Versão do Manual: 1.0**  
**Última Atualização: Janeiro 2025**
