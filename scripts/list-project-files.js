
const fs = require('fs');
const path = require('path');

function listProjectFiles() {
  console.log('📁 ESTRUTURA DO PROJETO i-CAP 5.0\n');
  
  const importantDirs = [
    'client/src',
    'server',
    'shared',
    'scripts',
    'uploads'
  ];
  
  const importantFiles = [
    'package.json',
    '.replit',
    'vite.config.ts',
    'tsconfig.json',
    'README.md'
  ];
  
  // Listar arquivos raiz importantes
  console.log('📄 ARQUIVOS PRINCIPAIS:');
  importantFiles.forEach(file => {
    if (fs.existsSync(file)) {
      const stats = fs.statSync(file);
      console.log(`✅ ${file} (${(stats.size / 1024).toFixed(2)} KB)`);
    } else {
      console.log(`❌ ${file} (não encontrado)`);
    }
  });
  
  // Listar diretórios importantes
  console.log('\n📁 DIRETÓRIOS PRINCIPAIS:');
  importantDirs.forEach(dir => {
    if (fs.existsSync(dir)) {
      const files = fs.readdirSync(dir, { recursive: true });
      console.log(`✅ ${dir}/ (${files.length} arquivos)`);
      
      // Mostrar alguns arquivos importantes
      const tsFiles = files.filter(f => f.toString().endsWith('.ts') || f.toString().endsWith('.tsx'));
      if (tsFiles.length > 0) {
        console.log(`   📝 ${tsFiles.length} arquivos TypeScript`);
      }
    } else {
      console.log(`❌ ${dir}/ (não encontrado)`);
    }
  });
  
  // Verificar uploads específicos
  console.log('\n📦 ARQUIVOS CARREGADOS:');
  const uploadsDir = 'uploads';
  if (fs.existsSync(uploadsDir)) {
    const orderDirs = fs.readdirSync(uploadsDir, { withFileTypes: true })
      .filter(dirent => dirent.isDirectory())
      .map(dirent => dirent.name);
    
    console.log(`📁 ${orderDirs.length} pedidos com arquivos:`);
    orderDirs.slice(0, 10).forEach(dir => {
      const dirPath = path.join(uploadsDir, dir);
      const files = fs.readdirSync(dirPath);
      console.log(`   📦 ${dir}: ${files.length} arquivos`);
    });
    
    if (orderDirs.length > 10) {
      console.log(`   ... e mais ${orderDirs.length - 10} pedidos`);
    }
  }
  
  // Estatísticas gerais
  console.log('\n📊 ESTATÍSTICAS:');
  console.log(`🔧 Node.js: ${process.version}`);
  console.log(`📍 Diretório: ${process.cwd()}`);
  console.log(`🆔 Repl ID: ${process.env.REPL_ID || 'não definido'}`);
  console.log(`🌐 URL: ${process.env.REPL_URL || 'não definido'}`);
}

listProjectFiles();
