import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import express from "express";
import type { ViteDevServer } from "vite";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const log = (message: string) => {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  console.log(`${formattedTime} [express] ${message}`);
};

export async function setupVite(app: express.Application, server: any) {
  const { createServer } = await import("vite");

  const vite = await createServer({
    server: { 
      middlewareMode: true,
      hmr: {
        port: 24678,
        host: '0.0.0.0'
      }
    },
    appType: "custom",
    optimizeDeps: {
      include: ["react", "react-dom"]
    }
  });

  app.use(vite.middlewares);

  app.use("*", async (req, res, next) => {
    const url = req.originalUrl;

    try {
      const clientTemplate = path.resolve(
        __dirname,
        "..",
        "client",
        "index.html",
      );

      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = await vite.transformIndexHtml(url, template);

      res.status(200).set({ "Content-Type": "text/html" }).end(template);
    } catch (e) {
      if (e instanceof Error) {
        vite.ssrFixStacktrace(e);
        next(e);
      }
    }
  });
}

export function serveStatic(app: express.Application) {
  const distPath = path.resolve(__dirname, "..", "dist");

  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the production build at ${distPath}. Please run "npm run build" first.`,
    );
  }

  app.use(express.static(distPath));

  app.use("*", (_req, res) => {
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}