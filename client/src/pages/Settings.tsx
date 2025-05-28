import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import type { Setting } from "@shared/schema";
import { z } from "zod";

const settingsFormSchema = z.object({
  urgent_days_threshold: z.string().min(1, "Campo obrigatório"),
  approval_timeout_hours: z.string().min(1, "Campo obrigatório"),
  google_maps_api_key: z.string().optional(),
  app_name: z.string().min(1, "Campo obrigatório"),
  logo_url: z.string().optional(),
});

type SettingsFormData = z.infer<typeof settingsFormSchema>;

export default function Settings() {
  const [isLoading, setIsLoading] = useState(false);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const queryClient = useQueryClient();

  const { data: settings = [], isLoading: settingsLoading } = useQuery<
    Setting[]
  >({
    queryKey: ["/api/settings"],
  });

  const updateSettingsMutation = useMutation({
    mutationFn: async (data: SettingsFormData) => {
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

  const form = useForm<SettingsFormData>({
    resolver: zodResolver(settingsFormSchema),
    values: {
      urgent_days_threshold: settingsObject.urgent_days_threshold || "7",
      approval_timeout_hours: settingsObject.approval_timeout_hours || "48",
      google_maps_api_key: settingsObject.google_maps_api_key || "",
      app_name: settingsObject.app_name || "i-CAP 5.1",
      logo_url: settingsObject.logo_url || "",
    },
  });

  const onSubmit = (data: SettingsFormData) => {
    updateSettingsMutation.mutate(data);
  };

  const handleReset = () => {
    form.reset({
      urgent_days_threshold: "7",
      approval_timeout_hours: "48",
      google_maps_api_key: "",
      app_name: "i-CAP 5.0",
      logo_url: "",
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
      {/* Configuration Cards Removed */}

      {/* Settings Form */}
      <Card className="bg-card border-border">
        <CardContent className="pt-6">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
              {/* General Settings */}
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-medium text-foreground mb-4">
                    Configurações Gerais
                  </h3>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormField
                      control={form.control}
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

                    <div className="space-y-4">
                      <FormLabel>Logo da Aplicação</FormLabel>
                      <div className="flex flex-col space-y-4">
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
                  </div>

                  <div className="grid grid-cols-1 gap-6 mt-6">
                    <FormField
                      control={form.control}
                      name="google_maps_api_key"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Chave API Google Maps</FormLabel>
                          <FormControl>
                            <Input
                              type="password"
                              placeholder="AIza..."
                              className="bg-input border-border"
                              {...field}
                            />
                          </FormControl>
                          <p className="text-sm text-muted-foreground">
                            Para funcionalidades de rastreamento e mapas
                          </p>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                {/* Approval Settings */}
                <div className="border-t border-border pt-6">
                  <h3 className="text-lg font-medium text-foreground mb-4">
                    Configurações de Aprovação
                  </h3>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormField
                      control={form.control}
                      name="urgent_days_threshold"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Dias para Pedido Urgente</FormLabel>
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
                            Pedidos com entrega inferior a este valor necessitam
                            aprovação
                          </p>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="approval_timeout_hours"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>
                            Tempo Limite para Aprovação (horas)
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
                            Tempo máximo para processar aprovações de pedidos
                            urgentes
                          </p>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
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
                    onClick={handleReset}
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

      {/* Help Section */}
      <Card className="bg-card border-border">
        <CardContent className="pt-6">
          <div className="mb-4">
            <h2 className="text-xl font-semibold">Ajuda e Informações</h2>
          </div>
          <div className="space-y-4 text-sm text-muted-foreground">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h4 className="font-medium text-foreground mb-2">
                  Pedidos Urgentes
                </h4>
                <p>
                  Pedidos com data de entrega inferior ao número de dias
                  configurado serão automaticamente marcados como urgentes e
                  necessitarão aprovação antes de prosseguir para execução.
                </p>
              </div>

              <div>
                <h4 className="font-medium text-foreground mb-2">
                  Timeout de Aprovação
                </h4>
                <p>
                  Define o tempo limite em horas para que aprovações sejam
                  processadas. Após este período, o sistema pode alertar sobre
                  pedidos pendentes.
                </p>
              </div>

              <div>
                <h4 className="font-medium text-foreground mb-2">
                  Google Maps API
                </h4>
                <p>
                  Chave necessária para funcionalidades de rastreamento e
                  exibição de mapas. Deve ser obtida no Google Cloud Console com
                  as APIs apropriadas habilitadas.
                </p>
              </div>

              <div>
                <h4 className="font-medium text-foreground mb-2">
                  Nome da Aplicação
                </h4>
                <p>
                  Nome exibido no cabeçalho da aplicação e em outras áreas da
                  interface. Pode ser personalizado conforme a identidade da
                  organização.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
