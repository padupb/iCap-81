import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useState } from "react";
import { 
  Search, 
  Activity,
  User,
  Clock,
  FileText,
  Plus,
  Edit,
  Trash2,
  CheckCircle,
  XCircle
} from "lucide-react";
import { formatDateTime } from "@/lib/utils";
import type { SystemLog, users } from "@shared/schema";

type User = typeof users.$inferSelect;

export default function Logs() {
  const [searchTerm, setSearchTerm] = useState("");
  const [actionFilter, setActionFilter] = useState<string>("all");
  const [itemTypeFilter, setItemTypeFilter] = useState<string>("all");

  const { data: logs = [], isLoading } = useQuery<SystemLog[]>({
    queryKey: ["/api/logs"],
  });
  
  const { data: usersList = [] } = useQuery<User[]>({
    queryKey: ["/api/users"],
  });

  // Get unique actions and item types for filters
  const uniqueActions = Array.from(new Set(logs.map(log => log.action)));
  const uniqueItemTypes = Array.from(new Set(logs.map(log => log.itemType)));

  // Filter logs
  const filteredLogs = logs.filter(log => {
    const matchesSearch = log.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         log.itemType.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (log.details && log.details.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesAction = actionFilter === "all" || log.action === actionFilter;
    const matchesItemType = itemTypeFilter === "all" || log.itemType === itemTypeFilter;
    
    return matchesSearch && matchesAction && matchesItemType;
  });

  const getActionIcon = (action: string) => {
    if (action.includes("Criou") || action.includes("criou")) return <Plus className="text-green-500" size={16} />;
    if (action.includes("Editou") || action.includes("Atualizou")) return <Edit className="text-blue-500" size={16} />;
    if (action.includes("Excluiu")) return <Trash2 className="text-red-500" size={16} />;
    if (action.includes("Aprovou")) return <CheckCircle className="text-green-500" size={16} />;
    if (action.includes("Rejeitou")) return <XCircle className="text-red-500" size={16} />;
    return <Activity className="text-muted-foreground" size={16} />;
  };

  const getActionColor = (action: string) => {
    if (action.includes("Criou") || action.includes("criou") || action.includes("Aprovou")) {
      return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300";
    }
    if (action.includes("Editou") || action.includes("Atualizou")) {
      return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300";
    }
    if (action.includes("Excluiu") || action.includes("Rejeitou")) {
      return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300";
    }
    return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300";
  };

  const getItemTypeIcon = (itemType: string) => {
    switch (itemType) {
      case "user": return <User size={14} />;
      case "order": return <FileText size={14} />;
      case "company": return <User size={14} />;
      default: return <Activity size={14} />;
    }
  };

  return (
    <div className="space-y-6">

      {/* Stats Cards Removed */}

      {/* Filters */}
      <Card className="bg-card border-border">
        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="search">Buscar</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" size={16} />
                <Input
                  id="search"
                  placeholder="Buscar por ação, tipo ou detalhes..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 bg-input border-border"
                />
              </div>
            </div>
            
            <div>
              <Label htmlFor="action-filter">Ação</Label>
              <Select value={actionFilter} onValueChange={setActionFilter}>
                <SelectTrigger className="bg-input border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as Ações</SelectItem>
                  {uniqueActions.map((action) => (
                    <SelectItem key={action} value={action}>
                      {action}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="item-type-filter">Tipo de Item</Label>
              <Select value={itemTypeFilter} onValueChange={setItemTypeFilter}>
                <SelectTrigger className="bg-input border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os Tipos</SelectItem>
                  {uniqueItemTypes.map((itemType) => (
                    <SelectItem key={itemType} value={itemType}>
                      {itemType}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Logs Table */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle>Registro de Atividades ({filteredLogs.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted">
                <TableRow>
                  <TableHead>Data/Hora</TableHead>
                  <TableHead>Usuário</TableHead>
                  <TableHead>Ação</TableHead>
                  <TableHead>Tipo de Item</TableHead>
                  <TableHead>Item ID</TableHead>
                  <TableHead>Detalhes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLogs.map((log) => (
                  <TableRow key={log.id} className="hover:bg-muted/50">
                    <TableCell>
                      <div className="flex items-center">
                        <Clock className="mr-2 text-muted-foreground" size={14} />
                        <span className="text-sm font-mono">
                          {formatDateTime(log.createdAt!)}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center">
                        <User className="mr-2 text-muted-foreground" size={14} />
                        <span className="text-sm">
                          {usersList.find(user => user.id === log.userId)?.name || `Usuário ${log.userId}`}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={getActionColor(log.action)}>
                        <span className="flex items-center">
                          {getActionIcon(log.action)}
                          <span className="ml-1">{log.action}</span>
                        </span>
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        <span className="flex items-center">
                          {getItemTypeIcon(log.itemType)}
                          <span className="ml-1">{log.itemType}</span>
                        </span>
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className="font-mono text-sm">
                        {log.itemId || "-"}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-foreground">
                        {log.details || "-"}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          
          {filteredLogs.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              {searchTerm || actionFilter !== "all" || itemTypeFilter !== "all" 
                ? "Nenhum log encontrado com os filtros aplicados" 
                : "Nenhum log registrado"}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
