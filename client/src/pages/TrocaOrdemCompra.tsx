import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { ArrowRightLeft, Search, AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface OrderInfo {
  id: number;
  orderId: string;
  productId: number;
  productName: string;
  quantity: string;
  currentPurchaseOrderId: number | null;
  currentPurchaseOrderNumber: string | null;
  status: string;
}

interface AvailablePurchaseOrder {
  id: number;
  orderNumber: string;
  companyName: string;
  validFrom: string;
  validUntil: string;
  availableBalance: string;
  totalQuantity: string;
  usedQuantity: string;
}

export default function TrocaOrdemCompra() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [orderId, setOrderId] = useState("");
  const [searchedOrderId, setSearchedOrderId] = useState("");
  const [selectedPurchaseOrderId, setSelectedPurchaseOrderId] = useState<string>("");

  const { data: orderInfo, isLoading: isLoadingOrder, error: orderError, refetch: refetchOrder } = useQuery<OrderInfo>({
    queryKey: ["/api/keyuser/pedido-info", searchedOrderId],
    queryFn: async () => {
      if (!searchedOrderId) return null;
      const res = await fetch(`/api/keyuser/pedido-info/${encodeURIComponent(searchedOrderId)}`);
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Pedido não encontrado");
      }
      return res.json();
    },
    enabled: !!searchedOrderId,
  });

  const { data: availableOrders = [], isLoading: isLoadingAvailableOrders } = useQuery<AvailablePurchaseOrder[]>({
    queryKey: ["/api/keyuser/ordens-compra-disponiveis", orderInfo?.id],
    queryFn: async () => {
      if (!orderInfo?.id) return [];
      const res = await fetch(`/api/keyuser/ordens-compra-disponiveis/${orderInfo.id}`);
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Erro ao buscar ordens de compra");
      }
      return res.json();
    },
    enabled: !!orderInfo?.id,
  });

  const trocarOrdemMutation = useMutation({
    mutationFn: async ({ orderId, newPurchaseOrderId }: { orderId: number; newPurchaseOrderId: number }) => {
      const res = await fetch("/api/keyuser/trocar-ordem-compra", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, newPurchaseOrderId }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Erro ao trocar ordem de compra");
      }
      return res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Sucesso",
        description: data.message || "Ordem de compra trocada com sucesso!",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/keyuser/pedido-info"] });
      queryClient.invalidateQueries({ queryKey: ["/api/keyuser/ordens-compra-disponiveis"] });
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      setSelectedPurchaseOrderId("");
      setSearchedOrderId("");
      setOrderId("");
    },
    onError: (error: Error) => {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSearch = () => {
    if (orderId.trim()) {
      setSearchedOrderId(orderId.trim());
      setSelectedPurchaseOrderId("");
    }
  };

  const handleTrocar = () => {
    if (!orderInfo?.id || !selectedPurchaseOrderId) return;
    trocarOrdemMutation.mutate({
      orderId: orderInfo.id,
      newPurchaseOrderId: parseInt(selectedPurchaseOrderId),
    });
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("pt-BR");
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center gap-3">
        <ArrowRightLeft className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Troca de Ordem de Compra</h1>
          <p className="text-muted-foreground">
            Altere a ordem de compra vinculada a um pedido
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Buscar Pedido</CardTitle>
          <CardDescription>
            Digite o ID do pedido que deseja alterar a ordem de compra
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-3">
            <div className="flex-1">
              <Label htmlFor="orderId">ID do Pedido</Label>
              <Input
                id="orderId"
                placeholder="Ex: PED-001"
                value={orderId}
                onChange={(e) => setOrderId(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              />
            </div>
            <div className="flex items-end">
              <Button onClick={handleSearch} disabled={!orderId.trim() || isLoadingOrder}>
                {isLoadingOrder ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Search className="h-4 w-4 mr-2" />
                )}
                Buscar
              </Button>
            </div>
          </div>

          {orderError && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Erro</AlertTitle>
              <AlertDescription>
                {(orderError as Error).message}
              </AlertDescription>
            </Alert>
          )}

          {orderInfo && (
            <Card className="bg-muted/50">
              <CardContent className="pt-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">ID do Pedido</p>
                    <p className="font-medium">{orderInfo.orderId}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Produto</p>
                    <p className="font-medium">{orderInfo.productName}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Quantidade</p>
                    <p className="font-medium">{orderInfo.quantity}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Status</p>
                    <p className="font-medium">{orderInfo.status}</p>
                  </div>
                  <div className="col-span-2 md:col-span-4">
                    <p className="text-sm text-muted-foreground">Ordem de Compra Atual</p>
                    <p className="font-medium">
                      {orderInfo.currentPurchaseOrderNumber || "Nenhuma ordem vinculada"}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </CardContent>
      </Card>

      {orderInfo && (
        <Card>
          <CardHeader>
            <CardTitle>Nova Ordem de Compra</CardTitle>
            <CardDescription>
              Selecione a nova ordem de compra para este pedido. Apenas ordens com o mesmo produto, saldo disponível e dentro da validade são exibidas.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {isLoadingAvailableOrders ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin mr-2" />
                <span>Carregando ordens disponíveis...</span>
              </div>
            ) : availableOrders.length === 0 ? (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Nenhuma ordem disponível</AlertTitle>
                <AlertDescription>
                  Não há ordens de compra válidas com o mesmo produto ({orderInfo.productName}) e saldo disponível para a quantidade do pedido ({orderInfo.quantity}).
                </AlertDescription>
              </Alert>
            ) : (
              <>
                <div>
                  <Label htmlFor="purchaseOrder">Ordem de Compra de Destino</Label>
                  <Select
                    value={selectedPurchaseOrderId}
                    onValueChange={setSelectedPurchaseOrderId}
                  >
                    <SelectTrigger id="purchaseOrder">
                      <SelectValue placeholder="Selecione uma ordem de compra" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableOrders.map((order) => (
                        <SelectItem key={order.id} value={order.id.toString()}>
                          {order.orderNumber} - {order.companyName} (Saldo: {order.availableBalance})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {selectedPurchaseOrderId && (
                  <Card className="bg-muted/50">
                    <CardContent className="pt-4">
                      {(() => {
                        const selected = availableOrders.find(
                          (o) => o.id.toString() === selectedPurchaseOrderId
                        );
                        if (!selected) return null;
                        return (
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div>
                              <p className="text-sm text-muted-foreground">Número da OC</p>
                              <p className="font-medium">{selected.orderNumber}</p>
                            </div>
                            <div>
                              <p className="text-sm text-muted-foreground">Empresa</p>
                              <p className="font-medium">{selected.companyName}</p>
                            </div>
                            <div>
                              <p className="text-sm text-muted-foreground">Validade</p>
                              <p className="font-medium">
                                {formatDate(selected.validFrom)} até {formatDate(selected.validUntil)}
                              </p>
                            </div>
                            <div>
                              <p className="text-sm text-muted-foreground">Saldo Disponível</p>
                              <p className="font-medium text-green-600">{selected.availableBalance}</p>
                            </div>
                          </div>
                        );
                      })()}
                    </CardContent>
                  </Card>
                )}

                <div className="flex justify-end">
                  <Button
                    onClick={handleTrocar}
                    disabled={!selectedPurchaseOrderId || trocarOrdemMutation.isPending}
                    className="min-w-[200px]"
                  >
                    {trocarOrdemMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <CheckCircle2 className="h-4 w-4 mr-2" />
                    )}
                    Confirmar Troca
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
