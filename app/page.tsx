"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { Paperclip, ArrowUp, X, FileText, Image as ImageIcon, FileType2 } from "lucide-react";
import { readFileAsAttachment, formatBytes, type Attachment } from "@/lib/files";

type Property = "pittsburgh" | "des_plaines";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  attachments?: Attachment[];
};

const PROPERTIES: {
  id: Property;
  label: string;
  voice: string;
}[] = [
  {
    id: "pittsburgh",
    label: "Pittsburgh",
    voice:
      "Platform-led. Memphis Q1/Q2 visual system. Functional, transactional headlines with seasonal puns when the moment permits.",
  },
  {
    id: "des_plaines",
    label: "Des Plaines",
    voice:
      "Pun-on-mechanic headlines. Photography-led visuals. Workhorse phrase library. Trilingual Lunar New Year practice.",
  },
];

const COMING_SOON: { id: string; label: string }[] = [
  { id: "philadelphia", label: "Philadelphia" },
  { id: "schenectady", label: "Schenectady" },
  { id: "portsmouth", label: "Portsmouth" },
];

const EXAMPLES: Record<Property, string[]> = {
  pittsburgh: [
    "Pittsburgh, March Mystery Gift Card. Postcard 9x6 + kiosk tile + digital 1280x720.",
    "Pittsburgh — looking for a take on the NFL Draft. April 22-25, Pittsburgh hosts.",
    "Pittsburgh, Forever Fun Hot Seat Drawings for April. Need digital slide and postcard.",
  ],
  des_plaines: [
    "Des Plaines, May Cinco de Mayo Slot Play. Postcard front + back.",
    "Des Plaines, Hugo's Frog Bar dining offer DM for Mother's Day. Self-mailer.",
    "Des Plaines, April Slot Core DM. Standard recurring slot play with personalization fields.",
  ],
};

const MAGNETIK = "Magnetik, sans-serif";

export default function Home() {
  const [property, setProperty] = useState<Property>("pittsburgh");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [pendingAttachments, setPendingAttachments] = useState<Attachment[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages]);

  const activeProperty = PROPERTIES.find((p) => p.id === property)!;

  function handlePropertyChange(next: Property) {
    if (next === property) return;
    if (messages.length > 0 || pendingAttachments.length > 0) {
      const ok = window.confirm(
        "Switching properties will clear the current conversation. Continue?",
      );
      if (!ok) return;
    }
    setProperty(next);
    setMessages([]);
    setPendingAttachments([]);
    setError(null);
  }

  async function handleFiles(files: FileList | File[]) {
    setError(null);
    const additions: Attachment[] = [];
    for (const file of Array.from(files)) {
      try {
        additions.push(await readFileAsAttachment(file));
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not read file");
      }
    }
    if (additions.length > 0) {
      setPendingAttachments((prev) => [...prev, ...additions]);
    }
  }

  function removeAttachment(idx: number) {
    setPendingAttachments((prev) => prev.filter((_, i) => i !== idx));
  }

  async function send() {
    const trimmed = input.trim();
    if ((!trimmed && pendingAttachments.length === 0) || streaming) return;

    const userMsg: ChatMessage = {
      role: "user",
      content: trimmed,
      attachments:
        pendingAttachments.length > 0 ? pendingAttachments : undefined,
    };
    const next: ChatMessage[] = [...messages, userMsg];
    setMessages(next);
    setInput("");
    setPendingAttachments([]);
    setStreaming(true);
    setError(null);

    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }

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
      const message = e instanceof Error ? e.message : "Something broke. Try again.";
      setError(message);
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

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      void handleFiles(e.dataTransfer.files);
    }
  }

  return (
    <div
      className="relative flex min-h-screen flex-1 flex-col"
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={(e) => {
        if (e.currentTarget.contains(e.relatedTarget as Node)) return;
        setDragOver(false);
      }}
      onDrop={onDrop}
    >
      {dragOver && <DropOverlay />}

      <Header
        active={property}
        onChange={handlePropertyChange}
        streaming={streaming}
      />

      <main className="relative flex flex-1 flex-col">
        <div ref={scrollRef} className="flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-3xl px-6 py-12">
            {messages.length === 0 ? (
              <EmptyState
                property={activeProperty}
                onPick={(text) => {
                  setInput(text);
                  textareaRef.current?.focus();
                }}
              />
            ) : (
              <div className="flex flex-col gap-8">
                {messages.map((m, i) => (
                  <MessageRow
                    key={i}
                    message={m}
                    streaming={
                      streaming &&
                      i === messages.length - 1 &&
                      m.role === "assistant"
                    }
                  />
                ))}
              </div>
            )}
            {error && (
              <div className="mt-8 rounded-xl border border-sunset-ember/40 bg-sunset-ember/10 p-5">
                <div
                  className="eyebrow text-sunset-ember"
                >
                  Something broke
                </div>
                <div className="mt-1 text-sm text-foreground/90">{error}</div>
                <div className="mt-1 text-sm text-foreground/60">
                  Try again, or check that the API key is set.
                </div>
              </div>
            )}
          </div>
        </div>

        <Composer
          input={input}
          attachments={pendingAttachments}
          streaming={streaming}
          textareaRef={textareaRef}
          fileInputRef={fileInputRef}
          onChange={autosize}
          onKeyDown={onKeyDown}
          onSend={send}
          onAttachClick={() => fileInputRef.current?.click()}
          onFilesPicked={handleFiles}
          onRemoveAttachment={removeAttachment}
          property={activeProperty}
        />
      </main>
    </div>
  );
}

