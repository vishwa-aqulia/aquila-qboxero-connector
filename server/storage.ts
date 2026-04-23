import { type User, type InsertUser, type ConnectorConfig, type Connection } from "@shared/schema";
import { randomUUID } from "crypto";
import * as fs from "fs";
import * as path from "path";

const CONFIG_FILE = path.join(process.cwd(), ".connector-config.json");

function loadConfigFromFile(): ConnectorConfig | null {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const data = fs.readFileSync(CONFIG_FILE, "utf-8");
      return JSON.parse(data);
    }
  } catch (e) {
    console.error("Failed to load config from file:", e);
  }
  return null;
}

function saveConfigToFile(config: ConnectorConfig): void {
  try {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
  } catch (e) {
    console.error("Failed to save config to file:", e);
  }
}

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  getConfig(): Promise<ConnectorConfig | null>;
  saveConfig(config: ConnectorConfig): Promise<void>;
  getConnections(): Promise<Connection[]>;
  addConnection(connection: Connection): Promise<void>;
  updateConnectionLastSync(connectionId: string): Promise<void>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private config: ConnectorConfig | null;
  private connections: Map<string, Connection>;

  constructor() {
    this.users = new Map();
    this.config = loadConfigFromFile();
    this.connections = new Map();
    
    // Set environment variables from loaded config
    if (this.config) {
      if (this.config.qboClientId) process.env.QBO_CLIENT_ID = this.config.qboClientId;
      if (this.config.qboClientSecret) process.env.QBO_CLIENT_SECRET = this.config.qboClientSecret;
      if (this.config.xeroClientId) process.env.XERO_CLIENT_ID = this.config.xeroClientId;
      if (this.config.xeroClientSecret) process.env.XERO_CLIENT_SECRET = this.config.xeroClientSecret;
      if (this.config.gcpProjectId) process.env.GCP_PROJECT_ID = this.config.gcpProjectId;
      if (this.config.bqDatasetId) process.env.BQ_DATASET_ID = this.config.bqDatasetId;
      console.log("Loaded config from file");
    }
  }

  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }

  async getConfig(): Promise<ConnectorConfig | null> {
    if (!this.config) return null;
    return {
      qboClientId: this.config.qboClientId,
      qboClientSecret: this.config.qboClientSecret ? "••••••••" : undefined,
      xeroClientId: this.config.xeroClientId,
      xeroClientSecret: this.config.xeroClientSecret ? "••••••••" : undefined,
      gcpProjectId: this.config.gcpProjectId,
      bqDatasetId: this.config.bqDatasetId,
    };
  }

  async saveConfig(config: ConnectorConfig): Promise<void> {
    const existingConfig = this.config || {};
    
    this.config = {
      ...existingConfig,
      qboClientId: config.qboClientId || existingConfig.qboClientId,
      qboClientSecret: config.qboClientSecret && config.qboClientSecret !== "••••••••" 
        ? config.qboClientSecret 
        : existingConfig.qboClientSecret,
      xeroClientId: config.xeroClientId || existingConfig.xeroClientId,
      xeroClientSecret: config.xeroClientSecret && config.xeroClientSecret !== "••••••••" 
        ? config.xeroClientSecret 
        : existingConfig.xeroClientSecret,
      gcpProjectId: config.gcpProjectId || existingConfig.gcpProjectId,
      bqDatasetId: config.bqDatasetId || existingConfig.bqDatasetId,
    };
    
    if (this.config.qboClientId) {
      process.env.QBO_CLIENT_ID = this.config.qboClientId;
    }
    if (this.config.qboClientSecret) {
      process.env.QBO_CLIENT_SECRET = this.config.qboClientSecret;
    }
    if (this.config.xeroClientId) {
      process.env.XERO_CLIENT_ID = this.config.xeroClientId;
    }
    if (this.config.xeroClientSecret) {
      process.env.XERO_CLIENT_SECRET = this.config.xeroClientSecret;
    }
    if (this.config.gcpProjectId) {
      process.env.GCP_PROJECT_ID = this.config.gcpProjectId;
    }
    if (this.config.bqDatasetId) {
      process.env.BQ_DATASET_ID = this.config.bqDatasetId;
    }
    
    // Persist to file
    saveConfigToFile(this.config);
  }

  async getConnections(): Promise<Connection[]> {
    return Array.from(this.connections.values());
  }

  async addConnection(connection: Connection): Promise<void> {
    this.connections.set(connection.id, connection);
  }

  async updateConnectionLastSync(connectionId: string): Promise<void> {
    const connection = this.connections.get(connectionId);
    if (connection) {
      connection.last_sync_at = new Date().toISOString();
      this.connections.set(connectionId, connection);
    }
  }
}

export const storage = new MemStorage();
