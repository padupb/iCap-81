import React, { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronLeft, ChevronRight, Calendar } from "lucide-react";
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

export default function PrevisaoRecebimento() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null);
  const [weekOffset, setWeekOffset] = useState(0);

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

  const goToToday = () => {
    setWeekOffset(0);
  };

  const goToPreviousWeek = () => {
    setWeekOffset(prev => prev - 1);
  };

  const goToNextWeek = () => {
    setWeekOffset(prev => prev + 1);
  };

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

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case "Criado":
        return "bg-blue-500/20 text-blue-400 border-blue-500/30";
      case "Em Aprovação":
        return "bg-yellow-500/20 text-yellow-400 border-yellow-500/30";
      case "Aprovado":
        return "bg-green-500/20 text-green-400 border-green-500/30";
      case "Carregado":
        return "bg-purple-500/20 text-purple-400 border-purple-500/30";
      case "Em Rota":
      case "Em transporte":
        return "bg-orange-500/20 text-orange-400 border-orange-500/30";
      default:
        return "bg-gray-500/20 text-gray-400 border-gray-500/30";
    }
  };

  if (ordersLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-[600px] w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <OrderDetailDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        orderId={selectedOrderId}
      />

      <Card className="border-border">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="outline" size="sm" onClick={goToToday}>
                Hoje
              </Button>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" onClick={goToPreviousWeek}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" onClick={goToNextWeek}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
              <CardTitle className="text-lg font-semibold">
                {headerMonthYear}
              </CardTitle>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Calendar className="h-4 w-4" />
              <span className="text-sm">Previsão de Recebimento</span>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <div className="min-w-[800px]">
              <div className="grid" style={{ gridTemplateColumns: `200px repeat(${DAYS_TO_SHOW}, 1fr)` }}>
                <div className="border-b border-r border-border bg-muted/50 p-3 font-medium text-muted-foreground">
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
                    <div className={`text-lg font-semibold ${isToday(date) ? "text-primary" : ""}`}>
                      {date.getDate()}
                    </div>
                  </div>
                ))}

                {productsWithOrders.length === 0 ? (
                  <div 
                    className="col-span-full p-8 text-center text-muted-foreground"
                    style={{ gridColumn: `1 / span ${DAYS_TO_SHOW + 1}` }}
                  >
                    <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>Nenhuma entrega prevista para este período</p>
                  </div>
                ) : (
                  productsWithOrders.map((product) => (
                    <React.Fragment key={product.id}>
                      <div className="border-b border-r border-border p-3 bg-card">
                        <div className="font-medium text-sm truncate" title={product.name}>
                          {product.name}
                        </div>
                      </div>
                      {weekDates.map((date, dateIndex) => {
                        const cellKey = `${product.id}-${getDateKey(date)}`;
                        const ordersForCell = ordersByProductAndDate[cellKey] || [];
                        
                        return (
                          <div
                            key={`cell-${product.id}-${dateIndex}`}
                            className={`border-b border-r border-border p-1 min-h-[80px] ${
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
                                    className="p-2 rounded-md bg-card border border-border hover:bg-muted/50 cursor-pointer transition-colors text-xs"
                                  >
                                    <div className="font-medium truncate text-foreground" title={orderId}>
                                      {orderId}
                                    </div>
                                    <div className="text-muted-foreground truncate" title={getSupplierName(order)}>
                                      {getSupplierName(order)}
                                    </div>
                                    <div className="text-muted-foreground">
                                      {getOrderQuantityWithUnit(order, product)}
                                    </div>
                                    <Badge 
                                      variant="outline" 
                                      className={`text-[10px] mt-1 ${getStatusBadgeColor(order.status)}`}
                                    >
                                      {order.status}
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
      </Card>
    </div>
  );
}
