import React from "react";
import {
  GoogleMap,
  Marker,
  useJsApiLoader,
  InfoWindow,
} from "@react-google-maps/api";
import { useQuery } from "@tanstack/react-query";

type MarkerData = {
  id: number;
  lat: number;
  lng: number;
  title: string;
  content?: string;
  orderId?: string;
  status?: string;
  icon?: string | any;
  color?: string;
};

type Props = {
  lat: number;
  lng: number;
  markers?: MarkerData[];
  onMarkerClick?: (marker: MarkerData) => void;
  zoom?: number;
};

const containerStyle = {
  width: "100%",
  height: "500px",
};

// Função para gerar cores únicas baseadas no ID do pedido (cores escuras para contraste)
const generateColorFromId = (id: number): string => {
  const colors = [
    "#DC2626", // Vermelho escuro
    "#1D4ED8", // Azul escuro
    "#059669", // Verde escuro
    "#92400E", // Marrom
    "#1F2937", // Cinza escuro
    "#7C2D12", // Marrom avermelhado
    "#6B21A8", // Roxo escuro
    "#B45309", // Laranja escuro
    "#BE123C", // Rosa escuro
    "#064E3B", // Verde escuro 2
    "#1E3A8A", // Azul marinho
    "#7F1D1D", // Vermelho vinho
    "#365314", // Verde oliva
    "#4C1D95", // Roxo índigo
    "#831843", // Rosa vinho
    "#0F766E", // Teal escuro
    "#A16207", // Amarelo escuro
    "#9A3412", // Laranja queimado
    "#581C87", // Violeta escuro
    "#166534", // Verde floresta
  ];
  return colors[id % colors.length];
};

// Função para criar ponto colorido simples
const createColoredDot = (id: number, color: string): any => {
  const dotSvg = `
    <svg width="16" height="16" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <filter id="shadow-${id}" x="-50%" y="-50%" width="200%" height="200%">
          <feDropShadow dx="1" dy="1" stdDeviation="1" flood-color="rgba(0,0,0,0.5)"/>
        </filter>
      </defs>
      <circle cx="8" cy="8" r="6" fill="${color}" stroke="white" stroke-width="2" filter="url(#shadow-${id})"/>
    </svg>
  `;

  return {
    url: "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(dotSvg),
    scaledSize: { width: 16, height: 16 },
    origin: { x: 0, y: 0 },
    anchor: { x: 8, y: 8 },
  };
};

// Ícone de caminhão personalizado (fallback)
const getTruckIcon = (): any => ({
  url:
    "data:image/svg+xml;charset=UTF-8," +
    encodeURIComponent(`
    <svg width="40" height="40" viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <filter id="shadow" x="-50%" y="-50%" width="200%" height="200%">
          <feDropShadow dx="2" dy="2" stdDeviation="1" flood-color="rgba(0,0,0,0.3)"/>
        </filter>
      </defs>
      <g filter="url(#shadow)">
        <!-- Corpo do caminhão -->
        <rect x="4" y="12" width="24" height="12" rx="2" fill="#2563eb" stroke="white" stroke-width="2"/>
        <!-- Cabine -->
        <rect x="4" y="8" width="8" height="8" rx="1" fill="#1d4ed8" stroke="white" stroke-width="2"/>
        <!-- Rodas -->
        <circle cx="8" cy="26" r="3" fill="#374151" stroke="white" stroke-width="1"/>
        <circle cx="24" cy="26" r="3" fill="#374151" stroke="white" stroke-width="1"/>
        <!-- Detalhes -->
        <rect x="6" y="10" width="2" height="2" fill="white"/>
        <rect x="16" y="16" width="8" height="4" fill="white" opacity="0.8"/>
      </g>
    </svg>
  `),
  scaledSize: { width: 40, height: 40 },
  origin: { x: 0, y: 0 },
  anchor: { x: 20, y: 35 },
});

const MapComponent: React.FC<Props> = ({
  lat,
  lng,
  markers = [],
  onMarkerClick,
  zoom = 15,
}) => {
  const [selectedMarker, setSelectedMarker] = React.useState<MarkerData | null>(
    null,
  );

  // Buscar configurações do sistema para obter a chave da API do Google Maps
  const { data: settings = [] } = useQuery({
    queryKey: ['/api/settings'],
    queryFn: async () => {
      const response = await fetch('/api/settings');
      if (!response.ok) throw new Error('Falha ao carregar configurações');
      return response.json();
    },
  });

  // Extrair chave da API do Google Maps das configurações
  const googleMapsApiKey = React.useMemo(() => {
    if (settings && settings.length > 0) {
      const googleMapsKeySetting = settings.find((setting: any) => setting.key === 'google_maps_api_key');
      return googleMapsKeySetting ? googleMapsKeySetting.value : '';
    }
    return '';
  }, [settings]);

  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: googleMapsApiKey || "",
  });

  const center = { lat, lng };

  // Verificar se a chave da API está configurada
  if (!googleMapsApiKey) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gray-100" style={{ height: '500px' }}>
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

  if (!isLoaded) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gray-100" style={{ height: '500px' }}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-2"></div>
          <p className="text-sm text-gray-600">Carregando Google Maps...</p>
        </div>
      </div>
    );
  }

  const handleMarkerClick = (marker: MarkerData) => {
    setSelectedMarker(marker);
    if (onMarkerClick) {
      onMarkerClick(marker);
    }
  };

  return (
    <GoogleMap mapContainerStyle={containerStyle} center={center} zoom={zoom}>
      {/* Marcador principal (se não houver markers múltiplos) */}
      {markers.length === 0 && <Marker position={center} />}

      {/* Múltiplos marcadores */}
      {markers.map((marker) => {
        const color = marker.color || generateColorFromId(marker.id);
        const icon = marker.icon || createColoredDot(marker.id, color);

        return (
          <Marker
            key={marker.id}
            position={{ lat: marker.lat, lng: marker.lng }}
            title={`Pedido ${marker.orderId || marker.id}`}
            icon={icon}
            onClick={() => handleMarkerClick(marker)}
          />
        );
      })}

      {/* InfoWindow para mostrar detalhes do marcador selecionado */}
      {selectedMarker && (
        <InfoWindow
          position={{ lat: selectedMarker.lat, lng: selectedMarker.lng }}
          onCloseClick={() => setSelectedMarker(null)}
        >
          <div className="p-2 max-w-xs">
            <h3 className="font-semibold text-sm mb-1">
              {selectedMarker.title}
            </h3>
            {selectedMarker.orderId && (
              <p className="text-xs text-gray-600 mb-1">
                Pedido: {selectedMarker.orderId}
              </p>
            )}
            {selectedMarker.status && (
              <p className="text-xs text-gray-600 mb-1">
                Status: {selectedMarker.status}
              </p>
            )}
            {selectedMarker.content && (
              <p className="text-xs text-gray-700">{selectedMarker.content}</p>
            )}
          </div>
        </InfoWindow>
      )}
    </GoogleMap>
  );
};

// Exportar a função de geração de cor para uso em outros componentes
export { generateColorFromId };
export default MapComponent;
