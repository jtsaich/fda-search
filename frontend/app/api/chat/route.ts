import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { streamText, convertToModelMessages, UIMessage } from 'ai';

// Allow streaming responses up to 30 seconds
export const maxDuration = 30;

const openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY,
});

export async function POST(req: Request) {
  const { messages }: { messages: UIMessage[] } = await req.json();

  console.log('Received messages:', JSON.stringify(messages, null, 2));

  const result = streamText({
    model: openrouter('meta-llama/llama-3.2-3b-instruct:free'),
    system: 'You are a helpful FDA regulatory assistant. Answer questions about FDA regulations and processes.',
    messages: convertToModelMessages(messages),
    temperature: 0.3,
  });

  return result.toUIMessageStreamResponse();
}