import React from "react";
import { GoogleMap, Marker, useJsApiLoader, InfoWindow } from "@react-google-maps/api";

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

// Função para gerar cores únicas baseadas no ID do pedido
const generateColorFromId = (id: number): string => {
  const colors = [
    '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
    '#DDA0DD', '#FF7F50', '#87CEEB', '#98D8C8', '#F7DC6F',
    '#BB8FCE', '#85C1E9', '#F8C471', '#82E0AA', '#F1948A',
    '#AED6F1', '#A9DFBF', '#F9E79F', '#D7BDE2', '#A3E4D7'
  ];
  return colors[id % colors.length];
};

// Função para criar ícone numerado com cor
const createNumberedIcon = (id: number, color: string): any => {
  const iconSvg = `
    <svg width="36" height="36" viewBox="0 0 36 36" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <filter id="shadow-${id}" x="-50%" y="-50%" width="200%" height="200%">
          <feDropShadow dx="2" dy="2" stdDeviation="2" flood-color="rgba(0,0,0,0.4)"/>
        </filter>
      </defs>
      <circle cx="18" cy="18" r="15" fill="${color}" stroke="white" stroke-width="3" filter="url(#shadow-${id})"/>
      <text x="18" y="23" text-anchor="middle" fill="white" font-family="Arial, sans-serif" font-size="12" font-weight="bold">${id}</text>
    </svg>
  `;

  return {
    url: "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(iconSvg),
    scaledSize: { width: 36, height: 36 },
    origin: { x: 0, y: 0 },
    anchor: { x: 18, y: 36 },
  };
};

// Ícone de caminhão personalizado (fallback)
const getTruckIcon = (): any => ({
  url: "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(`
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
  zoom = 15 
}) => {
  const [selectedMarker, setSelectedMarker] = React.useState<MarkerData | null>(null);

  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: "AIzaSyBS_TMgZfqMle79oUmh_GwV-u22wo1C4T4",
  });

  const center = { lat, lng };

  if (!isLoaded) return <div>Carregando mapa...</div>;

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
        const icon = marker.icon || createNumberedIcon(marker.id, color);
        
        return (
          <Marker
            key={marker.id}
            position={{ lat: marker.lat, lng: marker.lng }}
            title={marker.title}
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
            <h3 className="font-semibold text-sm mb-1">{selectedMarker.title}</h3>
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
