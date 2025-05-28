
import React from "react";
import { useQuery } from "@tanstack/react-query";
import { 
  Drawer, 
  DrawerContent, 
  DrawerHeader, 
  DrawerTitle, 
  DrawerDescription 
} from "@/components/ui/drawer";
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";
import { 
  Building, 
  Calendar, 
  FileText,
  Package,
  MapPin
} from "lucide-react";

interface OrderCompraDetailDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ordemId: number | null;
}

type OrdemCompra = {
  id: number;
  numero_ordem: string;
  empresa_id: number;
  empresa_nome: string;
  obra_id: number;
  obra_nome: string;
  valido_ate: string;
  status: string;
  data_criacao: string;
  usuario_id: number;
  itens?: Array<{
    id: number;
    produto_id: number;
    produto_nome: string;
    quantidade: number;
    saldo_disponivel?: number;
  }>;
};

export function OrderCompraDetailDrawer({ 
  open, 
  onOpenChange, 
  ordemId 
}: OrderCompraDetailDrawerProps) {
  
  // Buscar dados da ordem de compra específica
  const { data: ordemCompra, isLoading } = useQuery<OrdemCompra>({
    queryKey: [`/api/ordem-compra/${ordemId}`],
    queryFn: async () => {
      if (!ordemId) return null;
      
      const response = await fetch(`/api/ordem-compra/${ordemId}`);
      if (!response.ok) {
        throw new Error("Erro ao buscar ordem de compra");
      }
      
      return await response.json();
    },
    enabled: !!ordemId && open,
  });

  // Buscar itens da ordem de compra
  const { data: itens = [] } = useQuery({
    queryKey: [`/api/ordem-compra/${ordemId}/itens`],
    queryFn: async () => {
      if (!ordemId) return [];
      
      const response = await fetch(`/api/ordem-compra/${ordemId}/itens`);
      if (!response.ok) {
        throw new Error("Erro ao buscar itens");
      }
      
      return await response.json();
    },
    enabled: !!ordemId && open,
  });

  if (!ordemId) return null;

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[85vh]">
        <div className="mx-auto w-full max-w-4xl">
          <DrawerHeader>
            <DrawerTitle className="flex items-center justify-between">
              <span>Ordem de Compra {ordemCompra?.numero_ordem}</span>
              {ordemCompra?.status && (
                <Badge className={
                  ordemCompra.status === "Ativo" ? "bg-green-500 hover:bg-green-600" :
                  ordemCompra.status === "Inativo" ? "bg-red-500 hover:bg-red-600" :
                  ""
                }>
                  {ordemCompra.status}
                </Badge>
              )}
            </DrawerTitle>
            <DrawerDescription>
              Detalhes completos da ordem de compra
            </DrawerDescription>
          </DrawerHeader>
          
          {isLoading ? (
            <div className="flex justify-center items-center py-12">
              <p>Carregando detalhes...</p>
            </div>
          ) : !ordemCompra ? (
            <div className="flex justify-center items-center py-12">
              <p>Ordem de compra não encontrada</p>
            </div>
          ) : (
            <div className="px-4 pb-6 space-y-6">
              {/* Informações Básicas */}
              <Card>
                <CardHeader>
                  <CardTitle>Informações da Ordem de Compra</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <h4 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                        <FileText size={16} />
                        Número da Ordem
                      </h4>
                      <p className="text-base font-medium font-mono">
                        {ordemCompra.numero_ordem}
                      </p>
                    </div>
                    
                    <div className="space-y-2">
                      <h4 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                        <Building size={16} />
                        Fornecedor
                      </h4>
                      <p className="text-base font-medium">
                        {ordemCompra.empresa_nome}
                      </p>
                    </div>
                    
                    <div className="space-y-2">
                      <h4 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                        <MapPin size={16} />
                        Obra
                      </h4>
                      <p className="text-base font-medium">
                        {ordemCompra.obra_nome}
                      </p>
                    </div>
                    
                    <div className="space-y-2">
                      <h4 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                        <Calendar size={16} />
                        Validade
                      </h4>
                      <p className="text-base font-medium">
                        {formatDate(ordemCompra.valido_ate)}
                      </p>
                    </div>
                    
                    <div className="space-y-2">
                      <h4 className="text-sm font-medium text-muted-foreground">Data de Criação</h4>
                      <p className="text-base font-medium">
                        {formatDate(ordemCompra.data_criacao)}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Produtos da Ordem */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Package size={20} />
                    Produtos Incluídos
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {itens.length > 0 ? (
                    <div className="space-y-3">
                      {itens.map((item: any, index: number) => (
                        <div key={item.id} className="border rounded-lg p-4 bg-muted/30">
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <h4 className="font-medium">{item.produto_nome}</h4>
                              <p className="text-sm text-muted-foreground mt-1">
                                Quantidade: {item.quantidade.toLocaleString('pt-BR')}
                              </p>
                              {item.saldo_disponivel !== undefined && (
                                <p className="text-sm mt-1">
                                  <span className="text-green-600">
                                    Saldo disponível: {item.saldo_disponivel.toLocaleString('pt-BR')}
                                  </span>
                                </p>
                              )}
                            </div>
                            <Badge variant="outline" className="ml-2">
                              Item {index + 1}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-6 text-muted-foreground">
                      <Package size={32} className="mx-auto mb-2" />
                      <p>Nenhum produto encontrado para esta ordem</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
