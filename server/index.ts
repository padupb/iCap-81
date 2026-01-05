import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import session from "express-session";
import memorystore from "memorystore";
import connectPgSimple from "connect-pg-simple";
import "./types";
import { storage } from "./storage";
import { db, pool } from "./db";
import { settings } from "@shared/schema";
import { eq } from "drizzle-orm";
import multer from "multer";
import path from "path";
console.log(
  "DATABASE_URL em index.ts (via Secrets):",
  process.env.DATABASE_URL,
);

const app = express();

// Confiar no proxy reverso em produção (necessário para cookies seguros)
if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

const uploadStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(process.cwd(), "uploads"));
  },
  filename: (req, file, cb) => {
    const pedidoId = req.params.id || "pedido";
    const timestamp = Date.now();
    const ext = path.extname(file.originalname);
    const tipo = file.fieldname;
    cb(null, `${pedidoId}_${tipo}_${timestamp}${ext}`);
  },
});
const upload = multer({ storage: uploadStorage });

app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));
app.use("/public", express.static(path.join(process.cwd(), "public")));
app.use("/icapmob", express.static(path.join(process.cwd(), "icapmob")));

const MemoryStore = memorystore(session);
const PgStore = connectPgSimple(session);

// Determinar qual store usar baseado no ambiente
const isProduction = process.env.NODE_ENV === 'production';
let sessionStore: any;

if (isProduction && pool) {
  console.log("🔒 Usando PostgreSQL session store para produção");
  sessionStore = new PgStore({
    pool: pool,
    tableName: 'session',
    createTableIfMissing: true, // Criar tabela automaticamente se não existir
    pruneSessionInterval: 60 * 15, // Limpar sessões expiradas a cada 15 minutos
    errorLog: console.error.bind(console),
  });
} else {
  console.log("💾 Usando MemoryStore para desenvolvimento");
  sessionStore = new MemoryStore({
    checkPeriod: 86400000 // prune expired entries every 24h
  });
}

app.use(
  session({
    secret: process.env.SESSION_SECRET || 'icap-secret-2024-very-long-and-secure-key-for-session-management',
    resave: false,
    saveUninitialized: false,
    rolling: false,
    cookie: { 
      secure: isProduction, // true em produção com HTTPS
      httpOnly: true,
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 dias para melhor persistência
      sameSite: isProduction ? 'none' : 'lax' // 'none' para produção com secure=true
    },
    name: 'icap.sid',
    store: sessionStore,
    proxy: isProduction, // Confiar no proxy reverso em produção
  }),
);

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }
      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }
      log(logLine);
    }
  });

  next();
});

(async () => {
  try {
    console.log("🔧 Inicializando configurações do keyuser...");

    // Aguardar um pouco para garantir que o banco esteja pronto
    if (db) {
      console.log("💾 Banco de dados detectado - aguardando inicialização...");
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    let keyUserEmail = await storage.getSetting("keyuser_email");
    let keyUserPassword = await storage.getSetting("keyuser_password");

    console.log(
      "📧 KeyUser email atual:",
      keyUserEmail ? keyUserEmail.value : "não encontrado",
    );
    console.log(
      "🔑 KeyUser password atual:",
      keyUserPassword ? "configurado" : "não encontrado",
    );

    if (!keyUserEmail || keyUserEmail.value !== "padupb@admin.icap") {
      console.log("🔄 Criando/atualizando configuração do keyuser_email");
      await storage.createOrUpdateSetting({
        key: "keyuser_email",
        value: "padupb@admin.icap",
        description: "E-mail do superadministrador",
      });
      console.log("✅ KeyUser email configurado");
    }

    if (!keyUserPassword || keyUserPassword.value !== "170824") {
      console.log("🔄 Criando/atualizando configuração do keyuser_password");
      await storage.createOrUpdateSetting({
        key: "keyuser_password",
        value: "170824",
        description: "Senha do superadministrador",
      });
      console.log("✅ KeyUser password configurado");
    }

    // Verificar novamente se as configurações foram salvas
    const emailVerify = await storage.getSetting("keyuser_email");
    const passwordVerify = await storage.getSetting("keyuser_password");

    console.log("🔍 Verificação final:");
    console.log(
      "📧 Email:",
      emailVerify ? emailVerify.value : "ERRO - não encontrado",
    );
    console.log(
      "🔑 Password:",
      passwordVerify ? "configurado" : "ERRO - não encontrado",
    );

    if (emailVerify && passwordVerify) {
      console.log(
        "✅ Configurações do superadministrador verificadas com sucesso",
      );
      console.log("🎯 KeyUser pronto para uso: padupb@admin.icap / 170824");
    } else {
      console.error(
        "❌ ERRO: Configurações do keyuser não foram salvas corretamente!",
      );
    }
  } catch (error) {
    console.error(
      "❌ Erro ao inicializar configurações do superadministrador:",
      error,
    );
    console.error("🔧 Tentando criar configurações diretamente...");

    // Fallback: tentar criar as configurações diretamente no banco
    if (db) {
      try {
        await db.insert(settings)
          .values({
            key: 'keyuser_password',
            value: '',
            description: 'Senha do superadministrador'
          })
          .onConflictDoUpdate({
            target: settings.key,
            set: { value: '' }
          });
        console.log(
          "✅ Configurações do keyuser criadas diretamente no banco!",
        );
      } catch (dbError) {
        console.error("❌ Erro ao criar configurações diretamente:", dbError);
      }
    }
  }

  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    res.status(status).json({ message });
    throw err;
  });

  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const port = parseInt(process.env.PORT || "5000", 10);
  server.listen(port, "0.0.0.0", () => {
    log(`serving on port ${port}`);
  });
})();