export interface SimilarityResult {
  simEa: number;
  simEb: number;
  simEc: number;
  commonEntities: number;
  totalEntities: number;
  commonEntitiesEa: string[];
  commonEntitiesEb: string[];
  commonEntitiesEc: string[];
}

export type SimilarityProvider = {
  getSynonyms(term: string): Promise<Set<string>>;
};

type Weights = { W_E: number; W_R: number };

/* ------------------ Normalização ------------------ */
function normalizeToken(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "") // remove acentos
    .replace(/[\s\-]+/g, "_") // espaço/hífen → "_"
    .replace(/[^\p{L}\p{N}_]/gu, "") // remove pontuação
    .trim();
}
function splitTokens(s: string): string[] {
  return normalizeToken(s).split("_").filter(Boolean);
}

/* ------------------ Providers ------------------ */
export class ConceptNetProvider implements SimilarityProvider {
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

export class DatamuseProvider implements SimilarityProvider {
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

/* ------------------ SimilarityCalculator ------------------ */
export class SimilarityCalculator {
  constructor(
    private providers: SimilarityProvider[] = [new ConceptNetProvider()],
    private levenshteinThreshold = 0.8,
    private debug = false
  ) {}

  // model1/model2: objetos com entities:any[] (compatível com XMLParser.parseXML)
  async calculateSimilarity(
    model1: { entities: any[] },
    model2: { entities: any[] },
    weights: Weights = { W_E: 0.5, W_R: 0.5 }
  ): Promise<SimilarityResult> {
    // raw (para exibição/estatísticas) e normalizados (para comparação)
    const rawE1 = Array.isArray(model1?.entities) ? model1.entities.map(entToString) : [];
    const rawE2 = Array.isArray(model2?.entities) ? model2.entities.map(entToString) : [];
    const e1 = rawE1.map((s) => normalizeToken(String(s))).filter(Boolean);
    const e2 = rawE2.map((s) => normalizeToken(String(s))).filter(Boolean);

    // mapa de normalized -> raw (usa primeira ocorrência em M1, depois M2)
    const normToRaw = new Map<string, string>();
    const cleanRaw = (s: string) => s.replace(/\s+/g, " ").trim();
    for (const r of rawE1) {
      const n = normalizeToken(String(r));
      if (n && !normToRaw.has(n)) normToRaw.set(n, cleanRaw(String(r)));
    }
    for (const r of rawE2) {
      const n = normalizeToken(String(r));
      if (n && !normToRaw.has(n)) normToRaw.set(n, cleanRaw(String(r)));
    }

    const { simEa, commonEntitiesEa } = await this.calculateSimEa(e1, e2);
    const { simEb, commonEntitiesEb } = await this.calculateSimEb(e1, e2);
    const { simEc, commonEntitiesEc } = await this.calculateSimEc(e1, e2);

    // converte as lists retornadas (normalizadas) para valores raw limpos
    const mapNormalizedListToRaw = (list: string[]) =>
      list.map((tok) => normToRaw.get(normalizeToken(tok)) ?? cleanRaw(String(tok)));

    const commonEntitiesEaRaw = mapNormalizedListToRaw(commonEntitiesEa);
    const commonEntitiesEbRaw = mapNormalizedListToRaw(commonEntitiesEb);
    const commonEntitiesEcRaw = mapNormalizedListToRaw(commonEntitiesEc);

    const union = new Set<string>([
      ...commonEntitiesEaRaw.map((s) => s.toLowerCase()),
      ...commonEntitiesEbRaw.map((s) => s.toLowerCase()),
      ...commonEntitiesEcRaw.map((s) => s.toLowerCase()),
    ]);

    // total a partir dos arrays originais (antes da normalização)
    const totalEntities = rawE1.length + rawE2.length;
    const commonEntities = union.size;

    return {
      simEa,
      simEb,
      simEc,
      commonEntities,
      totalEntities,
      commonEntitiesEa: commonEntitiesEaRaw,
      commonEntitiesEb: commonEntitiesEbRaw,
      commonEntitiesEc: commonEntitiesEcRaw,
    };
  }

  /* -------- helpers para converter entidade genérica -> string -------- */
  // tenta extrair campos comuns; fallback para JSON string
  private staticTextField(f: any): string | null {
    if (typeof f === "string") return f;
    if (typeof f === "number" || typeof f === "boolean") return String(f);
    return null;
  }
  /* eslint-disable @typescript-eslint/no-explicit-any */
  /* Convert any entity object to a representative string */
  /* eslint-enable @typescript-eslint/no-explicit-any */
  private async extractLabel(e: any): Promise<string> {
    return entToString(e);
  }

