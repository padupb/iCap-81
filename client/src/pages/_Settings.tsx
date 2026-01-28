import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "@/hooks/use-toast";
import {
  Settings as SettingsIcon,
  Save,
  RotateCcw,
  Clock,
  MapPin,
  AlertTriangle,
  Box,
  Database,
  Key,
  Shield,
  Eye,
  EyeOff,
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import type { Setting } from "@shared/schema";
import { z } from "zod";
import { useAuth } from "@/context/AuthContext";

const settingsFormSchema = z.object({
  urgent_days_threshold: z.string().min(1, "Campo obrigatório"),
  approval_timeout_hours: z.string().min(1, "Campo obrigatório"),
  app_name: z.string().min(1, "Campo obrigatório"),
  logo_url: z.string().optional(),
  cancel_min_days: z.string().min(1, "Campo obrigatório"),
  reschedule_min_days: z.string().min(1, "Campo obrigatório"),
  default_reset_password: z.string().min(1, "Campo obrigatório"),
});

const apiFormSchema = z.object({
  google_maps_api_key: z.string().optional(),
  github_token: z.string().optional(),
  openai_api_key: z.string().optional(),
  smtp_host: z.string().optional(),
  smtp_port: z.string().optional(),
  smtp_user: z.string().optional(),
  smtp_password: z.string().optional(),
});

type SettingsFormData = z.infer<typeof settingsFormSchema>;
type ApiFormData = z.infer<typeof apiFormSchema>;

export default function Settings() {
  const [isLoading, setIsLoading] = useState(false);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [showPasswords, setShowPasswords] = useState<Record<string, boolean>>({});
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const { data: settings = [], isLoading: settingsLoading } = useQuery<Setting[]>({
    queryKey: ["/api/settings"],
  });

  const updateSettingsMutation = useMutation({
    mutationFn: async (data: SettingsFormData | ApiFormData) => {
      const settingsArray = Object.entries(data).map(([key, value]) => {
        const existingSetting = settings.find((s) => s.key === key);
        return {
          key,
          value: value || "",
          description: existingSetting?.description || "",
        };
      });

      console.log("Updating settings:", settingsArray);
      return apiRequest("PUT", "/api/settings", settingsArray);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
      toast({
        title: "Sucesso",
        description: "Configurações atualizadas com sucesso",
      });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Erro ao atualizar configurações",
        variant: "destructive",
      });
    },
  });

  // Convert settings array to object for form
  const settingsObject = settings.reduce(
    (acc, setting) => {
      acc[setting.key] = setting.value;
      return acc;
    },
    {} as Record<string, string>,
  );

  const settingsForm = useForm<SettingsFormData>({
    resolver: zodResolver(settingsFormSchema),
    values: {
      urgent_days_threshold: settingsObject.urgent_days_threshold || "7",
      approval_timeout_hours: settingsObject.approval_timeout_hours || "48",
      app_name: settingsObject.app_name || "i-CAP 5.1",
      logo_url: settingsObject.logo_url || "",
      cancel_min_days: settingsObject.cancel_min_days || "3",
      reschedule_min_days: settingsObject.reschedule_min_days || "3",
      default_reset_password: settingsObject.default_reset_password || "icap123",
    },
  });

  const apiForm = useForm<ApiFormData>({
    resolver: zodResolver(apiFormSchema),
    values: {
      google_maps_api_key: settingsObject.google_maps_api_key || "",
      github_token: settingsObject.github_token || "",
      openai_api_key: settingsObject.openai_api_key || "",
      smtp_host: settingsObject.smtp_host || "",
      smtp_port: settingsObject.smtp_port || "",
      smtp_user: settingsObject.smtp_user || "",
      smtp_password: settingsObject.smtp_password || "",
    },
  });

  const onSettingsSubmit = (data: SettingsFormData) => {
    updateSettingsMutation.mutate(data);
  };

  const onApiSubmit = (data: ApiFormData) => {
    updateSettingsMutation.mutate(data);
  };

  const togglePasswordVisibility = (field: string) => {
    setShowPasswords(prev => ({
      ...prev,
      [field]: !prev[field]
    }));
  };

  const handleSettingsReset = () => {
    settingsForm.reset({
      urgent_days_threshold: "7",
      approval_timeout_hours: "48",
      app_name: "i-CAP 5.1",
      logo_url: "",
      cancel_min_days: "3",
      reschedule_min_days: "3",
      default_reset_password: "icap123",
    });
  };

  const handleApiReset = () => {
    apiForm.reset({
      google_maps_api_key: "",
      github_token: "",
      openai_api_key: "",
      smtp_host: "",
      smtp_port: "",
      smtp_user: "",
      smtp_password: "",
    });
  };

  const handleLogoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploadingLogo(true);

    try {
      const formData = new FormData();
      formData.append("logo", file);

      const response = await fetch("/api/upload/logo", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Erro ao fazer upload do logo");
      }

      const result = await response.json();

      // Atualizar as configurações para refletir o novo logo
      queryClient.invalidateQueries({ queryKey: ["/api/settings"] });

      toast({
        title: "Sucesso",
        description: "Logo enviado com sucesso",
      });
    } catch (error) {
      toast({
        title: "Erro",
        description: "Erro ao fazer upload do logo",
        variant: "destructive",
      });
    } finally {
      setIsUploadingLogo(false);
      // Limpar o input
      event.target.value = "";
    }
  };

  if (settingsLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3 mb-6">
          <SettingsIcon className="w-8 h-8 text-primary" />
          <h1 className="text-3xl font-bold text-foreground">Configurações do Sistema</h1>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="bg-card border-border">
              <CardContent className="p-6">
                <div className="animate-pulse">
                  <div className="h-4 bg-muted rounded w-3/4 mb-4"></div>
                  <div className="h-10 bg-muted rounded"></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center gap-3 mb-6">
        <SettingsIcon className="w-8 h-8 text-primary" />
        <h1 className="text-3xl font-bold text-foreground">Configurações do Sistema</h1>
      </div>

      <Tabs defaultValue="general" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="general" className="flex items-center gap-2">
            <SettingsIcon className="w-4 h-4" />
            Geral
          </TabsTrigger>
          <TabsTrigger value="database" className="flex items-center gap-2">
            <Database className="w-4 h-4" />
            Banco de Dados
          </TabsTrigger>
          <TabsTrigger value="api" className="flex items-center gap-2">
            <Key className="w-4 h-4" />
            API
          </TabsTrigger>
        </TabsList>

        {/* Aba Configurações Gerais - Atualizado 28/01/2026 */}
        <TabsContent value="general" className="space-y-6">
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <SettingsIcon className="w-5 h-5 text-primary" />
                Configurações Gerais
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Form {...settingsForm}>
                <form onSubmit={settingsForm.handleSubmit(onSettingsSubmit)} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormField
                      control={settingsForm.control}
                      name="app_name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Nome da Aplicação</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="i-CAP 5.1"
                              className="bg-input border-border"
                              {...field}
                            />
                          </FormControl>
                          <p className="text-sm text-muted-foreground">
                            Nome exibido no cabeçalho da aplicação
                          </p>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={settingsForm.control}
                      name="urgent_days_threshold"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="flex items-center gap-2">
                            <Clock className="w-4 h-4 text-orange-500" />
                            Limite de Urgência (dias)
                          </FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min="1"
                              max="30"
                              placeholder="7"
                              className="bg-input border-border"
                              {...field}
                            />
                          </FormControl>
                          <p className="text-sm text-muted-foreground">
                            Pedidos com entrega inferior a este valor necessitam aprovação
                          </p>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={settingsForm.control}
                    name="approval_timeout_hours"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-2">
                          <Clock className="w-4 h-4 text-red-500" />
                          Timeout de Aprovação (horas)
                        </FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min="1"
                            max="168"
                            placeholder="48"
                            className="bg-input border-border"
                            {...field}
                          />
                        </FormControl>
                        <p className="text-sm text-muted-foreground">
                          Tempo máximo para processar aprovações de pedidos urgentes
                        </p>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormField
                      control={settingsForm.control}
                      name="cancel_min_days"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="flex items-center gap-2">
                            <AlertTriangle className="w-4 h-4 text-red-500" />
                            Dias Mínimos para Cancelar
                          </FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min="0"
                              max="30"
                              placeholder="3"
                              className="bg-input border-border"
                              {...field}
                            />
                          </FormControl>
                          <p className="text-sm text-muted-foreground">
                            Antecedência mínima (em dias) para cancelar um pedido
                          </p>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={settingsForm.control}
                      name="reschedule_min_days"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="flex items-center gap-2">
                            <Clock className="w-4 h-4 text-blue-500" />
                            Dias Mínimos para Reprogramar
                          </FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min="0"
                              max="30"
                              placeholder="3"
                              className="bg-input border-border"
                              {...field}
                            />
                          </FormControl>
                          <p className="text-sm text-muted-foreground">
                            Antecedência mínima (em dias) para reprogramar entrega
                          </p>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={settingsForm.control}
                    name="default_reset_password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-2">
                          <Key className="w-4 h-4 text-purple-500" />
                          Senha Padrão para Reset
                        </FormLabel>
                        <FormControl>
                          <Input
                            type="text"
                            placeholder="icap123"
                            className="bg-input border-border"
                            {...field}
                          />
                        </FormControl>
                        <p className="text-sm text-muted-foreground">
                          Senha padrão atribuída ao resetar a senha de um usuário
                        </p>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="mt-6">
                    <FormLabel>Logo da Aplicação</FormLabel>
                    <div className="flex flex-col space-y-4 mt-2">
                      {/* Preview do logo atual */}
                      {settingsObject.logo_url && (
                        <div className="flex items-center space-x-4">
                          <img
                            src={settingsObject.logo_url}
                            alt="Logo atual"
                            className="w-16 h-16 object-contain border border-border rounded"
                            onError={(e) => {
                              e.currentTarget.style.display = 'none';
                            }}
                          />
                          <span className="text-sm text-muted-foreground">Logo atual</span>
                        </div>
                      )}

                      {/* Input de upload */}
                      <div className="flex items-center space-x-4">
                        <Input
                          type="file"
                          accept="image/*"
                          className="bg-input border-border"
                          onChange={handleLogoUpload}
                          disabled={isUploadingLogo}
                        />
                        {isUploadingLogo && (
                          <span className="text-sm text-muted-foreground">Enviando...</span>
                        )}
                      </div>

                      <p className="text-sm text-muted-foreground">
                        Faça upload de uma imagem para o logo (PNG, JPG, etc. - máx. 5MB)
                      </p>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex flex-col sm:flex-row justify-between items-center pt-6 border-t border-border gap-4">
                    <div className="text-sm text-muted-foreground">
                      As alterações serão aplicadas imediatamente após salvar
                    </div>

                    <div className="flex space-x-4">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={handleSettingsReset}
                        disabled={updateSettingsMutation.isPending}
                      >
                        <RotateCcw className="mr-2" size={16} />
                        Restaurar Padrões
                      </Button>
                      <Button
                        type="submit"
                        className="bg-primary hover:bg-primary/90"
                        disabled={updateSettingsMutation.isPending}
                      >
                        <Save className="mr-2" size={16} />
                        {updateSettingsMutation.isPending
                          ? "Salvando..."
                          : "Salvar Configurações"}
                      </Button>
                    </div>
                  </div>
                </form>
              </Form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Aba Banco de Dados */}
        <TabsContent value="database" className="space-y-6">
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="w-5 h-5 text-primary" />
                Configurações do Banco de Dados
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Form {...apiForm}>
                <form onSubmit={apiForm.handleSubmit(onApiSubmit)} className="space-y-8">

                  {/* Configurações de Banco de Dados */}
                  <div className="border-t border-border pt-6">
                    <div className="flex items-center gap-2 mb-4">
                      <Database className="w-5 h-5 text-red-500" />
                      <h3 className="text-lg font-medium text-foreground">
                        Configurações de Banco de Dados
                      </h3>
                      <Shield className="w-4 h-4 text-red-500" />
                    </div>

                    <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-6">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-red-600" />
                        <span className="text-sm font-medium text-red-800 dark:text-red-200">
                          Configurações Sensíveis
                        </span>
                      </div>
                      <p className="text-sm text-red-700 dark:text-red-300 mt-1">
                        Alterações nesta seção podem afetar a conectividade com o banco de dados.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 gap-6">
                      <FormField
                        control={apiForm.control}
                        name="database_url"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>DATABASE_URL (Conexão Completa)</FormLabel>
                            <FormControl>
                              <div className="relative">
                                <Input
                                  type={showPasswords.database_url ? "text" : "password"}
                                  placeholder="postgresql://user:password@host:port/database"
                                  className="bg-input border-border pr-10"
                                  {...field}
                                />
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="absolute right-0 top-0 h-full px-3 py-2"
                                  onClick={() => togglePasswordVisibility('database_url')}
                                >
                                  {showPasswords.database_url ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                </Button>
                              </div>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <FormField
                          control={apiForm.control}
                          name="pghost"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>PGHOST (Servidor)</FormLabel>
                              <FormControl>
                                <Input
                                  placeholder="ep-sparkling-surf-a6zclzez.us-west-2.aws.neon.tech"
                                  className="bg-input border-border"
                                  {...field}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={apiForm.control}
                          name="pgport"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>PGPORT (Porta)</FormLabel>
                              <FormControl>
                                <Input
                                  placeholder="5432"
                                  className="bg-input border-border"
                                  {...field}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={apiForm.control}
                          name="pgdatabase"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>PGDATABASE (Nome do Banco)</FormLabel>
                              <FormControl>
                                <Input
                                  placeholder="neondb"
                                  className="bg-input border-border"
                                  {...field}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={apiForm.control}
                          name="pguser"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>PGUSER (Usuário)</FormLabel>
                              <FormControl>
                                <Input
                                  placeholder="neondb_owner"
                                  className="bg-input border-border"
                                  {...field}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <FormField
                        control={apiForm.control}
                        name="pgpassword"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>PGPASSWORD (Senha do Banco)</FormLabel>
                            <FormControl>
                              <div className="relative">
                                <Input
                                  type={showPasswords.pgpassword ? "text" : "password"}
                                  placeholder="••••••••••••••••"
                                  className="bg-input border-border pr-10"
                                  {...field}
                                />
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="absolute right-0 top-0 h-full px-3 py-2"
                                  onClick={() => togglePasswordVisibility('pgpassword')}
                                >
                                  {showPasswords.pgpassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                </Button>
                              </div>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex flex-col sm:flex-row justify-between items-center pt-6 border-t border-border gap-4">
                    <div className="text-sm text-muted-foreground">
                      As alterações serão aplicadas imediatamente após salvar
                    </div>

                    <div className="flex space-x-4">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={handleApiReset}
                        disabled={updateSettingsMutation.isPending}
                      >
                        <RotateCcw className="mr-2" size={16} />
                        Restaurar Padrões
                      </Button>
                      <Button
                        type="submit"
                        className="bg-primary hover:bg-primary/90"
                        disabled={updateSettingsMutation.isPending}
                      >
                        <Save className="mr-2" size={16} />
                        {updateSettingsMutation.isPending
                          ? "Salvando..."
                          : "Salvar Configurações"}
                      </Button>
                    </div>
                  </div>
                </form>
              </Form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Aba API */}
        <TabsContent value="api" className="space-y-6">
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Key className="w-5 h-5 text-primary" />
                Configurações de API e Integrações
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Form {...apiForm}>
                <form onSubmit={apiForm.handleSubmit(onApiSubmit)} className="space-y-8">
                  {/* Google Maps API */}
                  <div className="space-y-6">
                    <div className="flex items-center gap-2 mb-4">
                      <MapPin className="w-5 h-5 text-green-500" />
                      <h3 className="text-lg font-medium text-foreground">
                        Integrações
                      </h3>
                    </div>

                    <FormField
                      control={apiForm.control}
                      name="google_maps_api_key"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="flex items-center gap-2">
                            <MapPin className="w-4 h-4 text-green-500" />
                            Chave API Google Maps
                          </FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Input
                                type={showPasswords.google_maps_api_key ? "text" : "password"}
                                placeholder="AIza..."
                                className="bg-input border-border pr-10"
                                {...field}
                              />
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="absolute right-0 top-0 h-full px-3 py-2"
                                onClick={() => togglePasswordVisibility('google_maps_api_key')}
                              >
                                {showPasswords.google_maps_api_key ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                              </Button>
                            </div>
                          </FormControl>
                          <p className="text-sm text-muted-foreground">
                            Para funcionalidades de rastreamento e mapas
                          </p>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  {/* API Keys Settings */}
                  <div className="border-t border-border pt-6">
                    <div className="flex items-center gap-2 mb-4">
                      <Key className="w-5 h-5 text-blue-500" />
                      <h3 className="text-lg font-medium text-foreground">
                        Chaves de API e Serviços
                      </h3>
                    </div>

                    <div className="grid grid-cols-1 gap-6">
                      <FormField
                        control={apiForm.control}
                        name="openai_api_key"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>OpenAI API Key</FormLabel>
                            <FormControl>
                              <div className="relative">
                                <Input
                                  type={showPasswords.openai_api_key ? "text" : "password"}
                                  placeholder="sk-..."
                                  className="bg-input border-border pr-10"
                                  {...field}
                                />
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="absolute right-0 top-0 h-full px-3 py-2"
                                  onClick={() => togglePasswordVisibility('openai_api_key')}
                                >
                                  {showPasswords.openai_api_key ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                </Button>
                              </div>
                            </FormControl>
                            <p className="text-sm text-muted-foreground">
                              Para funcionalidades de IA e análise de texto
                            </p>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={apiForm.control}
                        name="github_token"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>GitHub Token</FormLabel>
                            <FormControl>
                              <div className="relative">
                                <Input
                                  type={showPasswords.github_token ? "text" : "password"}
                                  placeholder="github_pat_..."
                                  className="bg-input border-border pr-10"
                                  {...field}
                                />
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="absolute right-0 top-0 h-full px-3 py-2"
                                  onClick={() => togglePasswordVisibility('github_token')}
                                >
                                  {showPasswords.github_token ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                </Button>
                              </div>
                            </FormControl>
                            <p className="text-sm text-muted-foreground">
                              Para integrações com repositórios GitHub
                            </p>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <div className="border-t border-border pt-6">
                        <h4 className="text-md font-medium text-foreground mb-4">
                          Configurações SMTP (E-mail)
                        </h4>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <FormField
                            control={apiForm.control}
                            name="smtp_host"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>SMTP Host</FormLabel>
                                <FormControl>
                                  <Input
                                    placeholder="smtp.gmail.com"
                                    className="bg-input border-border"
                                    {...field}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={apiForm.control}
                            name="smtp_port"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>SMTP Port</FormLabel>
                                <FormControl>
                                  <Input
                                    placeholder="587"
                                    className="bg-input border-border"
                                    {...field}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={apiForm.control}
                            name="smtp_user"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>SMTP User</FormLabel>
                                <FormControl>
                                  <Input
                                    placeholder="usuario@email.com"
                                    className="bg-input border-border"
                                    {...field}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={apiForm.control}
                            name="smtp_password"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>SMTP Password</FormLabel>
                                <FormControl>
                                  <div className="relative">
                                    <Input
                                      type={showPasswords.smtp_password ? "text" : "password"}
                                      placeholder="••••••••••••••••"
                                      className="bg-input border-border pr-10"
                                      {...field}
                                    />
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      className="absolute right-0 top-0 h-full px-3 py-2"
                                      onClick={() => togglePasswordVisibility('smtp_password')}
                                    >
                                      {showPasswords.smtp_password ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                    </Button>
                                  </div>
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex flex-col sm:flex-row justify-between items-center pt-6 border-t border-border gap-4">
                    <div className="text-sm text-muted-foreground">
                      As alterações serão aplicadas imediatamente após salvar
                    </div>

                    <div className="flex space-x-4">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={handleApiReset}
                        disabled={updateSettingsMutation.isPending}
                      >
                        <RotateCcw className="mr-2" size={16} />
                        Restaurar Padrões
                      </Button>
                      <Button
                        type="submit"
                        className="bg-primary hover:bg-primary/90"
                        disabled={updateSettingsMutation.isPending}
                      >
                        <Save className="mr-2" size={16} />
                        {updateSettingsMutation.isPending
                          ? "Salvando..."
                          : "Salvar Configurações"}
                      </Button>
                    </div>
                  </div>
                </form>
              </Form>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}