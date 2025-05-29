import React, { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  Drawer, 
  DrawerContent, 
  DrawerHeader, 
  DrawerTitle, 
  DrawerDescription, 
  DrawerFooter 
} from "@/components/ui/drawer";
import { 
  Tabs, 
  TabsList, 
  TabsTrigger, 
  TabsContent 
} from "@/components/ui/tabs";
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardFooter, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { formatDate } from "@/lib/utils";
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
import { 
  Package, 
  CircleCheck, 
  MapPin, 
  History,
  ExternalLink,
  CheckCircle,
  Circle,
  X,
  FileText,
  Upload,
  FileCheck,
  Clock,
  Download
} from "lucide-react";
import { Order, Product, Company, PurchaseOrder } from "@shared/schema";

interface OrderDetailDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderId: number | null;
}

type OrderDetails = Order & {
  product?: Product;
  supplier?: Company;
  purchaseOrder?: PurchaseOrder;
  quantidadeRecebida?: string;
  documentosCarregados?: boolean;
};

export function OrderDetailDrawer({ 
  open, 
  onOpenChange, 
  orderId 
}: OrderDetailDrawerProps) {
  const { user } = useAuth();
  // Definir um valor inicial diferente de "details" para forçar a renderização adequada
  const [activeTab, setActiveTab] = useState("details");
  const [confirmedQuantity, setConfirmedQuantity] = useState("");

  // Refs para os inputs de arquivo
  const notaPdfRef = useRef<HTMLInputElement>(null);
  const notaXmlRef = useRef<HTMLInputElement>(null);
  const certificadoPdfRef = useRef<HTMLInputElement>(null);

  // Debug dos refs (apenas quando necessário)
  useEffect(() => {
    if (open && activeTab === 'documents') {
      console.log("Aba de documentos aberta, verificando refs:", {
        notaPdfRef: !!notaPdfRef.current,
        notaXmlRef: !!notaXmlRef.current,
        certificadoPdfRef: !!certificadoPdfRef.current
      });
    }
  }, [open, activeTab]);

  // Estado para os arquivos
  const [notaPdf, setNotaPdf] = useState<File | null>(null);
  const [notaXml, setNotaXml] = useState<File | null>(null);
  const [certificadoPdf, setCertificadoPdf] = useState<File | null>(null);

  // Estado para controlar se os documentos foram carregados
  const [documentsLoaded, setDocumentsLoaded] = useState(false);

  // Estado para tracking de histórico
  const [orderHistory, setOrderHistory] = useState<Array<{
    etapa: string;
    data: string;
    usuario: string;
    descricao?: string;
  }>>([]);

  const queryClient = useQueryClient();

  // Buscar pedidos, produtos e empresas
  const { data: orders = [] } = useQuery<Order[]>({
    queryKey: ["/api/orders"],
    enabled: !!orderId && open,
  });

  const { data: products = [] } = useQuery<Product[]>({
    queryKey: ["/api/products"],
    enabled: !!orderId && open,
  });

  const { data: companies = [] } = useQuery<Company[]>({
    queryKey: ["/api/companies"],
    enabled: !!orderId && open,
  });

  // Tentar buscar das duas rotas possíveis de ordens de compra
  const { data: purchaseOrders = [] } = useQuery<PurchaseOrder[]>({
    queryKey: ["/api/purchase-orders"],
    enabled: !!orderId && open,
  });

  const { data: ordensCompra = [] } = useQuery({
    queryKey: ["/api/ordens-compra"],
    enabled: !!orderId && open,
  });

  // Montar os detalhes do pedido a partir dos dados obtidos
  const orderDetails = React.useMemo(() => {
    if (!orderId) return null;

    const order = orders.find(o => o.id === orderId);
    if (!order) return null;

    const product = products.find(p => p.id === order.productId);
    const supplier = companies.find(c => c.id === order.supplierId);

    // Buscar ordem de compra da tabela correta - primeiro tenta purchase_orders, depois ordens_compra
    let purchaseOrder = purchaseOrders.find(po => po.id === order.purchaseOrderId);

    // Se não encontrou na primeira tabela, tenta na segunda (ordens_compra)
    if (!purchaseOrder && order.purchaseOrderId) {
      // Verificar se ordensCompra é um array e tem elementos
      const ordensArray = Array.isArray(ordensCompra) ? ordensCompra : [];

      if (ordensArray.length > 0) {
        const ordemCompra = ordensArray.find((oc: any) => oc.id === order.purchaseOrderId);
        if (ordemCompra) {
          // Converte o formato da ordem de compra para o padrão esperado
          purchaseOrder = {
            id: ordemCompra.id,
            orderNumber: ordemCompra.numero_ordem,
            companyId: ordemCompra.empresa_id,
            validUntil: ordemCompra.valido_ate,
            status: ordemCompra.status || 'Ativo',
            userId: ordemCompra.usuario_id || 1,
            createdAt: ordemCompra.data_criacao ? new Date(ordemCompra.data_criacao) : new Date()
          } as PurchaseOrder;
        }
      }
    }

    return {
      ...order,
      product,
      supplier,
      purchaseOrder
    } as OrderDetails;
  }, [orderId, orders, products, companies, purchaseOrders, ordensCompra]);

  // Reset state when drawer opens
  useEffect(() => {
    if (open && orderDetails) {
      // Não resetamos a aba ativa aqui para manter a navegação entre abas
      setConfirmedQuantity("");

      // Verificar se os documentos já foram carregados com base no status do pedido
      if (orderDetails.documentosCarregados || 
          orderDetails.status === 'Carregado' || 
          orderDetails.status === 'Em Rota' || 
          orderDetails.status === 'Em transporte' ||
          orderDetails.status === 'Entregue') {
        setDocumentsLoaded(true);
      } else {
        setDocumentsLoaded(false);
      }
    }

    if (!open) {
      // Quando o drawer fecha, resetar os arquivos
      setNotaPdf(null);
      setNotaXml(null);
      setCertificadoPdf(null);
      setDocumentsLoaded(false);
    }
  }, [open, orderDetails?.id, orderDetails?.status, orderDetails?.documentosCarregados]);

  // Verificar se o usuário pode confirmar entregas
  const canConfirmDelivery = () => {
    if (!user) return false;

    // Usuário admin pode confirmar qualquer entrega
    if (user.email.endsWith('@admin.icap')) return true;

    // Verificar se o usuário tem permissão específica para confirmar entregas
    return !!user.canConfirmDelivery;
  };

  // Consulta para buscar documentos já existentes quando o drawer é aberto
  const { data: documentosData } = useQuery({
    queryKey: [`/api/pedidos/${orderId}/documentos`],
    queryFn: async () => {
      if (!orderId) return null;

      const response = await fetch(`/api/pedidos/${orderId}/documentos`);
      if (!response.ok) {
        console.error("Erro ao buscar documentos:", response.statusText);
        return null;
      }

      return await response.json();
    },
    enabled: !!orderId && open
  });

  // Efeito para processar os dados dos documentos quando eles são carregados
  React.useEffect(() => {
    if (documentosData?.temDocumentos) {
      setDocumentsLoaded(true);
      console.log("Documentos carregados do servidor:", documentosData.documentos);
    }
  }, [documentosData]);

  // Mutation para upload de documentos - agora usando o servidor real
  const documentUploadMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      if (!orderId) {
        throw new Error("ID do pedido não encontrado");
      }

      try {
        const response = await fetch(`/api/pedidos/${orderId}/documentos`, {
          method: 'POST',
          body: formData
        });

        if (!response.ok) {
          // Clonar a resposta para poder ler o corpo múltiplas vezes
          const responseClone = response.clone();
          try {
            const errorData = await response.json();
            throw new Error(errorData.mensagem || "Falha ao fazer upload dos documentos");
          } catch (jsonError) {
            // Se não conseguir interpretar como JSON, use o texto da resposta clonada
            try {
              const errorText = await responseClone.text();
              throw new Error(errorText || `Erro no servidor: ${response.status}`);
            } catch (textError) {
              throw new Error(`Erro no servidor: ${response.status}`);
            }
          }
        }

        const data = await response.json();
        console.log("Resposta do servidor:", data);
        return data;
      } catch (error) {
        console.error("Erro no upload:", error);
        throw error;
      }
    },
    onSuccess: (data) => {
      // Atualizar o estado local
      setDocumentsLoaded(true);

      // Invalidar as queries para atualizar os dados
      queryClient.invalidateQueries({ queryKey: ['/api/orders'] });
      queryClient.invalidateQueries({ queryKey: [`/api/orders/${orderId}`] });

      // Notificar o usuário
      toast({
        title: "Sucesso",
        description: data.mensagem || "Documentos enviados com sucesso",
      });

      // Atualizar a tab para mostrar os documentos carregados
      setActiveTab("tracking");
      setTimeout(() => setActiveTab("documents"), 100);
    },
    onError: (error) => {
      toast({
        title: "Erro",
        description: error instanceof Error ? error.message : "Falha ao enviar documentos",
        variant: "destructive",
      });
    }
  });

  // Efeito para verificar se o pedido já tem documentos carregados
  React.useEffect(() => {
    if (orderDetails?.documentosCarregados) {
      setDocumentsLoaded(true);
    }
  }, [orderDetails?.documentosCarregados]);

  // Função para fazer upload de todos os documentos
  const handleUploadDocuments = () => {
    console.log("Iniciando upload de documentos para pedido:", orderId);

    if (!orderId) {
      toast({
        title: "Erro",
        description: "ID do pedido não encontrado",
        variant: "destructive",
      });
      return;
    }

    // Verificar se todos os três documentos foram selecionados (obrigatórios)
    if (!notaPdf || !notaXml || !certificadoPdf) {
      toast({
        title: "Atenção",
        description: "Todos os três documentos são obrigatórios (Nota Fiscal PDF, Nota Fiscal XML e Certificado PDF)",
        variant: "destructive",
      });
      return;
    }

    // Verificar tipos de arquivo
    if (notaPdf && notaPdf.type !== 'application/pdf') {
      toast({
        title: "Formato Inválido",
        description: "O arquivo da Nota Fiscal deve estar em formato PDF",
        variant: "destructive",
      });
      return;
    }

    if (notaXml && !notaXml.name.endsWith('.xml') && notaXml.type !== 'text/xml' && notaXml.type !== 'application/xml') {
      toast({
        title: "Formato Inválido",
        description: "O arquivo da Nota Fiscal deve estar em formato XML",
        variant: "destructive",
      });
      return;
    }

    if (certificadoPdf && certificadoPdf.type !== 'application/pdf') {
      toast({
        title: "Formato Inválido",
        description: "O certificado deve estar em formato PDF",
        variant: "destructive",
      });
      return;
    }

    // Verificar tamanho (máximo 10MB)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if ((notaPdf && notaPdf.size > maxSize) || 
        (notaXml && notaXml.size > maxSize) || 
        (certificadoPdf && certificadoPdf.size > maxSize)) {
      toast({
        title: "Arquivo muito grande",
        description: "O tamanho máximo permitido para cada arquivo é 10MB",
        variant: "destructive",
      });
      return;
    }

    const formData = new FormData();
    // Garantir que os arquivos não sejam nulos antes de anexá-los
    if (notaPdf) {
      formData.append('nota_pdf', notaPdf as Blob);
    }
    if (notaXml) {
      formData.append('nota_xml', notaXml as Blob);
    }
    if (certificadoPdf) {
      formData.append('certificado_pdf', certificadoPdf as Blob);
    }

    toast({
      title: "Enviando documentos",
      description: "Aguarde enquanto os documentos são enviados...",
    });

    documentUploadMutation.mutate(formData);
  };

  // Função para lidar com a seleção de arquivos
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, setFile: React.Dispatch<React.SetStateAction<File | null>>) => {
    console.log("handleFileChange chamado", e.target.files);
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      console.log("Arquivo selecionado:", file.name, file.type, file.size);
      setFile(file);
      toast({
        title: "Arquivo selecionado",
        description: `${file.name} (${Math.round(file.size / 1024)} KB)`,
      });
    } else {
      console.log("Nenhum arquivo selecionado");
    }
  };

  // Função para confirmar entrega
  const handleConfirmDelivery = async (status: 'aprovado' | 'rejeitado') => {
    if (!orderId) return;

    try {
      // Validar quantidade recebida
      if (status === 'aprovado' && !confirmedQuantity) {
        toast({
          title: "Atenção",
          description: "Por favor, informe a quantidade recebida",
          variant: "destructive",
        });
        return;
      }

      const response = await fetch(`/api/pedidos/${orderId}/confirmar`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status: status,
          quantidadeRecebida: confirmedQuantity
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.mensagem || "Falha ao confirmar entrega");
      }

      // Invalidar queries para atualizar os dados
      queryClient.invalidateQueries({ queryKey: ['/api/orders'] });
      queryClient.invalidateQueries({ queryKey: [`/api/orders/${orderId}`] });

      toast({
        title: "Sucesso",
        description: status === 'aprovado' 
          ? "Entrega confirmada com sucesso!" 
          : "Entrega rejeitada com sucesso!",
      });

      // Fechar o drawer após confirmar
      onOpenChange(false);
    } catch (error) {
      toast({
        title: "Erro",
        description: error instanceof Error ? error.message : "Falha ao processar confirmação de entrega",
        variant: "destructive",
      });
    }
  };

  // Função para gerar link do Google Maps
  const getGoogleMapsLink = (location: string) => {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location)}`;
  };

  if (!orderId) return null;

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[85vh]">
        <div className="mx-auto w-full max-w-4xl">
          <DrawerHeader>
            <DrawerTitle className="flex items-center justify-between">
              <span>Pedido {orderDetails?.orderId}</span>
              {orderDetails?.status && (
                <Badge className={
                  orderDetails.status === "Entregue" ? "bg-green-500 hover:bg-green-600" :
                  orderDetails.status === "Recusado" ? "bg-red-500 hover:bg-red-600" :
                  orderDetails.status === "Em Rota" ? "bg-amber-500 hover:bg-amber-600" :
                  ""
                }>
                  {orderDetails.status}
                </Badge>
              )}
            </DrawerTitle>
            <DrawerDescription>
              Detalhes completos do pedido
            </DrawerDescription>
          </DrawerHeader>

          {!orderDetails ? (
            <div className="flex justify-center items-center py-12">
              <p>Carregando detalhes...</p>
            </div>
          ) : (
            <div className="px-4 pb-6">
              <Tabs defaultValue="details" value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="w-full grid grid-cols-5">
                  <TabsTrigger value="details" className="flex items-center gap-1">
                    <Package size={16} />
                    <span>Detalhes</span>
                  </TabsTrigger>
                  <TabsTrigger value="documents" className="flex items-center gap-1">
                    <FileText size={16} />
                    <span>Documentos</span>
                  </TabsTrigger>
                  <TabsTrigger value="confirm" className="flex items-center gap-1">
                    <CircleCheck size={16} />
                    <span>Confirmar Entrega</span>
                  </TabsTrigger>
                  <TabsTrigger value="tracking" className="flex items-center gap-1">
                    <MapPin size={16} />
                    <span>Rastreamento</span>
                  </TabsTrigger>
                  <TabsTrigger value="history" className="flex items-center gap-1">
                    <History size={16} />
                    <span>Histórico</span>
                  </TabsTrigger>
                </TabsList>

                {/* Aba de Detalhes */}
                <TabsContent value="details" className="space-y-4 py-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <h4 className="text-sm font-medium text-muted-foreground">Produto</h4>
                      <p className="text-base font-medium">
                        {orderDetails.product?.name} - {formatNumber(orderDetails.quantity)}
                      </p>
                    </div>

                    <div className="space-y-2">
                      <h4 className="text-sm font-medium text-muted-foreground">Local da Obra</h4>
                      <p className="text-base font-medium flex items-center gap-2">
                        {orderDetails.workLocation}
                        <a 
                          href={getGoogleMapsLink(orderDetails.workLocation)} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-blue-500 hover:text-blue-700"
                        >
                          <ExternalLink size={14} />
                        </a>
                      </p>
                    </div>

                    <div className="space-y-2">
                      <h4 className="text-sm font-medium text-muted-foreground">Fornecedor</h4>
                      <p className="text-base font-medium">{orderDetails.supplier?.name || "N/A"}</p>
                    </div>

                    <div className="space-y-2">
                      <h4 className="text-sm font-medium text-muted-foreground">Data de Entrega</h4>
                      <p className="text-base font-medium">{formatDate(orderDetails.deliveryDate.toString())}</p>
                    </div>

                    <div className="space-y-2">
                      <h4 className="text-sm font-medium text-muted-foreground">Nº da Ordem de Compra</h4>
                      <p className="text-base font-medium">
                        {orderDetails.purchaseOrder?.orderNumber || "Sem ordem de compra vinculada"}
                      </p>
                    </div>

                    <div className="space-y-2">
                      <h4 className="text-sm font-medium text-muted-foreground">Data de Criação</h4>
                      <p className="text-base font-medium">
                        {orderDetails.createdAt ? formatDate(orderDetails.createdAt.toString()) : "N/A"}
                      </p>
                    </div>
                  </div>

                  {/* Linha do tempo */}
                  <Card className="mt-6">
                    <CardHeader>
                      <CardTitle>Progresso do Pedido</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="relative">
                        {/* Função para determinar se um step foi completado */}
                        {(() => {
                          const currentStatus = orderDetails.status;
                          
                          const getStepStatus = (stepKey: string) => {
                            // Normalizar o status atual para tratar "Em transporte" como "Em Rota"
                            const normalizedStatus = currentStatus === 'Em transporte' ? 'Em Rota' : currentStatus;
                            
                            // Mapear os status possíveis para suas posições na linha do tempo
                            const statusHierarchy: { [key: string]: number } = {
                              'Registrado': 0,
                              'Carregado': 1,
                              'Em Rota': 2,
                              'Entregue': 3,
                              'Recusado': -1 // Status especial
                            };

                            const stepHierarchy: { [key: string]: number } = {
                              'Registrado': 0,
                              'Carregado': 1,
                              'Em Rota': 2,
                              'Entregue': 3
                            };

                            const currentLevel = statusHierarchy[normalizedStatus] ?? 0;
                            const stepLevel = stepHierarchy[stepKey] ?? 0;

                            // Se o pedido foi recusado, mostrar apenas o primeiro step como completed
                            if (currentStatus === 'Recusado') {
                              return stepKey === 'Registrado' ? 'completed' : 'pending';
                            }

                            // Lógica normal para outros status
                            if (currentLevel > stepLevel) {
                              return 'completed';
                            } else if (currentLevel === stepLevel) {
                              return 'current';
                            } else {
                              return 'pending';
                            }
                          };

                          const steps = [
                            { key: 'Registrado', label: 'Registrado', description: 'Pedido criado' },
                            { key: 'Carregado', label: 'Carregado', description: 'Documentos enviados' },
                            { key: 'Em Rota', label: 'Em Rota', description: 'A caminho do destino' },
                            { key: 'Entregue', label: 'Entregue', description: 'Pedido finalizado' }
                          ];

                          return (
                            <>
                              {/* Linha de progresso */}
                              <div className="absolute top-4 left-4 right-4 h-0.5 bg-border"></div>
                              <div 
                                className="absolute top-4 left-4 h-0.5 bg-primary transition-all duration-300"
                                style={{
                                  width: `${(() => {
                                    // Calcular progresso baseado no status atual
                                    const statusProgress: { [key: string]: number } = {
                                      'Registrado': 0,
                                      'Carregado': 33.33,
                                      'Em Rota': 66.66,
                                      'Em transporte': 66.66, // Mesmo que Em Rota
                                      'Entregue': 100,
                                      'Recusado': 0
                                    };
                                    return statusProgress[orderDetails.status] || 0;
                                  })()}%`
                                }}
                              ></div>

                              {/* Container horizontal dos steps */}
                              <div className="flex justify-between items-start relative">
                                {steps.map((step, index) => {
                                  const stepStatus = getStepStatus(step.key);

                                  return (
                                    <div key={step.key} className="flex flex-col items-center text-center flex-1">
                                      <div className={`flex h-8 w-8 items-center justify-center rounded-full relative z-10 transition-all duration-300 ${
                                        stepStatus === 'completed'
                                          ? 'bg-primary text-primary-foreground' 
                                          : stepStatus === 'current'
                                          ? 'bg-primary/20 text-primary border-2 border-primary'
                                          : 'bg-muted text-muted-foreground'
                                      }`}>
                                        {stepStatus === 'completed' ? (
                                          <CheckCircle size={16} />
                                        ) : stepStatus === 'current' ? (
                                          <Clock size={16} />
                                        ) : (
                                          <Clock size={16} />
                                        )}
                                      </div>
                                      <div className="mt-2">
                                        <p className={`text-sm font-medium ${
                                          stepStatus === 'completed' || stepStatus === 'current'
                                            ? 'text-foreground' 
                                            : 'text-muted-foreground'
                                        }`}>
                                          {step.label}
                                        </p>
                                        <p className="text-xs text-muted-foreground">
                                          {step.description}
                                        </p>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </>
                          );
                        })()}
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* Aba de Documentos */}
                <TabsContent value="documents" className="py-4">
                  <Card>
                    <CardHeader>
                      <CardTitle>Documentos do Pedido</CardTitle>
                      <CardDescription>
                        Faça upload dos documentos necessários para prosseguir com o pedido
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      {documentsLoaded || orderDetails.status === 'Carregado' || orderDetails.status === 'Em Rota' || orderDetails.status === 'Em transporte' || orderDetails.status === 'Entregue' ? (
                        <div className="space-y-4">
                          <div className="flex flex-col items-center justify-center p-6 border border-green-200 rounded-lg bg-[#2f2f37]">
                            <FileCheck size={48} className="text-green-500 mb-2" />
                            <h3 className="text-lg font-medium text-green-700">Documentos Carregados</h3>
                            <p className="text-sm text-green-600 text-center mt-2">
                              Todos os documentos necessários foram enviados e processados com sucesso.
                            </p>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                            <div className="p-4 border rounded-lg flex flex-col items-center">
                              <button
                                className="w-16 h-16 rounded-full bg-blue-500 hover:bg-blue-600 text-white flex items-center justify-center transition-all hover:scale-105 cursor-pointer mb-3"
                                onClick={() => {
                                  if (orderId) {
                                    // Usar fetch para fazer o download manualmente
                                    fetch(`/api/pedidos/${orderId}/documentos/nota_pdf`)
                                      .then(response => {
                                        if (!response.ok) {
                                          throw new Error(`Erro ao baixar: ${response.status}`);
                                        }
                                        return response.blob();
                                      })
                                      .then(blob => {
                                        // Criar um URL temporário para o blob
                                        const url = window.URL.createObjectURL(blob);
                                        // Criar um elemento de link para download
                                        const a = document.createElement('a');
                                        a.href = url;
                                        a.download = 'nota_fiscal.pdf';
                                        document.body.appendChild(a);
                                        a.click();
                                        window.URL.revokeObjectURL(url);
                                        a.remove();
                                      })
                                      .catch(error => {
                                        console.error("Erro ao baixar documento:", error);
                                        toast({
                                          title: "Erro",
                                          description: "Não foi possível baixar o documento",
                                          variant: "destructive",
                                        });
                                      });
                                  }
                                }}
                                title="Clique para baixar a Nota Fiscal (PDF)"
                              >
                                <FileText size={32} />
                              </button>
                              <p className="font-medium text-center">Nota Fiscal (PDF)</p>
                              <p className="text-xs text-muted-foreground text-center mt-1">Clique no ícone para baixar</p>
                            </div>

                            <div className="p-4 border rounded-lg flex flex-col items-center">
                              <button
                                className="w-16 h-16 rounded-full bg-purple-500 hover:bg-purple-600 text-white flex items-center justify-center transition-all hover:scale-105 cursor-pointer mb-3"
                                onClick={() => {
                                  if (orderId) {
                                    // Usar fetch para fazer o download manualmente
                                    fetch(`/api/pedidos/${orderId}/documentos/nota_xml`)
                                      .then(response => {
                                        if (!response.ok) {
                                          throw new Error(`Erro ao baixar: ${response.status}`);
                                        }
                                        return response.blob();
                                      })
                                      .then(blob => {
                                        // Criar um URL temporário para o blob
                                        const url = window.URL.createObjectURL(blob);
                                        // Criar um elemento de link para download
                                        const a = document.createElement('a');
                                        a.href = url;
                                        a.download = 'nota_fiscal.xml';
                                        document.body.appendChild(a);
                                        a.click();
                                        window.URL.revokeObjectURL(url);
                                        a.remove();
                                      })
                                      .catch(error => {
                                        console.error("Erro ao baixar documento:", error);
                                        toast({
                                          title: "Erro",
                                          description: "Não foi possível baixar o documento",
                                          variant: "destructive",
                                        });
                                      });
                                  }
                                }}
                                title="Clique para baixar a Nota Fiscal (XML)"
                              >
                                <FileText size={32} />
                              </button>
                              <p className="font-medium text-center">Nota Fiscal (XML)</p>
                              <p className="text-xs text-muted-foreground text-center mt-1">Clique no ícone para baixar</p>
                            </div>

                            <div className="p-4 border rounded-lg flex flex-col items-center">
                              <button
                                className="w-16 h-16 rounded-full bg-yellow-500 hover:bg-yellow-600 text-white flex items-center justify-center transition-all hover:scale-105 cursor-pointer mb-3"
                                onClick={() => {
                                  if (orderId) {
                                    // Usar fetch para fazer o download manualmente
                                    fetch(`/api/pedidos/${orderId}/documentos/certificado_pdf`)
                                      .then(response => {
                                        if (!response.ok) {
                                          throw new Error(`Erro ao baixar: ${response.status}`);
                                        }
                                        return response.blob();
                                      })
                                      .then(blob => {
                                        // Criar um URL temporário para o blob
                                        const url = window.URL.createObjectURL(blob);
                                        // Criar um elemento de link para download
                                        const a = document.createElement('a');
                                        a.href = url;
                                        a.download = 'certificado.pdf';
                                        document.body.appendChild(a);
                                        a.click();
                                        window.URL.revokeObjectURL(url);
                                        a.remove();
                                      })
                                      .catch(error => {
                                        console.error("Erro ao baixar documento:", error);
                                        toast({
                                          title: "Erro",
                                          description: "Não foi possível baixar o documento",
                                          variant: "destructive",
                                        });
                                      });
                                  }
                                }}
                                title="Clique para baixar o Certificado (PDF)"
                              >
                                <FileText size={32} />
                              </button>
                              <p className="font-medium text-center">Certificado (PDF)</p>
                              <p className="text-xs text-muted-foreground text-center mt-1">Clique no ícone para baixar</p>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-6">
                          <div className="space-y-4">
                            <div className="flex items-center space-x-3">
                              <button
                                className={`w-12 h-12 rounded-full flex items-center justify-center transition-all hover:scale-105 cursor-pointer ${notaPdf ? 'bg-green-500 text-white hover:bg-green-600' : 'bg-gray-200 text-gray-500 hover:bg-gray-300'}`}
                                onClick={() => {
                                  console.log("Clique no ícone PDF");
                                  if (notaPdfRef.current) {
                                    notaPdfRef.current.value = '';
                                    notaPdfRef.current.click();
                                  }
                                }}
                                title={notaPdf ? 'Alterar arquivo PDF' : 'Selecionar arquivo PDF'}
                              >
                                {notaPdf ? <CheckCircle size={20} /> : <Upload size={20} />}
                              </button>
                              <div className="flex-1">
                                <label className="text-sm font-medium">Nota Fiscal (PDF)</label>
                                <p className="text-xs text-muted-foreground">
                                  {notaPdf ? `${notaPdf.name} (${Math.round(notaPdf.size / 1024)} KB)` : 'Clique no ícone para selecionar o arquivo PDF da nota fiscal'}
                                </p>
                              </div>
                              <input
                                key={`nota-pdf-${orderId}`}
                                type="file"
                                ref={notaPdfRef}
                                accept=".pdf"
                                className="hidden"
                                onChange={(e) => handleFileChange(e, setNotaPdf)}
                              />
                            </div>
                          </div>

                          <div className="space-y-4">
                            <div className="flex items-center space-x-3">
                              <button
                                className={`w-12 h-12 rounded-full flex items-center justify-center transition-all hover:scale-105 cursor-pointer ${notaXml ? 'bg-green-500 text-white hover:bg-green-600' : 'bg-gray-200 text-gray-500 hover:bg-gray-300'}`}
                                onClick={() => {
                                  console.log("Clique no ícone XML");
                                  if (notaXmlRef.current) {
                                    notaXmlRef.current.value = '';
                                    notaXmlRef.current.click();
                                  }
                                }}
                                title={notaXml ? 'Alterar arquivo XML' : 'Selecionar arquivo XML'}
                              >
                                {notaXml ? <CheckCircle size={20} /> : <Upload size={20} />}
                              </button>
                              <div className="flex-1">
                                <label className="text-sm font-medium">Nota Fiscal (XML)</label>
                                <p className="text-xs text-muted-foreground">
                                  {notaXml ? `${notaXml.name} (${Math.round(notaXml.size / 1024)} KB)` : 'Clique no ícone para selecionar o arquivo XML da nota fiscal'}
                                </p>
                              </div>
                              <input
                                key={`nota-xml-${orderId}`}
                                type="file"
                                ref={notaXmlRef}
                                accept=".xml"
                                className="hidden"
                                onChange={(e) => handleFileChange(e, setNotaXml)}
                              />
                            </div>
                          </div>

                          <div className="space-y-4">
                            <div className="flex items-center space-x-3">
                              <button
                                className={`w-12 h-12 rounded-full flex items-center justify-center transition-all hover:scale-105 cursor-pointer ${certificadoPdf ? 'bg-green-500 text-white hover:bg-green-600' : 'bg-gray-200 text-gray-500 hover:bg-gray-300'}`}
                                onClick={() => {
                                  console.log("Clique no ícone Certificado");
                                  if (certificadoPdfRef.current) {
                                    certificadoPdfRef.current.value = '';
                                    certificadoPdfRef.current.click();
                                  }
                                }}
                                title={certificadoPdf ? 'Alterar certificado PDF' : 'Selecionar certificado PDF'}
                              >
                                {certificadoPdf ? <CheckCircle size={20} /> : <Upload size={20} />}
                              </button>
                              <div className="flex-1">
                                <label className="text-sm font-medium">Certificado de Qualidade (PDF)</label>
                                <p className="text-xs text-muted-foreground">
                                  {certificadoPdf ? `${certificadoPdf.name} (${Math.round(certificadoPdf.size / 1024)} KB)` : 'Clique no ícone para selecionar o certificado de qualidade do produto'}
                                </p>
                              </div>
                              <input
                                key={`certificado-pdf-${orderId}`}
                                type="file"
                                ref={certificadoPdfRef}
                                accept=".pdf"
                                className="hidden"
                                onChange={(e) => handleFileChange(e, setCertificadoPdf)}
                              />
                            </div>
                          </div>
                        </div>
                      )}
                    </CardContent>
                    {!documentsLoaded && orderDetails.status !== 'Carregado' && orderDetails.status !== 'Em Rota' && orderDetails.status !== 'Em transporte' && orderDetails.status !== 'Entregue' && (
                      <CardFooter className="flex justify-end">
                        <Button 
                          variant="default"
                          onClick={handleUploadDocuments}
                          disabled={!notaPdf || !notaXml || !certificadoPdf || documentUploadMutation.isPending}
                          className="flex items-center gap-1"
                        >
                          <Upload size={16} />
                          <span>{documentUploadMutation.isPending ? 'Enviando...' : 'Enviar Documentos'}</span>
                        </Button>
                      </CardFooter>
                    )}
                  </Card>
                </TabsContent>

                {/* Aba de Confirmar Entrega */}
                <TabsContent value="confirm" className="py-4">
                  <Card>
                    <CardHeader>
                      <CardTitle>Confirmar Recebimento</CardTitle>
                      <CardDescription>
                        Registre a quantidade efetivamente recebida e confirme ou rejeite a entrega
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {orderDetails.status === 'Entregue' ? (
                        <div className="flex flex-col items-center justify-center p-6 border border-green-200 rounded-lg bg-[#2f2f37]">
                          <CheckCircle size={48} className="text-green-500 mb-2" />
                          <h3 className="text-lg font-medium text-green-700">Entrega Confirmada</h3>
                          <p className="text-sm text-green-600 text-center mt-2">
                            Esta entrega foi confirmada com a quantidade: {formatNumber(orderDetails.quantidadeRecebida || orderDetails.quantity)}
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <label className="text-sm font-medium">
                            Quantidade Aferida (peso real em balança)
                          </label>
                          <Input
                            type="number"
                            placeholder={`Ex: ${formatNumber(orderDetails.quantity)}`}
                            value={confirmedQuantity}
                            onChange={(e) => setConfirmedQuantity(e.target.value)}
                            className="bg-input border-border"
                          />
                          <p className="text-xs text-muted-foreground">
                            Quantidade solicitada: {formatNumber(orderDetails.quantity)}
                          </p>
                        </div>
                      )}
                    </CardContent>
                    {orderDetails.status !== 'Entregue' && (
                      <CardFooter className="flex justify-between">
                        <Button 
                          variant="destructive"
                          onClick={() => handleConfirmDelivery('rejeitado')}
                          className="flex items-center gap-1"
                        >
                          <X size={16} />
                          <span>Rejeitar Carga</span>
                        </Button>
                        <Button 
                          variant="default"
                          onClick={() => handleConfirmDelivery('aprovado')}
                          className="flex items-center gap-1"
                        >
                          <CircleCheck size={16} />
                          <span>Aprovar Carga</span>
                        </Button>
                      </CardFooter>
                    )}
                  </Card>
                </TabsContent>

                {/* Aba de Rastreamento */}
                <TabsContent value="tracking" className="py-4">
                  <Card>
                    <CardHeader>
                      <CardTitle>Rastreamento do Pedido</CardTitle>
                      <CardDescription>
                        Acompanhe o status atual do pedido e atualizações de localização
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="text-center py-6">
                        <MapPin size={48} className="mx-auto text-muted-foreground mb-4" />
                        <h3 className="text-lg font-medium mb-2">Rastreamento em desenvolvimento</h3>
                        <p className="text-muted-foreground">
                          O rastreamento detalhado estará disponível em breve. Por enquanto, você pode acompanhar o status geral do pedido.
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* Aba de Histórico */}
                <TabsContent value="history" className="py-4">
                  <Card>
                    <CardHeader className="flex flex-col space-y-1.5 p-6 pt-[2px] pb-[2px] ml-[-9px] mr-[-9px]">
                      <CardTitle>Histórico do Pedido</CardTitle>
                      <CardDescription>
                        Registro completo de todas as atualizações e alterações
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {/* Etapa 1: Criação da Ordem de Compra (sempre presente) */}
                        <div className="border rounded-lg overflow-hidden">
                          <div className="p-3 flex items-center justify-between pt-[0px] pb-[0px] bg-[#26262c]">
                            <div className="flex items-center space-x-3">
                              <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white">
                                <FileText size={16} />
                              </div>
                              <div>
                                <h4 className="font-medium">Criação da Ordem de Compra</h4>
                                <p className="text-sm text-muted-foreground">
                                  {orderDetails.purchaseOrder ? 
                                    formatDate(orderDetails.purchaseOrder.createdAt?.toString() || '') : 
                                    '(data não disponível)'}
                                </p>
                              </div>
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {/* Nome do usuário que criou */}
                              {orderDetails.purchaseOrder?.userId ? `ID do usuário: ${orderDetails.purchaseOrder.userId}` : ''}
                            </div>
                          </div>
                          <div className="p-3 border-t pt-[5px] pb-[5px]">
                            <p className="text-sm">
                              Ordem de compra <strong>{orderDetails.purchaseOrder?.orderNumber}</strong> foi criada
                            </p>
                          </div>
                        </div>

                        {/* Etapa 2: Criação do Pedido (sempre presente) */}
                        <div className="border rounded-lg overflow-hidden">
                          <div className="p-3 flex items-center justify-between bg-[#26262c] pt-[0px] pb-[0px]">
                            <div className="flex items-center space-x-3">
                              <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white">
                                <Package size={16} />
                              </div>
                              <div>
                                                                  <h4 className="font-medium">Pedido Registrado</h4>
                                <p className="text-sm text-muted-foreground">
                                  {orderDetails.createdAt ? 
                                    formatDate(orderDetails.createdAt.toString()) : 
                                    '(data não disponível)'}
                                </p>
                              </div>
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {/* Nome do usuário que criou */}
                              {orderDetails.userId ? `ID do usuário: ${orderDetails.userId}` : ''}
                            </div>
                          </div>
                          <div className="p-3 border-t pt-[5px] pb-[5px]">
                            <p className="text-sm">
                              Pedido <strong>{orderDetails.orderId}</strong> foi criado para o produto <strong>{orderDetails.product?.name}</strong>
                            </p>
                          </div>
                        </div>

                        {/* Etapa 3: Carregamento de Documentos (condicional) */}
                        {(orderDetails.status === 'Carregado' || orderDetails.status === 'Em Rota' || orderDetails.status === 'Em transporte' || orderDetails.status === 'Entregue') && (
                          <div className="border rounded-lg overflow-hidden">
                            <div className="p-3 flex items-center justify-between bg-[#26262c] pt-[0px] pb-[0px]">
                              <div className="flex items-center space-x-3">
                                <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white">
                                  <FileCheck size={16} />
                                </div>
                                <div>
                                  <h4 className="font-medium">Carregado</h4>
                                  <p className="text-sm text-muted-foreground">
                                    {/* Data estimada para quando os documentos foram carregados */}
                                    {formatDate(new Date().toString())}
                                  </p>
                                </div>
                              </div>
                              <div className="text-sm text-muted-foreground">
                                {orderDetails.userId ? `ID do usuário: ${orderDetails.userId}` : ''}
                              </div>
                            </div>
                            <div className="p-3 border-t pt-[5px] pb-[5px]">
                              <p className="text-sm">
                                Documentos do pedido foram carregados e verificados
                              </p>
                            </div>
                          </div>
                        )}

                        {/* Etapa 4: Transporte (condicional) */}
                        {(orderDetails.status === 'Em Rota' || orderDetails.status === 'Em transporte' || orderDetails.status === 'Entregue') && (
                          <div className="border rounded-lg overflow-hidden">
                            <div className="p-3 flex items-center justify-between bg-[#26262c] pt-[0px] pb-[0px]">
                              <div className="flex items-center space-x-3">
                                <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white">
                                  <MapPin size={16} />
                                </div>
                                <div>
                                  <h4 className="font-medium">Em Transporte</h4>
                                  <p className="text-sm text-muted-foreground">
                                    {/* Data estimada */}
                                    {formatDate(new Date().toString())}
                                  </p>
                                </div>
                              </div>
                              <div className="text-sm text-muted-foreground">
                                Sistema
                              </div>
                            </div>
                            <div className="p-3 border-t pt-[5px] pb-[5px]">
                              <p className="text-sm">
                                Carga em transporte para destino: <strong>{orderDetails.workLocation}</strong>
                              </p>
                            </div>
                          </div>
                        )}

                        {/* Etapa 5: Entrega (condicional) */}
                        {orderDetails.status === 'Entregue' && (
                          <div className="border rounded-lg overflow-hidden">
                            <div className="p-3 flex items-center justify-between pt-[0px] pb-[0px] bg-[#26262c]">
                              <div className="flex items-center space-x-3">
                                <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center text-white">
                                  <CheckCircle size={16} />
                                </div>
                                <div>
                                  <h4 className="font-medium">Entrega</h4>
                                  <p className="text-sm text-muted-foreground">
                                    {/* Data estimada para quando o pedido foi entregue */}
                                    {formatDate(new Date().toString())}
                                  </p>
                                </div>
                              </div>
                              <div className="text-sm text-muted-foreground">
                                {user?.name || 'Usuário do sistema'}
                              </div>
                            </div>
                            <div className="p-3 border-t pt-[5px] pb-[5px]">
                              <p className="text-sm">
                                Entrega confirmada com quantidade {formatNumber(orderDetails.quantidadeRecebida || orderDetails.quantity)}
                              </p>
                            </div>
                          </div>
                        )}

                        {/* Se não houver eventos além dos dois primeiros */}
                        {orderDetails.status !== 'Carregado' && 
                         orderDetails.status !== 'Em Rota' && 
                         orderDetails.status !== 'Em transporte' && 
                         orderDetails.status !== 'Entregue' && (
                          <div className="text-center p-4 border border-dashed rounded-lg">
                            <Clock size={32} className="mx-auto text-muted-foreground mb-2" />
                            <p className="text-muted-foreground">
                              Aguardando próximos eventos no ciclo de vida do pedido
                            </p>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            </div>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
}