import type { ModelData } from "./xml-parser"

export interface SimilarityResults {
  simEa: number
  simEb: number
  simEc: number
  commonEntities: number
  totalEntities: number
  commonEntitiesEa: string[]
  commonEntitiesEb: string[]
  commonEntitiesEc: string[]
}

export class SimilarityCalculator {
  private synonyms: { [key: string]: string[] } = {
    user: ["usuario", "cliente", "person", "pessoa", "utilizador"],
    product: ["produto", "item", "article", "artigo", "mercadoria"],
    order: ["pedido", "compra", "purchase", "venda", "encomenda"],
    customer: ["cliente", "user", "usuario", "consumidor", "comprador"],
    employee: ["funcionario", "worker", "staff", "colaborador", "empregado"],
    company: ["empresa", "organization", "corporacao", "firma", "organizacao"],
    address: ["endereco", "location", "localizacao", "local", "morada"],
    phone: ["telefone", "contact", "contato", "numero", "telemovel"],
    email: ["correio", "mail", "electronic_mail", "e_mail", "email_address"],
    department: ["departamento", "sector", "setor", "divisao", "area"],
    project: ["projeto", "projecto", "initiative", "iniciativa", "empreendimento"],
    task: ["tarefa", "activity", "atividade", "trabalho", "funcao"],
    report: ["relatorio", "documento", "document", "arquivo", "ficheiro"],
  }

  calculateSimilarity(model1: ModelData, model2: ModelData): SimilarityResults {
    console.log("[v0] Starting similarity calculation")
    console.log("[v0] Model 1 entities:", model1.entities)
    console.log("[v0] Model 2 entities:", model2.entities)

    const { simEa, commonEntitiesEa } = this.calculateSimEa(model1.entities, model2.entities)
    const { simEb, commonEntitiesEb } = this.calculateSimEb(model1.entities, model2.entities)
    const { simEc, commonEntitiesEc } = this.calculateSimEc(model1.entities, model2.entities)

    const commonEntities = commonEntitiesEa.length
    const totalEntities = model1.entities.length + model2.entities.length

    console.log("[v0] Similarity results - simEa:", simEa, "simEb:", simEb, "simEc:", simEc)

    return {
      simEa,
      simEb,
      simEc,
      commonEntities,
      totalEntities,
      commonEntitiesEa,
      commonEntitiesEb,
      commonEntitiesEc,
    }
  }

  private calculateSimEa(entities1: string[], entities2: string[]): { simEa: number; commonEntitiesEa: string[] } {
    let commonCount = 0
    const commonEntitiesEa: string[] = []

    for (const e1 of entities1) {
      let found = false
      // Para cada E2 em EM2 faça
      for (const e2 of entities2) {
        // Se E1 = E2 (exact match)
        if (e1.toLowerCase().trim() === e2.toLowerCase().trim()) {
          commonCount++
          commonEntitiesEa.push(e1)
          found = true
          break // Stop after finding first match
        }
      }
    }

    const simEa =
      entities1.length + entities2.length > 0 ? (2 * commonCount) / (entities1.length + entities2.length) : 0

    console.log(
      "[v0] simEa calculation - commonCount:",
      commonCount,
      "EM1.length:",
      entities1.length,
      "EM2.length:",
      entities2.length,
      "formula: (2 *",
      commonCount,
      ") / (",
      entities1.length,
      "+",
      entities2.length,
      ") =",
      simEa,
    )

    return { simEa, commonEntitiesEa }
  }

  private calculateSimEb(entities1: string[], entities2: string[]): { simEb: number; commonEntitiesEb: string[] } {
    let commonCount = 0
    const commonEntitiesEb: string[] = []

    for (const e1 of entities1) {
      let found = false
      for (const e2 of entities2) {
        const e1Lower = e1.toLowerCase().trim()
        const e2Lower = e2.toLowerCase().trim()

        // Enhanced matching: exact, contains, or high similarity
        if (
          e1Lower === e2Lower ||
          e1Lower.includes(e2Lower) ||
          e2Lower.includes(e1Lower) ||
          this.calculateLevenshteinSimilarity(e1Lower, e2Lower) > 0.8
        ) {
          commonCount++
          commonEntitiesEb.push(e1)
          found = true
          break
        }
      }
    }

    const simEb =
      entities1.length + entities2.length > 0 ? (2 * commonCount) / (entities1.length + entities2.length) : 0

    console.log(
      "[v0] simEb calculation - commonCount:",
      commonCount,
      "EM1.length:",
      entities1.length,
      "EM2.length:",
      entities2.length,
      "formula: (2 *",
      commonCount,
      ") / (",
      entities1.length,
      "+",
      entities2.length,
      ") =",
      simEb,
    )

    return { simEb, commonEntitiesEb }
  }

  private calculateSimEc(entities1: string[], entities2: string[]): { simEc: number; commonEntitiesEc: string[] } {
    let commonCount = 0
    const commonEntitiesEc: string[] = []

    for (const e1 of entities1) {
      let found = false
      // Para cada E2 em EM2 faça
      for (const e2 of entities2) {
        // Se E1 = APIsinonimo(E2)
        if (this.areSynonyms(e1, e2)) {
          commonCount++
          commonEntitiesEc.push(e1)
          found = true
          break // Stop after finding first match (as specified in algorithm)
        }
      }
    }

    const simEc = entities1.length > 0 ? commonCount / entities1.length : 0

    console.log(
      "[v0] simEc calculation - commonCount:",
      commonCount,
      "EM1.length:",
      entities1.length,
      "formula:",
      commonCount,
      "/",
      entities1.length,
      "=",
      simEc,
    )

    return { simEc, commonEntitiesEc }
  }

  private areSynonyms(word1: string, word2: string): boolean {
    const w1 = word1.toLowerCase().trim()
    const w2 = word2.toLowerCase().trim()

    // Exact match
    if (w1 === w2) return true

    // Check direct synonyms
    if (this.synonyms[w1]?.includes(w2)) return true
    if (this.synonyms[w2]?.includes(w1)) return true

    // Check if both words appear in the same synonym group
    for (const [key, synonymList] of Object.entries(this.synonyms)) {
      if ((key === w1 || synonymList.includes(w1)) && (key === w2 || synonymList.includes(w2))) {
        return true
      }
    }

    if (this.calculateLevenshteinSimilarity(w1, w2) > 0.85) {
      return true
    }

    return false
  }

  private calculateLevenshteinSimilarity(str1: string, str2: string): number {
    const matrix = []
    const len1 = str1.length
    const len2 = str2.length

    if (len1 === 0) return len2 === 0 ? 1 : 0
    if (len2 === 0) return 0

    // Initialize matrix
    for (let i = 0; i <= len1; i++) {
      matrix[i] = [i]
    }
    for (let j = 0; j <= len2; j++) {
      matrix[0][j] = j
    }

    // Fill matrix
    for (let i = 1; i <= len1; i++) {
      for (let j = 1; j <= len2; j++) {
        const cost = str1[i - 1] === str2[j - 1] ? 0 : 1
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1, // deletion
          matrix[i][j - 1] + 1, // insertion
          matrix[i - 1][j - 1] + cost, // substitution
        )
      }
    }

    const distance = matrix[len1][len2]
    const maxLength = Math.max(len1, len2)
    return maxLength > 0 ? 1 - distance / maxLength : 1
  }
}
