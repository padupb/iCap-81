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

    const prompt = `Você é um especialista em análise de notas fiscais brasileiras. Analise o XML fornecido, focando principalmente nas tags <infAdic> (informações adicionais) e nas descrições dos produtos (<xProd>).
    
TAREFAS:
1. Verifique se o XML corresponde ao PDF (valores totais e dados básicos).
2. Localize o número do pedido de compra iCap ("${expectedPurchaseOrderNumber}") dentro do XML, procurando especificamente em:
   - Tags de observações/informações complementares (<infCpl> ou <infAdic>).
   - Descrições de itens (<xProd>).
3. Compare o número encontrado com o esperado: "${expectedPurchaseOrderNumber}".

CONTEÚDO DO XML (Focado em campos relevantes):
${xmlContent.substring(0, 30000)}

RESPONDA EM JSON COM ESTA ESTRUTURA EXATA:
{
  "pdfXmlMatch": true/false,
  "pdfXmlMatchDetails": "explicação concisa",
  "foundPurchaseOrderNumber": "número encontrado ou null",
  "purchaseOrderMatch": true/false,
  "purchaseOrderDetails": "explicação sobre o pedido de compra",
  "warnings": []
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
