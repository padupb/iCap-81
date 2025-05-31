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

type DashboardTrackingData = {
  order: Order;
  product?: Product;
  company?: Company;
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

            return {
              order,
              product,
              company,
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
  }, [ordersInRoute.length, products.length, companies.length]);

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
    title: `Pedido #${data.order.id}`,
    content: `${data.product?.name || 'Produto'} - ${data.order.status}`,
    orderId: data.order.id.toString(),
    status: data.order.status,
    color: data.color,
  }));

  // Calcular centro do mapa baseado nos markers
  const center = React.useMemo(() => {
    if (markers.length === 0) {
      return { lat: -14.235, lng: -51.9253 }; // Centro do Brasil como fallback
    }

    const avgLat = markers.reduce((sum, marker) => sum + marker.lat, 0) / markers.length;
    const avgLng = markers.reduce((sum, marker) => sum + marker.lng, 0) / markers.length;
    
    return { lat: avgLat, lng: avgLng };
  }, [markers]);

  const handleMarkerClick = (marker: any) => {
    if (onOrderClick) {
      onOrderClick(parseInt(marker.orderId));
    }
  };

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
          lat={center.lat}
          lng={center.lng}
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
                  {/* Círculo colorido com número do pedido */}
                  <div 
                    className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold mr-2 border-2 border-white shadow-sm"
                    style={{ backgroundColor: data.color }}
                  >
                    {data.order.id}
                  </div>
                  <span className="font-medium">{data.order.orderId}</span>
                </div>
                <span className="text-muted-foreground truncate ml-2">
                  {data.product?.name || 'Produto'} → {data.order.workLocation}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
} 