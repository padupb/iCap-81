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
  RefreshCw,
  Info
} from "lucide-react";
import { formatDate } from "@/lib/utils";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";

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
        {saldo.saldoDisponivel} {saldo.unidade}
        <span className="text-xs text-muted-foreground ml-1">
          (Total: {saldo.quantidadeTotal} / Usado: {saldo.quantidadeUsada})
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
    .min(1, "Número da ordem é obrigatório")
    .max(6, "Número da ordem deve ter no máximo 6 dígitos")
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
  const [searchTerm, setSearchTerm] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<OrdemCompra | null>(null);
  const [orderItems, setOrderItems] = useState<OrdemCompraItem[]>([]);
  const queryClient = useQueryClient();

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

  // Estado para controle do diálogo de detalhes
  const [detailsOrderId, setDetailsOrderId] = useState<number | null>(null);
  const [isDetailsDialogOpen, setIsDetailsDialogOpen] = useState(false);
  const [detailsItems, setDetailsItems] = useState<any[]>([]);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);

  // Função para mostrar detalhes de uma ordem
  const showOrderDetails = async (orderId: number) => {
    setDetailsOrderId(orderId);
    setIsLoadingDetails(true);

    try {
      const response = await fetch(`/api/ordem-compra/${orderId}/itens`);
      if (!response.ok) throw new Error('Falha ao carregar detalhes');

      const items = await response.json();
      setDetailsItems(items);
      setIsDetailsDialogOpen(true);
    } catch (error) {
      console.error('Erro ao carregar detalhes:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível carregar os detalhes da ordem',
        variant: 'destructive'
      });
    } finally {
      setIsLoadingDetails(false);
    }
  };

  // Buscar dados usando nossas rotas
  const { data: ordens = [], isLoading } = useQuery<OrdemCompra[]>({
    queryKey: ["/api/ordens-compra"],
  });

  const { data: companies = [] } = useQuery<Company[]>({
    queryKey: ["/api/empresas-para-ordens-compra"],
  });

  const { data: products = [] } = useQuery<Product[]>({
    queryKey: ["/api/products"],
  });

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

  // Filtrar ordens pelo termo de busca
  const ordensFiltradas = ordens.filter(ordem => 
    ordem.numero_ordem.toLowerCase().includes(searchTerm.toLowerCase())
  );

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

      // Corrigir data para evitar mudança de dia devido ao timezone
        const [year, month, day] = data.validUntil.split('-');
        const correctedDate = new Date(Date.UTC(parseInt(year), parseInt(month) - 1, parseInt(day), 12, 0, 0));

        // Formatar dados para envio
        const formattedData = {
          numeroOrdem: data.orderNumber,
          empresaId: parseInt(data.companyId),
          obraId: parseInt(data.obraId),
          validoAte: correctedDate.toISOString(),
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

      // Sucesso!
      toast({
        title: "Sucesso!",
        description: "Ordem de compra criada com sucesso"
      });

      // Limpar e fechar formulário
      form.reset();
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

  // Verificar se há empresas disponíveis para seleção
  const hasAvailableCompanies = filteredCompanies.length > 0;

  return (
    <div className="space-y-6">
      {/* Diálogo para exibir detalhes da ordem */}
      <Dialog open={isDetailsDialogOpen} onOpenChange={setIsDetailsDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Detalhes da Ordem de Compra</DialogTitle>
            <DialogDescription>
              Produtos, quantidades e saldo disponível nesta ordem
            </DialogDescription>
          </DialogHeader>

          {isLoadingDetails ? (
            <div className="flex justify-center py-6">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : detailsItems.length === 0 ? (
            <div className="text-center py-6">
              <Package className="h-12 w-12 mx-auto mb-2 text-muted-foreground" />
              <p className="text-muted-foreground">Nenhum produto encontrado nesta ordem.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {detailsItems.map((item: any) => (
                <Card key={item.id} className="bg-muted/40">
                  <CardContent className="pt-6">
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="text-base font-medium">
                          {item.produto_nome || `Produto #${item.produto_id}`}
                        </h4>
                        <p className="text-sm text-muted-foreground mt-1">
                          Quantidade: {item.quantidade}
                        </p>
                      </div>

                      <div className="text-sm">
                        <SaldoProduto 
                          ordemId={detailsOrderId!} 
                          produtoId={item.produto_id} 
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setIsDetailsDialogOpen(false)}
            >
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Header com ações */}
      <div className="flex justify-between items-center">
        <div className="relative w-64">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar ordem..."
            className="pl-8 bg-input border-border"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

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
                    body: JSON.JSON.stringify(requestData),
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
                          <Input {...field} maxLength={5} />
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
                        <FormLabel>Empresa</FormLabel>
                        <Select 
                          onValueChange={field.onChange} 
                          defaultValue={field.value}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione uma empresa" />
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
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione uma obra" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {companies.map((company) => (
                              <SelectItem key={company.id} value={company.id.toString()}>
                                {company.name} - Obra Principal
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
                        <p className="text-xs text-muted-foreground">Quantidade: {item.quantidade}</p>
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

        {/* Diálogo de Criação de Nova Ordem de Compra */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button disabled={!hasAvailableCompanies}>
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
                            placeholder="Digite o número (5 dígitos)" 
                            maxLength={5}
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
                        <FormLabel>Empresa</FormLabel>
                        <Select 
                          onValueChange={field.onChange} 
                          defaultValue={field.value}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione uma empresa" />
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
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione uma obra" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {filteredCompanies.map((company) => (
                              <SelectItem key={company.id} value={company.id.toString()}>
                                {company.name} - Obra Principal
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
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
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
                                      <SelectTrigger>
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
      </div>

      {/* Lista de Ordens de Compra */}
      <Card>
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
                  <TableHead className="w-[100px]">Número</TableHead>
                  <TableHead>Empresa</TableHead>
                  <TableHead>Válido Até</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ordensFiltradas.map((ordem) => (
                  <TableRow key={ordem.id}>
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
                        <Button 
                          variant="ghost" 
                          size="icon"
                          title="Ver detalhes da ordem"
                          onClick={(e) => {
                            e.preventDefault();
                            showOrderDetails(ordem.id);
                          }}
                        >
                          <Info className="h-4 w-4" />
                        </Button>

                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" title="Excluir ordem">
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