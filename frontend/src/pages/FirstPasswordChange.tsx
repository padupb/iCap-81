
import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/AuthContext';

export default function FirstPasswordChange() {
  const [formData, setFormData] = useState({
    newPassword: '',
    confirmPassword: ''
  });
  const [isLoading, setIsLoading] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const { toast } = useToast();
  const { user, logout } = useAuth();
  const [, setLocation] = useLocation();

  // Buscar informações do usuário logado
  useEffect(() => {
    const fetchUserInfo = async () => {
      try {
        const response = await fetch('/api/auth/me', {
          credentials: 'include'
        });
        
        if (response.ok) {
          const data = await response.json();
          if (data.success && data.user) {
            setCurrentUser(data.user);
            console.log("👤 Usuário identificado na tela de alteração de senha:", data.user);
          }
        }
      } catch (error) {
        console.error("Erro ao buscar informações do usuário:", error);
      }
    };

    // Usar o usuário do contexto se disponível, senão buscar via API
    if (user) {
      setCurrentUser(user);
      console.log("👤 Usuário do contexto:", user);
    } else {
      fetchUserInfo();
    }
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    console.log("🔄 Iniciando alteração de senha...");
    console.log("👤 Usuário do contexto:", user);
    console.log("👤 Usuário atual:", currentUser);
    console.log("📝 Dados do formulário:", {
      newPasswordLength: formData.newPassword?.length,
      confirmPasswordLength: formData.confirmPassword?.length,
      passwordsMatch: formData.newPassword === formData.confirmPassword
    });

    // Validações básicas
    if (!formData.newPassword || formData.newPassword.trim() === "") {
      toast({
        title: "Erro",
        description: "Nova senha é obrigatória",
        variant: "destructive"
      });
      return;
    }

    if (!formData.confirmPassword || formData.confirmPassword.trim() === "") {
      toast({
        title: "Erro",
        description: "Confirmação de senha é obrigatória",
        variant: "destructive"
      });
      return;
    }

    if (formData.newPassword !== formData.confirmPassword) {
      toast({
        title: "Erro",
        description: "As senhas não coincidem",
        variant: "destructive"
      });
      return;
    }

    if (formData.newPassword.length < 6) {
      toast({
        title: "Erro", 
        description: "A senha deve ter pelo menos 6 caracteres",
        variant: "destructive"
      });
      return;
    }

    // Usar currentUser ou user como fallback
    const activeUser = currentUser || user;
    
    if (!activeUser?.id) {
      toast({
        title: "Erro",
        description: "Usuário não identificado. Faça login novamente.",
        variant: "destructive"
      });
      // Redirecionar para login se não conseguir identificar o usuário
      setLocation('/login');
      return;
    }

    setIsLoading(true);

    try {
      const requestData = {
        userId: activeUser.id,
        newPassword: formData.newPassword.trim(),
        confirmPassword: formData.confirmPassword.trim()
      };

      console.log("📤 Enviando dados:", {
        userId: requestData.userId,
        userName: activeUser.name,
        newPasswordLength: requestData.newPassword.length,
        confirmPasswordLength: requestData.confirmPassword.length
      });

      const response = await fetch('/api/auth/change-first-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData),
      });

      console.log("📥 Resposta recebida:", response.status);

      const data = await response.json();
      console.log("📋 Dados da resposta:", data);

      if (data.success) {
        toast({
          title: "Sucesso",
          description: "Senha alterada com sucesso! Faça login novamente."
        });
        
        // Fazer logout e redirecionar para login
        await logout();
        setLocation('/login');
      } else {
        toast({
          title: "Erro",
          description: data.message || "Erro ao alterar senha",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error("❌ Erro na requisição:", error);
      toast({
        title: "Erro",
        description: "Erro de comunicação com o servidor",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Alterar Senha</CardTitle>
          <CardDescription>
            É necessário alterar sua senha no primeiro acesso
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="newPassword">Nova Senha</Label>
              <Input
                id="newPassword"
                type="password"
                value={formData.newPassword}
                onChange={(e) => setFormData(prev => ({ ...prev, newPassword: e.target.value }))}
                placeholder="Digite sua nova senha"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirmar Nova Senha</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={formData.confirmPassword}
                onChange={(e) => setFormData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                placeholder="Confirme sua nova senha"
                required
              />
            </div>

            <Button 
              type="submit" 
              className="w-full" 
              disabled={isLoading}
            >
              {isLoading ? 'Salvando...' : 'Salvar Nova Senha'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
