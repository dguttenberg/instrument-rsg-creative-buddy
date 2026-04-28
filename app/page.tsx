"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import {
  Paperclip,
  ArrowUp,
  X,
  FileText,
  Image as ImageIcon,
  FileType2,
  BookOpen,
  ChevronDown,
  Check,
} from "lucide-react";
import ReactMarkdown, { type Components } from "react-markdown";
import { readFileAsAttachment, formatBytes, type Attachment } from "@/lib/files";
import { VOICE_REFERENCES } from "@/lib/voice-references";

type Property =
  | "pittsburgh"
  | "des_plaines"
  | "philadelphia"
  | "schenectady"
  | "portsmouth";

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
  {
    id: "philadelphia",
    label: "Philadelphia",
    voice:
      "Three registers. Flyers co-brand hockey-language puns, civic awareness work, and original platform incubator. Mystery Fridays, Frosty Fortune, Spring Bling all originated here.",
  },
  {
    id: "schenectady",
    label: "Schenectady",
    voice:
      "Sub-brand-rich, hotel-leveraged, civic-anchored, locally-named. The Landing Hotel as recurring punning canvas. Capital Region geography. Rivers Gives civic register.",
  },
  {
    id: "portsmouth",
    label: "Portsmouth",
    voice:
      "Concept-platform-recurrence with thematic range. Monthly kiosk-game template (Lucky Round Scratcher → Cupid Hearts → Buckaroo Bonanza → Bunny Bucks). $500K Jackpot Drawing flagship.",
  },
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
  philadelphia: [
    "Philadelphia, March Mystery Fridays. Postcard 9x6 + kiosk tile.",
    "Philadelphia, $10 Blackjack OOH for the Flyers co-brand. Hockey-language pun headline.",
    "Philadelphia, Spring Bling drawing for April. Need digital slide.",
  ],
  schenectady: [
    "Schenectady, March Mayhem hotel rate. Need self-mailer.",
    "Schenectady, Rivers Salutes Military Mondays for May. Postcard.",
    "Schenectady, $25,000 Bloomin' Progressive Jackpot for May. Postcard front + back.",
  ],
  portsmouth: [
    "Portsmouth, May kiosk game (garden / spring theme). Need pun headline + body.",
    "Portsmouth, $500,000 Jackpot Drawing for July. Standard recurring template.",
    "Portsmouth, Rush to $1 Million spring DM. Front + interior copy.",
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
  const [voiceRefOpen, setVoiceRefOpen] = useState<Property | null>(null);

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
        onOpenVoiceRef={(p) => setVoiceRefOpen(p)}
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

      <VoiceReferenceSheet
        property={voiceRefOpen}
        onClose={() => setVoiceRefOpen(null)}
      />
    </div>
  );
}

function Header({
  active,
  onChange,
  onOpenVoiceRef,
  streaming,
}: {
  active: Property;
  onChange: (p: Property) => void;
  onOpenVoiceRef: (p: Property) => void;
  streaming: boolean;
}) {
  return (
    <header className="sticky top-0 z-[var(--z-sticky)] border-b border-border bg-background/85 backdrop-blur-md">
      <div className="mx-auto flex w-full max-w-7xl flex-col items-start gap-4 px-8 py-5 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
        <Brand />
        <div className="flex w-full flex-wrap items-center justify-between gap-3 sm:w-auto sm:gap-5">
          <StatusBadge streaming={streaming} />
          <PropertyMenu
            active={active}
            onChange={onChange}
            onOpenVoiceRef={onOpenVoiceRef}
          />
        </div>
      </div>
    </header>
  );
}

