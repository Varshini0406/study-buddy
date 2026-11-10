import { GoogleGenAI, type Content, type Part } from "@google/genai";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

type RequestMessage = { role: "user" | "model"; content: string };
type RequestAttachment = { name: string; type: string; data: string };

const MAX_FILE_BYTES = 3 * 1024 * 1024;
const ACCEPTED_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "text/plain",
  "text/markdown",
  "text/csv",
  "application/json",
]);

export async function GET() {
  return NextResponse.json({ configured: Boolean(process.env.GEMINI_API_KEY) });
}

export async function POST(request: Request) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "Add GEMINI_API_KEY to your deployment environment to enable the AI tutor." }, { status: 503 });
  }

  try {
    const body = await request.json() as { messages?: RequestMessage[]; topic?: string; attachment?: RequestAttachment };
    if (!Array.isArray(body.messages) || body.messages.length === 0) {
      return NextResponse.json({ error: "Add a question before sending." }, { status: 400 });
    }
    if (body.messages.length > 30 || body.messages.some((message) => typeof message.content !== "string" || !["user", "model"].includes(message.role))) {
      return NextResponse.json({ error: "This conversation is too long. Start a new chat to continue." }, { status: 400 });
    }

    const history: Content[] = body.messages.slice(-12).map((message) => ({
      role: message.role,
      parts: [{ text: message.content.slice(0, 12000) }],
    }));
    const last = history.pop();
    if (!last || last.role !== "user") {
      return NextResponse.json({ error: "Your latest message should be a question." }, { status: 400 });
    }

    const parts: Part[] = [...(last.parts ?? [])];
    if (body.attachment) {
      const { name, type, data } = body.attachment;
      if (!ACCEPTED_TYPES.has(type) || typeof data !== "string") {
        return NextResponse.json({ error: "That file type is not supported. Try a PDF, image, text, Markdown, CSV, or JSON file." }, { status: 415 });
      }
      const fileBytes = Buffer.from(data, "base64");
      if (fileBytes.byteLength > MAX_FILE_BYTES) {
        return NextResponse.json({ error: "Files must be 3 MB or smaller." }, { status: 413 });
      }
      if (type.startsWith("text/") || type === "application/json") {
        parts.push({ text: `\nUploaded text file: ${name}\n${fileBytes.toString("utf8").slice(0, 50000)}` });
      } else {
        parts.push({ inlineData: { mimeType: type, data: fileBytes.toString("base64") } });
        parts[0] = { text: `${parts[0]?.text ?? ""}\nThe attached file is ${name}. Use it as visual/document context, identify what it shows, and explain it clearly.` };
      }
    }
    last.parts = parts;
    history.push(last);

    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: history,
      config: {
        systemInstruction: `You are Study Buddy, a clear, encouraging learning tutor. Explain ideas in plain language, then give a useful example. Be honest when information is uncertain. If a learner shares an image, describe what is visibly present before interpreting it. If they share a document, ground answers in that material and say when it does not contain the answer. Ask one thoughtful follow-up when useful. ${body.topic ? `The learner's current topic is: ${body.topic}.` : ""}`,
        temperature: 0.6,
      },
    });
    const answer = response.text?.trim();
    if (!answer) throw new Error("The AI returned an empty answer. Please try again.");
    return NextResponse.json({ answer });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to answer right now.";
    console.error("Study Buddy chat failed:", message);
    if (/429|RESOURCE_EXHAUSTED/i.test(message)) {
      return NextResponse.json({ error: "The AI tutor is busy. Wait a moment and try again." }, { status: 429 });
    }
    return NextResponse.json({ error: "The AI could not answer that just now. Check your connection and try again." }, { status: 500 });
  }
}