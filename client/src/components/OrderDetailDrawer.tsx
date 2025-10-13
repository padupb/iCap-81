replit_final_file>
import React, { useState, useEffect, useRef, useMemo } from "react";
import type { ChangeEvent, Dispatch, SetStateAction } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
  DrawerFooter,
} from "@/components/ui/drawer";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { formatDate } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";
import { useSettings } from "@/context/SettingsContext";
import {
  Package,
  CircleCheck,
  MapPin,
  History,
  ExternalLink,
  CheckCircle,
  X,
  FileText,
  Upload,
  FileCheck,
  Clock,
  Download,
  AlertCircle,
  Camera,
  Truck,
  XCircle,
  Edit,
  Calendar as CalendarIcon,
} from "lucide-react";
import { Order, Product, Company, PurchaseOrder, Unit } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { QRCodeComponent } from "./QRCodeComponent";
import { DocumentData, PDFViewer } from "./PDFViewer"; // Importa o componente PDFViewer e seu tipo

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

// Tipo para tracking points
type TrackingPoint = {
  id: number;
  status: string;
  comment?: string;
  user_id: number;
  user_name?: string;
  latitude: number;
  longitude: number;
  created_at: string;
};

// Função para formatar números com vírgula (formato brasileiro)
const formatNumber = (value: string | number): string => {
  const numValue = typeof value === "string" ? parseFloat(value) : value;
  if (isNaN(numValue)) return value.toString();

  // Usar toLocaleString com locale brasileiro para vírgula como separador decimal
  return numValue.toLocaleString("pt-BR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2, // Máximo 2 casas decimais
  });
};

import MapComponent from "./MapComponent";

