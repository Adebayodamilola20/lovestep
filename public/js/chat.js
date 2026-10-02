import { haptic } from './fx.js';
import { avatarHtml } from './auth.js';

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const QUICK = ['Good luck', 'Nice shot', 'Your move', 'Rematch?', 'GG'];

/** Floating chat: a bubble that grows into the conversation, with typing and unread signals. */
export class Chat {
  constructor({ socket, code }) {
    this.socket = socket;
    this.code = code;
    this.messages = [];
    this.unread = 0;
    this.them = { name: 'Opponent', connected: false };
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
          <input id="chat-input" class="field" name="text" maxlength="200" autocomplete="off" placeholder="Message">
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

    this.onChat = (msg) => this.receive(msg);
    this.onTyping = ({ on }) => { this.theyType = on; this.renderTyping(); };
    socket.on('chat', this.onChat);
    socket.on('typing', this.onTyping);
    this.render();
  }

  get isOpen() { return document.body.classList.contains('chat-open'); }

  setPeople(you, players) {
    this.you = you;
    const p = players[1 - you];
    this.them = p ? { name: p.name, connected: p.connected } : { name: 'Opponent', connected: false };
    this.root.querySelector('.them-name').textContent = this.them.name;
    this.renderTyping();
  }

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
    if (!text) return;
    this.socket.emit('chat', { code: this.code, text });
    this.input.value = '';
    this.sendBtn.disabled = true;
    this.stopTyping();
  }

  onType() {
    this.sendBtn.disabled = !this.input.value.trim();
    if (!this.typingSent && this.input.value) {
      this.typingSent = true;
      this.socket.emit('typing', { code: this.code, on: true });
    }
    clearTimeout(this.typingTimer);
    this.typingTimer = setTimeout(() => this.stopTyping(), 2500);
  }

  stopTyping() {
    clearTimeout(this.typingTimer);
    if (this.typingSent) this.socket.emit('typing', { code: this.code, on: false });
    this.typingSent = false;
  }

  receive(msg) {
    const mine = msg.by === this.you;
    this.messages.push({ text: msg.text, mine, from: msg.from, fresh: true });
    if (!mine) {
      this.theyType = false;
      if (!this.isOpen) {
        this.unread++;
        this.renderBadge();
        this.showBanner(msg);
        haptic(16);
      }
    }
    this.render();
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
    const status = this.root.querySelector('.them-status');
    status.innerHTML = this.theyType ? 'typing<span class="dots" style="margin-left:4px"><i></i><i></i><i></i></span>' : this.them.connected ? 'In the room' : 'Away';
    this.fabTyping.classList.toggle('on', this.theyType && !this.isOpen);
    this.render();
  }

  render() {
    const html = this.messages.length
      ? this.messages.map((m) => `<div class="bubble${m.mine ? ' mine' : ''}${m.fresh ? ' new' : ''}">${esc(m.text)}</div>`).join('')
      : `<p class="empty">Say something to ${esc(this.them.name)}. Messages stay in this room.</p>`;
    this.list.innerHTML = html + (this.theyType ? '<div class="bubble typing" aria-label="typing"><span class="dots"><i></i><i></i><i></i></span></div>' : '');
    this.list.scrollTop = this.list.scrollHeight;
    for (const m of this.messages) m.fresh = false;
  }

  destroy() {
    this.stopTyping();
    this.socket.off('chat', this.onChat);
    this.socket.off('typing', this.onTyping);
    document.removeEventListener('keydown', this.onKey);
    document.body.classList.remove('chat-open');
    clearTimeout(this.bannerTimer);
    this.root.remove();
  }
}
