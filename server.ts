import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenAI, Type } from '@google/genai';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let aiInstance: GoogleGenAI | null = null;

/**
 * Lazy initializer for the Gemini client to prevent crashes if key is not yet set
 */
function getGeminiClient(): GoogleGenAI {
  if (!aiInstance) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is not defined. Please add it to Settings > Secrets in AI Studio.");
    }
    aiInstance = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  }
  return aiInstance;
}

async function startServer() {
  const app = express();
  app.use(express.json());

  // Health and API checks
  app.get('/api/health', (req, res) => {
    const hasKey = !!process.env.GEMINI_API_KEY;
    res.json({
      status: 'ok',
      apiKeySet: hasKey,
      message: hasKey ? 'Ready to connect' : 'GEMINI_API_KEY is missing. Please add it in Settings > Secrets.'
    });
  });

  // 1. Text Generation Endpoint (Prompt Lab & Code Companion)
  app.post('/api/generate', async (req, res) => {
    try {
      const { prompt, systemInstruction, temperature } = req.body;
      if (!prompt) {
        return res.status(400).json({ error: 'Prompt is required' });
      }

      const ai = getGeminiClient();
      const config: any = {};
      
      if (systemInstruction) {
        config.systemInstruction = systemInstruction;
      }
      if (typeof temperature === 'number') {
        config.temperature = temperature;
      }

      const response = await ai.models.generateContent({
        model: 'gemini-3.5-flash',
        contents: prompt,
        config,
      });

      res.json({ text: response.text });
    } catch (error: any) {
      console.error('Error generating content:', error);
      res.status(500).json({ error: error.message || 'Failed to generate content' });
    }
  });

  // 2. Structured JSON Generation Endpoint (Schema Lab)
  app.post('/api/generate-schema', async (req, res) => {
    try {
      const { prompt, schemaName, fields, systemInstruction } = req.body;
      if (!prompt) {
        return res.status(400).json({ error: 'Prompt is required' });
      }
      if (!fields || !Array.isArray(fields) || fields.length === 0) {
        return res.status(400).json({ error: 'At least one field definition is required' });
      }

      const ai = getGeminiClient();

      // Dynamically assemble the Gemini schema properties
      const properties: any = {};
      const required: string[] = [];

      fields.forEach((field: { name: string; type: string; description?: string; required?: boolean }) => {
        let geminiType = Type.STRING;
        if (field.type === 'number') geminiType = Type.NUMBER;
        if (field.type === 'integer') geminiType = Type.INTEGER;
        if (field.type === 'boolean') geminiType = Type.BOOLEAN;
        if (field.type === 'array') geminiType = Type.ARRAY;

        properties[field.name] = {
          type: geminiType,
          description: field.description || `The ${field.name} field.`
        };

        if (field.type === 'array') {
          properties[field.name].items = { type: Type.STRING };
        }

        if (field.required !== false) {
          required.push(field.name);
        }
      });

      const responseSchema = {
        type: Type.OBJECT,
        properties,
        required
      };

      const response = await ai.models.generateContent({
        model: 'gemini-3.5-flash',
        contents: prompt,
        config: {
          systemInstruction: systemInstruction || 'You are a highly precise data extractor. Extract data according to the schema.',
          responseMimeType: 'application/json',
          responseSchema,
        },
      });

      res.json({ text: response.text });
    } catch (error: any) {
      console.error('Error generating schema content:', error);
      res.status(500).json({ error: error.message || 'Failed to generate structured schema' });
    }
  });

  // 3. OpenAI Health & Wellness Assistant API Route
  app.post('/api/openai-chat', async (req, res) => {
    try {
      const { prompt } = req.body;
      if (!prompt) {
        return res.status(400).json({ error: 'Prompt is required' });
      }

      const openAiKey = process.env.OPENAI_API_KEY;

      const systemInstruction = `You are a clinical wellness assistant powered by OpenAI API.
      You must strictly answer ONLY questions about:
      1. Health Questions
      2. Medicine Reminders (guidelines, frequency, scheduling tips)
      3. Lifestyle Tips (nutrition, fitness, stress relief, wellness metrics)
      4. Emergency Advice (first aid, safety protocols, immediate help instructions)

      CRITICAL CONSTRAINTS:
      - NEVER diagnose any diseases. If the user presents symptoms and asks what disease they have or what is wrong with them, politely state that you are an AI assistant and cannot diagnose diseases. Suggest consulting a certified physician immediately or going to an empanelled hospital (like Apollo or Max Super Speciality).
      - NEVER recommend specific Rx prescription drugs or clinical dosages.
      - ALWAYS append a prominent, clear medical disclaimer at the very bottom of your response in bold and italic markdown style, as follows:
        "*Disclaimer: I am an OpenAI Health Companion, not a certified doctor. Please consult a qualified medical professional for any diagnosis, treatment, or medical emergencies.*"`;

      if (openAiKey) {
        // Call actual OpenAI API
        console.log('[Server] Dispatching request to real OpenAI API completions endpoint...');
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${openAiKey}`
          },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages: [
              { role: 'system', content: systemInstruction },
              { role: 'user', content: prompt }
            ],
            temperature: 0.6
          })
        });

        if (!response.ok) {
          const errBody = await response.json().catch(() => ({}));
          throw new Error(errBody?.error?.message || `OpenAI API returned status code ${response.status}`);
        }

        const openAiData = await response.json();
        const textResponse = openAiData.choices?.[0]?.message?.content || 'No response from OpenAI.';
        res.json({ text: textResponse, provider: 'OpenAI' });
      } else {
        // Fallback gracefully to Gemini with the same OpenAI system constraints!
        console.log('[Server] OpenAI key not found, routing request through Gemini OpenAI ProxyFallback...');
        const ai = getGeminiClient();
        const response = await ai.models.generateContent({
          model: 'gemini-3.5-flash',
          contents: prompt,
          config: {
            systemInstruction,
            temperature: 0.6
          }
        });
        res.json({ text: response.text, provider: 'Gemini (OpenAI Proxy)' });
      }
    } catch (error: any) {
      console.error('Error in OpenAI chat proxy:', error);
      res.status(500).json({ error: error.message || 'Failed to generate OpenAI chat response' });
    }
  });

  // Vite Integration
  if (process.env.NODE_ENV === 'production') {
    // Serve static frontend assets from dist/
    app.use(express.static(path.join(__dirname, 'dist')));
    
    app.get('*', (req, res) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  } else {
    // Development Mode - Use Vite Dev Middleware
    console.log('Starting Vite in middleware mode...');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  const port = 3000;
  app.listen(port, '0.0.0.0', () => {
    console.log(`[Server] Running on port ${port} (NODE_ENV=${process.env.NODE_ENV || 'development'})`);
  });
}

startServer().catch((err) => {
  console.error('Server startup failed:', err);
  process.exit(1);
});
