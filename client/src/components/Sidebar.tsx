import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";
import { useAuthorization } from "@/context/AuthorizationContext";
import { useSettings } from "@/context/SettingsContext";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { UserMenu } from "./UserMenu";
import {
  LayoutDashboard,
  ShoppingCart,
  CheckCircle,
  FileText,
  Building,
  Users,
  Package,
  Code,
  History,
  Settings,
  Calendar,
} from "lucide-react";

const navigation = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard, area: "dashboard" },
  { name: "Pedidos", href: "/pedidos", icon: ShoppingCart, area: "orders" },
  { name: "Aprovações", href: "/aprovacoes", icon: CheckCircle, area: "approvals" },
  { name: "Reprogramações", href: "/reprogramacoes", icon: Calendar, area: "reprogramacoes" },
  { name: "Ordens de Compra", href: "/ordens-compra", icon: FileText, area: "purchase_orders" },
  { name: "Empresas", href: "/empresas", icon: Building, area: "companies" },
  { name: "Usuários", href: "/usuarios", icon: Users, area: "users" },
  { name: "Produtos", href: "/produtos", icon: Package, area: "products" },
  { name: "Logs do Sistema", href: "/logs", icon: History, area: "logs" },
];

export default function Sidebar() {
  const [location] = useLocation();
  const { user } = useAuth();
  const { canView } = useAuthorization();
  const { settings } = useSettings();
  const [logoError, setLogoError] = useState(false);

  // Buscar reprogramações pendentes para mostrar o badge
  const { data: reprogramacoes = [] } = useQuery({
    queryKey: ["/api/orders/reprogramacoes"],
    enabled: canView("reprogramacoes"),
  });

  // Buscar aprovações pendentes (pedidos urgentes) para mostrar o badge
  const { data: aprovacoesPendentes = [] } = useQuery<any[]>({
    queryKey: ["/api/orders/urgent"],
    enabled: canView("approvals"),
  });

  return (
    <div className="w-60 border-r border-sidebar-border flex flex-col relative z-40">
      {/* Logo/Header */}
      <div className="px-4 py-4 border-b border-sidebar-border bg-[#26262c] flex justify-center items-center min-h-[96px]">
        <Link href="/">
          <img
            src={settings.logoUrl || "/public/uploads/logo.png"}
            alt={settings.appName || 'iCap'}
            className="w-[140px] h-[60px] object-contain cursor-pointer hover:opacity-80 transition-opacity"
            onError={(e) => {
              const img = e.currentTarget as HTMLImageElement;
              if (img.src !== "/public/uploads/logo.png") {
                img.src = "/public/uploads/logo.png";
              } else {
                setLogoError(true);
              }
            }}
          />
          {logoError && (
            <h1 className="text-xl font-semibold text-white cursor-pointer hover:text-primary transition-colors">
              {settings.appName || 'i-CAP 5.0'}
            </h1>
          )}
        </Link>
      </div>
      {/* Navigation Menu */}
      <nav className="flex-1 px-4 py-6 space-y-2 bg-[#26262c] overflow-y-auto">
        {navigation.map((item) => {
          const isActive = location === item.href;
          const Icon = item.icon;

          const canShowItem = item.area && canView(item.area);

          if (!canShowItem) return null;

          return (
            <div key={item.name}>
              <Link href={item.href}>
                <div
                  className="flex items-center justify-between px-4 py-3 rounded-lg transition-colors cursor-pointer text-sidebar-foreground hover:bg-gray-700 pt-[8px] pb-[8px]"
                >
                  <div className="flex items-center">
                    <Icon className="w-5 h-5 mr-3" />
                    {item.name}
                  </div>
                  {item.name === "Aprovações" && aprovacoesPendentes.length > 0 && (
                    <Badge 
                      variant="secondary" 
                      className="text-[10px] bg-orange-500 text-white border-orange-500 ml-2 px-1.5 py-0.5 h-4 min-w-4 rounded-full font-bold"
                    >
                      {aprovacoesPendentes.length}
                    </Badge>
                  )}
                  {item.name === "Reprogramações" && reprogramacoes.length > 0 && (
                    <Badge 
                      variant="secondary" 
                      className="text-[10px] bg-red-600 text-white border-red-600 ml-2 px-1.5 py-0.5 h-4 min-w-4 rounded-full font-bold"
                    >
                      {reprogramacoes.length}
                    </Badge>
                  )}
                </div>
              </Link>
            </div>
          );
        })}

        {/* Menu Keyuser - apenas para KeyUsers */}
        {user?.isKeyUser && (
          <Link href="/dev">
            <div className="flex items-center px-4 py-3 rounded-lg transition-colors cursor-pointer text-sidebar-foreground hover:bg-gray-700 pt-[8px] pb-[8px]">
              <Code className="w-5 h-5 mr-3" />
              Keyuser
            </div>
          </Link>
        )}
      </nav>
      {/* User Menu at the bottom */}
      <div className="mt-auto p-4 border-t border-sidebar-border bg-[#26262c]">
        <UserMenu />
      </div>
    </div>
  );
}