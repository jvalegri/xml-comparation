import type { ModelData } from "./xml-parser";

/* ======================= Tipos públicos ======================= */
export interface SimilarityResults {
  simEa: number;
  simEb: number;
  simEc: number;
  commonEntities: number;
  totalEntities: number;
  commonEntitiesEa: string[];
  commonEntitiesEb: string[];
  commonEntitiesEc: string[];
}

export interface SynonymProvider {
  getSynonyms(term: string): Promise<Set<string>>;
}

function normalizeToken(s: string): string {
  const base = (s ?? "").trim().toLowerCase();
  const noDia = base.normalize("NFD").replace(/\p{Diacritic}/gu, "");
  return noDia
    .replace(/[\s\-]+/g, "_")
    .replace(/[^\p{L}\p{N}_]/gu, "")
    .replace(/^_+|_+$/g, "");
}

function splitTokens(s: string): string[] {
  return normalizeToken(s).split("_").filter(Boolean);
}

function jstr(x: string) {
  return JSON.stringify(x);
}

function diceCoefficient(common: number, lenA: number, lenB: number): number {
  const denom = lenA + lenB;
  return denom ? (2 * common) / denom : 0;
}

/* ================== Providers de Sinônimos ==================== */
export class ConceptNetProvider implements SynonymProvider {
  constructor(
    private lang = "pt",
    private baseUrl = "https://api.conceptnet.io",
    private timeoutMs = 4000
  ) {}

  private parseTermPath(path: string): string | null {
    const parts = (path || "").split("/").filter(Boolean);
    const raw = parts[2] ?? "";
    const cleaned = raw.replace(/_/g, " ");
    const norm = normalizeToken(cleaned);
    return norm || null;
  }

  private async fetchJSON(url: string, signal: AbortSignal): Promise<any | null> {
    const res = await fetch(url, { signal });
    if (!res.ok) return null;
    return res.json();
  }

  async getSynonyms(term: string): Promise<Set<string>> {
    const q = normalizeToken(term).replace(/_/g, " ");
    if (!q) return new Set();

    const encoded = encodeURIComponent(q);
    const urls = [
      `${this.baseUrl}/query?start=/c/${this.lang}/${encoded}&rel=/r/Synonym&limit=1000`,
      `${this.baseUrl}/query?end=/c/${this.lang}/${encoded}&rel=/r/Synonym&limit=1000`,
    ];

    const controller = new AbortController();
    const to = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const out = new Set<string>();
      for (const url of urls) {
        const json = await this.fetchJSON(url, controller.signal);
        const edges: any[] = Array.isArray(json?.edges) ? json.edges : [];
        for (const e of edges) {
          const other = url.includes("?start=") ? e?.end?.term : e?.start?.term;
          const norm = this.parseTermPath(other || "");
          if (norm) out.add(norm);
        }
      }
      return out;
    } catch {
      return new Set();
    } finally {
      clearTimeout(to);
    }
  }
}

export class DatamuseProvider implements SynonymProvider {
  constructor(private baseUrl = "https://api.datamuse.com/words", private timeoutMs = 3000) {}
  async getSynonyms(term: string): Promise<Set<string>> {
    const q = normalizeToken(term);
    if (!q) return new Set();
    const controller = new AbortController();
    const to = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const res = await fetch(`${this.baseUrl}?ml=${encodeURIComponent(q)}`, { signal: controller.signal });
      if (!res.ok) return new Set();
      const data = await res.json();
      const out = new Set<string>();
      if (Array.isArray(data)) {
        for (const d of data) {
          const w = normalizeToken(d?.word ?? "");
          if (w) out.add(w);
        }
      }
      return out;
    } catch {
      return new Set();
    } finally {
      clearTimeout(to);
    }
  }
}

/* =================== Similarity Calculator ==================== */
export class SimilarityCalculator {
  constructor(
    private providers: SynonymProvider[] = [new ConceptNetProvider()],
    private levenshteinThreshold = 0.8
  ) {}

