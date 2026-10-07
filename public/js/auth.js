// Accounts on the client: the welcome screen, photos, avatars and "last seen" text.
import { haptic } from './fx.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
export const GENDERS = [['woman', 'Woman'], ['man', 'Man'], ['nonbinary', 'Non-binary'], ['unsaid', 'Rather not say']];

/** A round photo, or the first letter when there's no photo yet. */
export function avatarHtml(person, cls = '') {
  const name = person?.username ?? person?.name ?? '?';
  // Photos live on the game server, which may be on a different address from this page.
  if (person?.avatar) return `<img class="avatar ${cls}" src="${esc(person.avatar.startsWith('/') ? (window.LS_API || '') + person.avatar : person.avatar)}" alt="" loading="lazy" draggable="false">`;
  return `<span class="avatar initial ${cls}" aria-hidden="true">${esc(name[0]?.toUpperCase() ?? '?')}</span>`;
}

/** "here now", "here 5m ago", "here 3d ago" */
export function seen(person) {
  if (!person) return '';
  if (person.online) return 'here now';
  const t = person.lastActive;
  if (!t) return 'not here yet';
  const s = Math.max(0, (Date.now() - t) / 1000);
  const ago = s < 60 ? 'just now' : s < 3600 ? `${Math.floor(s / 60)}m ago` : s < 86400 ? `${Math.floor(s / 3600)}h ago` : s < 2592000 ? `${Math.floor(s / 86400)}d ago` : `${Math.floor(s / 2592000)}mo ago`;
  return `was here ${ago}`;
}

/** Let the person choose a photo, then centre-crop it to a 320px square JPEG. */
export function pickPhoto() {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.addEventListener('change', () => {
      const file = input.files?.[0];
      if (!file) return resolve(null);
      const img = new Image();
      img.onload = () => {
        const size = 320, c = document.createElement('canvas');
        c.width = c.height = size;
        const s = Math.min(img.naturalWidth, img.naturalHeight);
        c.getContext('2d').drawImage(img, (img.naturalWidth - s) / 2, (img.naturalHeight - s) / 2, s, s, 0, 0, size, size);
        URL.revokeObjectURL(img.src);
        resolve(c.toDataURL('image/jpeg', 0.86));
      };
      img.onerror = () => resolve(null);
      img.src = URL.createObjectURL(file);
    }, { once: true });
    input.click();
  });
}

/** Full-screen welcome: create an account or log in. Resolves with { user, session }. */
export function showAuth(app, { emit, LOGO, invite }) {
  let mode = 'signup', photo = null, gender = 'unsaid', typed = { username: '', password: '' };
  return new Promise((resolve) => {
    const render = () => {
      app.innerHTML = `
        <main class="auth">
          <div class="auth-logo">${LOGO}</div>
          ${invite ? `<p class="auth-invite">${avatarHtml({ username: invite.host, avatar: invite.hostAvatar }, 'sm')}<span><b>${esc(invite.host)}</b> invited you to play. Make an account first, it takes a few seconds.</span></p>` : ''}
          <h1>${mode === 'signup' ? 'Make your account' : 'Welcome back'}</h1>
          <div class="auth-tabs" role="tablist">
            <button type="button" role="tab" data-m="signup" aria-selected="${mode === 'signup'}">New here</button>
            <button type="button" role="tab" data-m="login" aria-selected="${mode === 'login'}">Log in</button>
          </div>
          <form class="auth-form" novalidate>
            ${mode === 'signup' ? `
              <button class="photo-pick" type="button" aria-label="Add a profile photo">
                ${photo ? `<img src="${photo}" alt="">` : '<i class="ph ph-user"></i>'}
                <span class="cam"><i class="ph-fill ph-camera"></i></span>
              </button>` : ''}
            <div>
              <label class="label" for="au-name">Username</label>
              <input class="field" id="au-name" name="username" autocomplete="username" autocapitalize="off" spellcheck="false" maxlength="20" required value="${esc(typed.username)}">
            </div>
            ${mode === 'signup' ? `
              <fieldset class="gender">
                <legend class="label">Gender</legend>
                <div class="chips">${GENDERS.map(([v, l]) => `<button type="button" class="chip-g${gender === v ? ' on' : ''}" data-g="${v}" aria-pressed="${gender === v}">${l}</button>`).join('')}</div>
              </fieldset>` : ''}
            <p class="auth-err" role="alert"></p>
            <button class="btn btn-primary auth-go" type="submit">${mode === 'signup' ? 'Create account' : 'Log in'}</button>
          </form>
        </main>`;
      // Keep what's been typed when switching tabs or adding a photo.
      app.querySelectorAll('#au-name, #au-pass').forEach((i) => i.addEventListener('input', () => { typed[i.name] = i.value; }));
      app.querySelectorAll('[data-m]').forEach((b) => b.addEventListener('click', () => { mode = b.dataset.m; render(); }));
      app.querySelector('.photo-pick')?.addEventListener('click', async () => { const p = await pickPhoto(); if (p) { photo = p; render(); } });
      app.querySelectorAll('[data-g]').forEach((b) => b.addEventListener('click', () => {
        gender = b.dataset.g;
        haptic(4);
        app.querySelectorAll('[data-g]').forEach((x) => { x.classList.toggle('on', x === b); x.setAttribute('aria-pressed', x === b); });
      }));
      const form = app.querySelector('.auth-form'), err = app.querySelector('.auth-err'), go = app.querySelector('.auth-go');
      if (!typed.username) app.querySelector('#au-name').focus();
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const f = new FormData(form);
        const username = String(f.get('username')).trim(), password = '';
        if (!username) { err.textContent = 'Fill in your username.'; return; }
        go.disabled = true;
        go.textContent = mode === 'signup' ? 'Creating…' : 'Logging in…';
        const res = await emit(mode, { username, password, gender });
        if (res.error) { err.textContent = res.error; go.disabled = false; go.textContent = mode === 'signup' ? 'Create account' : 'Log in'; return; }
        haptic(20);
        resolve({ ...res, photo: mode === 'signup' ? photo : null });
      });
    };
    render();
  });
}
