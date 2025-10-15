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
  Clock,
  MessageSquare,
  Search,
  Calendar,
  AlertTriangle
} from "lucide-react";
import { formatDate } from "@/lib/utils";
import { apiRequest } from "@/lib/queryClient";
import { OrderDetailDrawer } from "@/components/OrderDetailDrawer";

interface ReprogramacaoOrder {
  id: number;
  orderId: string;
  productName: string;
  unit: string;
  quantity: string;
  supplierName: string;
  purchaseOrderNumber: string;
  purchaseOrderCompanyName: string;
  destinationCompanyName: string;
  originalDeliveryDate: string;
  newDeliveryDate: string;
  justification: string;
  requestDate: string;
  requesterName: string;
}

export default function Reprogramacoes() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const { data: reprogramacoes = [], isLoading } = useQuery<ReprogramacaoOrder[]>({
    queryKey: ["/api/orders/reprogramacoes"],
  });

  // Filtrar reprogramações baseado no termo de busca
  const filteredReprogramacoes = reprogramacoes.filter(order => 
    order.orderId.toLowerCase().includes(searchTerm.toLowerCase()) ||
    order.productName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    order.supplierName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    order.destinationCompanyName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const approveMutation = useMutation({
    mutationFn: async (orderId: number) => {
      console.log("Aprovando reprogramação:", orderId);
      return apiRequest("PUT", `/api/orders/${orderId}/reprogramacao/aprovar`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/orders/reprogramacoes"] });
      toast({
        title: "Sucesso",
        description: "Reprogramação aprovada com sucesso",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error.message || "Erro ao aprovar reprogramação",
        variant: "destructive",
      });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async (orderId: number) => {
      console.log("Rejeitando reprogramação:", orderId);
      return apiRequest("PUT", `/api/orders/${orderId}/reprogramacao/rejeitar`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/orders/reprogramacoes"] });
      toast({
        title: "Sucesso",
        description: "Reprogramação rejeitada, pedido cancelado",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error.message || "Erro ao rejeitar reprogramação",
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

  const handleViewDetails = (orderId: number) => {
    setSelectedOrderId(orderId);
    setIsDrawerOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight">Reprogramações</h1>
          <Badge variant="secondary" className="text-sm bg-orange-100 text-orange-800 border-orange-200">
            {reprogramacoes.length}
          </Badge>
          <p className="text-muted-foreground">
            Gerencie solicitações de reprogramação de entrega
          </p>
        </div>
        <Badge variant="outline" className="text-sm">
          {filteredReprogramacoes.length} reprogramação(ões) pendente(s)
        </Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Reprogramações Pendentes
          </CardTitle>
          <div className="flex items-center space-x-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Pesquisar por pedido, produto, fornecedor..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="max-w-sm"
            />
          </div>
        </CardHeader>
        <CardContent>
          {filteredReprogramacoes.length > 0 && (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Pedido</TableHead>
                    <TableHead>Produto</TableHead>
                    <TableHead>Fornecedor</TableHead>
                    <TableHead>Destino</TableHead>
                    <TableHead>Data Original</TableHead>
                    <TableHead>Nova Data</TableHead>
                    <TableHead>Solicitado em</TableHead>
                    <TableHead>Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredReprogramacoes.map((order) => (
                    <TableRow 
                      key={order.id} 
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => handleViewDetails(order.id)}
                    >
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4 text-orange-500" />
                          {order.orderId}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{order.productName}</p>
                          <p className="text-sm text-muted-foreground">
                            {order.quantity} {order.unit}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>{order.supplierName}</TableCell>
                      <TableCell>{order.destinationCompanyName}</TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {new Date(order.originalDeliveryDate).toLocaleDateString('pt-BR')}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm font-medium text-blue-600">
                          {new Date(order.newDeliveryDate).toLocaleDateString('pt-BR')}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <p>{new Date(order.requestDate).toLocaleDateString('pt-BR')}</p>
                          <p className="text-muted-foreground">por {order.requesterName}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => alert(`Justificativa: ${order.justification}`)}
                            title="Ver justificativa"
                          >
                            <MessageSquare className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleApprove(order.id)}
                            disabled={approveMutation.isPending}
                            className="text-green-600 hover:text-green-700"
                            title="Aprovar reprogramação"
                          >
                            <CheckCircle className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleReject(order.id)}
                            disabled={rejectMutation.isPending}
                            className="text-red-600 hover:text-red-700"
                            title="Rejeitar reprogramação"
                          >
                            <XCircle className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {filteredReprogramacoes.length === 0 && !isLoading && (
            <div className="text-center py-12 text-muted-foreground">
              <CheckCircle className="mx-auto mb-4 text-green-500" size={48} />
              <h3 className="text-lg font-medium mb-2">Nenhuma reprogramação pendente</h3>
              <p className="text-sm">
                Não há solicitações de reprogramação de entrega pendentes.
              </p>
            </div>
          )}

          {isLoading && (
            <div className="text-center py-12 text-muted-foreground">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-sm">Carregando reprogramações...</p>
            </div>
          )}
        </CardContent>
      </Card>

      <OrderDetailDrawer
        open={isDrawerOpen}
        onOpenChange={setIsDrawerOpen}
        orderId={selectedOrderId}
      />
    </div>
  );
}