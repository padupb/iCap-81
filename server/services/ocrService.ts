import { GoogleGenerativeAI } from "@google/generative-ai";

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
    const genAI = new GoogleGenerativeAI(process.env.AI_INTEGRATIONS_GEMINI_API_KEY || "");
    
    const model = genAI.getGenerativeModel({ 
      model: "gemini-2.5-flash"
    }, {
      baseUrl: process.env.AI_INTEGRATIONS_GEMINI_BASE_URL
    });

    const base64Image = imageBuffer.toString("base64");

    const prompt = `Analise esta imagem de uma entrega de carga/material. 
Procure por:
1. Data e horário visíveis na imagem (timestamp, legenda da câmera, ou qualquer texto com data/hora)
2. Localização ou endereço visível
3. Coordenadas GPS se houver

Retorne APENAS um JSON válido no seguinte formato (sem markdown, sem texto adicional):
{
  "timestamp": "data e hora encontrada ou null",
  "location": "endereço ou local encontrado ou null", 
  "coordinates": { "latitude": numero ou null, "longitude": numero ou null },
  "rawText": "todo texto legível encontrado na imagem"
}

Se não encontrar alguma informação, use null. Responda APENAS com o JSON.`;

    const result = await model.generateContent([
      {
        inlineData: {
          mimeType: mimeType,
          data: base64Image
        }
      },
      prompt
    ]);

    const response = result.response;
    const text = response.text().trim();
    
    let cleanedText = text;
    if (text.startsWith("```json")) {
      cleanedText = text.replace(/```json\s*/, "").replace(/```\s*$/, "");
    } else if (text.startsWith("```")) {
      cleanedText = text.replace(/```\s*/, "").replace(/```\s*$/, "");
    }

    try {
      const parsed = JSON.parse(cleanedText);
      return {
        success: true,
        timestamp: parsed.timestamp,
        location: parsed.location,
        coordinates: parsed.coordinates,
        rawText: parsed.rawText
      };
    } catch (parseError) {
      console.error("Erro ao parsear resposta do OCR:", parseError);
      return {
        success: false,
        rawText: text,
        error: "Não foi possível estruturar os dados extraídos"
      };
    }

  } catch (error) {
    console.error("Erro no serviço de OCR:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Erro desconhecido no OCR"
    };
  }
}
