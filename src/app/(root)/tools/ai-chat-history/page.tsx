"use client";
import React, { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Loader2,
  Send,
  PanelRightClose,
  Plus,
  MessageSquare,
  Copy,
  Check,
  Edit2,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  Bot,
  X,
  SquarePen,
  Search,
} from "lucide-react";
import type {
  ChatMessage,
  ChatSession,
  ModelType,
} from "@/schemas/chat-schema";
import { cn } from "@/lib/utils";

import { v4 as uuidv4 } from "uuid";
import {
  createSession,
  getUserSessions,
  addMessage,
  generateResponse,
  renameSession,
  deleteSession,
  duplicateSession,
  suggestChatTitle,
  updateSessionTitle,
  addRetryResponse,
} from "@/lib/chat-service";
import { useUser } from "@clerk/nextjs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import ReactMarkdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import { PromptRecord, Session, SessionManager } from "@/components/chat/SessionManager";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { MessageActions } from "@/components/chat/MessageActions";
import { ReportButton } from "@/components/ReportButton";
import jsPDF from "jspdf";
import { PromptViolationIndicator } from "@/components/chat/PromptViolationIndicator";
import SubscriptionDialog from "@/components/SubscriptionDialog";

interface ContentFlags {
  pii_detected?: boolean;
  content_violation?: boolean;
  bias_detected?: boolean;
  prompt_injection_detected?: boolean;
  fraudulent_intent_detected?: boolean;
  misinformation_detected?: boolean;
  self_harm_detected?: boolean;
  extremist_content_detected?: boolean;
  child_safety_violation?: boolean;
  automation_misuse_detected?: boolean;
  moderator_approval?: 'pending' | 'approved' | 'declined' | 'not_requested';
}

