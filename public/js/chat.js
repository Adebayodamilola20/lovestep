import { haptic } from './fx.js';
import { avatarHtml, seen } from './auth.js';

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const cap = (t) => t.charAt(0).toUpperCase() + t.slice(1);
const QUICK = ['Good luck', 'Nice shot', 'Your move', 'Rematch?', 'GG'];

/**
 * Floating chat: a bubble that grows into the conversation, with typing and unread signals.
 * There is one conversation per couple, shared by the home page and every game, and kept on the server.
 */
export class Chat {
  constructor({ socket, meId, partner, copy, open, call }) {
    this.socket = socket;
    this.meId = meId;
    this.copy = copy; // (text) => Promise<boolean>
    this.openLink = open; // (code) => void
    this.callBack = call; // () => void: ring the person you're chatting with
    this.messages = [];
    this.unread = 0;
    this.them = null;
    this.theyType = false;
    this.typingSent = false;

    this.root = document.createElement('div');
    this.root.innerHTML = `
      <button class="chat-fab" type="button" aria-label="Open chat" aria-expanded="false">
        <i class="ph-fill ph-chat-teardrop-text"></i>
        <span class="badge num" aria-hidden="true"></span>
        <span class="typing-dot" aria-hidden="true"><span class="dots"><i></i><i></i><i></i></span></span>
      </button>
      <section class="chat-panel" aria-label="Chat" role="dialog">
        <header>
          <div class="who"><b class="them-name"></b><small class="them-status"></small></div>
          <button class="btn btn-quiet btn-icon close" type="button" aria-label="Close chat"><i class="ph ph-x"></i></button>
        </header>
        <div class="messages" aria-live="polite"></div>
        <div class="quick">${QUICK.map((q) => `<button type="button">${q}</button>`).join('')}</div>
        <form class="composer">
          <label class="sr-only" for="chat-input">Message</label>
          <input id="chat-input" class="field" name="text" maxlength="500" autocomplete="off" placeholder="Message">
          <button class="send" type="submit" aria-label="Send" disabled><i class="ph ph-arrow-up"></i></button>
        </form>
      </section>
      <button class="banner" type="button" aria-live="polite">
        <span class="av"></span><span class="txt"><b></b><span></span></span>
      </button>`;
    document.body.append(this.root);

    const $ = (s) => this.root.querySelector(s);
    this.fab = $('.chat-fab');
    this.badge = $('.badge');
    this.fabTyping = $('.typing-dot');
    this.panel = $('.chat-panel');
    this.list = $('.messages');
    this.form = $('.composer');
    this.input = $('#chat-input');
    this.sendBtn = $('.send');
    this.bannerEl = $('.banner');

    this.fab.addEventListener('click', () => this.open());
    $('.close').addEventListener('click', () => this.close());
    this.bannerEl.addEventListener('click', () => { this.hideBanner(); this.open(); });
    this.root.querySelectorAll('.quick button').forEach((b) => b.addEventListener('click', () => this.send(b.textContent)));
    this.form.addEventListener('submit', (e) => { e.preventDefault(); this.send(this.input.value); });
    this.input.addEventListener('input', () => this.onType());
    this.onKey = (e) => { if (e.key === 'Escape' && this.isOpen) this.close(); };
    document.addEventListener('keydown', this.onKey);

    this.onChat = (msg) => { if (this.them && msg.with === this.them.id) this.receive(msg); };
    this.onTyping = ({ from, on }) => { if (from === this.them?.id) { this.theyType = on; this.renderTyping(); } };
    socket.on('dm', this.onChat);
    socket.on('dm:typing', this.onTyping);
    this.list.addEventListener('click', (e) => this.onCardClick(e));
    this.setPartner(partner);
  }

  get isOpen() { return document.body.classList.contains('chat-open'); }

  /** Who you're talking to. Loads your shared history the first time (or when it changes). */
  async setPartner(p) {
    const changed = p?.id !== this.them?.id;
    this.them = p ? { id: p.id, name: p.username ?? p.name, avatar: p.avatar, online: p.online, lastActive: p.lastActive, inRoom: p.inRoom } : null;
    this.root.hidden = !this.them;
    if (!this.them) return;
    this.root.querySelector('.them-name').textContent = this.them.name;
    this.renderTyping();
    if (!changed) return;
    this.messages = [];
    this.render();
    const res = await new Promise((r) => this.socket.emit('dm:history', { to: this.them.id }, r));
    if (res?.messages && p.id === this.them?.id) { this.messages = res.messages.map((m) => this.shape(m, false)); this.render(); }
  }

  shape(m, fresh) { return { ...m, mine: m.from === this.meId, fresh }; }

  open() {
    document.body.classList.add('chat-open');
    this.fab.setAttribute('aria-expanded', 'true');
    this.unread = 0;
    this.renderBadge();
    this.hideBanner();
    this.render();
    setTimeout(() => this.input.focus({ preventScroll: true }), 120);
  }

  close() {
    document.body.classList.remove('chat-open');
    this.fab.setAttribute('aria-expanded', 'false');
    this.stopTyping();
    this.fab.focus({ preventScroll: true });
  }

  send(text) {
    text = String(text || '').trim();
    if (!text || !this.them) return;
    this.socket.emit('dm', { to: this.them.id, text });
    this.input.value = '';
    this.sendBtn.disabled = true;
    this.stopTyping();
  }

  /** Drop a game invite into the conversation as a card the other person can copy or open. */
  sendInvite(code, text = '') {
    if (!this.them) return false;
    this.socket.emit('dm', { to: this.them.id, text, invite: { code } });
    this.open();
    return true;
  }

