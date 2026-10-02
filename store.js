// Where LoveStep keeps its data. With MONGODB_URI set (production) everything lives in MongoDB,
// so restarts and redeploys never lose accounts, photos, records or open games.
// Without it (local dev) the same data is kept as files in ./data.
import { readFileSync, writeFileSync, mkdirSync, renameSync, unlinkSync } from 'node:fs';

export async function createStore(dir) {
  const uri = process.env.MONGODB_URI;
  const timers = new Map();
  // Many quick changes (a burst of moves) become one write.
  const later = (name, fn, ms = 400) => {
    clearTimeout(timers.get(name));
    timers.set(name, setTimeout(() => { timers.delete(name); fn().catch((e) => console.error(`Saving ${name} failed:`, e.message)); }, ms));
  };

  if (uri) {
    const { MongoClient } = await import('mongodb');
    const client = new MongoClient(uri);
    await client.connect();
    const db = client.db(process.env.MONGODB_DB || 'lovestep');
    const docs = db.collection('docs'), blobs = db.collection('blobs');
    console.log('Data: MongoDB');
    return {
      // Stored as JSON text so any key (ids, tokens, "a|b" pairs) is safe.
      async load(name, fallback) {
        const d = await docs.findOne({ _id: name });
        return d ? JSON.parse(d.json) : fallback;
      },
      // `data` can be a function, so a burst of saves serialises only once, at write time.
      save(name, data) { later(name, () => docs.replaceOne({ _id: name }, { _id: name, json: JSON.stringify(typeof data === 'function' ? data() : data), at: new Date() }, { upsert: true })); },
      async putBlob(name, buf) { await blobs.replaceOne({ _id: name }, { _id: name, data: buf, at: new Date() }, { upsert: true }); },
      async getBlob(name) { const b = await blobs.findOne({ _id: name }); return b ? Buffer.from(b.data.buffer ?? b.data) : null; },
      async delBlob(name) { await blobs.deleteOne({ _id: name }); },
    };
  }

  mkdirSync(dir + '/blobs', { recursive: true });
  const file = (name) => `${dir}/${name}.json`;
  const blob = (name) => `${dir}/blobs/${name.replace(/[^a-z0-9._-]/gi, '_')}`;
  console.log('Data: files in', dir);
  return {
    async load(name, fallback) {
      try { return JSON.parse(readFileSync(file(name), 'utf8')); } catch { return fallback; }
    },
    save(name, data) {
      later(name, async () => {
        writeFileSync(file(name) + '.tmp', JSON.stringify(typeof data === 'function' ? data() : data));
        renameSync(file(name) + '.tmp', file(name)); // atomic: never a half-written file
      });
    },
    async putBlob(name, buf) { writeFileSync(blob(name), buf); },
    async getBlob(name) { try { return readFileSync(blob(name)); } catch { return null; } },
    async delBlob(name) { try { unlinkSync(blob(name)); } catch { /* already gone */ } },
  };
}
