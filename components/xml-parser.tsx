export interface ModelData {
  entities: string[]
  relationships: string[]
}

export class XMLParser {
  parseXML(xmlContent: string): ModelData {
    try {
      // Parse XML content
      const parser = new DOMParser()
      const xmlDoc = parser.parseFromString(xmlContent, "text/xml")

      // Check for parsing errors
      const parserError = xmlDoc.querySelector("parsererror")
      if (parserError) {
        throw new Error("XML inválido: " + parserError.textContent)
      }

      // Extract entities - looking for common XML structures
      const entities = this.extractEntities(xmlDoc)
      const relationships = this.extractRelationships(xmlDoc)

      return {
        entities,
        relationships,
      }
    } catch (error) {
      throw new Error(`Erro ao fazer parse do XML: ${error instanceof Error ? error.message : "Erro desconhecido"}`)
    }
  }

  private extractEntities(xmlDoc: Document): string[] {
    const entities: string[] = []

    // Try different common XML structures for entities
    const entitySelectors = ["entity", "Entity", "table", "Table", "class", "Class", "object", "Object"]

    for (const selector of entitySelectors) {
      const elements = xmlDoc.querySelectorAll(selector)
      elements.forEach((element) => {
        // Try to get name from different attributes
        const name =
          element.getAttribute("name") ||
          element.getAttribute("id") ||
          element.getAttribute("title") ||
          element.textContent?.trim()

        if (name && !entities.includes(name)) {
          entities.push(name)
        }
      })
    }

    // If no entities found with standard selectors, try to extract from element names
    if (entities.length === 0) {
      const allElements = xmlDoc.querySelectorAll("*")
      const elementNames = new Set<string>()

      allElements.forEach((element) => {
        if (element.tagName && element.tagName !== "parsererror") {
          elementNames.add(element.tagName)
        }
      })

      entities.push(...Array.from(elementNames))
    }

    return entities
  }

  private extractRelationships(xmlDoc: Document): string[] {
    const relationships: string[] = []

    // Try different common XML structures for relationships
    const relationshipSelectors = [
      "relationship",
      "Relationship",
      "relation",
      "Relation",
      "association",
      "Association",
      "connection",
      "Connection",
      "link",
      "Link",
    ]

    for (const selector of relationshipSelectors) {
      const elements = xmlDoc.querySelectorAll(selector)
      elements.forEach((element) => {
        const name =
          element.getAttribute("name") ||
          element.getAttribute("type") ||
          element.getAttribute("id") ||
          element.textContent?.trim()

        if (name && !relationships.includes(name)) {
          relationships.push(name)
        }
      })
    }

    // Look for foreign key references or similar patterns
    const fkElements = xmlDoc.querySelectorAll("[foreignKey], [foreign-key], [ref], [reference]")
    fkElements.forEach((element) => {
      const ref =
        element.getAttribute("foreignKey") ||
        element.getAttribute("foreign-key") ||
        element.getAttribute("ref") ||
        element.getAttribute("reference")

      if (ref && !relationships.includes(ref)) {
        relationships.push(ref)
      }
    })

    return relationships
  }
}
