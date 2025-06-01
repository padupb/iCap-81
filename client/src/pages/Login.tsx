import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import { useSettings } from "@/context/SettingsContext";

// Definir esquema de validação para o formulário de login
// Com regra especial para permitir o keyuser "padupb"
const loginSchema = z.object({
  email: z.string()
    .min(1, "E-mail é obrigatório")
    .refine((value) => {
      // Permitir acesso ao super administrador com email específico ou qualquer email válido
      return value === "padupb@admin.icap" || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
    }, "E-mail inválido"),
  password: z.string()
    .min(1, "Senha é obrigatória")
});

type LoginFormData = z.infer<typeof loginSchema>;

export default function Login() {
  const [isLoading, setIsLoading] = useState(false);
  const [keepConnected, setKeepConnected] = useState(false);
  const [, navigate] = useLocation();
  const { settings } = useSettings();

  // Configurar o formulário com react-hook-form e zod
  const form = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: ""
    }
  });

  // Carregar credenciais salvas ao montar o componente
  useEffect(() => {
    const savedCredentials = localStorage.getItem('loginCredentials');
    if (savedCredentials) {
      try {
        const { email, password } = JSON.parse(savedCredentials);
        form.setValue('email', email);
        form.setValue('password', password);
        setKeepConnected(true);
      } catch (error) {
        // Se houver erro ao parsear, limpar o localStorage
        localStorage.removeItem('loginCredentials');
      }
    }
  }, [form]);

  // Função para lidar com o envio do formulário
  const onSubmit = async (data: LoginFormData) => {
    setIsLoading(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(data),
        credentials: "include" // Importante para a sessão ser mantida
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.message || "Falha na autenticação");
      }

      // Gerenciar credenciais salvas
      if (keepConnected) {
        localStorage.setItem('loginCredentials', JSON.stringify({
          email: data.email,
          password: data.password
        }));
      } else {
        localStorage.removeItem('loginCredentials');
      }

      // Buscar os dados do usuário para confirmar autenticação
      await fetch("/api/auth/me", { credentials: "include" });

      toast({
        title: "Login realizado com sucesso",
        description: "Você será redirecionado para o dashboard"
      });

      // Adicionar um pequeno atraso para garantir que a sessão seja estabelecida
      setTimeout(() => {
        // Navegar para o dashboard
        navigate("/", { replace: true });
        // Forçar um recarregamento da página para garantir que todos os componentes reconheçam o estado de autenticação
        window.location.reload();
      }, 500);
    } catch (error) {
      toast({
        title: "Erro ao realizar login",
        description: error instanceof Error ? error.message : "Credenciais inválidas",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = () => {
    toast({
      title: "Esqueci minha senha",
      description: "Entre em contato com o administrador da conta e solicite a restauração da senha.",
      duration: 5000
    });
  };

  return (
    <div className="flex justify-center items-center min-h-screen bg-muted/50">
      <Card className="w-full max-w-md shadow-lg border-border bg-card">
        <CardHeader className="space-y-4 text-center">
          {/* Logo */}
          {settings.logoUrl && (
            <div className="flex justify-center">
              <img
                src={settings.logoUrl}
                alt="Logo"
                className="w-[180px] h-[150px] object-contain"
                onError={(e) => {
                  // Ocultar imagem se houver erro no carregamento
                  e.currentTarget.style.display = 'none';
                }}
              />
            </div>
          )}
        </CardHeader>

        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>E-mail</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Digite seu email"
                        type="text"
                        autoComplete="email"
                        className="bg-input border-border"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Senha</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="••••••••"
                        type="password"
                        autoComplete="current-password"
                        className="bg-input border-border"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Checkbox para manter conectado */}
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="keep-connected"
                  checked={keepConnected}
                  onCheckedChange={(checked) => setKeepConnected(checked as boolean)}
                />
                <label
                  htmlFor="keep-connected"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                >
                  Manter conectado
                </label>
              </div>

              <Button 
                type="submit" 
                className="w-full bg-primary hover:bg-primary/90" 
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Entrando...
                  </>
                ) : (
                  "Entrar"
                )}
              </Button>

            </form>
          </Form>
        </CardContent>

        <CardFooter className="flex justify-center border-t border-border pt-4">
          <p className="text-sm text-muted-foreground">
            Sistema de Gestão Logística {settings.appName}
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}