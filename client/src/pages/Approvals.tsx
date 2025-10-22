import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { 
  CheckCircle, 
  XCircle, 
  AlertTriangle,
  Clock,
  Eye,
  Search
} from "lucide-react";
import { getStatusColor, formatDate } from "@/lib/utils";
import { apiRequest } from "@/lib/queryClient";
import type { Order } from "@shared/schema";
import { OrderDetailDrawer } from "@/components/OrderDetailDrawer";

export default function Approvals() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const { data: urgentOrders = [], isLoading } = useQuery<Order[]>({
    queryKey: ["/api/orders/urgent"],
  });

  // Filtrar pedidos baseado no termo de busca
  const filteredOrders = urgentOrders.filter(order => 
    order.orderId.toLowerCase().includes(searchTerm.toLowerCase()) ||
    order.workLocation.toLowerCase().includes(searchTerm.toLowerCase()) ||
    String(order.productId).includes(searchTerm)
  );

  const approveMutation = useMutation({
    mutationFn: async (orderId: number) => {
      console.log("Approving order:", orderId);
      return apiRequest("PUT", `/api/orders/${orderId}/approve`, {});
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/orders/urgent"] });
      toast({
        title: "Sucesso",
        description: data?.message || "Pedido aprovado com sucesso",
      });
    },
    onError: (error: any) => {
      console.error("Erro ao aprovar pedido:", error);
      const errorMessage = error?.response?.data?.message || error?.message || "Erro ao aprovar pedido";
      toast({
        title: "Erro",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async (orderId: number) => {
      console.log("Rejecting order:", orderId);
      return apiRequest("PUT", `/api/orders/${orderId}/reject`, {});
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/orders/urgent"] });
      toast({
        title: "Sucesso",
        description: data?.message || "Pedido rejeitado com sucesso",
      });
    },
    onError: (error: any) => {
      console.error("Erro ao rejeitar pedido:", error);
      const errorMessage = error?.response?.data?.message || error?.message || "Erro ao rejeitar pedido";
      toast({
        title: "Erro",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

  const handleApprove = (orderId: number) => {
    approveMutation.mutate(orderId);
  };

  const handleReject = (orderId: number) => {
    rejectMutation.mutate(orderId);
  };

  const handleOpenDetails = (order: Order) => {
    setSelectedOrder(order);
    setIsDrawerOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Aprovações</h1>
          <p className="text-muted-foreground">
            Gerencie pedidos urgentes e aprovações necessárias
          </p>
        </div>
      </div>

      {/* Urgent Orders Table */}
      <Card className="bg-card border-border">
        <CardHeader className="border-b border-border">
          <CardTitle className="flex items-center">
            Pedidos Urgentes ({urgentOrders.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted">
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Produto</TableHead>
                  <TableHead>Quantidade</TableHead>
                  <TableHead>Local da Obra</TableHead>
                  <TableHead>Data de Entrega</TableHead>
                  <TableHead>Dias Restantes</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredOrders.map((order) => {
                  const deliveryDate = new Date(order.deliveryDate);
                  deliveryDate.setHours(0, 0, 0, 0);
                  
                  const today = new Date();
                  today.setHours(0, 0, 0, 0);
                  
                  const daysRemaining = Math.floor(
                    (deliveryDate.getTime() - today.getTime()) / (1000 * 3600 * 24)
                  );

                  return (
                    <TableRow 
                      key={order.id} 
                      className="hover:bg-muted/50 cursor-pointer"
                      onClick={() => handleOpenDetails(order)}
                    >
                      <TableCell className="font-mono text-sm">
                        {order.orderId}
                      </TableCell>
                      <TableCell>{order.productName || `Produto ID: ${order.productId}`}</TableCell>
                      <TableCell>{order.quantity}</TableCell>
                      <TableCell>{order.workLocation}</TableCell>
                      <TableCell>{formatDate(order.deliveryDate)}</TableCell>
                      <TableCell>
                        <Badge 
                          variant={daysRemaining <= 2 ? "destructive" : "secondary"}
                          className={daysRemaining <= 2 ? "" : "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300"}
                        >
                          {daysRemaining} dias
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className={getStatusColor(order.status)}>
                          {order.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex space-x-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-green-600 hover:text-green-700 hover:bg-green-50 dark:hover:bg-green-900"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleApprove(order.id);
                            }}
                            disabled={approveMutation.isPending}
                          >
                            <CheckCircle size={16} />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleReject(order.id);
                            }}
                            disabled={rejectMutation.isPending}
                          >
                            <XCircle size={16} />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {urgentOrders.length === 0 && !isLoading && (
            <div className="text-center py-12 text-muted-foreground">
              <CheckCircle className="mx-auto mb-4 text-green-500" size={48} />
              <h3 className="text-lg font-medium mb-2">Nenhum pedido urgente pendente</h3>
              <p className="text-sm">
                Não há pedidos urgentes disponíveis para aprovação.
              </p>
              <p className="text-xs mt-2 text-muted-foreground">
                Apenas KeyUsers e aprovadores de empresas podem visualizar pedidos urgentes.
              </p>
            </div>
          )}

          {isLoading && (
            <div className="text-center py-12 text-muted-foreground">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-sm">Carregando pedidos urgentes...</p>
            </div>
          )}
        </CardContent>
      </Card>

      <OrderDetailDrawer
        open={isDrawerOpen}
        onOpenChange={setIsDrawerOpen}
        orderId={selectedOrder?.id || null}
      />
    </div>
  );
}