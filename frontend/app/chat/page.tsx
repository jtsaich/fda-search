import { redirect } from 'next/navigation';
import { createChat } from '@/lib/chat-store';

export default async function ChatPage() {
  // Create a new chat and redirect to it
  const id = await createChat();
  redirect(`/chat/${id}`);
}
