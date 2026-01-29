import React, { createContext, useContext, useState, useEffect } from "react";

interface Settings {
  appName: string;
  urgentDaysThreshold: number;
  approvalTimeoutHours: number;
  googleMapsApiKey: string;
  logoUrl: string;
  cancelMinDays: number;
  rescheduleMinDays: number;
  defaultResetPassword: string;
  maxOrderPercentage: number;
}

interface SettingsContextType {
  settings: Settings;
  updateSettings: (newSettings: Partial<Settings>) => void;
  isLoading: boolean;
}

const defaultSettings: Settings = {
  appName: "i-CAP 5.0",
  urgentDaysThreshold: 7,
  approvalTimeoutHours: 48,
  googleMapsApiKey: "",
  logoUrl: "",
  cancelMinDays: 3,
  rescheduleMinDays: 3,
  defaultResetPassword: "icap123",
  maxOrderPercentage: 100,
};

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const response = await fetch("/api/settings");
        if (response.ok) {
          const data = await response.json();
          
          // Converter array de configurações para objeto Settings
          const settingsObject: Settings = {
            appName: data.find((s: any) => s.key === "app_name")?.value || defaultSettings.appName,
            urgentDaysThreshold: parseInt(data.find((s: any) => s.key === "urgent_days_threshold")?.value || "7", 10),
            approvalTimeoutHours: parseInt(data.find((s: any) => s.key === "approval_timeout_hours")?.value || "48", 10),
            googleMapsApiKey: data.find((s: any) => s.key === "google_maps_api_key")?.value || defaultSettings.googleMapsApiKey,
            logoUrl: data.find((s: any) => s.key === "logo_url")?.value?.trim() || defaultSettings.logoUrl,
            cancelMinDays: parseInt(data.find((s: any) => s.key === "cancel_min_days")?.value || "3", 10),
            rescheduleMinDays: parseInt(data.find((s: any) => s.key === "reschedule_min_days")?.value || "3", 10),
            defaultResetPassword: data.find((s: any) => s.key === "default_reset_password")?.value || defaultSettings.defaultResetPassword,
            maxOrderPercentage: parseInt(data.find((s: any) => s.key === "max_order_percentage")?.value || "100", 10),
          };
          
          setSettings(settingsObject);
        }
      } catch (error) {
        console.error("Erro ao carregar configurações:", error);
      } finally {
        setIsLoading(false);
      }
    };

    loadSettings();
  }, []);

  const updateSettings = async (newSettings: Partial<Settings>) => {
    try {
      const updatedSettings = { ...settings, ...newSettings };
      setSettings(updatedSettings);

      // Converter objeto Settings para array de configurações
      const settingsArray = [
        { key: "app_name", value: updatedSettings.appName, description: "Nome da aplicação" },
        { key: "urgent_days_threshold", value: updatedSettings.urgentDaysThreshold.toString(), description: "Dias para considerar pedido urgente" },
        { key: "approval_timeout_hours", value: updatedSettings.approvalTimeoutHours.toString(), description: "Tempo limite para aprovação em horas" },
        { key: "google_maps_api_key", value: updatedSettings.googleMapsApiKey, description: "Chave da API Google Maps" },
        { key: "logo_url", value: updatedSettings.logoUrl, description: "URL do logo da aplicação" },
        { key: "cancel_min_days", value: updatedSettings.cancelMinDays.toString(), description: "Dias mínimos de antecedência para cancelar pedido" },
        { key: "reschedule_min_days", value: updatedSettings.rescheduleMinDays.toString(), description: "Dias mínimos de antecedência para reprogramar pedido" },
        { key: "default_reset_password", value: updatedSettings.defaultResetPassword, description: "Senha padrão ao resetar senha de usuário" },
        { key: "max_order_percentage", value: updatedSettings.maxOrderPercentage.toString(), description: "Percentual máximo de carga do pedido sobre a ordem" },
      ];

      // Atualizar no servidor
      await fetch("/api/settings", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(settingsArray),
      });
    } catch (error) {
      console.error("Erro ao atualizar configurações:", error);
    }
  };

  return (
    <SettingsContext.Provider value={{ settings, updateSettings, isLoading }}>
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettings = () => {
  const context = useContext(SettingsContext);
  if (context === undefined) {
    throw new Error("useSettings deve ser usado dentro de um SettingsProvider");
  }
  return context;
}; 