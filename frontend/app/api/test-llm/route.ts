export async function POST(req: Request) {
  const requestBody = await req.json();
  console.log('Received request:', JSON.stringify(requestBody, null, 2));
  
  // Extract text from the messages array sent by AI SDK
  let queryText = '';
  if (requestBody.messages && requestBody.messages.length > 0) {
    const lastMessage = requestBody.messages[requestBody.messages.length - 1];
    if (lastMessage.parts && lastMessage.parts.length > 0) {
      queryText = lastMessage.parts[0].text;
    } else if (lastMessage.content) {
      queryText = lastMessage.content;
    }
  }
  
  if (!queryText) {
    queryText = 'Hello, what is the FDA?'; // fallback for testing
  }
  
  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'meta-llama/llama-3.2-3b-instruct:free',
        messages: [
          {
            role: 'system',
            content: 'You are a helpful FDA regulatory assistant. Answer questions about FDA regulations and processes.'
          },
          {
            role: 'user',
            content: queryText
          }
        ],
        temperature: 0.3,
        max_tokens: 500
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      throw new Error(`OpenRouter API error: ${response.status} - ${errorData}`);
    }

    const data = await response.json();
    const llmResponse = data.choices[0].message.content;

    // Return in AI SDK v5 format
    const responseMessage = {
      id: crypto.randomUUID(),
      role: 'assistant',
      parts: [
        {
          type: 'text',
          text: llmResponse
        }
      ]
    };
    
    console.log('Sending response:', JSON.stringify(responseMessage, null, 2));
    return Response.json(responseMessage);
  } catch (error) {
    console.error('LLM Test Error:', error);
    return Response.json({
      id: crypto.randomUUID(),
      role: 'assistant',
      parts: [
        {
          type: 'text',
          text: `Error testing LLM: ${error instanceof Error ? error.message : 'Unknown error'}`
        }
      ]
    }, { status: 500 });
  }
}