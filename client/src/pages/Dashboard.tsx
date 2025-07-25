import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { 
  ShoppingCart, 
  Clock, 
  Truck, 
  CheckCircle, 
  Edit,
  Plus,
  FileText,
  Building,
  MapPin,
  AlertTriangle
} from "lucide-react";
import { getStatusColor, formatDate } from "@/lib/utils";
import type { Order, Product, Company } from "@shared/schema";
import { OrderDetailDrawer } from "@/components/OrderDetailDrawer";
import { DashboardTrackingMap } from "@/components/DashboardTrackingMap";

export default function Dashboard() {
  const [showOrdersCard, setShowOrdersCard] = useState(true);
  const [showTrackingCard, setShowTrackingCard] = useState(true);

  // Estado para controlar o drawer de detalhes do pedido
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null);

  const { data: orders = [], isLoading: ordersLoading } = useQuery<Order[]>({
    queryKey: ["/api/orders"],
  });

  // Buscar produtos para exibir os nomes corretamente
  const { data: products = [] } = useQuery<Product[]>({
    queryKey: ["/api/products"],
  });

  // Buscar empresas para exibir os nomes dos fornecedores
  const { data: companies = [] } = useQuery<Company[]>({
    queryKey: ["/api/companies"],
  });

  // Calculate only pending stats for alert
  const pendingCount = orders.filter(o => o.status === "Em Aprovação").length;

  // Recent orders (last 5)
  const recentOrders = orders
    .sort((a, b) => new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime())
    .slice(0, 5);

  // Função para abrir o drawer de detalhes do pedido
  const handleOpenDetails = (order: Order) => {
    setSelectedOrderId(order.id);
    setDrawerOpen(true);
  };

  // Função para abrir drawer pelo ID do pedido (para o mapa)
  const handleOpenOrderById = (orderId: number) => {
    setSelectedOrderId(orderId);
    setDrawerOpen(true);
  };

  if (ordersLoading) {
    return <DashboardSkeleton />;
  }

  return (
    <div className="space-y-8">
      {/* Drawer para detalhes do pedido */}
      <OrderDetailDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        orderId={selectedOrderId}
      />

      {/* Removidos botões de ação rápida para manter o layout limpo */}
      {/* Conteúdo Principal em Coluna */}
      <div className="flex flex-col space-y-8">
        {/* Pending Approvals Alert */}
        {pendingCount > 0 && (
          <Card className="bg-gradient-to-r from-yellow-600 to-orange-600 text-white">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-semibold">Aprovações Pendentes</h4>
                <AlertTriangle size={20} />
              </div>
              <p className="text-sm opacity-90 mb-4">
                {pendingCount} pedidos urgentes aguardando aprovação
              </p>
              <Button 
                variant="secondary" 
                size="sm"
                className="bg-white/20 hover:bg-white/30 text-white border-0"
              >
                Revisar Agora
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Recent Orders Table */}
        <Card className="rounded-lg border text-card-foreground shadow-sm bg-card border-border">
          <CardHeader 
            className="space-y-1.5 p-6 border-b border-border cursor-pointer hover:bg-muted/50 transition-colors"
            onClick={() => setShowOrdersCard(!showOrdersCard)}
          >
            <div className="flex flex-row items-center justify-between">
              <CardTitle className="text-foreground">Pedidos Recentes</CardTitle>
              <div className="text-muted-foreground">
                {showOrdersCard ? '−' : '+'}
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {showOrdersCard && (
              <>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader className="bg-muted">
                      <TableRow>
                        <TableHead className="text-muted-foreground">ID</TableHead>
                        <TableHead className="text-muted-foreground">Produto</TableHead>
                        <TableHead className="text-muted-foreground">Status</TableHead>
                        <TableHead className="text-muted-foreground">Data de Entrega</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {recentOrders.map((order) => {
                        const product = products.find(
                          (p) => p.id === order.productId,
                        );

                        return (
                          <TableRow 
                            key={order.id} 
                            className="cursor-pointer hover:bg-muted/50 transition-colors"
                            onClick={() => handleOpenDetails(order)}
                          >
                            <TableCell className="font-mono text-sm text-foreground">
                              {order.orderId}
                            </TableCell>
                            <TableCell className="text-foreground">
                              {product?.name || `Produto ID: ${order.productId}`}
                            </TableCell>
                            <TableCell>
                              <Badge className={getStatusColor(order.status)}>
                                {order.status}
                              </Badge>
                              {order.isUrgent && (
                                <Badge variant="destructive" className="ml-2">
                                  <AlertTriangle size={12} className="mr-1" />
                                  Urgente
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {formatDate(order.deliveryDate)}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
                {/* Removido botão "Ver todos os pedidos" para manter o layout limpo */}
              </>
            )}
          </CardContent>
        </Card>

        {/* Map Placeholder */}
        <Card className="rounded-lg border text-card-foreground shadow-sm bg-card border-border">
          <CardHeader 
            className="space-y-1.5 p-6 border-b border-border cursor-pointer hover:bg-muted/50 transition-colors"
            onClick={() => setShowTrackingCard(!showTrackingCard)}
          >
            <div className="flex flex-row items-center justify-between">
              <CardTitle className="text-foreground">Rastreamento</CardTitle>
              <div className="text-muted-foreground">
                {showTrackingCard ? '−' : '+'}
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-6">
            {showTrackingCard && (
              <DashboardTrackingMap onOrderClick={handleOpenOrderById} />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

interface StatsCardProps {
  title: string;
  value: number;
  icon: React.ElementType;
  iconColor?: string;
  change?: string;
  changeLabel?: string;
}

function StatsCard({ title, value, icon: Icon, iconColor = "text-primary", change, changeLabel }: StatsCardProps) {
  return (
    <Card className="bg-card border-border">
      <CardContent className="p-6 pt-[4px] pb-[4px]">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-muted-foreground text-sm">{title}</p>
            <p className="text-3xl font-bold text-foreground mt-1">{value}</p>
          </div>
          <div className={`p-3 rounded-xl bg-opacity-20 ${iconColor.includes('primary') ? 'bg-primary' : iconColor.includes('yellow') ? 'bg-yellow-500' : iconColor.includes('green') ? 'bg-green-500' : 'bg-primary'}`}>
            <Icon className={`${iconColor} text-xl`} size={24} />
          </div>
        </div>
        {change && changeLabel && (
          <div className="mt-4 flex items-center text-sm">
            <span className={change.startsWith('+') ? 'text-green-500' : 'text-muted-foreground'}>
              {change}
            </span>
            <span className="text-muted-foreground ml-2">{changeLabel}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[...Array(4)].map((_, i) => (
          <Card key={i} className="bg-card border-border">
            <CardContent className="p-6">
              <Skeleton className="h-4 w-24 mb-2" />
              <Skeleton className="h-8 w-16 mb-4" />
              <Skeleton className="h-3 w-32" />
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          <Card className="bg-card border-border">
            <CardContent className="p-6">
              <Skeleton className="h-6 w-48 mb-4" />
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-8">
          <Card className="bg-card border-border">
            <CardContent className="p-6">
              <Skeleton className="h-6 w-32 mb-4" />
              <div className="space-y-3">
                {[...Array(4)].map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}