import { NextApiRequest, NextApiResponse } from "next";
import { compareModelsFromStrings } from "../../src/services/compare-models";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === "POST") {
    const { xmlOficial, xmlAvaliacao } = req.body;

    console.log("[API] Received xmlOficial:", xmlOficial);
    console.log("[API] Received xmlAvaliacao:", xmlAvaliacao);

    if (!xmlOficial || !xmlAvaliacao) {
      console.error("[API] Missing XML inputs.");
      return res.status(400).json({ error: "Both XML inputs are required." });
    }

    try {
      console.log("[API] Comparing models...");
      const result = await compareModelsFromStrings(xmlOficial, xmlAvaliacao);
      console.log("[API] Comparison Result:", result);

      return res.status(200).json(result);
    } catch (error) {
      console.error("[API] Error during comparison:", error);
      return res.status(500).json({ error: "Internal Server Error" });
    }
  } else {
    res.setHeader("Allow", ["POST"]);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}