  async calculateSimilarity(
    model1: ModelData,
    model2: ModelData,
    weights: { W_E: number; W_R: number } = { W_E: 0.5, W_R: 0.5 }
  ): Promise<SimilarityResults> {
    console.log("[SimilarityCalculator] Model 1 Entities:", model1.entities.map(jstr));
    console.log("[SimilarityCalculator] Model 2 Entities:", model2.entities.map(jstr));

    const { simEa, commonEntitiesEa } = await this.calculateSimEa(model1.entities, model2.entities);
    console.log("[SimilarityCalculator] simEa:", simEa, "commonEntitiesEa:", commonEntitiesEa.map(jstr));

    const { simEb, commonEntitiesEb } = await this.calculateSimEb(model1.entities, model2.entities);
    console.log("[SimilarityCalculator] simEb:", simEb, "commonEntitiesEb:", commonEntitiesEb.map(jstr));

    const { simEc, commonEntitiesEc } = await this.calculateSimEc(model1.entities, model2.entities);
    console.log("[SimilarityCalculator] simEc:", simEc, "commonEntitiesEc:", commonEntitiesEc.map(jstr));

    const union = new Set<string>([
      ...commonEntitiesEa.map(normalizeToken),
      ...commonEntitiesEb.map(normalizeToken),
      ...commonEntitiesEc.map(normalizeToken),
    ]);

    const totalEntities = model1.entities.length + model2.entities.length;
    const commonEntities = union.size;
    const simE = diceCoefficient(commonEntities, model1.entities.length, model2.entities.length);
    console.log("[SimilarityCalculator] simE (global entidades):", simE);

    const simM = weights.W_E * simE;
    void simM;

    return {
      simEa,
      simEb,
      simEc,
      commonEntities,
      totalEntities,
      commonEntitiesEa,
      commonEntitiesEb,
      commonEntitiesEc,
    };
  }

  private async calculateSimEa(
    entities1: string[],
    entities2: string[]
  ): Promise<{ simEa: number; commonEntitiesEa: string[] }> {
    const set2 = new Set(entities2.map(normalizeToken));
    let common = 0;
    const commons: string[] = [];

    for (const e1 of entities1) {
      const ne1 = normalizeToken(e1);
      if (set2.has(ne1)) {
        common++;
        commons.push(e1);
      }
    }

    const simEa = diceCoefficient(common, entities1.length, entities2.length);
    return { simEa, commonEntitiesEa: commons };
  }

  private async calculateSimEb(
    entities1: string[],
    entities2: string[]
  ): Promise<{ simEb: number; commonEntitiesEb: string[] }> {
    const norm2 = entities2.map(normalizeToken);
    let common = 0;
    const commons: string[] = [];

    for (const e1 of entities1) {
      const ne1 = normalizeToken(e1);
      let hit = false;

      for (let i = 0; i < norm2.length; i++) {
        const ne2 = norm2[i];
        const short = Math.min(ne1.length, ne2.length) <= 3;

        if (
          ne1 === ne2 ||
          (!short && (ne1.includes(ne2) || ne2.includes(ne1))) ||
          this.levenshtein(ne1, ne2) >= this.levenshteinThreshold
        ) {
          hit = true;
          break;
        }
      }

      if (hit) {
        common++;
        commons.push(e1);
      }
    }

    const simEb = diceCoefficient(common, entities1.length, entities2.length);
    return { simEb, commonEntitiesEb: commons };
  }

  private async calculateSimEc(
    entities1: string[],
    entities2: string[]
  ): Promise<{ simEc: number; commonEntitiesEc: string[] }> {
    const tokens2 = entities2.map(splitTokens);
    let common = 0;
    const commons: string[] = [];

    for (const e1 of entities1) {
      const t1 = splitTokens(e1);
      let hit = false;

      for (let j = 0; j < tokens2.length && !hit; j++) {
        const t2 = tokens2[j];

        for (const a of t1) {
          for (const b of t2) {
            if (a === b || (await this.areSynonymsAPI(a, b))) {
              hit = true;
              break;
            }
          }
          if (hit) break;
        }
      }

      if (hit) {
        common++;
        commons.push(e1);
      }
    }

    const simEc = diceCoefficient(common, entities1.length, entities2.length);
    return { simEc, commonEntitiesEc: commons };
  }

  private cache = new Map<string, Set<string>>();

  private async areSynonymsAPI(a: string, b: string): Promise<boolean> {
    const na = normalizeToken(a);
    const nb = normalizeToken(b);
    if (!na || !nb) return false;
    if (na === nb) return true;

    let syns = this.cache.get(na);
    if (!syns) {
      syns = new Set<string>();
      for (const p of this.providers) {
        try {
          const set = await p.getSynonyms(na);
          set.forEach((w) => syns!.add(w));
        } catch {
        }
      }
      this.cache.set(na, syns);
    }
    return syns.has(nb);
  }

  private levenshtein(a: string, b: string): number {
    const len1 = a.length, len2 = b.length;
    if (!len1 && !len2) return 1;
    if (!len1 || !len2) return 0;

    const dp: number[][] = Array.from({ length: len1 + 1 }, () => Array(len2 + 1).fill(0));
    for (let i = 0; i <= len1; i++) dp[i][0] = i;
    for (let j = 0; j <= len2; j++) dp[0][j] = j;

    for (let i = 1; i <= len1; i++) {
      for (let j = 1; j <= len2; j++) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
      }
    }
    const dist = dp[len1][len2];
    return 1 - dist / Math.max(len1, len2);
  }
}