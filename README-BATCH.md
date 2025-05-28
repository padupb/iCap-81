# 🚀 Sistema i-CAP 7.0 - Arquivos Batch

## 📁 Arquivos Criados na Pasta Raiz

### 1. `install-dependencies.bat`
**Instala todas as dependências necessárias**
- Verifica se Node.js e npm estão instalados
- Instala dependências do projeto principal
- Instala dependências da PWA
- **Execute PRIMEIRO antes de usar o sistema**

### 2. `start-icap-system.bat`
**Menu principal para gerenciar o sistema**
- Interface amigável com 8 opções
- Inicia servidores em janelas separadas
- Ferramentas de teste e diagnóstico

## 🎯 Como Usar

### Primeira Vez (Instalação):
```bash
1. Clique duas vezes em: install-dependencies.bat
2. Aguarde a instalação das dependências
3. Clique duas vezes em: start-icap-system.bat
```

### Uso Diário:
```bash
1. Clique duas vezes em: start-icap-system.bat
2. Escolha uma opção do menu
```

## 📋 Opções do Menu Principal

### [1] 🌐 Iniciar Servidor Principal i-CAP
- Inicia o sistema principal na porta 3000
- URL: http://localhost:3000
- Login: padupb@admin.icap / 170824

### [2] 📱 Iniciar PWA Tracker
- Inicia a PWA na porta 8080
- URL Local: http://localhost:8080
- URL Rede: http://192.168.0.40:8080

### [3] 🔄 Iniciar AMBOS os servidores
- **OPÇÃO RECOMENDADA**
- Inicia ambos os servidores automaticamente
- Aguarda 3 segundos entre as inicializações

### [4] 📊 Listar pedidos do banco de dados
- Mostra pedidos reais para teste
- Exibe códigos válidos para usar na PWA

### [5] 🧪 Testar PWA com pedido real
- Testa validação e atualização de status
- Usa pedido real do banco de dados

### [6] 🔍 Verificar status dos servidores
- Mostra processos Node.js ativos
- Verifica portas 3000 e 8080

### [7] 🛑 Parar todos os servidores
- Para todos os processos Node.js
- Limpa portas ocupadas

### [8] ❌ Sair
- Encerra o menu

## 🎯 Fluxo Recomendado

### Para Desenvolvimento:
1. Execute `install-dependencies.bat` (apenas na primeira vez)
2. Execute `start-icap-system.bat`
3. Escolha opção [3] - Iniciar AMBOS os servidores
4. Escolha opção [4] - Listar pedidos para ver códigos válidos
5. Teste a PWA com códigos reais

### Para Teste da PWA:
1. Execute `start-icap-system.bat`
2. Escolha opção [2] - Iniciar PWA Tracker
3. Escolha opção [4] - Listar pedidos
4. Use um código real na PWA: http://localhost:8080

## 📱 URLs de Acesso

| Serviço | URL Local | URL Rede |
|---------|-----------|----------|
| Sistema Principal | http://localhost:3000 | - |
| PWA Tracker | http://localhost:8080 | http://192.168.0.40:8080 |

## 🔧 Solução de Problemas

### Erro "Node.js não encontrado"
- Instale o Node.js: https://nodejs.org/
- Reinicie o computador após instalação

### Erro "Porta já em uso"
- Use opção [7] para parar todos os servidores
- Ou reinicie o computador

### PWA diz "pedido inválido"
- Use opção [4] para ver pedidos reais
- Use códigos como: CAP2505260002, CAP2505260001

### Servidor não inicia
- Verifique se as dependências foram instaladas
- Execute `install-dependencies.bat` novamente

## 🎉 Funcionalidades da PWA

Quando usar um código de pedido real:
- ✅ Valida o pedido no banco de dados
- ✅ Muda status para "Em Transporte"
- ✅ Inicia rastreamento GPS
- ✅ Salva pontos no banco
- ✅ Visível no sistema principal

## 📞 Suporte

Se encontrar problemas:
1. Use opção [6] para verificar status
2. Use opção [7] para parar tudo e recomeçar
3. Reinicie o computador se necessário
4. Execute `install-dependencies.bat` novamente 