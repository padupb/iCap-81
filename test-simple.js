const http = require('http');

const postData = JSON.stringify({
  email: 'padupb@admin.icap',
  password: '170824'
});

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/auth/login',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(postData)
  }
};

console.log('🧪 Testando login do KeyUser...');

const req = http.request(options, (res) => {
  console.log(`Status: ${res.statusCode}`);
  console.log(`Headers:`, res.headers);
  
  let body = '';
  res.on('data', (chunk) => {
    body += chunk;
  });
  
  res.on('end', () => {
    console.log('Resposta:', body);
    try {
      const data = JSON.parse(body);
      console.log('JSON:', JSON.stringify(data, null, 2));
    } catch (e) {
      console.log('Não é JSON válido');
    }
  });
});

req.on('error', (e) => {
  console.error(`Erro: ${e.message}`);
});

req.write(postData);
req.end(); 