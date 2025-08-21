export interface ModelData {
  entities: string[];
  relationships: string[];
}

type ExtractConfig = {
  // Você pode ajustar depois, mas já cobre a maioria dos esquemas
  nameAttrRegex: RegExp;            // atributos que carregam "nome" da entidade
  fieldTagRegex: RegExp;            // tags que representam campos/atributos de uma entidade
  relationshipAttrRegex: RegExp;    // atributos que indicam relacionamento/ref
  relationshipTagRegex: RegExp;     // tags típicas de relacionamento
};

const DEFAULT_CFG: ExtractConfig = {
  nameAttrRegex: /(name|label|title|code|className|tableName|logicalName|physicalName)$/i,
  fieldTagRegex: /^(column|field|attribute|property|id|key)$/i,
  relationshipAttrRegex: /(ref|reference|fk|foreignKey|source|target|from|to)$/i,
  relationshipTagRegex: /^(relationship|relation|association|connection|link|foreignKey|fk)$/i,
};

export class XMLParser {
  parseXML(xmlContent: string, cfg: Partial<ExtractConfig> = {}): ModelData {
    const config: ExtractConfig = { ...DEFAULT_CFG, ...cfg };

    try {
      console.log("[XMLParser] Parsing XML Content...");
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(xmlContent, "text/xml");

      const parserError = xmlDoc.querySelector("parsererror");
      if (parserError) {
        throw new Error("XML inválido: " + parserError.textContent);
      }

      console.log("[XMLParser] Extracting Entities...");
      const entities = this.extractEntitiesAdaptive(xmlDoc, config);
      console.log("[XMLParser] Extracted Entities:", entities);

      console.log("[XMLParser] Extracting Relationships...");
      const relationships = this.extractRelationshipsAdaptive(xmlDoc, config);
      console.log("[XMLParser] Extracted Relationships:", relationships);

      if (entities.length === 0) {
        console.warn("[XMLParser] No entities found. Running debug report...");
        this.debugReport(xmlDoc);
        throw new Error("[XMLParser] Nenhuma entidade encontrada com as heurísticas atuais.");
      }

      return { entities, relationships };
    } catch (error) {
      console.error("[XMLParser] Error parsing XML:", error);
      throw new Error(
        `Erro ao fazer parse do XML: ${error instanceof Error ? error.message : "Erro desconhecido"}`
      );
    }
  }

  /** ===== Heurística adaptativa para entidades =====
   *  Regras:
   *  1) Qualquer elemento que tenha um atributo que case com nameAttrRegex => vira entidade com esse valor.
   *  2) Qualquer elemento que seja "pai" de tags que pareçam campos (fieldTagRegex) => o próprio elemento vira entidade (usa atributo de nome se existir; senão, usa tag + índice).
   *  3) Remove duplicados, normaliza espaços/capitalização.
   */
  private extractEntitiesAdaptive(xmlDoc: Document, cfg: ExtractConfig): string[] {
    const out: string[] = [];
    const seen = new Set<string>();

    const all = xmlDoc.getElementsByTagName("*");
    // Índice por tagName para fallback estável
    const idxCounter: Record<string, number> = {};

    for (let i = 0; i < all.length; i++) {
      const el = all[i] as Element;
      const local = this.localName(el);

      // Regra 1: atributo com "name"
      let candidate = this.pickNameAttr(el, cfg.nameAttrRegex);

      // normalize internal whitespace for candidate (collapse newlines/tabs/multiple spaces)
      if (candidate) candidate = candidate.replace(/\s+/g, " ").trim();

      // Regra 2: pai com filhos "campo"
      if (!candidate && this.hasFieldChildren(el, cfg.fieldTagRegex)) {
        candidate = this.pickNameAttr(el, cfg.nameAttrRegex);
        if (!candidate) {
          // Fallback "estável": tagName + contador (evita cair em "somente nomes de tag" iguais entre XMLs)
          const key = local.toLowerCase();
          idxCounter[key] = (idxCounter[key] ?? 0) + 1;
          candidate = `${local}#${idxCounter[key]}`;
        }
      }

      if (candidate) {
        const cleaned = candidate.replace(/\s+/g, " ").trim();
        const norm = this.normalize(cleaned);
        if (norm && !seen.has(norm)) {
          seen.add(norm);
          out.push(cleaned);
        }
      }
    }

    return out;
  }

