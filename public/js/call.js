// Voice calls between the two of you. The server only rings the other phone and passes the
// connection details; once connected, audio goes straight from phone to phone (WebRTC).
import { haptic } from './fx.js';
import { avatarHtml } from './auth.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const mmss = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const RING_MS = 40000; // give up if nobody answers

/**
 * Voice tuned for bad networks: ~24 kbps mono Opus (a quarter of the default) with in-band
 * forward error correction, so a lost packet is rebuilt from the next one, and DTX, which sends
 * almost nothing during silence. Stays clear on weak 2G/3G.
 */
const VOICE_KBPS = 24;
function tuneSdp(sdp) {
  const pt = /a=rtpmap:(\d+) opus\/48000/i.exec(sdp)?.[1];
  if (!pt) return sdp;
  const want = `useinbandfec=1;usedtx=1;stereo=0;sprop-stereo=0;maxaveragebitrate=${VOICE_KBPS * 1000};maxplaybackrate=24000`;
  const line = new RegExp(`a=fmtp:${pt} ([^\\r\\n]*)`);
  return line.test(sdp)
    ? sdp.replace(line, (_, params) => `a=fmtp:${pt} ${[...new Set([...params.split(';').filter((x) => !/^(useinbandfec|usedtx|stereo|sprop-stereo|maxaveragebitrate|maxplaybackrate)=/.test(x)), ...want.split(';')])].join(';')}`)
    : sdp.replace(`a=rtpmap:${pt} opus/48000/2`, `a=rtpmap:${pt} opus/48000/2\r\na=fmtp:${pt} ${want}`);
}

/** A soft two-tone ring made in the browser, so there's no sound file to download. */
function ringer(kind) {
  let ctx = null, timer = 0;
  const beep = () => {
    try {
      ctx ??= new (window.AudioContext || window.webkitAudioContext)();
      const t = ctx.currentTime;
      const tones = kind === 'in' ? [[0, 660], [0.18, 880], [0.6, 660], [0.78, 880]] : [[0, 440], [0.4, 440]];
      for (const [at, f] of tones) {
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.frequency.value = f; o.type = 'sine';
        g.gain.setValueAtTime(0, t + at); g.gain.linearRampToValueAtTime(kind === 'in' ? 0.22 : 0.08, t + at + 0.02); g.gain.linearRampToValueAtTime(0, t + at + 0.16);
        o.connect(g).connect(ctx.destination); o.start(t + at); o.stop(t + at + 0.2);
      }
    } catch { /* no audio yet: vibration still works */ }
    if (kind === 'in') navigator.vibrate?.([400, 200, 400]);
  };
  return {
    start() { beep(); timer = setInterval(beep, kind === 'in' ? 2200 : 3000); },
    stop() { clearInterval(timer); navigator.vibrate?.(0); ctx?.close?.().catch(() => {}); ctx = null; },
  };
}

export class Calls {
  constructor({ socket, api, me, people, toast }) {
    this.socket = socket;
    this.api = api; // base URL of the game server
    this.me = me; // () => your user
    this.people = people; // () => [{ id, username, avatar, online }]
    this.toast = toast;
    this.call = null;

    this.btn = document.createElement('button');
    this.btn.className = 'call-fab';
    this.btn.type = 'button';
    this.btn.setAttribute('aria-label', 'Call');
    this.btn.innerHTML = '<i class="ph-fill ph-phone"></i>';
    this.btn.addEventListener('click', () => (this.call ? this.expand() : this.pick()));
    document.body.append(this.btn);

    this.ui = document.createElement('div');
    this.ui.className = 'call';
    this.ui.hidden = true;
    document.body.append(this.ui);
    this.audio = document.createElement('audio');
    this.audio.autoplay = true;
    this.audio.setAttribute('playsinline', '');
    document.body.append(this.audio);

    const on = (ev, fn) => { socket.on(ev, fn); (this.offs ??= []).push(() => socket.off(ev, fn)); };
    on('call:incoming', (m) => this.incoming(m));
    on('call:accept', (m) => this.mine(m) && this.accepted());
    on('call:decline', (m) => this.mine(m) && this.finish('Declined', false, true));
    on('call:busy', (m) => this.mine(m) && this.finish('On another call'));
    on('call:end', (m) => this.mine(m) && this.finish(this.call.state === 'ringing' && this.call.dir === 'in' ? 'Missed call' : 'Call ended'));
    on('call:taken', (m) => this.mine(m) && this.call.dir === 'in' && this.call.state === 'ringing' && this.finish('Answered on another device', true));
    on('call:signal', (m) => this.mine(m) && this.signal(m.data));
    // Our own connection to the server comes back: if the call dropped, try to rejoin it.
    on('connect', () => { if (this.call?.state === 'reconnecting') this.restart(); });
    this.refresh();
  }

