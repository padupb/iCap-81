import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useState, useMemo } from "react";
import { Search, ChevronLeft, ChevronRight } from "lucide-react";
import { formatDateTime } from "@/lib/utils";
import type { SystemLog, users } from "@shared/schema";

type User = typeof users.$inferSelect;

const ITEMS_PER_PAGE = 500;

export default function Logs() {
  const [searchTerm, setSearchTerm] = useState("");
  const [actionFilter, setActionFilter] = useState<string>("all");
  const [itemTypeFilter, setItemTypeFilter] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState(1);

  const { data: logs = [], isLoading } = useQuery<SystemLog[]>({
    queryKey: ["/api/logs"],
  });
  
  const { data: usersList = [] } = useQuery<User[]>({
    queryKey: ["/api/users"],
  });

  const uniqueActions = Array.from(new Set(logs.map(log => log.action)));
  const uniqueItemTypes = Array.from(new Set(logs.map(log => log.itemType)));

  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      const matchesSearch = log.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           log.itemType.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           (log.details && log.details.toLowerCase().includes(searchTerm.toLowerCase()));
      const matchesAction = actionFilter === "all" || log.action === actionFilter;
      const matchesItemType = itemTypeFilter === "all" || log.itemType === itemTypeFilter;
      
      return matchesSearch && matchesAction && matchesItemType;
    }).sort((a, b) => {
      const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return dateB - dateA;
    });
  }, [logs, searchTerm, actionFilter, itemTypeFilter]);

  const totalPages = Math.ceil(filteredLogs.length / ITEMS_PER_PAGE);
  
  const paginatedLogs = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    return filteredLogs.slice(startIndex, endIndex);
  }, [filteredLogs, currentPage]);

  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  const handleFilterChange = () => {
    setCurrentPage(1);
  };

  const getUserName = (userId: number) => {
    return usersList.find(user => user.id === userId)?.name || `ID: ${userId}`;
  };

  return (
    <div className="space-y-4">
      <Card className="bg-card border-border">
        <CardContent className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <Label htmlFor="search" className="text-xs">Buscar</Label>
              <div className="relative">
                <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 text-muted-foreground" size={14} />
                <Input
                  id="search"
                  placeholder="Buscar..."
                  value={searchTerm}
                  onChange={(e) => { setSearchTerm(e.target.value); handleFilterChange(); }}
                  className="pl-8 h-8 text-sm bg-input border-border"
                />
              </div>
            </div>
            
            <div>
              <Label htmlFor="action-filter" className="text-xs">Ação</Label>
              <Select value={actionFilter} onValueChange={(v) => { setActionFilter(v); handleFilterChange(); }}>
                <SelectTrigger className="h-8 text-sm bg-input border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {uniqueActions.map((action) => (
                    <SelectItem key={action} value={action}>{action}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="item-type-filter" className="text-xs">Tipo</Label>
              <Select value={itemTypeFilter} onValueChange={(v) => { setItemTypeFilter(v); handleFilterChange(); }}>
                <SelectTrigger className="h-8 text-sm bg-input border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {uniqueItemTypes.map((itemType) => (
                    <SelectItem key={itemType} value={itemType}>{itemType}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-card border-border">
        <CardHeader className="py-3 px-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">
              Logs ({filteredLogs.length} registros)
            </CardTitle>
            {totalPages > 1 && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span>Página {currentPage} de {totalPages}</span>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted">
                <TableRow>
                  <TableHead className="py-2 text-xs font-medium w-[140px]">Data/Hora</TableHead>
                  <TableHead className="py-2 text-xs font-medium w-[160px]">Usuário</TableHead>
                  <TableHead className="py-2 text-xs font-medium w-[180px]">Ação</TableHead>
                  <TableHead className="py-2 text-xs font-medium w-[80px]">Tipo</TableHead>
                  <TableHead className="py-2 text-xs font-medium w-[100px]">Item ID</TableHead>
                  <TableHead className="py-2 text-xs font-medium">Detalhes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedLogs.map((log) => (
                  <TableRow key={log.id} className="hover:bg-muted/30">
                    <TableCell className="py-1.5 px-3">
                      <span className="text-xs font-mono">{formatDateTime(log.createdAt!)}</span>
                    </TableCell>
                    <TableCell className="py-1.5 px-3">
                      <span className="text-xs">{getUserName(log.userId)}</span>
                    </TableCell>
                    <TableCell className="py-1.5 px-3">
                      <span className="text-xs">{log.action}</span>
                    </TableCell>
                    <TableCell className="py-1.5 px-3">
                      <span className="text-xs text-muted-foreground">{log.itemType}</span>
                    </TableCell>
                    <TableCell className="py-1.5 px-3">
                      <span className="text-xs font-mono text-muted-foreground">{log.itemId || "-"}</span>
                    </TableCell>
                    <TableCell className="py-1.5 px-3">
                      <span className="text-xs text-muted-foreground line-clamp-1">{log.details || "-"}</span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          
          {filteredLogs.length === 0 && (
            <div className="text-center py-6 text-sm text-muted-foreground">
              {searchTerm || actionFilter !== "all" || itemTypeFilter !== "all" 
                ? "Nenhum log encontrado com os filtros aplicados" 
                : "Nenhum log registrado"}
            </div>
          )}

          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t">
              <div className="text-xs text-muted-foreground">
                Exibindo {((currentPage - 1) * ITEMS_PER_PAGE) + 1} - {Math.min(currentPage * ITEMS_PER_PAGE, filteredLogs.length)} de {filteredLogs.length}
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 px-2"
                  onClick={() => handlePageChange(1)}
                  disabled={currentPage === 1}
                >
                  Primeira
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 w-7 p-0"
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft size={14} />
                </Button>
                
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum;
                  if (totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (currentPage <= 3) {
                    pageNum = i + 1;
                  } else if (currentPage >= totalPages - 2) {
                    pageNum = totalPages - 4 + i;
                  } else {
                    pageNum = currentPage - 2 + i;
                  }
                  return (
                    <Button
                      key={pageNum}
                      variant={currentPage === pageNum ? "default" : "outline"}
                      size="sm"
                      className="h-7 w-7 p-0 text-xs"
                      onClick={() => handlePageChange(pageNum)}
                    >
                      {pageNum}
                    </Button>
                  );
                })}

                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 w-7 p-0"
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage === totalPages}
                >
                  <ChevronRight size={14} />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 px-2"
                  onClick={() => handlePageChange(totalPages)}
                  disabled={currentPage === totalPages}
                >
                  Última
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
