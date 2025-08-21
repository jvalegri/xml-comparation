import * as React from "react"
import { cn } from "@/lib/utils"

export interface ModelData {
  entities: string[];
  relationships: string[];
}

type ExtractConfig = {
  nameAttrRegex: RegExp;
  fieldTagRegex: RegExp;
  relationshipAttrRegex: RegExp;
  relationshipTagRegex: RegExp;
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

  private extractEntitiesAdaptive(xmlDoc: Document, cfg: ExtractConfig): string[] {
    const out: string[] = [];
    const seen = new Set<string>();
    const all = xmlDoc.getElementsByTagName("*");

    for (let i = 0; i < all.length; i++) {
      const el = all[i] as Element;
      const local = this.localName(el);

      let candidate: string | null = null;
      candidate = this.pickNameAttr(el, cfg.nameAttrRegex);
      
      if (!candidate && this.hasFieldChildren(el, cfg.fieldTagRegex)) {
        candidate = local;
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

  private extractRelationshipsAdaptive(xmlDoc: Document, cfg: ExtractConfig): string[] {
    const out: string[] = [];
    const seen = new Set<string>();

    const all = xmlDoc.getElementsByTagName("*");
    for (let i = 0; i < all.length; i++) {
      const el = all[i] as Element;
      const local = this.localName(el);

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

  private pickNameAttr(el: Element, rx: RegExp): string | null {
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

    // CORREÇÃO: Só use textContent se o elemento não tiver outros elementos filhos.
    if (el.children.length === 0) {
      const txt = (el.textContent || "");
      const cleaned = txt.replace(/\s+/g, " ").trim();
      return cleaned || null;
    }
    
    return null;
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