  mine(m) { return this.call && m.callId === this.call.id; }
  refresh() { this.btn.hidden = !this.people().length; this.btn.classList.toggle('live', !!this.call); }

  /* ---------- starting a call ---------- */
  pick() {
    const list = this.people();
    if (!list.length) return;
    const dlg = document.createElement('dialog');
    dlg.className = 'sheet call-pick';
    dlg.innerHTML = `
      <form method="dialog" class="sheet-head"><h2>Call</h2><button class="btn btn-quiet btn-icon" aria-label="Close"><i class="ph ph-x"></i></button></form>
      <div class="sheet-body"><ul>${list.map((p) => `
        <li><button type="button" data-id="${esc(p.id)}">${avatarHtml(p, 'md')}<span><b>${esc(p.username)}</b><small>${p.online ? 'Online now' : 'Not on LoveStep right now'}</small></span><i class="ph-fill ph-phone"></i></button></li>`).join('')}</ul></div>`;
    document.body.append(dlg);
    dlg.addEventListener('close', () => dlg.remove());
    dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });
    dlg.querySelectorAll('[data-id]').forEach((b) => b.addEventListener('click', () => { dlg.close(); this.dial(list.find((p) => p.id === b.dataset.id)); }));
    dlg.showModal();
  }

  async dial(person) {
    if (this.call) return;
    haptic(10);
    this.call = { id: crypto.randomUUID?.() ?? String(Math.random()).slice(2), dir: 'out', with: person, phone: person.phone, state: 'calling', muted: false, big: true };
    this.render();
    // Ask for the microphone first, from the tap itself (browsers require that).
    if (!(await this.mic())) return;
    const res = await new Promise((r) => this.socket.timeout(8000).emit('call:invite', { to: person.id, callId: this.call?.id }, (err, v) => r(err ? { error: 'timeout' } : v)));
    if (!this.call) return;
    if (this.call && res?.phone) this.call.phone = res.phone;
    if (res?.error === 'offline') return this.finish(`${person.username} isn’t on LoveStep right now, so the call can’t reach them. We left them a missed call in your chat.`, false, true);
    if (res?.error) return this.finish(res.error === 'timeout' ? 'Couldn’t reach the server. Check your connection.' : res.error);
    this.set('ringing');
    this.tone = ringer('out');
    this.tone.start();
    this.call.ringTimer = setTimeout(() => {
      if (this.call?.state !== 'ringing') return;
      this.emit('call:end');
      this.socket.emit('call:missed', { to: person.id });
      this.finish('No answer', false, true);
    }, RING_MS);
  }

  incoming({ from, callId }) {
    if (this.call) { this.socket.emit('call:busy', { to: from.id, callId }); return; }
    this.call = { id: callId, dir: 'in', with: from, state: 'ringing', muted: false, big: true };
    this.render();
    this.tone = ringer('in');
    this.tone.start();
    this.call.ringTimer = setTimeout(() => { if (this.call?.state === 'ringing') this.finish('Missed call'); }, RING_MS);
  }

  async answer() {
    this.tone?.stop();
    this.set('connecting');
    if (!(await this.mic())) { this.emit('call:decline'); return; }
    this.emit('call:accept');
    await this.peer(false);
  }

  decline() { this.tone?.stop(); this.emit('call:decline'); this.finish('Declined', true); }
  hangup() {
    const ringing = this.call?.dir === 'out' && ['calling', 'ringing'].includes(this.call.state);
    this.emit('call:end');
    if (ringing && this.call.state === 'ringing') this.socket.emit('call:missed', { to: this.call.with.id });
    this.finish(ringing ? 'Cancelled' : 'Call ended', ringing);
  }
  emit(ev, data) { if (this.call) this.socket.emit(ev, { to: this.call.with.id, callId: this.call.id, data }); }

  async mic() {
    try {
      this.local = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
      return true;
    } catch {
      this.finish('Allow the microphone to make calls (tap the lock icon in the address bar).');
      return false;
    }
  }

  /* ---------- the phone-to-phone connection ---------- */
  async accepted() {
    clearTimeout(this.call.ringTimer);
    this.tone?.stop();
    this.set('connecting');
    await this.peer(true);
  }

  async peer(caller) {
    const { iceServers } = await fetch(this.api + '/api/ice').then((r) => r.json()).catch(() => ({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] }));
    if (!this.call) return;
    const pc = this.pc = new RTCPeerConnection({ iceServers });
    this.call.caller = caller;
    this.local.getTracks().forEach((t) => {
      const sender = pc.addTrack(t, this.local);
      // Keep the voice small and ask the phone to send it before anything else.
      const p = sender.getParameters();
      p.encodings = [{ ...(p.encodings?.[0] ?? {}), maxBitrate: VOICE_KBPS * 1000, priority: 'high', networkPriority: 'high' }];
      sender.setParameters(p).catch(() => {});
    });
    pc.ontrack = (e) => {
      // A slightly deeper buffer smooths out a shaky line (Chrome/Android honour this).
      try { e.receiver.jitterBufferTarget = 120; } catch { /* not supported */ }
      this.audio.srcObject = e.streams[0];
      this.audio.play().catch(() => {});
    };
    pc.onicecandidate = (e) => { if (e.candidate) this.emit('call:signal', { ice: e.candidate }); };
    pc.onconnectionstatechange = () => {
      const st = pc.connectionState;
      if (st === 'connected') { this.set('connected'); this.call.startedAt ??= Date.now(); clearTimeout(this.call.lostTimer); }
      if (st === 'disconnected' || st === 'failed') this.lost();
    };
    if (caller) await this.offer();
  }

  async offer(iceRestart = false) {
    const offer = await this.pc.createOffer({ iceRestart });
    await this.pc.setLocalDescription({ type: 'offer', sdp: tuneSdp(offer.sdp) });
    this.emit('call:signal', { sdp: this.pc.localDescription });
  }

  async signal(data) {
    if (!this.pc && data?.sdp?.type === 'offer') await this.peer(false);
    const pc = this.pc;
    if (!pc) return;
    try {
      if (data.sdp) {
        await pc.setRemoteDescription(data.sdp);
        if (data.sdp.type === 'offer') {
          const answer = await pc.createAnswer();
          await pc.setLocalDescription({ type: 'answer', sdp: tuneSdp(answer.sdp) });
          this.emit('call:signal', { sdp: pc.localDescription });
        }
        for (const c of this.pendingIce ?? []) await pc.addIceCandidate(c).catch(() => {});
        this.pendingIce = [];
      } else if (data.ice) {
        if (pc.remoteDescription) await pc.addIceCandidate(data.ice).catch(() => {});
        else (this.pendingIce ??= []).push(data.ice);
      }
    } catch { /* a stale message from before a reconnect */ }
  }

  // The connection wobbled: keep the call, show "Reconnecting", and try a fresh route.
  lost() {
    if (!this.call || this.call.state === 'ended') return;
    this.set('reconnecting');
    clearTimeout(this.call.lostTimer);
    if (this.call.caller) setTimeout(() => this.restart(), 1500);
    this.call.lostTimer = setTimeout(() => { if (this.call?.state === 'reconnecting') { this.emit('call:end'); this.finish('Call dropped. The connection was lost.'); } }, 30000);
  }
  restart() { if (this.pc && this.call?.caller && this.socket.connected) this.offer(true).catch(() => {}); }

  /* ---------- controls ---------- */
  mute() {
    this.call.muted = !this.call.muted;
    this.local?.getAudioTracks().forEach((t) => { t.enabled = !this.call.muted; });
    haptic(6);
    this.render();
  }
  async speaker() {
    // Only some browsers let a web page choose the loudspeaker; elsewhere the phone decides.
    this.call.speaker = !this.call.speaker;
    try {
      if (this.audio.setSinkId) {
        const outs = (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === 'audiooutput');
        const pick = outs.find((d) => (this.call.speaker ? /speaker/i : /earpiece|receiver/i).test(d.label)) ?? outs[0];
        if (pick) await this.audio.setSinkId(pick.deviceId);
      }
    } catch { /* not supported */ }
    this.audio.volume = 1;
    haptic(6);
    this.render();
  }
  shrink() { this.call.big = false; this.render(); }
  expand() { if (this.call) { this.call.big = true; this.render(); } }

  set(state) { if (!this.call) return; this.call.state = state; this.render(); }

  /** End the call. `options` keeps the screen up with Call again / Call phone / Close. */
  finish(reason, quiet = false, options = false) {
    if (!this.call) return;
    clearTimeout(this.call.ringTimer);
    clearTimeout(this.call.lostTimer);
    clearInterval(this.clock);
    this.tone?.stop();
    this.pc?.close(); this.pc = null;
    this.local?.getTracks().forEach((t) => t.stop()); this.local = null;
    this.audio.srcObject = null;
    this.pendingIce = [];
    const was = this.call;
    was.state = 'ended'; was.reason = reason; was.big = true; was.options = options && was.dir === 'out';
    this.render();
    if (!quiet) haptic([20, 40, 20]);
    // A normal hang-up closes by itself; a failed call waits for you to choose.
    clearTimeout(this.closeTimer);
    this.closeTimer = setTimeout(() => { if (this.call === was) this.close(); }, was.options ? 20000 : quiet ? 600 : 1800);
  }

  close() { clearTimeout(this.closeTimer); this.call = null; this.ui.hidden = true; this.ui.className = 'call'; this.ui.innerHTML = ''; this.refresh(); }

  /* ---------- the call screen ---------- */
  label() {
    const c = this.call, name = esc(c.with.username);
    return {
      calling: 'Calling…', ringing: c.dir === 'out' ? 'Ringing…' : 'Incoming call', connecting: 'Connecting…',
      connected: mmss((Date.now() - (c.startedAt ?? Date.now())) / 1000), reconnecting: 'Reconnecting… weak signal', ended: esc(c.reason ?? 'Call ended'),
    }[c.state] ?? name;
  }

  render() {
    const c = this.call;
    this.refresh();
    clearInterval(this.clock);
    if (!c) { this.ui.hidden = true; this.ui.className = 'call'; this.ui.innerHTML = ''; return; }
    this.ui.hidden = false;
    this.ui.className = `call ${c.big ? 'big' : 'mini'} st-${c.state}`;
    if (!c.big) {
      this.ui.innerHTML = `<button class="call-mini" type="button">${avatarHtml(c.with, 'xs')}<b>${esc(c.with.username)}</b><span class="t num">${this.label()}</span><i class="ph-fill ph-phone-disconnect" data-end aria-label="End call"></i></button>`;
      this.ui.querySelector('.call-mini').addEventListener('click', (e) => (e.target.closest('[data-end]') ? this.hangup() : this.expand()));
    } else {
      const ringingIn = c.dir === 'in' && c.state === 'ringing';
      this.ui.innerHTML = `
        <div class="call-card" role="dialog" aria-label="Call with ${esc(c.with.username)}">
          ${c.state !== 'ended' && !ringingIn ? '<button class="call-min" type="button" aria-label="Keep playing"><i class="ph ph-caret-down"></i></button>' : ''}
          <div class="call-who">
            <span class="call-ring">${avatarHtml(c.with, 'xl')}</span>
            <b>${esc(c.with.username)}</b>
            <span class="call-state num" aria-live="polite">${this.label()}</span>
            ${c.state === 'ended' && c.options ? `<small class="call-hint">${c.phone ? `“Call phone” rings ${esc(c.with.username)}’s normal number. It works on phone signal, no data needed (normal call charges).` : `Add phone numbers in your profiles to get a “Call phone” button that works on signal alone.`}</small>` : ''}
          </div>
          <div class="call-actions">
            ${ringingIn ? `
              <button class="call-btn decline" type="button" data-decline><i class="ph-fill ph-phone-disconnect"></i><small>Decline</small></button>
              <button class="call-btn accept" type="button" data-accept><i class="ph-fill ph-phone"></i><small>Accept</small></button>`
            : c.state === 'ended' ? (c.options ? `
              <button class="call-btn" type="button" data-close><i class="ph ph-x"></i><small>Close</small></button>
              <button class="call-btn accept" type="button" data-again><i class="ph-fill ph-phone"></i><small>Call again</small></button>
              ${c.phone ? `<a class="call-btn cell" href="tel:${esc(c.phone)}" data-tel><i class="ph-fill ph-device-mobile"></i><small>Call phone</small></a>` : ''}` : `
              <button class="call-btn" type="button" data-close><i class="ph ph-x"></i><small>Close</small></button>`)
            : c.dir === 'out' && (c.state === 'calling' || c.state === 'ringing') ? `
              <button class="call-btn${c.muted ? ' on' : ''}" type="button" data-mute><i class="ph-fill ${c.muted ? 'ph-microphone-slash' : 'ph-microphone'}"></i><small>${c.muted ? 'Unmute' : 'Mute'}</small></button>
              <button class="call-btn decline" type="button" data-end><i class="ph-fill ph-phone-disconnect"></i><small>Cancel</small></button>` : `
              <button class="call-btn${c.muted ? ' on' : ''}" type="button" data-mute><i class="ph-fill ${c.muted ? 'ph-microphone-slash' : 'ph-microphone'}"></i><small>${c.muted ? 'Unmute' : 'Mute'}</small></button>
              <button class="call-btn${c.speaker ? ' on' : ''}" type="button" data-speaker><i class="ph-fill ph-speaker-high"></i><small>Speaker</small></button>
              <button class="call-btn decline" type="button" data-end><i class="ph-fill ph-phone-disconnect"></i><small>End</small></button>`}
          </div>
        </div>`;
      const q = (s) => this.ui.querySelector(s);
      q('[data-accept]')?.addEventListener('click', () => this.answer());
      q('[data-decline]')?.addEventListener('click', () => this.decline());
      q('[data-end]')?.addEventListener('click', () => this.hangup());
      q('[data-mute]')?.addEventListener('click', () => this.mute());
      q('[data-speaker]')?.addEventListener('click', () => this.speaker());
      q('.call-min')?.addEventListener('click', () => this.shrink());
      q('[data-close]')?.addEventListener('click', () => this.close());
      q('[data-again]')?.addEventListener('click', () => { const who = c.with; this.close(); this.dial(who); });
      q('[data-tel]')?.addEventListener('click', () => setTimeout(() => this.close(), 400));

    }
    // Tick the call timer.
    if (c.state === 'connected') this.clock = setInterval(() => { const t = this.ui.querySelector('.call-state, .t'); if (t) t.textContent = this.label(); }, 1000);
  }
}
