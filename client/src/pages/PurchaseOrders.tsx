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
import { apiRequest } from "@/lib/queryClient";
import { insertPurchaseOrderSchema, type PurchaseOrder, type Product, type Company, type PurchaseOrderItem } from "@shared/schema";
import { z } from "zod";

const purchaseOrderFormSchema = z.object({
  orderNumber: z.string().min(5, "Número da ordem deve ter 5 dígitos").max(5, "Número da ordem deve ter 5 dígitos")
    .regex(/^\d+$/, "Número da ordem deve conter apenas dígitos"),
  companyId: z.number().min(1, "Empresa é obrigatória"),
  validUntil: z.string().min(1, "Data de validade é obrigatória"),
  items: z.array(z.object({
    productId: z.number().min(1, "Produto é obrigatório"),
    quantity: z.string().min(1, "Quantidade é obrigatória"),
  })).min(1, "Pelo menos um produto é obrigatório").max(4, "Máximo 4 produtos por ordem"),
});

type PurchaseOrderFormData = z.infer<typeof purchaseOrderFormSchema>;

export default function PurchaseOrders() {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  const queryClient = useQueryClient();

  const { data: purchaseOrders = [], isLoading } = useQuery<PurchaseOrder[]>({
    queryKey: ["/api/purchase-orders"],
  });

  const { data: products = [] } = useQuery<Product[]>({
    queryKey: ["/api/products"],
  });

  const { data: companies = [] } = useQuery<Company[]>({
    queryKey: ["/api/companies"],
  });

  const createPurchaseOrderMutation = useMutation({
    mutationFn: async (data: PurchaseOrderFormData) => {
      try {
        const { items, ...purchaseOrderData } = data;
        
        // Buscar o CNPJ da empresa selecionada
        const empresaSelecionada = companies.find(company => company.id === parseInt(purchaseOrderData.companyId.toString()));
        if (!empresaSelecionada) {
          throw new Error("Empresa selecionada não encontrada");
        }

        // Corrigir data para evitar mudança de dia devido ao timezone
        const [year, month, day] = data.validUntil.split('-');
        const correctedDate = new Date(Date.UTC(parseInt(year), parseInt(month) - 1, parseInt(day), 12, 0, 0));

        // Preparar dados no novo formato
        const dadosFormatados = {
          numeroOrdem: purchaseOrderData.orderNumber.trim(),
          empresaId: parseInt(purchaseOrderData.companyId.toString()),
          cnpj: empresaSelecionada.cnpj, // CNPJ da empresa fornecedora
          validoAte: correctedDate.toISOString(),
          produtos: items
            .filter(item => item.productId && item.quantity)
            .map(item => ({
              id: parseInt(item.productId.toString()),
              qtd: parseInt(item.quantity)
            }))
        };
        
        console.log("=== NOVA IMPLEMENTAÇÃO ===");
        console.log("Enviando dados no novo formato:", JSON.stringify(dadosFormatados, null, 2));
        
        // Requisição para a nova rota especializada
        const response = await fetch("/api/ordem-compra-nova", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Accept": "application/json" 
          },
          body: JSON.stringify(dadosFormatados)
        });
        
        // Verificar se houve erro HTTP
        if (!response.ok) {
          console.error("Erro HTTP:", response.status);
          
          // Tentar obter mensagem de erro do servidor
          let mensagemErro = "Erro ao criar ordem de compra";
          try {
            const errorData = await response.json();
            mensagemErro = errorData.mensagem || mensagemErro;
          } catch (e) {
            // Se falhar em obter JSON, tentar obter texto puro
            mensagemErro = await response.text();
          }
          
          throw new Error(mensagemErro);
        }
        
        // Ler resposta com tratamento de erro
        let resultado;
        try {
          resultado = await response.json();
          console.log("Resposta da nova API:", resultado);
          
          if (!resultado.sucesso) {
            throw new Error(resultado.mensagem || "Erro desconhecido na operação");
          }
          
          // Mapear para formato compatível com o restante da aplicação
          const ordemCriada = {
            id: resultado.dados.id,
            orderNumber: resultado.dados.numero,
            companyId: resultado.dados.empresa,
            validUntil: resultado.dados.validade,
            status: "Ativo",
            userId: 1,
            createdAt: resultado.dados.data
          };
          
          console.log("Ordem mapeada para formato compatível:", ordemCriada);
          return ordemCriada;
        } catch (parseError) {
          console.error("Erro ao processar resposta JSON:", parseError);
          throw new Error("Erro ao processar resposta do servidor");
        }
      } catch (error) {
        console.error("Erro durante o envio:", error);
        throw error;
      }
    },
    onSuccess: (data) => {
      console.log("Ordem de compra criada com sucesso:", data);
      queryClient.invalidateQueries({ queryKey: ["/api/purchase-orders"] });
      setIsCreateDialogOpen(false);
      form.reset(); // Limpar o formulário após sucesso
      toast({
        title: "Sucesso",
        description: "Ordem de compra criada com sucesso",
      });
    },
    onError: (error: any) => {
      console.error("Erro ao criar ordem de compra:", error);
      toast({
        title: "Erro",
        description: error.message || "Erro ao criar ordem de compra. Verifique os dados e tente novamente.",
        variant: "destructive",
      });
    },
  });

  const form = useForm<PurchaseOrderFormData>({
    resolver: zodResolver(purchaseOrderFormSchema),
    defaultValues: {
      orderNumber: "",
      companyId: 0,
      validUntil: "",
      items: [{ productId: 0, quantity: "" }],
    },
  });

  const onSubmit = (data: PurchaseOrderFormData) => {
    console.log("Formulário submetido com dados:", data);
    
    // Verificar se há dados de formulário válidos
    if (!data.orderNumber || !data.companyId || !data.validUntil) {
      console.error("Dados do formulário inválidos:", data);
      toast({
        title: "Erro de validação",
        description: "Por favor, preencha todos os campos obrigatórios",
        variant: "destructive",
      });
      return;
    }
    
    if (data.items.some(item => !item.productId || !item.quantity)) {
      console.error("Itens do formulário inválidos:", data.items);
      toast({
        title: "Erro de validação",
        description: "Por favor, preencha todos os campos de produto e quantidade",
        variant: "destructive",
      });
      return;
    }
    
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

  // Filter purchase orders
  const filteredPurchaseOrders = purchaseOrders.filter(order => 
    order.orderNumber.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Actions */}
      <div className="flex justify-end">
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
                        <FormLabel>Empresa</FormLabel>
                        <Select onValueChange={(value) => field.onChange(parseInt(value))}>
                          <FormControl>
                            <SelectTrigger className="bg-input border-border">
                              <SelectValue placeholder="Selecione uma empresa" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {/* Filtrar empresas com duas condições:
                               1. Empresas que podem receber ordens de compra (categoria.receivesPurchaseOrders)
                               2. Se for categoria que requer contrato, mostrar o número do contrato
                            */}
                            {companies
                              .filter(company => {
                                // Filtrar apenas empresas que podem receber ordens de compra
                                // @ts-ignore - a propriedade category foi adicionada no servidor
                                const category = company.category;
                                return category && category.receivesPurchaseOrders === true;
                              })
                              .map((company) => {
                                // @ts-ignore - a propriedade category foi adicionada no servidor
                                const requiresContract = company.category?.requiresContract === true;
                                const hasContract = company.contractNumber && company.contractNumber.trim() !== '';
                                
                                // Formatação do nome da empresa
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
                            size="sm"
                            onClick={() => removeItem(index)}
                            disabled={form.watch("items").length <= 1}
                            className="text-destructive hover:text-destructive mb-2"
                          >
                            <Trash2 size={16} />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                <div className="flex justify-end space-x-4 pt-4 border-t border-border">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsCreateDialogOpen(false)}
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="submit"
                    className="bg-primary hover:bg-primary/90"
                    disabled={createPurchaseOrderMutation.isPending}
                  >
                    {createPurchaseOrderMutation.isPending ? "Criando..." : "Salvar Ordem"}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Search */}
      <Card className="bg-card border-border">
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <Label htmlFor="search">Buscar</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" size={16} />
                <Input
                  id="search"
                  placeholder="Buscar por número da ordem..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 bg-input border-border"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Purchase Orders Table */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle>Lista de Ordens de Compra ({filteredPurchaseOrders.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted">
                <TableRow>
                  <TableHead>Nº da Ordem</TableHead>
                  <TableHead>Empresa</TableHead>
                  <TableHead>Válido Até</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Criado em</TableHead>
                  <TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPurchaseOrders.map((order) => {
                  const company = companies.find(c => c.id === order.companyId);
                  return (
                    <TableRow key={order.id} className="hover:bg-muted/50">
                      <TableCell className="font-mono text-sm">
                        {order.orderNumber}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center">
                          <Building className="mr-2 text-muted-foreground" size={16} />
                          {company?.name || "Empresa não encontrada"}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center">
                          <Calendar className="mr-2 text-muted-foreground" size={16} />
                          {formatDate(order.validUntil)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={getStatusColor(order.status)}>
                          {order.status}
                        </Badge>
                      </TableCell>
                      <TableCell>{formatDate(order.createdAt!)}</TableCell>
                      <TableCell>
                        <div className="flex space-x-2">
                          <Button variant="ghost" size="sm">
                            <Eye size={16} />
                          </Button>
                          <Button variant="ghost" size="sm">
                            <Edit size={16} />
                          </Button>
                          <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive">
                            <Trash2 size={16} />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
          
          {filteredPurchaseOrders.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              {searchTerm 
                ? "Nenhuma ordem de compra encontrada com os filtros aplicados" 
                : "Nenhuma ordem de compra cadastrada"}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
