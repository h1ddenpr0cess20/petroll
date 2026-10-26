import { SURFACES } from 'madness-engine/textures/town/surfaces';
import { groundAxes } from 'madness-engine/views/town';

/**
 * Everything on screen that isn't the 3D view: where it is, the golden
 * seeds found and the cash, the bubble's meter and the dash's, the seeds
 * eaten and the jobs done along the top; the job
 * under way, its clock and how it's going, at the side; the offer of a job
 * at the bottom; what failed and the bubble shop in the middle; the big
 * messages; the map in the corner, turned with the camera so up on it is
 * up the screen; the buttons for a finger; the title screen.
 */

export function createHud(root, { onStart, onNew, onTake, onRetry, onLeave, onChoose, onClose, onPress }) {
  const $ = (id) => root.querySelector(`#${id}`);
  const top = $('top');
  const placeEl = $('place');
  const cashEl = $('cash');
  const jobsEl = $('jobs');
  const goldEl = $('gold');
  const seedsEl = $('seeds');
  const dashEl = $('dash');
  const dashFill = $('dash-fill');
  const jobEl = $('job');
  const jobTitle = $('job-title'), jobText = $('job-text'), jobCount = $('job-count'), jobClock = $('job-clock');
  const jobMeter = $('job-meter'), jobMeterFill = $('job-meter-fill');
  const offerEl = $('offer');
  const failedEl = $('failed');
  const shopEl = $('shop');
  const shopItems = $('shop-items');
  const touchEl = $('touch');
  const pauseQuit = $('pause-quit');
  const bubbleEl = $('bubble');
  const bubbleFill = $('bubble-fill');
  const bannerEl = $('banner');
  const toastEl = $('toast');
  const titleEl = $('title');
  const startEl = $('start');
  const freshEl = $('fresh');
  const bestEl = $('best');
  const pauseEl = $('pause');
  const muteEl = $('mute');
  const mapEl = $('minimap');
  let shown = false;
  let toastTimer = 0;

  muteEl.addEventListener('click', (e) => {
    e.stopPropagation();
    muteEl.dispatchEvent(new CustomEvent('mute', { bubbles: true }));
  });
  const click = (el, fn) => {
    el.addEventListener('click', (e) => { e.stopPropagation(); fn(); });
    el.addEventListener('pointerdown', (e) => e.stopPropagation());
  };
  click(startEl, onStart);
  click(freshEl, onNew);
  click($('offer-take'), onTake);
  click($('failed-retry'), onRetry);
  click($('failed-leave'), onLeave);
  click($('shop-close'), onClose);
  for (const [id, name] of [['touch-hop', 'hop'], ['touch-dash', 'dash']]) {
    $(id).addEventListener('pointerdown', (e) => { e.stopPropagation(); e.preventDefault(); onPress(name); });
  }
  let shopRows = [];

  // The map: the ground painted once, the moving things over it every frame.
  let base = null, districtAt = () => null;
  const ctx = mapEl.getContext('2d');

  const clock = (s) => {
    const t = Math.max(0, Math.ceil(s));
    return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
  };

  return {
    get bannerShown() { return shown; },

    /** The map to draw in the corner: its ground, painted now. */
    setMap(m) {
      districtAt = (x, z) => m.districtAt(x, z);
      base = document.createElement('canvas');
      base.width = m.cols; base.height = m.rows;
      const b = base.getContext('2d');
      const img = b.createImageData(m.cols, m.rows);
      for (let z = 0; z < m.rows; z++) {
        for (let x = 0; x < m.cols; x++) {
          const c = m.cell(x, z);
          const hex = (SURFACES[c?.surface] ?? SURFACES.grass).map;
          const n = parseInt(hex.slice(1), 16);
          const h = c ? Math.max(...c.h) : 0;
          const k = Math.min(1.5, 0.85 + h * 0.06);
          const i = (z * m.cols + x) * 4;
          img.data[i] = Math.min(255, ((n >> 16) & 255) * k);
          img.data[i + 1] = Math.min(255, ((n >> 8) & 255) * k);
          img.data[i + 2] = Math.min(255, (n & 255) * k);
          img.data[i + 3] = 255;
        }
      }
      b.putImageData(img, 0, 0);
      b.fillStyle = 'rgba(240,236,226,0.85)';
      for (const mk of m.marks) if (mk.w * mk.d < 2) b.fillRect(mk.x, mk.z, Math.max(0.6, mk.w), Math.max(0.6, mk.d));
    },

    /**
     * The map, every frame: centred on the hamster, turned to the camera's
     * `yaw`, `span` tiles across, with the cars, the pumps, the shops,
     * the townsfolk with work going, and what the job under way is after —
     * pinned to the rim when it's further off than the map shows.
     */
    minimap({ ball, yaw, cars, pumps, givers = [], shops = [], goal = null, goals = [], mover = null, rival = null, golden = [], seen = new Set(), span = 64 }) {
      if (!base) return;
      const W = mapEl.width, H = mapEl.height;
      const s = W / span;
      const { up } = groundAxes(yaw);
      const angle = -Math.PI / 2 - Math.atan2(up[1], up[0]);
      ctx.save();
      ctx.clearRect(0, 0, W, H);
      ctx.beginPath();
      ctx.arc(W / 2, H / 2, W / 2 - 2, 0, Math.PI * 2);
      ctx.clip();
      ctx.fillStyle = '#6a5a4a';
      ctx.fillRect(0, 0, W, H);
      ctx.translate(W / 2, H / 2);
      ctx.rotate(angle);
      ctx.scale(s, s);
      ctx.translate(-ball.x, -ball.z);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(base, 0, 0);
      ctx.fillStyle = '#f4f1ea';
      for (const c of cars) ctx.fillRect(c.x - 0.7, c.z - 0.7, 1.4, 1.4);
      for (const p of pumps) dot(ctx, p.x, p.z, 1.3, '#c8382c', '#ffffff');
      for (const p of shops) dot(ctx, p.x, p.z, 1.6, '#3a8a4a', '#e8f4e0');
      for (const g of golden) {
        if (g.got) continue;
        // Only in the parts of town it has been to.
        const d = districtAt(g.x, g.z);
        if (d && !seen.has(d.name)) continue;
        ctx.fillStyle = '#ffd23a';
        ctx.strokeStyle = '#3a2a00';
        ctx.lineWidth = 0.4;
        star(ctx, g.x, g.z, 1.8);
      }
      for (const g of givers) dot(ctx, g.x, g.z, 1.9, '#ffd23a', '#3a2400');
      for (const t of goals) dot(ctx, t.x, t.z, 1.1, '#ff9a5a', '#3a1400');
      if (mover) dot(ctx, mover.x, mover.z, 1.8, '#ff3a2a', '#ffffff');
      if (rival) dot(ctx, rival.x, rival.z, 1.4, '#ff6aa8', '#ffffff');
      ctx.restore();
      // Where to go: on the map, or on its rim pointing the way.
      if (goal) {
        const dx = goal.x - ball.x, dz = goal.z - ball.z;
        const c = Math.cos(angle), sn = Math.sin(angle);
        let px = (dx * c - dz * sn) * s, py = (dx * sn + dz * c) * s;
        const R = W / 2 - 9, d = Math.hypot(px, py);
        if (d > R) { px *= R / d; py *= R / d; }
        ctx.fillStyle = '#7ad8ff';
        ctx.strokeStyle = '#06243a';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(W / 2 + px, H / 2 + py, 6, 0, Math.PI * 2);
        ctx.fill(); ctx.stroke();
      }
      // The hamster, in the middle, pointing up the screen.
      ctx.fillStyle = '#ff9a3a';
      ctx.strokeStyle = '#1c1b1a';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(W / 2, H / 2, 5, 0, Math.PI * 2);
      ctx.fill(); ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.7)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(W / 2, H / 2, W / 2 - 2, 0, Math.PI * 2);
      ctx.stroke();
    },

    title(saved, { done, total, found = 0, golden = 0 }) {
      titleEl.hidden = false;
      top.hidden = true;
      mapEl.hidden = true;
      bannerEl.hidden = true;
      jobEl.hidden = offerEl.hidden = failedEl.hidden = shopEl.hidden = touchEl.hidden = true;
      shown = false;
      const started = done > 0 || found > 0 || saved.cash > 0 || saved.time > 0;
      startEl.textContent = started ? 'CARRY ON' : 'ROLL OUT';
      freshEl.hidden = !started;
      const bits = [];
      if (started) bits.push(`${found} of ${golden} golden seeds`, `${done} of ${total} jobs`, `$${saved.cash}`);
      if (saved.best) bits.push(`best: all ${golden} seeds in ${clock(saved.best)}`);
      bestEl.textContent = bits.join(' · ');
    },

    play() {
      titleEl.hidden = true;
      top.hidden = false;
      mapEl.hidden = false;
      touchEl.hidden = false;
    },

    place(name) { placeEl.textContent = name ?? ''; },
    cash(n, bump = false) {
      cashEl.textContent = `$${n}`;
      if (bump) {
        cashEl.parentElement.classList.remove('up');
        void cashEl.offsetWidth;
        cashEl.parentElement.classList.add('up');
      }
    },
    jobs(n, total) { jobsEl.textContent = `${n}/${total}`; },
    gold(n, total) { goldEl.textContent = `${n}/${total}`; },
    seeds(n) { seedsEl.textContent = String(n); },
    dash(k) {
      dashFill.style.width = `${Math.round(Math.max(0, Math.min(1, k)) * 100)}%`;
      dashEl.classList.toggle('ready', k >= 1);
    },

    /** The job under way, or null: its title, what to do, how far along (`count`), the clock, a meter (0 to 1) if it has one. */
    job(j) {
      jobEl.hidden = !j;
      if (!j) return;
      jobTitle.textContent = j.title;
      jobText.textContent = j.text;
      jobCount.textContent = j.count ?? '';
      jobClock.textContent = j.clock == null ? '' : clock(j.clock);
      jobClock.classList.toggle('low', j.clock != null && j.clock < 10);
      jobMeter.hidden = j.meter == null;
      if (j.meter != null) {
        jobMeterFill.style.width = `${Math.round(Math.max(0, j.meter) * 100)}%`;
        jobMeter.classList.toggle('low', j.meter < 0.35);
      }
    },

    /** Somebody to talk to, or null: `{ giver, job }`, the job null when they've nothing more. */
    offer(o) {
      offerEl.hidden = !o;
      if (!o) return;
      $('offer-name').textContent = o.giver.name;
      offerEl.classList.toggle('none', !o.job);
      $('offer-title').textContent = o.job ? o.job.title : (o.thanks ?? 'All done!');
      $('offer-brief').textContent = o.job ? o.job.brief : (o.giver.line || "That's everything I needed. Thanks, kid.");
      $('offer-pay').textContent = o.job ? `$${o.job.reward} · ${clock(o.job.time)}` : '';
    },
    get offering() { return !offerEl.hidden && !offerEl.classList.contains('none'); },

    /** What went wrong, or null. */
    failed(f) {
      failedEl.hidden = !f;
      if (f) $('failed-why').textContent = f.text;
    },
    get failing() { return !failedEl.hidden; },

    /** The bubble shop, or null: `{ name, cash, items: [{ id, name, text, tint, price, owned, worn }], at }` (the row chosen). */
    shop(sh) {
      shopEl.hidden = !sh;
      if (!sh) return;
      $('shop-name').textContent = sh.name.toUpperCase();
      $('shop-cash').textContent = `$${sh.cash}`;
      shopItems.replaceChildren();
      shopRows = sh.items.map((it, i) => {
        const li = document.createElement('li');
        li.className = (i === sh.at ? 'on ' : '') + (!it.owned && it.price > sh.cash ? 'dear' : '');
        const sw = document.createElement('span');
        if (it.tint) { sw.className = 'swatch'; sw.style.background = it.tint; }
        const name = document.createElement('span');
        name.textContent = it.name;
        const price = document.createElement('span');
        price.className = 'price';
        price.textContent = it.worn ? 'WEARING' : it.owned ? (it.tint ? 'WEAR' : 'OWNED') : `$${it.price}`;
        li.append(sw, name, price);
        if (it.text) {
          const t = document.createElement('small');
          t.textContent = it.text;
          li.append(t);
        }
        li.addEventListener('click', (e) => { e.stopPropagation(); onChoose(i); });
        li.addEventListener('pointerdown', (e) => e.stopPropagation());
        shopItems.append(li);
        return li;
      });
      shopRows[sh.at]?.scrollIntoView?.({ block: 'nearest' });
    },
    get shopping() { return !shopEl.hidden; },

    bubble(v) {
      const k = Math.max(0, Math.min(1, v / 100));
      bubbleFill.style.width = `${k * 100}%`;
      bubbleEl.classList.toggle('low', k <= 0.3);
    },

    /** A knock: the meter shakes. */
    hit() {
      bubbleEl.classList.remove('shake');
      void bubbleEl.offsetWidth;
      bubbleEl.classList.add('shake');
    },

    banner(text, size = 'normal') {
      shown = text != null;
      bannerEl.hidden = !shown;
      if (!shown) return;
      bannerEl.textContent = text;
      bannerEl.className = size;
      void bannerEl.offsetWidth;
      bannerEl.classList.add('pop');
    },

    /** A line along the bottom for a few seconds: where it is, what it found. */
    toast(text, seconds = 2.6) {
      toastEl.textContent = text;
      toastEl.hidden = false;
      toastEl.classList.remove('in');
      void toastEl.offsetWidth;
      toastEl.classList.add('in');
      clearTimeout(toastTimer);
      toastTimer = setTimeout(() => { toastEl.hidden = true; }, seconds * 1000);
    },

    paused(on, { job = false } = {}) {
      pauseEl.hidden = !on;
      pauseQuit.hidden = !job;
    },

    muted(on) {
      muteEl.setAttribute('aria-pressed', String(on));
      muteEl.textContent = on ? 'sound off' : 'sound on';
    },
  };
}

function star(ctx, x, y, r) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 - Math.PI / 2, rr = i % 2 ? r * 0.45 : r;
    ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
}

function dot(ctx, x, y, r, fill, stroke) {
  ctx.fillStyle = fill;
  ctx.strokeStyle = stroke;
  ctx.lineWidth = 0.45;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
}
