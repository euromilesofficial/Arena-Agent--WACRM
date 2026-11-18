/* ============================================================
   Batch import — read a ZIP of HTML files in the browser.

   No library, no network. The reader walks the central directory, accepts
   stored (0) and deflate (8) entries, and inflates with the platform's own
   DecompressionStream. It never writes anything to disk and never runs a
   file: each entry is returned as bytes, and the HTML extractor reduces it
   to blocks exactly as it does for a single upload.

   Refused, with a reason per entry: encrypted entries, ZIP64, unknown
   compression, unsafe names (absolute paths or "..", the zip-slip pattern),
   files that are not .html/.htm, and anything over the size limits.
   ============================================================ */

export const ZIP_LIMITS = {
  /** the whole archive, compressed */
  maxArchiveBytes: 2_000_000,
  /** uncompressed total across every kept entry */
  maxTotalBytes: 4_000_000,
  /** entries we look at in the central directory */
  maxEntries: 200,
} as const;

export interface ZipFile { name: string; bytes: Uint8Array }
export interface ZipSkip { name: string; reason: string }
export interface ZipResult { files: ZipFile[]; skipped: ZipSkip[] }

const SIG_EOCD = 0x06054b50;
const SIG_CEN = 0x02014b50;
const SIG_LOC = 0x04034b50;

const u16 = (v: DataView, o: number) => v.getUint16(o, true);
const u32 = (v: DataView, o: number) => v.getUint32(o, true);

async function inflateRaw(data: Uint8Array): Promise<Uint8Array> {
  if (typeof DecompressionStream === "undefined") throw new Error("This browser cannot unpack ZIP files (no DecompressionStream).");
  const stream = new Blob([data as BlobPart]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/** A name is safe when it is relative, has no "..", and no drive or backslash tricks. */
export function safeName(raw: string): { ok: true; name: string } | { ok: false; reason: string } {
  if (raw.includes("\0")) return { ok: false, reason: "name contains a null byte" };
  if (raw.startsWith("/") || raw.startsWith("\\") || /^[a-zA-Z]:/.test(raw)) return { ok: false, reason: "absolute path" };
  if (raw.split(/[\\/]/).some((p) => p === "..")) return { ok: false, reason: "path climbs out of the archive (..)" };
  const base = raw.split(/[\\/]/).pop() ?? raw;
  return { ok: true, name: base };
}

export async function readZip(buf: ArrayBuffer): Promise<ZipResult> {
  if (buf.byteLength > ZIP_LIMITS.maxArchiveBytes) {
    throw new Error(`The archive is ${(buf.byteLength / 1_000_000).toFixed(1)} MB. The limit is ${ZIP_LIMITS.maxArchiveBytes / 1_000_000} MB.`);
  }
  const bytes = new Uint8Array(buf);
  const view = new DataView(buf);
  // end-of-central-directory record: scan back over at most a 64 KB comment
  let eocd = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 22 - 65557); i--) {
    if (u32(view, i) === SIG_EOCD) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error("This is not a ZIP archive (no end-of-directory record).");
  const count = u16(view, eocd + 10);
  const cenOffset = u32(view, eocd + 16);
  if (count === 0xffff || cenOffset === 0xffffffff) throw new Error("ZIP64 archives are not supported. Re-zip with a standard tool.");
  if (count > ZIP_LIMITS.maxEntries) throw new Error(`The archive has ${count} entries. The limit is ${ZIP_LIMITS.maxEntries}.`);

  const files: ZipFile[] = [];
  const skipped: ZipSkip[] = [];
  let total = 0;
  let p = cenOffset;
  for (let n = 0; n < count; n++) {
    if (p + 46 > bytes.length || u32(view, p) !== SIG_CEN) throw new Error("The archive directory is damaged.");
    const flags = u16(view, p + 8);
    const method = u16(view, p + 10);
    const csize = u32(view, p + 20);
    const usize = u32(view, p + 24);
    const nlen = u16(view, p + 28), elen = u16(view, p + 30), clen = u16(view, p + 32);
    const local = u32(view, p + 42);
    const raw = new TextDecoder("utf-8").decode(bytes.subarray(p + 46, p + 46 + nlen));
    p += 46 + nlen + elen + clen;

    if (raw.endsWith("/")) continue;                              // directory entry
    if (raw.startsWith("__MACOSX/") || raw.split("/").pop()!.startsWith(".")) continue; // archive metadata
    const safe = safeName(raw);
    if (!safe.ok) { skipped.push({ name: raw, reason: safe.reason }); continue; }
    if (!/\.html?$/i.test(safe.name)) { skipped.push({ name: safe.name, reason: "not an HTML file" }); continue; }
    if (flags & 0x1) { skipped.push({ name: safe.name, reason: "encrypted entries are not read" }); continue; }
    if (usize > 400_000) { skipped.push({ name: safe.name, reason: `${Math.round(usize / 1024)} KB, over the 400 KB per-file limit` }); continue; }
    if (total + usize > ZIP_LIMITS.maxTotalBytes) { skipped.push({ name: safe.name, reason: "the archive's uncompressed total would exceed the limit" }); continue; }
    if (local + 30 > bytes.length || u32(view, local) !== SIG_LOC) { skipped.push({ name: safe.name, reason: "local header is damaged" }); continue; }
    const start = local + 30 + u16(view, local + 26) + u16(view, local + 28);
    const body = bytes.subarray(start, start + csize);
    let data: Uint8Array;
    try {
      if (method === 0) data = body;
      else if (method === 8) data = await inflateRaw(body);
      else { skipped.push({ name: safe.name, reason: `compression method ${method} is not supported` }); continue; }
    } catch (e) {
      skipped.push({ name: safe.name, reason: `could not unpack: ${(e as Error).message}` }); continue;
    }
    if (data.byteLength !== usize) { skipped.push({ name: safe.name, reason: "size does not match the directory" }); continue; }
    total += usize;
    files.push({ name: safe.name, bytes: data });
  }
  return { files, skipped };
}
