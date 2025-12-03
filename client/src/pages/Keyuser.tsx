import { useState, useEffect } from "react";
import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "@/hooks/use-toast";
import { QRCodeComponent } from "@/components/QRCodeComponent";
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
  Edit,
  Trash2,
  Building,
  Users,
  Package,
  Code,
  Shield,
  CheckCircle,
  XCircle,
  ShoppingCart,
  Settings,
  Save,
  RotateCcw,
  Clock,
  MapPin,
  AlertTriangle,
  Box,
  LayoutDashboard,
  FileText,
  BarChart3,
  History,
  Database,
  Key,
  Eye,
  EyeOff,
  Smartphone,
  Upload,
  Trash,
  UserPlus,
  Download,
  TestTube,
  Loader2,
  Truck
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import {
  insertCompanyCategorySchema,
  insertUserRoleSchema,
  insertUnitSchema,
  type CompanyCategory,
  type UserRole,
  type Unit,
  type Setting
} from "@shared/schema";
import { z } from "zod";

// Esquemas para as entidades do sistema
const companyCategoryFormSchema = insertCompanyCategorySchema.extend({
  receivesPurchaseOrders: z.boolean().default(false),
  canEditPurchaseOrders: z.boolean().default(false) // Adicionado para refletir a nova coluna
});

const userRoleFormSchema = insertUserRoleSchema.extend({
  permissions: z.array(z.string()).default([])
});

const unitFormSchema = insertUnitSchema;

// Esquema para configurações
const settingsFormSchema = z.object({
  urgent_days_threshold: z.string().min(1, "Campo obrigatório"),
  google_maps_api_key: z.string().optional(),
  app_name: z.string().min(1, "Campo obrigatório"),
  logo_url: z.string().optional(),
});

// Lista de menus/áreas do sistema para configuração de permissões
const SYSTEM_MENUS = [
  { id: "dashboard", name: "Dashboard", icon: LayoutDashboard },
  { id: "orders", name: "Pedidos", icon: ShoppingCart },
  { id: "approvals", name: "Aprovações", icon: CheckCircle },
  { id: "reprogramacoes", name: "Reprogramações", icon: Clock },
  { id: "purchase_orders", name: "Ordens de Compra", icon: FileText },
  { id: "companies", name: "Empresas", icon: Building },
  { id: "users", name: "Usuários", icon: Users },
  { id: "products", name: "Produtos", icon: Package },
  { id: "reports", name: "Relatórios", icon: BarChart3 },
  { id: "logs", name: "Logs do Sistema", icon: History },
  { id: "keyuser", name: "KeyUser", icon: Code }
];

const AVAILABLE_PERMISSIONS = [
  { value: "view_dashboard", label: "Visualizar Dashboard", icon: LayoutDashboard },
  { value: "view_orders", label: "Visualizar Pedidos", icon: Package },
  { value: "create_orders", label: "Criar Pedidos", icon: Plus },
  { value: "edit_orders", label: "Editar Pedidos", icon: Edit },
  { value: "view_approvals", label: "Visualizar Aprovações", icon: CheckCircle },
  { value: "edit_approvals", label: "Aprovar/Rejeitar Pedidos", icon: CheckCircle },
  { value: "view_reprogramacoes", label: "Visualizar Reprogramações", icon: Clock },
  { value: "edit_reprogramacoes", label: "Gerenciar Reprogramações", icon: Clock },
  { value: "view_purchase_orders", label: "Visualizar Ordens de Compra", icon: FileText },
  { value: "create_purchase_orders", label: "Criar Ordens de Compra", icon: Plus },
  { value: "edit_purchase_orders", label: "Editar Ordens de Compra", icon: Edit },
  { value: "view_companies", label: "Visualizar Empresas", icon: Building },
  { value: "create_companies", label: "Criar Empresas", icon: Plus },
  { value: "edit_companies", label: "Editar Empresas", icon: Edit },
  { value: "delete_companies", label: "Excluir Empresas", icon: Trash },
  { value: "view_users", label: "Visualizar Usuários", icon: Users },
  { value: "create_users", label: "Criar Usuários", icon: UserPlus },
  { value: "edit_users", label: "Editar Usuários", icon: Edit },
  { value: "delete_users", label: "Excluir Usuários", icon: Trash },
  { value: "view_products", label: "Visualizar Produtos", icon: Package },
  { value: "create_products", label: "Criar Produtos", icon: Plus },
  { value: "edit_products", label: "Editar Produtos", icon: Edit },
  { value: "view_logs", label: "Visualizar Logs", icon: FileText },
  { value: "view_keyuser", label: "Acessar Painel KeyUser", icon: Settings },
  { value: "view_settings", label: "Visualizar Configurações", icon: Settings },
  { value: "edit_settings", label: "Editar Configurações", icon: Settings },
  { value: "manage_tracking", label: "Gerenciar Rastreamento", icon: MapPin },
  { value: "confirm_delivery", label: "Confirmar Entrega", icon: Smartphone },
  { value: "upload_documents", label: "Upload de Documentos", icon: Upload },
  { value: "download_documents", label: "Download de Documentos", icon: Download },
  { value: "mobile_access", label: "Acesso Mobile", icon: Smartphone },
  { value: "api_access", label: "Acesso à API", icon: Code }
];

