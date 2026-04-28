"use client";

import { useEffect, useRef, useState } from "react";

type Property = "pittsburgh" | "des_plaines";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

const ACTIVE_PROPERTIES: { id: Property; label: string; sub: string }[] = [
  { id: "pittsburgh", label: "Pittsburgh", sub: "Rivers Casino Pittsburgh" },
  {
    id: "des_plaines",
    label: "Des Plaines",
    sub: "Rivers Casino Des Plaines",
  },
];

const COMING_SOON_PROPERTIES = [
  { id: "philadelphia", label: "Philadelphia" },
  { id: "schenectady", label: "Schenectady" },
  { id: "portsmouth", label: "Portsmouth" },
];

export default function Home() {
  const [property, setProperty] = useState<Property>("pittsburgh");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages]);

  function handlePropertyChange(next: Property) {
    if (next === property) return;
    if (messages.length > 0) {
      const ok = window.confirm(
        "Switching properties will clear the current conversation. Continue?",
      );
      if (!ok) return;
    }
    setProperty(next);
    setMessages([]);
    setError(null);
  }

  async function send() {
    const trimmed = input.trim();
    if (!trimmed || streaming) return;

    const next: ChatMessage[] = [
      ...messages,
      { role: "user", content: trimmed },
    ];
    setMessages(next);
    setInput("");
    setStreaming(true);
    setError(null);

    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }

    // Optimistically append empty assistant message we'll fill from the stream.
    setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ property, messages: next }),
      });

      if (!res.ok || !res.body) {
        const text = await res.text().catch(() => "");
        throw new Error(text || `Request failed (${res.status})`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        setMessages((prev) => {
          const copy = [...prev];
          const last = copy[copy.length - 1];
          copy[copy.length - 1] = {
            role: "assistant",
            content: last.content + chunk,
          };
          return copy;
        });
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : "Something went wrong";
      setError(message);
      // Remove the empty assistant placeholder so user can retry.
      setMessages((prev) => {
        if (prev.length === 0) return prev;
        const last = prev[prev.length - 1];
        if (last.role === "assistant" && last.content === "") {
          return prev.slice(0, -1);
        }
        return prev;
      });
    } finally {
      setStreaming(false);
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void send();
    }
  }

  function autosize(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setInput(e.target.value);
    e.target.style.height = "auto";
    e.target.style.height = `${Math.min(e.target.scrollHeight, 240)}px`;
  }

  return (
    <div className="flex flex-1 flex-col bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      <header className="border-b border-zinc-200 bg-white px-6 py-4 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mx-auto flex max-w-3xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-base font-semibold tracking-tight">
              RSG Copywriting Companion
            </h1>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              An on-brand writing partner for Rivers Casino properties.
            </p>
          </div>
          <PropertySelector active={property} onChange={handlePropertyChange} />
        </div>
      </header>

      <main className="flex flex-1 flex-col">
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-8">
          <div className="mx-auto flex max-w-3xl flex-col gap-6">
            {messages.length === 0 ? (
              <EmptyState property={property} />
            ) : (
              messages.map((m, i) => (
                <Message
                  key={i}
                  role={m.role}
                  content={m.content}
                  loading={
                    streaming &&
                    i === messages.length - 1 &&
                    m.role === "assistant" &&
                    m.content === ""
                  }
                />
              ))
            )}
            {error && (
              <div className="rounded-md border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
                {error}
              </div>
            )}
          </div>
        </div>

        <div className="border-t border-zinc-200 bg-white px-4 py-4 dark:border-zinc-800 dark:bg-zinc-900">
          <div className="mx-auto flex max-w-3xl items-end gap-3">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={autosize}
              onKeyDown={onKeyDown}
              placeholder={`Paste a brief, list deliverables, or describe what you need for ${
                ACTIVE_PROPERTIES.find((p) => p.id === property)?.label
              }…`}
              rows={1}
              disabled={streaming}
              className="min-h-[44px] flex-1 resize-none rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-sm text-zinc-900 shadow-sm outline-none transition focus:border-zinc-400 focus:ring-2 focus:ring-zinc-200 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:focus:border-zinc-500 dark:focus:ring-zinc-700"
            />
            <button
              onClick={send}
              disabled={streaming || input.trim().length === 0}
              className="h-11 rounded-lg bg-zinc-900 px-4 text-sm font-medium text-white transition hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
            >
              {streaming ? "Sending…" : "Send"}
            </button>
          </div>
          <p className="mx-auto mt-2 max-w-3xl text-[11px] text-zinc-400 dark:text-zinc-500">
            Enter to send · Shift+Enter for newline · Each session is fresh
          </p>
        </div>
      </main>
    </div>
  );
}

