// Funções utilitárias para fuso horário de Brasília (GMT-3)

/**
 * Retorna a data atual (apenas dia), sem considerar horas.
 * Usado para comparações de pedidos urgentes onde apenas o dia importa.
 */
export function getCuiabaDateTime(): Date {
  const now = new Date();
  // Zerar horas para trabalhar apenas com dias completos
  now.setHours(0, 0, 0, 0);
  return now;
}

/**
 * Retorna a data e hora atual em UTC.
 * O frontend é responsável por converter para o fuso horário de Brasília na exibição.
 */
export function getBrasiliaDateTime(): Date {
  return new Date();
}

/**
 * Converte uma data para string ISO (apenas data, sem horas).
 * Usado para armazenar datas de entrega onde apenas o dia importa.
 */
export function toCuiabaISOString(date: Date | string): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  // Zerar horas para trabalhar apenas com dias completos
  const dateOnly = new Date(dateObj);
  dateOnly.setHours(0, 0, 0, 0);
  return dateOnly.toISOString();
}

/**
 * Converte uma string de data (YYYY-MM-DD) selecionada pelo usuário
 * para uma data com horário zerado (meia-noite).
 * 
 * Exemplo: "2025-10-15" → 2025-10-15T00:00:00.000Z
 */
export function convertToLocalDate(dateString: string): Date {
  const parts = dateString.split('T')[0].split('-');
  const year = parseInt(parts[0]);
  const month = parseInt(parts[1]) - 1;
  const day = parseInt(parts[2]);

  // Criar data UTC à meia-noite (00:00:00)
  return new Date(Date.UTC(year, month, day, 0, 0, 0));
}

/**
 * Calcula a diferença em DIAS COMPLETOS entre duas datas.
 * Ignora completamente as horas - conta apenas dias.
 * 
 * Para pedidos urgentes:
 * - Hoje (dia 22) = dia 0
 * - Amanhã (dia 23) = dia 1
 * - Dia 29 = dia 7
 * 
 * Retorna número POSITIVO se targetDate é no futuro, NEGATIVO se no passado.
 * Inclui AMBOS os dias (hoje e o dia de entrega) na contagem.
 */
export function getDaysDifference(targetDate: Date, fromDate: Date = new Date()): number {
  // Normalizar ambas as datas para meia-noite (zerar horas)
  const target = new Date(targetDate);
  target.setHours(0, 0, 0, 0);

  const from = new Date(fromDate);
  from.setHours(0, 0, 0, 0);

  // Calcular diferença em milissegundos
  const diffTime = target.getTime() - from.getTime();

  // Converter para dias COMPLETOS
  // Usar Math.ceil para incluir o dia de hoje na contagem
  // Exemplo: do dia 22 ao dia 29 = 7 dias COMPLETOS
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  return diffDays;
}