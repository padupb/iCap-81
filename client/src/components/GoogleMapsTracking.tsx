import React, { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';

interface TrackingPoint {
  id: number;
  orderId: number;
  latitude: number;
  longitude: number;
  createdAt: string;
}

interface GoogleMapsTrackingProps {
  orderId: number | null;
}

export function GoogleMapsTracking({ orderId }: GoogleMapsTrackingProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const [isGoogleMapsLoaded, setIsGoogleMapsLoaded] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const [googleMapsApiKey, setGoogleMapsApiKey] = useState<string>('');

  // Buscar configurações do sistema
  const { data: settings = [] } = useQuery({
    queryKey: ['/api/settings'],
    queryFn: async () => {
      const response = await fetch('/api/settings');
      if (!response.ok) throw new Error('Falha ao carregar configurações');
      return response.json();
    },
  });

  // Buscar pontos de rastreamento
  const { data: trackingPoints = [], isLoading } = useQuery<TrackingPoint[]>({
    queryKey: [`/api/tracking-points/${orderId}`],
    queryFn: async () => {
      if (!orderId) return [];
      console.log(`🔍 Buscando pontos de rastreamento para pedido: ${orderId}`);
      const response = await fetch(`/api/tracking-points/${orderId}`);
      if (!response.ok) throw new Error('Falha ao carregar pontos de rastreamento');
      const data = await response.json();
      console.log(`📍 Pontos recebidos:`, data);
      return data;
    },
    enabled: !!orderId,
    refetchInterval: 30000, // Atualizar a cada 30 segundos
  });

  // Extrair chave da API do Google Maps das configurações do keyuser
  useEffect(() => {
    console.log('🔍 Verificando configurações para Google Maps API Key (configurada pelo keyuser):', settings);
    if (settings && settings.length > 0) {
      const googleMapsKeySetting = settings.find((setting: any) => setting.key === 'google_maps_api_key');
      console.log('🗝️ Configuração do keyuser encontrada:', googleMapsKeySetting);
      if (googleMapsKeySetting && googleMapsKeySetting.value) {
        console.log('✅ Google Maps API Key do keyuser encontrada, comprimento:', googleMapsKeySetting.value.length);
        setGoogleMapsApiKey(googleMapsKeySetting.value);
      } else {
        console.log('❌ Google Maps API Key não configurada pelo keyuser');
      }
    } else {
      console.log('❌ Nenhuma configuração do keyuser encontrada');
    }
  }, [settings]);

  // Carregar Google Maps API com os novos componentes gmp
  useEffect(() => {
    if (!googleMapsApiKey) {
      return; // Aguardar chave da API ser carregada
    }

    const loadGoogleMaps = () => {
      // Verificar se já existe um script carregando
      const existingScript = document.querySelector('script[src*="maps.googleapis.com"]');
      if (existingScript) {
        existingScript.addEventListener('load', () => {
          setIsGoogleMapsLoaded(true);
        });
        return;
      }

      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${googleMapsApiKey}&callback=console.debug&libraries=maps,marker&v=beta`;
      script.async = true;
      script.defer = true;
      script.onload = () => {
        console.log('Google Maps API carregada com sucesso');
        setIsGoogleMapsLoaded(true);
      };
      script.onerror = (error) => {
        console.error('Erro ao carregar Google Maps API:', error);
        setMapError('Falha ao carregar a API do Google Maps. Verifique sua chave de API.');
      };
      document.head.appendChild(script);
    };

    loadGoogleMaps();
  }, [googleMapsApiKey]);

  // Definir centro do mapa baseado nos pontos ou posição padrão
  const getMapCenter = () => {
    if (trackingPoints.length > 0) {
      const firstPoint = trackingPoints[0];
      return `${firstPoint.latitude},${firstPoint.longitude}`;
    }
    return "-14.2621381,-56.0220111"; // Posição padrão (Cuiabá)
  };

  const getMapZoom = () => {
    return trackingPoints.length > 0 ? "12" : "6";
  };

  // Exibir erro se houver problema com o mapa
  if (mapError) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gray-100">
        <div className="text-center p-4">
          <div className="text-4xl mb-3">🗺️</div>
          <p className="text-sm text-red-600 font-medium mb-2">Erro ao carregar Google Maps</p>
          <p className="text-xs text-gray-600 mb-3 max-w-md">{mapError}</p>

          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-3 text-left max-w-md">
            <p className="text-xs text-yellow-800 font-medium mb-1">Instruções:</p>
            <ul className="text-xs text-yellow-700 space-y-1">
              <li>• Verifique se a chave da API do Google Maps está configurada</li>
              <li>• Acesse as Configurações para definir a chave</li>
              <li>• Certifique-se de que a API Maps JavaScript está habilitada</li>
            </ul>
          </div>

          <button 
            onClick={() => {
              setMapError(null);
              setIsGoogleMapsLoaded(false);
            }}
            className="mt-2 px-3 py-1 bg-blue-500 text-white text-xs rounded hover:bg-blue-600"
          >
            Tentar novamente
          </button>
        </div>
      </div>
    );
  }

  if (!googleMapsApiKey || googleMapsApiKey.trim() === '') {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gray-100">
        <div className="text-center p-4">
          <div className="text-4xl mb-3">⚙️</div>
          <p className="text-sm text-yellow-600 font-medium mb-2">Configuração necessária</p>
          <p className="text-xs text-gray-600 mb-3 max-w-md">
            A chave da API do Google Maps não foi configurada pelo keyuser.
          </p>
          <p className="text-xs text-gray-500 mt-2">
            Solicite ao keyuser para configurar a API do Google Maps no sistema.
          </p>
        </div>
      </div>
    );
  }

  if (isLoading || !isGoogleMapsLoaded) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gray-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-2"></div>
          <p className="text-sm text-gray-600">
            {!isGoogleMapsLoaded ? 'Carregando Google Maps...' : 'Carregando rastreamento...'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full relative">
      <div className="w-full h-full" style={{ minHeight: '400px' }}>
        <gmp-map 
          center={getMapCenter()} 
          zoom={getMapZoom()} 
          map-id="TRACKING_MAP_ID"
          style={{ height: '100%', width: '100%' }}
        >
          {trackingPoints.map((point, index) => (
            <gmp-advanced-marker
              key={point.id}
              position={`${point.latitude},${point.longitude}`}
              title={`Ponto ${index + 1} - ${new Date(point.createdAt).toLocaleString('pt-BR')}`}
            />
          ))}
        </gmp-map>
      </div>

      {/* Indicador de status */}
      <div className="absolute top-2 right-2 bg-white rounded-lg shadow-md p-2 border">
        <div className="flex items-center text-xs text-gray-600">
          {trackingPoints.length > 0 ? (
            <>
              <div className="w-2 h-2 bg-blue-500 rounded-full mr-2"></div>
              {trackingPoints.length} ponto{trackingPoints.length > 1 ? 's' : ''} encontrado{trackingPoints.length > 1 ? 's' : ''}
            </>
          ) : (
            <>
              <div className="w-2 h-2 bg-yellow-500 rounded-full mr-2"></div>
              Nenhum ponto encontrado
            </>
          )}
        </div>
      </div>

      {/* Legenda */}
      <div className="absolute bottom-2 left-2 bg-white rounded-lg shadow-md p-3 border">
        <div className="space-y-2 text-xs">
          {trackingPoints.length > 0 ? (
            <>
              <div className="flex items-center">
                <div className="w-4 h-4 bg-blue-500 rounded-full mr-2"></div>
                <span>Pontos de Rastreamento</span>
              </div>
              <p className="text-gray-500 text-xs mt-1">
                Clique nos pontos para ver detalhes
              </p>
            </>
          ) : (
            <div className="text-center">
              <div className="text-2xl mb-1">📍</div>
              <p className="text-gray-600 font-medium">Aguardando dados</p>
              <p className="text-gray-500 text-xs mt-1">
                Os pontos de rastreamento aparecerão quando forem adicionados
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}