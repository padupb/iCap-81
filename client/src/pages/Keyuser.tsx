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
  Loader2
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
  receivesPurchaseOrders: z.boolean().default(false)
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

  // Estados para edição
  const [editingCategory, setEditingCategory] = useState<CompanyCategory | null>(null);
  const [editingRole, setEditingRole] = useState<UserRole | null>(null);
  const [editingUnit, setEditingUnit] = useState<Unit | null>(null);

  // Estados para configurações
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);

  // Estados para configurações do sistema
  const [systemConfig, setSystemConfig] = useState({
    database_url: "",
    google_maps_api_key: "",
    smtp_host: "",
    smtp_port: "",
    smtp_user: "",
    smtp_password: "",
    app_name: "",
    urgent_days_threshold: "7"
  });

  // Estado para gerenciar visibilidade de senhas
  const [showPasswords, setShowPasswords] = useState<{[key: string]: boolean}>({});

  // Estados para iCapMob
  const [uploadingAPK, setUploadingAPK] = useState(false);

  const [isSystemConfigSaving, setIsSystemConfigSaving] = useState(false);

  const [showSettings, setShowSettings] = useState(false);
  const [stats, setStats] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isTestingObjectStorage, setIsTestingObjectStorage] = useState(false);
  const [objectStorageTestResult, setObjectStorageTestResult] = useState<any>(null);
  const [isTestingObjectStorageAPI, setIsTestingObjectStorageAPI] = useState(false);
  const [objectStorageAPITestResult, setObjectStorageAPITestResult] = useState<any>(null);
  const [numeroPedidoDownload, setNumeroPedidoDownload] = useState("");
  const [isDownloadingNotaFiscal, setIsDownloadingNotaFiscal] = useState(false);


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

  // Carregar configurações do sistema quando os settings mudarem
  React.useEffect(() => {
    if (settings.length > 0) {
      const settingsObject = settings.reduce((acc, setting) => {
        acc[setting.key] = setting.value;
        return acc;
      }, {} as Record<string, string>);

      setSystemConfig({
        database_url: settingsObject.database_url || "",
        google_maps_api_key: settingsObject.google_maps_api_key || "",
        smtp_host: settingsObject.smtp_host || "",
        smtp_port: settingsObject.smtp_port || "",
        smtp_user: settingsObject.smtp_user || "",
        smtp_password: settingsObject.smtp_password || "",
        app_name: settingsObject.app_name || "iCap",
        urgent_days_threshold: settingsObject.urgent_days_threshold || "7"
      });

      // Mostrar campos que têm valores
      setShowPasswords({
        database_url: (settingsObject.database_url || "").length > 0,
        google_maps_api_key: (settingsObject.google_maps_api_key || "").length > 0,
        smtp_password: (settingsObject.smtp_password || "").length > 0
      });
    }
  }, [settings]);

  // Mutations para categorias de empresa
  const createCategoryMutation = useMutation({
    mutationFn: async (data: CompanyCategoryFormData) => {
      const categoryWithContract = {
        ...data,
        requiresContract: data.requiresContract === true
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
        requiresContract: data.category.requiresContract === true
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
    });
    setActiveCategoryDialog(true);
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

  // Funções para configurações do sistema
  const handleSystemConfigChange = (key: string, value: string) => {
    setSystemConfig(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const saveSystemConfig = async () => {
    setIsSystemConfigSaving(true);

    try {
      const configArray = Object.entries(systemConfig).map(([key, value]) => ({
        key,
        value: value || "",
        description: getConfigDescription(key)
      }));

      const response = await fetch("/api/settings", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(configArray),
      });

      if (!response.ok) {
        throw new Error("Erro ao salvar configurações");
      }

      queryClient.invalidateQueries({ queryKey: ["/api/settings"] });

      toast({
        title: "Sucesso",
        description: "Configurações do sistema salvas com sucesso",
      });
    } catch (error) {
      toast({
        title: "Erro",
        description: "Erro ao salvar configurações do sistema",
        variant: "destructive",
      });
    } finally {
      setIsSystemConfigSaving(false);
    }
  };

  const resetSystemConfig = () => {
    const settingsObject = settings.reduce((acc, setting) => {
      acc[setting.key] = setting.value;
      return acc;
    }, {} as Record<string, string>);

    setSystemConfig({
      database_url: settingsObject.database_url || "",
      google_maps_api_key: settingsObject.google_maps_api_key || "",
      smtp_host: settingsObject.smtp_host || "",
      smtp_port: settingsObject.smtp_port || "",
      smtp_user: settingsObject.smtp_user || "",
      smtp_password: settingsObject.smtp_password || "",
      app_name: settingsObject.app_name || "iCap",
      urgent_days_threshold: settingsObject.urgent_days_threshold || "7"
    });
  };

  const togglePasswordVisibility = (key: string) => {
    setShowPasswords(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
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

  const getConfigDescription = (key: string) => {
    const descriptions: Record<string, string> = {
      database_url: "String de conexão completa do PostgreSQL",
      google_maps_api_key: "Chave da API do Google Maps para funcionalidades de localização",
      smtp_host: "Servidor SMTP para envio de e-mails",
      smtp_port: "Porta do servidor SMTP",
      smtp_user: "Usuário para autenticação SMTP",
      smtp_password: "Senha para autenticação SMTP",
      app_name: "Nome da aplicação",
      urgent_days_threshold: "Limite de dias para pedidos urgentes"
    };
    return descriptions[key] || `Configuração ${key}`;
  };

  const handleTestObjectStorage = async () => {
    setIsTestingObjectStorage(true);
    setObjectStorageTestResult(null);

    try {
      const response = await fetch("/api/keyuser/test-object-storage", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        }
      });

      const result = await response.json();

      setObjectStorageTestResult(result);

      if (result.success) {
        toast({
          title: "Teste Concluído",
          description: "Object Storage testado com sucesso!",
          variant: "default"
        });
      } else {
        toast({
          title: "Falha no Teste",
          description: result.message || "Erro ao testar Object Storage",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error("Erro ao testar Object Storage:", error);
      setObjectStorageTestResult({
        success: false,
        message: "Erro de conexão ao executar teste",
        error: error instanceof Error ? error.message : "Erro desconhecido"
      });

      toast({
        title: "Erro",
        description: "Não foi possível executar o teste do Object Storage",
        variant: "destructive"
      });
    } finally {
      setIsTestingObjectStorage(false);
    }
  };

  const handleTestObjectStorageAPI = async () => {
    setIsTestingObjectStorageAPI(true);
    setObjectStorageAPITestResult(null);

    try {
      const response = await fetch("/api/keyuser/test-object-storage-api", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          testType: "comprehensive",
          includePerformance: true
        })
      });

      const result = await response.json();

      setObjectStorageAPITestResult(result);

      if (result.success) {
        toast({
          title: "Teste da API Concluído",
          description: `Teste executado com sucesso! ${result.testsExecuted || 0} testes realizados.`,
          variant: "default"
        });
      } else {
        toast({
          title: "Falha no Teste da API",
          description: result.message || "Erro ao testar API do Object Storage",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error("Erro ao testar API do Object Storage:", error);
      setObjectStorageAPITestResult({
        success: false,
        message: "Erro de conexão ao executar teste da API",
        error: error instanceof Error ? error.message : "Erro desconhecido"
      });

      toast({
        title: "Erro",
        description: "Não foi possível executar o teste da API do Object Storage",
        variant: "destructive"
      });
    } finally {
      setIsTestingObjectStorageAPI(false);
    }
  };

  const handleDownloadNotaFiscal = async () => {
    if (!numeroPedidoDownload.trim()) {
      toast({
        title: "Erro",
        description: "Por favor, digite o número do pedido",
        variant: "destructive"
      });
      return;
    }

    setIsDownloadingNotaFiscal(true);

    try {
      // Buscar o pedido pelo número
      const response = await fetch(`/api/orders?orderId=${numeroPedidoDownload}`);
      
      if (!response.ok) {
        throw new Error("Erro ao buscar pedido");
      }

      const orders = await response.json();
      const order = orders.find((o: any) => o.orderId === numeroPedidoDownload || o.numeroPedido === numeroPedidoDownload);

      if (!order) {
        toast({
          title: "Pedido não encontrado",
          description: `Nenhum pedido encontrado com o número ${numeroPedidoDownload}`,
          variant: "destructive"
        });
        return;
      }

      // Fazer download da nota fiscal PDF
      console.log(`📥 Iniciando download de nota fiscal para pedido ${order.id}`);

      const pdfResponse = await fetch(`/api/pedidos/${order.id}/documentos/nota_pdf`);

      if (!pdfResponse.ok) {
        throw new Error("Nota fiscal não encontrada para este pedido");
      }

      const blob = await pdfResponse.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = `NotaFiscal_${numeroPedidoDownload}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: "Download Concluído",
        description: `Nota fiscal do pedido ${numeroPedidoDownload} baixada com sucesso`,
        variant: "default"
      });

      // Limpar o campo
      setNumeroPedidoDownload("");

    } catch (error) {
      console.error("Erro ao baixar nota fiscal:", error);
      toast({
        title: "Erro no Download",
        description: error instanceof Error ? error.message : "Erro ao fazer download da nota fiscal",
        variant: "destructive"
      });
    } finally {
      setIsDownloadingNotaFiscal(false);
    }
  };

  const handleDownloadTestFile = async () => {
    try {
      // Verificar se temos informações de teste bem-sucedido
      let storageKey = null;
      
      // Verificar primeiro no resultado do teste da API
      if (objectStorageAPITestResult?.success && objectStorageAPITestResult?.storageKey) {
        storageKey = objectStorageAPITestResult.storageKey;
        console.log("📂 Usando storageKey do teste da API:", storageKey);
      } 
      // Verificar no resultado do teste básico
      else if (objectStorageTestResult?.success) {
        // Tentar diferentes caminhos onde a storageKey pode estar
        if (objectStorageTestResult.data?.storageKey) {
          storageKey = objectStorageTestResult.data.storageKey;
          console.log("📂 Usando storageKey do teste básico (data):", storageKey);
        } else if (objectStorageTestResult.storageKey) {
          storageKey = objectStorageTestResult.storageKey;
          console.log("📂 Usando storageKey do teste básico (root):", storageKey);
        }
      }

      if (!storageKey) {
        console.log("❌ Nenhuma storageKey encontrada");
        console.log("Debug objectStorageAPITestResult:", objectStorageAPITestResult);
        console.log("Debug objectStorageTestResult:", objectStorageTestResult);
        
        toast({
          title: "Nenhum Arquivo",
          description: "Execute um teste bem-sucedido primeiro para ter um arquivo disponível para download",
          variant: "destructive"
        });
        return;
      }

      // Fazer download do arquivo de teste
      const response = await fetch("/api/keyuser/download-test-file", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          storageKey: storageKey
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Erro ao fazer download");
      }

      // Criar blob e fazer download
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = `keyuser-test-${new Date().toISOString().slice(0, 10)}.txt`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: "Download Concluído",
        description: "Arquivo de teste baixado com sucesso!",
        variant: "default"
      });

    } catch (error) {
      console.error("Erro ao fazer download do arquivo de teste:", error);
      toast({
        title: "Erro no Download",
        description: error instanceof Error ? error.message : "Erro ao fazer download do arquivo",
        variant: "destructive"
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-foreground">Painel Keyuser</h1>
      </div>

      <Tabs defaultValue="categories" className="space-y-6">
        <TabsList className="grid w-full grid-cols-6">
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
          <TabsTrigger value="system-config" className="flex items-center gap-2">
            <Key className="w-4 h-4" />
            API Keys
          </TabsTrigger>
          <TabsTrigger value="settings" className="flex items-center gap-2">
            <Settings className="w-4 h-4" />
            Configurações Gerais
          </TabsTrigger>
          <TabsTrigger value="icapmob" className="flex items-center gap-2">
            <Smartphone className="w-4 h-4" />
            iCapMob
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
                    <Plus className="w-4 h-4 mr-2" />Correcting the JSX syntax error by wrapping the TabsContent components within a React Fragment.                    Nova Função
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

        {/* Aba Configurações do Sistema */}
        <TabsContent value="system-config" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Key className="w-5 h-5" />
                API Keys
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">

                {/* Banco de Dados */}
                <div>
                  <h3 className="text-lg font-medium text-foreground mb-4">
                    Banco de Dados
                  </h3>
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <Label className="w-32 text-sm font-medium">DATABASE_URL:</Label>
                      <div className="flex items-center gap-2 flex-1">
                        <Input
                          type={showPasswords.database_url ? "text" : "password"}
                          value={systemConfig.database_url}
                          onChange={(e) => handleSystemConfigChange('database_url', e.target.value)}
                          placeholder="postgresql://user:password@host:port/database"
                          className="bg-input border-border font-mono"
                        />
                        <Button
                          variant="outline"
                          size="sm"
                          type="button"
                          onClick={() => togglePasswordVisibility('database_url')}
                        >
                          {showPasswords.database_url ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* APIs Externas */}
                <div>
                  <h3 className="text-lg font-medium text-foreground mb-4">
                    APIs e Integrações
                  </h3>
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <Label className="w-32 text-sm font-medium">Google Maps:</Label>
                      <div className="flex items-center gap-2 flex-1">
                        <Input
                          type={showPasswords.google_maps_api_key ? "text" : "password"}
                          value={systemConfig.google_maps_api_key}
                          onChange={(e) => handleSystemConfigChange('google_maps_api_key', e.target.value)}
                          placeholder="AIza..."
                          className="bg-input border-border"
                        />
                        <Button
                          variant="outline"
                          size="sm"
                          type="button"
                          onClick={() => togglePasswordVisibility('google_maps_api_key')}
                        >
                          {showPasswords.google_maps_api_key ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Email / SMTP */}
                <div>
                  <h3 className="text-lg font-medium text-foreground mb-4">
                    Configurações de Email (SMTP)
                  </h3>
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <Label className="w-32 text-sm font-medium">Servidor SMTP:</Label>
                      <Input
                        value={systemConfig.smtp_host}
                        onChange={(e) => handleSystemConfigChange('smtp_host', e.target.value)}
                        placeholder="smtp.gmail.com"
                        className="bg-input border-border flex-1"
                      />
                    </div>
                    <div className="flex items-center gap-3">
                      <Label className="w-32 text-sm font-medium">Porta SMTP:</Label>
                      <Input
                        value={systemConfig.smtp_port}
                        onChange={(e) => handleSystemConfigChange('smtp_port', e.target.value)}
                        placeholder="587"
                        className="bg-input border-border flex-1"
                      />
                    </div>
                    <div className="flex items-center gap-3">
                      <Label className="w-32 text-sm font-medium">Usuário SMTP:</Label>
                      <Input
                        value={systemConfig.smtp_user}
                        onChange={(e) => handleSystemConfigChange('smtp_user', e.target.value)}
                        placeholder="seu-email@gmail.com"
                        className="bg-input border-border flex-1"
                      />
                    </div>
                    <div className="flex items-center gap-3">
                      <Label className="w-32 text-sm font-medium">Senha SMTP:</Label>
                      <div className="flex items-center gap-2 flex-1">
                        <Input
                          type={showPasswords.smtp_password ? "text" : "password"}
                          value={systemConfig.smtp_password}
                          onChange={(e) => handleSystemConfigChange('smtp_password', e.target.value)}
                          placeholder="sua-senha-de-app"
                          className="bg-input border-border"
                        />
                        <Button
                          variant="outline"
                          size="sm"
                          type="button"
                          onClick={() => togglePasswordVisibility('smtp_password')}
                        >
                          {showPasswords.smtp_password ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Botões de Ação */}
                <div className="flex justify-end gap-4 pt-6 border-t border-border">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={resetSystemConfig}
                    className="flex items-center gap-2"
                  >
                    <RotateCcw className="w-4 h-4" />
                    Restaurar Valores
                  </Button>
                  <Button
                    type="button"
                    onClick={saveSystemConfig}
                    disabled={isSystemConfigSaving}
                    className="flex items-center gap-2"
                  >
                    <Save className="w-4 h-4" />
                    {isSystemConfigSaving ? "Salvando..." : "Salvar Configurações"}
                  </Button>
                </div>
              </div>
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

                    {/* Configurações de Integração */}
                    <div>
                      <h3 className="text-lg font-medium text-foreground mb-4">
                        Integrações
                      </h3>

                      <FormField
                        control={settingsForm.control}
                        name="google_maps_api_key"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="flex items-center gap-2">
                              <MapPin className="w-4 h-4" />
                              Chave da API do Google Maps
                            </FormLabel>
                            <FormControl>
                              <Input
                                type="password"
                                placeholder="Insira sua chave da API"
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

                  {/* Seção de Download de Nota Fiscal */}
                  <div className="space-y-4 pt-6 border-t border-border">
                    <h3 className="text-lg font-medium text-foreground">Download de Nota Fiscal</h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                      <div className="md:col-span-2">
                        <Label htmlFor="numero-pedido-download">Número do Pedido</Label>
                        <Input
                          id="numero-pedido-download"
                          type="text"
                          placeholder="Digite o número do pedido (ex: CCM0809250026)"
                          value={numeroPedidoDownload}
                          onChange={(e) => setNumeroPedidoDownload(e.target.value)}
                          onKeyPress={(e) => {
                            if (e.key === 'Enter') {
                              handleDownloadNotaFiscal();
                            }
                          }}
                          className="bg-input border-border"
                        />
                      </div>

                      <Button 
                        onClick={handleDownloadNotaFiscal}
                        disabled={isDownloadingNotaFiscal || !numeroPedidoDownload.trim()}
                        className="w-full"
                      >
                        {isDownloadingNotaFiscal ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Baixando...
                          </>
                        ) : (
                          <>
                            <Download className="w-4 h-4 mr-2" />
                            Baixar Nota Fiscal
                          </>
                        )}
                      </Button>
                    </div>
                  </div>

                  {/* Seção de Testes do Sistema */}
                  <div className="space-y-4 pt-6 border-t border-border">
                    <h3 className="text-lg font-medium text-foreground">Testes do Sistema</h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <Button 
                        onClick={handleTestObjectStorage}
                        disabled={isTestingObjectStorage}
                        className="w-full"
                        variant="outline"
                      >
                        {isTestingObjectStorage ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Testando Object Storage...
                          </>
                        ) : (
                          <>
                            <Database className="w-4 h-4 mr-2" />
                            Testar Object Storage
                          </>
                        )}
                      </Button>

                      <Button 
                        onClick={handleTestObjectStorageAPI}
                        disabled={isTestingObjectStorageAPI}
                        className="w-full"
                        variant="outline"
                      >
                        {isTestingObjectStorageAPI ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Testando API...
                          </>
                        ) : (
                          <>
                            <TestTube className="w-4 h-4 mr-2" />
                            Testar API Object Storage
                          </>
                        )}
                      </Button>

                      <Button 
                        onClick={handleDownloadTestFile}
                        disabled={!objectStorageTestResult?.success && !objectStorageAPITestResult?.success}
                        className="w-full"
                        variant="outline"
                      >
                        <Download className="w-4 h-4 mr-2" />
                        Download Arquivo de Teste
                      </Button>
                    </div>

                    {objectStorageTestResult && (
                      <div className={`p-4 rounded-lg border ${
                        objectStorageTestResult.success 
                          ? 'bg-green-50 border-green-200 text-green-800' 
                          : 'bg-red-50 border-red-200 text-red-800'
                      }`}>
                        <h4 className="font-semibold mb-2 flex items-center gap-2">
                          {objectStorageTestResult.success ? (
                            <CheckCircle className="w-4 h-4" />
                          ) : (
                            <XCircle className="w-4 h-4" />
                          )}
                          Resultado do Teste Object Storage
                        </h4>
                        <p className="text-sm mb-2">{objectStorageTestResult.message}</p>
                        {objectStorageTestResult.data?.output && (
                          <pre className="text-xs bg-gray-100 p-2 rounded overflow-auto max-h-40 border">
                            {objectStorageTestResult.data.output}
                          </pre>
                        )}
                        <p className="text-xs mt-2 opacity-75">
                          Executado em: {new Date(objectStorageTestResult.data?.timestamp || Date.now()).toLocaleString('pt-BR')}
                        </p>
                      </div>
                    )}

                    {objectStorageAPITestResult && (
                      <div className={`p-4 rounded-lg border ${
                        objectStorageAPITestResult.success 
                          ? 'bg-green-50 border-green-200 text-green-800' 
                          : 'bg-red-50 border-red-200 text-red-800'
                      }`}>
                        <h4 className="font-semibold mb-2 flex items-center gap-2">
                          {objectStorageAPITestResult.success ? (
                            <CheckCircle className="w-4 h-4" />
                          ) : (
                            <XCircle className="w-4 h-4" />
                          )}
                          Resultado do Teste da API
                        </h4>
                        <p className="text-sm mb-2">{objectStorageAPITestResult.message}</p>
                        
                        {/* Mostrar estatísticas do teste */}
                        {objectStorageAPITestResult.stats && (
                          <div className="grid grid-cols-2 gap-2 text-xs mt-2">
                            <div>Testes executados: {objectStorageAPITestResult.stats.testsExecuted}</div>
                            <div>Tempo total: {objectStorageAPITestResult.stats.totalTime}ms</div>
                            <div>Upload/Download: {objectStorageAPITestResult.stats.uploadDownloadTime}ms</div>
                            <div>Objetos encontrados: {objectStorageAPITestResult.stats.totalObjects}</div>
                          </div>
                        )}

                        {/* Mostrar log detalhado se disponível */}
                        {objectStorageAPITestResult.log && (
                          <details className="mt-3">
                            <summary className="text-xs cursor-pointer">Ver log detalhado</summary>
                            <pre className="text-xs bg-gray-100 p-2 rounded mt-2 overflow-auto max-h-40 border">
                              {objectStorageAPITestResult.log}
                            </pre>
                          </details>
                        )}

                        <p className="text-xs mt-2 opacity-75">
                          Executado em: {new Date(objectStorageAPITestResult.timestamp || Date.now()).toLocaleString('pt-BR')}
                        </p>
                      </div>
                    )}
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

        
              </Tabs>
            </div>
          );
        }