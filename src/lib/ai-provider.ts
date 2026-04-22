/**
 * Core module for interacting with the AI model across the application.
 * Supports both Cloud (Groq) and Local (LM Studio/Gemma 4) providers.
 */

const AI_PROVIDER = process.env.AI_PROVIDER || 'local'; // 'local' | 'groq' | 'openai'
const LOCAL_AI_API_URL = process.env.LOCAL_AI_API_URL || 'http://localhost:1234/v1';
const LOCAL_AI_MODEL = process.env.LOCAL_AI_MODEL || 'gemma-4-e4b-claude-4.6-opus-reasoning-distilled';

const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GROQ_MODEL = process.env.GROQ_MODEL || "deepseek-r1-distill-llama-70b";

export interface AIRequestOptions {
  systemPrompt?: string;
  temperature?: number;
  jsonMode?: boolean;
}

/**
 * Merkezi AI analiz fonksiyonu.
 * .env dosyasındaki AI_PROVIDER değerine göre yerel veya bulut API'sini çağırır.
 */
export async function fetchAiAnalysis(prompt: string, options: AIRequestOptions = {}) {
  const { systemPrompt = "You are MexCBrain AI Assistant.", temperature = 0.1, jsonMode = true } = options;

  let url: string;
  let headers: Record<string, string> = { "Content-Type": "application/json" };
  let body: any = {
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: prompt }
    ],
    temperature,
  };

  if (AI_PROVIDER === 'local') {
    url = `${LOCAL_AI_API_URL}/chat/completions`;
    body.model = LOCAL_AI_MODEL;
    // LM Studio usually doesn't need auth, but it's OpenAI compatible
  } else {
    // Groq configuration
    url = "https://api.groq.com/openai/v1/chat/completions";
    headers["Authorization"] = `Bearer ${GROQ_API_KEY}`;
    body.model = GROQ_MODEL;
    if (jsonMode) {
      body.response_format = { type: "json_object" };
    }
  }

  try {
    const res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errRes = await res.json().catch(() => ({}));
      throw new Error(`AI API Error (${AI_PROVIDER}): ${errRes.error?.message || res.statusText}`);
    }

    const data = await res.json();
    let content = data.choices[0]?.message?.content || "";

    // Deepseek/Gemma might contain <think> tags, remove them
    content = content.replace(/<think>[\s\S]*?<\/think>/g, "").trim();

    // Strip markdown wrappers if any
    if (jsonMode) {
      content = content.replace(/```json|```/g, "").trim();
      try {
        return JSON.parse(content);
      } catch (e) {
        console.warn("AI output is not valid JSON:", content);
        // Fallback: if it's not JSON but was expected to be, return raw if it looks like an object
        if (content.startsWith("{") && content.endsWith("}")) return JSON.parse(content.replace(/\n/g, ' '));
        throw new Error("AI returned malformed or non-JSON output");
      }
    }

    return content;
  } catch (error) {
    console.error(`AI Analysis (${AI_PROVIDER}) failed:`, error);
    throw error;
  }
}

/**
 * @deprecated Use fetchAiAnalysis instead
 */
export async function fetchGroqAnalysis(prompt: string) {
  return fetchAiAnalysis(prompt, { jsonMode: true });
}

