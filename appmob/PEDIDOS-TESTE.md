# 📋 Pedidos de Teste - PWA i-CAP Tracker

## 🔢 Números de Pedidos Válidos para Teste

Use qualquer um destes números para testar a validação:

### Pedidos Numéricos:
- `12345`
- `67890`
- `11111`
- `22222`
- `33333`

### Pedidos Alfanuméricos:
- `PED001`
- `PED002`
- `PED003`
- `ABC123`
- `XYZ789`

## 🧪 Como Testar

1. **Acesse a PWA**: http://localhost:8080 ou http://192.168.0.40:8080
2. **Scanner QR Code**: Use qualquer QR Code que contenha um dos números acima
3. **Entrada Manual**: Digite um dos números válidos no campo de entrada
4. **Teste Inválido**: Digite qualquer outro número (ex: `99999`) para ver a mensagem de erro

## 📱 Testando no Celular

1. Conecte o celular na mesma rede WiFi
2. Acesse: `http://192.168.0.40:8080`
3. Instale como PWA quando o navegador oferecer
4. Use a câmera para escanear QR Codes ou digite manualmente

## 🔍 QR Codes de Teste

Você pode gerar QR Codes online com os números válidos:
- https://qr-code-generator.com/
- https://www.qr-code-generator.org/

Exemplo: Gere um QR Code com o texto `12345` e escaneie na PWA.

## 🐛 Logs de Debug

Para ver os logs de validação:
1. Abra o console do navegador (F12)
2. Vá para a aba "Console"
3. Digite um número de pedido e veja as mensagens de log

## 🔄 Reiniciar Servidor

Se precisar reiniciar o servidor da PWA:
```bash
cd E:\icap7\appmob
node server.js
```

## 📊 Status Esperados

- ✅ **Pedidos Válidos**: Iniciam rastreamento GPS
- ❌ **Pedidos Inválidos**: Mostram mensagem "Pedido não encontrado ou inválido"
- 🔄 **Sem Conexão**: Mostram mensagem de erro de conexão 