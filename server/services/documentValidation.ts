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
  orderIdMatch: boolean;
  foundOrderId: string | null;
  expectedOrderId: string | null;
  details: string;
  warnings: string[];
}

export async function validateDocuments(
  pdfBuffer: Buffer,
  xmlBuffer: Buffer,
  expectedPurchaseOrderNumber: string,
  expectedOrderId: string = ""
): Promise<DocumentValidationResult> {
  try {
    const pdfBase64 = pdfBuffer.toString("base64");
    const xmlContent = xmlBuffer.toString("utf-8");

    const prompt = `Você é um especialista em análise de notas fiscais brasileiras (DANFE).
    
Sua tarefa é localizar DOIS identificadores dentro do XML da nota fiscal:
1. O número do PEDIDO DE COMPRA (ex: "20660", "006241").
2. O código identificador do PEDIDO no sistema iCap (começa com prefixos como CNI, CCC, CCM, CO0, TRL, TRS, etc seguido de números).

Locais para buscar:
1. Informações Complementares (<infCpl> ou <infAdic>): Procure por "PEDIDO DE COMPRA:" seguido de número, e também códigos alfanuméricos como "CCC1212250003".
2. Descrição dos Produtos (<xProd>): Verifique se aparecem esses códigos.

CONTEÚDO DO XML:
${xmlContent.substring(0, 40000)}

INSTRUÇÕES CRÍTICAS:
- Extraia o número logo após "PEDIDO DE COMPRA:".
- Procure por códigos alfanuméricos que sigam o padrão de ID do iCap (3 letras + números, ex: CNI2710250001, CCC1212250003, CCM0610250001).

RESPONDA EM JSON COM ESTA ESTRUTURA EXATA:
{
  "pdfXmlMatch": true,
  "pdfXmlMatchDetails": "XML validado",
  "foundPurchaseOrderNumber": "número do pedido de compra encontrado (ex: 20660)",
  "foundOrderId": "código do pedido iCap encontrado (ex: CCC1212250003) ou null",
  "purchaseOrderDetails": "Explicação de onde encontrou os dados",
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
    
    // Validação do número do pedido de compra
    const foundPurchaseOrderNumber = analysis.foundPurchaseOrderNumber ? String(analysis.foundPurchaseOrderNumber).trim() : null;
    const expectedPONormalized = expectedPurchaseOrderNumber.trim().replace(/^0+/, '');
    const foundPONormalized = foundPurchaseOrderNumber ? foundPurchaseOrderNumber.replace(/^0+/, '') : null;
    const purchaseOrderMatch = foundPONormalized !== null && foundPONormalized === expectedPONormalized;

    // Validação do ID do pedido iCap
    const foundOrderId = analysis.foundOrderId ? String(analysis.foundOrderId).trim() : null;
    const orderIdMatch = expectedOrderId && foundOrderId ? foundOrderId === expectedOrderId : false;

    console.log("🔍 Validação de pedido de compra:", {
      encontrado: foundPurchaseOrderNumber,
      encontradoNormalizado: foundPONormalized,
      esperado: expectedPurchaseOrderNumber,
      esperadoNormalizado: expectedPONormalized,
      resultado: purchaseOrderMatch ? "CONFERE" : "DIVERGE"
    });

    console.log("🔍 Validação de ID do pedido:", {
      encontrado: foundOrderId,
      esperado: expectedOrderId,
      resultado: orderIdMatch ? "CONFERE" : "DIVERGE"
    });

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

    if (expectedOrderId && !orderIdMatch && foundOrderId) {
      warnings.push(
        `ID do pedido encontrado (${foundOrderId}) é diferente do esperado (${expectedOrderId})`
      );
    }

    // Válido apenas se AMBOS conferirem (quando o ID do pedido é informado)
    const isValid = pdfXmlMatch && purchaseOrderMatch && (expectedOrderId ? orderIdMatch : true);

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
      orderIdMatch,
      foundOrderId,
      expectedOrderId,
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
      orderIdMatch: false,
      foundOrderId: null,
      expectedOrderId,
      details: `Erro ao validar documentos: ${error instanceof Error ? error.message : "Erro desconhecido"}`,
      warnings: ["Falha na validação automática"],
    };
  }
}