type CompanyCategoryFormData = z.infer<typeof companyCategoryFormSchema>;
type UserRoleFormData = z.infer<typeof userRoleFormSchema>;
type UnitFormData = z.infer<typeof unitFormSchema>;
type SettingsFormData = z.infer<typeof settingsFormSchema>;

export default function Keyuser() {
  // Estados para diálogos das entidades
  const [activeCategoryDialog, setActiveCategoryDialog] = useState(false);
  const [activeRoleDialog, setActiveRoleDialog] = useState(false);
  const [activeUnitDialog, setActiveUnitDialog] = useState(false);
  const [isCategoryDialogOpen, setIsCategoryDialogOpen] = useState(false); // Novo estado para o diálogo de categoria

  // Novos estados para a funcionalidade de Reset Status
  const [resetOrderId, setResetOrderId] = useState("");
  const [isResetting, setIsResetting] = useState(false);

  // Estados para a funcionalidade de Colocar em Rota
  const [routeOrderId, setRouteOrderId] = useState("");
  const [isSettingRoute, setIsSettingRoute] = useState(false);

  // Estados para edição
  const [editingCategory, setEditingCategory] = useState<CompanyCategory | null>(null);
  const [editingRole, setEditingRole] = useState<UserRole | null>(null);
  const [editingUnit, setEditingUnit] = useState<Unit | null>(null);

  // Estados para configurações
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);

  // Estados para iCapMob
  const [uploadingAPK, setUploadingAPK] = useState(false);


  const queryClient = useQueryClient();

  // Queries para entidades
  const { data: categories = [] } = useQuery<CompanyCategory[]>({
    queryKey: ["/api/company-categories"],
  });

  const { data: roles = [] } = useQuery<UserRole[]>({
    queryKey: ["/api/user-roles"],
  });

  const { data: units = [] } = useQuery<Unit[]>({
    queryKey: ["/api/units"],
  });

  // Query para configurações
  const { data: settings = [], isLoading: settingsLoading } = useQuery<Setting[]>({
    queryKey: ["/api/settings"],
  });

  // Mutations para categorias de empresa
  const createCategoryMutation = useMutation({
    mutationFn: async (data: CompanyCategoryFormData) => {
      const categoryWithContract = {
        ...data,
        requiresContract: data.requiresContract === true,
        canEditPurchaseOrders: data.canEditPurchaseOrders === true // Adicionado para refletir a nova coluna
      };
      return apiRequest("POST", "/api/company-categories", categoryWithContract);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/company-categories"] });
      setActiveCategoryDialog(false);
      resetCategoryForm();
      toast({
        title: "Sucesso",
        description: "Categoria de empresa criada com sucesso",
      });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Erro ao criar categoria de empresa",
        variant: "destructive",
      });
    },
  });

  const updateCategoryMutation = useMutation({
    mutationFn: async (data: { id: number; category: CompanyCategoryFormData }) => {
      const categoryWithContract = {
        ...data.category,
        requiresContract: data.category.requiresContract === true,
        canEditPurchaseOrders: data.category.canEditPurchaseOrders === true // Adicionado para refletir a nova coluna
      };
      return apiRequest("PUT", `/api/company-categories/${data.id}`, categoryWithContract);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/company-categories"] });
      setActiveCategoryDialog(false);
      setEditingCategory(null);
      resetCategoryForm();
      toast({
        title: "Sucesso",
        description: "Categoria de empresa atualizada com sucesso",
      });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Erro ao atualizar categoria de empresa",
        variant: "destructive",
      });
    },
  });

  const deleteCategoryMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest("DELETE", `/api/company-categories/${id}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/company-categories"] });
      toast({
        title: "Sucesso",
        description: "Categoria de empresa excluída com sucesso",
      });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Erro ao excluir categoria de empresa",
        variant: "destructive",
      });
    },
  });

  // Mutations para funções de usuário
  const createRoleMutation = useMutation({
    mutationFn: async (data: UserRoleFormData) => {
      return apiRequest("POST", "/api/user-roles", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user-roles"] });
      setActiveRoleDialog(false);
      setEditingRole(null);
      resetRoleForm();
      toast({
        title: "Sucesso",
        description: "Função de usuário criada com sucesso",
      });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Erro ao criar função de usuário",
        variant: "destructive",
      });
    },
  });

  const updateRoleMutation = useMutation({
    mutationFn: async (data: { id: number; role: UserRoleFormData }) => {
      return apiRequest("PUT", `/api/user-roles/${data.id}`, data.role);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user-roles"] });
      setActiveRoleDialog(false);
      setEditingRole(null);
      resetRoleForm();
      toast({
        title: "Sucesso",
        description: "Função de usuário atualizada com sucesso",
      });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Erro ao atualizar função de usuário",
        variant: "destructive",
      });
    },
  });

  const deleteRoleMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest("DELETE", `/api/user-roles/${id}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user-roles"] });
      toast({
        title: "Sucesso",
        description: "Função de usuário excluída com sucesso",
      });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Erro ao excluir função de usuário",
        variant: "destructive",
      });
    },
  });

  // Mutations para unidades
  const createUnitMutation = useMutation({
    mutationFn: async (data: UnitFormData) => {
      return apiRequest("POST", "/api/units", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/units"] });
      setActiveUnitDialog(false);
      setEditingUnit(null);
      resetUnitForm();
      toast({
        title: "Sucesso",
        description: "Unidade criada com sucesso",
      });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Erro ao criar unidade",
        variant: "destructive",
      });
    },
  });

  const updateUnitMutation = useMutation({
    mutationFn: async (data: { id: number; unit: UnitFormData }) => {
      return apiRequest("PUT", `/api/units/${data.id}`, data.unit);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/units"] });
      setActiveUnitDialog(false);
      setEditingUnit(null);
      resetUnitForm();
      toast({
        title: "Sucesso",
        description: "Unidade atualizada com sucesso",
      });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Erro ao atualizar unidade",
        variant: "destructive",
      });
    },
  });

  const deleteUnitMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest("DELETE", `/api/units/${id}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/units"] });
      toast({
        title: "Sucesso",
        description: "Unidade excluída com sucesso",
      });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Erro ao excluir unidade",
        variant: "destructive",
      });
    },
  });

  // Mutation para configurações
  const updateSettingsMutation = useMutation({
    mutationFn: async (data: SettingsFormData) => {
      const settingsArray = Object.entries(data).map(([key, value]) => {
        const existingSetting = settings.find((s) => s.key === key);
        return {
          key,
          value: value || "",
          description: existingSetting?.description || "",
        };
      });
      return apiRequest("PUT", "/api/settings", settingsArray);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
      toast({
        title: "Sucesso",
        description: "Configurações atualizadas com sucesso",
      });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Erro ao atualizar configurações",
        variant: "destructive",
      });
    },
  });

  // Formulários
  const categoryForm = useForm<CompanyCategoryFormData>({
    resolver: zodResolver(companyCategoryFormSchema),
    defaultValues: {
      name: "",
      requiresApprover: false,
      requiresContract: false,
      receivesPurchaseOrders: false,
      canEditPurchaseOrders: false // Adicionado para o formulário
    },
  });

  const roleForm = useForm<UserRoleFormData>({
    resolver: zodResolver(userRoleFormSchema),
    defaultValues: {
      name: "",
      categoryId: 0,
      permissions: [],
    },
  });

  const unitForm = useForm<UnitFormData>({
    resolver: zodResolver(unitFormSchema),
    defaultValues: {
      name: "",
      abbreviation: "",
    },
  });

  // Converter configurações para objeto para o formulário
  const settingsObject = settings.reduce(
    (acc, setting) => {
      acc[setting.key] = setting.value;
      return acc;
    },
    {} as Record<string, string>,
  );

  const settingsForm = useForm<SettingsFormData>({
    resolver: zodResolver(settingsFormSchema),
    values: {
      urgent_days_threshold: settingsObject.urgent_days_threshold || "7",
      google_maps_api_key: settingsObject.google_maps_api_key || "",
      app_name: settingsObject.app_name || "iCap",
      logo_url: settingsObject.logo_url || "",
    },
  });

  // Funções de reset
  const resetCategoryForm = () => {
    categoryForm.reset({
      name: "",
      requiresApprover: false,
      requiresContract: false,
      receivesPurchaseOrders: false,
      canEditPurchaseOrders: false // Resetar novo campo
    });
    setEditingCategory(null);
  };

  const resetRoleForm = () => {
    roleForm.reset({
      name: "",
      categoryId: 0,
      permissions: [],
    });
    setEditingRole(null);
  };

  const resetUnitForm = () => {
    unitForm.reset({
      name: "",
      abbreviation: "",
    });
    setEditingUnit(null);
  };

  // Handlers de submit
  const onCategorySubmit = (data: CompanyCategoryFormData) => {
    if (editingCategory) {
      updateCategoryMutation.mutate({ id: editingCategory.id, category: data });
    } else {
      createCategoryMutation.mutate(data);
    }
  };

  const onRoleSubmit = (data: UserRoleFormData) => {
    if (editingRole) {
      updateRoleMutation.mutate({ id: editingRole.id, role: data });
    } else {
      createRoleMutation.mutate(data);
    }
  };

  const onUnitSubmit = (data: UnitFormData) => {
    if (editingUnit) {
      updateUnitMutation.mutate({ id: editingUnit.id, unit: data });
    } else {
      createUnitMutation.mutate(data);
    }
  };

  const onSettingsSubmit = (data: SettingsFormData) => {
    updateSettingsMutation.mutate(data);
  };

  // Handlers de edição
  const handleEditCategory = (category: CompanyCategory) => {
    setEditingCategory(category);
    categoryForm.reset({
      name: category.name,
      requiresApprover: category.requiresApprover || false,
      requiresContract: category.requiresContract || false,
      receivesPurchaseOrders: category.receivesPurchaseOrders || false,
      canEditPurchaseOrders: category.canEditPurchaseOrders || false // Preencher novo campo
    });
    setActiveCategoryDialog(true); // Manter o diálogo ativo
  };

  const handleDeleteCategory = (id: number) => {
    if (confirm("Tem certeza que deseja excluir esta categoria?")) {
      deleteCategoryMutation.mutate(id);
    }
  };

  const handleEditRole = (role: UserRole) => {
    setEditingRole(role);
    roleForm.reset({
      name: role.name,
      categoryId: role.categoryId,
      permissions: role.permissions || []
    });
    setActiveRoleDialog(true);
  };

  const handleDeleteRole = (id: number) => {
    if (confirm("Tem certeza que deseja excluir esta função?")) {
      deleteRoleMutation.mutate(id);
    }
  };

  const handleEditUnit = (unit: Unit) => {
    setEditingUnit(unit);
    unitForm.reset({
      name: unit.name,
      abbreviation: unit.abbreviation,
    });
    setActiveUnitDialog(true);
  };

  const handleDeleteUnit = (id: number) => {
    if (confirm("Tem certeza que deseja excluir esta unidade?")) {
      deleteUnitMutation.mutate(id);
    }
  };

  const handleSettingsReset = () => {
    settingsForm.reset({
      urgent_days_threshold: "7",
      google_maps_api_key: "",
      app_name: "iCap",
      logo_url: "",
    });
  };

  const handleLogoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploadingLogo(true);

    try {
      const formData = new FormData();
      formData.append("logo", file);

      const response = await fetch("/api/upload/logo", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Erro ao fazer upload do logo");
      }

      queryClient.invalidateQueries({ queryKey: ["/api/settings"] });

      toast({
        title: "Sucesso",
        description: "Logo enviado com sucesso",
      });
    } catch (error) {
      toast({
        title: "Erro",
        description: "Erro ao fazer upload do logo",
        variant: "destructive",
      });
    } finally {
      setIsUploadingLogo(false);
      event.target.value = "";
    }
  };


  // Estados para iCapMob
  const [currentVersion, setCurrentVersion] = useState<{
    version: string;
    date: string;
    hasAPK: boolean;
  } | null>(null);
  const [versionHistory, setVersionHistory] = useState<any[]>([]);

  // Query para informações da versão atual do iCapMob
  const { data: icapMobVersion, refetch: refetchVersion } = useQuery({
    queryKey: ["/api/icapmob/version"],
    refetchOnWindowFocus: false
  });

  // Query para histórico de versões do iCapMob (apenas para KeyUser)
  const { data: icapMobHistory, refetch: refetchHistory } = useQuery({
    queryKey: ["/api/icapmob/history"],
    refetchOnWindowFocus: false
  });

  // Atualizar estados quando os dados chegarem
  React.useEffect(() => {
    if (icapMobVersion?.success) {
      setCurrentVersion({
        version: icapMobVersion.version,
        date: icapMobVersion.date,
        hasAPK: icapMobVersion.hasAPK
      });
    }
  }, [icapMobVersion]);

  React.useEffect(() => {
    if (icapMobHistory?.success) {
      setVersionHistory(icapMobHistory.history || []);
    }
  }, [icapMobHistory]);

  // Função para upload do APK
  const handleUploadAPK = async () => {
    const versionInput = document.getElementById('apk-version') as HTMLInputElement;
    const fileInput = document.getElementById('apk-file') as HTMLInputElement;

    if (!versionInput.value || !fileInput.files?.[0]) {
      toast({
        title: "Erro",
        description: "Por favor, informe a versão e selecione um arquivo APK",
        variant: "destructive",
      });
      return;
    }

    setUploadingAPK(true);

    try {
      const formData = new FormData();
      formData.append('apk', fileInput.files[0]);
      formData.append('version', versionInput.value);

      const response = await fetch('/api/icapmob/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Erro no upload');
      }

      const result = await response.json();

      toast({
        title: "Sucesso",
        description: "APK atualizado com sucesso!",
      });

      // Limpar formulário
      versionInput.value = '';
      fileInput.value = '';

      // Atualizar dados
      refetchVersion();
      refetchHistory();

    } catch (error) {
      console.error('Erro no upload:', error);
      toast({
        title: "Erro",
        description: error instanceof Error ? error.message : "Erro ao fazer upload do APK",
        variant: "destructive",
      });
    } finally {
      setUploadingAPK(false);
    }
  };

  // Função para resetar status do pedido
  const handleResetStatus = async () => {
    if (!resetOrderId.trim()) {
      toast({
        title: "Erro",
        description: "Por favor, informe o número do pedido",
        variant: "destructive",
      });
      return;
    }

    setIsResetting(true);

    try {
      const response = await fetch(`/api/keyuser/reset-order-status`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          orderId: resetOrderId.trim()
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || "Erro ao resetar status");
      }

      toast({
        title: "Sucesso",
        description: result.message || "Status do pedido resetado com sucesso",
      });

      setResetOrderId("");
    } catch (error) {
      console.error("Erro ao resetar status:", error);
      toast({
        title: "Erro",
        description: error instanceof Error ? error.message : "Erro ao resetar status do pedido",
        variant: "destructive",
      });
    } finally {
      setIsResetting(false);
    }
  };

  // Função para colocar pedido em rota
  const handleSetInRoute = async () => {
    if (!routeOrderId.trim()) {
      toast({
        title: "Erro",
        description: "Por favor, informe o número do pedido",
        variant: "destructive",
      });
      return;
    }

    setIsSettingRoute(true);

    try {
      const response = await fetch(`/api/keyuser/set-order-in-route`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          orderId: routeOrderId.trim()
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || "Erro ao colocar pedido em rota");
      }

      toast({
        title: "Sucesso",
        description: result.message || "Pedido colocado em rota com sucesso",
      });

      setRouteOrderId("");
    } catch (error) {
      console.error("Erro ao colocar em rota:", error);
      toast({
        title: "Erro",
        description: error instanceof Error ? error.message : "Erro ao colocar pedido em rota",
        variant: "destructive",
      });
    } finally {
      setIsSettingRoute(false);
    }
  };

  // Função para exportar notas fiscais em arquivo ZIP
  const handleExportNotes = async () => {
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-foreground">Painel Keyuser</h1>
      </div>

      <Tabs defaultValue="categories" className="space-y-6">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="categories" className="flex items-center gap-2">
            <Building className="w-4 h-4" />
            Categorias
          </TabsTrigger>
          <TabsTrigger value="roles" className="flex items-center gap-2">
            <Shield className="w-4 h-4" />
            Funções
          </TabsTrigger>
          <TabsTrigger value="units" className="flex items-center gap-2">
            <Package className="w-4 h-4" />
            Unidades
          </TabsTrigger>
          <TabsTrigger value="settings" className="flex items-center gap-2">
            <Settings className="w-4 h-4" />
            Configurações Gerais
          </TabsTrigger>
          <TabsTrigger value="applications" className="flex items-center gap-2">
            <Key className="w-4 h-4" />
            Aplicações
          </TabsTrigger>
        </TabsList>

        {/* Aba Categorias de Empresa */}
        <TabsContent value="categories" className="space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Building className="w-5 h-5" />
                Categorias de Empresa
              </CardTitle>
              <Dialog open={activeCategoryDialog} onOpenChange={setActiveCategoryDialog}>
                <DialogTrigger asChild>
                  <Button onClick={() => {
                    resetCategoryForm();
                    setActiveCategoryDialog(true);
                  }}>
                    <Plus className="w-4 h-4 mr-2" />
                    Nova Categoria
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>
                      {editingCategory ? "Editar Categoria" : "Nova Categoria de Empresa"}
                    </DialogTitle>
                    <DialogDescription>
                      Configure as propriedades da categoria de empresa.
                    </DialogDescription>
                  </DialogHeader>
                  <Form {...categoryForm}>
                    <form onSubmit={categoryForm.handleSubmit(onCategorySubmit)} className="space-y-4">
                      <FormField
                        control={categoryForm.control}
                        name="name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Nome da Categoria</FormLabel>
                            <FormControl>
                              <Input placeholder="Ex: Fornecedor" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <div className="space-y-3">
                        <FormField
                          control={categoryForm.control}
                          name="requiresApprover"
                          render={({ field }) => (
                            <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                              <FormControl>
                                <Checkbox
                                  checked={field.value || false}
                                  onCheckedChange={field.onChange}
                                />
                              </FormControl>
                              <div className="space-y-1 leading-none">
                                <FormLabel>Requer Aprovador</FormLabel>
                                <FormDescription>
                                  Empresas desta categoria precisam ter um aprovador designado
                                </FormDescription>
                              </div>
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={categoryForm.control}
                          name="requiresContract"
                          render={({ field }) => (
                            <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                              <FormControl>
                                <Checkbox
                                  checked={field.value || false}
                                  onCheckedChange={field.onChange}
                                />
                              </FormControl>
                              <div className="space-y-1 leading-none">
                                <FormLabel>Requer Contrato</FormLabel>
                                <FormDescription>
                                  Empresas desta categoria precisam ter um número de contrato
                                </FormDescription>
                              </div>
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={categoryForm.control}
                          name="receivesPurchaseOrders"
                          render={({ field }) => (
                            <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                              <FormControl>
                                <Checkbox
                                  checked={field.value || false}
                                  onCheckedChange={field.onChange}
                                />
                              </FormControl>
                              <div className="space-y-1 leading-none">
                                <FormLabel>Recebe Ordens de Compra</FormLabel>
                                <FormDescription>
                                  Empresas desta categoria podem receber ordens de compra
                                </FormDescription>
                              </div>
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={categoryForm.control}
                          name="canEditPurchaseOrders"
                          render={({ field }) => (
                            <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                              <FormControl>
                                <Checkbox
                                  checked={field.value || false}
                                  onCheckedChange={field.onChange}
                                />
                              </FormControl>
                              <div className="space-y-1 leading-none">
                                <FormLabel>Edita Ordens de Compra</FormLabel>
                                <FormDescription>
                                  Empresas desta categoria podem editar ordens de compra
                                </FormDescription>
                              </div>
                            </FormItem>
                          )}
                        />
                      </div>

                      <div className="flex justify-end gap-2">
                        <Button type="button" variant="outline" onClick={() => setActiveCategoryDialog(false)}>
                          Cancelar
                        </Button>
                        <Button type="submit">
                          {editingCategory ? "Atualizar" : "Criar"}
                        </Button>
                      </div>
                    </form>
                  </Form>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Aprovador</TableHead>
                    <TableHead>Contrato</TableHead>
                    <TableHead>Ordens de Compra</TableHead>
                    <TableHead>Edita OC</TableHead> {/* Nova coluna */}
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {categories.map((category) => (
                    <TableRow key={category.id}>
                      <TableCell className="font-medium">{category.name}</TableCell>
                      <TableCell>
                        {category.requiresApprover ? (
                          <Badge variant="default">
                            <CheckCircle className="w-3 h-3 mr-1" />
                            Obrigatório
                          </Badge>
                        ) : (
                          <Badge variant="secondary">
                            <XCircle className="w-3 h-3 mr-1" />
                            Opcional
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {category.requiresContract ? (
                          <Badge variant="default">
                            <CheckCircle className="w-3 h-3 mr-1" />
                            Obrigatório
                          </Badge>
                        ) : (
                          <Badge variant="secondary">
                            <XCircle className="w-3 h-3 mr-1" />
                            Opcional
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {category.receivesPurchaseOrders ? (
                          <Badge variant="default">
                            <ShoppingCart className="w-3 h-3 mr-1" />
                            Sim
                          </Badge>
                        ) : (
                          <Badge variant="secondary">
                            <XCircle className="w-3 h-3 mr-1" />
                            Não
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {category.canEditPurchaseOrders ? (
                          <Badge variant="default">
                            <Edit className="w-3 h-3 mr-1" />
                            Sim
                          </Badge>
                        ) : (
                          <Badge variant="secondary">
                            <XCircle className="w-3 h-3 mr-1" />
                            Não
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEditCategory(category)}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteCategory(category.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Aba Funções de Usuário */}
        <TabsContent value="roles" className="space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Shield className="w-5 h-5" />
                Funções de Usuário
              </CardTitle>
              <Dialog open={activeRoleDialog} onOpenChange={setActiveRoleDialog}>
                <DialogTrigger asChild>
                  <Button onClick={() => {
                    resetRoleForm();
                    setActiveRoleDialog(true);
                  }}>
                    <Plus className="w-4 h-4 mr-2" />
                    Nova Função
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>
                      {editingRole ? "Editar Função" : "Nova Função de Usuário"}
                    </DialogTitle>
                    <DialogDescription>
                      Configure as propriedades da função de usuário e suas permissões de acesso.
                    </DialogDescription>
                  </DialogHeader>
                  <Form {...roleForm}>
                    <form onSubmit={roleForm.handleSubmit(onRoleSubmit)} className="space-y-6">
                      <div className="grid grid-cols-1 gap-4">
                        <FormField
                          control={roleForm.control}
                          name="name"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="flex items-center gap-2">
                                <Users className="w-4 h-4" />
                                Nome da Função
                              </FormLabel>
                              <FormControl>
                                <Input placeholder="Ex: Gerente" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={roleForm.control}
                          name="categoryId"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="flex items-center gap-2">
                                <Building className="w-4 h-4" />
                                Categoria
                              </FormLabel>
                              <Select onValueChange={(value) => field.onChange(parseInt(value))}>
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Selecione uma categoria" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  {categories.map((category) => (
                                    <SelectItem key={category.id} value={category.id.toString()}>
                                      {category.name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      {/* Seção de Permissões */}
                      <div className="space-y-3">
                        <FormLabel className="text-base font-medium flex items-center gap-2">
                          <Shield className="w-4 h-4" />
                          Permissões de Acesso
                        </FormLabel>
                        <FormDescription>
                          Selecione quais áreas do sistema esta função pode acessar
                        </FormDescription>

                        {/* Container com rolagem para a lista de permissões */}
                        <div className="border rounded-lg p-3 max-h-64 overflow-y-auto">
                          <div className="space-y-2">
                            {SYSTEM_MENUS.map((menu) => {
                              const permissionKey = `view_${menu.id}`;
                              const isChecked = roleForm.watch("permissions")?.includes(permissionKey) || false;
                              const IconComponent = menu.icon;

                              return (
                                <div key={menu.id} className="flex items-center space-x-3 p-2 hover:bg-gray-100 rounded">
                                  {/* Ícone do menu */}
                                  <IconComponent className="w-4 h-4 text-gray-600" />

                                  {/* Nome do menu */}
                                  <label
                                    htmlFor={`permission-${menu.id}`}
                                    className="flex-1 text-sm font-medium cursor-pointer"
                                  >
                                    {menu.name}
                                  </label>

                                  {/* Checkbox */}
                                  <Checkbox
                                    id={`permission-${menu.id}`}
                                    checked={isChecked}
                                    onCheckedChange={(checked) => {
                                      const currentPermissions = roleForm.getValues("permissions") || [];
                                      let newPermissions;

                                      if (checked) {
                                        newPermissions = [...currentPermissions, permissionKey];
                                      } else {
                                        newPermissions = currentPermissions.filter(p => p !== permissionKey);
                                      }

                                      roleForm.setValue("permissions", newPermissions);
                                    }}
                                  />
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        {/* Botões de seleção rápida */}
                        <div className="flex gap-2 pt-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              const allPermissions = SYSTEM_MENUS.map(menu => `view_${menu.id}`);
                              roleForm.setValue("permissions", allPermissions);
                            }}
                          >
                            Selecionar Todos
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              roleForm.setValue("permissions", []);
                            }}
                          >
                            Limpar Todos
                          </Button>
                        </div>
                      </div>

                      <div className="flex justify-end gap-2 pt-4 border-t">
                        <Button type="button" variant="outline" onClick={() => setActiveRoleDialog(false)}>
                          Cancelar
                        </Button>
                        <Button type="submit">
                          {editingRole ? "Atualizar" : "Criar"}
                        </Button>
                      </div>
                    </form>
                  </Form>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {roles.map((role) => {
                    const category = categories.find(c => c.id === role.categoryId);

                    return (
                      <TableRow key={role.id}>
                        <TableCell className="font-medium">{role.name}</TableCell>
                        <TableCell>
                          {category ? (
                            <Badge variant="outline">{category.name}</Badge>
                          ) : (
                            <span className="text-muted-foreground">Sem categoria</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEditRole(role)}
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteRole(role.id)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Aba Unidades */}
        <TabsContent value="units" className="space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Package className="w-5 h-5" />
                Unidades de Medida
              </CardTitle>
              <Dialog open={activeUnitDialog} onOpenChange={setActiveUnitDialog}>
                <DialogTrigger asChild>
                  <Button onClick={() => {
                    resetUnitForm();
                    setActiveUnitDialog(true);
                  }}>
                    <Plus className="w-4 h-4 mr-2" />
                    Nova Unidade
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>
                      {editingUnit ? "Editar Unidade" : "Nova Unidade de Medida"}
                    </DialogTitle>
                    <DialogDescription>
                      Configure as propriedades da unidade de medida.
                    </DialogDescription>
                  </DialogHeader>
                  <Form {...unitForm}>
                    <form onSubmit={unitForm.handleSubmit(onUnitSubmit)} className="space-y-4">
                      <FormField
                        control={unitForm.control}
                        name="name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Nome da Unidade</FormLabel>
                            <FormControl>
                              <Input placeholder="Ex: Toneladas" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={unitForm.control}
                        name="abbreviation"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Abreviação</FormLabel>
                            <FormControl>
                              <Input placeholder="Ex: ton" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <div className="flex justify-end gap-2">
                        <Button type="button" variant="outline" onClick={() => setActiveUnitDialog(false)}>
                          Cancelar
                        </Button>
                        <Button type="submit">
                          {editingUnit ? "Atualizar" : "Criar"}
                        </Button>
                      </div>
                    </form>
                  </Form>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Abreviação</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {units.map((unit) => (
                    <TableRow key={unit.id}>
                      <TableCell className="font-medium">{unit.name}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{unit.abbreviation}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEditUnit(unit)}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteUnit(unit.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Aba Configurações Gerais */}
        <TabsContent value="settings" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="w-5 h-5" />
                Configurações Gerais
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Form {...settingsForm}>
                <form onSubmit={settingsForm.handleSubmit(onSettingsSubmit)} className="space-y-8">
                  {/* Configurações Gerais */}
                  <div className="space-y-6">
                    <div>
                      <h3 className="text-lg font-medium text-foreground mb-4">
                        Configurações Gerais
                      </h3>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <FormField
                          control={settingsForm.control}
                          name="app_name"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="flex items-center h-5">Nome da Aplicação</FormLabel>
                              <FormControl>
                                <Input
                                  placeholder="iCap"
                                  className="bg-input border-border"
                                  {...field}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={settingsForm.control}
                          name="urgent_days_threshold"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="flex items-center gap-2 h-5">
                                <Clock className="w-4 h-4" />
                                Limite de Urgência (dias)
                              </FormLabel>
                              <FormControl>
                                <Input
                                  type="number"
                                  min="1"
                                  max="30"
                                  placeholder="7"
                                  className="bg-input border-border"
                                  {...field}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    </div>

                    {/* Upload de Logo */}
                    <div className="space-y-4">
                      <h4 className="text-md font-medium text-foreground">Logo da Aplicação</h4>
                      <div className="flex items-center gap-4">
                        <Input
                          type="file"
                          accept="image/*"
                          onChange={handleLogoUpload}
                          disabled={isUploadingLogo}
                          className="bg-input border-border"
                        />
                        {isUploadingLogo && (
                          <div className="text-sm text-muted-foreground">
                            Enviando...
                          </div>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Formatos aceitos: PNG, JPG, SVG. Tamanho recomendado: 140x60px
                      </p>
                    </div>
                  </div>

                  {/* Botões de Ação */}
                  <div className="flex justify-end gap-4 pt-6 border-t border-border">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleSettingsReset}
                      className="flex items-center gap-2"
                    >
                      <RotateCcw className="w-4 h-4" />
                      Restaurar Padrões
                    </Button>
                    <Button
                      type="submit"
                      disabled={updateSettingsMutation.isPending}
                      className="flex items-center gap-2"
                    >
                      <Save className="w-4 h-4" />
                      {updateSettingsMutation.isPending ? "Salvando..." : "Salvar Configurações"}
                    </Button>
                  </div>
                </form>
              </Form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab iCapMob */}
        <TabsContent value="icapmob" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Smartphone className="w-5 h-5" />
                Gestão do iCapMob - Transporte
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Upload de nova versão */}
                <div className="space-y-4">
                  <h3 className="text-lg font-medium">Atualizar Aplicativo</h3>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="apk-version">Versão</Label>
                      <Input
                        id="apk-version"
                        placeholder="Ex: 1.2.0"
                        className="bg-input border-border"
                      />
                    </div>
                    <div>
                      <Label htmlFor="apk-file">Arquivo APK</Label>
                      <Input
                        id="apk-file"
                        type="file"
                        accept=".apk"
                        className="bg-input border-border"
                      />
                    </div>
                    <Button
                      onClick={handleUploadAPK}
                      disabled={uploadingAPK}
                      className="w-full"
                    >
                      {uploadingAPK ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                          Enviando...
                        </>
                      ) : (
                        <>
                          <Upload className="w-4 h-4 mr-2" />
                          Subir Atualização
                        </>
                      )}
                    </Button>
                  </div>
                </div>

                {/* Informações da versão atual */}
                <div className="space-y-4">
                  <h3 className="text-lg font-medium">Versão Atual</h3>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Versão:</span>
                      <span className="font-medium">
                        {currentVersion?.version || "Não disponível"}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Data:</span>
                      <span className="font-medium">
                        {currentVersion?.date
                          ? new Date(currentVersion.date).toLocaleDateString('pt-BR')
                          : "Não disponível"
                        }
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Status:</span>
                      <span className={`font-medium ${currentVersion?.hasAPK ? 'text-green-600' : 'text-red-600'}`}>
                        {currentVersion?.hasAPK ? "APK Disponível" : "APK Não Encontrado"}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">URL:</span>
                      <span className="font-mono text-xs break-all">
                        /icapmob/icapmob.apk
                      </span>
                    </div>
                  </div>

                  {/* QR Code para download */}
                  <div className="mt-4">
                    <h4 className="text-sm font-medium mb-2">QR Code para Download</h4>
                    <div className="flex justify-center">
                      <div className="p-4 bg-white rounded-lg">
                        {currentVersion?.hasAPK ? (
                          <QRCodeComponent
                            value={`${window.location.origin}/icapmob/icapmob.apk`}
                            size={128}
                          />
                        ) : (
                          <div className="w-32 h-32 bg-gray-200 rounded flex items-center justify-center">
                            <span className="text-xs text-gray-500 text-center">
                              APK não<br/>disponível
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Histórico de versões */}
              <div className="space-y-4">
                <h3 className="text-lg font-medium">Histórico de Versões</h3>
                <div className="border rounded-lg">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Versão</TableHead>
                        <TableHead>Data</TableHead>
                        <TableHead>Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {versionHistory.length > 0 ? (
                        versionHistory.map((version, index) => (
                          <TableRow key={version.id}>
                            <TableCell className="font-medium">{version.versao}</TableCell>
                            <TableCell>
                              {new Date(version.data).toLocaleDateString('pt-BR')}
                            </TableCell>
                            <TableCell>
                              {index === 0 ? (
                                <Badge variant="default">Atual</Badge>
                              ) : (
                                <Badge variant="secondary">Anterior</Badge>
                              )}
                            </TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={3} className="text-center text-muted-foreground">
                            Nenhuma versão encontrada
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Nova Aba: Aplicações */}
        <TabsContent value="applications" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Key className="w-5 h-5" />
                Ferramentas de Aplicação
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Reset Status */}
              <div className="space-y-4 p-4 border rounded-lg">
                <h3 className="text-lg font-medium flex items-center gap-2">
                  <RotateCcw className="w-5 h-5" />
                  Resetar Status do Pedido
                </h3>
                <div className="flex items-center gap-4">
                  <div className="flex-1">
                    <Label htmlFor="reset-order-id" className="sr-only">Número do Pedido</Label>
                    <Input
                      id="reset-order-id"
                      placeholder="Digite o número do pedido"
                      value={resetOrderId}
                      onChange={(e) => setResetOrderId(e.target.value)}
                      disabled={isResetting}
                    />
                  </div>
                  <Button onClick={handleResetStatus} disabled={isResetting}>
                    {isResetting ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Resetando...
                      </>
                    ) : (
                      "Resetar Status"
                    )}
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground">
                  Ao resetar, o status do pedido será alterado para "Registrado" e "is_urgent" para "TRUE".
                </p>
              </div>

              {/* Colocar em Rota */}
              <div className="space-y-4 p-4 border rounded-lg">
                <h3 className="text-lg font-medium flex items-center gap-2">
                  <Truck className="w-5 h-5" />
                  Colocar em Rota
                </h3>
                <div className="flex items-center gap-4">
                  <div className="flex-1">
                    <Label htmlFor="route-order-id" className="sr-only">Número do Pedido</Label>
                    <Input
                      id="route-order-id"
                      placeholder="Digite o número do pedido"
                      value={routeOrderId}
                      onChange={(e) => setRouteOrderId(e.target.value)}
                      disabled={isSettingRoute}
                    />
                  </div>
                  <Button onClick={handleSetInRoute} disabled={isSettingRoute}>
                    {isSettingRoute ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Colocando em Rota...
                      </>
                    ) : (
                      "Colocar em Rota"
                    )}
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground">
                  Ao colocar em rota, o status do pedido será alterado para "Em Rota".
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

      </Tabs>
    </div>
  );
}