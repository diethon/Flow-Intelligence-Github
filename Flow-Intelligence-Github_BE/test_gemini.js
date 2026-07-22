const { GoogleGenAI } = require('@google/genai');
require('dotenv').config();

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY_CHAT });

async function test() {
  const models = [
    'gemini-2.0-flash',
    'gemini-2.0-flash-lite-001',
    'gemini-3.1-flash-lite',
    'gemma-4-31b-it'
  ];
  
  for (const model of models) {
    try {
      console.log(`Testing ${model}...`);
      const response = await ai.models.generateContent({
        model: model,
        contents: 'Hello',
      });
      console.log(`SUCCESS with ${model}!`);
    } catch (err) {
      console.error(`FAILED with ${model}:`, err.status || err.message);
    }
  }
}
test();
