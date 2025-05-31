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
      {markers.map((marker) => (
        <Marker
          key={marker.id}
          position={{ lat: marker.lat, lng: marker.lng }}
          title={marker.title}
          onClick={() => handleMarkerClick(marker)}
        />
      ))}

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

export default MapComponent;