  /* -------- Ea: igualdade exata (normalizada) -------- */
  private async calculateSimEa(entities1: string[], entities2: string[]): Promise<{ simEa: number; commonEntitiesEa: string[] }> {
    if (this.debug) console.log("[SimilarityCalculator][calculateSimEa] entities1:", entities1, "entities2:", entities2);
    let common = 0;
    const commons: string[] = [];
    const n2 = new Set(entities2.map(normalizeToken));

    for (const e1 of entities1) {
      const ne1 = normalizeToken(e1);
      if (n2.has(ne1)) { common++; commons.push(e1); }
    }

    const denom = entities1.length + entities2.length;
    if (this.debug) console.log("[SimilarityCalculator][calculateSimEa] common:", common, "denom:", denom);
    return { simEa: denom ? (2 * common) / denom : 0, commonEntitiesEa: commons };
  }

  /* -------- Eb: flex (igual, substring, Levenshtein) -------- */
  private async calculateSimEb(entities1: string[], entities2: string[]): Promise<{ simEb: number; commonEntitiesEb: string[] }> {
    if (this.debug) console.log("[SimilarityCalculator][calculateSimEb] entities1:", entities1, "entities2:", entities2);
    let common = 0;
    const commons: string[] = [];
    const n2 = entities2.map(normalizeToken);

    for (const e1 of entities1) {
      const ne1 = normalizeToken(e1);
      let hit = false;
      for (let i = 0; i < n2.length; i++) {
        const ne2 = n2[i];
        if (
          ne1 === ne2 ||
          ne1.includes(ne2) ||
          ne2.includes(ne1) ||
          this.levenshtein(ne1, ne2) > this.levenshteinThreshold
        ) { hit = true; break; }
      }
      if (hit) { common++; commons.push(e1); }
    }

    const denom = entities1.length + entities2.length;
    if (this.debug) console.log("[SimilarityCalculator][calculateSimEb] common:", common, "denom:", denom);
    return { simEb: denom ? (2 * common) / denom : 0, commonEntitiesEb: commons };
  }

  /* -------- Ec: sinônimo via APIs (dinâmico) -------- */
  private async calculateSimEc(entities1: string[], entities2: string[]): Promise<{ simEc: number; commonEntitiesEc: string[] }> {
    if (this.debug) console.log("[SimilarityCalculator][calculateSimEc] entities1:", entities1, "entities2:", entities2);
    let common = 0;
    const commons: string[] = [];

    const tokens1 = entities1.map(splitTokens);
    const tokens2 = entities2.map(splitTokens);

    // coletar tokens únicos de ambos os modelos
    const uniqueTokens = new Set<string>();
    for (const tA of tokens1) tA.forEach((x) => uniqueTokens.add(normalizeToken(x)));
    for (const tB of tokens2) tB.forEach((x) => uniqueTokens.add(normalizeToken(x)));

    // pré-carregar sinônimos para cada token não cacheado
    const toFetch: string[] = [];
    for (const tok of uniqueTokens) {
      if (!this.cache.has(tok) && tok) toFetch.push(tok);
    }

    if (toFetch.length > 0) {
      // para cada termo, chamar todos os providers em paralelo e popular o cache
      await Promise.all(
        toFetch.map(async (tok) => {
          const syns = new Set<string>();
          // adiciona o próprio termo (auto-match)
          syns.add(tok);
          await Promise.all(
            this.providers.map(async (p) => {
              try {
                const res = await p.getSynonyms(tok);
                res.forEach((w) => {
                  if (w) syns.add(w);
                });
              } catch {
                // ignora falhas de provider
              }
            })
          );
          if (this.debug) console.log("[SimilarityCalculator][calculateSimEc] fetched synonyms for", tok, "=>", Array.from(syns));
          this.cache.set(tok, syns);
        })
      );
    }

    // agora comparar usando cache preenchido
    for (let i = 0; i < entities1.length; i++) {
      const e1 = entities1[i];
      const t1 = tokens1[i].map(normalizeToken);
      let hitEntity = false;

      for (let j = 0; j < entities2.length && !hitEntity; j++) {
        const t2 = tokens2[j].map(normalizeToken);

        // testar pares de tokens entre as duas entidades (usa cache já populado)
        for (const a of t1) {
          for (const b of t2) {
            if (!a || !b) continue;
            if (a === b) { hitEntity = true; break; }

            const synA = this.cache.get(a);
            const synB = this.cache.get(b);

            if ((synA && synA.has(b)) || (synB && synB.has(a))) { hitEntity = true; break; }

            // token-level overlap: sinônimos podem ser compostos -> comparar tokens internos
            if (synA) {
              for (const s of synA) {
                if (splitTokens(s).some((tk) => tk === b)) { hitEntity = true; break; }
              }
            }
            if (hitEntity) break;
            if (synB) {
              for (const s of synB) {
                if (splitTokens(s).some((tk) => tk === a)) { hitEntity = true; break; }
              }
            }
            if (hitEntity) break;
          }
          if (hitEntity) break;
        }
      }

      if (hitEntity) {
        common++;
        commons.push(e1);
      }
    }

    const denom = entities1.length + entities2.length;
    if (this.debug) console.log("[SimilarityCalculator][calculateSimEc] common:", common, "denom:", denom);
    return { simEc: denom ? (2 * common) / denom : 0, commonEntitiesEc: commons };
  }

