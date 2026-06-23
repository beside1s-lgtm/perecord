
const { GoogleGenerativeAI } = require("@google/generative-ai");
require('dotenv').config();

async function listModels() {
  const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GENAI_API_KEY || process.env.GEMINI_API_KEY);
  try {
    // There isn't a direct listModels in the high-level SDK, 
    // but we can try to initialize one and see if it fails with 403 immediately or on call.
    const model = genAI.getGenerativeModel({ model: "gemini-3.1-flash-lite-preview" });
    console.log("Model initialized. Attempting a simple generation...");
    const result = await model.generateContent("Hi");
    console.log("Success:", result.response.text());
  } catch (error) {
    console.error("Error details:", error);
    if (error.message.includes("403")) {
      console.error("CONFIRMED: 403 Forbidden. This key/project cannot access this model.");
    }
  }
}

listModels();
