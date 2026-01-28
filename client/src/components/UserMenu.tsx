import { useState, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/context/AuthContext";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { LogOut, User, Key } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

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
    console.log("🔄 Clicou em alterar senha - redirecionando...");
    
    // Fechar o menu primeiro
    setIsOpen(false);
    
    // Redirecionar para a página de alteração de senha
    setTimeout(() => {
      setLocation('/first-password-change');
      console.log("✅ Redirecionamento executado para /first-password-change");
    }, 100);
  };


  return (
    <div className="relative" ref={menuRef}>
      {/* Botão do avatar */}
      <div 
        className="flex items-center gap-3 cursor-pointer rounded-lg px-2 py-2 hover:bg-gray-700 transition-colors"
        onClick={() => setIsOpen(!isOpen)}
      >
        <Avatar className="h-9 w-9 bg-primary text-primary-foreground cursor-pointer">
          <AvatarFallback className="bg-primary text-primary-foreground font-medium text-sm">
            {getInitials(user?.name)}
          </AvatarFallback>
        </Avatar>

        <div className="text-left flex-1 min-w-0">
          <p className="text-sm font-medium text-white truncate">{user?.name || "Usuário"}</p>
          <p className="text-xs text-sidebar-foreground/70 truncate">{role}</p>
        </div>
      </div>

      {/* Menu dropdown */}
      {isOpen && (
        <div className="absolute bottom-full left-0 mb-2 w-56 z-50 rounded-md shadow-lg bg-card border border-border overflow-hidden">
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
            <button 
              className="w-full text-left px-3 py-2 text-sm hover:bg-accent flex items-center gap-2"
              onClick={handleChangePassword}
            >
              <Key className="mr-2 h-4 w-4" />
              <span>Alterar senha</span>
            </button>

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