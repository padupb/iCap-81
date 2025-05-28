@echo off
echo.
echo ========================================
echo   i-CAP Tracker PWA - Servidor Local
echo ========================================
echo.

cd /d "%~dp0"

echo Verificando Node.js...
node -v >nul 2>&1
if errorlevel 1 (
    echo ERRO: Node.js nao encontrado!
    echo Instale o Node.js em: https://nodejs.org
    pause
    exit /b 1
)

echo Node.js encontrado!
echo.

echo Iniciando servidor na porta 8080...
echo.
echo URLs de acesso:
echo   Local: http://localhost:8080
echo   Rede:  http://[SEU_IP]:8080
echo.
echo Para parar: Ctrl+C
echo.

node server.js

pause 