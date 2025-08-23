import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { streamText } from "ai";

// Allow streaming responses up to 30 seconds
export const maxDuration = 30;

const openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY,
});

interface QueryResponse {
  answer: string;
  sources: Array<{
    document_id: string;
    filename: string;
    chunk_text: string;
    similarity_score: number;
    chunk_index: number;
  }>;
  confidence: number;
}

export async function POST(req: Request) {
  try {
    const { messages } = await req.json();

    // Get the latest user message
    const lastMessage = messages[messages.length - 1];
    if (!lastMessage || lastMessage.role !== "user") {
      throw new Error("No user message found");
    }

    // Extract text from message
    let messageText: string = "";
    if (lastMessage.content) {
      messageText = lastMessage.content;
    } else if (lastMessage.parts) {
      messageText = lastMessage.parts
        .filter((part: any) => part.type === "text")
        .map((part: any) => part.text)
        .join(" ");
    }

    console.log("Query:", messageText);

    // Query the RAG backend
    const ragResponse = await fetch("http://localhost:8000/query", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query: messageText,
        max_results: 3,
      }),
    });

    if (!ragResponse.ok) {
      throw new Error(`Backend error: ${ragResponse.status}`);
    }

    const ragData: QueryResponse = await ragResponse.json();

    // Format response with sources
    let responseText = ragData.answer;

    if (ragData.sources.length > 0) {
      responseText += "\n\n**Sources:**\n";
      ragData.sources.forEach((source, index) => {
        responseText += `${index + 1}. ${source.filename} (similarity: ${(
          source.similarity_score * 100
        ).toFixed(1)}%)\n`;
      });
    }

    // Use the OpenRouter model to stream the RAG response
    const result = streamText({
      model: openrouter("meta-llama/llama-3.2-3b-instruct:free"),
      system: `You are a helpful FDA regulatory assistant. The user has asked a question and here is the relevant information from the knowledge base:\n\n${responseText}\n\nPlease provide this information as your response, keeping the formatting and sources intact.`,
      messages: [{ role: "user", content: messageText }],
      temperature: 0.1,
    });

    return result.toUIMessageStreamResponse();
  } catch (error) {
    console.error("Error in chat API:", error);

    // Fallback to a simple error response
    const result = streamText({
      model: openrouter("meta-llama/llama-3.2-3b-instruct:free"),
      messages: [
        {
          role: "user",
          content:
            "I apologize, but I encountered an error processing your request. Please try again.",
        },
      ],
    });

    return result.toUIMessageStreamResponse();
  }
}
