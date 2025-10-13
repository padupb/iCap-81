import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: string | Date): string {
  // Extrair a data diretamente da string ISO sem conversão de timezone
  const dateStr = typeof date === 'string' ? date : date.toISOString();
  const [datePart] = dateStr.split('T');
  const [year, month, day] = datePart.split('-');
  return `${day}/${month}/${year}`;
}

export function formatDateTime(date: string | Date) {
  const d = new Date(date);
  return d.toLocaleString("pt-BR");
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
  const statusColors: Record<string, string> = {
    "Criado": "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300",
    "Em Aprovação": "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300",
    "Aprovado": "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
    "Em Trânsito": "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300",
    "Concluído": "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
    "Cancelado": "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300",
    "Ativo": "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
    "Inativo": "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300",
    "Expirado": "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300",
    "Pendente": "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300",
  };

  return statusColors[status] || "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300";
}