import { GoogleGenAI } from "@google/genai";
import * as fs from "fs";

const ai = new GoogleGenAI({
  apiKey: process.env.AI_INTEGRATIONS_GEMINI_API_KEY,
  httpOptions: {
    apiVersion: "",
    baseUrl: process.env.AI_INTEGRATIONS_GEMINI_BASE_URL,
  },
});

export interface DocumentValidationResult {
  isValid: boolean;
  pdfXmlMatch: boolean;
  purchaseOrderMatch: boolean;
  foundPurchaseOrderNumber: string | null;
  expectedPurchaseOrderNumber: string | null;
  details: string;
  warnings: string[];
}

export async function validateDocuments(
  pdfBuffer: Buffer,
  xmlBuffer: Buffer,
  expectedPurchaseOrderNumber: string
): Promise<DocumentValidationResult> {
  try {
    const pdfBase64 = pdfBuffer.toString("base64");
    const xmlContent = xmlBuffer.toString("utf-8");

    const prompt = `Você é um especialista em análise de notas fiscais brasileiras. Analise cuidadosamente o PDF da nota fiscal e o XML fornecidos.

TAREFAS:
1. Compare se o XML corresponde ao PDF da nota fiscal (verifique valores, datas, CNPJ, número da nota, produtos)
2. Identifique o número do pedido de compra/ordem de compra mencionado na descrição dos produtos ou em campos específicos
3. Compare se o pedido de compra encontrado é igual ao esperado: "${expectedPurchaseOrderNumber}"

CONTEÚDO DO XML DA NOTA FISCAL:
${xmlContent.substring(0, 50000)}

RESPONDA EM JSON COM ESTA ESTRUTURA EXATA:
{
  "pdfXmlMatch": true/false,
  "pdfXmlMatchDetails": "explicação detalhada da comparação",
  "foundPurchaseOrderNumber": "número encontrado ou null",
  "purchaseOrderMatch": true/false,
  "purchaseOrderDetails": "explicação sobre o pedido de compra",
  "warnings": ["lista de avisos ou inconsistências encontradas"]
}`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        {
          role: "user",
          parts: [
            {
              inlineData: {
                mimeType: "application/pdf",
                data: pdfBase64,
              },
            },
            { text: prompt },
          ],
        },
      ],
    });

    // Extrair texto da resposta corretamente
    let responseText = "";
    if (response.candidates && response.candidates.length > 0) {
      const candidate = response.candidates[0];
      if (candidate.content && candidate.content.parts) {
        for (const part of candidate.content.parts) {
          if (part.text) {
            responseText += part.text;
          }
        }
      }
    }
    
    // Fallback se o método acima não funcionar
    if (!responseText && typeof response.text === 'string') {
      responseText = response.text;
    }
    
    console.log("📄 Resposta do Gemini:", responseText);

    let jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return {
        isValid: false,
        pdfXmlMatch: false,
        purchaseOrderMatch: false,
        foundPurchaseOrderNumber: null,
        expectedPurchaseOrderNumber,
        details: "Não foi possível analisar os documentos. Resposta inválida do modelo.",
        warnings: ["Falha na análise automática"],
      };
    }

    const analysis = JSON.parse(jsonMatch[0]);

    const pdfXmlMatch = analysis.pdfXmlMatch === true;
    const purchaseOrderMatch = analysis.purchaseOrderMatch === true;
    const foundPurchaseOrderNumber = analysis.foundPurchaseOrderNumber || null;
    const warnings: string[] = analysis.warnings || [];

    if (!pdfXmlMatch) {
      warnings.push("O XML não corresponde ao PDF da nota fiscal");
    }

    if (!purchaseOrderMatch && foundPurchaseOrderNumber) {
      warnings.push(
        `Pedido de compra encontrado (${foundPurchaseOrderNumber}) é diferente do esperado (${expectedPurchaseOrderNumber})`
      );
    }

    if (!foundPurchaseOrderNumber) {
      warnings.push("Não foi possível identificar o número do pedido de compra na nota fiscal");
    }

    const isValid = pdfXmlMatch && purchaseOrderMatch;

    let details = "";
    if (analysis.pdfXmlMatchDetails) {
      details += `Comparação PDF/XML: ${analysis.pdfXmlMatchDetails}. `;
    }
    if (analysis.purchaseOrderDetails) {
      details += `Pedido de Compra: ${analysis.purchaseOrderDetails}`;
    }

    return {
      isValid,
      pdfXmlMatch,
      purchaseOrderMatch,
      foundPurchaseOrderNumber,
      expectedPurchaseOrderNumber,
      details: details || "Análise concluída",
      warnings,
    };
  } catch (error) {
    console.error("Erro na validação de documentos:", error);
    return {
      isValid: false,
      pdfXmlMatch: false,
      purchaseOrderMatch: false,
      foundPurchaseOrderNumber: null,
      expectedPurchaseOrderNumber,
      details: `Erro ao validar documentos: ${error instanceof Error ? error.message : "Erro desconhecido"}`,
      warnings: ["Falha na validação automática"],
    };
  }
}
