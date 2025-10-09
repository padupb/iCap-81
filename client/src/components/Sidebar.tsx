import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";
import { useAuthorization } from "@/context/AuthorizationContext";
import { useSettings } from "@/context/SettingsContext";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { QRCodeComponent } from "./QRCodeComponent";
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
  Smartphone,
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
  { name: "Keyuser", href: "/dev", icon: Code, area: null }, // Acesso especial, mostrado apenas para keyuser
  { name: "Logs do Sistema", href: "/logs", icon: History, area: "logs" },
];

export default function Sidebar() {
  const [location] = useLocation();
  const { user } = useAuth();
  const { canView } = useAuthorization();
  const { settings } = useSettings();
  const [showQRModal, setShowQRModal] = useState(false);

  // Buscar reprogramações pendentes para mostrar o badge
  const { data: reprogramacoes = [] } = useQuery({
    queryKey: ["/api/orders/reprogramacoes"],
    enabled: canView("reprogramacoes"),
  });

  return (
    <div className="w-60 border-r border-sidebar-border flex flex-col relative z-40">
      {/* Logo/Header */}
      <div className="px-4 py-4 border-b border-sidebar-border bg-[#26262c] flex justify-center items-center min-h-[96px]">
        <Link href="/">
          {settings.logoUrl && settings.logoUrl.trim() !== "" ? (
            <img
              src={settings.logoUrl}
              alt={settings.appName || 'iCap'}
              className="w-[140px] h-[60px] object-contain cursor-pointer hover:opacity-80 transition-opacity"
              onError={(e) => {
                // Se houver erro ao carregar a logo, esconder a imagem e mostrar o texto
                e.currentTarget.style.display = 'none';
                const parent = e.currentTarget.parentElement;
                if (parent && !parent.querySelector('h1')) {
                  const fallbackText = document.createElement('h1');
                  fallbackText.className = "text-xl font-semibold text-white cursor-pointer hover:text-primary transition-colors";
                  fallbackText.textContent = settings.appName || 'i-CAP 5.0';
                  parent.appendChild(fallbackText);
                }
              }}
            />
          ) : (
            <h1 className="text-xl font-semibold text-white cursor-pointer hover:text-primary transition-colors">
              {settings.appName || 'i-CAP 5.0'}
            </h1>
          )}
        </Link>
      </div>
      {/* Navigation Menu */}
      <nav className="flex-1 px-4 py-6 space-y-2">
        {navigation.map((item) => {
          const isActive = location === item.href;
          const Icon = item.icon;

          // Mostrar item do menu apenas se:
          // 1. É a página do Keyuser, mostrada apenas para keyuser
          // 2. Ou o usuário tem permissão de visualização para a área
          const isDeveloperItem = item.href === '/dev';

          // Se é item do dev, mostrar apenas para keyuser (isKeyUser)
          // Para outros itens, verificar permissões normalmente
          const canShowItem = isDeveloperItem 
            ? user?.isKeyUser 
            : (item.area && canView(item.area));

          // Não renderizar se o usuário não tem permissão para ver este item
          if (!canShowItem) return null;

          return (
            <div key={item.name}>
              <Link href={item.href}>
                <div
                  className={cn(
                    "flex items-center justify-between px-4 py-3 rounded-lg transition-colors cursor-pointer",
                    isActive
                      ? "bg-sidebar-primary text-white"
                      : "text-sidebar-foreground hover:bg-gray-700"
                  )}
                >
                  <div className="flex items-center">
                    <Icon className="w-5 h-5 mr-3" />
                    {item.name}
                  </div>
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
      </nav>

      {/* iCapMob - Transporte no rodapé */}
      <div className="mt-auto p-4">
        <div
          onClick={() => setShowQRModal(true)}
          className="flex items-center px-4 py-3 rounded-lg transition-colors cursor-pointer text-sidebar-foreground hover:bg-gray-700"
        >
          <Smartphone className="w-5 h-5 mr-3" />
          iCapMob - Transporte
        </div>
      </div>

      {/* Modal com QR Code */}
      <Dialog open={showQRModal} onOpenChange={setShowQRModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-center">iCapMob - Transporte</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center space-y-4 p-6">
            <QRCodeComponent 
              value={`${window.location.origin}/icapmob/icapmob.apk`}
              size={200}
              className="mb-4"
            />
            <p className="text-sm text-muted-foreground text-center">
              Escaneie o QR Code para baixar o aplicativo iCapMob
            </p>
            <div className="text-xs text-muted-foreground text-center">
              <p>URL: {window.location.origin}/icapmob/icapmob.apk</p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}