function Header({
  active,
  onChange,
  streaming,
}: {
  active: Property;
  onChange: (p: Property) => void;
  streaming: boolean;
}) {
  return (
    <header
      className="sticky top-0 z-[var(--z-sticky)] border-b border-border bg-background/85 backdrop-blur-md"
    >
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-6 py-4 lg:flex-row lg:items-center lg:justify-between">
        <Brand />

        <PropertySelector active={active} onChange={onChange} />

        <div className="hidden items-center gap-4 lg:flex">
          <StatusBadge streaming={streaming} />
        </div>
      </div>
    </header>
  );
}

function Brand() {
  return (
    <div className="flex items-center gap-3">
      <Image
        src="/logos/dcp-logo-light.svg"
        alt="DCP"
        width={36}
        height={36}
        priority
      />
      <div className="leading-tight">
        <div
          className="text-[15px]"
          style={{ fontFamily: MAGNETIK, fontWeight: 700 }}
        >
          Copywriting companion
        </div>
        <div className="eyebrow text-aurora-violet">
          Rivers Casino &amp; Resorts
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ streaming }: { streaming: boolean }) {
  return (
    <div className="flex items-center gap-2 text-foreground/70">
      <span
        className={`text-aurora-green text-base leading-none ${streaming ? "pulse-dot" : ""}`}
        aria-hidden
      >
        ●
      </span>
      <span className="text-sm">{streaming ? "Drafting" : "Ready"}</span>
      <span className="mx-2 h-3 w-px bg-border" />
      <span className="text-xs text-muted-foreground">
        claude-sonnet-4-6
      </span>
    </div>
  );
}

function PropertySelector({
  active,
  onChange,
}: {
  active: Property;
  onChange: (p: Property) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="eyebrow text-aurora-violet">Property</span>
      {PROPERTIES.map((p) => {
        const selected = p.id === active;
        return (
          <button
            key={p.id}
            onClick={() => onChange(p.id)}
            title={p.voice}
            className={`inline-flex items-center gap-2 rounded-full px-4 py-1.5 transition-[background,color,border-color] duration-[var(--duration-base)] ease-[var(--ease-standard)] focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
              selected
                ? "bg-aurora-green text-midnight"
                : "border border-border bg-secondary text-foreground hover:bg-accent hover:text-accent-foreground"
            }`}
            style={{ fontFamily: MAGNETIK, fontWeight: 600 }}
          >
            <span className="text-[13px]">{p.label}</span>
          </button>
        );
      })}
      {COMING_SOON.map((p) => (
        <button
          key={p.id}
          disabled
          title="Coming soon"
          className="inline-flex items-center gap-2 rounded-full border border-dashed border-border px-4 py-1.5 opacity-45"
          style={{ fontFamily: MAGNETIK, fontWeight: 500 }}
        >
          <span className="text-[13px]">{p.label}</span>
          <span className="eyebrow text-muted-foreground text-[10px]">
            Soon
          </span>
        </button>
      ))}
    </div>
  );
}

