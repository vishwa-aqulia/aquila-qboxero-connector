import { z } from "zod";

export const connectorConfigSchema = z.object({
  qboClientId: z.string().optional(),
  qboClientSecret: z.string().optional(),
  xeroClientId: z.string().optional(),
  xeroClientSecret: z.string().optional(),
  gcpProjectId: z.string().optional(),
  bqDatasetId: z.string().optional(),
});

export type ConnectorConfig = z.infer<typeof connectorConfigSchema>;

export const connectionSchema = z.object({
  id: z.string(),
  tenant_id: z.string(),
  source: z.enum(["qbo", "xero"]),
  realm_id: z.string().nullable(),
  xero_tenant_id: z.string().nullable(),
  created_at: z.string().nullable(),
  last_sync_at: z.string().nullable(),
});

export type Connection = z.infer<typeof connectionSchema>;

export const syncResultSchema = z.object({
  ok: z.boolean(),
  connection_id: z.string(),
  ingested_at: z.string(),
});

export type SyncResult = z.infer<typeof syncResultSchema>;

export const healthCheckSchema = z.object({
  ok: z.boolean(),
});

export type HealthCheck = z.infer<typeof healthCheckSchema>;

export const users = {} as any;
export const insertUserSchema = z.object({
  username: z.string(),
  password: z.string(),
});
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = { id: string; username: string; password: string };
