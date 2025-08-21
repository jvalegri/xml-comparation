import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Adicionado: tipo e parser XML simples para suportar compare-models.ts

export type ParsedModel = {
  // Estrutura mínima esperada pelo code existente
  entities?: Array<Record<string, unknown>>;
};

// Parser simples: tenta DOMParser (navegador/ambientes que suportam), senão usa regex como fallback.
// Objetivo: extrair <entity>...</entity> ou <entities> container para popular `entities`.
export class XMLParser {
  parseXML(xml: string): ParsedModel | null {
    if (!xml || typeof xml !== "string") return null;

    try {
      // Tenta DOMParser se disponível (navegador, alguns runtimes)
      if (typeof DOMParser !== "undefined") {
        const dom = new DOMParser().parseFromString(xml, "application/xml");
        const err = dom.querySelector("parsererror");
        if (err) throw new Error("XML parse error");

        const entityEls = Array.from(dom.getElementsByTagName("entity"));
        if (entityEls.length > 0) {
          const entities = entityEls.map(el => {
            const obj: Record<string, unknown> = {};
            // attributes
            for (let i = 0; i < el.attributes.length; i++) {
              const a = el.attributes.item(i);
              if (a) obj[a.name] = a.value;
            }
            obj._text = el.textContent?.trim() ?? "";
            return obj;
          });
          return { entities };
        }

        // tenta container <entities><item>...</item></entities>
        const container = dom.getElementsByTagName("entities")[0];
        if (container && container.children.length > 0) {
          const entities = Array.from(container.children).map(ch => ({
            tag: ch.tagName,
            text: ch.textContent?.trim() ?? ""
          }));
          return { entities };
        }
      }

      // Fallback regex: busca tags <entity>...</entity>
      const re = /<entity\b[^>]*>([\s\S]*?)<\/entity>/gi;
      const matches = [...xml.matchAll(re)];
      if (matches.length > 0) {
        const entities = matches.map(m => ({ content: m[1].trim() }));
        return { entities };
      }

      // Fallback: busca <entities>...</entities> e devolve conteúdo bruto
      const re2 = /<entities\b[^>]*>([\s\S]*?)<\/entities>/i;
      const m2 = xml.match(re2);
      if (m2) {
        const inner = m2[1].trim();
        if (inner) return { entities: [{ raw: inner }] };
      }

      // sem entities encontradas, retorna vazio (caller pode validar e lançar)
      return { entities: [] };
    } catch (e) {
      // falha ao parsear -> retorna null para que o código chamador trate o erro
      return null;
    }
  }
}
