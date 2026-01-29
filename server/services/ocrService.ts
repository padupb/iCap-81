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
    const exifData = await exifr.parse(imageBuffer, {
      pick: ['DateTimeOriginal', 'CreateDate', 'ModifyDate', 'GPSLatitude', 'GPSLongitude']
    });

    if (!exifData) {
      return {
        success: false,
        error: "Não foi possível extrair metadados EXIF da imagem"
      };
    }

    let timestamp: string | undefined;
    const dateField = exifData.DateTimeOriginal || exifData.CreateDate || exifData.ModifyDate;
    
    if (dateField) {
      if (dateField instanceof Date) {
        timestamp = dateField.toISOString();
      } else if (typeof dateField === 'string') {
        timestamp = dateField;
      }
    }

    let coordinates: { latitude?: number; longitude?: number } | undefined;
    if (exifData.GPSLatitude !== undefined && exifData.GPSLongitude !== undefined) {
      coordinates = {
        latitude: exifData.GPSLatitude,
        longitude: exifData.GPSLongitude
      };
    }

    if (!timestamp) {
      return {
        success: false,
        error: "Foto sem data/hora nos metadados. Verifique se a câmera registra a data nas fotos."
      };
    }

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
