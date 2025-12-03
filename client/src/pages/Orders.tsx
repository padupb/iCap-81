import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { Plus, Search, Filter, AlertTriangle, Trash2, ChevronUp, ChevronDown, Download } from "lucide-react";
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
  valido_desde: string; // Adicionado para validação de data
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
  observacoes: z.string().max(250, "As observações devem ter no máximo 250 caracteres").optional(),
});

// Inferir tipo a partir do schema
type OrderFormData = z.infer<typeof orderFormSchema>;

// Lista de status possíveis para filtro
const statusOptions = [
  "Registrado",
  "Não iniciado",
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
  const [productFilter, setProductFilter] = useState("all");
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

  // Filtros de período
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // Estados para exportação
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);


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



  // Buscar ordens de compra ativas e válidas para a empresa do usuário (apenas para criação de pedidos)
  const { data: purchaseOrders = [], isLoading: isLoadingPurchaseOrders } =
    useQuery<PurchaseOrderResponse[]>({
      queryKey: ["/api/ordens-compra-validas", currentUser?.companyId],
      queryFn: async () => {
        // Buscar todas as ordens de compra
        const response = await fetch(`/api/ordens-compra`);
        if (!response.ok) {
          throw new Error("Falha ao carregar ordens de compra");
        }
        const allOrders = await response.json();

        // Filtrar apenas ordens válidas (não expiradas) para criação de pedidos
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const validOrders = allOrders.filter((order: any) => {
          const validDate = new Date(order.valido_ate);
          validDate.setHours(0, 0, 0, 0);
          return validDate >= today && order.status === 'Ativo';
        });

        console.log(`📋 Ordens de compra filtradas para criação de pedidos: ${validOrders.length} válidas de ${allOrders.length} totais`);

        return validOrders;
      },
      // Só executar a consulta se o usuário estiver autenticado
      enabled: !!currentUser,
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

  // Mutação para excluir pedido (soft delete)
  const deleteOrderMutation = useMutation({
    mutationFn: async (orderId: number) => {
      const response = await fetch(`/api/orders/${orderId}/archive`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status: "excluido" }),
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
        .then(async (response) => {
          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }
          return response.json();
        })
        .then((data) => {
          // A API retorna um array direto de itens
          setPurchaseOrderItems(Array.isArray(data) ? data : []);
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
          setPurchaseOrderItems([]);
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
      // Criar data a partir da string no formato YYYY-MM-DD
      const [year, month, day] = deliveryDate.split('-').map(Number);
      const selectedDate = new Date(year, month - 1, day);
      selectedDate.setHours(0, 0, 0, 0);

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Calcular diferença em dias ignorando horas
      const diffTime = selectedDate.getTime() - today.getTime();
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

      setIsUrgentOrder(diffDays < urgentDaysThreshold);

      // Validar se a data de entrega está dentro do período de validade da ordem de compra
      const purchaseOrderId = form.watch("purchaseOrderId");
      if (purchaseOrderId && selectedPurchaseOrder) {
        // Criar datas de validade a partir das strings ISO
        const validFromParts = selectedPurchaseOrder.valido_desde.split('T')[0].split('-').map(Number);
        const validFromDate = new Date(validFromParts[0], validFromParts[1] - 1, validFromParts[2]);
        validFromDate.setHours(0, 0, 0, 0);

        const validUntilParts = selectedPurchaseOrder.valido_ate.split('T')[0].split('-').map(Number);
        const validUntilDate = new Date(validUntilParts[0], validUntilParts[1] - 1, validUntilParts[2]);
        validUntilDate.setHours(0, 0, 0, 0);

        console.log('🔍 Debug validação de data:', {
          deliveryDate,
          selectedDate: selectedDate.toISOString(),
          validFrom: validFromDate.toISOString(),
          validUntil: validUntilDate.toISOString(),
          isBeforeValidFrom: selectedDate < validFromDate,
          isAfterValidUntil: selectedDate > validUntilDate
        });

        if (selectedDate < validFromDate) {
          form.setError("deliveryDate", {
            type: "manual",
            message: `Data de entrega não pode ser anterior ao início da validade (${validFromDate.toLocaleDateString('pt-BR')})`
          });
        } else if (selectedDate > validUntilDate) {
          form.setError("deliveryDate", {
            type: "manual",
            message: `Data de entrega não pode ser posterior ao fim da validade (${validUntilDate.toLocaleDateString('pt-BR')})`
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
  const filteredOrders = orders.filter((order: any) => {
    // Filtrar por texto de busca
    const product = products.find(p => p.id === order.product_id);
    const company = companies.find(c => c.id === order.supplier_id);
    
    const searchMatch =
      String(order.order_id || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      String(product?.name || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      String(company?.name || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      String(order.workLocation || "").toLowerCase().includes(searchTerm.toLowerCase());

    // Filtrar por status
    const statusMatch = statusFilter === "all" || order.status === statusFilter;

    // Filtrar por produto
    const productMatch = productFilter === "all" || order.product_id === parseInt(productFilter);

    // Filtrar por período
    let dateMatch = true;
    if (startDate || endDate) {
      const orderDate = new Date(order.delivery_date);

      if (startDate && endDate) {
        const start = new Date(startDate);
        const end = new Date(endDate);
        dateMatch = orderDate >= start && orderDate <= end;
      } else if (startDate) {
        const start = new Date(startDate);
        dateMatch = orderDate >= start;
      } else if (endDate) {
        const end = new Date(endDate);
        dateMatch = orderDate <= end;
      }
    }

    return searchMatch && statusMatch && productMatch && dateMatch;
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
    let aValue: any;
    let bValue: any;

    switch (sortColumn) {
      case 'id':
        aValue = (a as any).order_id || a.id;
        bValue = (b as any).order_id || b.id;
        break;
      case 'product':
        const productA = products.find(p => p.id === (a as any).product_id);
        const productB = products.find(p => p.id === (b as any).product_id);
        aValue = productA?.name || "";
        bValue = productB?.name || "";
        break;
      case 'quantity':
        aValue = parseFloat(a.quantity);
        bValue = parseFloat(b.quantity);
        break;
      case 'supplier':
        const companyA = companies.find(c => c.id === (a as any).supplier_id);
        const companyB = companies.find(c => c.id === (b as any).supplier_id);
        aValue = companyA?.name || "";
        bValue = companyB?.name || "";
        break;
      case 'deliveryDate':
        aValue = new Date((a as any).delivery_date || 0);
        bValue = new Date((b as any).delivery_date || 0);
        break;
      case 'status':
        aValue = a.status;
        bValue = b.status;
        break;
      default:
        return 0;
    }

    // Handle different types of comparison
    if (typeof aValue === 'string' && typeof bValue === 'string') {
      return sortDirection === 'asc' 
        ? aValue.localeCompare(bValue)
        : bValue.localeCompare(aValue);
    } else if (aValue instanceof Date && bValue instanceof Date) {
      return sortDirection === 'asc'
        ? aValue.getTime() - bValue.getTime()
        : bValue.getTime() - aValue.getTime();
    } else if (typeof aValue === 'number' && typeof bValue === 'number') {
      return sortDirection === 'asc'
        ? aValue - bValue
        : bValue - aValue;
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

  // Função para exportar CSV/XLSX
  const handleExportData = async (format: 'csv' | 'xlsx') => {
    setIsExporting(true);
    try {
      const dataToExport = filteredAndSortedOrders.map(order => {
        const product = products.find(p => p.id === (order as any).product_id);
        const company = companies.find(c => c.id === (order as any).supplier_id);
        const unit = units.find(u => u.id === product?.unitId);

        return {
          'ID': (order as any).order_id || order.id,
          'Produto': product?.name || 'N/A',
          'Quantidade': formatNumber(order.quantity),
          'Unidade': unit?.abbreviation || '',
          'Fornecedor': company?.name || 'N/A',
          'Data de Entrega': formatDate((order as any).delivery_date),
          'Status': order.status,
          'Local de Trabalho': order.workLocation,
          'Urgente': order.isUrgent ? 'Sim' : 'Não',
          'Data de Criação': formatDate(order.createdAt)
        };
      });

      if (format === 'csv') {
        const csvContent = [
          Object.keys(dataToExport[0]).join(','),
          ...dataToExport.map(row => Object.values(row).map(val => `"${val}"`).join(','))
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `pedidos_${new Date().toISOString().split('T')[0]}.csv`;
        link.click();
      } else {
        // Para XLSX, usar uma biblioteca simples ou converter para TSV
        const tsvContent = [
          Object.keys(dataToExport[0]).join('\t'),
          ...dataToExport.map(row => Object.values(row).join('\t'))
        ].join('\n');

        const blob = new Blob([tsvContent], { type: 'application/vnd.ms-excel' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `pedidos_${new Date().toISOString().split('T')[0]}.xlsx`;
        link.click();
      }

      toast({
        title: "Exportação concluída",
        description: `Arquivo ${format.toUpperCase()} baixado com sucesso`,
      });
    } catch (error) {
      toast({
        title: "Erro na exportação",
        description: "Falha ao gerar arquivo de exportação",
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
      setIsExportDialogOpen(false);
    }
  };

  // Função para exportar notas fiscais em arquivo ZIP
  const handleExportNotes = async () => {
    setIsExporting(true);
    try {
      // Filtrar pedidos com documentos
      const ordersWithDocs = filteredAndSortedOrders.filter(order => 
        order.status !== 'Registrado' && order.status !== 'Cancelado'
      );

      if (ordersWithDocs.length === 0) {
        toast({
          title: "Nenhuma nota encontrada",
          description: "Não há pedidos com documentos para exportar",
          variant: "destructive",
        });
        return;
      }

      console.log(`📦 Solicitando ZIP com documentos de ${ordersWithDocs.length} pedidos`);

      // Chamar endpoint para gerar ZIP
      const response = await fetch('/api/pedidos/download-zip', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          pedidoIds: ordersWithDocs.map(order => order.id)
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Erro ao gerar arquivo ZIP');
      }

      // Baixar o arquivo ZIP
      const blob = await response.blob();
      console.log(`📥 Blob recebido: ${blob.size} bytes, tipo: ${blob.type}`);

      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;

      // Extrair nome do arquivo do header ou usar padrão
      const contentDisposition = response.headers.get('Content-Disposition');
      const fileName = contentDisposition
        ? contentDisposition.split('filename=')[1]?.replace(/"/g, '')
        : `documentos_pedidos_${new Date().toISOString().split('T')[0]}.zip`;

      console.log(`💾 Iniciando download: ${fileName}`);
      link.download = fileName;
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();

      // Cleanup com delay para garantir que o download inicie
      setTimeout(() => {
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
      }, 100);

      toast({
        title: "Download concluído",
        description: `Arquivo ZIP com documentos de ${ordersWithDocs.length} pedidos baixado com sucesso`,
      });

      setIsExportDialogOpen(false);
    } catch (error) {
      console.error('Erro ao exportar notas:', error);
      toast({
        title: "Erro na exportação",
        description: error instanceof Error ? error.message : "Falha ao baixar documentos",
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
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

    // Validar se a data de entrega está dentro do período de validade da ordem de compra
    if (selectedPurchaseOrder) {
      // Criar data de entrega a partir da string YYYY-MM-DD com horário 00:01
      const [year, month, day] = data.deliveryDate.split('-').map(Number);
      const deliveryDate = new Date(year, month - 1, day);
      deliveryDate.setHours(0, 1, 0, 0); // Definir para 00:01 AM

      // Criar datas de validade a partir das strings ISO
      const validFromParts = selectedPurchaseOrder.valido_desde.split('T')[0].split('-').map(Number);
      const validFromDate = new Date(validFromParts[0], validFromParts[1] - 1, validFromParts[2]);
      validFromDate.setHours(0, 0, 0, 0);

      const validUntilParts = selectedPurchaseOrder.valido_ate.split('T')[0].split('-').map(Number);
      const validUntilDate = new Date(validUntilParts[0], validUntilParts[1] - 1, validUntilParts[2]);
      validUntilDate.setHours(23, 59, 59, 999); // Final do dia

      console.log('🔍 Debug onSubmit validação de data:', {
        deliveryDate: deliveryDate.toISOString(),
        validFrom: validFromDate.toISOString(),
        validUntil: validUntilDate.toISOString(),
        isBeforeValidFrom: deliveryDate < validFromDate,
        isAfterValidUntil: deliveryDate > validUntilDate
      });

      if (deliveryDate < validFromDate) {
        toast({
          title: "Erro de validação",
          description: `Data de entrega não pode ser anterior ao início da validade da ordem de compra (${validFromDate.toLocaleDateString('pt-BR')})`,
          variant: "destructive",
        });
        return;
      }

      if (deliveryDate > validUntilDate) {
        toast({
          title: "Erro de validação",
          description: `Data de entrega não pode ser posterior ao fim da validade da ordem de compra (${validUntilDate.toLocaleDateString('pt-BR')})`,
          variant: "destructive",
        });
        return;
      }
    }

    // Definir data de entrega com horário 00:01 AM
    const [year, month, day] = data.deliveryDate.split('-').map(Number);
    const correctedDate = new Date(Date.UTC(year, month - 1, day, 0, 1, 0));

    // Adicionar campos adicionais necessários para o backend
    const orderData = {
      ...data,
      deliveryDate: correctedDate.toISOString(),
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
        <div className="flex gap-2">
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
                            {Array.isArray(purchaseOrderItems) && purchaseOrderItems.length > 0 ? (
                              purchaseOrderItems.map((item) => (
                                <SelectItem
                                  key={item.id}
                                  value={item.produto_id.toString()}
                                >
                                  {item.produto_nome}
                                </SelectItem>
                              ))
                            ) : (
                              <SelectItem value="0" disabled>
                                {isLoadingItems ? "Carregando produtos..." : "Nenhum produto disponível"}
                              </SelectItem>
                            )}
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
                            min={selectedPurchaseOrder ? 
                              Math.max(
                                new Date().getTime(),
                                new Date(selectedPurchaseOrder.valido_desde || new Date()).getTime()
                              ) > new Date().getTime() ?
                                new Date(selectedPurchaseOrder.valido_desde).toISOString().split('T')[0] :
                                new Date().toISOString().split('T')[0]
                              : new Date().toISOString().split('T')[0]
                            }
                            max={selectedPurchaseOrder ? new Date(selectedPurchaseOrder.valido_ate).toISOString().split('T')[0] : undefined}
                            {...field}
                          />
                        </FormControl>
                        {selectedPurchaseOrder && (
                          <div className="text-xs text-muted-foreground mt-1 space-y-1">
                            <p>
                              <strong>Período válido:</strong> {new Date(selectedPurchaseOrder.valido_desde).toLocaleDateString('pt-BR')} até {new Date(selectedPurchaseOrder.valido_ate).toLocaleDateString('pt-BR')}
                            </p>
                            <p className="text-blue-600">
                              ℹ️ A data de entrega deve estar dentro deste período
                            </p>
                          </div>
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

                  {/* Observações */}
                  <FormField
                    control={form.control}
                    name="observacoes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Observações (opcional)</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Digite observações sobre o pedido (máximo 250 caracteres)"
                            className="bg-input border-border resize-none"
                            maxLength={250}
                            rows={3}
                            {...field}
                          />
                        </FormControl>
                        <div className="text-xs text-muted-foreground text-right">
                          {field.value?.length || 0}/250 caracteres
                        </div>
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

          {/* Botão de Exportação */}
          <Dialog open={isExportDialogOpen} onOpenChange={setIsExportDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="border-border mr-3">
                <Download className="w-4 h-4 mr-2" />
                Exportar
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[400px]">
              <DialogHeader>
                <DialogTitle>Exportar Dados</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="text-sm text-muted-foreground">
                  Escolha o tipo de exportação desejada:
                </div>

                <div className="grid gap-3">
                  <div className="space-y-2">
                    <h4 className="font-medium">Exportar Planilha</h4>
                    <p className="text-sm text-muted-foreground">
                      Baixar dados dos pedidos em formato de planilha
                    </p>
                    <div className="flex gap-2">
                      <Button
                        onClick={() => handleExportData('csv')}
                        disabled={isExporting || filteredAndSortedOrders.length === 0}
                        className="flex-1"
                      >
                        {isExporting ? "Exportando..." : "CSV"}
                      </Button>
                      <Button
                        onClick={() => handleExportData('xlsx')}
                        disabled={isExporting || filteredAndSortedOrders.length === 0}
                        className="flex-1"
                      >
                        {isExporting ? "Exportando..." : "XLSX"}
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <h4 className="font-medium">Exportar Notas Fiscais</h4>
                    <p className="text-sm text-muted-foreground">
                      Baixar notas fiscais e certificados em arquivo ZIP
                    </p>
                    <Button
                      onClick={handleExportNotes}
                      disabled={isExporting || filteredAndSortedOrders.length === 0}
                      className="w-full"
                      variant="outline"
                    >
                      {isExporting ? "Gerando ZIP..." : "Baixar ZIP"}
                    </Button>
                  </div>
                </div>

                {filteredAndSortedOrders.length === 0 && (
                  <div className="text-sm text-amber-600 bg-amber-50 p-3 rounded-md">
                    Nenhum pedido encontrado para exportar
                  </div>
                )}
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Filtros */}
        <div className="flex-1 flex gap-3 items-center">
          {/* Campo de busca */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar pedidos..."
              className="pl-8 bg-input border-border"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          {/* Filtro de período */}
          <div className="flex gap-2 items-center">
            <Label className="text-sm text-muted-foreground whitespace-nowrap">Período:</Label>
            <Input
              type="date"
              placeholder="Data inicial"
              className="w-[140px] bg-input border-border"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
            <span className="text-muted-foreground">até</span>
            <Input
              type="date"
              placeholder="Data final"
              className="w-[140px] bg-input border-border"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>

          {/* Filtro de produto */}
          <Select value={productFilter} onValueChange={setProductFilter}>
            <SelectTrigger className="w-[180px] bg-input border-border">
              <SelectValue placeholder="Todos os produtos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os produtos</SelectItem>
              {products.map((product) => (
                <SelectItem key={product.id} value={product.id.toString()}>
                  {product.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

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

          {/* Botão para limpar filtros */}
          {(searchTerm || statusFilter !== "all" || productFilter !== "all" || startDate || endDate) && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSearchTerm("");
                setStatusFilter("all");
                setProductFilter("all");
                setStartDate("");
                setEndDate("");
              }}
              className="border-border"
            >
              <Filter className="w-4 h-4 mr-1" />
              Limpar
            </Button>
          )}
        </div>
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
                    <TableHead>
                      <Button
                        variant="ghost"
                        className="h-auto p-0 font-semibold hover:bg-transparent"
                        onClick={() => handleSort('product')}
                      >
                        Produto
                        {sortColumn === 'product' && (
                          sortDirection === 'asc' ? 
                          <ChevronUp className="ml-1 h-4 w-4" /> : 
                          <ChevronDown className="ml-1 h-4 w-4" />
                        )}
                      </Button>
                    </TableHead>
                    <TableHead>
                      <Button
                        variant="ghost"
                        className="h-auto p-0 font-semibold hover:bg-transparent"
                        onClick={() => handleSort('quantity')}
                      >
                        Quantidade
                        {sortColumn === 'quantity' && (
                          sortDirection === 'asc' ? 
                          <ChevronUp className="ml-1 h-4 w-4" /> : 
                          <ChevronDown className="ml-1 h-4 w-4" />
                        )}
                      </Button>
                    </TableHead>
                    <TableHead>
                      <Button
                        variant="ghost"
                        className="h-auto p-0 font-semibold hover:bg-transparent"
                        onClick={() => handleSort('supplier')}
                      >
                        Fornecedor
                        {sortColumn === 'supplier' && (
                          sortDirection === 'asc' ? 
                          <ChevronUp className="ml-1 h-4 w-4" /> : 
                          <ChevronDown className="ml-1 h-4 w-4" />
                        )}
                      </Button>
                    </TableHead>
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
                    <TableHead>
                      <Button
                        variant="ghost"
                        className="h-auto p-0 font-semibold hover:bg-transparent"
                        onClick={() => handleSort('status')}
                      >
                        Status
                        {sortColumn === 'status' && (
                          sortDirection === 'asc' ? 
                          <ChevronUp className="ml-1 h-4 w-4" /> : 
                          <ChevronDown className="ml-1 h-4 w-4" />
                        )}
                      </Button>
                    </TableHead>
                    {isKeyUser && <TableHead className="text-right">Ações</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAndSortedOrders.map((order) => {
                    const product = products.find(
                      (p) => p.id === (order as any).product_id,
                    );
                    const company = companies.find(
                      (c) => c.id === (order as any).supplier_id,
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
                          {(order as any).order_id || "N/A"}
                        </TableCell>
                        <TableCell>{product?.name || "N/A"}</TableCell>
                        <TableCell>
                          {formatNumber(order.quantity)} {unit?.abbreviation || ""}
                        </TableCell>
                        <TableCell>{company?.name || "N/A"}</TableCell>
                        <TableCell>{formatDate((order as any).delivery_date)}</TableCell>
                        <TableCell>
                          <Badge className={getStatusColor(order.status)}>
                            {order.status}
                          </Badge>
                          {(() => {
                            // Calcular se é urgente baseado na data de entrega
                            const deliveryDate = new Date((order as any).delivery_date);
                            deliveryDate.setHours(0, 0, 0, 0);
                            const today = new Date();
                            today.setHours(0, 0, 0, 0);
                            const daysDiff = Math.ceil((deliveryDate.getTime() - today.getTime()) / (1000 * 3600 * 24));
                            const isUrgent = daysDiff <= 7 && order.status === "Registrado";
                            
                            return isUrgent && (
                              <Badge variant="destructive" className="ml-2">
                                <AlertTriangle size={12} className="mr-1" />
                                Urgente
                              </Badge>
                            );
                          })()}
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
                                    Tem certeza que deseja excluir o pedido {(order as any).order_id || order.id}?
                                    O pedido será ocultado e poderá ser recuperado no banco de dados quando necessário.
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