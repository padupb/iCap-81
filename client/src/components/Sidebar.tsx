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
  Code,
  History,
  Settings
} from "lucide-react";

const navigation = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard, area: "dashboard" },
  { name: "Pedidos", href: "/pedidos", icon: ShoppingCart, area: "orders" },
  { name: "Aprovações", href: "/aprovacoes", icon: CheckCircle, area: "approvals" },
  { name: "Ordens de Compra", href: "/ordens-compra", icon: FileText, area: "purchase_orders" },
  { name: "Empresas", href: "/empresas", icon: Building, area: "companies" },
  { name: "Usuários", href: "/usuarios", icon: Users, area: "users" },
  { name: "Produtos", href: "/produtos", icon: Package, area: "products" },
  { name: "Keyuser", href: "/dev", icon: Code, area: null }, // Acesso especial, mostrado apenas para keyuser
  { name: "Logs do Sistema", href: "/logs", icon: History, area: "logs" },
];

export default function Sidebar() {
  const [location] = useLocation();
  const { user } = useAuth();
  const { canView } = useAuthorization();
  const { settings } = useSettings();

  console.log("🎨 [Sidebar] Renderizando sidebar para usuário:", {
    userId: user?.id,
    name: user?.name,
    isKeyUser: user?.isKeyUser,
    permissions: user?.permissions
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
              className="w-[140px] h-[60px] object-contain cursor-pointer hover:opacity-80 transition-opacity"
              onError={(e) => {
                // Fallback para texto se a imagem falhar
                e.currentTarget.style.display = 'none';
                const fallback = document.createElement('h1');
                fallback.className = "text-xl font-semibold text-white cursor-pointer hover:text-primary transition-colors";
                fallback.textContent = settings.appName || 'iCAP7';
                e.currentTarget.parentNode?.appendChild(fallback);
              }}
            />
          ) : (
            <h1 className="text-xl font-semibold text-white cursor-pointer hover:text-primary transition-colors">
              {settings.appName || 'iCAP7'}
            </h1>
          )}
        </Link>
      </div>
      {/* Navigation Menu */}
      <nav className="flex-1 px-4 py-6 sspace-y-2 bg-[#19191f]">
        {navigation.map((item) => {
          const isActive = location === item.href;
          const Icon = item.icon;
          
          // Mostrar item do menu apenas se:
          // 1. É a página do Keyuser, mostrada apenas para keyuser
          // 2. Ou o usuário tem permissão de visualização para a área
          const isDeveloperItem = item.href === '/dev';
          
          console.log(`🔍 [Sidebar] Verificando item ${item.name}:`, {
            isDeveloperItem,
            area: item.area,
            userIsKeyUser: user?.isKeyUser,
            userId: user?.id
          });
          
          // Se é item do dev, mostrar apenas para keyuser (isKeyUser) ou usuário ID = 1
          // Para outros itens, verificar permissões normalmente
          let canShowItem = false;
          
          if (isDeveloperItem) {
            // Menu KeyUser: só para keyuser ou ID = 1
            canShowItem = user?.isKeyUser === true || user?.id === 1;
            console.log(`🔑 [Sidebar] Item KeyUser - canShowItem: ${canShowItem} (isKeyUser: ${user?.isKeyUser}, id: ${user?.id})`);
          } else if (item.area) {
            // Outros menus: verificar permissões
            canShowItem = canView(item.area);
            console.log(`📋 [Sidebar] Item ${item.name} (${item.area}) - canShowItem: ${canShowItem}`);
          } else {
            // Item sem área definida - não mostrar
            canShowItem = false;
            console.log(`❓ [Sidebar] Item ${item.name} sem área definida - não mostrando`);
          }
          
          // Não renderizar se o usuário não tem permissão para ver este item
          if (!canShowItem) {
            console.log(`❌ [Sidebar] Ocultando item ${item.name}`);
            return null;
          }
          
          console.log(`✅ [Sidebar] Mostrando item ${item.name}`);
          
          return (
            <div key={item.name}>
              <Link href={item.href}>
                <div
                  className={cn(
                    "flex items-center px-4 py-3 rounded-lg transition-colors cursor-pointer",
                    isActive
                      ? "bg-sidebar-primary text-white"
                      : "text-sidebar-foreground hover:bg-gray-700"
                  )}
                >
                  <Icon className="w-5 h-5 mr-3" />
                  {item.name}
                </div>
              </Link>
            </div>
          );
        })}
      </nav>
    </div>
  );
}