function EmptyState({
  property,
  onPick,
}: {
  property: (typeof PROPERTIES)[number];
  onPick: (text: string) => void;
}) {
  const examples = EXAMPLES[property.id];
  return (
    <div className="flex flex-col gap-6">
      <div className="eyebrow text-aurora-violet">How to start</div>
      <p
        className="max-w-2xl text-[17px] leading-relaxed text-foreground/80"
        style={{ fontFamily: MAGNETIK, fontWeight: 400 }}
      >
        Paste a Workfront ticket, drop a PDF, list deliverables, or just type
        what you need. We&rsquo;ll propose three to five directions tuned to{" "}
        {property.label}&rsquo;s voice and ask for context only when something
        material is missing.
      </p>

      <ul className="mt-2 flex flex-col gap-2">
        {examples.map((ex) => (
          <li key={ex}>
            <button
              onClick={() => onPick(ex)}
              className="group flex w-full items-start gap-3 rounded-xl border border-border bg-card p-4 text-left transition-[background,border-color] duration-[var(--duration-base)] ease-[var(--ease-standard)] hover:border-aurora-violet/40 hover:bg-accent"
            >
              <span className="mt-0.5 text-aurora-violet transition-transform group-hover:translate-x-0.5">
                →
              </span>
              <span className="text-[14px] leading-relaxed text-foreground/85">
                {ex}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function MessageRow({
  message,
  streaming,
}: {
  message: ChatMessage;
  streaming: boolean;
}) {
  const isWriter = message.role === "user";
  return (
    <article className="flex flex-col gap-3">
      <header className="flex items-center gap-3">
        <span
          className={`eyebrow ${isWriter ? "text-muted-foreground" : "text-aurora-violet"}`}
        >
          {isWriter ? "Writer" : "Companion"}
        </span>
        <span className="h-px flex-1 bg-border" />
      </header>

      {message.attachments && message.attachments.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {message.attachments.map((a, i) => (
            <AttachmentChip key={i} att={a} />
          ))}
        </div>
      )}

      {message.content && (
        <div
          className={`whitespace-pre-wrap text-[15px] leading-relaxed ${
            isWriter ? "text-foreground/85" : "text-foreground"
          }`}
          style={
            isWriter
              ? { fontFamily: "var(--font-mono)" }
              : { fontFamily: MAGNETIK, fontWeight: 400 }
          }
        >
          {message.content}
          {streaming && <span className="caret" />}
        </div>
      )}
      {!message.content && streaming && (
        <div className="flex items-center gap-2 text-muted-foreground">
          <span
            className="text-aurora-green pulse-dot text-base leading-none"
            aria-hidden
          >
            ●
          </span>
          <span className="text-sm">Drafting</span>
        </div>
      )}
    </article>
  );
}

function AttachmentIcon({ kind }: { kind: Attachment["kind"] }) {
  if (kind === "pdf")
    return <FileType2 className="h-3.5 w-3.5 text-aurora-violet" strokeWidth={2.2} />;
  if (kind === "image")
    return <ImageIcon className="h-3.5 w-3.5 text-aurora-violet" strokeWidth={2.2} />;
  return <FileText className="h-3.5 w-3.5 text-foreground/70" strokeWidth={2.2} />;
}

function AttachmentChip({
  att,
  onRemove,
}: {
  att: Attachment;
  onRemove?: () => void;
}) {
  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-border bg-secondary px-3 py-1.5">
      <AttachmentIcon kind={att.kind} />
      <span
        className="text-[12px] text-foreground"
        style={{ fontFamily: "var(--font-mono)" }}
      >
        {att.name}
      </span>
      <span
        className="text-[11px] text-muted-foreground"
        style={{ fontFamily: "var(--font-mono)" }}
      >
        {formatBytes(att.size)}
      </span>
      {onRemove && (
        <button
          onClick={onRemove}
          aria-label={`Remove ${att.name}`}
          className="ml-1 rounded-full p-0.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <X className="h-3.5 w-3.5" strokeWidth={2.2} />
        </button>
      )}
    </div>
  );
}

function Composer({
  input,
  attachments,
  streaming,
  textareaRef,
  fileInputRef,
  onChange,
  onKeyDown,
  onSend,
  onAttachClick,
  onFilesPicked,
  onRemoveAttachment,
  property,
}: {
  input: string;
  attachments: Attachment[];
  streaming: boolean;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  onSend: () => void;
  onAttachClick: () => void;
  onFilesPicked: (files: FileList | File[]) => void;
  onRemoveAttachment: (idx: number) => void;
  property: (typeof PROPERTIES)[number];
}) {
  const canSend =
    !streaming && (input.trim().length > 0 || attachments.length > 0);

  return (
    <div className="sticky bottom-0 z-[var(--z-sticky)] border-t border-border bg-background/85 backdrop-blur-md">
      <div className="mx-auto w-full max-w-3xl px-6 py-4">
        {attachments.length > 0 && (
          <div className="mb-3 flex flex-wrap gap-2">
            {attachments.map((a, i) => (
              <AttachmentChip
                key={i}
                att={a}
                onRemove={() => onRemoveAttachment(i)}
              />
            ))}
          </div>
        )}

        <div className="flex items-end gap-2 rounded-xl border border-border bg-card p-2 shadow-md focus-within:border-ring/60">
          <button
            onClick={onAttachClick}
            disabled={streaming}
            title="Attach a PDF, image, or .txt"
            aria-label="Attach file"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-foreground/70 transition-colors hover:bg-accent hover:text-foreground disabled:opacity-40"
          >
            <Paperclip className="h-4 w-4" strokeWidth={2.2} />
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,application/pdf,image/png,image/jpeg,image/gif,image/webp,.txt,.md,text/plain,text/markdown"
            multiple
            className="hidden"
            onChange={(e) => {
              if (e.target.files) onFilesPicked(e.target.files);
              e.target.value = "";
            }}
          />

          <textarea
            ref={textareaRef}
            value={input}
            onChange={onChange}
            onKeyDown={onKeyDown}
            disabled={streaming}
            rows={1}
            placeholder={`Type or paste a brief for ${property.label}…`}
            className="min-h-[40px] flex-1 resize-none bg-transparent px-2 py-2.5 text-[14px] leading-relaxed text-foreground outline-none placeholder:text-muted-foreground/80 disabled:opacity-60"
            style={{ fontFamily: "var(--font-mono)" }}
          />

          <button
            onClick={onSend}
            disabled={!canSend}
            aria-label="Send"
            className="flex h-10 shrink-0 items-center gap-2 rounded-full bg-aurora-green pl-4 pr-3 text-midnight transition-colors duration-[var(--duration-fast)] ease-[var(--ease-standard)] hover:bg-aurora-green-hover disabled:cursor-not-allowed disabled:bg-secondary disabled:text-muted-foreground"
          >
            <span
              className="text-[13px]"
              style={{ fontFamily: MAGNETIK, fontWeight: 700 }}
            >
              {streaming ? "Sending" : "Send"}
            </span>
            <ArrowUp className="h-4 w-4" strokeWidth={2.4} />
          </button>
        </div>

        <div className="mt-2.5 flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-muted-foreground">
          <Kbd k="↵">send</Kbd>
          <Kbd k="⇧ ↵">newline</Kbd>
          <Kbd k="Drag">anywhere to attach</Kbd>
          <span className="ml-auto">No memory across sessions.</span>
        </div>
      </div>
    </div>
  );
}

function Kbd({ k, children }: { k: string; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <kbd
        className="inline-flex h-5 items-center rounded-md border border-border bg-secondary px-1.5 text-[10px] text-foreground/80"
        style={{ fontFamily: "var(--font-mono)", letterSpacing: "0.06em" }}
      >
        {k}
      </kbd>
      <span>{children}</span>
    </span>
  );
}

function DropOverlay() {
  return (
    <div
      className="pointer-events-none fixed inset-0 z-[var(--z-overlay)] flex items-center justify-center backdrop-blur-[2px]"
      style={{
        background: "color-mix(in oklab, var(--color-aurora-green) 10%, transparent)",
      }}
    >
      <div className="rounded-xl border-2 border-dashed border-aurora-green bg-popover px-8 py-6 shadow-xl">
        <div className="eyebrow text-aurora-green">Drop to attach</div>
        <div
          className="mt-1 text-2xl text-foreground"
          style={{ fontFamily: MAGNETIK, fontWeight: 800 }}
        >
          PDF, image, or text.
        </div>
      </div>
    </div>
  );
}
