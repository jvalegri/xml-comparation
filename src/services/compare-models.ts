import { XMLParser, type ModelData } from "../../components/xml-parser";
import { SimilarityCalculator, ConceptNetProvider, type SimilarityResult, type SimilarityProvider } from "../../lib/similarity-calculator";

type NonEmptyModel = ModelData & { entities: Array<unknown> };

function assertNonEmptyModel(name: string, m: ModelData | null | undefined): asserts m is NonEmptyModel {
  if (!m || !Array.isArray((m as any).entities) || (m as any).entities.length === 0) {
    throw new Error(`[${name}] Modelo vazio ou sem 'entities'.`);
  }
}

function summarize(modelName: string, m: { entities: any[] }) {
  const first = m.entities[0];
  const preview = first ? JSON.stringify(first).slice(0, 200) : "";
  return `[${modelName}] entities=${m.entities.length}${preview ? `, first=${preview}…` : ""}`;
}

export async function compareModelsFromStrings(
  xmlOficial: string,
  xmlAvaliacao: string,
  opts?: {
    providers?: SimilarityProvider[];
    debug?: boolean;
  }
): Promise<SimilarityResult> {
  const { providers = [new ConceptNetProvider()], debug = false } = opts ?? {};
  const parser = new XMLParser();

  try {
    if (debug) console.log("[compareModelsFromStrings] Parsing XML Oficial…");
    const model1 = parser.parseXML(xmlOficial);
    if (debug && model1 && (model1 as any).entities) console.log(summarize("Model1", model1 as any));

    if (debug) console.log("[compareModelsFromStrings] Parsing XML Avaliacao…");
    const model2 = parser.parseXML(xmlAvaliacao);
    if (debug && model2 && (model2 as any).entities) console.log(summarize("Model2", model2 as any));

    assertNonEmptyModel("Model1", model1);
    assertNonEmptyModel("Model2", model2);

    if (!providers.length) {
      throw new Error("Nenhum provider de similaridade informado.");
    }

    if (debug) console.log("[compareModelsFromStrings] Calculating Similarity…");
    // passa debug para o calculador para habilitar logs internos
    const calc = new SimilarityCalculator(providers, 0.8, debug);

    const res = await calc.calculateSimilarity(model1, model2);
    if (debug) console.log("[compareModelsFromStrings] OK");

    return res;
  } catch (err: any) {
    const message = err?.message ?? String(err);
    if (debug) console.error("[compareModelsFromStrings] Erro:", message);
    throw new Error(`[compareModelsFromStrings] ${message}`);
  }
}

export async function compareModelsFromFiles(
  file1: File,
  file2: File,
  opts?: {
    providers?: SimilarityProvider[];
    debug?: boolean;
  }
): Promise<SimilarityResult> {
  if (!file1 || !file2) {
    throw new Error("Both files must be provided.");
  }
  const xml1 = await file1.text();
  const xml2 = await file2.text();
  return compareModelsFromStrings(xml1, xml2, opts);
}
