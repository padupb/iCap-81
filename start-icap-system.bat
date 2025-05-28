@echo off
chcp 65001 >nul
title Sistema i-CAP - Inicializador Completo

echo.
echo ╔══════════════════════════════════════════════════════════════╗
echo ║                    🚀 SISTEMA i-CAP 7.0                     ║
echo ║              Inicializador Completo do Sistema              ║
echo ╚══════════════════════════════════════════════════════════════╝
echo.

:MENU
echo 📋 OPÇÕES DISPONÍVEIS:
echo.
echo [1] 🌐 Iniciar Servidor Principal i-CAP (porta 3000)
echo [2] 📱 Iniciar PWA Tracker (porta 8080)
echo [3] 🔄 Iniciar AMBOS os servidores
echo [4] 📊 Listar pedidos do banco de dados
echo [5] 🧪 Testar PWA com pedido real
echo [6] 🔍 Verificar status dos servidores
echo [7] 🛑 Parar todos os servidores
echo [8] ❌ Sair
echo.
set /p choice="Digite sua opção (1-8): "

if "%choice%"=="1" goto START_MAIN
if "%choice%"=="2" goto START_PWA
if "%choice%"=="3" goto START_BOTH
if "%choice%"=="4" goto LIST_ORDERS
if "%choice%"=="5" goto TEST_PWA
if "%choice%"=="6" goto CHECK_STATUS
if "%choice%"=="7" goto STOP_SERVERS
if "%choice%"=="8" goto EXIT

echo ❌ Opção inválida! Tente novamente.
echo.
goto MENU

:START_MAIN
echo.
echo 🌐 Iniciando Servidor Principal i-CAP...
echo 📍 URL: http://localhost:3000
echo 👤 Login: padupb@admin.icap / 170824
echo.
echo ⚠️  Pressione Ctrl+C para parar o servidor
echo.
cd /d "%~dp0"
set NODE_ENV=development
start "i-CAP Principal" cmd /k "npx tsx server/index.ts"
echo ✅ Servidor Principal iniciado em nova janela!
echo.
pause
goto MENU

:START_PWA
echo.
echo 📱 Iniciando PWA Tracker...
echo 📍 URL Local: http://localhost:8080
echo 📍 URL Rede: http://192.168.0.40:8080
echo.
echo ⚠️  Pressione Ctrl+C para parar o servidor
echo.
cd /d "%~dp0\appmob"
start "PWA Tracker" cmd /k "node pwa-api.js"
echo ✅ PWA Tracker iniciado em nova janela!
echo.
pause
goto MENU

:START_BOTH
echo.
echo 🔄 Iniciando AMBOS os servidores...
echo.
echo 🌐 Servidor Principal: http://localhost:3000
cd /d "%~dp0"
set NODE_ENV=development
start "i-CAP Principal" cmd /k "npx tsx server/index.ts"
echo ✅ Servidor Principal iniciado!

timeout /t 3 /nobreak >nul

echo 📱 PWA Tracker: http://localhost:8080
cd /d "%~dp0\appmob"
start "PWA Tracker" cmd /k "node pwa-api.js"
echo ✅ PWA Tracker iniciado!

echo.
echo 🎉 Ambos os servidores foram iniciados em janelas separadas!
echo.
echo 📋 URLs de Acesso:
echo    🌐 Sistema Principal: http://localhost:3000
echo    📱 PWA Local: http://localhost:8080
echo    📱 PWA Celular: http://192.168.0.40:8080
echo.
pause
goto MENU

:LIST_ORDERS
echo.
echo 📊 Listando pedidos do banco de dados...
echo.
cd /d "%~dp0\appmob"
node list-orders.js
echo.
pause
goto MENU

:TEST_PWA
echo.
echo 🧪 Testando PWA com pedido real...
echo.
cd /d "%~dp0\appmob"
node test-real-order.js
echo.
pause
goto MENU

:CHECK_STATUS
echo.
echo 🔍 Verificando status dos servidores...
echo.
echo 📊 Processos Node.js ativos:
tasklist /fi "imagename eq node.exe" /fo table
echo.
echo 🌐 Porta 3000 (Servidor Principal):
netstat -ano | findstr :3000
echo.
echo 📱 Porta 8080 (PWA Tracker):
netstat -ano | findstr :8080
echo.
pause
goto MENU

:STOP_SERVERS
echo.
echo 🛑 Parando todos os servidores Node.js...
echo.
taskkill /f /im node.exe >nul 2>&1
taskkill /f /im tsx.exe >nul 2>&1
echo ✅ Todos os servidores foram parados!
echo.
pause
goto MENU

:EXIT
echo.
echo 👋 Encerrando sistema i-CAP...
echo.
echo 🔧 Para usar novamente, execute: start-icap-system.bat
echo.
pause
exit

:ERROR
echo.
echo ❌ Erro durante execução!
echo 💡 Verifique se o Node.js está instalado e as dependências foram instaladas.
echo.
pause
goto MENU 