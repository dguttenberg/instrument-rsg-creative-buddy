import Anthropic from "@anthropic-ai/sdk";
import { NextRequest } from "next/server";
import { SYSTEM_PROMPT } from "@/lib/system-prompt";

export const runtime = "nodejs";
export const maxDuration = 60;

type ClientAttachment = {
  kind: "pdf" | "image" | "text";
  name: string;
  mediaType: string;
  size: number;
  data: string;
};

type ClientMessage = {
  role: "user" | "assistant";
  content: string;
  attachments?: ClientAttachment[];
};

type ChatRequest = {
  property: "pittsburgh" | "des_plaines";
  messages: ClientMessage[];
};

const PROPERTY_LABELS: Record<ChatRequest["property"], string> = {
  pittsburgh: "Rivers Casino Pittsburgh",
  des_plaines: "Rivers Casino Des Plaines",
};

const SUPPORTED_IMAGE_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
]);

function buildUserContent(
  msg: ClientMessage,
  prefix: string,
): string | Anthropic.ContentBlockParam[] {
  const hasAttachments = !!msg.attachments && msg.attachments.length > 0;
  if (!hasAttachments) {
    return prefix ? `${prefix}${msg.content}` : msg.content;
  }

  const blocks: Anthropic.ContentBlockParam[] = [];

  for (const att of msg.attachments!) {
    if (att.kind === "pdf") {
      blocks.push({
        type: "document",
        source: {
          type: "base64",
          media_type: "application/pdf",
          data: att.data,
        },
        title: att.name,
      });
    } else if (att.kind === "image") {
      const mediaType = SUPPORTED_IMAGE_TYPES.has(att.mediaType)
        ? (att.mediaType as "image/png" | "image/jpeg" | "image/gif" | "image/webp")
        : "image/png";
      blocks.push({
        type: "image",
        source: {
          type: "base64",
          media_type: mediaType,
          data: att.data,
        },
      });
    } else if (att.kind === "text") {
      blocks.push({
        type: "text",
        text: `Attached file: ${att.name}\n\n${att.data}`,
      });
    }
  }

  const trailingText = `${prefix}${msg.content}`.trim();
  if (trailingText.length > 0) {
    blocks.push({ type: "text", text: trailingText });
  }
  return blocks;
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: "ANTHROPIC_API_KEY is not set" }),
      { status: 500, headers: { "content-type": "application/json" } },
    );
  }

  let body: ChatRequest;
  try {
    body = (await req.json()) as ChatRequest;
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  if (
    !body ||
    (body.property !== "pittsburgh" && body.property !== "des_plaines") ||
    !Array.isArray(body.messages) ||
    body.messages.length === 0
  ) {
    return new Response(JSON.stringify({ error: "Invalid request shape" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  const client = new Anthropic({ apiKey });

  // Inject the active property as a prefix on the first user turn so the
  // (cached) system prompt stays byte-identical across requests.
  const propertyLabel = PROPERTY_LABELS[body.property];
  const messages: Anthropic.MessageParam[] = body.messages.map((m, i) => {
    if (m.role === "assistant") {
      return { role: "assistant", content: m.content };
    }
    const prefix = i === 0 ? `Active property: ${propertyLabel}\n\n` : "";
    return {
      role: "user",
      content: buildUserContent(m, prefix),
    };
  });

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const encoder = new TextEncoder();
      try {
        const claudeStream = client.messages.stream({
          model: "claude-sonnet-4-6",
          max_tokens: 4096,
          system: [
            {
              type: "text",
              text: SYSTEM_PROMPT,
              cache_control: { type: "ephemeral" },
            },
          ],
          messages,
        });

        for await (const event of claudeStream) {
          if (
            event.type === "content_block_delta" &&
            event.delta.type === "text_delta"
          ) {
            controller.enqueue(encoder.encode(event.delta.text));
          }
        }

        const final = await claudeStream.finalMessage();
        const usage = final.usage;
        const cacheRead = usage.cache_read_input_tokens ?? 0;
        const cacheWrite = usage.cache_creation_input_tokens ?? 0;
        console.log(
          `[chat] in=${usage.input_tokens} out=${usage.output_tokens} cache_read=${cacheRead} cache_write=${cacheWrite}`,
        );
        controller.close();
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        console.error("[chat] error:", err);
        controller.enqueue(encoder.encode(`\n\n[error] ${message}`));
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}
