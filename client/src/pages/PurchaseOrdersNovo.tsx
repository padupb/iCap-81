import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
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
  Eye, 
  Edit, 
  Trash2,
  Building,
  Calendar,
  Package
} from "lucide-react";
import { getStatusColor, formatDate } from "@/lib/utils";
import { insertPurchaseOrderSchema, type PurchaseOrder, type Product, type Company, type PurchaseOrderItem } from "@shared/schema";
import { z } from "zod";

// Esquema de formulário para validação
const purchaseOrderFormSchema = z.object({
  orderNumber: z.string().min(5, "Número da ordem deve ter 5 dígitos").max(5, "Número da ordem deve ter 5 dígitos")
    .regex(/^\d+$/, "Número da ordem deve conter apenas dígitos"),
  companyId: z.number().min(1, "Fornecedor é obrigatório"),
  obraId: z.number().min(1, "Obra é obrigatória"),
  validUntil: z.string().min(1, "Data de validade é obrigatória"),
  items: z.array(z.object({
    productId: z.number().min(1, "Produto é obrigatório"),
    quantity: z.string().min(1, "Quantidade é obrigatória"),
  })).min(1, "Pelo menos um produto é obrigatório").max(4, "Máximo 4 produtos por ordem"),
});

type PurchaseOrderFormData = z.infer<typeof purchaseOrderFormSchema>;

