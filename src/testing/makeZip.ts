// Makes a small .zip for tests (a pack's bundle, B14): each file deflated with the platform's own CompressionStream, or
// stored as it is. Tests only; the app never writes a .zip.

/** The checksum a .zip keeps for each file (CRC-32). */
function crc32(data: Uint8Array): number {
  let crc = ~0;
  for (const byte of data) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return ~crc >>> 0;
}

async function deflate(data: Uint8Array): Promise<Uint8Array> {
  const source = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(data);
      controller.close();
    },
  });
  const reader = source.pipeThrough(new CompressionStream('deflate-raw') as unknown as TransformStream<Uint8Array, Uint8Array>).getReader();
  const chunks: number[] = [];
  for (;;) {
    const { done, value } = await reader.read();
    if (done) return new Uint8Array(chunks);
    chunks.push(...value);
  }
}

/** A .zip of these files (path → text or bytes), in the order given. `store` keeps them as they are (no deflate). */
export async function makeZip(files: Record<string, string | Uint8Array>, { store = false }: { store?: boolean } = {}): Promise<Uint8Array> {
  const out: number[] = [];
  const directory: number[] = [];
  const u16 = (n: number) => [n & 0xff, (n >>> 8) & 0xff];
  const u32 = (n: number) => [...u16(n & 0xffff), ...u16(n >>> 16)];
  for (const [path, content] of Object.entries(files)) {
    const name = new TextEncoder().encode(path);
    const data = typeof content === 'string' ? new TextEncoder().encode(content) : content;
    const packed = store ? data : await deflate(data);
    // Shared by both headers: version, flags (UTF-8 names), method, time, date, CRC, sizes, name length, extra length.
    const shared = [...u16(20), ...u16(0x0800), ...u16(store ? 0 : 8), ...u16(0), ...u16(0), ...u32(crc32(data)), ...u32(packed.length), ...u32(data.length), ...u16(name.length), ...u16(0)];
    // In the list: made by, the shared part, then comment length, disk, inner and outer attributes, and where the file starts.
    directory.push(...u32(0x02014b50), ...u16(20), ...shared, ...u16(0), ...u16(0), ...u16(0), ...u32(0), ...u32(out.length), ...name);
    out.push(...u32(0x04034b50), ...shared, ...name, ...packed);
  }
  const count = Object.keys(files).length;
  return new Uint8Array([...out, ...directory, ...u32(0x06054b50), ...u16(0), ...u16(0), ...u16(count), ...u16(count), ...u32(directory.length), ...u32(out.length), ...u16(0)]);
}
