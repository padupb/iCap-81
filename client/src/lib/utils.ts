import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: string | Date | undefined | null): string {
  // Validar entrada
  if (!date) return "Data não disponível";

  let dateStr: string;
  
  if (typeof date === 'string') {
    dateStr = date.trim();
  } else {
    try {
      dateStr = date.toISOString();
    } catch {
      return "Data inválida";
    }
  }

  // Extrair apenas a parte da data (YYYY-MM-DD)
  // Aceita formatos: "YYYY-MM-DD", "YYYY-MM-DD HH:MM:SS", "YYYY-MM-DDTHH:MM:SSZ"
  const datePart = dateStr.split(/[T\s]/)[0];
  
  // Validar formato usando regex para garantir YYYY-MM-DD completo
  const dateRegex = /^\d{4}-\d{1,2}-\d{1,2}$/;
  if (!datePart || !dateRegex.test(datePart)) {
    return "Data inválida";
  }

  const parts = datePart.split('-');
  
  // Garantir que temos todas as partes
  if (parts.length !== 3) {
    return "Data inválida";
  }

  const [year, month, day] = parts;
  
  // Validar que todas as partes existem
  if (!year || !month || !day) {
    return "Data inválida";
  }
  
  // Retornar no formato DD/MM/YYYY
  return `${day.padStart(2, '0')}/${month.padStart(2, '0')}/${year}`;
}

export function formatDateTime(date: string | Date) {
  const d = new Date(date);
  return d.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

export function formatCurrency(value: number | string) {
  const num = typeof value === "string" ? parseFloat(value) : value;
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(num);
}

export function formatCNPJ(cnpj: string) {
  const cleaned = cnpj.replace(/\D/g, "");
  return cleaned.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
}

export function getStatusColor(status: string) {
  switch (status.toLowerCase()) {
    case "registrado":
      return "bg-blue-500 hover:bg-blue-600";
    case "aprovado":
      return "bg-green-500 hover:bg-green-600";
    case "recusado":
      return "bg-red-500 hover:bg-red-600";
    case "pendente":
    case "aguardando aprovação":
      return "bg-yellow-500 hover:bg-yellow-600";
    case "cancelado":
      return "bg-gray-500 hover:bg-gray-600";
    case "não iniciado":
      return "bg-slate-400 hover:bg-slate-500";
    case "carregado":
      return "bg-purple-500 hover:bg-purple-600";
    case "em rota":
    case "em transporte":
      return "bg-orange-500 hover:bg-orange-600";
    case "entregue":
      return "bg-emerald-500 hover:bg-emerald-600";
    case "suspenso":
      return "bg-amber-500 hover:bg-amber-600";
    default:
      return "bg-gray-500 hover:bg-gray-600";
  }
}