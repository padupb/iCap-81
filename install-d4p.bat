@echo off
chcp 65001 >nul
title Instalação de Dependências - Sistema i-CAP
REM Teste de sincronização GitHub - Alteração feita em 2024

echo.
echo ╔══════════════════════════════════════════════════════════════╗
echo ║                 📦 INSTALAÇÃO DE DEPENDÊNCIAS                ║
echo ║                      Sistema i-CAP 7.0                      ║
echo ╚══════════════════════════════════════════════════════════════╝
echo.

echo 🔍 Verificando Node.js...
node --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Node.js não encontrado!
    echo 💡 Instale o Node.js em: https://nodejs.org/
    pause
    exit /b 1
) else (
    echo ✅ Node.js encontrado: 
    node --version
)

echo.
echo 🔍 Verificando npm...
npm --version >nul 2>&1
if errorlevel 1 (
    echo ❌ npm não encontrado!
    pause
    exit /b 1
) else (
    echo ✅ npm encontrado: 
    npm --version
)

echo.
echo 📦 Instalando dependências do projeto principal...
cd /d "%~dp0"
npm install
if errorlevel 1 (
    echo ❌ Erro ao instalar dependências principais!
    pause
    exit /b 1
)
echo ✅ Dependências principais instaladas!

echo.
echo 📱 Instalando dependências da PWA...
cd /d "%~dp0\appmob"
npm install
if errorlevel 1 (
    echo ❌ Erro ao instalar dependências da PWA!
    pause
    exit /b 1
)
echo ✅ Dependências da PWA instaladas!

echo.
echo 🎉 INSTALAÇÃO CONCLUÍDA COM SUCESSO!
echo.
echo 📋 Próximos passos:
echo    1. Execute: start-icap-system.bat
echo    2. Escolha a opção [3] para iniciar ambos os servidores
echo    3. Acesse: http://localhost:3000 (Sistema Principal)
echo    4. Acesse: http://localhost:8080 (PWA Tracker)
echo.
pause 