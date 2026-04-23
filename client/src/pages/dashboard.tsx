import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation, useSearch } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { ThemeToggle } from "@/components/theme-toggle";
import { 
  Settings, 
  Link2, 
  RefreshCw, 
  CheckCircle2, 
  XCircle, 
  Loader2,
  Database,
  Key,
  Building2,
  ExternalLink,
  Clock,
  AlertCircle
} from "lucide-react";
import { SiQuickbooks } from "react-icons/si";
import type { Connection, ConnectorConfig, HealthCheck } from "@shared/schema";

export default function Dashboard() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const searchString = useSearch();
  const [activeTab, setActiveTab] = useState("connections");

  const [qboClientId, setQboClientId] = useState("");
  const [qboClientSecret, setQboClientSecret] = useState("");
  const [xeroClientId, setXeroClientId] = useState("");
  const [xeroClientSecret, setXeroClientSecret] = useState("");
  const [gcpProjectId, setGcpProjectId] = useState("");
  const [bqDatasetId, setBqDatasetId] = useState("");
  const [tenantId, setTenantId] = useState("demo");
  const [configLoaded, setConfigLoaded] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(searchString);
    const connected = params.get("connected");
    const error = params.get("error");
    
    if (connected) {
      toast({
        title: "Connection successful",
        description: `${connected === "qbo" ? "QuickBooks Online" : "Xero"} has been connected successfully.`,
      });
      setLocation("/", { replace: true });
    }
    
    if (error) {
      toast({
        title: "Connection failed",
        description: "Failed to connect. Please try again.",
        variant: "destructive",
      });
      setLocation("/", { replace: true });
    }
  }, [searchString, toast, setLocation]);

  const healthQuery = useQuery<HealthCheck>({
    queryKey: ["/api/connector/health"],
    refetchInterval: 30000,
  });

  const configQuery = useQuery<ConnectorConfig>({
    queryKey: ["/api/config"],
  });

  useEffect(() => {
    if (configQuery.data && !configLoaded) {
      if (configQuery.data.qboClientId) setQboClientId(configQuery.data.qboClientId);
      if (configQuery.data.xeroClientId) setXeroClientId(configQuery.data.xeroClientId);
      if (configQuery.data.gcpProjectId) setGcpProjectId(configQuery.data.gcpProjectId);
      if (configQuery.data.bqDatasetId) setBqDatasetId(configQuery.data.bqDatasetId);
      setConfigLoaded(true);
    }
  }, [configQuery.data, configLoaded]);

  const connectionsQuery = useQuery<Connection[]>({
    queryKey: ["/api/connections"],
  });

  const saveConfigMutation = useMutation({
    mutationFn: async (config: ConnectorConfig) => {
      return apiRequest("POST", "/api/config", config);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/config"] });
      toast({
        title: "Configuration saved",
        description: "Your API credentials have been saved successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to save configuration",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const syncMutation = useMutation({
    mutationFn: async (connectionId: string) => {
      return apiRequest("POST", `/api/sync/${connectionId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/connections"] });
      toast({
        title: "Sync completed",
        description: "Data has been synced to BigQuery successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Sync failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSaveConfig = () => {
    saveConfigMutation.mutate({
      qboClientId,
      qboClientSecret,
      xeroClientId,
      xeroClientSecret,
      gcpProjectId,
      bqDatasetId,
    });
  };

  const handleConnectQBO = () => {
    const baseUrl = window.location.origin;
    const url = `${baseUrl}/api/oauth/qbo/start?tenant_id=${encodeURIComponent(tenantId)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const handleConnectXero = () => {
    const baseUrl = window.location.origin;
    const url = `${baseUrl}/api/oauth/xero/start?tenant_id=${encodeURIComponent(tenantId)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const isConnectorHealthy = healthQuery.data?.ok === true;

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto flex h-16 items-center justify-between gap-4 px-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary">
              <Database className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-lg font-semibold">Keystone Connector</h1>
              <p className="text-xs text-muted-foreground">Accounting to BigQuery</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Badge 
              variant={isConnectorHealthy ? "default" : "destructive"}
              className="gap-1.5"
              data-testid="badge-connector-status"
            >
              {healthQuery.isLoading ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : isConnectorHealthy ? (
                <CheckCircle2 className="h-3 w-3" />
              ) : (
                <XCircle className="h-3 w-3" />
              )}
              {healthQuery.isLoading ? "Checking..." : isConnectorHealthy ? "Connected" : "Disconnected"}
            </Badge>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="connections" className="gap-2" data-testid="tab-connections">
              <Link2 className="h-4 w-4" />
              Connections
            </TabsTrigger>
            <TabsTrigger value="settings" className="gap-2" data-testid="tab-settings">
              <Settings className="h-4 w-4" />
              Settings
            </TabsTrigger>
          </TabsList>

          <TabsContent value="connections" className="space-y-6">
            <div className="grid gap-6 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-[#2CA01C]/10">
                      <SiQuickbooks className="h-7 w-7 text-[#2CA01C]" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">QuickBooks Online</CardTitle>
                      <CardDescription>Connect your Intuit QBO account</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="tenant-id-qbo">Connection Label (optional)</Label>
                    <Input
                      id="tenant-id-qbo"
                      placeholder="e.g., my-business"
                      value={tenantId}
                      onChange={(e) => setTenantId(e.target.value)}
                      data-testid="input-tenant-id-qbo"
                    />
                    <p className="text-xs text-muted-foreground">
                      A name to organize this connection - not from QuickBooks
                    </p>
                  </div>
                  <Button 
                    onClick={handleConnectQBO} 
                    className="w-full gap-2"
                    disabled={!qboClientId}
                    data-testid="button-connect-qbo"
                  >
                    <ExternalLink className="h-4 w-4" />
                    Connect QuickBooks
                  </Button>
                  {!qboClientId && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" />
                      Configure QBO credentials in Settings first
                    </p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-[#13B5EA]/10">
                      <Building2 className="h-7 w-7 text-[#13B5EA]" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">Xero</CardTitle>
                      <CardDescription>Connect your Xero accounting</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="tenant-id-xero">Connection Label (optional)</Label>
                    <Input
                      id="tenant-id-xero"
                      placeholder="e.g., my-business"
                      value={tenantId}
                      onChange={(e) => setTenantId(e.target.value)}
                      data-testid="input-tenant-id-xero"
                    />
                    <p className="text-xs text-muted-foreground">
                      A name to organize this connection - not from Xero
                    </p>
                  </div>
                  <Button 
                    onClick={handleConnectXero} 
                    className="w-full gap-2"
                    variant="outline"
                    disabled={!xeroClientId}
                    data-testid="button-connect-xero"
                  >
                    <ExternalLink className="h-4 w-4" />
                    Connect Xero
                  </Button>
                  {!xeroClientId && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" />
                      Configure Xero credentials in Settings first
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Link2 className="h-5 w-5" />
                  Active Connections
                </CardTitle>
                <CardDescription>
                  Manage your connected accounting platforms
                </CardDescription>
              </CardHeader>
              <CardContent>
                {connectionsQuery.isLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : connectionsQuery.data && connectionsQuery.data.length > 0 ? (
                  <div className="space-y-3">
                    {connectionsQuery.data.map((conn) => (
                      <div
                        key={conn.id}
                        className="flex items-center justify-between rounded-lg border p-4"
                        data-testid={`connection-item-${conn.id}`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${
                            conn.source === "qbo" ? "bg-[#2CA01C]/10" : "bg-[#13B5EA]/10"
                          }`}>
                            {conn.source === "qbo" ? (
                              <SiQuickbooks className="h-5 w-5 text-[#2CA01C]" />
                            ) : (
                              <Building2 className="h-5 w-5 text-[#13B5EA]" />
                            )}
                          </div>
                          <div>
                            <p className="font-medium">
                              {conn.source === "qbo" ? "QuickBooks Online" : "Xero"}
                            </p>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <span>Tenant: {conn.tenant_id}</span>
                              {conn.last_sync_at && (
                                <>
                                  <span>·</span>
                                  <span className="flex items-center gap-1">
                                    <Clock className="h-3 w-3" />
                                    Last sync: {new Date(conn.last_sync_at).toLocaleString()}
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-2"
                          onClick={() => syncMutation.mutate(conn.id)}
                          disabled={syncMutation.isPending}
                          data-testid={`button-sync-${conn.id}`}
                        >
                          {syncMutation.isPending ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <RefreshCw className="h-4 w-4" />
                          )}
                          Sync Now
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                      <Link2 className="h-8 w-8 text-muted-foreground" />
                    </div>
                    <h3 className="mt-4 text-lg font-medium">No connections yet</h3>
                    <p className="mt-2 max-w-sm text-sm text-muted-foreground">
                      Connect your QuickBooks Online or Xero account to start syncing financial data to BigQuery.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="settings" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Key className="h-5 w-5" />
                  QuickBooks Online Credentials
                </CardTitle>
                <CardDescription>
                  Enter your Intuit Developer app credentials
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="qbo-client-id">Client ID</Label>
                    <Input
                      id="qbo-client-id"
                      type="text"
                      placeholder="Enter QBO Client ID"
                      value={qboClientId}
                      onChange={(e) => setQboClientId(e.target.value)}
                      data-testid="input-qbo-client-id"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="qbo-client-secret">Client Secret</Label>
                    <Input
                      id="qbo-client-secret"
                      type="password"
                      placeholder="Enter QBO Client Secret"
                      value={qboClientSecret}
                      onChange={(e) => setQboClientSecret(e.target.value)}
                      data-testid="input-qbo-client-secret"
                    />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Get your credentials from the{" "}
                  <a 
                    href="https://developer.intuit.com/app/developer/dashboard" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    Intuit Developer Portal
                  </a>
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Key className="h-5 w-5" />
                  Xero Credentials
                </CardTitle>
                <CardDescription>
                  Enter your Xero Developer app credentials
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="xero-client-id">Client ID</Label>
                    <Input
                      id="xero-client-id"
                      type="text"
                      placeholder="Enter Xero Client ID"
                      value={xeroClientId}
                      onChange={(e) => setXeroClientId(e.target.value)}
                      data-testid="input-xero-client-id"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="xero-client-secret">Client Secret</Label>
                    <Input
                      id="xero-client-secret"
                      type="password"
                      placeholder="Enter Xero Client Secret"
                      value={xeroClientSecret}
                      onChange={(e) => setXeroClientSecret(e.target.value)}
                      data-testid="input-xero-client-secret"
                    />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Get your credentials from the{" "}
                  <a 
                    href="https://developer.xero.com/app/manage" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    Xero Developer Portal
                  </a>
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Database className="h-5 w-5" />
                  Google Cloud / BigQuery
                </CardTitle>
                <CardDescription>
                  Configure where synced data will be stored
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="gcp-project-id">GCP Project ID</Label>
                    <Input
                      id="gcp-project-id"
                      type="text"
                      placeholder="your-gcp-project-id"
                      value={gcpProjectId}
                      onChange={(e) => setGcpProjectId(e.target.value)}
                      data-testid="input-gcp-project-id"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="bq-dataset-id">BigQuery Dataset ID</Label>
                    <Input
                      id="bq-dataset-id"
                      type="text"
                      placeholder="keystone_finance"
                      value={bqDatasetId}
                      onChange={(e) => setBqDatasetId(e.target.value)}
                      data-testid="input-bq-dataset-id"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="flex justify-end">
              <Button
                onClick={handleSaveConfig}
                disabled={saveConfigMutation.isPending}
                className="gap-2"
                data-testid="button-save-config"
              >
                {saveConfigMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-4 w-4" />
                )}
                Save Configuration
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