// Componente de Rastreamento com Mapa
function SimpleTracker({
  orderId,
  orderDetails,
}: {
  orderId: number;
  orderDetails: OrderDetails | null;
}) {
  const [trackingPoints, setTrackingPoints] = useState<TrackingPoint[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  // Buscar pontos de rastreamento
  const fetchTrackingPoints = async () => {
    try {
      setError(null);
      setIsLoading(true);
      console.log(`🔍 Buscando pontos de rastreamento para pedido: ${orderId}`);
      const response = await fetch(`/api/tracking-points/${orderId}`);
      if (!response.ok) {
        throw new Error(`Erro ao buscar dados: ${response.statusText}`);
      }
      const data = await response.json();
      console.log(`📍 Pontos recebidos:`, data);
      setTrackingPoints(data || []);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Erro desconhecido";
      console.error("Erro ao buscar tracking points:", errorMessage);
      setError(errorMessage);
      toast({
        title: "Erro ao carregar rastreamento",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Efeito para buscar dados iniciais
  useEffect(() => {
    if (orderId) {
      fetchTrackingPoints();
    }
  }, [orderId]);

  // Atualização em tempo real
  useEffect(() => {
    if (!orderId) return;

    const interval = setInterval(fetchTrackingPoints, 30000); // Atualiza a cada 30 segundos
    return () => clearInterval(interval);
  }, [orderId]);

  // Coordenadas padrão (Cuiabá - MT) ou do último ponto de rastreamento (mais recente)
  const getMapCoordinates = () => {
    if (trackingPoints.length > 0) {
      const lastPoint = trackingPoints[trackingPoints.length - 1];
      return {
        lat: Number(lastPoint.latitude),
        lng: Number(lastPoint.longitude),
      };
    }

    // Coordenadas padrão de Cuiabá - MT
    return {
      lat: -15.60141,
      lng: -56.097891,
    };
  };

  const coordinates = getMapCoordinates();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
          <p className="text-muted-foreground">Carregando rastreamento...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center p-6 space-y-4">
        <AlertCircle className="h-12 w-12 text-destructive" />
        <div className="text-center">
          <h3 className="text-lg font-medium">Erro ao carregar rastreamento</h3>
          <p className="text-sm text-muted-foreground">{error}</p>
        </div>
      </div>
    );
  }

  return (
      <div className="space-y-4">
        {/* Seção do Mapa */}
        <div className="space-y-2">
          <div className="border rounded-lg overflow-hidden" style={{ height: '400px' }}>
            <MapComponent
              lat={coordinates.lat}
              lng={coordinates.lng}
              zoom={trackingPoints.length > 0 ? 15 : 12}
            />
          </div>
          {trackingPoints.length > 0 ? (
            <p className="text-xs text-muted-foreground text-center">
              Mostrando localização mais recente do rastreamento
            </p>
          ) : (
            <p className="text-xs text-muted-foreground text-center">
              Mapa com localização padrão - Aguardando pontos de rastreamento
            </p>
          )}
        </div>

        {/* Seção dos Pontos de Rastreamento */}
        {trackingPoints.length === 0 ? (
          <div className="text-center py-8">
            <MapPin className="mx-auto h-12 w-12 text-muted-foreground mb-2" />
            <div className="text-muted-foreground text-sm font-medium">
              Nenhum ponto de rastreamento encontrado
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              Os pontos aparecerão aqui quando forem adicionados
            </div>
          </div>
        ) : (
          <div className="space-y-8">
            <h4 className="font-medium">
              Pontos de Rastreamento ({trackingPoints.length})
            </h4>
            <div className="grid gap-3">
              {trackingPoints.map((point, index) => (
                <div
                  key={point.id}
                  className="flex items-center justify-between p-4 border rounded-lg bg-muted/20"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-medium">
                      {index + 1}
                    </div>
                    <div>
                      <p className="font-medium">
                        Ponto {index + 1}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {formatDate(point.created_at)}
                      </p>
                    </div>
                  </div>
                  {point.latitude && point.longitude && (
                    <div className="text-right text-sm text-muted-foreground">
                      <p>Lat: {Number(point.latitude).toFixed(6)}</p>
                      <p>Lng: {Number(point.longitude).toFixed(6)}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
  );
}

export function OrderDetailDrawer({
  open,
  onOpenChange,
  orderId,
}: OrderDetailDrawerProps) {
  const { user } = useAuth();
  // Definir um valor inicial diferente de "details" para forçar a renderização adequada
  const [activeTab, setActiveTab] = useState("details");
  // Estado para controlar a quantidade confirmada na entrega
  const [confirmedQuantity, setConfirmedQuantity] = useState("");

  // Estado para a foto da nota assinada
  const [fotoNotaAssinada, setFotoNotaAssinada] = useState<File | null>(null);

  // Estados para reprogramação
  const [isReprogramDialogOpen, setIsReprogramDialogOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [justificativa, setJustificativa] = useState("");
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);

  // Estados para cancelamento
  const [isCancelDialogOpen, setIsCancelDialogOpen] = useState(false);
  const [cancelJustification, setCancelJustification] = useState("");

  // Estado para número do pedido
  const [numeroPedido, setNumeroPedido] = useState("");

  // Refs para os inputs de arquivo
  const notaPdfRef = useRef<HTMLInputElement>(null);
  const notaXmlRef = useRef<HTMLInputElement>(null);
  const certificadoPdfRef = useRef<HTMLInputElement>(null);
  const fotoNotaAssinadaRef = useRef<HTMLInputElement>(null);

  // Debug dos refs (apenas quando necessário)
  useEffect(() => {
    if (open && activeTab === "documents") {
      console.log("Aba de documentos aberta, verificando refs:", {
        notaPdfRef: !!notaPdfRef.current,
        notaXmlRef: !!notaXmlRef.current,
        certificadoPdfRef: !!certificadoPdfRef.current,
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
  const [orderHistory, setOrderHistory] = useState<
    Array<{
      etapa: string;
      data: string;
      usuario: string;
      descricao?: string;
    }>
  >([]);

  // Buscar histórico do pedido
  const { data: historyData } = useQuery({
    queryKey: [`/api/pedidos/${orderId}/historico`],
    queryFn: async () => {
      if (!orderId) return [];
      const response = await fetch(`/api/pedidos/${orderId}/historico`);
      if (!response.ok) return [];
      return await response.json();
    },
    enabled: !!orderId && open,
  });

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

  // Buscar unidades para exibir junto com o produto
  const { data: units = [] } = useQuery<Unit[]>({
    queryKey: ["/api/units"],
    enabled: !!orderId && open,
  });

  // Buscar usuários para exibir nomes no histórico
  const { data: users = [] } = useQuery({
    queryKey: ["/api/users"],
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
  const orderDetails = useMemo(() => {
    if (!orderId) return null;

    const order = orders.find((o) => o.id === orderId);
    if (!order) return null;

    console.log('📋 Debug orderDetails:', {
      orderId: order.id,
      numeroPedido: order.numeroPedido,
      numero_pedido: order.numero_pedido,
      status: order.status
    });

    const product = products.find((p) => p.id === order.productId);
    const supplier = companies.find((c) => c.id === order.supplierId);
    const unit = product ? units.find((u) => u.id === product.unitId) : null;

    // Buscar ordem de compra: primeiro na tabela ordens_compra, depois em purchase_orders
    let purchaseOrder = null;
    let purchaseOrderCompany = null;
    let workDestination = null; // Nova variável para armazenar a obra de destino

    if (order.purchaseOrderId) {
      // Primeiro, verificar ordensCompra (tabela principal)
      const ordensArray = Array.isArray(ordensCompra) ? ordensCompra : [];
      const ordemCompra = ordensArray.find(
        (oc: any) => oc.id === order.purchaseOrderId,
      );

      console.log("🔍 Debug ordem de compra encontrada:", ordemCompra);
      console.log("🏢 Debug empresas disponíveis:", companies);

      if (ordemCompra) {
        // Converte o formato da ordem de compra para o padrão esperado
        purchaseOrder = {
          id: ordemCompra.id,
          orderNumber: ordemCompra.numero_ordem,
          companyId: ordemCompra.empresa_id,
          validUntil: ordemCompra.valido_ate,
          status: ordemCompra.status || "Ativo",
          userId: ordemCompra.usuario_id || 1,
          createdAt: ordemCompra.data_criacao
            ? new Date(ordemCompra.data_criacao)
            : new Date(),
        } as PurchaseOrder;

        // Buscar a empresa da ordem de compra
        purchaseOrderCompany = companies.find((c) => c.id === ordemCompra.empresa_id);

        // Buscar a obra de destino usando o cnpj da ordem de compra
        console.log("🎯 Debug cnpj da obra na ordem:", ordemCompra.cnpj);
        if (ordemCompra.cnpj) {
          workDestination = companies.find((c) => c.cnpj === ordemCompra.cnpj);
          console.log("🏗️ Debug obra de destino encontrada:", workDestination);
        } else {
          console.log("⚠️ cnpj não definido na ordem de compra");
        }
      } else {
        // Se não encontrou em ordens_compra, buscar em purchase_orders
        const purchaseOrderFound = purchaseOrders.find(
          (po) => po.id === order.purchaseOrderId,
        );
        if (purchaseOrderFound) {
          purchaseOrder = purchaseOrderFound;
          // Buscar a empresa da ordem de compra
          purchaseOrderCompany = companies.find((c) => c.id === purchaseOrderFound.companyId);
        }
      }
    }

    return {
      ...order,
      product,
      supplier,
      purchaseOrder,
      purchaseOrderCompany,
      unit,
      workDestination, // Adicionar a obra de destino aos dados retornados
    } as OrderDetails & {
      purchaseOrderCompany?: Company;
      unit?: Unit;
      workDestination?: Company;
    };
  }, [orderId, orders, products, companies, purchaseOrders, ordensCompra, units]);

  // Função para formatar produto com quantidade e unidade
  const formatProductWithUnit = (orderDetails: any) => {
    const productName = orderDetails.product?.name || "Produto não encontrado";
    const quantity = formatNumber(orderDetails.quantity);
    const unitAbbreviation = orderDetails.unit?.abbreviation || "";

    return `${productName} - ${quantity} ${unitAbbreviation}`.trim();
  };

  // Reset state when drawer opens
  useEffect(() => {
    if (open && orderDetails) {
      // Não resetamos a aba ativa aqui para manter a navegação entre abas
      setConfirmedQuantity("");
      setFotoNotaAssinada(null);

      // Verificar se os documentos já foram carregados com base no status do pedido
      if (
        orderDetails.documentosCarregados ||
        orderDetails.status === "Carregado" ||
        orderDetails.status === "Em Rota" ||
        orderDetails.status === "Em transporte" ||
        orderDetails.status === "Entregue"
      ) {
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
  }, [
    open,
    orderDetails?.id,
    orderDetails?.status,
    orderDetails?.documentosCarregados,
  ]);

  // Verificar se o usuário pode confirmar entregas
  const canConfirmDelivery = () => {
    if (!user) return false;

    // Usuário admin pode confirmar qualquer entrega
    if (user.email.endsWith("@admin.icap")) return true;

    // Verificar se o usuário tem permissão específica para confirmar entregas
    return !!user.canConfirmDelivery;
  };

  // Verificar se o usuário pode fazer upload de documentos
  const canUploadDocuments = () => {
    if (!user || !orderDetails) return false;

    // NENHUM usuário pode fazer upload em pedidos cancelados ou suspensos
    if (orderDetails.quantidade === 0 || orderDetails.status === "Cancelado" || orderDetails.status === "Suspenso") return false;

    // KeyUser sempre pode fazer upload (exceto em pedidos cancelados/suspensos)
    if (user.id === 1 || user.isKeyUser) return true;

    // Verificar se o usuário pertence à empresa fornecedora do pedido
    if (user.companyId && orderDetails.supplierId) {
      return user.companyId === orderDetails.supplierId;
    }

    return false;
  };

  // Verificar se o usuário pode solicitar reprogramação
  const canRequestReschedule = () => {
    if (!user || !orderDetails) return false;

    // Só pode reprogramar se o pedido não estiver entregue, cancelado ou suspenso
    if (["Entregue", "Cancelado", "Suspenso"].includes(orderDetails.status)) return false;

    // KeyUsers (IDs 1-5) sempre podem reprogramar
    if ((user.id >= 1 && user.id <= 5) || user.isKeyUser) {
      console.log(`🔑 KeyUser (ID ${user.id}) detectado - permitindo reprogramação do pedido ${orderDetails.orderId}`);
      return true;
    }

    // Verificar se o usuário pertence à empresa de destino
    if (!user.companyId) return false;

    // Buscar a empresa de destino através do orderDetails
    const workDestination = (orderDetails as any)?.workDestination;
    if (!workDestination) return false;

    // Verificar se o CNPJ da empresa do usuário corresponde ao CNPJ da obra de destino
    const userCompany = companies.find(c => c.id === user.companyId);
    if (!userCompany) return false;

    return userCompany.cnpj === workDestination.cnpj;
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
    enabled: !!orderId && open,
  });

  // Efeito para processar os dados dos documentos quando eles são carregados
  useEffect(() => {
    if (documentosData?.temDocumentos) {
      setDocumentsLoaded(true);
      console.log(
        "Documentos carregados do servidor:",
        documentosData.documentos,
      );
    }
  }, [documentosData]);

  // Mutation para upload de documentos - agora usando o servidor real
  const documentUploadMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      if (!orderId) {
        throw new Error("ID do pedido não encontrado");
      }

      try {
        console.log(`📤 Iniciando upload de documentos para pedido ${orderId}`);

        const response = await fetch(`/api/pedidos/${orderId}/documentos`, {
          method: "POST",
          body: formData,
        });

        console.log(`📥 Resposta recebida: ${response.status} ${response.statusText}`);
        console.log(`📋 Content-Type: ${response.headers.get('content-type')}`);

        if (!response.ok) {
          // Tentar ler como texto primeiro
          const responseText = await response.text();
          console.error(`❌ Erro do servidor (${response.status}):`, responseText);

          // Tentar interpretar como JSON se possível
          try {
            const errorData = JSON.parse(responseText);
            throw new Error(
              errorData.mensagem || errorData.message || "Falha ao fazer upload dos documentos",
            );
          } catch (jsonError) {
            // Se não for JSON válido, usar o texto da resposta
            throw new Error(
              responseText.substring(0, 200) || `Erro no servidor: ${response.status}`,
            );
          }
        }

        // Verificar se a resposta é JSON antes de tentar fazer parse
        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
          const responseText = await response.text();
          console.error(`❌ Resposta não é JSON:`, responseText.substring(0, 200));
          throw new Error(`Servidor retornou resposta inválida: ${responseText.substring(0, 100)}`);
        }

        const data = await response.json();
        console.log("✅ Resposta do servidor:", data);
        return data;
      } catch (error) {
        console.error("❌ Erro no upload:", error);
        throw error;
      }
    },
    onSuccess: (data) => {
      // Atualizar o estado local
      setDocumentsLoaded(true);

      // Invalidar as queries para atualizar os dados
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
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
        description:
          error instanceof Error ? error.message : "Falha ao enviar documentos",
        variant: "destructive",
      });
    },
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
        description:
          "Todos os três documentos são obrigatórios (Nota Fiscal PDF, Nota Fiscal XML e Certificado PDF)",
        variant: "destructive",
      });
      return;
    }

    // Verificar tipos de arquivo
    if (notaPdf && notaPdf.type !== "application/pdf") {
      toast({
        title: "Formato Inválido",
        description: "O arquivo da Nota Fiscal deve estar em formato PDF",
        variant: "destructive",
      });
      return;
    }

    if (
      notaXml &&
      !notaXml.name.endsWith(".xml") &&
      notaXml.type !== "text/xml" &&
      notaXml.type !== "application/xml"
    ) {
      toast({
        title: "Formato Inválido",
        description: "O arquivo da Nota Fiscal deve estar em formato XML",
        variant: "destructive",
      });
      return;
    }

    if (certificadoPdf && certificadoPdf.type !== "application/pdf") {
      toast({
        title: "Formato Inválido",
        description: "O certificado deve estar em formato PDF",
        variant: "destructive",
      });
      return;
    }

    // Verificar tamanho (máximo 10MB)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (
      (notaPdf && notaPdf.size > maxSize) ||
      (notaXml && notaXml.size > maxSize) ||
      (certificadoPdf && certificadoPdf.size > maxSize)
    ) {
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
      formData.append("nota_pdf", notaPdf as Blob);
    }
    if (notaXml) {
      formData.append("nota_xml", notaXml as Blob);
    }
    if (certificadoPdf) {
      formData.append("certificado_pdf", certificadoPdf as Blob);
    }

    toast({
      title: "Enviando documentos",
      description: "Aguarde enquanto os documentos são enviados...",
    });

    documentUploadMutation.mutate(formData);
  };

  // Função para lidar com a seleção de arquivos
  const handleFileChange = (
    e: ChangeEvent<HTMLInputElement>,
    setFile: Dispatch<SetStateAction<File | null>>,
  ) => {
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

  const handleFotoChange = (
    e: ChangeEvent<HTMLInputElement>,
    setFile: Dispatch<SetStateAction<File | null>>,
  ) => {
    console.log("handleFotoChange chamado", e.target.files);
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      console.log("Arquivo selecionado:", file.name, file.type, file.size);
      setFile(file);
      toast({
        title: "Foto selecionada",
        description: `${file.name} (${Math.round(file.size / 1024)} KB)`,
      });
    } else {
      console.log("Nenhum arquivo selecionado");
    }
  };

  // Função para confirmar número do pedido
  const handleConfirmNumeroPedido = async () => {
    if (!orderDetails || !numeroPedido.trim()) {
      toast({
        title: "Erro",
        description: "Informe o número do pedido",
        variant: "destructive",
      });
      return;
    }

    if (numeroPedido.length > 20) {
      toast({
        title: "Erro",
        description: "O número do pedido deve ter no máximo 20 caracteres",
        variant: "destructive",
      });
      return;
    }

    console.log(`📤 Enviando confirmação de número do pedido:`, {
      pedidoId: orderDetails.id,
      numeroPedido: numeroPedido.trim()
    });

    try {
      const response = await fetch(`/api/pedidos/${orderDetails.id}/confirmar-numero-pedido`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          numeroPedido: numeroPedido.trim(),
        }),
      });

      console.log(`📥 Resposta recebida:`, {
        status: response.status,
        statusText: response.statusText,
        contentType: response.headers.get("content-type")
      });

      if (!response.ok) {
        console.error(`❌ Resposta não OK: ${response.status}`);
        throw new Error(`Erro no servidor: ${response.status}`);
      }

      const result = await response.json();
      console.log(`📋 Resultado parseado:`, result);

      if (result.sucesso) {
        toast({
          title: "Sucesso",
          description: "Número do pedido confirmado - Status alterado para Em Rota",
        });

        // Atualizar a lista de pedidos
        await queryClient.invalidateQueries({ queryKey: ["/api/orders"] });

        // NÃO fechar o drawer - apenas atualizar para mostrar tela travada
        // A atualização das queries forçará o re-render com o novo estado
      } else {
        console.error(`❌ Erro no resultado:`, result.mensagem);
        toast({
          title: "Erro",
          description: result.mensagem || "Erro desconhecido",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("❌ Erro ao confirmar número do pedido:", error);
      toast({
        title: "Erro",
        description: error instanceof Error ? error.message : "Erro ao confirmar número do pedido",
        variant: "destructive",
      });
    }
  };

  // Função para solicitar reprogramação
  const handleRequestReschedule = async () => {
    if (!orderDetails || !selectedDate || !justificativa.trim()) {
      toast({
        title: "Erro",
        description: "Selecione uma data e informe a justificativa",
        variant: "destructive",
      });
      return;
    }

    if (justificativa.length > 100) {
      toast({
        title: "Erro",
        description: "A justificativa deve ter no máximo 100 caracteres",
        variant: "destructive",
      });
      return;
    }

    try {
      const response = await fetch(`/api/pedidos/${orderDetails.id}/reprogramar`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          novaDataEntrega: selectedDate.toISOString(),
          motivo: justificativa.trim(),
        }),
      });

      const result = await response.json();

      if (result.sucesso) {
        toast({
          title: "Sucesso",
          description: "Reprogramação solicitada com sucesso",
        });

        // Atualizar a lista de pedidos
        queryClient.invalidateQueries({ queryKey: ["/api/orders"] });

        // Fechar o dialog e limpar os campos
        setIsReprogramDialogOpen(false);
        setSelectedDate(undefined);
        setJustificativa("");
      } else {
        toast({
          title: "Erro",
          description: result.mensagem,
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Erro ao solicitar reprogramação:", error);
      toast({
        title: "Erro",
        description: "Erro ao solicitar reprogramação",
        variant: "destructive",
      });
    }
  };

  // Função para cancelar pedido
  const handleCancelOrder = async () => {
    if (!orderDetails || !cancelJustification.trim()) {
      toast({
        title: "Erro",
        description: "Informe o motivo do cancelamento",
        variant: "destructive",
      });
      return;
    }

    try {
      const response = await fetch(`/api/pedidos/${orderDetails.id}/cancelar`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          motivo: cancelJustification.trim(),
        }),
      });

      const result = await response.json();

      if (result.sucesso) {
        toast({
          title: "Sucesso",
          description: "Pedido cancelado com sucesso",
        });

        // Atualizar a lista de pedidos
        queryClient.invalidateQueries({ queryKey: ["/api/orders"] });

        // Fechar o dialog e o drawer
        setIsCancelDialogOpen(false);
        onOpenChange(false);
      } else {
        toast({
          title: "Erro",
          description: result.mensagem || "Erro desconhecido ao cancelar pedido",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Erro ao cancelar pedido:", error);
      toast({
        title: "Erro",
        description: error instanceof Error ? error.message : "Erro ao cancelar pedido",
        variant: "destructive",
      });
    }
  };


  // Função para confirmar entrega
  const handleConfirmDelivery = async (action: "aprovado" | "rejeitado") => {
    if (!orderDetails || !canConfirmDelivery) return;

    if (action === "aprovado") {
      if (!confirmedQuantity || parseFloat(confirmedQuantity) <= 0) {
        toast({
          title: "Erro",
          description: "Informe uma quantidade válida",
          variant: "destructive",
        });
        return;
      }

      if (!fotoNotaAssinada) {
        toast({
          title: "Erro",
          description: "Selecione a foto da nota fiscal assinada",
          variant: "destructive",
        });
        return;
      }

      try {
        const formData = new FormData();
        formData.append("quantidadeRecebida", confirmedQuantity);
        formData.append("fotoNotaAssinada", fotoNotaAssinada);

        toast({
          title: "Confirmando entrega",
          description: "Enviando foto e confirmando entrega...",
        });

        const response = await fetch(`/api/pedidos/${orderDetails.id}/confirmar`, {
          method: "POST",
          body: formData,
        });

        const result = await response.json();

        if (result.sucesso) {
          toast({
            title: "Entrega confirmada com sucesso!",
            description: "A foto foi enviada e a entrega foi confirmada automaticamente.",
          });

          // Atualizar a lista de pedidos
          queryClient.invalidateQueries({ queryKey: ["orders"] });

          // Limpar os campos
          setConfirmedQuantity("");
          setFotoNotaAssinada(null);

          // Não fechar o drawer, apenas atualizar para mostrar status entregue
          // onClose();
        } else {
          toast({
            title: "Erro",
            description: result.mensagem,
            variant: "destructive",
          });
        }
      } catch (error) {
        console.error("Erro ao confirmar entrega:", error);
        toast({
          title: "Erro",
          description: "Erro ao confirmar entrega",
          variant: "destructive",
        });
      }
    } else if (action === "rejeitado") {
      // Lógica para rejeitar entrega (se necessário)
      toast({
        title: "Entrega rejeitada",
        description: "A entrega foi rejeitada",
        variant: "destructive",
      });
    }
  };

  // Função para buscar nome do usuário por ID
  const getUserNameById = (userId: number | undefined): string => {
    if (!userId) return "Sistema";
    const user = users.find((u: any) => u.id === userId);
    return user?.name || `Usuário ID: ${userId}`;
  };

  // Função para formatar data e hora no fuso de Cuiabá (-04:00)
  const formatDateTimeInCuiaba = (dateString: string): string => {
    const date = new Date(dateString);

    // Converter para o fuso horário de Cuiabá (UTC-4)
    const cuiabaTime = new Date(date.toLocaleString('en-US', { timeZone: 'America/Cuiaba' }));

    const day = String(cuiabaTime.getDate()).padStart(2, '0');
    const month = String(cuiabaTime.getMonth() + 1).padStart(2, '0');
    const year = cuiabaTime.getFullYear();
    const hours = String(cuiabaTime.getHours()).padStart(2, '0');
    const minutes = String(cuiabaTime.getMinutes()).padStart(2, '0');

    return `${day}/${month}/${year} ${hours}:${minutes}`;
  };

  // Função para gerar link do Google Maps
  const getGoogleMapsLink = (location: string) => {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location)}`;
  };

  // Estado para o visualizador de PDF
  const [isPdfViewerOpen, setIsPdfViewerOpen] = useState(false);
  const [pdfToView, setPdfToView] = useState<DocumentData | null>(null);

  // Função para visualizar PDF
  const handleViewPdf = async (docType: string, defaultFilename: string) => {
    if (!orderId) return;

    try {
      const response = await fetch(`/api/pedidos/${orderId}/documentos/${docType}`);
      if (!response.ok) {
        throw new Error(`Erro ao carregar documento: ${response.statusText}`);
      }

      const blob = await response.blob();
      const reader = new FileReader();

      reader.onloadend = () => {
        const base64Data = reader.result as string;
        const contentDisposition = response.headers.get('Content-Disposition');
        let filename = defaultFilename;

        if (contentDisposition) {
          const matches = contentDisposition.match(/filename="(.+)"/);
          if (matches && matches[1]) {
            filename = matches[1];
          }
        }

        setPdfToView({ data: base64Data, name: filename });
        setIsPdfViewerOpen(true);
      };
      reader.onerror = () => {
        throw new Error("Falha ao ler o arquivo PDF");
      };
      reader.readAsDataURL(blob);
    } catch (error) {
      console.error(`Erro ao visualizar ${docType}:`, error);
      toast({
        title: "Erro ao visualizar documento",
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive",
      });
    }
  };

  // Função para imprimir o pedido
  const handlePrintOrder = () => {
    if (!orderDetails) return;

    // Criar uma nova janela para impressão
    const printWindow = window.open('', '_blank', 'width=800,height=600');
    if (!printWindow) return;

    // Calcular progresso baseado no status atual
    const getStatusProgress = (status: string) => {
      const statusProgress: { [key: string]: number } = {
        Registrado: 0,
        Carregado: 33.33,
        "Em Rota": 66.66,
        "Em transporte": 66.66,
        Entregue: 100,
        Recusado: 0,
      };
      return statusProgress[status] || 0;
    };

    // Gerar o QR code como data URL
    const canvas = document.createElement('canvas');
    import('qrcode').then((QRCode) => {
      QRCode.toCanvas(canvas, orderDetails.orderId, {
        width: 120,
        margin: 1,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      }, (error: any) => {
        if (error) {
          console.error('Erro ao gerar QR code:', error);
          return;
        }

        const qrCodeDataUrl = canvas.toDataURL();
        const currentProgress = getStatusProgress(orderDetails.status);

        // HTML do layout de impressão
        const printHTML = `
          <!DOCTYPE html>
          <html>
            <head>
              <title>Pedido ${orderDetails.orderId}</title>              <style>
                * {
                  margin: 0;
                  padding: 0;
                  box-sizing: border-box;
                }

                body {
                  font-family: Arial, sans-serif;
                  font-size: 12px;
                  line-height: 1.4;
                  color: #333;
                  padding: 20px;
                }

                .header {
                  display: flex;
                  justify-content: space-between;
                  align-items: center;
                  margin-bottom: 30px;
                  padding-bottom: 20px;
                  border-bottom: 2px solid #333;
                }

                .company-info {
                  text-align: center;
                  flex-grow: 1;
                  margin: 0 20px;
                }

                .company-name {
                  font-size: 18px;
                  font-weight: bold;
                  margin-bottom: 5px;
                }

                .qr-section {
                  text-align: center;
                }

                .qr-code {
                  border: 1px solid #ddd;
                  padding: 5px;
                  background: white;
                }

                .order-title {
                  font-size: 24px;
                  font-weight: bold;
                  text-align: center;
                  margin: 20px 0;
                  color: #2563eb;
                }

                .details-grid {
                  display: grid;
                  grid-template-columns: 1fr 1fr;
                  gap: 20px;
                  margin-bottom: 30px;
                }

                .detail-item {
                  margin-bottom: 15px;
                }

                .detail-label {
                  font-weight: bold;
                  color: #666;
                  margin-bottom: 3px;
                }

                .detail-value {
                  font-size: 14px;
                  font-weight: 500;
                }

                .progress-section {
                  margin: 30px 0;
                  padding: 20px;
                  border: 1px solid #ddd;
                  border-radius: 8px;
                  background: #f9fafb;
                }

                .progress-title {
                  font-size: 16px;
                  font-weight: bold;
                  margin-bottom: 20px;
                  text-align: center;
                }

                .progress-steps {
                  display: flex;
                  justify-content: space-between;
                  align-items: center;
                  position: relative;
                  margin: 20px 0;
                }

                .progress-line {
                  position: absolute;
                  top: 20px;
                  left: 0;
                  right: 0;
                  height: 2px;
                  background: #e5e7eb;
                  z-index: 1;
                }

                .progress-line-filled {
                  position: absolute;
                  top: 20px;
                  left: 0;
                  height: 2px;
                  background: #3b82f6;
                  z-index: 2;
                  width: ${currentProgress}%;
                }

                .progress-step {
                  display: flex;
                  flex-direction: column;
                  align-items: center;
                  text-align: center;
                  position: relative;
                  z-index: 3;
                  background: white;
                  padding: 0 10px;
                }

                .step-circle {
                  width: 40px;
                  height: 40px;
                  border-radius: 50%;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  font-weight: bold;
                  margin-bottom: 8px;
                  background: #e5e7eb;
                  color: #6b7280;
                }

                .step-circle.completed {
                  background: #10b981;
                  color: white;
                }

                .step-circle.current {
                  background: #3b82f6;
                  color: white;
                }

                .step-label {
                  font-size: 11px;
                  font-weight: bold;
                }

                .footer {
                  margin-top: 40px;
                  padding-top: 20px;
                  border-top: 1px solid #ddd;
                  text-align: center;
                  font-size: 10px;
                  color: #666;
                }
              </style>
            </head>
            <body>
              <div class="header">
                <div class="company-info">
                  <div class="company-name">iCAP 7.0</div>
                  <div>Sistema de Gestão de Pedidos</div>
                </div>
                <div class="qr-section">
                  <img src="${qrCodeDataUrl}" alt="QR Code" class="qr-code">
                  <div style="font-size: 10px; margin-top: 5px;">Pedido ${orderDetails.orderId}</div>
                </div>
              </div>

              <h1 class="order-title">DETALHES DO PEDIDO ${orderDetails.orderId}</h1>

              <div class="details-grid">
                <div>
                  <div className="detail-item">
                    <div className="detail-label">Produto</div>
                    <div className="detail-value">${formatProductWithUnit(orderDetails)}</div>
                  </div>

                  <div className="detail-item">
                    <div className="detail-label">Destino</div>
                    <div className="detail-value">${(orderDetails as any)?.workDestination?.name || "Obra não especificada"}</div>
                  </div>

                  <div className="detail-item">
                    <div className="detail-label">Empresa da Ordem de Compra</div>
                    <div className="detail-value">${(orderDetails as any)?.purchaseOrderCompany?.name || "Conforme ordem de compra"}</div>
                  </div>

                  <div className="detail-item">
                    <div className="detail-label">Fornecedor</div>
                    <div className="detail-value">${orderDetails.supplier?.name || "N/A"}</div>
                  </div>

                  <div className="detail-item">
                    <div className="detail-label">Data de Entrega</div>
                    <div className="detail-value">${orderDetails.status === "Suspenso" ? (
                                  `<span class="text-orange-600">Reprogramação solicitada</span>`
                                ) : (
                                  formatDate(orderDetails.deliveryDate.toString())
                                )}</div>
                  </div>

                  <div className="detail-item">
                    <div className="detail-label">Nº da Ordem de Compra</div>
                    <div className="detail-value">${orderDetails.purchaseOrder?.orderNumber || "Sem ordem de compra vinculada"}</div>
                  </div>

                  <div className="detail-item">
                    <div className="detail-label">Data de Criação</div>
                    <div className="detail-value">${orderDetails.createdAt ? formatDate(orderDetails.createdAt.toString()) : "N/A"}</div>
                  </div>
                </div>
              </div>

              <div class="progress-section">
                <div class="progress-title">Progresso do Pedido</div>
                <div class="progress-steps">
                  <div class="progress-line"></div>
                  <div class="progress-line-filled"></div>

                  <div class="progress-step">
                    <div class="step-circle completed">1</div>
                    <div class="step-label">Registrado</div>
                  </div>

                  <div class="progress-step">
                    <div class="step-circle ${currentProgress >= 33.33 ? 'completed' : ''}">2</div>
                    <div class="step-label">Carregado</div>
                  </div>

                  <div class="progress-step">
                    <div class="step-circle ${currentProgress >= 66.66 ? 'completed' : ''}">3</div>
                    <div class="step-label">Em Rota</div>
                  </div>

                  <div class="progress-step">
                    <div class="step-circle ${currentProgress >= 100 ? 'completed' : ''}">4</div>
                    <div class="step-label">Entregue</div>
                  </div>
                </div>
              </div>

              <div class="footer">
                <p>Sistema iCAP 7.0 - Gestão de Pedidos</p>
                <p>Documento gerado em ${new Date().toLocaleDateString('pt-BR')}</p>
              </div>
            </body>
          </html>
        `;

        // Escrever o HTML na nova janela
        printWindow.document.write(printHTML);
        printWindow.document.close();

        // Aguardar o carregamento e então imprimir
        printWindow.onload = () => {
          setTimeout(() => {
            printWindow.print();
            printWindow.close();
          }, 500);
        };
      });
    });
  };

  // Analysis: Removed the status badge from the header of the drawer.
  if (!orderId) return null;

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[85vh]">
        <div className="mx-auto w-full max-w-4xl">
          <DrawerHeader>
            <DrawerTitle className="flex items-center justify-between">
              <span>Pedido {orderDetails?.orderId}</span>
              <Button
                variant="outline"
                size="icon"
                onClick={() => handlePrintOrder()}
                className="h-12 w-12"
                title="Imprimir pedido"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="32"
                  height="32"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="6,9 6,2 18,2 18,9" />
                  <path d="M6,18H4a2,2,0,0,1-2-2V11a2,2,0,0,1,2,2H20a2,2,0,0,1,2,2v5a2,2,0,0,1-2-2H18" />
                  <rect x="6" y="14" width="12" height="8" />
                </svg>
              </Button>
            </DrawerTitle>
            <DrawerDescription>Detalhes completos do pedido</DrawerDescription>
          </DrawerHeader>

          {!orderDetails ? (
            <div className="flex justify-center items-center py-12">
              <p>Carregando detalhes...</p>
            </div>
          ) : (
            <div className="px-4 pb-6">
              <Tabs
                defaultValue="details"
                value={activeTab}
                onValueChange={setActiveTab}
                className="w-full"
              >
                <TabsList className="w-full grid grid-cols-5">
                  <TabsTrigger
                    value="details"
                    className="flex items-center gap-1"
                  >
                    <Package className="w-4 h-4" />
                    <span>Detalhes</span>
                  </TabsTrigger>
                  <TabsTrigger
                    value="documents"
                    className="flex items-center gap-1"
                    disabled={(() => {
                      // 1. Se o pedido for cancelado ou suspenso, bloquear acesso à aba documentos
                      if (orderDetails.quantidade === 0 || orderDetails.status === "Cancelado" || orderDetails.status === "Suspenso") {
                        return true;
                      }

                      // 2. Verificar se é pedido urgente e não foi aprovado
                      const deliveryDate = new Date(orderDetails.deliveryDate);
                      const today = new Date();
                      const daysDiff = Math.ceil((deliveryDate.getTime() - today.getTime()) / (1000 * 3600 * 24));
                      const isUrgent = daysDiff <= 7;

                      // Se é urgente e ainda está "Registrado", bloquear acesso
                      if (isUrgent && orderDetails.status === "Registrado") {
                        return true;
                      }

                      // 3. Verificar se o usuário não é fornecedor e não há documentos carregados
                      if (!canUploadDocuments() && !documentsLoaded &&
                          orderDetails.status !== "Carregado" &&
                          orderDetails.status !== "Em Rota" &&
                          orderDetails.status !== "Em transporte" &&
                          orderDetails.status !== "Entregue") {
                        return true;
                      }

                      return false;
                    })()}
                  >
                    <FileText className="w-4 h-4" />
                    <span>Documentos</span>
                  </TabsTrigger>
                  <TabsTrigger
                    value="confirm"
                    className="flex items-center gap-1"
                    disabled={(() => {
                      // 1. Se o pedido for cancelado, bloquear TODAS as abas exceto detalhes
                      if (orderDetails.quantidade === 0) {
                        return true;
                      }

                      // 2. Verificar se o usuário tem permissão can_confirm_delivery
                      if (!user?.canConfirmDelivery) {
                        return true;
                      }

                      // 3. Se o pedido já foi entregue, não bloquear (permitir visualizar)
                      if (orderDetails.status === "Entregue") {
                        return false;
                      }

                      // 4. Se o pedido não estiver "Em Rota", bloquear
                      if (orderDetails.status !== "Em Rota") {
                        return true;
                      }

                      return false;
                    })()}
                  >
                    <CheckCircle className="w-4 h-4" />
                    <span>{orderDetails.status === "Entregue" ? "Entregue" : "Confirmar"}</span>
                  </TabsTrigger>
                  <TabsTrigger
                    value="tracking"
                    className="flex items-center gap-1"
                    disabled={(() => {
                      // 1. Se o pedido for cancelado, bloquear TODAS as abas exceto detalhes
                      if (orderDetails.quantidade === 0) {
                        return true;
                      }

                      return false;
                    })()}
                  >
                    <MapPin className="w-4 h-4" />
                    <span>Rastreamento</span>
                  </TabsTrigger>
                  <TabsTrigger
                    value="history"
                    className="flex items-center gap-1"
                    disabled={(() => {
                      // 1. Se o pedido for cancelado, bloquear TODAS as abas exceto detalhes
                      if (orderDetails.quantidade === 0) {
                        return true;
                      }

                      return false;
                    })()}
                  >
                    <History className="w-4 h-4" />
                    <span>Histórico</span>
                  </TabsTrigger>
                </TabsList>

                {/* Aba de Detalhes */}
                <TabsContent value="details" className="space-y-4 py-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Coluna 1 - Informações do Produto */}
                    <div className="md:col-span-2 space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <h4 className="text-sm font-medium text-muted-foreground">
                            Produto
                          </h4>
                          <p className="text-base font-medium">
                            {formatProductWithUnit(orderDetails)}
                          </p>
                        </div>

                        <div className="space-y-2">
                          <h4 className="text-sm font-medium text-muted-foreground">
                            Destino
                          </h4>
                          <p className="text-base font-medium flex items-center gap-2">
                            {(orderDetails as any)?.workDestination?.name || "Obra não especificada"}
                            <a
                              href={getGoogleMapsLink((orderDetails as any)?.workDestination?.name || "Obra não especificada")}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-500 hover:text-blue-700"
                            >
                              <ExternalLink size={14} />
                            </a>
                          </p>
                        </div>

                        <div className="space-y-2">
                          <h4 className="text-sm font-medium text-muted-foreground">
                            Fornecedor
                          </h4>
                          <p className="text-base font-medium">
                            {orderDetails.supplier?.name || "N/A"}
                          </p>
                        </div>

                        <div className="space-y-2">
                          <h4 className="text-sm font-medium text-muted-foreground">
                            Data de Entrega
                          </h4>
                          <div className="flex items-center gap-2">
                            <p className="text-base font-medium">
                              {orderDetails.status === "Suspenso" ? (
                                <span className="text-orange-600">
                                  Reprogramação solicitada
                                </span>
                              ) : (
                                formatDate(orderDetails.deliveryDate.toString())
                              )}
                            </p>
                            {canRequestReschedule() && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setIsReprogramDialogOpen(true)}
                                className="h-8 w-8 p-0"
                                title="Reprogramar entrega"
                              >
                                <CalendarIcon className="h-4 w-4" />
                              </Button>
                            )}
                            {(() => {
                              // Verificar se pode cancelar o pedido
                              const canCancel =
                                orderDetails.status !== "Cancelado" &&
                                orderDetails.status !== "Entregue" &&
                                orderDetails.quantidade !== 0;

                              // Verificar se já tem documentos (bloqueia cancelamento)
                              const hasDocuments = documentsLoaded ||
                                orderDetails.status === "Carregado" ||
                                orderDetails.status === "Em Rota" ||
                                orderDetails.status === "Em transporte";

                              // Se já tem documentos, não pode cancelar
                              if (hasDocuments) {
                                return null;
                              }

                              // Verificar antecedência mínima de 3 dias
                              const deliveryDate = new Date(orderDetails.deliveryDate);
                              deliveryDate.setHours(0, 0, 0, 0);

                              const today = new Date();
                              today.setHours(0, 0, 0, 0);

                              const diffTime = deliveryDate.getTime() - today.getTime();
                              // Usar Math.floor para contar apenas dias completos
                              const diffDays = Math.floor(diffTime / (1000 * 3600 * 24));

                              console.log('🔍 Validação de cancelamento:', {
                                orderId: orderDetails.orderId,
                                deliveryDate: deliveryDate.toISOString(),
                                today: today.toISOString(),
                                diffDays,
                                canCancel,
                                hasDocuments
                              });

                              // Permitir cancelar se tiver 3 ou mais dias COMPLETOS de antecedência
                              if (canCancel && diffDays >= 3) {
                                return (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setIsCancelDialogOpen(true)}
                                    className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                                    title={`Cancelar pedido (${diffDays} dias de antecedência)`}
                                  >
                                    <XCircle className="h-4 w-4" />
                                  </Button>
                                );
                              }
                              return null;
                            })()}
                          </div>
                          {orderDetails.status === "Suspenso" && (
                            <p className="text-xs text-muted-foreground">
                              Aguardando aprovação do fornecedor
                            </p>
                          )}
                        </div>

                        <div className="space-y-2">
                          <h4 className="text-sm font-medium text-muted-foreground">
                            Nº da Ordem de Compra
                          </h4>
                          <p className="text-base font-medium">
                            {orderDetails.purchaseOrder?.orderNumber ||
                              "Sem ordem de compra vinculada"}
                          </p>
                        </div>

                        <div className="space-y-2">
                          <h4 className="text-sm font-medium text-muted-foreground">
                            Data de Criação
                          </h4>
                          <p className="text-base font-medium">
                            {orderDetails.createdAt
                              ? formatDate(orderDetails.createdAt.toString())
                              : "N/A"}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Coluna 2 - QR Code e Ações */}
                    <div className="flex flex-col justify-between items-center">
                      {(() => {
                        // Verificar se o pedido foi cancelado
                        if (orderDetails.quantidade === 0 || orderDetails.status === "Cancelado") {
                          return (
                            <div className="flex flex-col items-center justify-center p-6 border border-red-200 rounded-lg bg-red-50 w-full">
                              <AlertCircle className="h-12 w-12 text-red-600 mb-2" />
                              <h3 className="text-lg font-medium text-red-800 text-center">
                                Pedido Cancelado
                              </h3>
                              <p className="text-sm text-red-700 text-center mt-2">
                                Este pedido foi cancelado e não pode ser processado.
                              </p>
                            </div>
                          );
                        }

                        // Verificar se é pedido urgente e não foi aprovado
                        const deliveryDate = new Date(orderDetails.deliveryDate);
                        const today = new Date();
                        const daysDiff = Math.ceil((deliveryDate.getTime() - today.getTime()) / (1000 * 3600 * 24));
                        const isUrgent = daysDiff <= 7;

                        if (isUrgent && orderDetails.status === "Registrado") {
                          return (
                            <div className="flex flex-col items-center justify-center p-6 border border-yellow-200 rounded-lg bg-yellow-50 w-full">
                              <AlertCircle className="h-12 w-12 text-yellow-600 mb-2" />
                              <h3 className="text-lg font-medium text-yellow-800 text-center">
                                Pedido Urgente
                              </h3>
                              <p className="text-sm text-yellow-700 text-center mt-2">
                                Aguardando aprovação para liberação
                              </p>
                            </div>
                          );
                        }

                        return (
                          <QRCodeComponent
                            value={orderDetails.orderId}
                            size={150}
                            className="mt-4"
                          />
                        );
                      })()}

                      {/* Botão de Cancelamento (somente se permitido) */}
                      {(() => {
                        const canCancel =
                          orderDetails.status !== "Cancelado" &&
                          orderDetails.status !== "Entregue" &&
                          orderDetails.quantidade !== 0;

                        // Verificar se já tem documentos
                        const hasDocuments = documentsLoaded || orderDetails.status === "Carregado";

                        // Se já tem documentos, não pode cancelar
                        if (hasDocuments) {
                          return null;
                        }

                        // Verificar antecedência (pelo menos 3 dias)
                        const deliveryDate = new Date(orderDetails.deliveryDate);
                        deliveryDate.setHours(0, 0, 0, 0);

                        const now = new Date();
                        now.setHours(0, 0, 0, 0);

                        const diffTime = deliveryDate.getTime() - now.getTime();
                        // Usar Math.floor para contar apenas dias completos
                        const diffDays = Math.floor(diffTime / (1000 * 3600 * 24));

                        // Permitir cancelar se tiver 3 ou mais dias COMPLETOS de antecedência
                        if (canCancel && diffDays >= 3) {
                          return (
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => setIsCancelDialogOpen(true)}
                              className="mt-6 w-full"
                            >
                              <XCircle className="h-4 w-4 mr-2" />
                              Cancelar Pedido ({diffDays} dias de antecedência)
                            </Button>
                          );
                        }
                        return null;
                      })()}
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
                            // Mapear os status possíveis para suas posições na linha do tempo
                            const statusHierarchy: { [key: string]: number } = {
                              Registrado: 0,
                              Carregado: 1,
                              "Em Rota": 2,
                              "Em transporte": 2, // Mesmo nível que Em Rota
                              Entregue: 3,
                              Recusado: -1, // Status especial
                            };

                            const stepHierarchy: { [key: string]: number } = {
                              Registrado: 0,
                              Carregado: 1,
                              "Em Rota": 2,
                              Entregue: 3,
                            };

                            const currentLevel =
                              statusHierarchy[currentStatus] ?? 0;
                            const stepLevel = stepHierarchy[stepKey] ?? 0;

                            // Se o pedido foi recusado, mostrar apenas o primeiro step como completed
                            if (currentStatus === "Recusado") {
                              return stepKey === "Registrado"
                                ? "completed"
                                : "pending";
                            }

                            // Lógica normal para outros status
                            if (currentLevel > stepLevel) {
                              return "completed";
                            } else if (currentLevel === stepLevel) {
                              // Se o status atual é "Entregue" e o step é "Entregue", mostrar como completed
                              if (
                                currentStatus === "Entregue" &&
                                stepKey === "Entregue"
                              ) {
                                return "completed";
                              }
                              return "current";
                            } else {
                              return "pending";
                            }
                          };

                          const steps = [
                            {
                              key: "Registrado",
                              label: "Registrado",
                              description: "Pedido criado",
                            },
                            {
                              key: "Carregado",
                              label: "Carregado",
                              description: "Documentos enviados",
                            },
                            {
                              key: "Em Rota",
                              label: "Em Rota",
                              description: "A caminho do destino",
                            },
                            {
                              key: "Entregue",
                              label: "Entregue",
                              description: "Pedido finalizado",
                            },
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
                                    const statusProgress: {
                                      [key: string]: number;
                                    } = {
                                      Registrado: 0,
                                      Carregado: 33.33,
                                      "Em Rota": 66.66,
                                      "Em transporte": 66.66, // Mesmo que Em Rota
                                      Entregue: 100,
                                      Recusado: 0,
                                    };
                                    return statusProgress[currentStatus] || 0;
                                  })()}%`,
                                }}
                              ></div>

                              {/* Container horizontal dos steps */}
                              <div className="flex justify-between items-start relative">
                                {steps.map((step, index) => {
                                  const stepStatus = getStepStatus(step.key);

                                  return (
                                    <div
                                      key={step.key}
                                      className="flex flex-col items-center text-center flex-1"
                                    >
                                      <div
                                        className={`flex h-8 w-8 items-center justify-center rounded-full relative z-10 transition-all duration-300 ${
                                          stepStatus === "completed"
                                            ? "bg-primary text-primary-foreground"
                                            : stepStatus === "current"
                                              ? "bg-primary/20 text-primary border-2 border-primary"
                                              : "bg-muted text-muted-foreground"
                                        }`}
                                      >
                                        {stepStatus === "completed" ? (
                                          <CheckCircle className="w-4 h-4" />
                                        ) : stepStatus === "current" ? (
                                          <Clock className="w-4 h-4" />
                                        ) : (
                                          <Clock className="w-4 h-4" />
                                        )}
                                      </div>
                                      <div className="mt-2">
                                        <p
                                          className={`text-sm font-medium ${
                                            stepStatus === "completed" ||
                                            stepStatus === "current"
                                              ? "text-foreground"
                                              : "text-muted-foreground"
                                          }`}
                                        >
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
                        {(() => {
                        // 1. Se o pedido for cancelado, informar que não pode prosseguir
                        if (orderDetails.quantidade === 0 || orderDetails.status === "Cancelado") {
                          return "Este pedido foi cancelado e não pode prosseguir com o envio de documentos.";
                        }

                        // 2. Se o pedido estiver suspenso, informar sobre a reprogramação
                        if (orderDetails.status === "Suspenso") {
                          return "Este pedido está suspenso aguardando aprovação de reprogramação de entrega.";
                        }

                        // 3. Verificar se é pedido urgente e não foi aprovado
                        const deliveryDate = new Date(orderDetails.deliveryDate);
                        const today = new Date();
                        const daysDiff = Math.ceil((deliveryDate.getTime() - today.getTime()) / (1000 * 3600 * 24));
                        const isUrgent = daysDiff <= 7;

                        if (isUrgent && orderDetails.status === "Registrado") {
                            return "Este pedido urgente precisa ser aprovado antes de permitir o upload de documentos";
                          }

                          return "Faça upload dos documentos necessários para prosseguir com o pedido";
                        })()}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      {(() => {
                        // 1. Se o pedido for cancelado, mostrar aviso de cancelamento
                        if (orderDetails.quantidade === 0 || orderDetails.status === "Cancelado") {
                          return (
                            <div className="flex flex-col items-center justify-center p-8 border border-red-200 rounded-lg bg-red-50">
                              <AlertCircle className="h-16 w-16 text-red-600 mb-4" />
                              <h3 className="text-xl font-medium text-red-800 mb-2">
                                Pedido Cancelado
                              </h3>
                              <p className="text-sm text-red-700 text-center max-w-md">
                                Este pedido foi cancelado e não pode ser processado.
                              </p>
                            </div>
                          );
                        }

                        // 3. Verificar se é pedido urgente e não foi aprovado
                        const deliveryDate = new Date(orderDetails.deliveryDate);
                        const today = new Date();
                        const daysDiff = Math.ceil((deliveryDate.getTime() - today.getTime()) / (1000 * 3600 * 24));
                        const isUrgent = daysDiff <= 7;

                        // Se é urgente e não aprovado, mostrar aviso de bloqueio
                        if (isUrgent && orderDetails.status === "Registrado") {
                          return (
                            <div className="flex flex-col items-center justify-center p-8 border border-yellow-200 rounded-lg bg-yellow-50">
                              <AlertCircle className="h-16 w-16 text-yellow-600 mb-4" />
                              <h3 className="text-xl font-medium text-yellow-800 mb-2">
                                Pedido Urgente Aguardando Aprovação
                              </h3>
                              <p className="text-sm text-yellow-700 text-center max-w-md">
                                Este pedido possui entrega em {daysDiff} dias e precisa ser aprovado por um responsável antes de permitir o upload de documentos.
                              </p>
                              <p className="text-xs text-yellow-600 text-center mt-3">
                                Apenas KeyUsers e aprovadores de empresas podem liberar pedidos urgentes.
                              </p>
                            </div>
                          );
                        }

                        // Para pedidos não urgentes ou já aprovados, seguir lógica normal
                        return null;
                      })()}

                      {(() => {
                        // 2. Verificar se é pedido urgente e não foi aprovado
                        const deliveryDate = new Date(orderDetails.deliveryDate);
                        const today = new Date();
                        const daysDiff = Math.ceil((deliveryDate.getTime() - today.getTime()) / (1000 * 3600 * 24));
                        const isUrgent = daysDiff <= 7;

                        // Se é urgente e não aprovado, não mostrar o conteúdo normal
                        if (isUrgent && orderDetails.status === "Registrado") {
                          return null;
                        }

                        // Verificar o tipo de confirmação do produto
                        const confirmationType = orderDetails.product?.confirmationType || "nota_fiscal";

                        // Se o tipo é número_pedido e já foi confirmado
                        if (confirmationType === "numero_pedido" && (
                            orderDetails.numeroPedido ||
                            orderDetails.status === "Em Rota" ||
                            orderDetails.status === "Em transporte" ||
                            orderDetails.status === "Entregue"
                        )) {
                          return (
                            <div className="space-y-4">
                              <div className="flex flex-col items-center justify-center p-8 border border-green-200 rounded-lg bg-[#2f2f37]">
                                <FileCheck size={64} className="text-green-500 mb-4" />
                                <h3 className="text-2xl font-bold text-green-800 mb-2">
                                  Número do Pedido Confirmado
                                </h3>
                                <div className="text-center space-y-3">
                                  <div className="p-4 bg-green-50 rounded-lg border border-green-300">
                                    <p className="text-sm text-green-700 font-medium mb-1">
                                      Número do Pedido:
                                    </p>
                                    <p className="text-3xl font-bold text-green-800">
                                      {orderDetails.numero_pedido || orderDetails.numeroPedido || "Não informado"}
                                    </p>
                                  </div>
                                  <p className="text-sm text-green-600 mt-4">
                                    O pedido foi confirmado e está em rota para entrega
                                  </p>
                                </div>
                              </div>
                            </div>
                          );
                        }

                        // Se o tipo é número_pedido e ainda não foi confirmado
                        if (confirmationType === "numero_pedido" && canUploadDocuments()) {
                          return (
                            <div className="space-y-6">
                              <div className="space-y-4">
                                <Label htmlFor="numeroPedido" className="text-sm font-medium">
                                  Número do Pedido (máx. 20 caracteres)
                                </Label>
                                <Input
                                  id="numeroPedido"
                                  type="text"
                                  placeholder="Digite o número do pedido"
                                  value={numeroPedido}
                                  onChange={(e) => setNumeroPedido(e.target.value)}
                                  maxLength={20}
                                  className="bg-input border-border"
                                />
                                <p className="text-xs text-muted-foreground">
                                  {numeroPedido.length}/20 caracteres
                                </p>
                              </div>

                              <Button
                                onClick={handleConfirmNumeroPedido}
                                disabled={!numeroPedido.trim() || numeroPedido.length > 20}
                                className="w-full"
                              >
                                <CheckCircle className="mr-2 h-4 w-4" />
                                Confirmar Número do Pedido
                              </Button>
                            </div>
                          );
                        }

                        // Lógica normal para nota fiscal
                        if (documentsLoaded ||
                            orderDetails.status === "Carregado" ||
                            orderDetails.status === "Em Rota" ||
                            orderDetails.status === "Em transporte" ||
                            orderDetails.status === "Entregue") {
                          return (
                        <div className="space-y-4">
                          <div className="flex flex-col items-center justify-center p-6 border border-green-200 rounded-lg bg-[#2f2f37]">
                            <FileCheck
                              size={48}
                              className="text-green-500 mb-2"
                            />
                            <h3 className="text-lg font-medium text-green-700">
                              Documentos Carregados
                            </h3>
                            <p className="text-sm text-green-600 text-center mt-2">
                              Todos os documentos necessários foram enviados e
                              processados com sucesso.
                            </p>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                            <div className="p-4 border rounded-lg flex flex-col items-center">
                              <button
                                className="w-16 h-16 rounded-full bg-blue-500 hover:bg-blue-600 text-white flex items-center justify-center transition-all hover:scale-105 cursor-pointer mb-3"
                                onClick={async () => {
                                  try {
                                    console.log(`📥 Iniciando download de nota_pdf para pedido ${orderId}`);

                                    const response = await fetch(`/api/pedidos/${orderId}/documentos/nota_pdf`);

                                    if (!response.ok) {
                                      throw new Error(`Erro ao baixar documento: ${response.statusText}`);
                                    }

                                    // Obter o nome do arquivo do cabeçalho Content-Disposition ou usar um padrão
                                    const contentDisposition = response.headers.get('Content-Disposition');
                                    let filename = `nota_pdf_${orderDetails?.orderId || orderId}.pdf`;

                                    if (contentDisposition) {
                                      const matches = contentDisposition.match(/filename="(.+)"/);
                                      if (matches && matches[1]) {
                                        filename = matches[1];
                                      }
                                    }

                                    // Converter resposta para blob
                                    const blob = await response.blob();

                                    // Criar URL temporária e baixar
                                    const url = window.URL.createObjectURL(blob);
                                    const link = document.createElement('a');
                                    link.href = url;
                                    link.download = filename;
                                    document.body.appendChild(link);
                                    link.click();

                                    // Limpar
                                    document.body.removeChild(link);
                                    window.URL.revokeObjectURL(url);

                                    toast({
                                      title: "Download concluído",
                                      description: `Arquivo ${filename} baixado com sucesso`,
                                    });

                                  } catch (error) {
                                    console.error(`Erro ao baixar nota_pdf:`, error);
                                    toast({
                                      title: "Erro no download",
                                      description: error instanceof Error ? error.message : "Erro desconhecido",
                                      variant: "destructive",
                                    });
                                  }
                                }}
                                title="Clique para baixar a Nota Fiscal (PDF)"
                              >
                                <FileText size={32} />
                              </button>
                              <p className="font-medium text-center">
                                Nota Fiscal (PDF)
                              </p>
                              <p className="text-xs text-muted-foreground text-center mt-1">
                                Clique no ícone para baixar
                              </p>
                            </div>

                            <div className="p-4 border rounded-lg flex flex-col items-center">
                              <button
                                className="w-16 h-16 rounded-full bg-purple-500 hover:bg-purple-600 text-white flex items-center justify-center transition-all hover:scale-105 cursor-pointer mb-3"
                                onClick={async () => {
                                  try {
                                    console.log(`📥 Iniciando download de nota_xml para pedido ${orderId}`);

                                    const response = await fetch(`/api/pedidos/${orderId}/documentos/nota_xml`);

                                    if (!response.ok) {
                                      throw new Error(`Erro ao baixar documento: ${response.statusText}`);
                                    }

                                    // Obter o nome do arquivo do cabeçalho Content-Disposition ou usar um padrão
                                    const contentDisposition = response.headers.get('Content-Disposition');
                                    let filename = `nota_xml_${orderDetails?.orderId || orderId}.xml`;

                                    if (contentDisposition) {
                                      const matches = contentDisposition.match(/filename="(.+)"/);
                                      if (matches && matches[1]) {
                                        filename = matches[1];
                                      }
                                    }

                                    // Converter resposta para blob
                                    const blob = await response.blob();

                                    // Criar URL temporária e baixar
                                    const url = window.URL.createObjectURL(blob);
                                    const link = document.createElement('a');
                                    link.href = url;
                                    link.download = filename;
                                    document.body.appendChild(link);
                                    link.click();

                                    // Limpar
                                    document.body.removeChild(link);
                                    window.URL.revokeObjectURL(url);

                                    toast({
                                      title: "Download concluído",
                                      description: `Arquivo ${filename} baixado com sucesso`,
                                    });

                                  } catch (error) {
                                    console.error(`Erro ao baixar nota_xml:`, error);
                                    toast({
                                      title: "Erro no download",
                                      description: error instanceof Error ? error.message : "Erro desconhecido",
                                      variant: "destructive",
                                    });
                                  }
                                }}
                                title="Clique para baixar a Nota Fiscal (XML)"
                              >
                                <FileText size={32} />
                              </button>
                              <p className="font-medium text-center">
                                Nota Fiscal (XML)
                              </p>
                              <p className="text-xs text-muted-foreground text-center mt-1">
                                Clique no ícone para baixar
                              </p>
                            </div>

                            <div className="p-4 border rounded-lg flex flex-col items-center">
                              <button
                                className="w-16 h-16 rounded-full bg-yellow-500 hover:bg-yellow-600 text-white flex items-center justify-center transition-all hover:scale-105 cursor-pointer mb-3"
                                onClick={async () => {
                                  try {
                                    console.log(`📥 Iniciando download de certificado_pdf para pedido ${orderId}`);

                                    const response = await fetch(`/api/pedidos/${orderId}/documentos/certificado_pdf`);

                                    if (!response.ok) {
                                      throw new Error(`Erro ao baixar documento: ${response.statusText}`);
                                    }

                                    // Obter o nome do arquivo do cabeçalho Content-Disposition ou usar um padrão
                                    const contentDisposition = response.headers.get('Content-Disposition');
                                    let filename = `certificado_pdf_${orderDetails?.orderId || orderId}.pdf`;

                                    if (contentDisposition) {
                                      const matches = contentDisposition.match(/filename="(.+)"/);
                                      if (matches && matches[1]) {
                                        filename = matches[1];
                                      }
                                    }

                                    // Converter resposta para blob
                                    const blob = await response.blob();

                                    // Criar URL temporária e baixar
                                    const url = window.URL.createObjectURL(blob);
                                    const link = document.createElement('a');
                                    link.href = url;
                                    link.download = filename;
                                    document.body.appendChild(link);
                                    link.click();

                                    // Limpar
                                    document.body.removeChild(link);
                                    window.URL.revokeObjectURL(url);

                                    toast({
                                      title: "Download concluído",
                                      description: `Arquivo ${filename} baixado com sucesso`,
                                    });

                                  } catch (error) {
                                    console.error(`Erro ao baixar certificado_pdf:`, error);
                                    toast({
                                      title: "Erro no download",
                                      description: error instanceof Error ? error.message : "Erro desconhecido",
                                      variant: "destructive",
                                    });
                                  }
                                }}
                                title="Clique para baixar o Certificado (PDF)"
                              >
                                <FileText size={32} />
                              </button>
                              <p className="font-medium text-center">
                                Certificado (PDF)
                              </p>
                              <p className="text-xs text-muted-foreground text-center mt-1">
                                Clique no ícone para baixar
                              </p>
                            </div>
                          </div>
                        </div>
                          );
                        } else {
                          return canUploadDocuments() ? (
                            <div className="space-y-6">
                          <div className="space-y-4">
                            <div className="flex items-center space-x-3">
                              <button
                                className={`w-12 h-12 rounded-full flex items-center justify-center transition-all hover:scale-105 cursor-pointer ${notaPdf ? "bg-green-500 text-white hover:bg-green-600" : "bg-gray-200 text-gray-500 hover:bg-gray-300"}`}
                                onClick={() => {
                                  console.log("Clique no ícone PDF");
                                  if (notaPdfRef.current) {
                                    notaPdfRef.current.value = "";
                                    notaPdfRef.current.click();
                                  }
                                }}
                                title={
                                  notaPdf
                                    ? "Alterar arquivo PDF"
                                    : "Selecionar arquivo PDF"
                                }
                              >
                                {notaPdf ? (
                                  <CheckCircle className="w-4 h-4" />
                                ) : (
                                  <Upload className="w-5 h-5" />
                                )}
                              </button>
                              <div className="flex-1">
                                <label className="text-sm font-medium">
                                  Nota Fiscal (PDF)
                                </label>
                                <p className="text-xs text-muted-foreground">
                                  {notaPdf
                                    ? `${notaPdf.name} (${Math.round(notaPdf.size / 1024)} KB)`
                                    : "Clique no ícone para selecionar o arquivo PDF da nota fiscal"}
                                </p>
                              </div>
                              <input
                                key={`nota-pdf-${orderId}`}
                                type="file"
                                ref={notaPdfRef}
                                accept=".pdf"
                                className="hidden"
                                onChange={(e) =>
                                  handleFileChange(e, setNotaPdf)
                                }
                              />
                            </div>
                          </div>

                          <div className="space-y-4">
                            <div className="flex items-center space-x-3">
                              <button
                                className={`w-12 h-12 rounded-full flex items-center justify-center transition-all hover:scale-105 cursor-pointer ${notaXml ? "bg-green-500 text-white hover:bg-green-600" : "bg-gray-200 text-gray-500 hover:bg-gray-300"}`}
                                onClick={() => {
                                  console.log("Clique no ícone XML");
                                  if (notaXmlRef.current) {
                                    notaXmlRef.current.value = "";
                                    notaXmlRef.current.click();
                                  }
                                }}
                                title={
                                  notaXml
                                    ? "Alterar arquivo XML"
                                    : "Selecionar arquivo XML"
                                }
                              >
                                {notaXml ? (
                                  <CheckCircle className="w-4 h-4" />
                                ) : (
                                  <Upload className="w-5 h-5" />
                                )}
                              </button>
                              <div className="flex-1">
                                <label className="text-sm font-medium">
                                  Nota Fiscal (XML)
                                </label>
                                <p className="text-xs text-muted-foreground">
                                  {notaXml
                                    ? `${notaXml.name} (${Math.round(notaXml.size / 1024)} KB)`
                                    : "Clique no ícone para selecionar o arquivo XML da nota fiscal"}
                                </p>
                              </div>
                              <input
                                key={`nota-xml-${orderId}`}
                                type="file"
                                ref={notaXmlRef}
                                accept=".xml"
                                className="hidden"
                                onChange={(e) =>
                                  handleFileChange(e, setNotaXml)
                                }
                              />
                            </div>
                          </div>

                          <div className="space-y-4">
                            <div className="flex items-center space-x-3">
                              <button
                                className={`w-12 h-12 rounded-full flex items-center justify-center transition-all hover:scale-105 cursor-pointer ${certificadoPdf ? "bg-green-500 text-white hover:bg-green-600" : "bg-gray-200 text-gray-500 hover:bg-gray-300"}`}
                                onClick={() => {
                                  console.log("Clique no ícone Certificado");
                                  if (certificadoPdfRef.current) {
                                    certificadoPdfRef.current.value = "";
                                    certificadoPdfRef.current.click();
                                  }
                                }}
                                title={
                                  certificadoPdf
                                    ? "Alterar arquivo Certificado"
                                    : "Selecionar arquivo Certificado"
                                }
                              >
                                {certificadoPdf ? (
                                  <CheckCircle className="w-4 h-4" />
                                ) : (
                                  <Upload className="w-5 h-5" />
                                )}
                              </button>
                              <div className="flex-1">
                                <label className="text-sm font-medium">
                                  Certificado (PDF)
                                </label>
                                <p className="text-xs text-muted-foreground">
                                  {certificadoPdf
                                    ? `${certificadoPdf.name} (${Math.round(certificadoPdf.size / 1024)} KB)`
                                    : "Clique no ícone para selecionar o arquivo PDF do certificado"}
                                </p>
                              </div>
                              <input
                                key={`certificado-pdf-${orderId}`}
                                type="file"
                                ref={certificadoPdfRef}
                                accept=".pdf"
                                className="hidden"
                                onChange={(e) =>
                                  handleFileChange(e, setCertificadoPdf)
                                }
                              />
                            </div>
                          </div>

                          <Button
                            onClick={handleUploadDocuments}
                            disabled={
                              documentUploadMutation.isPending ||
                              !notaPdf ||
                              !notaXml ||
                              !certificadoPdf
                            }
                            className="w-full"
                          >
                            {documentUploadMutation.isPending ? (
                              <>
                                <svg
                                  className="mr-2 h-4 w-4 animate-spin"
                                  viewBox="0 0 24 24"
                                >
                                  <circle
                                    className="opacity-25"
                                    cx="12"
                                    cy="12"
                                    r="10"
                                    stroke="currentColor"
                                    strokeWidth="4"
                                  />
                                  <path
                                    className="opacity-75"
                                    fill="currentColor"
                                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                                  />
                                </svg>
                                Enviando documentos...
                              </>
                            ) : (
                              <>
                                <Upload className="mr-2 h-4 w-4" />
                                Enviar Documentos
                              </>
                            )}
                          </Button>
                        </div>
                          ) : (
                            <div className="flex flex-col items-center justify-center p-8 border border-gray-200 rounded-lg bg-gray-50">
                              <FileText className="h-16 w-16 text-gray-400 mb-4" />
                              <h3 className="text-xl font-medium text-gray-600 mb-2">
                                Aguardando Documentos
                              </h3>
                              <p className="text-sm text-gray-500 text-center max-w-md">
                                Os documentos serão carregados pela empresa fornecedora ({orderDetails.supplier?.name || "não identificada"}).
                              </p>
                            </div>
                          );
                        }
                      })()}
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* Aba de Confirmação de Entrega */}
                <TabsContent value="confirm" className="py-4">
                  <Card>
                    <CardHeader>
                      <CardTitle>
                        {orderDetails.status === "Entregue" ? "Entrega Confirmada" : "Confirmar Entrega"}
                      </CardTitle>
                      <CardDescription>
                        {orderDetails.status === "Entregue"
                          ? "A entrega deste pedido já foi confirmada"
                          : "Confirme a entrega do pedido informando a quantidade recebida"
                        }
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {orderDetails.status === "Entregue" ? (
                        // Mostrar informações da entrega confirmada
                        <div className="space-y-4">
                          <div className="flex items-center justify-center p-6 border border-green-200 rounded-lg bg-[#2f2f37]">
                            <div className="text-center">
                              <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
                              <h3 className="text-xl font-medium text-green-700 mb-2">
                                Entrega Confirmada
                              </h3>
                              <p className="text-sm text-green-600">
                                Quantidade recebida: {orderDetails.quantidadeRecebida || orderDetails.quantity} {orderDetails.unit?.abbreviation || ""}
                              </p>
                            </div>
                          </div>

                          {/* Botão para download da foto da nota assinada */}
                          <div className="space-y-2">
                            <label className="text-sm font-medium flex items-center gap-2">
                              <Camera className="w-4 h-4" />
                              Foto da Nota Fiscal Assinada
                            </label>
                            <Button
                              variant="outline"
                              onClick={async () => {
                                try {
                                  const response = await fetch(`/api/pedidos/${orderDetails.id}/foto-confirmacao`);
                                  if (!response.ok) {
                                    throw new Error('Erro ao baixar foto');
                                  }

                                  const blob = await response.blob();
                                  const url = window.URL.createObjectURL(blob);
                                  const a = document.createElement('a');
                                  a.style.display = 'none';
                                  a.href = url;
                                  a.download = `foto-confirmacao-${orderDetails.orderId}.jpg`;
                                  document.body.appendChild(a);
                                  a.click();
                                  window.URL.revokeObjectURL(url);
                                  document.body.removeChild(a);

                                  toast({
                                    title: "Download Concluído",
                                    description: "Foto baixada com sucesso",
                                  });
                                } catch (error) {
                                  toast({
                                    title: "Erro no Download",
                                    description: error instanceof Error ? error.message : "Erro ao baixar foto",
                                    variant: "destructive",
                                  });
                                }
                              }}
                              className="w-full"
                            >
                              <Download className="mr-2 h-4 w-4" />
                              Baixar Foto da Nota Assinada
                            </Button>
                          </div>
                        </div>
                      ) : (
                        // Formulário de confirmação (apenas se não estiver entregue)
                        <>
                          <div className="space-y-2">
                            <label className="text-sm font-medium">
                              Quantidade Recebida
                            </label>
                            <Input
                              type="number"
                              placeholder="Digite a quantidade recebida"
                              value={confirmedQuantity}
                              onChange={(e) => setConfirmedQuantity(e.target.value)}
                              min="0"
                              step="0.01"
                            />
                          </div>

                          <div className="space-y-2">
                            <label className="text-sm font-medium flex items-center gap-2">
                              <Camera className="w-4 h-4" />
                              Foto da Nota Fiscal Assinada
                            </label>
                            <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-6">
                              <div className="flex flex-col items-center gap-4">
                                <div className="flex flex-col items-center gap-2">
                                  <button
                                    className={`w-12 h-12 rounded-full flex items-center justify-center transition-all hover:scale-105 cursor-pointer ${fotoNotaAssinada ? "bg-green-500 text-white hover:bg-green-600" : "bg-gray-200 text-gray-500 hover:bg-gray-300"}`}
                                    onClick={() => {
                                      if (fotoNotaAssinadaRef.current) {
                                        fotoNotaAssinadaRef.current.value = "";
                                        fotoNotaAssinadaRef.current.click();
                                      }
                                    }}
                                    title={
                                      fotoNotaAssinada
                                        ? "Alterar foto"
                                        : "Clique no ícone para tirar uma foto da nota fiscal assinada"
                                    }
                                  >
                                    {fotoNotaAssinada ? (
                                      <CheckCircle className="w-4 h-4" />
                                    ) : (
                                      <Camera className="w-4 h-4" />
                                    )}
                                  </button>
                                  <input
                                    ref={fotoNotaAssinadaRef}
                                    type="file"
                                    accept="image/*"
                                    onChange={(e) => handleFotoChange(e, setFotoNotaAssinada)}
                                    className="hidden"
                                  />
                                </div>
                                <p className="text-xs text-muted-foreground text-center max-w-xs">
                                  {fotoNotaAssinada
                                    ? `Foto selecionada: ${fotoNotaAssinada.name}`
                                    : "Clique no ícone para tirar uma foto da nota fiscal assinada"}
                                </p>
                              </div>
                            </div>
                          </div>

                          <div className="flex gap-2 pt-4">
                            <Button
                              variant="outline"
                              onClick={() => handleConfirmDelivery("rejeitado")}
                              className="flex-1"
                            >
                              <X className="mr-2 h-4 w-4" />
                              Rejeitar Entrega
                            </Button>
                            <Button
                              onClick={() => handleConfirmDelivery("aprovado")}
                              className="flex-1"
                              disabled={
                                !confirmedQuantity ||
                                !fotoNotaAssinada ||
                                parseFloat(confirmedQuantity) <= 0
                              }
                            >
                              <CheckCircle className="mr-2 h-4 w-4" />
                              Confirmar Entrega
                            </Button>
                          </div>
                        </>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* Aba de Rastreamento */}
                <TabsContent value="tracking" className="py-4">
                  <Card>
                    <CardHeader>
                      <CardTitle>Rastreamento do Pedido</CardTitle>
                      <CardDescription>
                        Acompanhe o status e a localização do seu pedido em tempo real
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <SimpleTracker orderId={orderId} orderDetails={orderDetails} />
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* Aba de Histórico */}
                <TabsContent value="history" className="py-4">
                  <Card>
                    <CardHeader>
                      <CardTitle>Histórico do Pedido</CardTitle>
                      <CardDescription>
                        Veja o histórico de atualizações e interações do pedido
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {(() => {
                          // Criar histórico baseado nos dados disponíveis
                          const history = [];

                          if (orderDetails) {
                            // 1. Criação do pedido
                            history.push({
                              etapa: "Pedido Criado",
                              data: orderDetails.createdAt || new Date().toISOString(),
                              usuario: getUserNameById(orderDetails.userId) || "Sistema",
                              descricao: `Pedido ${orderDetails.orderId} criado para ${formatProductWithUnit(orderDetails)}`,
                              icon: "Package"
                            });

                            // 2. Se há documentos carregados
                            if (orderDetails.status === "Carregado" ||
                                orderDetails.status === "Em Rota" ||
                                orderDetails.status === "Em transporte" ||
                                orderDetails.status === "Entregue") {
                              const fornecedorName = orderDetails.supplier?.name || "Fornecedor";
                              history.push({
                                etapa: "Documentos Carregados",
                                data: orderDetails.updatedAt || orderDetails.createdAt || new Date().toISOString(),
                                usuario: fornecedorName,
                                descricao: "Nota fiscal PDF, XML e certificado enviados",
                                icon: "FileText"
                              });
                            }

                            // 3. Se está em rota
                            if (orderDetails.status === "Em Rota" ||
                                orderDetails.status === "Em transporte" ||
                                orderDetails.status === "Entregue") {
                              history.push({
                                etapa: "Em Rota",
                                data: orderDetails.updatedAt || orderDetails.createdAt || new Date().toISOString(),
                                usuario: "Sistema",
                                descricao: "Pedido saiu para entrega",
                                icon: "Truck"
                              });
                            }

                            // 4. Se foi entregue
                            if (orderDetails.status === "Entregue") {
                              history.push({
                                etapa: "Entrega Confirmada",
                                data: orderDetails.updatedAt || orderDetails.createdAt || new Date().toISOString(),
                                usuario: getUserNameById(user?.id) || "Sistema",
                                descricao: `Entrega confirmada com quantidade: ${orderDetails.quantidadeRecebida || orderDetails.quantity} ${orderDetails.unit?.abbreviation || ""}`,
                                icon: "CheckCircle"
                              });
                            }

                            // 5. Se foi cancelado
                            if (orderDetails.quantidade === 0) {
                              history.push({
                                etapa: "Pedido Cancelado",
                                data: orderDetails.updatedAt || orderDetails.createdAt || new Date().toISOString(),
                                usuario: getUserNameById(user?.id) || "Sistema",
                                descricao: "Pedido cancelado",
                                icon: "XCircle"
                              });
                            }
                          }

                          // Incluir dados do historyData se disponível
                          if (historyData && Array.isArray(historyData)) {
                            historyData.forEach(item => {
                              history.push({
                                etapa: item.action || item.etapa || "Atualização",
                                data: item.created_at || item.data || new Date().toISOString(),
                                usuario: item.user_name || getUserNameById(item.user_id) || item.usuario || "Sistema",
                                descricao: item.description || item.descricao || "",
                                icon: "Edit"
                              });
                            });
                          }

                          // Ordenar por data (mais recente primeiro)
                          history.sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime());

                          return history.length === 0 ? (
                            <div className="text-center py-8">
                              <History className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                              <p className="text-muted-foreground">Nenhum histórico encontrado para este pedido.</p>
                            </div>
                          ) : (
                            <div className="space-y-3">
                              {history.map((item, index) => {
                                const IconComponent = (() => {
                                  switch (item.icon) {
                                    case "Package": return Package;
                                    case "FileText": return FileText;
                                    case "Truck": return Truck;
                                    case "CheckCircle": return CheckCircle;
                                    case "XCircle": return XCircle;
                                    case "Edit": return Edit;
                                    default: return History;
                                  }
                                })();

                                return (
                                  <div key={index} className="flex items-start gap-3 p-4 border rounded-lg bg-muted/20">
                                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary">
                                      <IconComponent className="w-4 h-4" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center justify-between">
                                        <h4 className="font-medium text-sm">{item.etapa}</h4>
                                        <Badge variant="outline" className="text-xs">
                                          {formatDateTimeInCuiaba(item.data)}
                                        </Badge>
                                      </div>
                                      <p className="text-xs text-muted-foreground mt-1">
                                        Por: {item.usuario}
                                      </p>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          );
                        })()}
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            </div>
          )}
        </div>
      </DrawerContent>

      {/* Dialog de Reprogramação */}
      <Dialog open={isReprogramDialogOpen} onOpenChange={setIsReprogramDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reprogramar Entrega</DialogTitle>
            <DialogDescription>
              {(() => {
                const validUntil = orderDetails?.purchaseOrder?.validUntil;
                if (validUntil) {
                  const maxDate = new Date(validUntil);
                  return `Selecione a nova data de entrega (até ${formatDate(maxDate.toString())}, conforme validade da ordem de compra) e informe a justificativa.`;
                }
                return "Selecione a nova data de entrega e informe a justificativa.";
              })()}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Nova Data de Entrega</label>
              <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-start text-left font-normal"
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {selectedDate ? formatDate(selectedDate.toString()) : "Selecione uma data"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={(date) => {
                      setSelectedDate(date);
                      setIsCalendarOpen(false);
                    }}
                    disabled={(date) => {
                      const today = new Date();
                      today.setHours(0, 0, 0, 0);

                      // Desabilitar datas passadas
                      if (date < today) return true;

                      // Se houver ordem de compra com validade, verificar
                      const validUntil = orderDetails?.purchaseOrder?.validUntil;
                      if (validUntil) {
                        const maxDate = new Date(validUntil);
                        maxDate.setHours(23, 59, 59, 999);
                        if (date > maxDate) return true;
                      }

                      return false;
                    }}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Justificativa (máx. 100 caracteres)</label>
              <Textarea
                placeholder="Digite o motivo da reprogramação"
                value={justificativa}
                onChange={(e) => setJustificativa(e.target.value)}
                maxLength={100}
                rows={3}
              />
              <p className="text-xs text-muted-foreground text-right">
                {justificativa.length}/100 caracteres
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsReprogramDialogOpen(false);
                setSelectedDate(undefined);
                setJustificativa("");
              }}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleRequestReschedule}
              disabled={!selectedDate || !justificativa.trim()}
            >
              Solicitar Reprogramação
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de Cancelamento */}
      <Dialog open={isCancelDialogOpen} onOpenChange={setIsCancelDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <XCircle className="h-5 w-5" />
              Cancelar Pedido
            </DialogTitle>
            <DialogDescription>
              Esta ação cancelará permanentemente o pedido {orderDetails?.orderId}.
              Informe o motivo do cancelamento.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-md">
              <p className="text-sm text-yellow-800">
                <strong>Atenção:</strong> Pedidos só podem ser cancelados com pelo menos 3 dias de antecedência
                e antes do upload dos documentos fiscais.
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">
                Justificativa (máx. 200 caracteres)
              </label>
              <Textarea
                placeholder="Digite o motivo do cancelamento do pedido"
                value={cancelJustification}
                onChange={(e) => setCancelJustification(e.target.value)}
                maxLength={200}
                rows={4}
              />
              <p className="text-xs text-muted-foreground text-right">
                {cancelJustification.length}/200 caracteres
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsCancelDialogOpen(false);
                setCancelJustification("");
              }}
            >
              Voltar
            </Button>
            <Button
              variant="destructive"
              onClick={handleCancelOrder}
              disabled={!cancelJustification.trim()}
              className="bg-red-600 hover:bg-red-700"
            >
              <XCircle className="mr-2 h-4 w-4" />
              Cancelar Pedido
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* PDF Viewer Dialog */}
      <Dialog open={isPdfViewerOpen} onOpenChange={setIsPdfViewerOpen}>
        <DialogContent className="max-w-6xl h-[90vh] p-0">
          <DialogHeader className="px-6 py-4 border-b">
            <DialogTitle>{pdfToView?.name || 'Documento PDF'}</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-hidden">
            {pdfToView?.data && (
              <PDFViewer
                fileData={pdfToView.data}
                fileName={pdfToView.name}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </Drawer>
  );
}
</replit_final_file>