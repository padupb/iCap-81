
// Funções utilitárias para fuso horário de Cuiabá (GMT-4)

/**
 * Retorna a data/hora atual ajustada para o fuso de Cuiabá (GMT-4).
 * Subtrai 4 horas do UTC para obter o horário de Cuiabá.
 */
export function getCuiabaDateTime(): Date {
  const now = new Date();
  // GMT-4 = UTC - 4 horas
  const cuiabaTime = new Date(now.getTime() - (4 * 60 * 60 * 1000));
  return cuiabaTime;
}

/**
 * Converte uma data para string ISO ajustada para o fuso de Cuiabá (GMT-4).
 * Retorna a data no formato ISO mas com o horário ajustado para GMT-4.
 */
export function toCuiabaISOString(date: Date | string): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  // Ajustar para GMT-4 (subtrair 4 horas)
  const cuiabaTime = new Date(dateObj.getTime() - (4 * 60 * 60 * 1000));
  return cuiabaTime.toISOString();
}

/**
 * Converte uma string de data (YYYY-MM-DD) selecionada pelo usuário em Cuiabá
 * para uma data UTC correspondente à meia-noite em Cuiabá (GMT-4).
 * 
 * Exemplo: "2025-10-15" em Cuiabá → 2025-10-15T04:00:00.000Z (que é meia-noite GMT-4 em UTC)
 */
export function convertToLocalDate(dateString: string): Date {
  const parts = dateString.split('T')[0].split('-');
  const year = parseInt(parts[0]);
  const month = parseInt(parts[1]) - 1;
  const day = parseInt(parts[2]);
  
  // Criar data UTC à meia-noite de Cuiabá (meia-noite GMT-4 = 04:00 UTC)
  return new Date(Date.UTC(year, month, day, 4, 0, 0));
}

/**
 * Calcula a diferença em dias entre duas datas.
 * Retorna número positivo se targetDate é no futuro, negativo se no passado.
 * Usa Math.floor para contar apenas dias completos, ignorando horas.
 * 
 * Exemplo: Se hoje é dia 22 e a data alvo é dia 29, retorna 7.
 */
export function getDaysDifference(targetDate: Date, fromDate: Date = new Date()): number {
  // Normalizar ambas as datas para meia-noite para comparação correta
  const target = new Date(targetDate);
  target.setHours(0, 0, 0, 0);
  
  const from = new Date(fromDate);
  from.setHours(0, 0, 0, 0);
  
  // Calcular diferença em milissegundos e converter para dias
  const diffTime = target.getTime() - from.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  
  return diffDays;
}
