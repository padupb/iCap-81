import React, { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  ChevronLeft, 
  ChevronRight, 
  Calendar,
  AlertTriangle
} from "lucide-react";
import { getStatusColor } from "@/lib/utils";
import type { Order, Product, Company, Unit } from "@shared/schema";
import { OrderDetailDrawer } from "@/components/OrderDetailDrawer";

const DAYS_TO_SHOW = 7;
const dayNames = ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SÁB"];
const monthNames = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];

function getDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function formatNumber(value: string | number | undefined | null): string {
  if (value === undefined || value === null) return "0";
  const numValue = typeof value === "string" ? parseFloat(value) : value;
  if (isNaN(numValue)) return "0";
  return numValue.toLocaleString("pt-BR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

export default function Dashboard() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null);
  const [weekOffset, setWeekOffset] = useState(0);
  const [showForecast, setShowForecast] = useState(true);

  const { data: orders = [], isLoading: ordersLoading } = useQuery<Order[]>({
    queryKey: ["/api/orders"],
  });

  const { data: products = [] } = useQuery<Product[]>({
    queryKey: ["/api/products"],
  });

  const { data: companies = [] } = useQuery<Company[]>({
    queryKey: ["/api/companies"],
  });

  const { data: units = [] } = useQuery<Unit[]>({
    queryKey: ["/api/units"],
  });

  const pendingCount = orders.filter(o => o.status === "Em Aprovação").length;

  const weekDates = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const startDate = new Date(today);
    startDate.setDate(startDate.getDate() + (weekOffset * DAYS_TO_SHOW));
    
    const dates: Date[] = [];
    for (let i = 0; i < DAYS_TO_SHOW; i++) {
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + i);
      dates.push(date);
    }
    return dates;
  }, [weekOffset]);

  const headerMonthYear = useMemo(() => {
    const firstDate = weekDates[0];
    const lastDate = weekDates[weekDates.length - 1];
    
    if (firstDate.getMonth() === lastDate.getMonth()) {
      return `${monthNames[firstDate.getMonth()]} ${firstDate.getFullYear()}`;
    }
    
    if (firstDate.getFullYear() === lastDate.getFullYear()) {
      return `${monthNames[firstDate.getMonth()].substring(0, 3)} - ${monthNames[lastDate.getMonth()].substring(0, 3)} ${firstDate.getFullYear()}`;
    }
    
    return `${monthNames[firstDate.getMonth()].substring(0, 3)} ${firstDate.getFullYear()} - ${monthNames[lastDate.getMonth()].substring(0, 3)} ${lastDate.getFullYear()}`;
  }, [weekDates]);

  const filteredOrders = useMemo(() => {
    const startKey = getDateKey(weekDates[0]);
    const endKey = getDateKey(weekDates[weekDates.length - 1]);
    
    return orders.filter(order => {
      const deliveryDate = order.deliveryDate || (order as any).delivery_date;
      if (!deliveryDate) return false;
      
      const date = new Date(deliveryDate);
      const dateKey = getDateKey(date);
      
      const statusesToExclude = ["Cancelado", "Suspenso", "Entregue"];
      if (statusesToExclude.includes(order.status)) return false;
      
      return dateKey >= startKey && dateKey <= endKey;
    });
  }, [orders, weekDates]);

  const productsWithOrders = useMemo(() => {
    const productIds = new Set(filteredOrders.map(o => o.productId || (o as any).product_id));
    return products.filter(p => productIds.has(p.id)).sort((a, b) => a.name.localeCompare(b.name));
  }, [filteredOrders, products]);

  const ordersByProductAndDate = useMemo(() => {
    const map: Record<string, Order[]> = {};
    
    filteredOrders.forEach(order => {
      const productId = order.productId || (order as any).product_id;
      const deliveryDate = order.deliveryDate || (order as any).delivery_date;
      if (!deliveryDate) return;
      
      const date = new Date(deliveryDate);
      const key = `${productId}-${getDateKey(date)}`;
      
      if (!map[key]) {
        map[key] = [];
      }
      map[key].push(order);
    });
    
    return map;
  }, [filteredOrders]);

  const handleOpenDetails = (orderId: number) => {
    setSelectedOrderId(orderId);
    setDrawerOpen(true);
  };

  const goToToday = () => setWeekOffset(0);
  const goToPreviousWeek = () => setWeekOffset(prev => prev - 1);
  const goToNextWeek = () => setWeekOffset(prev => prev + 1);

  const isToday = (date: Date) => {
    const today = new Date();
    return date.getDate() === today.getDate() &&
           date.getMonth() === today.getMonth() &&
           date.getFullYear() === today.getFullYear();
  };

  const getSupplierName = (order: Order) => {
    const supplierId = order.supplierId || (order as any).supplier_id;
    const company = companies.find(c => c.id === supplierId);
    return company?.name || "Fornecedor";
  };

  const getOrderQuantityWithUnit = (order: Order, product: Product | undefined) => {
    const unit = product ? units.find(u => u.id === product.unitId) : null;
    const quantity = formatNumber(order.quantity);
    return `${quantity} ${unit?.abbreviation || ""}`.trim();
  };

  if (ordersLoading) {
    return <DashboardSkeleton />;
  }

  return (
    <div className="space-y-6">
      <OrderDetailDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        orderId={selectedOrderId}
      />

      <div className="flex flex-col space-y-6">
        {pendingCount > 0 && (
          <Card className="bg-gradient-to-r from-yellow-600 to-orange-600 text-white">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <AlertTriangle size={20} />
                  <div>
                    <h4 className="font-semibold">Aprovações Pendentes</h4>
                    <p className="text-sm opacity-90">
                      {pendingCount} pedidos urgentes aguardando aprovação
                    </p>
                  </div>
                </div>
                <Button 
                  variant="secondary" 
                  size="sm"
                  className="bg-white/20 hover:bg-white/30 text-white border-0"
                >
                  Revisar
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        <Card className="border-border">
          <CardHeader 
            className="pb-2 cursor-pointer hover:bg-muted/50 transition-colors"
            onClick={() => setShowForecast(!showForecast)}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Calendar className="h-5 w-5 text-muted-foreground" />
                <CardTitle className="text-lg">Previsão de Recebimento</CardTitle>
              </div>
              <div className="text-muted-foreground">
                {showForecast ? '−' : '+'}
              </div>
            </div>
          </CardHeader>
          {showForecast && (
            <CardContent className="p-0">
              <div className="px-4 py-2 border-b border-border flex items-center gap-4">
                <Button variant="outline" size="sm" onClick={goToToday}>
                  Hoje
                </Button>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={goToPreviousWeek}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={goToNextWeek}>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
                <span className="font-medium text-sm">{headerMonthYear}</span>
              </div>
              <div className="overflow-x-auto">
                <div className="min-w-[800px]">
                  <div className="grid" style={{ gridTemplateColumns: `180px repeat(${DAYS_TO_SHOW}, 1fr)` }}>
                    <div className="border-b border-r border-border bg-muted/50 p-2 font-medium text-sm text-muted-foreground">
                      Produto
                    </div>
                    {weekDates.map((date, index) => (
                      <div
                        key={index}
                        className={`border-b border-r border-border p-2 text-center ${
                          isToday(date) ? "bg-primary/10" : "bg-muted/50"
                        }`}
                      >
                        <div className="text-xs text-muted-foreground">
                          {dayNames[date.getDay()]}
                        </div>
                        <div className={`text-base font-semibold ${isToday(date) ? "text-primary" : ""}`}>
                          {date.getDate()}
                        </div>
                      </div>
                    ))}

                    {productsWithOrders.length === 0 ? (
                      <div 
                        className="p-6 text-center text-muted-foreground"
                        style={{ gridColumn: `1 / span ${DAYS_TO_SHOW + 1}` }}
                      >
                        <Calendar className="h-10 w-10 mx-auto mb-3 opacity-50" />
                        <p className="text-sm">Nenhuma entrega prevista para este período</p>
                      </div>
                    ) : (
                      productsWithOrders.map((product) => (
                        <React.Fragment key={product.id}>
                          <div className="border-b border-r border-border p-2 bg-card">
                            <div className="font-medium text-xs truncate" title={product.name}>
                              {product.name}
                            </div>
                          </div>
                          {weekDates.map((date, dateIndex) => {
                            const cellKey = `${product.id}-${getDateKey(date)}`;
                            const ordersForCell = ordersByProductAndDate[cellKey] || [];
                            
                            return (
                              <div
                                key={`cell-${product.id}-${dateIndex}`}
                                className={`border-b border-r border-border p-1 min-h-[60px] ${
                                  isToday(date) ? "bg-primary/5" : ""
                                }`}
                              >
                                <div className="space-y-1">
                                  {ordersForCell.map((order) => {
                                    const orderId = order.orderId || (order as any).order_id || `PED-${order.id}`;
                                    return (
                                      <div
                                        key={order.id}
                                        onClick={() => handleOpenDetails(order.id)}
                                        className="p-1.5 rounded bg-card border border-border hover:bg-muted/50 cursor-pointer transition-colors text-xs flex items-center justify-between gap-1"
                                      >
                                        <div className="flex-1 min-w-0">
                                          <div className="font-medium truncate text-foreground" title={orderId}>
                                            {orderId}
                                          </div>
                                          <div className="text-muted-foreground truncate text-[10px]" title={getSupplierName(order)}>
                                            {getSupplierName(order)} • {getOrderQuantityWithUnit(order, product)}
                                          </div>
                                        </div>
                                        <Badge 
                                          variant="outline" 
                                          className={`text-[9px] px-1 py-0 h-4 shrink-0 ${getStatusColor(order.status)}`}
                                        >
                                          {order.status.length > 8 ? order.status.substring(0, 8) + "…" : order.status}
                                        </Badge>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            );
                          })}
                        </React.Fragment>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          )}
        </Card>
      </div>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <Card className="bg-muted/20">
        <CardContent className="p-4">
          <Skeleton className="h-5 w-48 mb-2 bg-muted" />
          <Skeleton className="h-4 w-64 bg-muted" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <Skeleton className="h-6 w-48 bg-muted" />
        </CardHeader>
        <CardContent className="p-0">
          <Skeleton className="h-[300px] w-full bg-muted" />
        </CardContent>
      </Card>
    </div>
  );
}
