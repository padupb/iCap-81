import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import session from "express-session";
import "./types";
import { storage } from "./storage";
import multer from "multer";
import path from "path";
console.log('DATABASE_URL em index.ts (via Secrets):', process.env.DATABASE_URL);

const app = express();
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

app.use(
  session({
    secret: "icap-5.0-secret-key",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === "production",
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000,
    },
  })
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
    let keyUserEmail = await storage.getSetting("keyuser_email");
    let keyUserPassword = await storage.getSetting("keyuser_password");

    if (!keyUserEmail || keyUserEmail.value !== "padupb@admin.icap") {
      console.log("Atualizando configuração do keyuser_email");
      await storage.createOrUpdateSetting({
        key: "keyuser_email",
        value: "padupb@admin.icap",
        description: "E-mail do superadministrador"
      });
    }

    if (!keyUserPassword || keyUserPassword.value !== "170824") {
      console.log("Atualizando configuração do keyuser_password");
      await storage.createOrUpdateSetting({
        key: "keyuser_password",
        value: "170824",
        description: "Senha do superadministrador"
      });
    }

    console.log("Configurações do superadministrador verificadas com sucesso");
  } catch (error) {
    console.error("Erro ao inicializar configurações do superadministrador:", error);
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

  const port = 3000;
  server.listen(port, () => {
    log(`serving on port ${port}`);
  });
})();