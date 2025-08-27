import React, { useState, useEffect, Fragment } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger, 
  DialogDescription,
  DialogFooter
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
import { OrderCompraDetailDrawer } from "@/components/OrderCompraDetailDrawer";
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
  Plus, 
  Search,
  Trash2,
  Building,
  Calendar,
  Package,
  Loader2,
  Pencil,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  RefreshCw,
  Info
} from "lucide-react";
import { formatDate } from "@/lib/utils";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useAuth } from "@/context/AuthContext";

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

// Componente para mostrar saldo disponível de um produto na ordem
function SaldoProduto({ ordemId, produtoId }: { ordemId: number, produtoId: number }) {
  const [isLoading, setIsLoading] = useState(false);
  const [saldo, setSaldo] = useState<any>(null);

  const fetchSaldo = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/ordens-compra/${ordemId}/produtos/${produtoId}/saldo`);
      const data = await response.json();
      setSaldo(data);
    } catch (error) {
      console.error("Erro ao verificar saldo:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Buscar saldo ao montar o componente
  useEffect(() => {
    fetchSaldo();
  }, [ordemId, produtoId]);

  if (isLoading) {
    return (
      <div className="flex items-center gap-2">
        <Loader2 className="h-3 w-3 animate-spin" />
        <span className="text-xs">Carregando...</span>
      </div>
    );
  }

  if (!saldo || !saldo.sucesso) {
    return (
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-destructive">Erro ao verificar saldo</span>
        <Button variant="outline" size="sm" className="h-6 text-xs" onClick={fetchSaldo}>
          <RefreshCw className="h-3 w-3 mr-1" />
          Tentar novamente
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between gap-2">
              <span className="text-sm">
          {formatNumber(saldo.saldoDisponivel)} {saldo.unidade}
          <span className="text-xs text-muted-foreground ml-1">
            (Total: {formatNumber(saldo.quantidadeTotal)} / Usado: {formatNumber(saldo.quantidadeUsada)})
          </span>
        </span>
      <Button variant="outline" size="sm" className="h-6 text-xs" onClick={fetchSaldo}>
        <RefreshCw className="h-3 w-3 mr-1" />
        Atualizar
      </Button>
    </div>
  );
}
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

// Definir tipo para empresa
type Company = {
  id: number;
  name: string;
  contractNumber: string | null;
  category?: {
    name?: string;
    receivesPurchaseOrders: boolean;
    requiresContract: boolean;
  };
  cnpj?: string;
};

// Definir tipo para produto
type Product = {
  id: number;
  name: string;
  unitId: number;
};

// Definir tipo para ordens de compra
type OrdemCompra = {
  id: number;
  numero_ordem: string;
  empresa_id: number;
  empresa_nome: string;
  valido_ate: string;
  status: string;
  data_criacao: string;
};

// Definir tipo para itens de ordem
type OrdemCompraItem = {
  id: number;
  ordem_compra_id: number;
  produto_id: number;
  quantidade: string;
  produto_nome?: string;
};

// Função para obter data mínima (hoje)
const getTodayFormatted = () => {
  const today = new Date();
  return today.toISOString().split('T')[0]; // Formato YYYY-MM-DD
};

// Esquema de validação para o formulário
const purchaseOrderSchema = z.object({
  orderNumber: z.string()
    .min(5, "Número da ordem deve ter 5 dígitos")
    .max(6, "Número da ordem deve ter até 6 dígitos")
    .regex(/^\d+$/, "Número da ordem deve conter apenas dígitos"),
  companyId: z.string().min(1, "Fornecedor é obrigatório"),
  obraId: z.string().min(1, "Obra é obrigatória"),
  validUntil: z.string()
    .min(1, "Data de validade é obrigatória")
    .refine((date) => {
      // Comparar com a data atual
      const selectedDate = new Date(date);
      const today = new Date();
      today.setHours(0, 0, 0, 0); // Zerar horas para comparação apenas de datas
      return selectedDate >= today;
    }, "A data deve ser igual ou posterior a hoje"),
  items: z.array(z.object({
    productId: z.string().min(1, "Produto é obrigatório"),
    quantity: z.string()
      .min(1, "Quantidade é obrigatória")
      .refine((val) => parseInt(val) > 0, "A quantidade deve ser maior que zero"),
  })).min(1, "Pelo menos um produto é obrigatório").max(4, "Máximo 4 produtos por ordem"),
});

type PurchaseOrderFormData = z.infer<typeof purchaseOrderSchema>;

export default function OrdensCompra() {
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<OrdemCompra | null>(null);
  const [selectedPdfFile, setSelectedPdfFile] = useState<File | null>(null);

  // Verificar se o usuário é keyuser
  const isKeyUser = user?.isKeyUser || user?.isDeveloper;
  const [orderItems, setOrderItems] = useState<OrdemCompraItem[]>([]);
  const queryClient = useQueryClient();

  // Estados para ordenação
  const [sortColumn, setSortColumn] = useState<'id' | 'validUntil' | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  // Formulário para edição
  const editForm = useForm<PurchaseOrderFormData>({
    resolver: zodResolver(purchaseOrderSchema),
    defaultValues: {
      orderNumber: "",
      companyId: "",
      obraId: "",
      validUntil: "",
      items: [{ productId: "", quantity: "" }],
    },
  });

  // Estado para controle do drawer de detalhes
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null);

  // Função para mostrar detalhes de uma ordem
  const showOrderDetails = (orderId: number) => {
    setSelectedOrderId(orderId);
    setDrawerOpen(true);
  };

  // Buscar todas as ordens de compra (incluindo expiradas para visualização)
  const { data: ordens = [], isLoading } = useQuery<OrdemCompra[]>({
    queryKey: ["/api/ordens-compra-todas"],
    queryFn: async () => {
      const response = await fetch(`/api/ordens-compra`);
      if (!response.ok) {
        throw new Error("Falha ao carregar ordens de compra");
      }
      const data = await response.json();
      console.log(`📋 Ordens de compra carregadas para visualização: ${data.length} (incluindo expiradas)`);
      return data;
    },
  });

  const { data: companies = [] } = useQuery<Company[]>({
    queryKey: ["/api/empresas-para-ordens-compra"],
  });

  // Não usamos a rota específica devido a problemas de conexão com o banco de dados
  // Em vez disso, filtramos os dados localmente
  const obras = companies.filter(company => 
    company.contractNumber && company.contractNumber.trim() !== ''
  );

  const { data: products = [] } = useQuery<Product[]>({
    queryKey: ["/api/products"],
  });

  // Função para verificar se o pedido está expirado
  const isOrderExpired = (validUntil: string): boolean => {
    const validDate = new Date(validUntil);
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Zerar horas para comparação apenas de datas
    return validDate < today;
  };

  // Função para obter status real com base na data de validade
  const getRealStatus = (ordem: OrdemCompra): string => {
    if (isOrderExpired(ordem.valido_ate)) {
      return "Expirado";
    }
    return ordem.status;
  };

  // Configurar formulário com react-hook-form e zod
  const form = useForm<PurchaseOrderFormData>({
    resolver: zodResolver(purchaseOrderSchema),
    defaultValues: {
      orderNumber: "",
      companyId: "",
      obraId: "",
      validUntil: "",
      items: [{ productId: "", quantity: "" }],
    },
  });

  // Função para lidar com a ordenação
  const handleSort = (column: 'id' | 'validUntil') => {
    if (sortColumn === column) {
      // Se já está ordenando por esta coluna, inverte a direção
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      // Se é uma nova coluna, define como crescente
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  // Filtrar e ordenar ordens pelo termo de busca e status
  const ordensFiltradas = ordens
    .filter(ordem => {
      const matchesSearch = ordem.numero_ordem.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           ordem.empresa_nome.toLowerCase().includes(searchTerm.toLowerCase());

      const realStatus = getRealStatus(ordem);
      const matchesStatus = statusFilter === "all" || realStatus.toLowerCase() === statusFilter.toLowerCase();

      return matchesSearch && matchesStatus;
    })
    .sort((a, b) => {
      if (!sortColumn) return 0;

      let aValue: any;
      let bValue: any;

      if (sortColumn === 'id') {
        aValue = a.id;
        bValue = b.id;
      } else if (sortColumn === 'validUntil') {
        aValue = new Date(a.valido_ate);
        bValue = new Date(b.valido_ate);
      }

      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

  // Adicionar item ao formulário
  const addItem = () => {
    const currentItems = form.getValues("items");
    if (currentItems.length < 4) {
      form.setValue("items", [...currentItems, { productId: "", quantity: "" }]);
    }
  };

  // Remover item do formulário
  const removeItem = (index: number) => {
    const currentItems = form.getValues("items");
    if (currentItems.length > 1) {
      form.setValue("items", currentItems.filter((_, i) => i !== index));
    }
  };

  // Função para criar nova ordem
  const onSubmit = async (data: PurchaseOrderFormData) => {
    try {
      // Verificar se tem empresa disponível com contrato
      if (!hasAvailableCompanies) {
        toast({
          title: "Erro",
          description: "Não há empresas com contrato ativo disponíveis para criar uma ordem de compra",
          variant: "destructive"
        });
        return;
      }

      setIsSubmitting(true);

      // Buscar o CNPJ da obra selecionada
      const obraSelecionada = obras.find(obra => obra.id === parseInt(data.obraId));
      if (!obraSelecionada) {
        throw new Error("Obra selecionada não encontrada");
      }

      // Formatar dados para envio
      const formattedData = {
        numeroOrdem: data.orderNumber,
        empresaId: parseInt(data.companyId),
        cnpj: obraSelecionada.cnpj, // CNPJ da obra de destino
        validoAte: new Date(data.validUntil).toISOString(),
        produtos: data.items.map(item => ({
          id: parseInt(item.productId),
          qtd: parseInt(item.quantity)
        }))
      };

      // Enviar requisição
      const response = await fetch("/api/ordem-compra-nova", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formattedData)
      });

      if (!response.ok) {
        const responseData = await response.json().catch(() => null);
        const errorMessage = responseData?.mensagem || await response.text() || "Erro ao criar ordem";
        throw new Error(errorMessage);
      }

      const resultado = await response.json();

      if (!resultado.sucesso) {
        throw new Error(resultado.mensagem || "Erro ao criar ordem");
      }

      // Se há arquivo PDF, fazer upload
      if (selectedPdfFile && resultado.ordem) {
        try {
          const formData = new FormData();
          formData.append('ordem_pdf', selectedPdfFile);

          const uploadResponse = await fetch(`/api/ordem-compra/${resultado.ordem.id}/upload-pdf`, {
            method: "POST",
            body: formData
          });

          if (!uploadResponse.ok) {
            console.warn("Erro ao fazer upload do PDF, mas ordem foi criada");
          }
        } catch (uploadError) {
          console.warn("Erro ao fazer upload do PDF:", uploadError);
        }
      }

      // Sucesso!
      toast({
        title: "Sucesso!",
        description: "Ordem de compra criada com sucesso"
      });

      // Limpar e fechar formulário
      form.reset();
      setSelectedPdfFile(null);
      setIsDialogOpen(false);

      // Atualizar dados
      queryClient.invalidateQueries({ queryKey: ["/api/ordens-compra"] });

    } catch (error) {
      toast({
        title: "Erro",
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Função para obter cor do status
  const getStatusColor = (status: string): "default" | "destructive" | "secondary" | "outline" => {
    switch (status.toLowerCase()) {
      case 'ativo':
        return 'default';
      case 'pendente':
        return 'destructive';
      case 'processando':
        return 'secondary';
      case 'expirado':
        return 'destructive';
      default:
        return 'outline';
    }
  };

  // Filtrar empresas para ordens de compra - versão mais flexível
  const filteredCompanies = companies.filter(company => {
    // Se a categoria não existir, permitir a empresa por padrão
    if (!company.category) return true;

    // Se a categoria existir, verificar se pode receber ordens de compra
    // Se receivesPurchaseOrders for undefined ou true, permitir a empresa
    const canReceiveOrders = company.category.receivesPurchaseOrders !== false;

    // Se não precisar de contrato, incluir a empresa
    const requiresContract = company.category.requiresContract === true;

    // Se precisar de contrato, verificar se tem
    const hasContract = requiresContract ? 
      (company.contractNumber && company.contractNumber.trim() !== '') : true;

    return canReceiveOrders && hasContract;
  });

  // Filtrar apenas empresas com contrato preenchido para o campo de Obra
  const filteredObras = companies.filter(company => 
    company.contractNumber && company.contractNumber.trim() !== ''
  );

  // Verificar se há empresas disponíveis para seleção
  const hasAvailableCompanies = filteredCompanies.length > 0;

  return (
    <div className="space-y-6">
      {/* Drawer para exibir detalhes da ordem */}
      <OrderCompraDetailDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        ordemId={selectedOrderId}
      />

      {/* Header com ações */}
      <div className="flex justify-between items-center mb-6">

        {/* Diálogo de Edição da Ordem de Compra */}
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Editar Ordem de Compra</DialogTitle>
              <DialogDescription>
                Modifique os campos abaixo para atualizar a ordem de compra.
              </DialogDescription>
            </DialogHeader>

            <Form {...editForm}>
              <form onSubmit={editForm.handleSubmit(async (data) => {
                if (!selectedOrder) return;

                setIsSubmitting(true);
                try {
                  // Transformar os dados
                  const requestData = {
                    numeroOrdem: data.orderNumber,
                    empresaId: parseInt(data.companyId),
                    obraId: parseInt(data.obraId),
                    validoAte: new Date(data.validUntil).toISOString(),
                    items: data.items.map(item => ({
                      productId: parseInt(item.productId),
                      quantity: item.quantity
                    }))
                  };

                  const response = await fetch(`/api/ordem-compra/${selectedOrder.id}`, {
                    method: 'PUT',
                    headers: {
                      'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(requestData),
                  });

                  if (!response.ok) {
                    throw new Error('Falha ao atualizar ordem');
                  }

                  toast({
                    title: "Sucesso",
                    description: "Ordem atualizada com sucesso",
                  });

                  // Fechar diálogo e recarregar dados
                  setIsEditDialogOpen(false);
                  queryClient.invalidateQueries({ queryKey: ["/api/ordens-compra"] });
                } catch (error) {
                  toast({
                    title: "Erro",
                    description: "Erro ao atualizar ordem de compra",
                    variant: "destructive",
                  });
                  console.error(error);
                } finally {
                  setIsSubmitting(false);
                }
              })} className="space-y-6">
                <div className="grid grid-cols-1 gap-4">
                  <FormField
                    control={editForm.control}
                    name="orderNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Número da Ordem</FormLabel>
                        <FormControl>
                          <Input {...field} maxLength={6} className="bg-input border-border" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={editForm.control}
                    name="companyId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Fornecedor</FormLabel>
                        <Select 
                          onValueChange={field.onChange} 
                          defaultValue={field.value}
                        >
                          <FormControl>
                            <SelectTrigger className="bg-input border-border">
                              <SelectValue placeholder="Selecione um fornecedor" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {companies.map((company) => (
                              <SelectItem key={company.id} value={company.id.toString()}>
                                {company.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={editForm.control}
                    name="obraId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Obra</FormLabel>
                        <Select 
                          onValueChange={field.onChange} 
                          defaultValue={field.value}
                        >
                          <FormControl>
                            <SelectTrigger className="bg-input border-border">
                              <SelectValue placeholder="Selecione uma obra" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {obras.map((obra) => (
                              <SelectItem key={obra.id} value={obra.id.toString()}>
                                {obra.name} {obra.contractNumber ? `(${obra.contractNumber})` : ''}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={editForm.control}
                    name="validUntil"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Válido Até</FormLabel>
                        <FormControl>
                          <Input 
                            type="date"
                            min={getTodayFormatted()}
                            {...field}
                            className="bg-input border-border"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Lista de itens */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <h3 className="text-sm font-medium">Produtos</h3>
                  </div>

                  {orderItems.map((item, index) => (
                    <div key={item.id} className="flex items-center gap-2">
                      <div className="flex-1">
                        <p className="text-sm font-medium">{item.produto_nome || `Produto #${item.produto_id}`}</p>
                        <p className="text-xs text-muted-foreground">Quantidade: {formatNumber(item.quantidade)}</p>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsEditDialogOpen(false)}
                  >
                    Cancelar
                  </Button>
                  <Button 
                    type="submit"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Salvando...
                      </>
                    ) : (
                      "Salvar Alterações"
                    )}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>

        {/* Botão Nova Ordem */}
        {hasAvailableCompanies && (
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Nova Ordem
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Nova Ordem de Compra</DialogTitle>
              <DialogDescription>
                Preencha os campos abaixo para criar uma nova ordem de compra.
              </DialogDescription>
            </DialogHeader>

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="orderNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Número da Ordem</FormLabel>
                        <FormControl>
                          <Input 
                            {...field} 
                            placeholder="Digite o número da ordem (até 6 dígitos)"
                            maxLength={6}
                            className="bg-input border-border"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="companyId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Fornecedor</FormLabel>
                        <Select 
                          onValueChange={field.onChange} 
                          defaultValue={field.value}
                        >
                          <FormControl>
                            <SelectTrigger className="bg-input border-border">
                              <SelectValue placeholder="Selecione um fornecedor" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {filteredCompanies.map((company) => (
                              <SelectItem key={company.id} value={company.id.toString()}>
                                {company.name}
                                {company.contractNumber && 
                                  ` (Contrato: ${company.contractNumber})`}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="obraId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Obra</FormLabel>
                        <Select 
                          onValueChange={field.onChange} 
                          defaultValue={field.value}
                        >
                          <FormControl>
                            <SelectTrigger className="bg-input border-border">
                              <SelectValue placeholder="Selecione uma obra" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {obras.map((obra) => (
                              <SelectItem key={obra.id} value={obra.id.toString()}>
                                {obra.name} {obra.contractNumber ? `(${obra.contractNumber})` : ''}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="validUntil"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Válido Até</FormLabel>
                        <FormControl>
                          <Input 
                            type="date" 
                            {...field}
                            min={getTodayFormatted()}
                            className="bg-input border-border"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Upload de PDF */}
                <div className="col-span-full">
                  <FormItem>
                    <FormLabel>Anexar PDF da Ordem de Compra</FormLabel>
                    <FormControl>
                      <Input 
                        type="file" 
                        accept=".pdf"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            setSelectedPdfFile(file);
                          }
                        }}
                        className="bg-input border-border"
                      />
                    </FormControl>
                    <p className="text-xs text-muted-foreground">
                      Selecione um arquivo PDF para anexar à ordem de compra
                    </p>
                  </FormItem>
                </div>

                {/* Produtos */}
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <h3 className="text-base font-medium">Produtos</h3>
                    {form.watch("items").length < 4 && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={addItem}
                      >
                        <Plus className="h-4 w-4 mr-1" />
                        Adicionar Produto
                      </Button>
                    )}
                  </div>

                  {form.watch("items").map((item, index) => (
                    <Card key={index}>
                      <CardContent className="pt-4">
                        <div className="flex flex-col md:flex-row gap-4 items-end">
                          <div className="flex-1">
                            <FormField
                              control={form.control}
                              name={`items.${index}.productId`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Produto</FormLabel>
                                  <Select 
                                    onValueChange={field.onChange} 
                                    defaultValue={field.value}
                                  >
                                    <FormControl>
                                      <SelectTrigger className="bg-input border-border">
                                        <SelectValue placeholder="Selecione um produto" />
                                      </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                      {products.map((product) => (
                                        <SelectItem 
                                          key={product.id} 
                                          value={product.id.toString()}
                                        >
                                          {product.name}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>

                          <div className="w-32">
                            <FormField
                              control={form.control}
                              name={`items.${index}.quantity`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Quantidade</FormLabel>
                                  <FormControl>
                                    <Input 
                                      {...field} 
                                      type="number" 
                                      min="1"
                                      placeholder="Qtd"
                                      className="bg-input border-border"
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>

                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="self-end"
                            onClick={() => removeItem(index)}
                            disabled={form.watch("items").length <= 1}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsDialogOpen(false)}
                  >
                    Cancelar
                  </Button>
                  <Button 
                    type="submit"
                    disabled={isSubmitting}
                    className="bg-primary hover:bg-primary/90"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Criando...
                      </>
                    ) : (
                      "Criar Ordem de Compra"
                    )}
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
            placeholder="Buscar ordem..."
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
            <SelectItem value="ativo">Ativo</SelectItem>
            <SelectItem value="expirado">Expirado</SelectItem>
            <SelectItem value="pendente">Pendente</SelectItem>
            <SelectItem value="processando">Processando</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Lista de Ordens de Compra */}
      <Card className="mt-4">
        <CardHeader className="pb-3">
          <CardTitle>Ordens de Compra</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-10">Carregando ordens de compra...</div>
          ) : ordensFiltradas.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[100px]">
                    <Button
                      variant="ghost"
                      className="h-auto p-0 font-semibold hover:bg-transparent"
                      onClick={() => handleSort('id')}
                    >
                      Número
                      {sortColumn === 'id' && (
                        sortDirection === 'asc' ? 
                        <ChevronUp className="ml-1 h-4 w-4" /> : 
                        <ChevronDown className="ml-1 h-4 w-4" />
                      )}
                    </Button>
                  </TableHead>
                  <TableHead>Fornecedor</TableHead>
                  <TableHead>
                    <Button
                      variant="ghost"
                      className="h-auto p-0 font-semibold hover:bg-transparent"
                      onClick={() => handleSort('validUntil')}
                    >
                      Válido Até
                      {sortColumn === 'validUntil' && (
                        sortDirection === 'asc' ? 
                        <ChevronUp className="ml-1 h-4 w-4" /> : 
                        <ChevronDown className="ml-1 h-4 w-4" />
                      )}
                    </Button>
                  </TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ordensFiltradas.map((ordem) => (
                  <TableRow 
                    key={ordem.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => showOrderDetails(ordem.id)}
                  >
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                          {ordem.numero_ordem}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center">
                          <Building className="h-4 w-4 mr-2 text-muted-foreground" />
                          {ordem.empresa_nome || "Empresa não encontrada"}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center">
                          <Calendar className="h-4 w-4 mr-2 text-muted-foreground" />
                          {formatDate(new Date(ordem.valido_ate))}
                        </div>
                      </TableCell>
                      <TableCell>
                        {(() => {
                          const status = getRealStatus(ordem);
                          return (
                            <Badge variant={getStatusColor(status)}>
                              {status}
                            </Badge>
                          );
                        })()}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                        {/* Botão de exclusão apenas para keyuser */}
                        {isKeyUser && (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                title="Excluir ordem"
                                onClick={(e) => e.stopPropagation()} // Evita que o clique abra o drawer
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
                              <AlertDialogDescription>
                                Tem certeza que deseja excluir a ordem de compra {ordem.numero_ordem}?
                                Esta ação não pode ser desfeita.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction 
                                onClick={async () => {
                                  try {
                                    const response = await fetch(`/api/ordem-compra/${ordem.id}`, {
                                      method: 'DELETE'
                                    });

                                    if (!response.ok) {
                                      throw new Error('Falha ao excluir ordem');
                                    }

                                    toast({
                                      title: "Sucesso",
                                      description: "Ordem excluída com sucesso",
                                    });

                                    queryClient.invalidateQueries({ queryKey: ["/api/ordens-compra"] });
                                  } catch (error) {
                                    toast({
                                      title: "Erro",
                                      description: "Não foi possível excluir a ordem",
                                      variant: "destructive"
                                    });
                                  }
                                }}
                              >
                                Excluir
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <Package className="h-10 w-10 mb-2 text-muted-foreground" />
              <p className="text-muted-foreground">
                {searchTerm 
                  ? "Nenhuma ordem de compra encontrada com este termo de busca."
                  : "Nenhuma ordem de compra cadastrada ainda."
                }
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}