import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { CheckCircle, Info } from "lucide-react"
import type { SimilarityResults } from "./similarity-calculator"
import type { ModelData } from "./xml-parser"

interface ResultsDisplayProps {
  results: SimilarityResults
  model1: ModelData
  model2: ModelData
}

export function ResultsDisplay({ results, model1, model2 }: ResultsDisplayProps) {
  const formatPercentage = (value: number) => `${(value * 100).toFixed(1)}%`

  const getSimilarityColor = (value: number) => {
    if (value >= 0.8) return "text-green-600"
    if (value >= 0.6) return "text-yellow-600"
    return "text-red-600"
  }

  const getSimilarityLabel = (value: number) => {
    if (value >= 0.8) return "Alta"
    if (value >= 0.6) return "Média"
    return "Baixa"
  }

  return (
    <div className="space-y-6">
      {/* Summary Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-green-600" />
            Resultados da Análise de Similaridade
          </CardTitle>
          <CardDescription>Comparação entre os modelos usando três algoritmos diferentes</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* simEa */}
            <div className="text-center p-4 border rounded-lg">
              <div className="text-2xl font-bold mb-1">
                <span className={getSimilarityColor(results.simEa)}>{formatPercentage(results.simEa)}</span>
              </div>
              <div className="text-sm text-muted-foreground mb-2">simEa() - Correspondência Exata</div>
              <Badge variant="outline">{getSimilarityLabel(results.simEa)}</Badge>
            </div>

            {/* simEb */}
            <div className="text-center p-4 border rounded-lg">
              <div className="text-2xl font-bold mb-1">
                <span className={getSimilarityColor(results.simEb)}>{formatPercentage(results.simEb)}</span>
              </div>
              <div className="text-sm text-muted-foreground mb-2">simEb() - Correspondência Parcial</div>
              <Badge variant="outline">{getSimilarityLabel(results.simEb)}</Badge>
            </div>

            {/* simEc */}
            <div className="text-center p-4 border rounded-lg">
              <div className="text-2xl font-bold mb-1">
                <span className={getSimilarityColor(results.simEc)}>{formatPercentage(results.simEc)}</span>
              </div>
              <div className="text-sm text-muted-foreground mb-2">simEc() - API Sinônimos</div>
              <Badge variant="outline">{getSimilarityLabel(results.simEc)}</Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Detailed Analysis */}
      <Tabs defaultValue="entities" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="entities">Entidades</TabsTrigger>
          <TabsTrigger value="relationships">Relacionamentos</TabsTrigger>
          <TabsTrigger value="algorithm">Algoritmo</TabsTrigger>
        </TabsList>

        <TabsContent value="entities" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Modelo 1 (Oficial)</CardTitle>
                <CardDescription>{model1.entities.length} entidades encontradas</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {model1.entities.map((entity, index) => (
                    <Badge key={index} variant="secondary" className="mr-2 mb-2">
                      {entity}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Modelo 2 (Avaliação)</CardTitle>
                <CardDescription>{model2.entities.length} entidades encontradas</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {model2.entities.map((entity, index) => (
                    <Badge key={index} variant="secondary" className="mr-2 mb-2">
                      {entity}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Entidades Comuns - simEa</CardTitle>
                <CardDescription>{results.commonEntitiesEa?.length || 0} correspondências exatas</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {results.commonEntitiesEa?.length > 0 ? (
                    results.commonEntitiesEa.map((entity, index) => (
                      <Badge key={index} variant="default" className="mr-2 mb-2 bg-green-100 text-green-800">
                        {entity}
                      </Badge>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">Nenhuma correspondência exata</p>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Entidades Comuns - simEb</CardTitle>
                <CardDescription>{results.commonEntitiesEb?.length || 0} correspondências parciais</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {results.commonEntitiesEb?.length > 0 ? (
                    results.commonEntitiesEb.map((entity, index) => (
                      <Badge key={index} variant="default" className="mr-2 mb-2 bg-yellow-100 text-yellow-800">
                        {entity}
                      </Badge>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">Nenhuma correspondência parcial</p>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Entidades Comuns - simEc</CardTitle>
                <CardDescription>
                  {results.commonEntitiesEc?.length || 0} correspondências por sinônimos
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {results.commonEntitiesEc?.length > 0 ? (
                    results.commonEntitiesEc.map((entity, index) => (
                      <Badge key={index} variant="default" className="mr-2 mb-2 bg-blue-100 text-blue-800">
                        {entity}
                      </Badge>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">Nenhuma correspondência por sinônimos</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Estatísticas</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                <div>
                  <div className="text-2xl font-bold">{results.commonEntities}</div>
                  <div className="text-sm text-muted-foreground">Entidades Comuns (Exatas)</div>
                </div>
                <div>
                  <div className="text-2xl font-bold">{model1.entities.length}</div>
                  <div className="text-sm text-muted-foreground">Entidades M1</div>
                </div>
                <div>
                  <div className="text-2xl font-bold">{model2.entities.length}</div>
                  <div className="text-sm text-muted-foreground">Entidades M2</div>
                </div>
                <div>
                  <div className="text-2xl font-bold">{results.totalEntities}</div>
                  <div className="text-sm text-muted-foreground">Total</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="relationships" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Relacionamentos M1</CardTitle>
                <CardDescription>{model1.relationships.length} relacionamentos</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {model1.relationships.length > 0 ? (
                    model1.relationships.map((rel, index) => (
                      <Badge key={index} variant="outline" className="mr-2 mb-2">
                        {rel}
                      </Badge>
                    ))
                  ) : (
                    <p className="text-muted-foreground">Nenhum relacionamento encontrado</p>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Relacionamentos M2</CardTitle>
                <CardDescription>{model2.relationships.length} relacionamentos</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {model2.relationships.length > 0 ? (
                    model2.relationships.map((rel, index) => (
                      <Badge key={index} variant="outline" className="mr-2 mb-2">
                        {rel}
                      </Badge>
                    ))
                  ) : (
                    <p className="text-muted-foreground">Nenhum relacionamento encontrado</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="algorithm" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Info className="h-5 w-5" />
                Detalhes do Algoritmo
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div>
                  <h4 className="font-semibold">simEa() - Correspondência Exata</h4>
                  <p className="text-sm text-muted-foreground mb-2">
                    Compara entidades usando correspondência exata (case-insensitive)
                  </p>
                  <code className="bg-muted p-2 rounded block text-xs">
                    simE(EM1, EM2) = (2 × CommonEntity) ÷ (EM1.length + EM2.length)
                  </code>
                  <p className="text-xs text-muted-foreground mt-1">
                    Resultado: {formatPercentage(results.simEa)} = (2 × {results.commonEntitiesEa?.length || 0}) ÷ (
                    {model1.entities.length} + {model2.entities.length})
                  </p>
                </div>

                <div>
                  <h4 className="font-semibold">simEb() - Correspondência Parcial</h4>
                  <p className="text-sm text-muted-foreground mb-2">
                    Usa correspondência parcial, similaridade de strings e matching flexível
                  </p>
                  <code className="bg-muted p-2 rounded block text-xs">
                    simE(EM1, EM2) = (2 × CommonEntity) ÷ (EM1.length + EM2.length)
                  </code>
                  <p className="text-xs text-muted-foreground mt-1">
                    Resultado: {formatPercentage(results.simEb)} = (2 × {results.commonEntitiesEb?.length || 0}) ÷ (
                    {model1.entities.length} + {model2.entities.length})
                  </p>
                </div>

                <div>
                  <h4 className="font-semibold">simEc() - API Sinônimos</h4>
                  <p className="text-sm text-muted-foreground mb-2">
                    Usa API de sinônimos para identificar entidades semanticamente equivalentes
                  </p>
                  <code className="bg-muted p-2 rounded block text-xs">CommonEntity = CommonEntity ÷ EM1.length</code>
                  <p className="text-xs text-muted-foreground mt-1">
                    Resultado: {formatPercentage(results.simEc)} = {results.commonEntitiesEc?.length || 0} ÷{" "}
                    {model1.entities.length}
                  </p>
                </div>
              </div>

              <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                <h5 className="font-semibold text-sm mb-2">Algoritmo Implementado:</h5>
                <pre className="text-xs text-muted-foreground whitespace-pre-wrap">
                  {`1. Ler M1(XML)
2. Ler M2(XML)  
3. EM1 = M1.entities
4. EM2 = M2.entities
5. RM1 = M1.relationships
6. RM2 = M2.relationships
7. Calcular entidades comuns:
   - s1 = simEa()
   - s2 = simEb() 
   - s3 = simEc()
8. Retornar valores s1, s2, s3`}
                </pre>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