export default function PurchaseOrdersNovo() {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  const queryClient = useQueryClient();

  // Definir tipo para incluir nome da empresa
  type PurchaseOrderWithCompanyName = PurchaseOrder & {
    companyName?: string;
  };

  // Buscar dados necessários com tipo adaptado
  const { data: purchaseOrders = [], isLoading } = useQuery<PurchaseOrderWithCompanyName[]>({
    queryKey: ["/api/purchase-orders"],
  });

  const { data: products = [] } = useQuery<Product[]>({
    queryKey: ["/api/products"],
  });

  const { data: companies = [] } = useQuery<Company[]>({
    queryKey: ["/api/companies"],
  });
  
  // Definir tipo para obras
  type Obra = {
    id: number;
    nome: string;
    endereco?: string;
    empresa_id?: number;
    empresa_nome?: string;
  };

  // Buscar dados de obras
  const { data: obras = [] } = useQuery<Obra[]>({
    queryKey: ["/api/obras"],
  });

  // Mutation para criar ordem de compra
  const createPurchaseOrderMutation = useMutation({
    mutationFn: async (data: PurchaseOrderFormData) => {
      try {
        const { items, ...purchaseOrderData } = data;
        
        // NOVO FORMATO SIMPLIFICADO
        const dadosFormatados = {
          numero: purchaseOrderData.orderNumber.trim(),
          empresa: parseInt(purchaseOrderData.companyId.toString()),
          obra: parseInt(purchaseOrderData.obraId.toString()),
          validade: new Date(data.validUntil).toISOString(),
          produtos: items
            .filter(item => item.productId && item.quantity)
            .map(item => ({
              id: parseInt(item.productId.toString()),
              qtd: parseInt(item.quantity)
            }))
        };
        
        console.log("Enviando dados no novo formato:", JSON.stringify(dadosFormatados, null, 2));
        
        // Nova rota dedicada
        const response = await fetch("/api/ordem-compra-nova", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Accept": "application/json" 
          },
          body: JSON.stringify(dadosFormatados)
        });
        
        if (!response.ok) {
          let mensagemErro = "Erro ao criar ordem de compra";
          try {
            const errorData = await response.json();
            mensagemErro = errorData.mensagem || mensagemErro;
          } catch (e) {
            mensagemErro = await response.text();
          }
          throw new Error(mensagemErro);
        }
        
        const resultado = await response.json();
        console.log("Resposta recebida:", resultado);
        
        if (!resultado.sucesso) {
          throw new Error(resultado.mensagem || "Erro desconhecido");
        }
        
        // Mapear para formato compatível
        const ordemCriada = {
          id: resultado.ordem.id,
          orderNumber: resultado.ordem.numero_ordem,
          companyId: resultado.ordem.empresa_id,
          validUntil: resultado.ordem.valido_ate,
          status: resultado.ordem.status || "Ativo",
          userId: resultado.ordem.usuario_id || 1,
          createdAt: resultado.ordem.data_criacao
        };
        
        return ordemCriada;
      } catch (error) {
        console.error("Erro ao criar ordem:", error);
        throw error;
      }
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/purchase-orders"] });
      setIsCreateDialogOpen(false);
      form.reset();
      toast({
        title: "Sucesso",
        description: "Ordem de compra criada com sucesso",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error.message || "Erro ao criar ordem de compra",
        variant: "destructive",
      });
    },
  });

  // Configuração do formulário
  const form = useForm<PurchaseOrderFormData>({
    resolver: zodResolver(purchaseOrderFormSchema),
    defaultValues: {
      orderNumber: "",
      companyId: 0,
      obraId: 0,
      validUntil: "",
      items: [{ productId: 0, quantity: "" }],
    },
  });

  const onSubmit = (data: PurchaseOrderFormData) => {
    createPurchaseOrderMutation.mutate(data);
  };

  const addItem = () => {
    const currentItems = form.getValues("items");
    if (currentItems.length < 4) {
      form.setValue("items", [...currentItems, { productId: 0, quantity: "" }]);
    }
  };

  const removeItem = (index: number) => {
    const currentItems = form.getValues("items");
    if (currentItems.length > 1) {
      form.setValue("items", currentItems.filter((_, i) => i !== index));
    }
  };

  // Filtrar ordens de compra por termo de busca
  const filteredPurchaseOrders = purchaseOrders.filter(order => 
    order.orderNumber.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
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
        
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-primary hover:bg-primary/90">
              <Plus className="mr-2" size={16} />
              Nova Ordem de Compra
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Criar Nova Ordem de Compra</DialogTitle>
            </DialogHeader>
            
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <div className="grid grid-cols-1 gap-4">
                  <FormField
                    control={form.control}
                    name="orderNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Número da Ordem (5 dígitos)</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Digite o número da ordem (5 dígitos)"
                            maxLength={5}
                            className="bg-input border-border"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <FormField
                    control={form.control}
                    name="companyId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Fornecedor</FormLabel>
                        <Select onValueChange={(value) => field.onChange(parseInt(value))}>
                          <FormControl>
                            <SelectTrigger className="bg-input border-border">
                              <SelectValue placeholder="Selecione um fornecedor" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {companies
                              .filter(company => {
                                // @ts-ignore - a propriedade category foi adicionada no servidor
                                const category = company.category;
                                return category && category.receivesPurchaseOrders === true;
                              })
                              .map((company) => {
                                // @ts-ignore - a propriedade category foi adicionada no servidor
                                const requiresContract = company.category?.requiresContract === true;
                                const hasContract = company.contractNumber && company.contractNumber.trim() !== '';
                                
                                let displayName = company.name;
                                if (requiresContract) {
                                  displayName = hasContract
                                    ? `${company.name} - Contrato: ${company.contractNumber}`
                                    : `${company.name} - Sem Contrato`;
                                }
                                
                                return (
                                  <SelectItem key={company.id} value={company.id.toString()}>
                                    {displayName}
                                  </SelectItem>
                                );
                              })}
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
                        <Select onValueChange={(value) => field.onChange(parseInt(value))}>
                          <FormControl>
                            <SelectTrigger className="bg-input border-border">
                              <SelectValue placeholder="Selecione uma obra" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {obras && obras.map((obra: Obra) => (
                              <SelectItem key={obra.id} value={obra.id.toString()}>
                                {obra.nome}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-1 gap-6">
                  <FormField
                    control={form.control}
                    name="validUntil"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Válido Até</FormLabel>
                        <FormControl>
                          <Input
                            type="date"
                            className="bg-input border-border"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Items Section */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label className="text-base font-medium">Produtos (máx. 4)</Label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={addItem}
                      disabled={form.watch("items").length >= 4}
                    >
                      <Plus className="mr-2" size={16} />
                      Adicionar Produto
                    </Button>
                  </div>

                  {form.watch("items").map((_, index) => (
                    <Card key={index} className="bg-muted/50 border-border">
                      <CardContent className="p-4">
                        <div className="flex items-end gap-4">
                          <div className="flex-1">
                            <FormField
                              control={form.control}
                              name={`items.${index}.productId`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Produto</FormLabel>
                                  <Select onValueChange={(value) => field.onChange(parseInt(value))}>
                                    <FormControl>
                                      <SelectTrigger className="bg-input border-border">
                                        <SelectValue placeholder="Selecione um produto" />
                                      </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                      {products.map((product) => (
                                        <SelectItem key={product.id} value={product.id.toString()}>
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
                                      type="number"
                                      placeholder="Ex: 100"
                                      className="bg-input border-border"
                                      {...field}
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
                    onClick={() => setIsCreateDialogOpen(false)}
                  >
                    Cancelar
                  </Button>
                  <Button 
                    type="submit"
                    disabled={createPurchaseOrderMutation.isPending}
                    className="bg-primary hover:bg-primary/90"
                  >
                    {createPurchaseOrderMutation.isPending ? "Criando..." : "Criar Ordem de Compra"}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Lista de Ordens de Compra */}
      <Card className="border-border bg-card">
        <CardHeader className="pb-3">
          <CardTitle>Ordens de Compra</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-10">Carregando ordens de compra...</div>
          ) : filteredPurchaseOrders.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-muted/50">
                  <TableHead className="w-[100px]">Número</TableHead>
                  <TableHead>Fornecedor</TableHead>
                  <TableHead>Válido Até</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPurchaseOrders.map((order) => (
                  <TableRow key={order.id} className="border-border hover:bg-muted/50">
                    <TableCell className="font-medium">
                      {order.orderNumber}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center">
                        <Building className="h-4 w-4 mr-2 text-muted-foreground" />
                        {order.companyName || "Empresa não encontrada"}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center">
                        <Calendar className="h-4 w-4 mr-2 text-muted-foreground" />
                        {formatDate(order.validUntil)}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={getStatusColor(order.status)}>
                        {order.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" title="Ver detalhes">
                        <Eye className="h-4 w-4" />
                      </Button>
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