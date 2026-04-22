import { VertexAI } from "@google-cloud/vertexai";

const vertex = new VertexAI({
  project: "gen-lang-client-0456497470",
  location: "us-central1",
});

const model = vertex.getGenerativeModel({
  model: "gemini-2.5-pro",
});

try {
  const response = await model.generateContent({
    contents: [{ role: "user", parts: [{ text: "Say 'hello'" }] }],
    generationConfig: {
      temperature: 0.3,
      maxOutputTokens: 100,
      responseMimeType: "text/plain",
    },
  });
  console.log("Full response structure:");
  console.log(JSON.stringify(response, null, 2));
} catch (e) {
  console.error("Error:", (e as Error).message);
}
