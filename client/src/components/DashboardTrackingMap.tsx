import React, { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { MapPin, Truck, AlertCircle } from "lucide-react";
import { formatDate } from "@/lib/utils";
import type { Order, Product, Company } from "@shared/schema";
import MapComponent, { generateColorFromId } from "./MapComponent";

type TrackingPoint = {
  id: number;
  orderId: number;
  latitude: number;
  longitude: number;
  createdAt: string;
  status?: string;
  comment?: string;
};

type Unit = {
  id: number;
  name: string;
  abbreviation: string;
};

type DashboardTrackingData = {
  order: Order;
  product?: Product;
  company?: Company;
  unit?: Unit;
  lastTrackingPoint?: TrackingPoint;
  color?: string;
};

interface DashboardTrackingMapProps {
  onOrderClick?: (orderId: number) => void;
}

export function DashboardTrackingMap({ onOrderClick }: DashboardTrackingMapProps) {
  const [trackingData, setTrackingData] = useState<DashboardTrackingData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Buscar pedidos
  const { data: orders = [] } = useQuery<Order[]>({
    queryKey: ["/api/orders"],
  });

  // Buscar produtos
  const { data: products = [] } = useQuery<Product[]>({
    queryKey: ["/api/products"],
  });

  // Buscar empresas
  const { data: companies = [] } = useQuery<Company[]>({
    queryKey: ["/api/companies"],
  });

  // Buscar unidades
  const { data: units = [] } = useQuery<Unit[]>({
    queryKey: ["/api/units"],
    queryFn: async () => {
      const response = await fetch("/api/units");
      if (!response.ok) throw new Error("Falha ao carregar unidades");
      return response.json();
    },
  });

  // Filtrar pedidos "Em Rota" e "Em transporte"
  const ordersInRoute = orders.filter(
    order => order.status === "Em Rota" || order.status === "Em transporte"
  );

  // Buscar pontos de rastreamento para todos os pedidos em rota
  useEffect(() => {
    const fetchAllTrackingData = async () => {
      if (ordersInRoute.length === 0) {
        setTrackingData([]);
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        setError(null);

        const trackingPromises = ordersInRoute.map(async (order) => {
          try {
            const response = await fetch(`/api/tracking-points/${order.id}`);
            if (!response.ok) {
              console.warn(`Erro ao buscar tracking para pedido ${order.id}`);
              return null;
            }

            const trackingPoints: TrackingPoint[] = await response.json();

            // Pegar o último ponto de rastreamento
            const lastPoint = trackingPoints.length > 0 
              ? trackingPoints[trackingPoints.length - 1] 
              : null;

            const product = products.find(p => p.id === order.productId);
            const company = companies.find(c => c.id === order.supplierId);
            const unit = units.find(u => u.id === product?.unitId);

            return {
              order,
              product,
              company,
              unit,
              lastTrackingPoint: lastPoint || undefined,
              color: generateColorFromId(order.id),
            };
          } catch (error) {
            console.warn(`Erro ao processar pedido ${order.id}:`, error);
            return null;
          }
        });

        const results = await Promise.all(trackingPromises);
        const validResults: DashboardTrackingData[] = [];

        for (const result of results) {
          if (result && result.lastTrackingPoint) {
            validResults.push(result);
          }
        }

        setTrackingData(validResults);
      } catch (error) {
        console.error("Erro ao buscar dados de rastreamento:", error);
        setError("Erro ao carregar dados de rastreamento");
      } finally {
        setIsLoading(false);
      }
    };

    fetchAllTrackingData();
  }, [ordersInRoute.length, products.length, companies.length, units.length]);

  // Atualização automática a cada 3000 segundos (50 minutos)
  useEffect(() => {
    const interval = setInterval(() => {
      if (ordersInRoute.length > 0) {
        // Reexecutar a busca de dados
        window.location.reload();
      }
    }, 3000000); // 3000 segundos = 3.000.000 milissegundos

    return () => clearInterval(interval);
  }, [ordersInRoute.length]);

  // Preparar markers para o mapa
  const markers = trackingData.map((data) => ({
    id: data.order.id,
    lat: data.lastTrackingPoint!.latitude,
    lng: data.lastTrackingPoint!.longitude,
    title: `Pedido ${data.order.orderId}`,
    content: `${data.product?.name || 'Produto'} - ${data.order.status}`,
    orderId: data.order.orderId,
    status: data.order.status,
    color: data.color,
  }));

  // Calcular centro e zoom do mapa baseado em todas as cargas
  const mapSettings = React.useMemo(() => {
    if (markers.length === 0) {
      return { 
        center: { lat: -14.235, lng: -51.9253 }, // Centro do Brasil como fallback
        zoom: 6 
      };
    }

    if (markers.length === 1) {
      return {
        center: { lat: markers[0].lat, lng: markers[0].lng },
        zoom: 12
      };
    }

    // Calcular bounding box (maior e menor latitude/longitude)
    const latitudes = markers.map(marker => marker.lat);
    const longitudes = markers.map(marker => marker.lng);

    const minLat = Math.min(...latitudes);
    const maxLat = Math.max(...latitudes);
    const minLng = Math.min(...longitudes);
    const maxLng = Math.max(...longitudes);

    // Calcular centro do bounding box
    const centerLat = (minLat + maxLat) / 2;
    const centerLng = (minLng + maxLng) / 2;

    // Calcular diferenças para determinar zoom apropriado
    const latDiff = maxLat - minLat;
    const lngDiff = maxLng - minLng;
    const maxDiff = Math.max(latDiff, lngDiff);

    // Calcular zoom baseado na diferença (com margem de segurança)
    let zoom = 10; // zoom padrão
    if (maxDiff > 10) zoom = 4;       // muito distante
    else if (maxDiff > 5) zoom = 5;   // distante
    else if (maxDiff > 2) zoom = 6;   // médio-distante
    else if (maxDiff > 1) zoom = 7;   // médio
    else if (maxDiff > 0.5) zoom = 8; // próximo
    else if (maxDiff > 0.2) zoom = 9; // muito próximo
    else zoom = 10;                   // bem próximo

    return {
      center: { lat: centerLat, lng: centerLng },
      zoom: zoom
    };
  }, [markers]);

  const handleMarkerClick = (marker: any) => {
    if (onOrderClick) {
      onOrderClick(parseInt(marker.orderId));
    }
  };

  // Buscar configurações do sistema para obter a chave da API do Google Maps
  const { data: settings = [] } = useQuery({
    queryKey: ['/api/settings'],
    queryFn: async () => {
      const response = await fetch('/api/settings');
      if (!response.ok) throw new Error('Falha ao carregar configurações');
      return response.json();
    },
  });

  // Extrair chave da API do Google Maps das configurações do keyuser
  const googleMapsApiKey = React.useMemo(() => {
    if (settings && settings.length > 0) {
      const googleMapsKeySetting = settings.find((setting: any) => setting.key === 'google_maps_api_key');
      return googleMapsKeySetting ? googleMapsKeySetting.value : null;
    }
    return null;
  }, [settings]);

  if (!googleMapsApiKey || googleMapsApiKey.trim() === '') {
    return (
      <div className="bg-input rounded-xl h-48 flex items-center justify-center border border-border">
        <div className="text-center">
          <AlertCircle className="mx-auto text-4xl text-yellow-500 mb-3" size={48} />
          <p className="text-muted-foreground font-medium">API do Google Maps não configurada</p>
          <p className="text-muted-foreground text-sm mt-1">
            Solicite ao keyuser para configurar a chave da API do Google Maps no sistema.
          </p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="bg-input rounded-xl h-48 flex items-center justify-center border border-border">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
          <p className="text-muted-foreground">Carregando rastreamento...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-input rounded-xl h-48 flex items-center justify-center border border-border">
        <div className="text-center">
          <AlertCircle className="mx-auto text-4xl text-destructive mb-3" size={48} />
          <p className="text-destructive font-medium">Erro ao carregar</p>
          <p className="text-muted-foreground text-sm mt-1">{error}</p>
        </div>
      </div>
    );
  }

  if (ordersInRoute.length === 0) {
    return (
      <div className="bg-input rounded-xl h-48 flex items-center justify-center border border-border">
        <div className="text-center">
          <Truck className="mx-auto text-4xl text-muted-foreground mb-3" size={48} />
          <p className="text-muted-foreground font-medium">Nenhuma carga em trânsito</p>
          <p className="text-muted-foreground text-sm mt-1">
            As cargas "Em Rota" aparecerão aqui quando houver rastreamento ativo
          </p>
        </div>
      </div>
    );
  }

  if (markers.length === 0) {
    return (
      <div className="bg-input rounded-xl h-48 flex items-center justify-center border border-border">
        <div className="text-center">
          <MapPin className="mx-auto text-4xl text-yellow-500 mb-3" size={48} />
          <p className="text-muted-foreground font-medium">
            {ordersInRoute.length} carga{ordersInRoute.length > 1 ? 's' : ''} em trânsito
          </p>
          <p className="text-muted-foreground text-sm mt-1">
            Aguardando pontos de rastreamento...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Mapa */}
      <div className="border rounded-lg overflow-hidden" style={{ height: '400px' }}>
        <MapComponent
          lat={mapSettings.center.lat}
          lng={mapSettings.center.lng}
          zoom={mapSettings.zoom}
          markers={markers}
          onMarkerClick={handleMarkerClick}
        />
      </div>

      {/* Estatísticas */}
      <div className="flex justify-between text-sm text-muted-foreground">
        <div className="flex items-center">
          <div className="w-3 h-3 bg-blue-500 rounded-full mr-2"></div>
          <span>{markers.length} carga{markers.length > 1 ? 's' : ''} rastreada{markers.length > 1 ? 's' : ''}</span>
        </div>
        <div className="flex items-center">
          <div className="w-3 h-3 bg-yellow-500 rounded-full mr-2"></div>
          <span>{ordersInRoute.length - markers.length} aguardando rastreamento</span>
        </div>
      </div>

      {/* Lista resumida das cargas com cores correspondentes */}
      {markers.length > 0 && (
        <div className="border rounded-lg p-3 bg-background">
          <h4 className="font-medium text-sm mb-2">Cargas em Trânsito</h4>
          <div className="space-y-1 max-h-32 overflow-y-auto">
            {trackingData.map((data) => (
              <div 
                key={data.order.id} 
                className="flex items-center justify-between text-xs cursor-pointer hover:bg-gray-50 p-1 rounded"
                onClick={() => onOrderClick?.(data.order.id)}
              >
                <div className="flex items-center">
                  {/* Círculo colorido sem número */}
                  <div 
                    className="w-6 h-6 rounded-full mr-2 border-2 border-white shadow-sm"
                    style={{ backgroundColor: data.color }}
                  ></div>
                  <span className="font-medium">{data.order.orderId}</span>
                </div>
                <span className="text-muted-foreground truncate ml-2">
                  {data.product?.name || 'Produto'} - {data.order.quantity}{data.unit?.abbreviation || ''}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}