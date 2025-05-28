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
  pdf_arquivo?: string;
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
      <DrawerContent className="max-h-[85vh] flex flex-col">
        <div className="mx-auto w-full max-w-4xl flex flex-col h-full">
          <DrawerHeader className="flex-shrink-0">
            <DrawerTitle className="flex items-center justify-between">
              <span>Ordem de Compra {ordemAtual?.numero_ordem}</span>
              {ordemAtual && (
                <Badge variant={getStatusColor(getRealStatus(ordemAtual))}>
                  {getRealStatus(ordemAtual)}
                </Badge>
              )}
            </DrawerTitle>
          </DrawerHeader>

          {!ordemAtual ? (
            <div className="flex justify-center items-center py-12">
              <p>Carregando detalhes...</p>
            </div>
          ) : (
            <div className="flex flex-col h-full">
              <div className="flex-1 overflow-y-auto px-4 space-y-6">
                {/* Informações Gerais */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg font-semibold leading-none tracking-tight">Informações Gerais</CardTitle>
                  </CardHeader>
                <CardContent>
                  <div className="flex justify-between items-start gap-6">
                    {/* Informações à esquerda */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-1">
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

                    {/* Botão à direita */}
                    <div className="flex flex-col items-end space-y-2">
                      <h4 className="text-sm font-medium text-muted-foreground">Documentos</h4>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          if (ordemAtual?.id) {
                            // Fazer download do PDF da ordem de compra
                            fetch(`/api/ordem-compra/${ordemAtual.id}/pdf`)
                              .then(response => {
                                if (!response.ok) {
                                  throw new Error(`Erro: ${response.status}`);
                                }
                                return response.blob();
                              })
                              .then(blob => {
                                // Criar URL temporário para o blob
                                const url = window.URL.createObjectURL(blob);
                                // Criar elemento de link para download
                                const a = document.createElement('a');
                                a.href = url;
                                a.download = `ordem_compra_${ordemAtual.numero_ordem}.pdf`;
                                document.body.appendChild(a);
                                a.click();
                                window.URL.revokeObjectURL(url);
                                a.remove();
                              })
                              .catch(error => {
                                console.error("Erro ao baixar PDF:", error);
                                // Você pode adicionar um toast de erro aqui se necessário
                              });
                          }
                        }}
                        className="flex items-center gap-2"
                      >
                        <svg 
                          xmlns="http://www.w3.org/2000/svg" 
                          width="16" 
                          height="16" 
                          viewBox="0 0 24 24" 
                          fill="none" 
                          stroke="currentColor" 
                          strokeWidth="2" 
                          strokeLinecap="round" 
                          strokeLinejoin="round"
                        >
                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                          <polyline points="14,2 14,8 20,8"/>
                          <line x1="16" y1="13" x2="8" y2="13"/>
                          <line x1="16" y1="17" x2="8" y2="17"/>
                          <polyline points="10,9 9,9 8,9"/>
                        </svg>
                        Baixar PDF da Ordem
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Produtos */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg font-semibold leading-none tracking-tight">Produtos e Saldo Disponível</CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
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
                      <div className="space-y-2">
                        {detailsItems.map((item: any) => (
                          <Card key={item.id} className="bg-muted/40">
                            <CardContent className="pt-3 pb-3">
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

              {/* Botão Fechar fixo no final */}
              <div className="flex-shrink-0 p-4 border-t">
                <Button 
                  variant="outline" 
                  onClick={() => onOpenChange(false)}
                  className="w-full"
                >
                  Fechar
                </Button>
              </div>
            </div>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
}