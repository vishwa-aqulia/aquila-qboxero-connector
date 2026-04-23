import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { restartPythonConnector } from "./index";

const CONNECTOR_PORT = 8080;

async function proxyToConnector(path: string, method: string = "GET", body?: any): Promise<any> {
  const url = `http://localhost:${CONNECTOR_PORT}${path}`;
  const options: RequestInit = {
    method,
    headers: {
      "Content-Type": "application/json",
    },
  };
  if (body) {
    options.body = JSON.stringify(body);
  }
  const response = await fetch(url, options);
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Connector error: ${response.status} - ${text}`);
  }
  return response.json();
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
  app.get("/api/connector/health", async (_req: Request, res: Response) => {
    try {
      const result = await proxyToConnector("/health");
      res.json(result);
    } catch (error) {
      res.json({ ok: false, error: (error as Error).message });
    }
  });

  app.get("/api/config", async (_req: Request, res: Response) => {
    try {
      const config = await storage.getConfig();
      res.json(config || {});
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  app.post("/api/config", async (req: Request, res: Response) => {
    try {
      const config = req.body;
      await storage.saveConfig(config);
      // Restart Python connector to pick up new credentials
      restartPythonConnector();
      res.json({ ok: true });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  app.get("/api/connections", async (_req: Request, res: Response) => {
    try {
      const connections = await storage.getConnections();
      res.json(connections);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  app.post("/api/connections", async (req: Request, res: Response) => {
    try {
      const connection = req.body;
      await storage.addConnection(connection);
      res.json({ ok: true });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  app.get("/oauth/qbo/callback", async (req: Request, res: Response) => {
    try {
      const { code, realmId, state } = req.query;
      const callbackUrl = `http://localhost:${CONNECTOR_PORT}/oauth/qbo/callback?code=${code}&realmId=${realmId}&state=${state}`;
      
      const response = await fetch(callbackUrl);
      if (!response.ok) {
        throw new Error("OAuth callback failed");
      }
      
      const result = await response.json() as any;
      
      if (result.connected && result.connection_id) {
        await storage.addConnection({
          id: result.connection_id,
          tenant_id: result.tenant_id || "demo",
          source: "qbo",
          realm_id: result.realm_id || null,
          xero_tenant_id: null,
          created_at: new Date().toISOString(),
          last_sync_at: null,
        });
      }
      
      res.redirect("/?connected=qbo");
    } catch (error) {
      console.error("QBO callback error:", error);
      res.redirect("/?error=qbo_connection_failed");
    }
  });

  app.get("/oauth/xero/callback", async (req: Request, res: Response) => {
    try {
      const { code, state } = req.query;
      const callbackUrl = `http://localhost:${CONNECTOR_PORT}/oauth/xero/callback?code=${code}&state=${state}`;
      
      const response = await fetch(callbackUrl);
      if (!response.ok) {
        throw new Error("OAuth callback failed");
      }
      
      const result = await response.json() as any;
      
      if (result.connected && result.connection_id) {
        await storage.addConnection({
          id: result.connection_id,
          tenant_id: result.tenant_id || "demo",
          source: "xero",
          realm_id: null,
          xero_tenant_id: result.xero_tenant_id || null,
          created_at: new Date().toISOString(),
          last_sync_at: null,
        });
      }
      
      res.redirect("/?connected=xero");
    } catch (error) {
      console.error("Xero callback error:", error);
      res.redirect("/?error=xero_connection_failed");
    }
  });

  app.get("/api/oauth/qbo/start", async (req: Request, res: Response) => {
    try {
      const tenantId = req.query.tenant_id as string || "demo";
      const response = await fetch(`http://localhost:${CONNECTOR_PORT}/oauth/qbo/start?tenant_id=${encodeURIComponent(tenantId)}`, {
        redirect: "manual"
      });
      const location = response.headers.get("location");
      if (location) {
        res.redirect(location);
      } else {
        res.status(500).json({ error: "No redirect URL received from connector" });
      }
    } catch (error) {
      console.error("QBO OAuth start error:", error);
      res.status(500).json({ error: (error as Error).message });
    }
  });

  app.get("/api/oauth/xero/start", async (req: Request, res: Response) => {
    try {
      const tenantId = req.query.tenant_id as string || "demo";
      const response = await fetch(`http://localhost:${CONNECTOR_PORT}/oauth/xero/start?tenant_id=${encodeURIComponent(tenantId)}`, {
        redirect: "manual"
      });
      const location = response.headers.get("location");
      if (location) {
        res.redirect(location);
      } else {
        res.status(500).json({ error: "No redirect URL received from connector" });
      }
    } catch (error) {
      console.error("Xero OAuth start error:", error);
      res.status(500).json({ error: (error as Error).message });
    }
  });

  app.post("/api/sync/:connectionId", async (req: Request, res: Response) => {
    try {
      const { connectionId } = req.params;
      const result = await proxyToConnector(`/sync/${connectionId}`, "POST");
      
      await storage.updateConnectionLastSync(connectionId);
      
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  return httpServer;
}