export default function AIChatHistory() {
  const { user } = useUser();
  const [isLoading, setIsLoading] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSession, setCurrentSession] = useState<ChatSession | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [currentModel] = useState<ModelType>("gpt-4-turbo-preview");
  const [isWaiting, setIsWaiting] = useState(false);
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const [isCreatingNewChat, setIsCreatingNewChat] = useState(false);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [messageResponses, setMessageResponses] = useState<
    Record<string, number>
  >({});
  const [regeneratingMessages, setRegeneratingMessages] = useState<Set<string>>(
    new Set()
  );
  const [isInitializing, setIsInitializing] = useState(false);
  const initRef = useRef(false);
  const [inputError, setInputError] = useState<string | null>(null);
  const [responseCountMap, setResponseCountMap] = useState<Record<string, number>>({});
  const [streamingMessages, setStreamingMessages] = useState<Set<string>>(new Set());
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showSubscriptionDialog, setShowSubscriptionDialog] = useState(false);

  useEffect(() => {
    const initializeChat = async () => {
      if (isInitializing || initRef.current) return;

      setIsInitializing(true);
      initRef.current = true;

      try {
        // Get user sessions
        const userSessions = await getUserSessions(user?.id || "");
        setSessions(userSessions);

        // Check if accessing via approved URL
        const searchParams = new URLSearchParams(window.location.search);
        const approvedId = searchParams.get('approved');

        // Get the last session and check if it's empty
        const lastSession = userSessions.length > 0 ? userSessions[0] : null;
        const isEmptySession = lastSession && (!lastSession.messages || lastSession.messages.length === 0);

        // Create new chat if no sessions, no empty sessions, or accessing via approved URL
        if (!lastSession || (!isEmptySession && !currentSession) || approvedId) {
          const initialTitle = approvedId ?
            `Approved Chat - ${new Date().toLocaleString()}` :
            `New Chat - ${new Date().toLocaleString()}`;

          const newSession = await createSession(
            user?.id || "",
            initialTitle,
            currentModel
          );
          setSessions((prev) => [newSession, ...prev]);
          setCurrentSession(newSession);

          // If accessing via approved URL, automatically send first message
          if (approvedId) {
            try {
              // Fetch the approved prompt from the database
              const response = await fetch(`/api/moderator/violations/${approvedId}`, {
                method: 'GET',
                headers: {
                  'Content-Type': 'application/json',
                }
              });

              if (!response.ok) {
                throw new Error('Failed to fetch approved prompt');
              }

              const data = await response.json();

              // Check if we have the prompt text
              if (!data.data?.promptText) {
                throw new Error('No prompt text found');
              }

              const messageId = uuidv4();

              const userMessage: ChatMessage = {
                id: messageId,
                role: "user",
                content: data.data.promptText,
                model: currentModel,
                created_at: new Date().toISOString(),
                contentFlags: {
                  moderator_approval: 'approved' as const
                } as ContentFlags
              };

              setMessages([userMessage]);

              try {
                const response = await fetch("/api/chat/approved", {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                  },
                  body: JSON.stringify({
                    message: data.data.promptText,
                    model: currentModel,
                    sessionId: newSession.id,
                    messageId: messageId,
                    isApproved: true
                  }),
                });

                if (!response.ok) {
                  throw new Error('Failed to get response');
                }

                const reader = response.body?.getReader();
                if (!reader) throw new Error("No response stream available");

                const assistantMessage: ChatMessage = {
                  id: uuidv4(),
                  role: "assistant",
                  content: "",
                  model: currentModel,
                  created_at: new Date().toISOString(),
                };

                setMessages((prev) => [...prev, assistantMessage]);

                const decoder = new TextDecoder();
                let responseText = "";

                while (true) {
                  const { done, value } = await reader.read();
                  if (done) break;

                  const chunk = decoder.decode(value);
                  responseText += chunk;

                  setMessages((prev) =>
                    prev.map((msg) =>
                      msg.id === assistantMessage.id
                        ? { ...msg, content: responseText }
                        : msg
                    )
                  );
                }

              } catch (error) {
                console.error("Failed to get initial response:", error);
              }
            } catch (error) {
              console.error("Failed to fetch approved prompt:", error);
            }
          }
        } else if (isEmptySession && !currentSession) {
          // Use existing empty session
          setCurrentSession(lastSession);
        }
      } finally {
        setIsInitializing(false);
      }
    };

    if (user) {
      initializeChat();
    }
  }, [user]);

  useEffect(() => {
    if (currentSession) {
      setMessages(currentSession.messages || []);
    } else {
      setMessages([]);
    }
  }, [currentSession]);

  useEffect(() => {
    const updateResponseCounts = () => {
      const newCountMap: Record<string, number> = {};

      messages.forEach(message => {
        if (message.role === 'assistant' && message.response_history) {
          // For each message, store currentResponseIndex + 1 as the count
          newCountMap[message.id] = (message.currentResponseIndex || 0) + 1;
        }
      });

      setResponseCountMap(newCountMap);
    };

    updateResponseCounts();
  }, [messages]);

  const handleCreateNewSession = async () => {
    if (!user?.id) return;
    setIsCreatingNewChat(true);
    try {
      const initialTitle = `New Chat - ${new Date().toLocaleString()}`;
      const newSession = await createSession(
        user.id,
        initialTitle,
        currentModel
      );
      setSessions((prev) => [newSession, ...prev]);
      setCurrentSession(newSession);
      setMessages([]);
    } catch (error) {
      console.error("Failed to create session:", error);
    } finally {
      setIsCreatingNewChat(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Early premium/usage check
    try {
      const res = await fetch("/api/check-premium", {
        method: "GET",
        headers: {
          'Content-Type': 'application/json'
        }
      });
      const data = await res.json();
      if (!data.premium && data.usageExceeded) {
        setShowSubscriptionDialog(true);
        return;
      }
    } catch (err) {
      console.error("Error checking premium status:", err);
    }

    // Early return if no session
    if (!currentSession?.id) {
      toast.error("No active session. Please wait or refresh the page.");
      return;
    }

    if (!input.trim() || isLoading) return;

    const messageId = uuidv4();
    const searchParams = new URLSearchParams(window.location.search);
    const isApproved = searchParams.has('approved');

    // Log session info for debugging
    console.log('Current session:', currentSession);

    const requestBody = {
      message: input.trim(),
      model: currentModel,
      sessionId: currentSession.id,  // This should now be guaranteed to exist
      messageId: messageId,
      isApproved // Add this flag to indicate if we should skip moderation
    };

    console.log('Sending request with:', requestBody);

    const userMessage: ChatMessage = {
      id: messageId,
      role: "user",
      content: input.trim(),
      model: currentModel,
      created_at: new Date().toISOString(),
    };

    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setInput("");
    setIsLoading(true);
    setIsWaiting(true);

    const assistantMessage: ChatMessage = {
      id: uuidv4(),
      role: "assistant",
      content: "",
      model: currentModel,
      created_at: new Date().toISOString(),
    };

    try {
      // Only add message and get content flags if not in approved mode
      if (!isApproved) {
        const updatedSession = await addMessage(currentSession.id, userMessage);

        // Update messages with the flagged message from the session
        const flaggedMessage = updatedSession.messages.find(m => m.id === messageId);
        if (flaggedMessage) {
          setMessages(prev => prev.map(m =>
            m.id === messageId ? {
              ...m,
              contentFlags: flaggedMessage.contentFlags // Use the exact flags from server
            } : m
          ));
        }
      }

      if (currentSession.title.startsWith("New Chat") && updatedMessages.length >= 2) {
        await updateSessionTitle(currentSession.id, user!.id, updatedMessages);
        await loadSessions();
      }

      // Use different endpoints based on approval status
      const endpoint = isApproved ? "/api/chat/approved" : "/api/chat";
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Error response:', errorData);
        throw new Error(errorData.error || 'Failed to get response');
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No response stream available");

      setMessages((prev) => [...prev, assistantMessage]);
      const decoder = new TextDecoder();
      let responseText = "";

      try {
        setStreamingMessages(prev => new Set(prev).add(assistantMessage.id));

        while (true) {
          const { done, value } = await reader.read();

          if (value) {
            setIsWaiting(false);
          }

          if (done) {
            setStreamingMessages(prev => {
              const next = new Set(prev);
              next.delete(assistantMessage.id);
              return next;
            });
            break;
          }

          const chunk = decoder.decode(value);
          responseText += chunk;

          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantMessage.id
                ? { ...msg, content: responseText }
                : msg
            )
          );
        }

        // Only save to database if not in approved mode
        if (!isApproved) {
          await addMessage(currentSession.id, {
            ...assistantMessage,
            content: responseText,
          });
        }

        await loadSessions();

      } catch (error) {
        console.error("Stream Error:", error);
        throw error;
      } finally {
        reader.releaseLock();
      }
    } catch (error) {
      console.error("Failed to get response:", error);
      setMessages((prev) => [
        ...prev,
        {
          ...assistantMessage,
          content: `Error: ${error instanceof Error
            ? error.message
            : "Something went wrong. Please try again."
            }`,
          isError: true,
        },
      ]);
    } finally {
      setIsLoading(false);
      setIsWaiting(false);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const LoadingSkeleton = () => (
    <div className='px-4 py-8 w-full bg-muted/50'>
      <div className='max-w-2xl mx-auto flex gap-4'>
        <Avatar className='h-8 w-8 bg-[#70CDB3] flex items-center justify-center'>
          <Bot className='h-4 w-4 text-white' />
        </Avatar>
        <div className='flex-1 space-y-3'>
          <Skeleton className='h-4 w-[80%]' />
          <Skeleton className='h-4 w-[60%]' />
          <Skeleton className='h-4 w-[70%]' />
        </div>
      </div>
    </div>
  );

  const handleCopy = async (content: string, messageId: string) => {
    await navigator.clipboard.writeText(content);
    setCopiedMessageId(messageId);
    setTimeout(() => setCopiedMessageId(null), 2000);
  };

  const MessageContent = ({ content }: { content: string; }) => {
    // Function to transform both formats to consistent HTML
    const transformContent = (content: string) => {
      // First, handle the ::: format with a ReDoS-safe regex
      content = content.replace(
        /:::\s{0,10}disclaimer\s{0,10}([^:]*?)(?=\s{0,10}:::)/g,
        '<div class="disclaimer">$1</div>'
      );

      // Then, handle the div format (if it's not already transformed)
      content = content.replace(
        /<div class="disclaimer">(.*?)<\/div>/g,
        (match, p1) => `<div class="disclaimer">${p1.trim()}</div>`
      );

      return content;
    };

    return (
      <div className='prose prose-sm dark:prose-invert max-w-none'>
        <ReactMarkdown
          components={{
            div: ({ node, className, children, ...props }) => {
              if (className === "disclaimer") {
                return (
                  <div
                    className='my-4 p-4 rounded bg-red-50 border-l-4 border-red-500 text-red-700 dark:bg-red-950 dark:text-red-200 font-medium'
                    {...props}
                  >
                    {children}
                  </div>
                );
              }
              return (
                <div className={className} {...props}>
                  {children}
                </div>
              );
            },
          }}
          remarkPlugins={[]}
          rehypePlugins={[rehypeRaw]}
        >
          {transformContent(content)}
        </ReactMarkdown>
      </div>
    );
  };

  const handleSessionRename = async (sessionId: string, newTitle: string) => {
    try {
      await renameSession(sessionId, user!.id, newTitle);
      await loadSessions(); // Refresh sessions list
    } catch (error) {
      console.error("Failed to rename session:", error);
    }
  };

  const handleSessionDuplicate = async (sessionId: string) => {
    try {
      await duplicateSession(sessionId, user!.id);
      await loadSessions(); // Refresh sessions list
    } catch (error) {
      console.error("Failed to duplicate session:", error);
    }
  };

  const handleSessionDelete = async (sessionId: string) => {
    try {
      await deleteSession(sessionId, user!.id);
      if (currentSession?.id === sessionId) {
        setCurrentSession(null);
        setMessages([]);
      }
      await loadSessions(); // Refresh sessions list
    } catch (error) {
      console.error("Failed to delete session:", error);
    }
  };

  const checkForTitleSuggestion = async () => {
    if (!currentSession || messages.length < 2) return;

    if (currentSession.title.startsWith("New Chat -")) {
      const suggestedTitle = await suggestChatTitle(messages);
      if (suggestedTitle && suggestedTitle !== currentSession.title) {
        await handleSessionRename(currentSession.id, suggestedTitle);
      }
    }
  };

  useEffect(() => {
    if (messages.length === 2) {
      checkForTitleSuggestion();
    }
  }, [messages.length]);

  const handleDownload = async (session: Session) => {
    try {
      const doc = new jsPDF();

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(18);
      doc.text(session.title, 10, 20);

      doc.setLineWidth(0.5);
      doc.line(10, 25, 200, 25);

      const conversationText = session.messages
        .map(msg => `${msg.role.toUpperCase()}: ${msg.content}`)
        .join('\n\n');

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(12);

      const lines = doc.splitTextToSize(conversationText, 180);

      doc.text(lines, 10, 35);

      doc.save(`conversation_${session.id}.pdf`);
      toast.success("Chat downloaded successfully");
    } catch (error) {
      console.error("Failed to download session:", error);
      toast.error("Failed to download chat");
    }
  };

  const handleRetry = async (messageId: string, content: string) => {
    if (!currentSession?.id) {
      toast.error("No active session");
      return;
    }

    const messageIndex = messages.findIndex((m) => m.id === messageId);
    const assistantMessage = messages[messageIndex + 1];
    if (!assistantMessage) return;

    const newMessageId = uuidv4();

    setRegeneratingMessages((prev) => new Set(prev).add(assistantMessage.id));

    try {
      setStreamingMessages(prev => new Set(prev).add(assistantMessage.id));

      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: content,
          model: currentModel,
          sessionId: currentSession.id,
          messageId: newMessageId
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to get response');
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No response stream available");

      const decoder = new TextDecoder();
      let streamedContent = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          setStreamingMessages(prev => {
            const next = new Set(prev);
            next.delete(assistantMessage.id);
            return next;
          });
          break;
        }

        const chunk = decoder.decode(value);
        streamedContent += chunk;

        // Update streaming content in UI
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantMessage.id
              ? {
                ...msg,
                content: streamedContent,
                response_history: [
                  ...(msg.response_history || [{
                    id: msg.id,
                    content: msg.content,
                    created_at: msg.created_at,
                    type: 'original'
                  }]),
                  {
                    id: newMessageId,
                    content: streamedContent,
                    created_at: new Date().toISOString(),
                    type: 'retry'
                  }
                ],
                currentResponseIndex: (msg.response_history?.length || 1)
              }
              : msg
          )
        );
      }

      // Save the retry response to the database
      await addRetryResponse(currentSession.id, messageId, {
        id: newMessageId,
        role: 'assistant',
        content: streamedContent,
        model: currentModel,
        created_at: new Date().toISOString()
      });

      // Update the response count for this message
      setResponseCountMap(prev => ({
        ...prev,
        [assistantMessage.id]: ((assistantMessage.currentResponseIndex || 0) + 2) // +2 because we're adding a new response
      }));

    } catch (error) {
      console.error("Retry failed:", error);
      toast.error("Failed to retry message");
    } finally {
      setRegeneratingMessages((prev) => {
        const next = new Set(prev);
        next.delete(assistantMessage.id);
        return next;
      });
    }
  };

  const handleNavigateResponse = (
    messageId: string,
    direction: "prev" | "next"
  ) => {
    setMessages((prev) =>
      prev.map((msg) => {
        if (msg.id === messageId && msg.response_history) {
          // Filter complete responses
          const completeResponses = msg.response_history.reduce((acc, curr) => {
            if (!acc[curr.id]) {
              acc[curr.id] = curr;
            } else if (curr.created_at > acc[curr.id].created_at) {
              acc[curr.id] = curr;
            }
            return acc;
          }, {} as Record<string, typeof msg.response_history[0]>);

          const finalResponses = Object.values(completeResponses);

          // Find current index in filtered responses
          const currentIndex = finalResponses.findIndex(
            response => response.content === msg.content
          );

          // Calculate new index
          let newIndex;
          if (direction === "next") {
            newIndex = Math.min((currentIndex !== -1 ? currentIndex : 0) + 1, finalResponses.length - 1);
          } else {
            newIndex = Math.max((currentIndex !== -1 ? currentIndex : 0) - 1, 0);
          }

          const selectedResponse = finalResponses[newIndex];
          if (!selectedResponse) return msg;

          return {
            ...msg,
            content: selectedResponse.content,
            currentResponseIndex: newIndex,
          };
        }
        return msg;
      })
    );
  };

  const loadSessions = async () => {
    if (user) {
      const userSessions = await getUserSessions(user.id);
      setSessions(userSessions);
    }
  };

  const filteredSessions = sessions.filter(session =>
    session.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="relative flex flex-col h-[calc(100vh-4rem)] overflow-hidden bg-white">
      {showSubscriptionDialog && <SubscriptionDialog />}
      {/* Sheet Trigger */}
      <div className='absolute top-4 left-4 z-10'>
        <Button
          className='bg-[#70CDB3] text-white hover:bg-[#70CDB3]/90'
          size='icon'
          onClick={() => setSheetOpen(true)}
        >
          <PanelRightClose className='h-4 w-4' />
        </Button>
      </div>

      {/* Model Indicator */}
      <div className='absolute top-4 right-4 z-10'>
        <div className='flex items-center gap-2 bg-muted/50 px-2 py-1 rounded-md text-xs text-muted-foreground'>
          <div className='w-2 h-2 rounded-full bg-green-400 animate-pulse' />
          {/* {currentModel.includes("gpt-4") ? "GPT-Advanced" : "GPT-Beginner"} */}
          Online
        </div>
      </div>

      {/* Sheet */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent
          side='left'
          className='p-0 w-[280px] h-[calc(100vh-4rem)] mt-16 block absolute'
        >
          <SheetHeader className='p-4'>
            <SheetTitle className='text-[#438b9d]'>Chat History</SheetTitle>
          </SheetHeader>
          <div className='flex flex-col h-[calc(100%-4rem)]'>
            <div className='p-4'>
              <div className='flex gap-2 items-center'>
                <Button
                  variant="ghost"
                  size="icon"
                  className='h-8 w-8'
                  onClick={handleCreateNewSession}
                >
                  <SquarePen className='h-4 w-4' />
                </Button>

                {showSearch ? (
                  <div className='flex-1 flex items-center gap-2 bg-muted/50 rounded-md px-2'>
                    <Search className='h-4 w-4 text-muted-foreground' />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search chats..."
                      className='flex-1 h-8 bg-transparent border-none focus:outline-none text-sm'
                      autoFocus
                    />
                    {searchQuery && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className='h-6 w-6'
                        onClick={() => setSearchQuery('')}
                      >
                        <X className='h-3 w-3' />
                      </Button>
                    )}
                  </div>
                ) : (
                  <Button
                    variant="ghost"
                    size="icon"
                    className='h-8 w-8'
                    onClick={() => setShowSearch(true)}
                  >
                    <Search className='h-4 w-4' />
                  </Button>
                )}
              </div>
            </div>
            <div className='flex-1 overflow-auto'>
              {filteredSessions.map((session) => (
                <SessionManager
                  key={session.id}
                  session={session}
                  isActive={currentSession?.id === session.id}
                  onSelect={setCurrentSession}
                  onRename={handleSessionRename}
                  onDuplicate={handleSessionDuplicate}
                  onDelete={handleSessionDelete}
                  onDownload={handleDownload}
                />
              ))}
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Main Chat Area */}
      <div className='flex-1 flex flex-col h-full'>
        <div className='flex-1 overflow-y-auto pb-14'>
          <div className='max-w-2xl mx-auto pt-20'>
            {messages.length > 0 ? (
              messages.map((message) => (
                <div
                  key={message.id}
                  className={cn(
                    "px-4 py-6 w-full group relative",
                    message.role === "assistant"
                      ? "bg-muted/50 mb-20"
                      : "bg-background"
                  )}
                >
                  <div className='max-w-2xl mx-auto'>
                    {/* Assistant message */}
                    {message.role === "assistant" && (
                      <div className='relative'>
                        {regeneratingMessages.has(message.id) ? (
                          <div className='flex-1'>
                            <LoadingSkeleton />
                          </div>
                        ) : (
                          <>
                            {/* Navigation and copy controls - moved to top with more space */}
                            {message.response_history &&
                              message.response_history.length > 0 &&
                              !streamingMessages.has(message.id) && (
                                <div className='flex items-center justify-end gap-2 mb-4'>
                                  <div className='flex items-center gap-1 bg-muted/50 rounded-md px-1'>
                                    <Button
                                      variant='ghost'
                                      size='icon'
                                      onClick={() =>
                                        handleNavigateResponse(
                                          message.id,
                                          "prev"
                                        )
                                      }
                                      disabled={
                                        !message.currentResponseIndex ||
                                        message.currentResponseIndex === 0
                                      }
                                      className='h-6 w-6'
                                    >
                                      <ChevronLeft className='h-3 w-3' />
                                    </Button>
                                    <span className='text-xs text-muted-foreground px-1'>
                                      {(() => {
                                        if (!message.response_history) {
                                          console.log('No response history:', message.id);
                                          return '1/1';
                                        }

                                        // Filter out streaming chunks by grouping by ID and taking the last chunk for each
                                        const completeResponses = message.response_history.reduce((acc, curr) => {
                                          if (!acc[curr.id]) {
                                            acc[curr.id] = curr;
                                          } else if (curr.created_at > acc[curr.id].created_at) {
                                            acc[curr.id] = curr;
                                          }
                                          return acc;
                                        }, {} as Record<string, typeof message.response_history[0]>);

                                        const finalResponses = Object.values(completeResponses);

                                        console.log('Message ID:', message.id);
                                        console.log('Current content:', message.content);
                                        console.log('Complete responses:', finalResponses);
                                        console.log('Current response index:', message.currentResponseIndex);

                                        // Find current response in filtered history
                                        const currentResponseIndex = finalResponses.findIndex(
                                          response => response.content === message.content
                                        );

                                        console.log('Found index by content:', currentResponseIndex);

                                        const currentPosition = currentResponseIndex !== -1
                                          ? currentResponseIndex + 1
                                          : (message.currentResponseIndex || 0) + 1;

                                        console.log('Final position:', currentPosition);
                                        console.log('Total responses:', finalResponses.length);

                                        return `${currentPosition}/${finalResponses.length}`;
                                      })()}
                                    </span>
                                    <Button
                                      variant='ghost'
                                      size='icon'
                                      onClick={() =>
                                        handleNavigateResponse(
                                          message.id,
                                          "next"
                                        )
                                      }
                                      disabled={
                                        (message.currentResponseIndex || 0) >= (message.response_history.length - 1)
                                      }
                                      className='h-6 w-6'
                                    >
                                      <ChevronRight className='h-3 w-3' />
                                    </Button>
                                  </div>
                                  <Button
                                    variant='ghost'
                                    size='icon'
                                    className='h-6 w-6'
                                    onClick={() => {
                                      const currentResponse =
                                        message.response_history?.[
                                        message.currentResponseIndex || 0
                                        ];
                                      if (currentResponse) {
                                        navigator.clipboard.writeText(
                                          currentResponse.content
                                        );
                                        toast.success("Copied to clipboard");
                                      }
                                    }}
                                  >
                                    {copiedMessageId === message.id ? (
                                      <Check className='h-3 w-3' />
                                    ) : (
                                      <Copy className='h-3 w-3' />
                                    )}
                                  </Button>
                                </div>
                              )}

                            {/* Message content */}
                            <div className='flex gap-4'>
                              <Avatar className='h-8 w-8 bg-[#70CDB3] flex items-center justify-center'>
                                <Bot className='h-4 w-4 text-white' />
                              </Avatar>
                              <div className='flex-1'>
                                <ReactMarkdown rehypePlugins={[rehypeRaw]}>
                                  {message.content}
                                </ReactMarkdown>
                              </div>
                              {/* Copy button for single response */}
                              {(!message.response_history ||
                                message.response_history.length <= 1) && (
                                  <Button
                                    variant='ghost'
                                    size='icon'
                                    className='h-6 w-6 self-start'
                                    onClick={() => {
                                      navigator.clipboard.writeText(
                                        message.content
                                      );
                                      toast.success("Copied to clipboard");
                                    }}
                                  >
                                    {copiedMessageId === message.id ? (
                                      <Check className='h-3 w-3' />
                                    ) : (
                                      <Copy className='h-3 w-3' />
                                    )}
                                  </Button>
                                )}
                            </div>
                          </>
                        )}
                      </div>
                    )}

                    {/* User message */}
                    {message.role === "user" && (
                      <div className='flex gap-4'>
                        <Avatar className='h-8 w-8'>
                          <AvatarImage
                            src={user?.imageUrl}
                            alt={user?.username || "User"}
                          />
                          <AvatarFallback>
                            {user?.firstName?.[0] || user?.username?.[0] || "U"}
                          </AvatarFallback>
                        </Avatar>
                        <div className='flex-1 space-y-2'>
                          {editingMessageId === message.id ? (
                            // Edit mode
                            <form
                              onSubmit={(e) => {
                                e.preventDefault();
                                const formData = new FormData(e.currentTarget);
                                const newContent = formData.get('content') as string;
                                if (newContent.trim()) {
                                  const newMessageId = uuidv4();
                                  const retryBody = {
                                    message: newContent.trim(),
                                    model: currentModel,
                                    sessionId: currentSession!.id,
                                    messageId: newMessageId
                                  };
                                  console.log('Sending retry with:', retryBody);
                                  handleRetry(message.id, newContent);
                                  setEditingMessageId(null);
                                }
                              }}
                              className="flex gap-2"
                            >
                              <Textarea
                                name="content"
                                defaultValue={message.content}
                                className="min-h-[60px]"
                                autoFocus
                              />
                              <div className="flex flex-col gap-2">
                                <Button type="submit" size="icon">
                                  <Check className="h-4 w-4" />
                                </Button>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => setEditingMessageId(null)}
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </div>
                            </form>
                          ) : (
                            // View mode
                            <>
                              <ReactMarkdown rehypePlugins={[rehypeRaw]}>
                                {message.content}
                              </ReactMarkdown>
                              <div className='flex gap-2 mt-2'>
                                <Button
                                  variant='ghost'
                                  size='icon'
                                  onClick={() => setEditingMessageId(message.id)}
                                  className='h-8 w-8'
                                >
                                  <Edit2 className='h-4 w-4' />
                                </Button>
                                <Button
                                  variant='ghost'
                                  size='icon'
                                  onClick={() => handleRetry(message.id, message.content)}
                                  className='h-8 w-8'
                                >
                                  <RotateCcw className='h-4 w-4' />
                                </Button>
                              </div>
                            </>
                          )}

                          {/* Add the violation indicator */}
                          {message.contentFlags && (
                            <PromptViolationIndicator flags={message.contentFlags} />
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className='text-center'>
                <h1 className='text-4xl font-bold text-[#70CDB3] mb-4'>
                  {currentSession ? "New Chat" : "Edify Chat Assistant"}
                </h1>
                <p className='text-muted-foreground'>
                  {currentSession
                    ? "Start your conversation..."
                    : "Start a new conversation with your AI assistant"}
                </p>
              </div>
            )}
            {isWaiting && <LoadingSkeleton />}
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Input Area with Report Button */}
        <div className="border-t">
          <div className="absolute bottom-5 xxs:bottom-40 md:bottom-40 custom:bottom-5 right-4">
            <ReportButton
              toolType="Edify-chat"
              position="inline"
              variant="pre"
            />
          </div>
          <div className="mx-auto max-w-3xl p-4 bg-transparent rounded-lg">
            <form onSubmit={handleSubmit} className="relative group">
              <div className="min-h-[50px] w-full rounded-xl
                focus-within:border-none transition-all duration-300
                focus:outline-none text-sm overflow-hidden
                shadow-[0_0_15px_rgba(0,0,0,0.1)] group-hover:shadow-[0_0_20px_rgba(0,0,0,0.15)]">

                <Textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      if (input.trim() && !isLoading) {
                        handleSubmit(e as any);
                      }
                    }
                  }}
                  placeholder="Ask me anything..."
                  className="w-full resize-none border-0 bg-transparent px-4 py-[0.8rem] 
                    focus:outline-none focus:ring-0 text-black placeholder:text-gray-400"
                // disabled={isLoading}
                />

                <div className="flex items-center justify-between px-4 py-2 
                  opacity-0 scale-95 group-focus-within:opacity-100 group-focus-within:scale-100
                  transition-all duration-200 ease-in-out">
                  <p className="text-xs text-gray-400">
                    <span className="text-red-500 font-bold">*</span>AI-generated responses may contain errors or hallucinations. Always verify information from reliable sources before making decisions based on AI-provided content.
                  </p>
                  <Button
                    type="submit"
                    size="sm"
                    disabled={isLoading || !input.trim()}
                    className={cn(
                      "bg-[#19c37d] hover:bg-[#1a7f4e] transition-all duration-300",
                      "text-white rounded-lg px-3 py-2 h-8",
                      "disabled:bg-[#1a7f4e]/50 disabled:cursor-not-allowed"
                    )}
                  >
                    {isLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
            </form>
            {inputError && (
              <p className="text-red-500 text-xs mt-1 animate-in fade-in slide-in-from-bottom-1">
                {inputError}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
