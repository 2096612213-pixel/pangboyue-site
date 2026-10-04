import { strFromU8, unzipSync } from "fflate";

const normalizeArchivePath = (value: string) =>
  value.replace(/\\/g, "/").replace(/^\.\//, "").toLowerCase();

/** Extracts the canonical LDraw model stored by BrickLink Studio in an .io. */
export function extractStudioLDraw(archive: ArrayBuffer | Uint8Array): string {
  const bytes = archive instanceof Uint8Array ? archive : new Uint8Array(archive);
  let entries: Record<string, Uint8Array>;
  try {
    entries = unzipSync(bytes, {
      filter: (entry) => /(?:^|\/)model\.ldr$/i.test(entry.name),
    });
  } catch {
    throw new Error("此 .io 文件不是有效的 BrickLink Studio 项目");
  }

  const modelEntry = Object.entries(entries).find(
    ([name]) => normalizeArchivePath(name).split("/").pop() === "model.ldr",
  );
  if (!modelEntry)
    throw new Error("此 .io 文件不包含内嵌 LDraw 模型");

  const source = strFromU8(modelEntry[1]).replace(/^\uFEFF/, "");
  if (!/^\s*0\s+FILE\b/im.test(source) && !/^\s*1\s+/m.test(source))
    throw new Error("此 .io 文件的内嵌模型为空或已损坏");
  return source;
}
