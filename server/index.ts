import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";
import { spawn, type ChildProcess } from "child_process";
import * as fs from "fs";
import * as path from "path";

let pythonConnector: ChildProcess | null = null;

const CONFIG_FILE = path.join(process.cwd(), ".connector-config.json");

function loadConfigForConnector(): Record<string, string> {
  const envVars: Record<string, string> = {};
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const data = fs.readFileSync(CONFIG_FILE, "utf-8");
      const config = JSON.parse(data);
      if (config.qboClientId) envVars.QBO_CLIENT_ID = config.qboClientId;
      if (config.qboClientSecret) envVars.QBO_CLIENT_SECRET = config.qboClientSecret;
      if (config.xeroClientId) envVars.XERO_CLIENT_ID = config.xeroClientId;
      if (config.xeroClientSecret) envVars.XERO_CLIENT_SECRET = config.xeroClientSecret;
      if (config.gcpProjectId) envVars.GCP_PROJECT_ID = config.gcpProjectId;
      if (config.bqDatasetId) envVars.BQ_DATASET_ID = config.bqDatasetId;
    }
  } catch (e) {
    console.error("Failed to load config for connector:", e);
  }
  return envVars;
}

export function restartPythonConnector() {
  if (pythonConnector) {
    console.log("Restarting Python connector to apply new config...");
    pythonConnector.kill();
    // The exit handler will restart it
  }
}

function startPythonConnector() {
  console.log("Starting Python connector on port 8080...");
  
  const configEnv = loadConfigForConnector();
  
  pythonConnector = spawn("python", ["-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8080"], {
    stdio: ["ignore", "pipe", "pipe"],
    detached: false,
    env: {
      ...process.env,
      ...configEnv,
    },
  });

  pythonConnector.stdout?.on("data", (data) => {
    console.log(`[connector] ${data.toString().trim()}`);
  });

  pythonConnector.stderr?.on("data", (data) => {
    console.log(`[connector] ${data.toString().trim()}`);
  });

  pythonConnector.on("error", (err) => {
    console.error(`[connector] Failed to start: ${err.message}`);
  });

  pythonConnector.on("exit", (code) => {
    console.log(`[connector] Exited with code ${code}`);
    if (code !== 0) {
      console.log("[connector] Restarting in 3 seconds...");
      setTimeout(startPythonConnector, 3000);
    }
  });
}

process.on("exit", () => {
  if (pythonConnector) {
    pythonConnector.kill();
  }
});

process.on("SIGINT", () => {
  if (pythonConnector) {
    pythonConnector.kill();
  }
  process.exit();
});

process.on("SIGTERM", () => {
  if (pythonConnector) {
    pythonConnector.kill();
  }
  process.exit();
});

const app = express();
const httpServer = createServer(app);

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

app.use(
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false }));

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

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

      log(logLine);
    }
  });

  next();
});

(async () => {
  startPythonConnector();
  
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  await registerRoutes(httpServer, app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || "5000", 10);
  httpServer.listen(
    {
      port,
      host: "0.0.0.0",
      reusePort: true,
    },
    () => {
      log(`serving on port ${port}`);
    },
  );
})();
