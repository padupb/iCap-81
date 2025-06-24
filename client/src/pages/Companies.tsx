import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Separator } from "@/components/ui/separator";
import { Plus, Search, Edit, Trash2, Building, MapPin, User, FileText, AlertCircle, Info } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useAuthorization } from "@/context/AuthorizationContext";
import { 
  insertCompanySchemaZod,
  type Company, 
  type CompanyCategory, 
  type User,
} from "@shared/schema";

const companyFormSchema = insertCompanySchemaZod;

type CompanyFormData = z.infer<typeof companyFormSchema>;

export default function Companies() {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  const queryClient = useQueryClient();
  const { canCreate, canEdit } = useAuthorization();

  const { data: companies = [], isLoading } = useQuery<Company[]>({
    queryKey: ["/api/companies"],
  });

  const { data: categories = [] } = useQuery<CompanyCategory[]>({
    queryKey: ["/api/company-categories"],
  });

  const { data: users = [] } = useQuery<User[]>({
    queryKey: ["/api/users"],
  });

  const createCompanyMutation = useMutation({
    mutationFn: async (data: CompanyFormData) => {
      console.log("Creating company:", data);
      return apiRequest("POST", "/api/companies", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/companies"] });
      setIsCreateDialogOpen(false);
      toast({
        title: "Sucesso",
        description: "Empresa criada com sucesso",
      });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Erro ao criar empresa",
        variant: "destructive",
      });
    },
  });

  const updateCompanyMutation = useMutation({
    mutationFn: async (data: { id: number; company: Partial<CompanyFormData> }) => {
      console.log("Updating company:", data);
      return apiRequest("PUT", `/api/companies/${data.id}`, data.company);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/companies"] });
      setIsEditDialogOpen(false);
      setSelectedCompany(null);
      toast({
        title: "Sucesso",
        description: "Empresa atualizada com sucesso",
      });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Erro ao atualizar empresa",
        variant: "destructive",
      });
    },
  });

  const deleteCompanyMutation = useMutation({
    mutationFn: async (id: number) => {
      console.log("Deleting company:", id);
      return apiRequest("DELETE", `/api/companies/${id}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/companies"] });
      toast({
        title: "Sucesso",
        description: "Empresa excluída com sucesso",
      });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Erro ao excluir empresa",
        variant: "destructive",
      });
    },
  });

  const form = useForm<CompanyFormData>({
    resolver: zodResolver(companyFormSchema),
    defaultValues: {
      name: "",
      cnpj: "",
      address: "",
      categoryId: 0,
      approverId: undefined,
      contractNumber: "",
    },
    mode: "onChange",
  });

  const editForm = useForm<CompanyFormData>({
    resolver: zodResolver(companyFormSchema),
    defaultValues: {
      contractNumber: "",
    },
    mode: "onChange",
  });

  const onSubmit = (data: CompanyFormData) => {
    // Garantir que contractNumber seja uma string vazia em vez de null
    const formattedData = {
      ...data,
      contractNumber: data.contractNumber || "",
    };
    createCompanyMutation.mutate(formattedData);
  };

  const onEditSubmit = (data: CompanyFormData) => {
    if (selectedCompany) {
      // Garantir que contractNumber seja uma string vazia em vez de null
      const formattedData = {
        ...data,
        contractNumber: data.contractNumber || "",
      };
      updateCompanyMutation.mutate({ id: selectedCompany.id, company: formattedData });
    }
  };

  const handleEdit = (company: Company) => {
    setSelectedCompany(company);
    editForm.reset({
      name: company.name,
      cnpj: company.cnpj,
      address: company.address,
      categoryId: company.categoryId,
      approverId: company.approverId || undefined,
      contractNumber: company.contractNumber || "",
    });
    setIsEditDialogOpen(true);
  };

  const handleDelete = (id: number) => {
    if (confirm("Tem certeza que deseja excluir esta empresa?")) {
      deleteCompanyMutation.mutate(id);
    }
  };

  const getGoogleMapsLink = (address: string) => {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
  };

  const selectedCategoryId = form.watch("categoryId");
  const selectedCategory = categories.find(cat => cat.id === selectedCategoryId);
  const requiresApprover = selectedCategory?.requiresApprover || false;
  const requiresContract = selectedCategory?.requiresContract || false;

  const editSelectedCategoryId = editForm.watch("categoryId");
  const editSelectedCategory = categories.find(cat => cat.id === editSelectedCategoryId);
  const editRequiresApprover = editSelectedCategory?.requiresApprover || false;
  const editRequiresContract = editSelectedCategory?.requiresContract || false;

  // Filter companies
  const filteredCompanies = companies.filter(company => {
    const matchesCategory = categoryFilter === "all" || company.categoryId.toString() === categoryFilter;
    const matchesSearch = company.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         company.cnpj.includes(searchTerm) ||
                         company.address.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Empresas</h1>
            <p className="text-muted-foreground">
              Gerencie empresas, fornecedores e obras
            </p>
            {!canCreate("companies") && !canEdit("companies") && (
              <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-md">
                <p className="text-sm text-blue-700">
                  <Info className="inline h-4 w-4 mr-1" />
                  Você tem acesso somente para visualização. Para criar ou editar empresas, solicite as permissões necessárias ao administrador.
                </p>
              </div>
            )}
          </div>
          <div className="flex items-center space-x-2">
            {canCreate("companies") && (
              <Button onClick={() => setIsCreateDialogOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Adicionar Empresa
              </Button>
            )}
          </div>
        </div>

      {/* Companies Table */}
      <Card className="mt-4 rounded-lg border text-card-foreground shadow-sm">
        <CardHeader className="p-6 pt-4 pb-4 border-b border-border flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-lg text-foreground">Lista de Empresas</CardTitle>
            <p className="text-muted-foreground text-sm mt-1">
              {filteredCompanies.length} empresas encontradas
            </p>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted">
                <TableRow>
                  <TableHead className="text-muted-foreground">Nome</TableHead>
                  <TableHead className="text-muted-foreground">Razão Social</TableHead>
                  <TableHead className="text-muted-foreground">Categoria</TableHead>
                  <TableHead className="text-muted-foreground">Número de Contrato</TableHead>
                  <TableHead className="text-muted-foreground">Endereço</TableHead>
                  <TableHead className="text-muted-foreground text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8">
                      <div className="flex flex-col items-center justify-center space-y-3">
                        <Building className="text-muted-foreground/50 h-8 w-8" />
                        <p className="text-muted-foreground">Carregando empresas...</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : filteredCompanies.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8">
                      <div className="flex flex-col items-center justify-center space-y-3">
                        <Building className="text-muted-foreground/50 h-8 w-8" />
                        <p className="text-muted-foreground">Nenhuma empresa encontrada</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredCompanies.map((company) => {
                    const category = categories.find((c) => c.id === company.categoryId);
                    return (
                      <TableRow key={company.id} className="hover:bg-muted/50 transition-colors">
                        <TableCell className="font-medium text-foreground">
                          {company.name}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {company.cnpj}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="font-normal border-border">
                            {category?.name || "Sem categoria"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {company.contractNumber ? (
                            <span className="font-medium">{company.contractNumber}</span>
                          ) : (
                            <span className="text-muted-foreground/50 text-sm">N/A</span>
                          )}
                        </TableCell>
                        <TableCell className="text-muted-foreground max-w-xs truncate">
                          <div className="flex items-center">
                            <span className="truncate">{company.address}</span>
                            {company.address && (
                              <a
                                href={getGoogleMapsLink(company.address)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="ml-2 text-muted-foreground hover:text-primary"
                              >
                                <MapPin size={16} />
                              </a>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex space-x-2">
                    {canEdit("companies") && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-muted-foreground hover:text-green-500"
                        onClick={() => handleEdit(company)}
                      >
                        <Edit size={16} />
                      </Button>
                    )}
                    {canEdit("companies") && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-muted-foreground hover:text-red-500"
                            onClick={() => handleDelete(company.id)}
                          >
                            <Trash2 size={16} />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
                            <AlertDialogDescription>
                              Tem certeza que deseja excluir a empresa "{company.name}"? Esta ação não pode ser desfeita.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => deleteCompanyMutation.mutate(company.id)}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              Excluir
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                  </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl p-0">
          <DialogHeader className="p-6 pb-2">
            <DialogTitle>Editar Empresa</DialogTitle>
          </DialogHeader>

          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit(onEditSubmit)} className="space-y-6 p-6 pt-2">
              <FormField
                control={editForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome da Empresa</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Construtora Exemplo LTDA"
                        className="bg-input border-border"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  control={editForm.control}
                  name="cnpj"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Razão Social</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="00.000.000/0000-00"
                          className="bg-input border-border"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={editForm.control}
                  name="categoryId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Categoria</FormLabel>
                      <Select 
                        value={field.value?.toString() || ""} 
                        onValueChange={(value) => field.onChange(parseInt(value))}
                      >
                        <FormControl>
                          <SelectTrigger className="bg-input border-border">
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

              <FormField
                control={editForm.control}
                name="address"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Endereço</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Rua Exemplo, 123 - Bairro - Cidade - UF"
                        className="bg-input border-border"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {editRequiresApprover && (
                <FormField
                  control={editForm.control}
                  name="approverId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Aprovador</FormLabel>
                      <Select 
                        value={field.value?.toString() || ""} 
                        onValueChange={(value) => field.onChange(value ? parseInt(value) : undefined)}
                      >
                        <FormControl>
                          <SelectTrigger className="bg-input border-border">
                            <SelectValue placeholder="Selecione um aprovador" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {users.map((user) => (
                            <SelectItem key={user.id} value={user.id.toString()}>
                              {user.name} ({user.email})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              {editRequiresContract && (
                <FormField
                  control={editForm.control}
                  name="contractNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Número do Contrato</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Ex: CONT-2023/0001"
                          className="bg-input border-border"
                          value={field.value || ""}
                          onChange={(e) => field.onChange(e.target.value)}
                          onBlur={field.onBlur}
                          name={field.name}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              <div className="flex justify-end space-x-4 pt-4 border-t border-border">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsEditDialogOpen(false)}
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  className="bg-primary hover:bg-primary/90"
                  disabled={updateCompanyMutation.isPending}
                >
                  {updateCompanyMutation.isPending ? "Salvando..." : "Salvar Alterações"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}