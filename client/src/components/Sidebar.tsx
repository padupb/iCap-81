import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";
import { useAuthorization } from "@/context/AuthorizationContext";
import { useSettings } from "@/context/SettingsContext";
import {
  LayoutDashboard,
  ShoppingCart,
  CheckCircle,
  FileText,
  Building,
  Users,
  Package,
  Settings,
  BarChart3,
  Activity,
  Key
} from "lucide-react";

interface SidebarItemProps {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  isActive: boolean;
}

function SidebarItem({ href, icon: Icon, label, isActive }: SidebarItemProps) {
  return (
    <Link href={href}>
      <div
        className={cn(
          "flex items-center px-4 py-3 rounded-lg transition-colors cursor-pointer",
          isActive
            ? "bg-sidebar-primary text-white"
            : "text-sidebar-foreground hover:bg-gray-700"
        )}
      >
        <Icon className="w-5 h-5 mr-3" />
        {label}
      </div>
    </Link>
  );
}

export default function Sidebar() {
  const [location] = useLocation();
  const { user } = useAuth();
  const { canView } = useAuthorization();
  const { settings } = useSettings();

  console.log("🎨 [Sidebar] Renderizando sidebar para usuário:", {
    userId: user?.id,
    name: user?.name,
    isKeyUser: user?.isKeyUser,
    roleName: user?.role?.name,
    permissions: user?.permissions || user?.role?.permissions
  });

  return (
    <div className="w-60 bg-sidebar border-r border-sidebar-border flex flex-col relative z-40">
      {/* Logo/Header */}
      <div className="px-4 py-4 border-b border-sidebar-border bg-[#26262c] flex justify-center items-center min-h-[96px]">
        <Link href="/">
          {settings.logoUrl ? (
            <img
              src={settings.logoUrl}
              alt="Logo"
              className="w-[140px] h-auto object-contain"
            />
          ) : (
            <div className="text-white text-xl font-bold">i-CAP 7.0</div>
          )}
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-4 py-4 space-y-1">
        {/* Dashboard - sempre visível para usuários autenticados */}
        {user && canView("dashboard") && (
          <SidebarItem
            href="/"
            icon={LayoutDashboard}
            label="Dashboard"
            isActive={location === "/"}
          />
        )}

        {/* Pedidos */}
        {user && canView("orders") && (
          <SidebarItem
            href="/orders"
            icon={ShoppingCart}
            label="Pedidos"
            isActive={location === "/orders"}
          />
        )}

        {/* Aprovações */}
        {user && canView("approvals") && (
          <SidebarItem
            href="/approvals"
            icon={CheckCircle}
            label="Aprovações"
            isActive={location === "/approvals"}
          />
        )}

        {/* Ordens de Compra */}
        {user && canView("purchase_orders") && (
          <SidebarItem
            href="/purchase-orders"
            icon={FileText}
            label="Ordens de Compra"
            isActive={location === "/purchase-orders"}
          />
        )}

        {/* Empresas */}
        {user && canView("companies") && (
          <SidebarItem
            href="/companies"
            icon={Building}
            label="Empresas"
            isActive={location === "/companies"}
          />
        )}

        {/* Usuários */}
        {user && canView("users") && (
          <SidebarItem
            href="/users"
            icon={Users}
            label="Usuários"
            isActive={location === "/users"}
          />
        )}

        {/* Produtos */}
        {user && canView("products") && (
          <SidebarItem
            href="/products"
            icon={Package}
            label="Produtos"
            isActive={location === "/products"}
          />
        )}

        {/* Relatórios */}
        {user && canView("reports") && (
          <SidebarItem
            href="/reports"
            icon={BarChart3}
            label="Relatórios"
            isActive={location === "/reports"}
          />
        )}

        {/* Configurações */}
        {user && canView("settings") && (
          <SidebarItem
            href="/settings"
            icon={Settings}
            label="Configurações"
            isActive={location === "/settings"}
          />
        )}

        {/* Logs */}
        {user && canView("logs") && (
          <SidebarItem
            href="/logs"
            icon={Activity}
            label="Logs"
            isActive={location === "/logs"}
          />
        )}

        {/* KeyUser - REGRA ESPECIAL: Só para KeyUser (ID = 9999) ou usuário ID = 1 */}
        {user && (user.id === 9999 || user.id === 1 || user.isKeyUser) && (
          <SidebarItem
            href="/keyuser"
            icon={Key}
            label="KeyUser"
            isActive={location === "/keyuser"}
          />
        )}
      </nav>
    </div>
  );
}
