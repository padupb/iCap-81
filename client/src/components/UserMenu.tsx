import { useState, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/context/AuthContext";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { LogOut, User, Key } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export function UserMenu() {
  const { user, logout } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  // Função para obter as iniciais do nome do usuário
  const getInitials = (name: string | undefined) => {
    if (!name) return "US";

    return name
      .split(' ')
      .map(part => part[0])
      .join('')
      .toUpperCase()
      .substring(0, 2);
  };

  // Fechar o menu quando clicar fora dele
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [menuRef]);

  // Definir cargo/função do usuário
  const role = user?.role?.name || (user?.isKeyUser ? "Super Administrador" : "Usuário");

  const handleChangePassword = () => {
    try {
      if (!user?.id) {
        toast({
          title: "Erro",
          description: "Usuário não identificado",
          variant: "destructive"
        });
        return;
      }

      console.log("🔄 Redirecionando para alteração de senha:", user.id);
      
      // Fechar o menu
      setIsOpen(false);
      
      // Redirecionar diretamente para a página de alteração de senha
      setLocation('/first-password-change');
      
    } catch (error) {
      console.error("❌ Erro ao redirecionar:", error);
      toast({
        title: "Erro",
        description: "Erro ao acessar página de alteração de senha",
        variant: "destructive"
      });
    }
  };


  return (
    <div className="relative" ref={menuRef}>
      {/* Botão do avatar */}
      <div 
        className="flex items-center gap-3 cursor-pointer rounded-full px-2 py-1 hover:bg-accent transition-colors"
        onClick={() => setIsOpen(!isOpen)}
      >
        <Avatar className="h-8 w-8 bg-primary text-primary-foreground cursor-pointer">
          <AvatarFallback className="bg-primary text-primary-foreground font-medium">
            {getInitials(user?.name)}
          </AvatarFallback>
        </Avatar>

        <div className="hidden md:block text-left">
          <p className="text-sm font-medium">{user?.name || "Usuário"}</p>
          <p className="text-xs text-muted-foreground">{role}</p>
        </div>
      </div>

      {/* Menu dropdown */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-56 z-50 rounded-md shadow-lg bg-card border border-border overflow-hidden">
          <div className="flex items-center justify-start gap-2 p-3">
            <div className="bg-primary text-primary-foreground p-1 rounded-full">
              <User className="h-4 w-4" />
            </div>
            <div>
              <p className="text-sm font-medium">{user?.name || "Usuário"}</p>
              <p className="text-xs text-muted-foreground">{role}</p>
            </div>
          </div>

          <div className="border-t border-border">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <button className="w-full text-left px-3 py-2 text-sm hover:bg-accent flex items-center gap-2">
                  <Key className="mr-2 h-4 w-4" />
                  <span>Alterar senha</span>
                </button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Alterar senha</AlertDialogTitle>
                  <AlertDialogDescription>
                    Você será redirecionado para a página de alteração de senha.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={handleChangePassword}>
                    Continuar
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            <button 
              className="w-full text-left px-3 py-2 text-sm text-destructive hover:bg-destructive/10 flex items-center gap-2"
              onClick={() => {
                logout();
                setIsOpen(false);
              }}
            >
              <LogOut className="h-4 w-4" />
              <span>Sair</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}