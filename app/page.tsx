"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { FileText, Calculator } from "lucide-react"
import { XMLParser } from "@/components/xml-parser"
import { SimilarityCalculator } from "@/components/similarity-calculator"
import { ResultsDisplay } from "@/components/results-display"

interface ModelData {
  entities: string[]
  relationships: string[]
}

interface SimilarityResults {
  simEa: number
  simEb: number
  simEc: number
  commonEntities: number
  totalEntities: number
}

export default function XMLSimilarityReader() {
  const [file1, setFile1] = useState<File | null>(null)
  const [file2, setFile2] = useState<File | null>(null)
  const [model1, setModel1] = useState<ModelData | null>(null)
  const [model2, setModel2] = useState<ModelData | null>(null)
  const [results, setResults] = useState<SimilarityResults | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleFileUpload = (file: File, modelNumber: 1 | 2) => {
    if (modelNumber === 1) {
      setFile1(file)
      setModel1(null)
    } else {
      setFile2(file)
      setModel2(null)
    }
    setResults(null)
    setError(null)
  }

  const parseXMLFiles = async () => {
    if (!file1 || !file2) {
      setError("Por favor, selecione ambos os arquivos XML")
      return
    }

    setLoading(true)
    setError(null)

    try {
      const parser = new XMLParser()

      const text1 = await file1.text()
      const text2 = await file2.text()

      const parsedModel1 = parser.parseXML(text1)
      const parsedModel2 = parser.parseXML(text2)

      setModel1(parsedModel1)
      setModel2(parsedModel2)

      // Calculate similarity
      const calculator = new SimilarityCalculator()
      const similarityResults = calculator.calculateSimilarity(parsedModel1, parsedModel2)

      setResults(similarityResults)
    } catch (err) {
      setError(`Erro ao processar arquivos XML: ${err instanceof Error ? err.message : "Erro desconhecido"}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Leitor de XML - Comparação de Similaridade</h1>
        <p className="text-muted-foreground">
          Compare a similaridade entre dois modelos XML usando algoritmos de análise de entidades e relacionamentos
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Upload Model 1 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Modelo 1 (Oficial)
            </CardTitle>
            <CardDescription>Selecione o arquivo XML do modelo de referência</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <Label htmlFor="file1">Arquivo XML</Label>
                <Input
                  id="file1"
                  type="file"
                  accept=".xml"
                  onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0], 1)}
                />
              </div>
              {file1 && <div className="text-sm text-muted-foreground">Arquivo selecionado: {file1.name}</div>}
            </div>
          </CardContent>
        </Card>

        {/* Upload Model 2 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Modelo 2 (Avaliação)
            </CardTitle>
            <CardDescription>Selecione o arquivo XML do modelo a ser comparado</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <Label htmlFor="file2">Arquivo XML</Label>
                <Input
                  id="file2"
                  type="file"
                  accept=".xml"
                  onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0], 2)}
                />
              </div>
              {file2 && <div className="text-sm text-muted-foreground">Arquivo selecionado: {file2.name}</div>}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Process Button */}
      <div className="mb-6">
        <Button onClick={parseXMLFiles} disabled={!file1 || !file2 || loading} className="w-full" size="lg">
          {loading ? (
            <>
              <Calculator className="mr-2 h-4 w-4 animate-spin" />
              Processando...
            </>
          ) : (
            <>
              <Calculator className="mr-2 h-4 w-4" />
              Calcular Similaridade
            </>
          )}
        </Button>
      </div>

      {/* Error Display */}
      {error && (
        <Alert className="mb-6" variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Loading Progress */}
      {loading && (
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Processando arquivos XML...</span>
                <span>Calculando similaridade</span>
              </div>
              <Progress value={undefined} className="w-full" />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Results */}
      {results && model1 && model2 && <ResultsDisplay results={results} model1={model1} model2={model2} />}
    </div>
  )
}
