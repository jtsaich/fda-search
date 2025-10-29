'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createChat } from '@/lib/chat-store';
import { Loader2 } from 'lucide-react';

export default function ChatPage() {
  const router = useRouter();

  useEffect(() => {
    async function createNewChat() {
      try {
        console.log('Creating new chat...');
        const id = await createChat();
        console.log('Chat created with ID:', id);
        router.push(`/chat/${id}`);
      } catch (error) {
        console.error('Failed to create chat:', error);
        // Retry once after a short delay
        setTimeout(async () => {
          try {
            const id = await createChat();
            router.push(`/chat/${id}`);
          } catch (retryError) {
            console.error('Retry failed:', retryError);
            alert('Failed to create new chat. Please try again.');
          }
        }, 1000);
      }
    }

    createNewChat();
  }, [router]);

  return (
    <div className="flex items-center justify-center h-screen bg-gray-50">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        <p className="text-gray-600">Creating new chat...</p>
      </div>
    </div>
  );
}