  /** ===== Heurística adaptativa para relacionamentos =====
   *  Regras:
   *  1) Tags típicas de relacionamento (relationshipTagRegex) => extrai atributos “nome” ou “ref”.
   *  2) Quaisquer atributos de qualquer elemento que casem com relationshipAttrRegex => adiciona.
   */
  private extractRelationshipsAdaptive(xmlDoc: Document, cfg: ExtractConfig): string[] {
    const out: string[] = [];
    const seen = new Set<string>();

    const all = xmlDoc.getElementsByTagName("*");
    for (let i = 0; i < all.length; i++) {
      const el = all[i] as Element;
      const local = this.localName(el);

      // Regra 1: por tag
      if (cfg.relationshipTagRegex.test(local)) {
        const rawName =
          this.pickNameAttr(el, /(name|label|type|id)$/i) ||
          this.pickNameAttr(el, cfg.relationshipAttrRegex) ||
          (el.textContent ?? "");
        const name = rawName.replace(/\s+/g, " ").trim();
        const norm = this.normalize(name);
        if (norm && !seen.has(norm)) {
          seen.add(norm);
          out.push(name);
        }
      }

      // Regra 2: por atributo (ref/fk/etc.)
      Array.from(el.attributes).forEach((attr) => {
        if (cfg.relationshipAttrRegex.test(attr.name)) {
          const raw = (attr.value || "");
          const val = raw.replace(/\s+/g, " ").trim();
          const norm = this.normalize(val);
          if (norm && !seen.has(norm)) {
            seen.add(norm);
            out.push(val);
          }
        }
      });
    }

    return out;
  }

  // ===== Helpers =====
  private pickNameAttr(el: Element, rx: RegExp): string | null {
    // 1) Qualquer atributo cujo NOME case com o regex
    let byName: string | null = null;
    Array.from(el.attributes).some((attr) => {
      if (rx.test(attr.name)) {
        const v = (attr.value || "").trim();
        if (v) {
          byName = v;
          return true;
        }
      }
      return false;
    });
    if (byName) return byName;

    // 2) Se não achou, tenta conteúdo de texto não vazio (às vezes o nome vem como conteúdo)
    const txt = (el.textContent || "");
    const cleaned = txt.replace(/\s+/g, " ").trim();
    return cleaned || null;
  }

  private hasFieldChildren(el: Element, fieldTagRegex: RegExp): boolean {
    for (let i = 0; i < el.children.length; i++) {
      const child = el.children[i] as Element;
      const local = this.localName(child);
      if (fieldTagRegex.test(local)) return true;
    }
    return false;
  }

  private localName(el: Element): string {
    // Suporta namespaces (ex.: <edmx:EntityType> => "EntityType")
    return (el.localName || el.tagName || "").replace(/^[^:]+:/, "");
  }

  private normalize(s: string): string {
    return s.toLowerCase().replace(/\s+/g, " ").trim();
  }

  private debugReport(xmlDoc: Document) {
    const tags = new Map<string, Set<string>>();
    const all = xmlDoc.getElementsByTagName("*");
    for (let i = 0; i < all.length; i++) {
      const el = all[i] as Element;
      const name = this.localName(el);
      const set = tags.get(name) ?? new Set<string>();
      Array.from(el.attributes).forEach((a) => set.add(a.name));
      tags.set(name, set);
    }

    console.groupCollapsed("[XMLParser] Diagnóstico: tags e atributos encontrados");
    tags.forEach((attrs, tag) => {
      console.log(`<${tag}> attrs:`, Array.from(attrs));
    });
    console.groupEnd();
  }
}