  onType() {
    this.sendBtn.disabled = !this.input.value.trim();
    if (!this.typingSent && this.input.value && this.them) {
      this.typingSent = true;
      this.socket.emit('dm:typing', { to: this.them.id, on: true });
    }
    clearTimeout(this.typingTimer);
    this.typingTimer = setTimeout(() => this.stopTyping(), 2500);
  }

  stopTyping() {
    clearTimeout(this.typingTimer);
    if (this.typingSent && this.them) this.socket.emit('dm:typing', { to: this.them.id, on: false });
    this.typingSent = false;
  }

  receive(msg) {
    const m = this.shape(msg, true);
    this.messages.push(m);
    if (!m.mine) {
      this.theyType = false;
      if (!this.isOpen) {
        this.unread++;
        this.renderBadge();
        this.showBanner({ from: this.them.name, avatar: this.them.avatar, text: m.call === 'missed' ? 'Missed call' : m.invite ? `Sent you a ${m.invite.game} link` : m.text });
        haptic(16);
      }
    }
    this.render();
  }

  async onCardClick(e) {
    if (e.target.closest('[data-callback]')) { this.close(); this.callBack?.(); return; }
    const btn = e.target.closest('[data-copy-code], [data-open-code]');
    if (!btn) return;
    const code = btn.dataset.copyCode || btn.dataset.openCode;
    if (btn.dataset.openCode) { this.close(); this.openLink?.(code); return; }
    const ok = await this.copy?.(`${location.origin}/r/${code}`);
    btn.classList.toggle('copied', !!ok);
    btn.innerHTML = ok ? '<i class="ph ph-check"></i>Copied' : '<i class="ph ph-copy"></i>Press and hold the link';
    haptic(ok ? 10 : 4);
    clearTimeout(btn._t);
    btn._t = setTimeout(() => { btn.classList.remove('copied'); btn.innerHTML = '<i class="ph ph-copy"></i>Copy link'; }, 1800);
  }

  showBanner(msg) {
    const b = this.bannerEl;
    b.querySelector('.av').innerHTML = avatarHtml({ username: msg.from, avatar: msg.avatar });
    b.querySelector('b').textContent = msg.from;
    b.querySelector('.txt span').textContent = msg.text;
    b.classList.add('on');
    clearTimeout(this.bannerTimer);
    this.bannerTimer = setTimeout(() => this.hideBanner(), 4200);
  }

  hideBanner() { this.bannerEl.classList.remove('on'); }

  renderBadge() {
    this.badge.textContent = this.unread > 9 ? '9+' : this.unread;
    this.badge.classList.toggle('on', this.unread > 0);
    this.fab.setAttribute('aria-label', this.unread ? `Open chat, ${this.unread} unread` : 'Open chat');
  }

  renderTyping() {
    if (!this.them) return;
    const status = this.root.querySelector('.them-status');
    status.innerHTML = this.theyType ? 'typing<span class="dots" style="margin-left:4px"><i></i><i></i><i></i></span>'
      : this.them.inRoom ? 'In the game with you' : esc(cap(seen({ online: this.them.online, lastActive: this.them.lastActive }) || ''));
    this.fabTyping.classList.toggle('on', this.theyType && !this.isOpen);
    this.render();
  }

  bubble(m) {
    if (m.call === 'missed') {
      const when = new Date(m.at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
      return `<div class="bubble call-note${m.mine ? ' mine' : ''}${m.fresh ? ' new' : ''}">
        <span><i class="ph-fill ph-phone-x"></i>${m.mine ? `You called. ${esc(this.them?.name ?? 'They')} didn’t pick up` : `Missed call from ${esc(this.them?.name ?? 'them')}`}</span>
        <small>${when}</small>
        ${m.mine ? '' : '<button type="button" data-callback><i class="ph-fill ph-phone"></i>Call back</button>'}
      </div>`;
    }
    if (m.invite) {
      const url = `${location.origin}/r/${m.invite.code}`;
      return `<div class="bubble invite${m.mine ? ' mine' : ''}${m.fresh ? ' new' : ''}">
        <span class="inv-game"><i class="ph-fill ph-game-controller"></i>${esc(m.mine ? `You sent a ${m.invite.game} link` : `${m.invite.game}: come play`)}</span>
        ${m.text ? `<span class="inv-text">${esc(m.text)}</span>` : ''}
        <span class="inv-url">${esc(url)}</span>
        <span class="inv-actions">
          <button type="button" data-copy-code="${esc(m.invite.code)}"><i class="ph ph-copy"></i>Copy link</button>
          <button type="button" class="go" data-open-code="${esc(m.invite.code)}"><i class="ph ph-play"></i>Open</button>
        </span>
      </div>`;
    }
    return `<div class="bubble${m.mine ? ' mine' : ''}${m.fresh ? ' new' : ''}">${esc(m.text)}</div>`;
  }

  render() {
    const name = this.them?.name ?? 'them';
    const html = this.messages.length
      ? this.messages.map((m) => this.bubble(m)).join('')
      : `<p class="empty">Say something to ${esc(name)}. This chat is just the two of you, and it follows you into every game.</p>`;
    this.list.innerHTML = html + (this.theyType ? '<div class="bubble typing" aria-label="typing"><span class="dots"><i></i><i></i><i></i></span></div>' : '');
    this.list.scrollTop = this.list.scrollHeight;
    for (const m of this.messages) m.fresh = false;
  }

  destroy() {
    this.stopTyping();
    this.socket.off('dm', this.onChat);
    this.socket.off('dm:typing', this.onTyping);
    document.removeEventListener('keydown', this.onKey);
    document.body.classList.remove('chat-open');
    clearTimeout(this.bannerTimer);
    this.root.remove();
  }
}
