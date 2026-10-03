// Accounts: username + password, a profile photo and gender. Sessions keep you signed in per device.
import { randomBytes, randomUUID, scryptSync, timingSafeEqual } from 'node:crypto';

export const GENDERS = ['woman', 'man', 'nonbinary', 'unsaid'];
export const SUBS = ['', 'en', 'fr', 'es', 'pt', 'ar', 'yo', 'ig', 'ha', 'sw'];
const USERNAME = /^[A-Za-z0-9_.]{3,20}$/;

/** `store` is the data store (store.js); `db` was loaded from it at startup. */
export function createUsers(store, db = {}) {
  db.users ??= {};
  db.sessions ??= {};
  const save = () => store.save('users', db);
  // Photo links point at this server, wherever the website itself is hosted.
  const base = (process.env.PUBLIC_URL || process.env.RENDER_EXTERNAL_URL || '').replace(/\/$/, '');

  const hash = (password, salt) => scryptSync(password, salt, 64).toString('hex');
  const byName = (name) => Object.values(db.users).find((u) => u.lower === String(name).toLowerCase());
  const issue = (id) => {
    const token = randomBytes(24).toString('hex');
    db.sessions[token] = { id, at: Date.now() };
    save();
    return token;
  };

  const publicUser = (u) => u && ({
    id: u.id, username: u.username, gender: u.gender, subs: u.subs ?? '',
    avatar: u.avatarVer ? `${base}/avatars/${u.id}.jpg?v=${u.avatarVer}` : null,
    lastActive: u.lastActive,
  });

  return {
    publicUser,
    get: (id) => db.users[id] ?? null,
    phoneOf: (id) => db.users[id]?.phone || null,

    signup({ username, password, gender }) {
      username = String(username || '').trim();
      if (!USERNAME.test(username)) throw new Error('Usernames are 3 to 20 letters, numbers, dots or underscores.');
      if (byName(username)) throw new Error('That username is taken.');
      // TESTING: passwords switched off for now. Put this check back when passwords return.
      // if (String(password || '').length < 6) throw new Error('Use at least 6 characters for your password.');
      if (!GENDERS.includes(gender)) gender = 'unsaid';
      const salt = randomBytes(16).toString('hex');
      const u = { id: randomUUID(), username, lower: username.toLowerCase(), salt, hash: hash(String(password), salt), gender, avatarVer: 0, created: Date.now(), lastActive: Date.now() };
      db.users[u.id] = u;
      save();
      return { user: publicUser(u), session: issue(u.id) };
    },

    login({ username, password }) {
      const u = byName(String(username || '').trim());
      // TESTING: passwords switched off, the username alone logs in. Restore these two lines when passwords return.
      // const ok = u && timingSafeEqual(Buffer.from(hash(String(password || ''), u.salt), 'hex'), Buffer.from(u.hash, 'hex'));
      // if (!ok) throw new Error('That username and password don’t match.');
      if (!u) throw new Error('No account with that username.');
      return { user: publicUser(u), session: issue(u.id) };
    },

    bySession(token) {
      const s = db.sessions[String(token || '')];
      return s ? db.users[s.id] ?? null : null;
    },

    logout(token) { delete db.sessions[token]; save(); },

    update(id, { gender, username, subs, phone }) {
      const u = db.users[id];
      if (!u) throw new Error('No account');
      // A normal phone number, shown only to the people you play with, for "call her phone instead".
      if (phone !== undefined) {
        const p = String(phone).replace(/[\s()-]/g, '');
        if (p && !/^\+?\d{7,15}$/.test(p)) throw new Error('Phone numbers are digits, with an optional + at the start (e.g. +2348012345678).');
        u.phone = p;
      }
      // Subtitle language for Movie Night ('' = off).
      if (subs !== undefined) u.subs = SUBS.includes(subs) ? subs : '';
      if (gender !== undefined) u.gender = GENDERS.includes(gender) ? gender : 'unsaid';
      if (username !== undefined && username !== u.username) {
        username = String(username).trim();
        if (!USERNAME.test(username)) throw new Error('Usernames are 3 to 20 letters, numbers, dots or underscores.');
        const other = byName(username);
        if (other && other.id !== id) throw new Error('That username is taken.');
        u.username = username;
        u.lower = username.toLowerCase();
      }
      save();
      return publicUser(u);
    },

    /** Accepts a JPEG data URL (the browser resizes before upload). */
    async setAvatar(id, dataUrl) {
      const u = db.users[id];
      const m = /^data:image\/jpeg;base64,([A-Za-z0-9+/=]+)$/.exec(String(dataUrl || ''));
      if (!u || !m) throw new Error('Photo must be a JPEG');
      const buf = Buffer.from(m[1], 'base64');
      if (buf.length > 400_000 || buf[0] !== 0xff || buf[1] !== 0xd8) throw new Error('That photo is too large or not a JPEG');
      await store.putBlob(`avatar-${id}.jpg`, buf);
      u.avatarVer = (u.avatarVer || 0) + 1;
      save();
      return publicUser(u);
    },

    async removeAvatar(id) {
      const u = db.users[id];
      if (!u) return null;
      await store.delBlob(`avatar-${id}.jpg`);
      u.avatarVer = 0;
      save();
      return publicUser(u);
    },

    touch(id) {
      const u = db.users[id];
      if (u) { u.lastActive = Date.now(); save(); }
    },

    avatar: (id) => store.getBlob(`avatar-${id}.jpg`),
  };
}
