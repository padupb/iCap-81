import * as xml2js from "xml2js";

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
  duplicateCheck?: {
    isDuplicate: boolean;
    matchingOrderId?: string;
    matchingOrderNumericId?: number;
    matchType?: 'order_id' | 'nfe_number';
    message?: string;
  };
}

function extractTextFromXml(obj: any): string {
  if (typeof obj === 'string') return obj;
  if (typeof obj === 'number') return String(obj);
  if (Array.isArray(obj)) return obj.map(extractTextFromXml).join(' ');
  if (typeof obj === 'object' && obj !== null) {
    return Object.values(obj).map(extractTextFromXml).join(' ');
  }
  return '';
}

function findPurchaseOrderNumber(xmlContent: string, parsedXml: any): string | null {
  const patterns = [
    /PEDIDO\s*(?:DE\s*)?COMPRA\s*[:\-]?\s*[Nn]?[ºo°]?\s*(\d+)/gi,
    /PED(?:IDO)?\.?\s*COMPRA\s*[:\-]?\s*(\d+)/gi,
    /O\.?C\.?\s*[:\-]?\s*(\d+)/gi,
    /ORDEM\s*(?:DE\s*)?COMPRA\s*[:\-]?\s*(\d+)/gi,
    /N[ºo°]?\s*PEDIDO\s*[:\-]?\s*(\d+)/gi,
  ];

  for (const pattern of patterns) {
    const match = xmlContent.match(pattern);
    if (match) {
      const numberMatch = match[0].match(/(\d+)/);
      if (numberMatch) {
        return numberMatch[1];
      }
    }
  }

  try {
    const infCpl = findInObject(parsedXml, 'infCpl');
    if (infCpl) {
      const infCplText = extractTextFromXml(infCpl);
      for (const pattern of patterns) {
        const match = infCplText.match(pattern);
        if (match) {
          const numberMatch = match[0].match(/(\d+)/);
          if (numberMatch) return numberMatch[1];
        }
      }
    }

    const infAdic = findInObject(parsedXml, 'infAdic');
    if (infAdic) {
      const infAdicText = extractTextFromXml(infAdic);
      for (const pattern of patterns) {
        const match = infAdicText.match(pattern);
        if (match) {
          const numberMatch = match[0].match(/(\d+)/);
          if (numberMatch) return numberMatch[1];
        }
      }
    }

    const xPed = findInObject(parsedXml, 'xPed');
    if (xPed) {
      const xPedText = extractTextFromXml(xPed);
      const numberMatch = xPedText.match(/(\d+)/);
      if (numberMatch) return numberMatch[1];
    }
  } catch (e) {
    console.log("Erro ao buscar em campos específicos:", e);
  }

  return null;
}

function findOrderId(xmlContent: string, parsedXml: any): string | null {
  const iCapPattern = /\b(CNI|CCC|CCM|CO0|TRL|TRS|CBI|CBE|CBF|CBG|CBH|CBA|CBB|CBC|CBD)[0-9]{10,12}\b/gi;
  
  const matches = xmlContent.match(iCapPattern);
  if (matches && matches.length > 0) {
    return matches[0].toUpperCase();
  }

  try {
    const infCpl = findInObject(parsedXml, 'infCpl');
    if (infCpl) {
      const infCplText = extractTextFromXml(infCpl);
      const match = infCplText.match(iCapPattern);
      if (match) return match[0].toUpperCase();
    }

    const xProd = findInObject(parsedXml, 'xProd');
    if (xProd) {
      const xProdText = extractTextFromXml(xProd);
      const match = xProdText.match(iCapPattern);
      if (match) return match[0].toUpperCase();
    }
  } catch (e) {
    console.log("Erro ao buscar ID do pedido em campos específicos:", e);
  }

  return null;
}

function findInObject(obj: any, key: string): any {
  if (!obj || typeof obj !== 'object') return null;
  
  if (key in obj) return obj[key];
  
  for (const k of Object.keys(obj)) {
    const result = findInObject(obj[k], key);
    if (result !== null) return result;
  }
  
  return null;
}

