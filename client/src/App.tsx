import { Switch, Route, useLocation, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppProvider } from "./context/AppContext";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { AuthorizationProvider, useAuthorization } from "./context/AuthorizationContext";
import { SettingsProvider } from "./context/SettingsContext";
import Layout from "./components/Layout";
import Dashboard from "./pages/Dashboard";
import Orders from "@/pages/Orders";
import Approvals from "./pages/Approvals";
import Reprogramacoes from "./pages/Reprogramacoes";
import PurchaseOrders from "./pages/OrdensCompra";
import Companies from "./pages/Companies";
import Users from "./pages/Users";
import Products from "./pages/Products";
import Keyuser from "./pages/Keyuser";
import Logs from "./pages/Logs";
import PrevisaoRecebimento from "./pages/PrevisaoRecebimento";

import Login from "./pages/Login";
import NotFound from "@/pages/not-found";
import FirstPasswordChange from "./pages/FirstPasswordChange";

// Componente para proteger rotas privadas com verificação de permissões
const ProtectedRoute = ({ 
  component: Component, 
  area, 
  requireEdit = false, 
  ...rest 
}: { 
  component: React.ComponentType<any>, 
  area?: string,
  requireEdit?: boolean,
  path?: string 
}) => {
  const { isAuthenticated, isLoading } = useAuth();
  const { canView, canEdit } = useAuthorization();
  const [location] = useLocation();

  if (isLoading) {
    // Pode mostrar tela de carregamento enquanto verifica autenticação
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-2"></div>
          <p>Carregando...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    // Garantir que o redirecionamento funcione em produção
    if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
      window.location.href = `/login?redirect=${encodeURIComponent(location)}`;
      return null;
    }
    return <Redirect to={`/login?redirect=${encodeURIComponent(location)}`} />;
  }

  // Se for especificada uma área, verificar permissões
  if (area) {
    if (requireEdit && !canEdit(area)) {
      // Não tem permissão de edição para esta área
      return (
        <Layout>
          <div className="flex flex-col items-center justify-center p-8 text-center min-h-[60vh]">
            <h1 className="text-2xl font-bold mb-4">Acesso Restrito</h1>
            <p className="text-muted-foreground max-w-md mb-6">
              Você não tem permissão para editar conteúdo nesta área. Entre em contato com um administrador caso necessite de acesso.
            </p>
          </div>
        </Layout>
      );
    } else if (!canView(area)) {
      // Não tem permissão de visualização para esta área
      return (
        <Layout>
          <div className="flex flex-col items-center justify-center p-8 text-center min-h-[60vh]">
            <h1 className="text-2xl font-bold mb-4">Acesso Restrito</h1>
            <p className="text-muted-foreground max-w-md mb-6">
              Você não tem permissão para acessar esta área do sistema. Entre em contato com um administrador caso necessite de acesso.
            </p>
          </div>
        </Layout>
      );
    }
  }

  // Tem permissão, renderizar normalmente
  return <Component {...rest} />;
};

function Router() {
  const { isAuthenticated } = useAuth();

  // Componente para envolver rotas protegidas com Layout
  const LayoutWrapper = ({ children, area, requireEdit = false }: { children: React.ReactNode, area?: string, requireEdit?: boolean }) => {
    return (
      <Layout>
        {children}
      </Layout>
    );
  };

  return (
    <Switch>
      <Route path="/login">
        {isAuthenticated ? <Redirect to="/" /> : <Login />}
      </Route>

      <Route path="/first-password-change">
        <FirstPasswordChange />
      </Route>

      {/* Rotas Protegidas com verificação de permissões */}
      {/* Rota raiz com proteção de autenticação */}
      <Route path="/">
        <ProtectedRoute 
          component={() => (
            <Layout>
              <Dashboard />
            </Layout>
          )}
          area="dashboard"
        />
      </Route>

      {/* Pedidos - Requer permissão de 'orders' */}
      <Route path="/pedidos">
        <ProtectedRoute 
          component={() => (
            <Layout>
              <Orders />
            </Layout>
          )}
          area="orders"
        />
      </Route>

      {/* Previsão de Recebimento - Requer permissão de 'orders' */}
      <Route path="/previsao-recebimento">
        <ProtectedRoute 
          component={() => (
            <Layout>
              <PrevisaoRecebimento />
            </Layout>
          )}
          area="orders"
        />
      </Route>

      {/* Aprovações - Requer permissão de 'approvals' */}
      <Route path="/aprovacoes">
        <ProtectedRoute 
          component={() => (
            <Layout>
              <Approvals />
            </Layout>
          )}
          area="approvals"
        />
      </Route>

       {/* Reprogramações - Requer permissão de 'reprogramacoes' */}
       <Route path="/reprogramacoes">
        <ProtectedRoute 
          component={() => (
            <Layout>
              <Reprogramacoes />
            </Layout>
          )}
          area="reprogramacoes"
        />
      </Route>

      {/* Ordens de Compra - Requer permissão de 'purchase_orders' */}
      <Route path="/ordens-compra">
        <ProtectedRoute 
          component={() => (
            <Layout>
              <PurchaseOrders />
            </Layout>
          )}
          area="purchase_orders"
        />
      </Route>

      {/* Empresas - Requer permissão de 'companies' */}
      <Route path="/empresas">
        <ProtectedRoute 
          component={() => (
            <Layout>
              <Companies />
            </Layout>
          )}
          area="companies"
        />
      </Route>

      {/* Usuários - Requer permissão de 'users' */}
      <Route path="/usuarios">
        <ProtectedRoute 
          component={() => (
            <Layout>
              <Users />
            </Layout>
          )}
          area="users"
        />
      </Route>

      {/* Produtos - Requer permissão de 'products' */}
      <Route path="/produtos">
        <ProtectedRoute 
          component={() => (
            <Layout>
              <Products />
            </Layout>
          )}
          area="products"
        />
      </Route>

      {/* Desenvolvedor - Acesso especial para keyuser */}
      <Route path="/dev">
        {isAuthenticated ? (
          <Layout>
            <Keyuser />
          </Layout>
        ) : (
          <Redirect to="/login" />
        )}
      </Route>

      {/* Logs/Relatórios - Requer permissão de 'logs' */}
      <Route path="/logs">
        <ProtectedRoute 
          component={() => (
            <Layout>
              <Logs />
            </Layout>
          )}
          area="logs"
        />
      </Route>

      {/* Configurações - Requer permissão de 'settings' */}
      <Route path="/configuracoes">
        <ProtectedRoute 
          component={() => (
            <Layout>
              <Settings />
            </Layout>
          )}
          area="settings"
        />
      </Route>

      {/* Rota para página não encontrada */}
      <Route>
        <ProtectedRoute 
          component={() => (
            <Layout>
              <NotFound />
            </Layout>
          )}
        />
      </Route>
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <AuthorizationProvider>
            <AppProvider>
              <SettingsProvider>
                <Toaster />
                <Router />
              </SettingsProvider>
            </AppProvider>
          </AuthorizationProvider>
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;