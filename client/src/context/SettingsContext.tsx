import React, { createContext, useContext, useState, useEffect } from "react";

interface Settings {
  appName: string;
  urgentDaysThreshold: number;
  approvalTimeoutHours: number;
  googleMapsApiKey: string;
  logoUrl: string;
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
};

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadSettings = async () => {
      try {
        setIsLoading(true);
        console.log("🔄 [SettingsContext] Buscando configurações...");

        const response = await fetch("/api/settings", {
          credentials: "include"
        });

        if (!response.ok) {
          throw new Error(`Erro ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        console.log("📊 [SettingsContext] Configurações recebidas:", data);

        // Converter array de settings para objeto
        const settingsObject = data.reduce((acc: Record<string, string>, setting: any) => {
          acc[setting.key] = setting.value;
          return acc;
        }, {});

        console.log("🔧 [SettingsContext] Configurações processadas:", settingsObject);

        // Log específico para Google Maps
        const hasGoogleMapsKey = !!settingsObject.google_maps_api_key;
        console.log(`🗺️ [SettingsContext] Google Maps API Key:`, {
          presente: hasGoogleMapsKey,
          tamanho: settingsObject.google_maps_api_key?.length || 0,
          preview: hasGoogleMapsKey ? settingsObject.google_maps_api_key?.substring(0, 8) + '...' : 'N/A',
          valorCompleto: process.env.NODE_ENV === 'development' ? settingsObject.google_maps_api_key : '[HIDDEN]'
        });

        // Verificar se a chave está realmente disponível para o usuário
        if (!hasGoogleMapsKey) {
          console.warn("⚠️ [SettingsContext] Google Maps API Key não encontrada nas configurações do usuário");
          console.log("🔍 [SettingsContext] Chaves disponíveis:", Object.keys(settingsObject));
        }

        setSettings(settingsObject);
      } catch (error) {
        console.error("❌ [SettingsContext] Erro ao buscar configurações:", error);
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