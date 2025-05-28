const http = require('http');

console.log('Testando servidor HTTP...');

const server = http.createServer((req, res) => {
    console.log('Requisição recebida:', req.url);
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(`
        <h1>🚛 i-CAP Tracker PWA</h1>
        <p>Servidor funcionando na porta 8080!</p>
        <p>Hora: ${new Date().toLocaleString('pt-BR')}</p>
        <a href="/api/health">Testar API Health</a>
    `);
});

server.on('error', (err) => {
    console.error('Erro:', err.message);
    if (err.code === 'EADDRINUSE') {
        console.log('Porta 8080 já está em uso!');
        console.log('Execute: netstat -ano | findstr :8080');
    }
});

server.listen(8080, '0.0.0.0', () => {
    console.log('✅ Servidor iniciado com sucesso!');
    console.log('🌐 Acesse: http://localhost:8080');
    console.log('⏹️  Para parar: Ctrl+C');
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\n👋 Parando servidor...');
    server.close(() => {
        console.log('✅ Servidor parado');
        process.exit(0);
    });
}); 