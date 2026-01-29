import exifr from "exifr";

interface OCRResult {
  success: boolean;
  timestamp?: string;
  location?: string;
  coordinates?: {
    latitude?: number;
    longitude?: number;
  };
  rawText?: string;
  error?: string;
}

export async function extractImageMetadata(imageBuffer: Buffer, mimeType: string): Promise<OCRResult> {
  try {
    console.log(`📸 Processando Buffer de ${imageBuffer.length} bytes, tipo ${mimeType}`);
    
    const exifData = await exifr.parse(imageBuffer, {
      pick: ['DateTimeOriginal', 'CreateDate', 'ModifyDate', 'DateTime', 'GPSLatitude', 'GPSLongitude', 'GPSDateStamp', 'GPSTimeStamp', 'latitude', 'longitude'],
      translateValues: true
    });

    console.log('📸 Metadados EXIF brutos extraídos (DETALHADO):', JSON.stringify(exifData, null, 2));

    // SE NÃO HOUVER EXIF, TENTAR ANALISAR O NOME DO ARQUIVO OU TEXTO BÁSICO
    // Algumas câmeras de celular embutem data no nome do arquivo: foto-chegada-2026-01-29...
    
    let timestamp: string | undefined;
    let coordinates: { latitude?: number; longitude?: number } | undefined;

    if (exifData) {
      // Prioridade: DateTimeOriginal > CreateDate > ModifyDate > DateTime
      const dateField = exifData.DateTimeOriginal || exifData.CreateDate || exifData.ModifyDate || exifData.DateTime;
      
      if (dateField) {
        if (dateField instanceof Date) {
          timestamp = dateField.toLocaleString('pt-BR');
        } else {
          // Se for string, tentar converter para data para formatar
          const dateStr = String(dateField).trim();
          // EXIF dates often use colons: "2026:01:29 10:32:55"
          const dateAttempt = new Date(dateStr.replace(/^(\d{4}):(\d{2}):(\d{2})/, '$1-$2-$3').replace(' ', 'T'));
          if (!isNaN(dateAttempt.getTime())) {
            timestamp = dateAttempt.toLocaleString('pt-BR');
          } else {
            timestamp = dateStr;
          }
        }
      }

      // Prioridade Coordenadas: latitude/longitude (achatas por translateValues) > GPSLatitude/GPSLongitude
      const lat = exifData.latitude !== undefined ? exifData.latitude : exifData.GPSLatitude;
      const lon = exifData.longitude !== undefined ? exifData.longitude : exifData.GPSLongitude;

      if (lat !== undefined && lon !== undefined) {
        coordinates = {
          latitude: Number(lat),
          longitude: Number(lon)
        };
      }

      // Fallback para data do GPS se necessário
      if (!timestamp && exifData.GPSDateStamp) {
        const gpsDate = String(exifData.GPSDateStamp).replace(/:/g, '-');
        const gpsTime = exifData.GPSTimeStamp ? ` ${exifData.GPSTimeStamp}` : '';
        timestamp = `${gpsDate}${gpsTime}`.trim();
      }
    }

    // Se ainda não tiver nada, vamos considerar que a extração falhou por falta de dados no arquivo
    if (!timestamp && !coordinates) {
      console.log('⚠️ Nenhum metadado EXIF útil encontrado na imagem enviada');
      return {
        success: false,
        error: "A imagem não possui metadados EXIF (data/hora/GPS). Certifique-se de enviar a foto original da câmera, pois capturas de tela ou fotos enviadas por alguns aplicativos de mensagens (como WhatsApp com compressão) podem remover esses dados."
      };
    }

    console.log('✅ Metadados processados:', { timestamp, coordinates });

    return {
      success: true,
      timestamp,
      coordinates
    };

  } catch (error) {
    console.error("Erro ao extrair metadados EXIF:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Erro ao processar metadados da imagem"
    };
  }
}
