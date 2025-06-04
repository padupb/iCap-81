
# Regras do Sistema i-CAP 5.0

## Índice
1. [Regras de Autenticação](#regras-de-autenticação)
2. [Regras de Permissões](#regras-de-permissões)
3. [Regras de Usuários](#regras-de-usuários)
4. [Regras de Empresas](#regras-de-empresas)
5. [Regras de Produtos](#regras-de-produtos)
6. [Regras de Ordens de Compra](#regras-de-ordens-de-compra)
7. [Regras de Pedidos](#regras-de-pedidos)
8. [Regras de Aprovações](#regras-de-aprovações)
9. [Regras de Documentos](#regras-de-documentos)
10. [Regras de QR Code e Rastreamento](#regras-de-qr-code-e-rastreamento)
11. [Regras de Interface](#regras-de-interface)
12. [Regras de Logs e Auditoria](#regras-de-logs-e-auditoria)
13. [Regras de Configurações](#regras-de-configurações)

---

## Regras de Autenticação

### Credenciais KeyUser
- **Email:** padupb@admin.icap
- **Senha:** 170824
- **Identificação:** Sistema identifica KeyUser pelo domínio @admin.icap

### Login e Segurança
- Todos os usuários devem se autenticar para acessar o sistema
- Sessões são gerenciadas com Express Session e PostgreSQL
- Senhas devem ter pelo menos 4 caracteres
- Primeiro login obrigatório com troca de senha (campo `primeiro_login`)
- Sistema força logout em caso de sessão expirada

### Validação de Acesso
- Middleware de autenticação valida todas as rotas protegidas
- Verificação de permissões granulares por módulo e ação
- Redirecionamento automático para login se não autenticado

---

## Regras de Permissões

### Estrutura Hierárquica
```
Permissões por módulo:
- [módulo].ver: visualização
- [módulo].editar: alteração
- [módulo].cadastrar: inclusão
```

### Módulos do Sistema
- `dashboard`: Dashboard principal
- `orders`: Gestão de pedidos
- `approvals`: Aprovações de pedidos urgentes
- `purchase_orders`: Ordens de compra
- `companies`: Gestão de empresas
- `users`: Gestão de usuários
- `products`: Gestão de produtos
- `reports`: Relatórios
- `settings`: Configurações
- `logs`: Logs do sistema
- `keyuser`: Área de desenvolvimento (apenas KeyUser)

### Controle de Acesso por Perfil

| Perfil | Permissões Especiais |
|---|---|
| **KeyUser** | Acesso total ao sistema, incluindo área Dev |
| **Administrador** | Todas as funcionalidades exceto área Dev |
| **Gerente** | Dashboard, empresas, pedidos, aprovações, compras, logs |
| **Comprador** | Dashboard, empresas, produtos, pedidos, compras |
| **Aprovador** | Dashboard, empresas, produtos, pedidos, aprovações* |

*Aprovadores só veem pedidos das empresas que estão vinculados

### Regras de Exibição
- Menu lateral só exibe itens com permissão de visualização
- Botões de ação só aparecem com permissões adequadas
- Telas verificam permissões antes de exibir conteúdo

---

## Regras de Usuários

### Cadastro e Validação
- Nome deve ter pelo menos 3 caracteres
- Email deve ser válido e único no sistema
- Telefone é opcional
- Senha deve ter pelo menos 4 caracteres
- Usuário deve estar vinculado a uma empresa válida
- Usuário deve ter um perfil (role) válido

### Perfis e Permissões
- Cada usuário possui um perfil que define suas permissões
- Perfis são herdados e não podem ser modificados individualmente
- Campo `can_confirm_delivery` controla permissão de confirmação de entrega
- Campo `primeiro_login` força troca de senha no primeiro acesso

### Regras Especiais
- KeyUser tem acesso irrestrito independente do perfil
- Usuários só podem ver/editar dados da própria empresa (exceto admin)
- Aprovadores só podem aprovar pedidos de empresas vinculadas

---

## Regras de Empresas

### Categorias de Empresas
- **Fornecedor:** Pode receber ordens de compra, requer contrato
- **Obra:** Local de entrega, pode ser vinculada a ordens de compra
- **Cliente:** Empresa contratante
- **Parceiro:** Empresa parceira

### Validações
- Nome deve ter pelo menos 3 caracteres
- CNPJ deve ser válido e único (14-18 caracteres)
- Endereço é opcional mas recomendado
- Categoria é obrigatória
- Número de contrato é obrigatório para fornecedores

### Regras de Vinculação
- Empresas podem ter um aprovador designado
- Aprovador deve ser um usuário válido do sistema
- Apenas empresas com contratos podem receber ordens de compra
- Formato de exibição: "Nome da Empresa - Número do Contrato"

---

## Regras de Produtos

### Cadastro
- Nome é obrigatório e deve ter pelo menos 3 caracteres
- Código do produto deve ser único se fornecido
- Descrição é opcional
- Unidade de medida é obrigatória

### Unidades de Medida
- Cada produto deve ter uma unidade válida
- Unidades predefinidas: t, kg, m, m², m³, l, un, pç, cx, h, d, mês, ano
- Não é possível excluir unidades em uso

### Restrições
- Não é possível excluir produtos com pedidos associados
- Histórico de utilização é mantido para auditoria

---

## Regras de Ordens de Compra

### Criação e Validação
- Número da ordem deve ter exatamente 5 dígitos numéricos
- Deve estar vinculada a um fornecedor válido (com contrato)
- Deve estar vinculada a uma obra específica
- Data de validade não pode ser anterior à data atual
- Máximo de 4 produtos por ordem de compra
- Status inicial sempre "Ativo"

### Status e Validade
- Status possíveis: "Ativo" ou "Expirado"
- Ordens expiradas são marcadas automaticamente pelo sistema
- Cores de status: Verde (Ativo), Vermelho (Expirado)
- Verificação automática de validade em consultas

### Produtos e Quantidades
- Cada produto na ordem deve ter quantidade maior que zero
- Quantidades são armazenadas como string com 2 casas decimais
- Sistema rastreia quantidade total vs quantidade utilizada
- Saldo = Quantidade Total - Quantidade Usada (excluindo cancelados)

### Restrições
- Não é possível excluir ordens com pedidos associados
- Ordens expiradas não podem receber novos pedidos
- Apenas fornecedores com contrato podem receber ordens

---

## Regras de Pedidos

### Criação e Vinculação
- Pedido deve estar vinculado a uma ordem de compra ativa e válida
- Quantidade solicitada não pode exceder saldo disponível na ordem
- Produto deve existir na ordem de compra selecionada
- Data de entrega é obrigatória
- Empresa fornecedora é derivada da ordem de compra

### Classificação de Urgência
- Pedido é urgente se diferença entre data de entrega e data atual ≤ 3 dias
- Limite configurável através da configuração `urgent_days_threshold`
- Campo `is_urgent` é calculado automaticamente
- Pedidos urgentes requerem aprovação especial

### Status de Pedidos
- **Pendente:** Aguardando processamento
- **Aprovado:** Liberado para execução
- **Carregado:** Documentos enviados
- **Em Rota:** A caminho do destino
- **Entregue:** Confirmado pelo destinatário
- **Recusado:** Rejeitado na entrega
- **Cancelado:** Cancelado pelo sistema

### Fluxo de Aprovação
- Pedidos não urgentes: aprovação automática
- Pedidos urgentes: requerem aprovação manual
- Aprovadores: KeyUser + aprovadores das empresas envolvidas
- Após aprovação: libera documentos e QR Code

### Geração de ID
- Formato: `CAP + DD + MM + YY + HH + MM`
- Exemplo: `CAP2501251430` (25/01/25 às 14:30)
- ID é único e gerado automaticamente

---

## Regras de Aprovações

### Elegibilidade para Aprovar
- KeyUser pode aprovar qualquer pedido urgente
- Aprovadores só veem pedidos de empresas vinculadas
- Aprovador deve pertencer à empresa solicitante ou fornecedora

### Processo de Aprovação
- Apenas pedidos urgentes aparecem na lista de aprovações
- Aprovador pode aprovar ou rejeitar com comentários
- Aprovação libera aba "Documentos" e geração de QR Code
- Rejeição cancela o pedido automaticamente

### Notificações
- Sistema notifica aprovadores sobre pedidos pendentes
- Histórico completo de decisões é mantido
- Logs automáticos de todas as aprovações/rejeições

---

## Regras de Documentos

### Tipos Aceitos
- **Nota PDF:** Arquivo PDF da nota fiscal
- **Nota XML:** Arquivo XML da nota fiscal
- **Certificado PDF:** Certificado do produto em PDF

### Validações de Upload
- Apenas arquivos PDF e XML são aceitos
- Tamanho máximo por arquivo definido pelo sistema
- Validação de tipo MIME obrigatória
- Organização em pastas por ID do pedido

### Regras de Acesso
- Upload só é permitido após criação do pedido
- Para pedidos urgentes: só após aprovação
- QR Code só é gerado após upload completo dos 3 tipos
- Download disponível apenas para usuários autorizados

### Armazenamento
- Arquivos salvos em `/uploads/[ORDER_ID]/`
- Nomenclatura: `[tipo]_[timestamp].[extensão]`
- Informações armazenadas: nome original, tamanho, data de upload
- Backup automático para auditoria

---

## Regras de QR Code e Rastreamento

### Geração de QR Code
- QR Code só é gerado após upload completo de documentos
- Para pedidos urgentes: só após aprovação
- Código único por pedido
- URL de acesso inclui ID do pedido

### Rastreamento Geográfico
- Registro de coordenadas GPS obrigatório
- Integração com Google Maps API
- Histórico completo de pontos de rastreamento
- Timestamp automático para cada ponto

### Confirmação de Entrega
- Acesso via QR Code ou interface web
- Apenas usuários com `can_confirm_delivery = true`
- Opções: "Entregue" ou "Recusado"
- Comentários obrigatórios para recusas
- Registro de quantidade efetivamente recebida

### Validações de Rastreamento
- Coordenadas devem ser válidas (latitude/longitude)
- Usuário deve estar autenticado
- Pedido deve estar em status apropriado
- Registro não pode ser alterado após confirmação

---

## Regras de Interface

### Tema e Cores
- Sistema utiliza tema escuro por padrão
- Esquema de cores baseado em variáveis CSS
- Componentes shadcn/ui para consistência visual
- Responsividade obrigatória para mobile/tablet

### Espaçamentos Padronizados
- Espaçamento interno padrão: 12px
- Margem entre elementos: 12px
- Padding de cartões: 16px
- Gap entre colunas: 16px
- Gap entre linhas: 24px

### Navegação e Menu
- Sidebar com ícones e texto
- Menu adaptativo baseado em permissões
- Destaque visual para item selecionado
- Breadcrumbs para navegação hierárquica

### Formulários e Validação
- Validação em tempo real com Zod
- Mensagens de erro contextuais
- Campos obrigatórios marcados visualmente
- Botões de ação no rodapé dos formulários

### Tabelas e Listas
- Ordenação clicável nas colunas
- Paginação para listas longas
- Filtros de busca disponíveis
- Ações na última coluna

### Notificações
- Toasts para feedback de operações
- Tempo de exibição: 5 segundos
- Cores: Verde (sucesso), Vermelho (erro), Amarelo (aviso)

---

## Regras de Logs e Auditoria

### Eventos Logados
- Login/logout de usuários
- Criação, edição e exclusão de registros
- Aprovações e rejeições de pedidos
- Upload de documentos
- Confirmações de entrega
- Alterações de configurações

### Estrutura dos Logs
- ID do usuário responsável
- Ação realizada
- Tipo de item afetado
- ID do item (se aplicável)
- Detalhes da operação
- Timestamp automático

### Restrições
- Logs não podem ser editados ou excluídos
- Acesso restrito por permissão (`logs.ver`)
- Retenção permanente para auditoria
- Exportação disponível para administradores

---

## Regras de Configurações

### Configurações do Sistema
- `urgent_days_threshold`: Limite de dias para pedido urgente (padrão: 3)
- `google_maps_api_key`: Chave da API do Google Maps
- `app_name`: Nome da aplicação exibido
- `logo_url`: URL do logotipo do sistema

### Validações
- Apenas administradores podem alterar configurações
- Valores devem ser validados antes de salvar
- Alterações geram logs automáticos
- Backup de configurações anterior mantido

### Aplicação
- Configurações aplicadas em tempo real
- Reinicialização não necessária para maioria das mudanças
- Cache de configurações para performance
- Valores padrão definidos em caso de ausência

---

## Regras de Negócio Especiais

### Cálculo de Saldo
```
Saldo Disponível = Quantidade Total da Ordem - Quantidade Usada
Quantidade Usada = Soma de pedidos (excluindo cancelados)
```

### Verificação de Validade
- Ordens de compra: verificação automática na consulta
- Pedidos urgentes: recálculo diário
- Status expirado: aplicado automaticamente

### Integração de Dados
- Ordens de compra vinculam fornecedor + obra
- Pedidos herdam fornecedor da ordem de compra
- Usuários filtram dados por empresa (exceto admin)

### Performance
- Consultas otimizadas com índices adequados
- Cache de dados frequentemente acessados
- Paginação obrigatória para listas grandes
- Lazy loading para componentes pesados

---

## Exceções e Casos Especiais

### KeyUser
- Bypassa todas as restrições de permissão
- Acesso à área de desenvolvimento
- Pode alterar qualquer configuração
- Logs especiais para ações de KeyUser

### Fallbacks
- Dados inválidos são rejeitados com mensagem clara
- Sistema mantém estado consistente em caso de erro
- Rollback automático para operações críticas
- Mensagens de erro user-friendly

### Compatibilidade
- Suporte a navegadores modernos
- Funcionalidade offline limitada
- Sincronização automática ao reconectar
- Backup local de dados críticos

---

**Documento gerado automaticamente - i-CAP 5.0**  
**Última atualização:** Janeiro 2025  
**Versão:** 5.0.1
