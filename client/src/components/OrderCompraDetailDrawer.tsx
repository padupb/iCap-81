
import React, { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { 
  Drawer, 
  DrawerContent, 
  DrawerHeader, 
  DrawerTitle, 
  DrawerDescription, 
  DrawerFooter 
} from "@/components/ui/drawer";
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Package, 
  Building,
  Calendar,
  RefreshCw,
  Loader2
} from "lucide-react";
import { formatDate } from "@/lib/utils";

// Função para formatar números com vírgula (formato brasileiro)
const formatNumber = (value: string | number): string => {
  const numValue = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(numValue)) return value.toString();
  
  return numValue.toLocaleString('pt-BR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
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
      <div className="flex items-center gap-2">
        <span className="text-xs text-destructive">Erro ao verificar saldo</span>
      </div>
    );
  }
  
  return (
    <div className="flex items-center gap-2">
      <span className="text-sm">
        {formatNumber(saldo.saldoDisponivel)} {saldo.unidade}
        <span className="text-xs text-muted-foreground ml-1">
          (Total: {formatNumber(saldo.quantidadeTotal)} / Usado: {formatNumber(saldo.quantidadeUsada)})
        </span>
      </span>
    </div>
  );
}

interface OrderCompraDetailDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ordemId: number | null;
}

// Definir tipo para ordem de compra
type OrdemCompra = {
  id: number;
  numero_ordem: string;
  empresa_id: number;
  empresa_nome: string;
  valido_ate: string;
  status: string;
  data_criacao: string;
};

export function OrderCompraDetailDrawer({ 
  open, 
  onOpenChange, 
  ordemId 
}: OrderCompraDetailDrawerProps) {
  const [detailsItems, setDetailsItems] = useState<any[]>([]);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);

  // Buscar ordem de compra
  const { data: ordens = [] } = useQuery<OrdemCompra[]>({
    queryKey: ["/api/ordens-compra"],
    enabled: !!ordemId && open,
  });

  // Buscar detalhes da ordem quando o drawer abre
  useEffect(() => {
    if (open && ordemId) {
      setIsLoadingDetails(true);
      
      fetch(`/api/ordem-compra/${ordemId}/itens`)
        .then(response => {
          if (!response.ok) throw new Error('Falha ao carregar detalhes');
          return response.json();
        })
        .then(items => {
          setDetailsItems(items);
        })
        .catch(error => {
          console.error('Erro ao carregar detalhes:', error);
          setDetailsItems([]);
        })
        .finally(() => {
          setIsLoadingDetails(false);
        });
    }
  }, [open, ordemId]);

  // Encontrar a ordem atual
  const ordemAtual = ordens.find(ordem => ordem.id === ordemId);

  // Função para verificar se o pedido está expirado
  const isOrderExpired = (validUntil: string): boolean => {
    const validDate = new Date(validUntil);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
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

  if (!ordemId) return null;

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[85vh]">
        <div className="mx-auto w-full max-w-4xl">
          <DrawerHeader>
            <DrawerTitle className="flex items-center justify-between">
              <span>Ordem de Compra {ordemAtual?.numero_ordem}</span>
              {ordemAtual && (
                <Badge variant={getStatusColor(getRealStatus(ordemAtual))}>
                  {getRealStatus(ordemAtual)}
                </Badge>
              )}
            </DrawerTitle>
            <DrawerDescription>
              Detalhes completos da ordem de compra
            </DrawerDescription>
          </DrawerHeader>
          
          {!ordemAtual ? (
            <div className="flex justify-center items-center py-12">
              <p>Carregando detalhes...</p>
            </div>
          ) : (
            <div className="px-4 pb-6 space-y-6">
              {/* Informações Gerais */}
              <Card>
                <CardHeader>
                  <CardTitle>Informações Gerais</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <h4 className="text-sm font-medium text-muted-foreground">Número da Ordem</h4>
                      <p className="text-base font-medium">{ordemAtual.numero_ordem}</p>
                    </div>
                    
                    <div className="space-y-2">
                      <h4 className="text-sm font-medium text-muted-foreground">Fornecedor</h4>
                      <p className="text-base font-medium flex items-center gap-2">
                        <Building size={16} className="text-muted-foreground" />
                        {ordemAtual.empresa_nome}
                      </p>
                    </div>
                    
                    <div className="space-y-2">
                      <h4 className="text-sm font-medium text-muted-foreground">Válido Até</h4>
                      <p className="text-base font-medium flex items-center gap-2">
                        <Calendar size={16} className="text-muted-foreground" />
                        {formatDate(ordemAtual.valido_ate)}
                      </p>
                    </div>
                    
                    <div className="space-y-2">
                      <h4 className="text-sm font-medium text-muted-foreground">Data de Criação</h4>
                      <p className="text-base font-medium">
                        {formatDate(ordemAtual.data_criacao)}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Produtos */}
              <Card>
                <CardHeader>
                  <CardTitle>Produtos e Saldo Disponível</CardTitle>
                </CardHeader>
                <CardContent>
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
                          <CardContent className="pt-4 pb-4">
                            <div className="flex justify-between items-center gap-4">
                              <div className="flex-1 min-w-0">
                                <h4 className="text-sm font-medium truncate">
                                  {item.produto_nome || `Produto #${item.produto_id}`}
                                </h4>
                              </div>
                              
                              <div className="text-sm flex-shrink-0">
                                <SaldoProduto 
                                  ordemId={ordemId} 
                                  produtoId={item.produto_id} 
                                />
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
          
          <DrawerFooter>
            <Button 
              variant="outline" 
              onClick={() => onOpenChange(false)}
            >
              Fechar
            </Button>
          </DrawerFooter>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
