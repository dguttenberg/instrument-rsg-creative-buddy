export type AttachmentKind = "pdf" | "image" | "text";

export type Attachment = {
  kind: AttachmentKind;
  name: string;
  mediaType: string;
  size: number;
  data: string; // base64 for pdf/image, raw text for text
};

const MAX_BYTES = 12 * 1024 * 1024; // 12 MB

const IMAGE_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
]);

const TEXT_TYPES = new Set(["text/plain", "text/markdown"]);

export async function readFileAsAttachment(file: File): Promise<Attachment> {
  if (file.size > MAX_BYTES) {
    throw new Error(
      `${file.name} is ${(file.size / 1024 / 1024).toFixed(1)}MB — files must be under 12MB.`,
    );
  }

  const lowerName = file.name.toLowerCase();
  const isPdf =
    file.type === "application/pdf" || lowerName.endsWith(".pdf");
  const isImage = IMAGE_TYPES.has(file.type);
  const isText =
    TEXT_TYPES.has(file.type) ||
    lowerName.endsWith(".txt") ||
    lowerName.endsWith(".md");

  if (isPdf) {
    const data = await readAsBase64(file);
    return {
      kind: "pdf",
      name: file.name,
      mediaType: "application/pdf",
      size: file.size,
      data,
    };
  }
  if (isImage) {
    const data = await readAsBase64(file);
    return {
      kind: "image",
      name: file.name,
      mediaType: file.type,
      size: file.size,
      data,
    };
  }
  if (isText) {
    const data = await file.text();
    return {
      kind: "text",
      name: file.name,
      mediaType: file.type || "text/plain",
      size: file.size,
      data,
    };
  }

  throw new Error(
    `Unsupported file type for ${file.name}. Drop a PDF, image (PNG/JPG/GIF/WEBP), or .txt/.md file.`,
  );
}

function readAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read file"));
    reader.onload = () => {
      const result = reader.result as string;
      const comma = result.indexOf(",");
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.readAsDataURL(file);
  });
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
