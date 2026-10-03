// Movie Night: the host picks a film, and play / pause / skipping stay in step on both phones.
// Every film here is public domain or Creative Commons, streamed from the Internet Archive.
// You can also paste a YouTube link.
export const meta = { id: 'movie', name: 'Movie Night', blurb: 'Pick a film and watch it together, in sync.', tag: 'Together', hidden: true, immersive: true, startAlone: true };

const IA = (id, file) => ({ src: `https://archive.org/download/${id}/${encodeURIComponent(file).replace(/%2F/g, '/')}`, poster: `https://archive.org/services/img/${id}` });
export const FILMS = [
  { id: 'his-girl-friday', title: 'His Girl Friday', year: 1940, genre: 'Romantic comedy', mins: 92, ...IA('his_girl_friday', 'his_girl_friday_512kb.mp4'), blurb: 'A newspaper editor tries to win back his ex-wife, and his best reporter, before she remarries.' },
  { id: 'my-favorite-brunette', title: 'My Favorite Brunette', year: 1947, genre: 'Comedy', mins: 87, ...IA('my_favorite_brunette', 'my_favorite_brunette_512kb.mp4'), blurb: 'Bob Hope is a baby photographer mistaken for a detective.' },
  { id: 'house-on-haunted-hill', title: 'House on Haunted Hill', year: 1959, genre: 'Horror', mins: 75, ...IA('house_on_haunted_hill_ipod', 'house_on_haunted_hill_512kb.mp4'), blurb: 'Vincent Price offers $10,000 to anyone who survives the night.' },
  { id: 'suddenly', title: 'Suddenly', year: 1954, genre: 'Thriller', mins: 76, ...IA('suddenly', 'suddenly_512kb.mp4'), blurb: 'Frank Sinatra takes a small-town family hostage.' },
  { id: 'jungle-book', title: 'Jungle Book', year: 1942, genre: 'Adventure', mins: 105, ...IA('JungleBook', 'Jungle_Book_512kb.mp4'), blurb: 'Mowgli, raised by wolves, returns to the village in Technicolor.' },
  { id: 'mclintock', title: 'McLintock!', year: 1963, genre: 'Western comedy', mins: 127, ...IA('mclintok_widescreen', 'McLintock_512kb.mp4'), blurb: 'John Wayne and Maureen O’Hara feud, flirt and fall in the mud.' },
  { id: 'sintel', title: 'Sintel', year: 2010, genre: 'Animation', mins: 15, ...IA('Sintel', 'sintel-2048-stereo_512kb.mp4'), blurb: 'A girl searches for the baby dragon she raised. Short and heartbreaking.' },
  { id: 'big-buck-bunny', title: 'Big Buck Bunny', year: 2008, genre: 'Animation', mins: 10, ...IA('BigBuckBunny_124', 'Content/big_buck_bunny_720p_surround.mp4'), blurb: 'A giant rabbit gets even with three bullies. Silly and sweet.' },
  { id: 'elephants-dream', title: 'Elephants Dream', year: 2006, genre: 'Animation', mins: 11, ...IA('ElephantsDream', 'ed_hd_512kb.mp4'), blurb: 'Two men explore a strange, endless machine.' },
];
export const film = (id) => FILMS.find((f) => f.id === id) ?? null;

/** "https://youtu.be/ID", "youtube.com/watch?v=ID", "/shorts/ID", "/embed/ID" -> "ID" */
export function youtubeId(url) {
  const m = String(url || '').trim().match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/|live\/))([A-Za-z0-9_-]{11})/);
  return m ? m[1] : /^[A-Za-z0-9_-]{11}$/.test(String(url || '').trim()) ? String(url).trim() : null;
}

export function init() {
  // `at` is the server time when `t` (seconds into the film) was true.
  return { film: null, yt: null, playing: false, t: 0, at: Date.now(), by: null, turn: null, winner: null, msg: null };
}

const sec = (v) => Math.max(0, Math.min(6 * 3600, Number(v) || 0));

export function move(s, p, m, { now = Date.now() } = {}) {
  switch (m.type) {
    case 'pick': {
      if (p !== 0) throw new Error('The host picks the film');
      const yt = m.yt ? youtubeId(m.yt) : null;
      if (m.yt && !yt) throw new Error('That doesn’t look like a YouTube link');
      if (!yt && !film(m.film)) throw new Error('Pick a film from the studio');
      return Object.assign(s, { film: yt ? null : m.film, yt, title: yt ? String(m.title || 'YouTube video').slice(0, 80) : film(m.film).title, playing: false, t: 0, at: now, by: p });
    }
    case 'play': return Object.assign(s, { playing: true, t: sec(m.t), at: now, by: p });
    case 'pause': return Object.assign(s, { playing: false, t: sec(m.t), at: now, by: p });
    case 'seek': return Object.assign(s, { t: sec(m.t), at: now, by: p });
    case 'close': if (p !== 0) throw new Error('Only the host can change the film'); return Object.assign(s, { film: null, yt: null, title: null, playing: false, t: 0, at: now, by: p });
    default: throw new Error('Invalid move');
  }
}

export function status() { return ''; }