function extractNfeNumber(parsedXml: any): string | null {
  try {
    const nNF = findInObject(parsedXml, 'nNF');
    if (nNF) {
      return extractTextFromXml(nNF).trim();
    }
  } catch (e) {
    console.log("Erro ao extrair número da NF-e:", e);
  }
  return null;
}

function extractNfeKey(parsedXml: any): string | null {
  try {
    const chNFe = findInObject(parsedXml, 'chNFe');
    if (chNFe) {
      return extractTextFromXml(chNFe).trim();
    }
    
    const infNFe = findInObject(parsedXml, 'infNFe');
    if (infNFe && typeof infNFe === 'object') {
      const id = infNFe['$']?.Id || infNFe.Id;
      if (id) {
        const key = String(id).replace(/^NFe/, '');
        return key;
      }
    }
  } catch (e) {
    console.log("Erro ao extrair chave da NF-e:", e);
  }
  return null;
}

export async function validateDocuments(
  pdfBuffer: Buffer,
  xmlBuffer: Buffer,
  expectedPurchaseOrderNumber: string,
  expectedOrderId: string = ""
): Promise<DocumentValidationResult> {
  try {
    const xmlContent = xmlBuffer.toString("utf-8");

    const parser = new xml2js.Parser({
      explicitArray: false,
      ignoreAttrs: false,
      trim: true
    });

    let parsedXml: any;
    try {
      parsedXml = await parser.parseStringPromise(xmlContent);
    } catch (parseError) {
      console.error("Erro ao parsear XML:", parseError);
      return {
        isValid: false,
        pdfXmlMatch: false,
        purchaseOrderMatch: false,
        foundPurchaseOrderNumber: null,
        expectedPurchaseOrderNumber,
        orderIdMatch: false,
        foundOrderId: null,
        expectedOrderId,
        details: "Erro ao processar o XML. Verifique se o arquivo é um XML válido de NF-e.",
        warnings: ["XML inválido ou malformado"],
      };
    }

    const nfeNumber = extractNfeNumber(parsedXml);
    const nfeKey = extractNfeKey(parsedXml);
    const pdfXmlMatch = true;

    const foundPurchaseOrderNumber = findPurchaseOrderNumber(xmlContent, parsedXml);
    const foundOrderId = findOrderId(xmlContent, parsedXml);

    const expectedPONormalized = expectedPurchaseOrderNumber.trim().replace(/^0+/, '');
    const foundPONormalized = foundPurchaseOrderNumber ? foundPurchaseOrderNumber.replace(/^0+/, '') : null;
    const purchaseOrderMatch = foundPONormalized !== null && foundPONormalized === expectedPONormalized;

    const orderIdMatch = expectedOrderId && foundOrderId ? 
      foundOrderId.toUpperCase() === expectedOrderId.toUpperCase() : false;

    console.log("🔍 Validação de pedido de compra (sem IA):", {
      encontrado: foundPurchaseOrderNumber,
      encontradoNormalizado: foundPONormalized,
      esperado: expectedPurchaseOrderNumber,
      esperadoNormalizado: expectedPONormalized,
      resultado: purchaseOrderMatch ? "CONFERE" : "DIVERGE"
    });

    console.log("🔍 Validação de ID do pedido (sem IA):", {
      encontrado: foundOrderId,
      esperado: expectedOrderId,
      resultado: orderIdMatch ? "CONFERE" : "DIVERGE"
    });

    if (nfeNumber) {
      console.log("📄 Número da NF-e:", nfeNumber);
    }
    if (nfeKey) {
      console.log("🔑 Chave da NF-e:", nfeKey);
    }

    const warnings: string[] = [];

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

    if (expectedOrderId && !foundOrderId) {
      warnings.push("Não foi possível identificar o ID do pedido iCap na nota fiscal");
    }

    const isValid = pdfXmlMatch && purchaseOrderMatch && (expectedOrderId ? orderIdMatch : true);

    let details = `XML processado com sucesso.`;
    if (nfeNumber) {
      details += ` NF-e nº ${nfeNumber}.`;
    }
    if (foundPurchaseOrderNumber) {
      details += ` Pedido de compra: ${foundPurchaseOrderNumber}.`;
    }
    if (foundOrderId) {
      details += ` ID iCap: ${foundOrderId}.`;
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
      details,
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
      warnings: ["Falha na validação"],
    };
  }
}
