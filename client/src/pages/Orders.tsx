import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "@/hooks/use-toast";
import { useAuthorization } from "@/context/AuthorizationContext";
import { useAuth } from "@/context/AuthContext";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Search, Filter, AlertTriangle, Trash2, ChevronUp, ChevronDown } from "lucide-react";
import { getStatusColor, formatDate } from "@/lib/utils";

// Função para formatar números com vírgula (formato brasileiro)
const formatNumber = (value: string | number): string => {
  const numValue = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(numValue)) return value.toString();

  // Usar toLocaleString com locale brasileiro para vírgula como separador decimal
  return numValue.toLocaleString('pt-BR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2, // Máximo 2 casas decimais
  });
};
import { apiRequest } from "@/lib/queryClient";
import {
  insertOrderSchema,
  type Order,
  type Product,
  type Company,
  type PurchaseOrder,
} from "@shared/schema";
import { z } from "zod";
import { OrderDetailDrawer } from "@/components/OrderDetailDrawer";

// Tipo para as ordens de compra que retornam do backend (API)
type PurchaseOrderResponse = {
  id: number;
  numero_ordem: string;
  empresa_id: number;
  obra_id: number | null;
  usuario_id: number;
  valido_ate: string;
  data_criacao: string;
  status: string;
  valor_total: number;
  empresa_nome: string;
};

// Tipo para os itens de uma ordem de compra
type PurchaseOrderItem = {
  id: number;
  ordem_compra_id: number;
  produto_id: number;
  quantidade: string;
  produto_nome: string;
  unidade_abreviacao: string;
};

// Tipo para o retorno da consulta de saldo disponível
type ProductBalance = {
  sucesso?: boolean;
  ordem_id?: number;
  produto_id?: number;
  quantidade_total?: number;
  quantidade_usada?: number;
  saldo_disponivel?: number;
  saldoDisponivel?: number; // Compatibilidade
  unidade?: string;
  carregando?: boolean;
};

// Tipo para unidade
type Unit = {
  id: number;
  name: string;
  abbreviation: string;
};

// Schema para validação do formulário de pedido
const orderFormSchema = z.object({
  purchaseOrderId: z.number({
    required_error: "Selecione uma ordem de compra",
  }),
  productId: z.number({ required_error: "Selecione um produto" }),
  quantity: z
    .string()
    .min(1, "Informe a quantidade")
    .refine((val) => !isNaN(parseFloat(val)) && parseFloat(val) > 0, {
      message: "Quantidade deve ser maior que zero",
    }),
  deliveryDate: z.string({ required_error: "Informe a data de entrega" }),
});

// Inferir tipo a partir do schema
type OrderFormData = z.infer<typeof orderFormSchema>;

// Lista de status possíveis para filtro
const statusOptions = [
  "Registrado",
  "Carregado",
  "Em Rota",
  "Entregue",
  "Recusado",
  "Cancelado",
];