  /* -------- Levenshtein Distance -------- */
  private levenshtein(a: string, b: string): number {
    const matrix = Array.from({ length: a.length + 1 }, (_, i) =>
      Array.from({ length: b.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
    );

    for (let i = 1; i <= a.length; i++) {
      for (let j = 1; j <= b.length; j++) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j - 1] + cost
        );
      }
    }

    return 1 - matrix[a.length][b.length] / Math.max(a.length, b.length);
  }

  /* -------- Sinônimos com cache (chama os providers reais) -------- */
  private cache = new Map<string, Set<string>>(); // cache por termo normalizado
  private async areSynonymsAPI(a: string, b: string): Promise<boolean> {
    // esta função agora assume cache populado pela etapa de prefetch em calculateSimEc
    if (a === b) return true;
    const na = normalizeToken(a), nb = normalizeToken(b);
    if (!na || !nb) return false;

    if (this.debug) console.log("[SimilarityCalculator][areSynonymsAPI] check", na, "<->", nb);
    const synA = this.cache.get(na);
    const synB = this.cache.get(nb);
    if ((synA && synA.has(nb)) || (synB && synB.has(na))) return true;

    // fallback: ainda tenta popular para os termos individuais (compatibilidade)
    try {
      if (!synA) {
        const s = new Set<string>();
        s.add(na);
        if (this.debug) console.log("[SimilarityCalculator][areSynonymsAPI] populating cache for", na);
        await Promise.all(this.providers.map(async (p) => {
          try { (await p.getSynonyms(na)).forEach((w) => s.add(w)); } catch {}
        }));
        if (this.debug) console.log("[SimilarityCalculator][areSynonymsAPI] fetched for", na, "=>", Array.from(s));
        this.cache.set(na, s);
        if (s.has(nb)) return true;
      }
      if (!synB) {
        const s = new Set<string>();
        s.add(nb);
        if (this.debug) console.log("[SimilarityCalculator][areSynonymsAPI] populating cache for", nb);
        await Promise.all(this.providers.map(async (p) => {
          try { (await p.getSynonyms(nb)).forEach((w) => s.add(w)); } catch {}
        }));
        if (this.debug) console.log("[SimilarityCalculator][areSynonymsAPI] fetched for", nb, "=>", Array.from(s));
        this.cache.set(nb, s);
        if (s.has(na)) return true;
      }
    } catch {
      // se providers falharem, devolve false
    }

    return false;
  }
}

/* ------------------ util: converte entidade qualquer para string representativa ------------------ */
function entToString(e: any): string {
  const clean = (s: string) => String(s).replace(/\s+/g, " ").trim();
  if (e == null) return "";
  if (typeof e === "string") return clean(e);
  if (typeof e === "number" || typeof e === "boolean") return clean(String(e));
  if (typeof e === "object") {
    // campos comuns
    if (typeof e.name === "string" && e.name) return clean(e.name);
    if (typeof e.id === "string" && e.id) return clean(e.id);
    if (typeof e.label === "string" && e.label) return clean(e.label);
    if (typeof e._text === "string" && e._text) return clean(e._text);
    if (typeof e.text === "string" && e.text) return clean(e.text);
    if (typeof e.raw === "string" && e.raw) return clean(e.raw);
    if (typeof e.content === "string" && e.content) return clean(e.content);
    if (typeof e.tag === "string" && e.text) return `${clean(e.tag)}:${clean(e.text)}`;
    // attributes object -> join values
    if (e.attributes && typeof e.attributes === "object") {
      try {
        return clean(Object.values(e.attributes).join(" "));
      } catch {}
    }
    // fallback: stringify
    try {
      return clean(JSON.stringify(e));
    } catch {
      return clean(String(e));
    }
  }
  return clean(String(e));
}