function PropertySelector({
  active,
  onChange,
}: {
  active: Property;
  onChange: (next: Property) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-[11px] uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
        Property
      </span>
      <div className="inline-flex rounded-lg border border-zinc-200 bg-zinc-50 p-1 dark:border-zinc-700 dark:bg-zinc-800">
        {ACTIVE_PROPERTIES.map((p) => {
          const selected = p.id === active;
          return (
            <button
              key={p.id}
              onClick={() => onChange(p.id)}
              title={p.sub}
              className={
                "rounded-md px-3 py-1.5 text-xs font-medium transition " +
                (selected
                  ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-700 dark:text-zinc-100"
                  : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-zinc-100")
              }
            >
              {p.label}
            </button>
          );
        })}
        {COMING_SOON_PROPERTIES.map((p) => (
          <button
            key={p.id}
            disabled
            title="Coming soon"
            className="cursor-not-allowed rounded-md px-3 py-1.5 text-xs font-medium text-zinc-400 dark:text-zinc-600"
          >
            {p.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function EmptyState({ property }: { property: Property }) {
  const label = ACTIVE_PROPERTIES.find((p) => p.id === property)?.label;
  return (
    <div className="rounded-xl border border-dashed border-zinc-300 bg-white p-6 text-sm text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400">
      <p className="mb-2 font-medium text-zinc-900 dark:text-zinc-100">
        Working on a {label} piece.
      </p>
      <p className="mb-4">
        Paste a Workfront ticket, drop a list of deliverables, or just type
        what you need. The companion will propose 3–5 headline directions
        calibrated to {label}&apos;s voice and ask for context only when
        something material is missing.
      </p>
      <ul className="list-disc space-y-1 pl-5 text-xs text-zinc-500 dark:text-zinc-500">
        <li>
          Try: <span className="font-mono">PGH, March Mystery Gift Card, postcard 9x6 + kiosk tile</span>
        </li>
        <li>
          Try: <span className="font-mono">DP, May Cinco de Mayo Slot Play, postcard front + back</span>
        </li>
        <li>
          Or paste a full brief and ask for headline directions.
        </li>
      </ul>
    </div>
  );
}

function Message({
  role,
  content,
  loading,
}: {
  role: "user" | "assistant";
  content: string;
  loading: boolean;
}) {
  if (role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] whitespace-pre-wrap rounded-lg bg-zinc-900 px-4 py-2.5 text-sm text-white dark:bg-zinc-100 dark:text-zinc-900">
          {content}
        </div>
      </div>
    );
  }
  return (
    <div className="flex justify-start">
      <div className="max-w-[85%] whitespace-pre-wrap rounded-lg border border-zinc-200 bg-white px-4 py-2.5 text-sm leading-relaxed text-zinc-900 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100">
        {loading ? (
          <span className="inline-flex items-center gap-1 text-zinc-400">
            <span className="h-2 w-2 animate-pulse rounded-full bg-zinc-400" />
            <span className="h-2 w-2 animate-pulse rounded-full bg-zinc-400 [animation-delay:150ms]" />
            <span className="h-2 w-2 animate-pulse rounded-full bg-zinc-400 [animation-delay:300ms]" />
          </span>
        ) : (
          content
        )}
      </div>
    </div>
  );
}
