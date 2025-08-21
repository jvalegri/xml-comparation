import { compareModelsFromStrings, compareModelsFromFiles } from "../src/services/compare-models";

export async function handleComparison(xmlOficial: string, xmlAvaliacao: string) {
  try {
    if (!xmlOficial || !xmlAvaliacao) {
      throw new Error("Both XML inputs must be provided.");
    }
    const result = await compareModelsFromStrings(xmlOficial, xmlAvaliacao);
    console.log("Comparison Results:", result);
    return result;
  } catch (error) {
    console.error("Error during comparison:", error);
    throw error;
  }
}

export async function handleFileComparison(file1: File, file2: File) {
  try {
    if (!file1 || !file2) {
      throw new Error("Both files must be provided.");
    }
    const result = await compareModelsFromFiles(file1, file2);
    console.log("Comparison Results:", result);
    return result;
  } catch (error) {
    console.error("Error during file comparison:", error);
    throw error;
  }
}