export default function Orders() {
  const { canEdit } = useAuthorization();
  const { user: currentUser } = useAuth();
  const queryClient = useQueryClient();

  // Verificar se o usuário é keyuser
  const isKeyUser = currentUser?.isKeyUser || currentUser?.isDeveloper;
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedPurchaseOrder, setSelectedPurchaseOrder] =
    useState<PurchaseOrderResponse | null>(null);
  const [selectedProductId, setSelectedProductId] = useState<number>(0);
  const [quantityError, setQuantityError] = useState<string | null>(null);
  const [productBalance, setProductBalance] = useState<ProductBalance | null>(
    null,
  );

  // Estado para controlar o drawer de detalhes do pedido
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null);

  // Estados para verificação de urgência
  const [isUrgentOrder, setIsUrgentOrder] = useState(false);
  const [urgentDaysThreshold, setUrgentDaysThreshold] = useState(7);

  //Sorting
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');


  // Buscar pedidos
  const { data: orders = [], isLoading } = useQuery<Order[]>({
    queryKey: ["/api/orders"],
  });

  // Buscar produtos (usados na tabela)
  const { data: products = [] } = useQuery<Product[]>({
    queryKey: ["/api/products"],
  });

  // Buscar empresas (usados na tabela)
  const { data: companies = [] } = useQuery<Company[]>({
    queryKey: ["/api/companies"],
  });

  // Buscar unidades para exibir abreviações
  const { data: units = [] } = useQuery<Unit[]>({
    queryKey: ["/api/units"],
    queryFn: async () => {
      const response = await fetch("/api/units");
      if (!response.ok) throw new Error("Falha ao carregar unidades");
      return response.json();
    },
  });

  // Buscar configurações do sistema
  const { data: settings = [] } = useQuery({
    queryKey: ["/api/settings"],
    queryFn: async () => {
      const response = await fetch("/api/settings");
      if (!response.ok) throw new Error("Falha ao carregar configurações");
      return response.json();
    },
  });

  const { canEdit: hasPermission } = useAuthorization();

  // Atualizar threshold de urgência quando as configurações carregarem
  useEffect(() => {
    const urgentSetting = settings.find((s: any) => s.key === "urgent_days_threshold");
    if (urgentSetting) {
      setUrgentDaysThreshold(parseInt(urgentSetting.value, 10) || 7);
    }
  }, [settings]);



  // Buscar ordens de compra ativas e válidas para a empresa do usuário
  const { data: allPurchaseOrders = [], isLoading: isLoadingPurchaseOrders } =
    useQuery<PurchaseOrderResponse[]>({
      queryKey: ["purchaseOrders"],
      queryFn: async (): Promise<PurchaseOrderResponse[]> => {
        const response = await fetch("/api/purchase-orders");
        if (!response.ok) {
          throw new Error("Falha ao buscar ordens de compra");
        }
        return response.json();
      },
    });

  // Filtrar ordens de compra válidas (não vencidas)
  const purchaseOrders = allPurchaseOrders.filter(order => {
    const validUntilDate = new Date(order.valido_ate);
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Remover horas para comparar apenas a data
    return validUntilDate >= today;
  });

  // Mutação para criar um novo pedido
  const createOrderMutation = useMutation({
    mutationFn: async (data: any) => {
      const orderData = {
        ...data,
        deliveryDate: new Date(data.deliveryDate).toISOString(),
        userId: currentUser?.id || 1,
      };
      console.log("Creating order:", orderData);
      return apiRequest("POST", "/api/orders", orderData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      toast({
        title: "Sucesso",
        description: "Pedido criado com sucesso",
      });
      form.reset();
      setIsDialogOpen(false);
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error.message || "Erro ao criar pedido",
        variant: "destructive",
      });
    },
  });

  // Mutação para excluir pedido
  const deleteOrderMutation = useMutation({
    mutationFn: async (orderId: number) => {
      const response = await fetch(`/api/orders/${orderId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.message || "Erro ao excluir pedido");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      toast({
        title: "Sucesso",
        description: "Pedido excluído com sucesso",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error.message || "Erro ao excluir pedido",
        variant: "destructive",
      });
    },
  });

  // Formulário com react-hook-form e zod
  const form = useForm<OrderFormData>({
    resolver: zodResolver(orderFormSchema),
    defaultValues: {
      purchaseOrderId: undefined,
      productId: undefined,
      quantity: "",
      deliveryDate: "", // Será definido quando urgentDaysThreshold for carregado
    },
  });

  // Quando selecionar uma ordem de compra, buscar seus itens
  const [purchaseOrderItems, setPurchaseOrderItems] = useState<
    PurchaseOrderItem[]
  >([]);
  const [isLoadingItems, setIsLoadingItems] = useState(false);

  // Reset do formulário quando o diálogo fecha
  useEffect(() => {
    if (!isDialogOpen) {
      // Calcular nova data padrão (+ 1 dia para sair do período urgente)
      const defaultDate = new Date();
      defaultDate.setDate(defaultDate.getDate() + urgentDaysThreshold + 1);
      const formattedDate = defaultDate.toISOString().split("T")[0];

      form.reset({
        purchaseOrderId: undefined,
        productId: undefined,
        quantity: "",
        deliveryDate: formattedDate,
      });
      setSelectedPurchaseOrder(null);
      setSelectedProductId(0);
      setPurchaseOrderItems([]);
    }
  }, [isDialogOpen, form, urgentDaysThreshold]);

  // Definir data padrão baseada no threshold de urgência (+ 1 dia para sair do período urgente)
  useEffect(() => {
    if (urgentDaysThreshold > 0 && !form.getValues("deliveryDate")) {
      const defaultDate = new Date();
      defaultDate.setDate(defaultDate.getDate() + urgentDaysThreshold + 1);
      const formattedDate = defaultDate.toISOString().split("T")[0];
      form.setValue("deliveryDate", formattedDate);
    }
  }, [urgentDaysThreshold, form]);

  // Quando selecionar uma ordem de compra, buscar seus itens
  useEffect(() => {
    const purchaseOrderId = form.watch("purchaseOrderId");
    if (purchaseOrderId) {
      setIsLoadingItems(true);
      fetch(`/api/ordem-compra/${purchaseOrderId}/itens`)
        .then((response) => response.json())
        .then((data) => {
          setPurchaseOrderItems(data);
          // Atualizar a ordem de compra selecionada
          const selectedPO = purchaseOrders.find(
            (po) => po.id === purchaseOrderId,
          );
          setSelectedPurchaseOrder(selectedPO || null);
        })
        .catch((error) => {
          console.error("Erro ao buscar itens da ordem de compra:", error);
          toast({
            title: "Erro",
            description: "Falha ao carregar itens da ordem de compra",
            variant: "destructive",
          });
        })
        .finally(() => {
          setIsLoadingItems(false);
        });
    } else {
      setPurchaseOrderItems([]);
      setSelectedPurchaseOrder(null);
    }
  }, [form.watch("purchaseOrderId"), purchaseOrders]);

  // Quando selecionar um produto, verificar saldo disponível
  useEffect(() => {
    const purchaseOrderId = form.watch("purchaseOrderId");
    const productId = form.watch("productId");
    setSelectedProductId(productId || 0);

    if (purchaseOrderId && productId) {
      // Exibir "carregando" durante a verificação
      setProductBalance({ carregando: true });

      fetch(`/api/ordens-compra/${purchaseOrderId}/produtos/${productId}/saldo`)
        .then((response) => response.json())
        .then((data) => {
          console.log("Dados de saldo recebidos:", data);
          console.log("Tipos dos dados:", {
            saldo_disponivel: typeof data.saldo_disponivel,
            saldoDisponivel: typeof data.saldoDisponivel,
            quantidadeTotal: typeof data.quantidadeTotal,
            quantidadeUsada: typeof data.quantidadeUsada
          });
          setProductBalance(data);

          if (!data.sucesso) {
            setQuantityError("Erro ao verificar saldo disponível");
          } else {
            setQuantityError(null);
          }
        })
        .catch((error) => {
          console.error("Erro ao verificar saldo disponível:", error);
          setQuantityError("Erro ao verificar saldo disponível");
          setProductBalance(null);
        });
    } else {
      setProductBalance(null);
      setQuantityError(null);
    }
  }, [form.watch("purchaseOrderId"), form.watch("productId")]);

  // Validar quantidade com base no saldo disponível
  useEffect(() => {
    const quantity = form.watch("quantity");

    if (quantity && productBalance?.sucesso) {
      const quantityValue = parseFloat(quantity);
      const saldoDisponivel = productBalance.saldo_disponivel || productBalance.saldoDisponivel || 0;

      console.log("Validação de quantidade:", {
        quantity,
        quantityValue,
        saldoDisponivel,
        productBalance,
        comparison: quantityValue > saldoDisponivel
      });

      if (quantityValue > saldoDisponivel) {
        const unidade = productBalance.unidade ? ` ${productBalance.unidade}` : '';
        setQuantityError(
          `Quantidade excede o saldo disponível (${formatNumber(saldoDisponivel)}${unidade})`,
        );
      } else {
        setQuantityError(null);
      }
    }
  }, [form.watch("quantity"), productBalance]);

  // Verificar se o pedido é urgente baseado na data de entrega
  useEffect(() => {
    const deliveryDate = form.watch("deliveryDate");

    if (deliveryDate) {
      const selectedDate = new Date(deliveryDate);
      const today = new Date();
      const diffTime = selectedDate.getTime() - today.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      setIsUrgentOrder(diffDays <= urgentDaysThreshold);

      // Validar se a data de entrega não é posterior à validade da ordem de compra
      const purchaseOrderId = form.watch("purchaseOrderId");
      if (purchaseOrderId && selectedPurchaseOrder) {
        const validUntilDate = new Date(selectedPurchaseOrder.valido_ate);
        if (selectedDate > validUntilDate) {
          form.setError("deliveryDate", {
            type: "manual",
            message: `Data de entrega não pode ser posterior à validade da ordem de compra (${validUntilDate.toLocaleDateString('pt-BR')})`
          });
        } else {
          form.clearErrors("deliveryDate");
        }
      }
    } else {
      setIsUrgentOrder(false);
    }
  }, [form.watch("deliveryDate"), urgentDaysThreshold, selectedPurchaseOrder]);

  // Aplicar filtros aos pedidos
  const filteredOrders = orders.filter((order) => {
    // Filtrar por texto de busca
    const searchMatch =
      order.orderId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      String(order.productId).includes(searchTerm) ||
      order.workLocation.toLowerCase().includes(searchTerm.toLowerCase());

    // Filtrar por status
    const statusMatch = statusFilter === "all" || order.status === statusFilter;

    return searchMatch && statusMatch;
  });

  // Function to handle sorting
  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  // Function to sort the orders
  const sortedOrders = [...filteredOrders].sort((a, b) => {
    if (sortColumn === 'id') {
      const orderIdA = a.orderId;
      const orderIdB = b.orderId;

      if (sortDirection === 'asc') {
        return orderIdA.localeCompare(orderIdB);
      } else {
        return orderIdB.localeCompare(orderIdA);
      }
    } else if (sortColumn === 'deliveryDate') {
      const dateA = new Date(a.deliveryDate);
      const dateB = new Date(b.deliveryDate);

      if (sortDirection === 'asc') {
        return dateA.getTime() - dateB.getTime();
      } else {
        return dateB.getTime() - dateA.getTime();
      }
    }
    return 0;
  });

    // Apply filters and sorts to orders
    const filteredAndSortedOrders = sortedOrders

  // Função para abrir o drawer de detalhes do pedido
  const handleOpenDetails = (order: Order) => {
    setSelectedOrderId(order.id);
    setDrawerOpen(true);
  };

  const onSubmit = (data: OrderFormData) => {
    // Validação adicional de saldo disponível
    if (quantityError) {
      toast({
        title: "Erro de validação",
        description: quantityError,
        variant: "destructive",
      });
      return;
    }

    // Validar se a data de entrega não é posterior à validade da ordem de compra
    if (selectedPurchaseOrder) {
      const deliveryDate = new Date(data.deliveryDate);
      const validUntilDate = new Date(selectedPurchaseOrder.valido_ate);

      if (deliveryDate > validUntilDate) {
        toast({
          title: "Erro de validação",
          description: `Data de entrega não pode ser posterior à validade da ordem de compra (${validUntilDate.toLocaleDateString('pt-BR')})`,
          variant: "destructive",
        });
        return;
      }
    }

    // Adicionar campos adicionais necessários para o backend
    const orderData = {
      ...data,
      supplierId: selectedPurchaseOrder?.empresa_id,
      workLocation: "Conforme ordem de compra",
      isUrgent: false,
    };

    // Enviar para API
    createOrderMutation.mutate(orderData);
  };

  return (
    <div className="space-y-6">
      {/* Drawer para detalhes do pedido */}
      <OrderDetailDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        orderId={selectedOrderId}
      />

      {/* Header com ações */}
      <div className="flex justify-between items-center mb-6">
        {(currentUser?.canCreateOrder || currentUser?.isKeyUser) && (
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-primary hover:bg-primary/90 text-white">
                <Plus className="w-4 h-4 mr-2" />
                Novo Pedido
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle>Novo Pedido</DialogTitle>
              </DialogHeader>
              <Form {...form}>
                <form
                  onSubmit={form.handleSubmit(onSubmit)}
                  className="space-y-4"
                >
                  {/* Ordem de compra */}
                  <FormField
                    control={form.control}
                    name="purchaseOrderId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Ordem de Compra</FormLabel>
                        <Select
                          onValueChange={(value) =>
                            field.onChange(parseInt(value))
                          }
                          defaultValue={field.value?.toString()}
                          disabled={isLoadingPurchaseOrders}
                        >
                          <FormControl>
                            <SelectTrigger className="bg-input border-border">
                              <SelectValue placeholder="Selecione uma ordem de compra" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {purchaseOrders.map((order) => (
                              <SelectItem
                                key={order.id}
                                value={order.id.toString()}
                              >
                                {order.numero_ordem} - {order.empresa_nome}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Produto */}
                  <FormField
                    control={form.control}
                    name="productId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Produto</FormLabel>
                        <Select
                          onValueChange={(value) =>
                            field.onChange(parseInt(value))
                          }
                          defaultValue={field.value?.toString()}
                          disabled={
                            !form.watch("purchaseOrderId") || isLoadingItems
                          }
                        >
                          <FormControl>
                            <SelectTrigger className="bg-input border-border">
                              <SelectValue placeholder="Selecione um produto" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {purchaseOrderItems.map((item) => (
                              <SelectItem
                                key={item.id}
                                value={item.produto_id.toString()}
                              >
                                {item.produto_nome}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Quantidade */}
                  <FormField
                    control={form.control}
                    name="quantity"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Quantidade</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            placeholder="Ex: 100,50"
                            min="0.01"
                            step="0.01"
                            className={`bg-input border-border ${quantityError ? "border-destructive" : ""}`}
                            disabled={
                              !selectedProductId || selectedProductId === 0
                            }
                            {...field}
                          />
                        </FormControl>
                        {productBalance && (
                          <div className="text-xs mt-1">
                            <span className="font-medium">Saldo disponível:</span>{" "}
                            {formatNumber(productBalance.saldoDisponivel || productBalance.saldo_disponivel || 0)}
                            {productBalance.unidade && ` ${productBalance.unidade}`}
                          </div>
                        )}
                        {quantityError && (
                          <p className="text-destructive text-xs mt-1">
                            {quantityError}
                          </p>
                        )}
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Data de entrega */}
                  <FormField
                    control={form.control}
                    name="deliveryDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Data de entrega</FormLabel>
                        <FormControl>
                          <Input
                            type="date"
                            className="bg-input border-border"
                            min={new Date().toISOString().split('T')[0]}
                            max={selectedPurchaseOrder ? new Date(selectedPurchaseOrder.valido_ate).toISOString().split('T')[0] : undefined}
                            {...field}
                          />
                        </FormControl>
                        {selectedPurchaseOrder && (
                          <p className="text-xs text-muted-foreground mt-1">
                            Data máxima: {new Date(selectedPurchaseOrder.valido_ate).toLocaleDateString('pt-BR')} (validade da ordem de compra)
                          </p>
                        )}
                        {isUrgentOrder && (
                          <div className="mt-2 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                            <div className="flex items-center">
                              <AlertTriangle className="h-4 w-4 text-yellow-600 mr-2" />
                              <p className="text-sm text-yellow-800 font-medium">
                                Pedido urgente, só será enviado ao fornecedor após aprovação
                              </p>
                            </div>
                          </div>
                        )}
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="flex justify-end gap-2 pt-4">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setIsDialogOpen(false)}
                      className="border-border"
                    >
                      Cancelar
                    </Button>
                    <Button
                      type="submit"
                      disabled={createOrderMutation.isPending}
                      className="bg-primary hover:bg-primary/90 text-white"
                    >
                      {createOrderMutation.isPending
                        ? "Enviando..."
                        : "Criar Pedido"}
                    </Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        )}

        {/* Campo de busca centralizado */}
        <div className="relative flex-1 max-w-md mx-4">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar pedidos..."
            className="pl-8 bg-input border-border"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {/* Filtro de status */}
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px] bg-input border-border">
            <SelectValue placeholder="Todos os status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            {statusOptions.map((status) => (
              <SelectItem key={status} value={status}>
                {status}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Orders List */}
      <Card className="mt-4">
        <CardHeader className="py-4">
          <CardTitle>Pedidos</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center items-center py-8">
              <p>Carregando pedidos...</p>
            </div>
          ) : filteredOrders.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <p className="text-lg font-medium">Nenhum pedido encontrado</p>
              <p className="text-muted-foreground mt-1">
                Não foram encontrados pedidos com os filtros aplicados.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>
                      <Button
                        variant="ghost"
                        className="h-auto p-0 font-semibold hover:bg-transparent"
                        onClick={() => handleSort('id')}
                      >
                        ID
                        {sortColumn === 'id' && (
                          sortDirection === 'asc' ? 
                          <ChevronUp className="ml-1 h-4 w-4" /> : 
                          <ChevronDown className="ml-1 h-4 w-4" />
                        )}
                      </Button>
                    </TableHead>
                    <TableHead>Produto</TableHead>
                    <TableHead>Quantidade</TableHead>
                    <TableHead>Fornecedor</TableHead>
                    <TableHead>
                      <Button
                        variant="ghost"
                        className="h-auto p-0 font-semibold hover:bg-transparent"
                        onClick={() => handleSort('deliveryDate')}
                      >
                        Data de Entrega
                        {sortColumn === 'deliveryDate' && (
                          sortDirection === 'asc' ? 
                          <ChevronUp className="ml-1 h-4 w-4" /> : 
                          <ChevronDown className="ml-1 h-4 w-4" />
                        )}
                      </Button>
                    </TableHead>
                    <TableHead>Status</TableHead>
                    {isKeyUser && <TableHead className="text-right">Ações</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAndSortedOrders.map((order) => {
                    const product = products.find(
                      (p) => p.id === order.productId,
                    );
                    const company = companies.find(
                      (c) => c.id === order.supplierId,
                    );
                    const unit = units.find(
                      (u) => u.id === product?.unitId,
                    );

                    return (
                      <TableRow
                        key={order.id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => handleOpenDetails(order)}
                      >
                        <TableCell className="font-medium">
                          {order.orderId}
                        </TableCell>
                        <TableCell>{product?.name || "N/A"}</TableCell>
                        <TableCell>
                          {formatNumber(order.quantity)} {unit?.abbreviation || ""}
                        </TableCell>
                        <TableCell>{company?.name || "N/A"}</TableCell>
                        <TableCell>{formatDate(order.deliveryDate)}</TableCell>
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
                        {isKeyUser && (
                          <TableCell className="text-right">
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  title="Excluir pedido"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Tem certeza que deseja excluir o pedido {order.orderId}?
                                    Esta ação não pode ser desfeita.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => deleteOrderMutation.mutate(order.id)}
                                    disabled={deleteOrderMutation.isPending}
                                  >
                                    {deleteOrderMutation.isPending ? "Excluindo..." : "Excluir"}
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </TableCell>
                        )}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}