function Brand() {
  return (
    <div className="flex items-center gap-4">
      <Image
        src="/logos/dcp-logo-light.svg"
        alt="DCP"
        width={48}
        height={48}
        priority
        className="shrink-0"
      />
      <div className="leading-[1.1]">
        <div className="eyebrow text-aurora-violet">
          Rivers Casino &amp; Resorts
        </div>
        <div
          className="mt-0.5 text-[22px] tracking-[-0.01em]"
          style={{ fontFamily: MAGNETIK, fontWeight: 700 }}
        >
          Copywriting companion
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ streaming }: { streaming: boolean }) {
  return (
    <div className="flex items-center gap-2.5 text-foreground/80">
      <span
        className={`text-aurora-green text-base leading-none ${streaming ? "pulse-dot" : ""}`}
        aria-hidden
      >
        ●
      </span>
      <span
        className="text-[13px]"
        style={{ fontFamily: MAGNETIK, fontWeight: 600 }}
      >
        {streaming ? "Drafting" : "Ready"}
      </span>
      <span className="h-3 w-px bg-border" />
      <span className="font-mono text-[10px] text-muted-foreground">
        sonnet-4-6
      </span>
    </div>
  );
}

function PropertyMenu({
  active,
  onChange,
  onOpenVoiceRef,
}: {
  active: Property;
  onChange: (p: Property) => void;
  onOpenVoiceRef: (p: Property) => void;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const activeProperty = PROPERTIES.find((p) => p.id === active)!;

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={wrapRef} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="inline-flex items-center gap-2 rounded-full bg-aurora-green px-5 py-2 text-midnight transition-colors duration-[var(--duration-base)] ease-[var(--ease-standard)] hover:bg-aurora-green-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        <span
          className="text-[14px]"
          style={{ fontFamily: MAGNETIK, fontWeight: 700 }}
        >
          {activeProperty.label}
        </span>
        <ChevronDown
          className={`h-4 w-4 transition-transform duration-[var(--duration-base)] ${
            open ? "rotate-180" : ""
          }`}
          strokeWidth={2.4}
        />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-[calc(100%+10px)] z-[var(--z-dropdown)] w-[380px] overflow-hidden rounded-xl border border-border bg-popover shadow-xl"
        >
          <div className="border-b border-border/70 px-5 py-3">
            <div className="eyebrow text-aurora-violet">Choose a property</div>
            <div
              className="mt-0.5 text-[13px] text-foreground/70"
              style={{ fontFamily: MAGNETIK, fontWeight: 400 }}
            >
              Switching clears the current conversation.
            </div>
          </div>
          <ul>
            {PROPERTIES.map((p) => {
              const selected = p.id === active;
              return (
                <li
                  key={p.id}
                  className="flex items-stretch border-b border-border/50 last:border-b-0"
                >
                  <button
                    role="menuitem"
                    onClick={() => {
                      onChange(p.id);
                      setOpen(false);
                    }}
                    className={`flex flex-1 items-start gap-3 px-5 py-3.5 text-left transition-colors hover:bg-accent ${
                      selected ? "bg-accent/40" : ""
                    }`}
                  >
                    <span className="mt-1 flex h-4 w-4 shrink-0 items-center justify-center">
                      {selected ? (
                        <Check
                          className="h-4 w-4 text-aurora-green"
                          strokeWidth={3}
                        />
                      ) : (
                        <span className="h-1.5 w-1.5 rounded-full bg-border" />
                      )}
                    </span>
                    <span className="flex-1">
                      <span
                        className="block text-[15px]"
                        style={{
                          fontFamily: MAGNETIK,
                          fontWeight: selected ? 700 : 600,
                        }}
                      >
                        {p.label}
                      </span>
                      <span className="mt-1 block text-[12px] leading-relaxed text-foreground/65">
                        {p.voice}
                      </span>
                    </span>
                  </button>
                  <button
                    onClick={() => {
                      onOpenVoiceRef(p.id);
                      setOpen(false);
                    }}
                    title={`View ${p.label} voice reference`}
                    aria-label={`View ${p.label} voice reference`}
                    className="flex w-12 shrink-0 items-center justify-center border-l border-border/50 text-foreground/55 transition-colors hover:bg-accent hover:text-aurora-violet"
                  >
                    <BookOpen className="h-4 w-4" strokeWidth={2.2} />
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
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
        <div className="eyebrow text-aurora-violet">Drop to attach</div>
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

function VoiceReferenceSheet({
  property,
  onClose,
}: {
  property: Property | null;
  onClose: () => void;
}) {
  const open = property !== null;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  const propertyLabel = property
    ? (PROPERTIES.find((p) => p.id === property)?.label ?? "")
    : "";
  const content = property ? VOICE_REFERENCES[property] : "";

  return (
    <>
      {/* Backdrop */}
      <div
        aria-hidden={!open}
        onClick={onClose}
        className={`fixed inset-0 z-[var(--z-modal)] bg-foreground/30 backdrop-blur-[2px] transition-opacity duration-[var(--duration-slow)] ease-[var(--ease-standard)] ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      />

      {/* Panel */}
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={
          open ? `${propertyLabel} voice reference` : "Voice reference"
        }
        className={`fixed right-0 top-0 z-[calc(var(--z-modal)+1)] flex h-full w-full max-w-[640px] flex-col border-l border-border bg-background shadow-2xl transition-transform duration-[var(--duration-slower)] ease-[var(--ease-standard)] ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div>
            <div className="eyebrow text-aurora-violet">Voice reference</div>
            <div
              className="text-[15px]"
              style={{ fontFamily: MAGNETIK, fontWeight: 700 }}
            >
              {propertyLabel}
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close voice reference"
            className="flex h-9 w-9 items-center justify-center rounded-full text-foreground/70 transition-colors hover:bg-accent hover:text-foreground"
          >
            <X className="h-4 w-4" strokeWidth={2.2} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-8">
          <div className="mx-auto max-w-prose">
            {open && (
              <ReactMarkdown components={voiceMarkdownComponents}>
                {content}
              </ReactMarkdown>
            )}
          </div>
        </div>
      </aside>
    </>
  );
}

const voiceMarkdownComponents: Components = {
  h1: ({ children }) => (
    <h1
      className="text-balance text-[36px] leading-[1.05] tracking-[-0.01em] text-foreground"
      style={{ fontFamily: MAGNETIK, fontWeight: 900 }}
    >
      {children}
    </h1>
  ),
  h2: ({ children }) => (
    <h2
      className="mt-12 text-[22px] leading-[1.2] text-foreground"
      style={{ fontFamily: MAGNETIK, fontWeight: 700 }}
    >
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3
      className="mt-8 text-[18px] leading-[1.3] text-foreground"
      style={{ fontFamily: MAGNETIK, fontWeight: 600 }}
    >
      {children}
    </h3>
  ),
  p: ({ children }) => (
    <p className="mt-4 text-[14px] leading-relaxed text-foreground/85">
      {children}
    </p>
  ),
  // DCP rule: no italics. Render <em> as a small caption-style block,
  // typically used for the date subtitle.
  em: ({ children }) => (
    <span
      className="block text-[12px] leading-relaxed text-foreground/55"
      style={{ fontStyle: "normal" }}
    >
      {children}
    </span>
  ),
  strong: ({ children }) => (
    <strong className="font-semibold text-foreground">{children}</strong>
  ),
  ul: ({ children }) => (
    <ul className="mt-4 flex flex-col gap-2">{children}</ul>
  ),
  li: ({ children }) => (
    <li className="flex items-start gap-3 text-[14px] leading-relaxed text-foreground/85">
      <span aria-hidden className="mt-2 inline-block h-1 w-1 shrink-0 rounded-full bg-aurora-violet" />
      <span className="flex-1">{children}</span>
    </li>
  ),
  hr: () => <hr className="my-8 border-border" />,
  blockquote: ({ children }) => (
    <blockquote className="mt-4 border-l-2 border-aurora-violet pl-4 text-[14px] leading-relaxed text-foreground/75">
      {children}
    </blockquote>
  ),
};
