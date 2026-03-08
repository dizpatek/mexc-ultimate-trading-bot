/**
 * Core module for interacting with the AI model across the application.
 * Migrated from Claude to Groq API using deepseek-r1-distill-llama-70b
 */

const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GROQ_MODEL = process.env.GROQ_MODEL || "deepseek-r1-distill-llama-70b";

export async function fetchGroqAnalysis(prompt: string) {
  try {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: [{ role: "user", content: prompt }],
        temperature: 0.1,
        max_completion_tokens: 1500,
        response_format: { type: "json_object" }
      }),
    });

    if (!res.ok) {
      const errRes = await res.json().catch(() => ({}));
      throw new Error(`Groq API Error: ${errRes.error?.message || res.statusText}`);
    }

    const data = await res.json();
    let content = data.choices[0]?.message?.content || "";
    // Deepseek might contain <think> tags, remove them
    content = content.replace(/<think>[\s\S]*?<\/think>/g, "").trim();

    // Strip markdown JSON wrappers if any
    content = content.replace(/```json|```/g, "").trim();
    
    // P3.2 LOGICAL FIX: Implement safe JSON parsing with fallback
    try {
      return JSON.parse(content);
    } catch {
      console.warn("Failed to parse AI output as JSON. Output:", content);
      throw new Error("AI returned malformed or non-JSON output");
    }
  } catch (error) {
    console.error("AI Analysis failed:", error);
    throw error;
  }
}
