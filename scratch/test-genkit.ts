
import { config } from 'dotenv';
config();
import { ai } from '../src/ai/genkit';
import { googleAI } from '@genkit-ai/google-genai';

async function testGenkit() {
  try {
    console.log("Testing Genkit with gemini-3.1-flash-lite-preview...");
    const result = await ai.generate({
      model: googleAI.model('gemini-3.1-flash-lite-preview'),
      prompt: "Hello",
    });
    console.log("Success:", result.text);
  } catch (error) {
    console.error("Genkit Error Details:", error);
  }
}

testGenkit();
