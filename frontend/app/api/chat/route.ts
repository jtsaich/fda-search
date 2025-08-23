// Simplified API route - backend now handles LLM generation
export const maxDuration = 30;

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
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";
    const ragResponse = await fetch(`${backendUrl}/query`, {
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

    // Return the response directly from the backend (it already includes sources)
    return new Response(ragData.answer, {
      headers: {
        'Content-Type': 'text/plain',
      },
    });
  } catch (error) {
    console.error("Error in chat API:", error);

    // Return simple error response
    return new Response(
      "I apologize, but I encountered an error processing your request. Please try again.",
      {
        status: 500,
        headers: {
          'Content-Type': 'text/plain',
        },
      }
    );
  }
}
