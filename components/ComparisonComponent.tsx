import React, { useState } from "react";
import { compareModelsFromFiles } from "../src/services/compare-models";

export const ComparisonComponent: React.FC = () => {
  const [file1, setFile1] = useState<File | null>(null);
  const [file2, setFile2] = useState<File | null>(null);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, setFile: (file: File | null) => void) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      setFile(files[0]);
    }
  };

  const handleCompare = async () => {
    setError(null);
    if (file1 && file2) {
      try {
        // habilita debug para inspecionar parsing / cache / providers no console
        const comparisonResult = await compareModelsFromFiles(file1, file2, { debug: true });
        setResult(comparisonResult);
      } catch (error: any) {
        console.error("Error during comparison:", error);
        setError(error.message || "An error occurred during comparison.");
      }
    } else {
      setError("Please select both files.");
    }
  };

  return (
    <div>
      <h1>XML Model Comparison</h1>
      <input type="file" onChange={(e) => handleFileChange(e, setFile1)} />
      <input type="file" onChange={(e) => handleFileChange(e, setFile2)} />
      <button onClick={handleCompare}>Compare</button>
      {error && <div style={{ color: "red" }}>{error}</div>}
      {result && (
        <div>
          <h2>Comparison Results</h2>
          <pre>{JSON.stringify(result, null, 2)}</pre>
        </div>
      )}
    </div>
  );
};
