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

export default function Approvals() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");

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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/orders/urgent"] });
      toast({
        title: "Sucesso",
        description: "Pedido aprovado com sucesso",
      });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Erro ao aprovar pedido",
        variant: "destructive",
      });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async (orderId: number) => {
      console.log("Rejecting order:", orderId);
      return apiRequest("PUT", `/api/orders/${orderId}/reject`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/orders/urgent"] });
      toast({
        title: "Sucesso",
        description: "Pedido rejeitado com sucesso",
      });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Erro ao rejeitar pedido",
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

  return (
    <div className="space-y-6">
      {/* Campo de busca */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" size={18} />
        <Input
          placeholder="Buscar por ID, local da obra ou produto..."
          className="pl-10 bg-input border-border"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {/* Urgent Orders Table */}
      <Card className="bg-card border-border">
        <CardHeader className="border-b border-border">
          <CardTitle className="flex items-center">
            <AlertTriangle className="text-yellow-500 mr-2" size={20} />
            Pedidos Urgentes Pendentes ({filteredOrders.length} de {urgentOrders.length})
          </CardTitle>
          <p className="text-muted-foreground text-sm">
            Pedidos com data de entrega inferior a 7 dias que necessitam aprovação
          </p>
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
                  const today = new Date();
                  const daysRemaining = Math.ceil(
                    (deliveryDate.getTime() - today.getTime()) / (1000 * 3600 * 24)
                  );
                  
                  return (
                    <TableRow key={order.id} className="hover:bg-muted/50">
                      <TableCell className="font-mono text-sm">
                        <div className="flex items-center">
                          {order.orderId}
                          <AlertTriangle className="ml-2 text-yellow-500" size={14} />
                        </div>
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
                            className="text-muted-foreground hover:text-primary"
                          >
                            <Eye size={16} />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-green-600 hover:text-green-700 hover:bg-green-50 dark:hover:bg-green-900"
                            onClick={() => handleApprove(order.id)}
                            disabled={approveMutation.isPending}
                          >
                            <CheckCircle size={16} />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900"
                            onClick={() => handleReject(order.id)}
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
          
          {urgentOrders.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <CheckCircle className="mx-auto mb-4 text-green-500" size={48} />
              <h3 className="text-lg font-medium mb-2">Nenhum pedido urgente pendente</h3>
              <p className="text-sm">
                Todos os pedidos urgentes foram processados com sucesso!
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Guidelines Card */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle>Diretrizes de Aprovação</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4 text-sm text-muted-foreground">
            <div className="flex items-start space-x-3">
              <AlertTriangle className="text-yellow-500 mt-0.5" size={16} />
              <div>
                <p className="font-medium text-foreground">Critérios para Urgência</p>
                <p>Pedidos com data de entrega inferior a 7 dias são automaticamente marcados como urgentes</p>
              </div>
            </div>
            
            <div className="flex items-start space-x-3">
              <Clock className="text-primary mt-0.5" size={16} />
              <div>
                <p className="font-medium text-foreground">Tempo Limite</p>
                <p>Aprovações devem ser processadas em até 48 horas após a criação do pedido</p>
              </div>
            </div>
            
            <div className="flex items-start space-x-3">
              <CheckCircle className="text-green-500 mt-0.5" size={16} />
              <div>
                <p className="font-medium text-foreground">Aprovação</p>
                <p>Aprovação muda o status do pedido para "Aprovado" e permite prosseguir para execução</p>
              </div>
            </div>
            
            <div className="flex items-start space-x-3">
              <XCircle className="text-red-500 mt-0.5" size={16} />
              <div>
                <p className="font-medium text-foreground">Rejeição</p>
                <p>Rejeição altera o status do pedido para "Cancelado" permanentemente</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
