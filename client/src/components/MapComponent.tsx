import React from "react";
import { GoogleMap, Marker, useJsApiLoader } from "@react-google-maps/api";

type Props = {
  lat: number;
  lng: number;
};

const containerStyle = {
  width: "100%",
  height: "420px",
};

const MapComponent: React.FC<Props> = ({ lat, lng }) => {
  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: "AIzaSyBS_TMgZfqMle79oUmh_GwV-u22wo1C4T4",
  });

  const center = { lat, lng };

  if (!isLoaded) return <div>Carregando mapa...</div>;

  return (
    <GoogleMap mapContainerStyle={containerStyle} center={center} zoom={15}>
      <Marker position={center} />
    </GoogleMap>
  );
};

export default MapComponent;
