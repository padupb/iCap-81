
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

// Declarar tipos do Google Maps
declare global {
  interface Window {
    google: any;
    initMap: () => void;
  }
}

export function GoogleMapsTracking({ orderId }: GoogleMapsTrackingProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<any>(null);
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
      const response = await fetch(`/api/tracking-points/${orderId}`);
      if (!response.ok) throw new Error('Falha ao carregar pontos de rastreamento');
      return response.json();
    },
    enabled: !!orderId,
    refetchInterval: 30000, // Atualizar a cada 30 segundos
  });

  // Extrair chave da API do Google Maps das configurações
  useEffect(() => {
    if (settings && settings.length > 0) {
      const googleMapsKeySetting = settings.find((setting: any) => setting.key === 'google_maps_api_key');
      if (googleMapsKeySetting && googleMapsKeySetting.value) {
        setGoogleMapsApiKey(googleMapsKeySetting.value);
      }
    }
  }, [settings]);

  // Carregar Google Maps API
  useEffect(() => {
    if (!googleMapsApiKey) {
      return; // Aguardar chave da API ser carregada
    }

    const loadGoogleMaps = () => {
      if (window.google) {
        setIsGoogleMapsLoaded(true);
        return;
      }

      // Verificar se já existe um script carregando
      const existingScript = document.querySelector('script[src*="maps.googleapis.com"]');
      if (existingScript) {
        existingScript.addEventListener('load', () => {
          setIsGoogleMapsLoaded(true);
        });
        return;
      }

      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${googleMapsApiKey}&libraries=geometry,places`;
      script.async = true;
      script.defer = true;
      script.onload = () => {
        console.log('Google Maps API carregada com sucesso');
        if (window.google && window.google.maps) {
          setIsGoogleMapsLoaded(true);
        } else {
          setMapError('Google Maps API carregada mas não está disponível');
        }
      };
      script.onerror = (error) => {
        console.error('Erro ao carregar Google Maps API:', error);
        setMapError('Falha ao carregar a API do Google Maps. Verifique sua chave de API.');
      };
      document.head.appendChild(script);
    };

    loadGoogleMaps();
  }, [googleMapsApiKey]);

  // Inicializar mapa quando Google Maps carregar
  useEffect(() => {
    if (!isGoogleMapsLoaded || !mapRef.current || map) return;

    // Verificar se o Google Maps está realmente disponível
    if (!window.google || !window.google.maps) {
      setMapError('Google Maps API não está disponível');
      return;
    }

    try {
      console.log('Inicializando Google Maps...');
      
      // Posição padrão (centro do Brasil)
      const defaultCenter = { lat: -15.7942, lng: -47.8825 };

      const newMap = new window.google.maps.Map(mapRef.current, {
        zoom: 6,
        center: defaultCenter,
        mapTypeId: window.google.maps.MapTypeId.ROADMAP,
        styles: [
          {
            featureType: 'all',
            elementType: 'geometry.fill',
            stylers: [{ color: '#f5f5f5' }]
          },
          {
            featureType: 'water',
            elementType: 'geometry',
            stylers: [{ color: '#c9e2f0' }]
          }
        ]
      });

      console.log('Mapa inicializado com sucesso');
      setMap(newMap);
    } catch (error) {
      console.error('Erro ao inicializar mapa:', error);
      setMapError(`Erro ao inicializar o mapa: ${error.message || 'Erro desconhecido'}`);
    }
  }, [isGoogleMapsLoaded, map]);

  // Atualizar mapa com pontos de rastreamento
  useEffect(() => {
    if (!map || !trackingPoints.length) return;

    // Limpar marcadores existentes
    if (map.markers) {
      map.markers.forEach((marker: any) => marker.setMap(null));
    }
    if (map.polyline) {
      map.polyline.setMap(null);
    }

    const markers: any[] = [];
    const path: any[] = [];

    // Criar marcadores para cada ponto
    trackingPoints.forEach((point, index) => {
      const position = { lat: point.latitude, lng: point.longitude };
      path.push(position);

      let icon;
      let title;

      if (index === 0) {
        // Primeiro ponto (origem)
        icon = {
          url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="16" cy="16" r="12" fill="#10B981" stroke="white" stroke-width="2"/>
              <circle cx="16" cy="16" r="4" fill="white"/>
            </svg>
          `),
          scaledSize: new window.google.maps.Size(32, 32),
          anchor: new window.google.maps.Point(16, 16),
        };
        title = 'Ponto de Origem';
      } else if (index === trackingPoints.length - 1) {
        // Último ponto (posição atual)
        icon = {
          url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="16" cy="16" r="12" fill="#3B82F6" stroke="white" stroke-width="2"/>
              <circle cx="16" cy="16" r="4" fill="white"/>
            </svg>
          `),
          scaledSize: new window.google.maps.Size(32, 32),
          anchor: new window.google.maps.Point(16, 16),
        };
        title = 'Posição Atual';
      } else {
        // Pontos intermediários
        icon = {
          url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="8" cy="8" r="6" fill="#6B7280" stroke="white" stroke-width="1"/>
            </svg>
          `),
          scaledSize: new window.google.maps.Size(16, 16),
          anchor: new window.google.maps.Point(8, 8),
        };
        title = `Ponto ${index + 1}`;
      }

      const marker = new window.google.maps.Marker({
        position,
        map,
        icon,
        title,
      });

      // InfoWindow com informações do ponto
      const infoWindow = new window.google.maps.InfoWindow({
        content: `
          <div style="padding: 8px;">
            <h4 style="margin: 0 0 8px 0; font-weight: 600;">${title}</h4>
            <p style="margin: 0; font-size: 12px; color: #666;">
              ${new Date(point.createdAt).toLocaleString('pt-BR')}
            </p>
            <p style="margin: 4px 0 0 0; font-size: 11px; color: #888;">
              ${point.latitude.toFixed(6)}, ${point.longitude.toFixed(6)}
            </p>
          </div>
        `,
      });

      marker.addListener('click', () => {
        // Fechar outras InfoWindows
        markers.forEach(m => m.infoWindow?.close());
        infoWindow.open(map, marker);
      });

      marker.infoWindow = infoWindow;
      markers.push(marker);
    });

    // Criar linha conectando os pontos
    if (path.length > 1) {
      const polyline = new window.google.maps.Polyline({
        path,
        geodesic: true,
        strokeColor: '#3B82F6',
        strokeOpacity: 1.0,
        strokeWeight: 3,
      });

      polyline.setMap(map);
      map.polyline = polyline;
    }

    // Ajustar zoom para mostrar todos os pontos
    if (path.length > 0) {
      const bounds = new window.google.maps.LatLngBounds();
      path.forEach(point => bounds.extend(point));
      map.fitBounds(bounds);

      // Garantir zoom mínimo
      const listener = window.google.maps.event.addListener(map, 'idle', () => {
        if (map.getZoom() > 15) map.setZoom(15);
        window.google.maps.event.removeListener(listener);
      });
    }

    // Salvar referência dos marcadores
    map.markers = markers;
  }, [map, trackingPoints]);

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
              setMap(null);
            }}
            className="mt-2 px-3 py-1 bg-blue-500 text-white text-xs rounded hover:bg-blue-600"
          >
            Tentar novamente
          </button>
        </div>
      </div>
    );
  }

  if (!googleMapsApiKey) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gray-100">
        <div className="text-center p-4">
          <div className="text-4xl mb-3">⚙️</div>
          <p className="text-sm text-yellow-600 font-medium mb-2">Configuração necessária</p>
          <p className="text-xs text-gray-600 mb-3 max-w-md">
            A chave da API do Google Maps não foi configurada.
          </p>
          <p className="text-xs text-blue-600">
            Acesse Configurações → Google Maps API Key para configurar.
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
      <div ref={mapRef} className="w-full h-full" />
      
      {/* Indicador de status */}
      <div className="absolute top-2 right-2 bg-white rounded-lg shadow-md p-2 border">
        <div className="flex items-center text-xs text-gray-600">
          {trackingPoints.length > 0 ? (
            <>
              <div className="w-2 h-2 bg-green-500 rounded-full mr-2 animate-pulse"></div>
              Rastreando ({trackingPoints.length} pontos)
            </>
          ) : (
            <>
              <div className="w-2 h-2 bg-yellow-500 rounded-full mr-2"></div>
              Aguardando rastreamento
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
                <div className="w-4 h-4 bg-green-500 rounded-full mr-2"></div>
                <span>Origem</span>
              </div>
              <div className="flex items-center">
                <div className="w-4 h-4 bg-blue-500 rounded-full mr-2"></div>
                <span>Posição Atual</span>
              </div>
              <div className="flex items-center">
                <div className="w-3 h-3 bg-gray-400 rounded-full mr-2"></div>
                <span>Trajeto</span>
              </div>
            </>
          ) : (
            <div className="text-center">
              <div className="text-2xl mb-1">📍</div>
              <p className="text-gray-600 font-medium">Aguardando dados</p>
              <p className="text-gray-500 text-xs mt-1">
                O rastreamento aparecerá quando o pedido estiver em rota
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
