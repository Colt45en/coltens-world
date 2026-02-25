/**
 * AvatarCreator – procedural avatar builder.
 *
 * An Avatar is a plain JSON definition of layered body parts that the
 * GraphicsPipeline can render onto a canvas.  The creator provides:
 *   • Part library (head, body, eyes, mouth, hair, accessory)
 *   • Colour customisation per part
 *   • Serialise / deserialise to JSON
 *   • Render to an OffscreenCanvas (or regular Canvas) for preview
 */

export const PART_TYPES = ['body', 'head', 'eyes', 'mouth', 'hair', 'accessory'];

// ── Part definitions ─────────────────────────────────────────────────────────

export const PART_LIBRARY = {
  body: [
    { id: 'body-round',  label: 'Round',    draw: (ctx, c) => { ctx.fillStyle=c; ctx.beginPath(); ctx.ellipse(0,10,16,20,0,0,Math.PI*2); ctx.fill(); } },
    { id: 'body-square', label: 'Square',   draw: (ctx, c) => { ctx.fillStyle=c; ctx.fillRect(-16,-10,32,30); } },
    { id: 'body-slim',   label: 'Slim',     draw: (ctx, c) => { ctx.fillStyle=c; ctx.beginPath(); ctx.ellipse(0,10,10,22,0,0,Math.PI*2); ctx.fill(); } },
  ],
  head: [
    { id: 'head-circle', label: 'Circle',   draw: (ctx, c) => { ctx.fillStyle=c; ctx.beginPath(); ctx.arc(0,0,20,0,Math.PI*2); ctx.fill(); } },
    { id: 'head-square', label: 'Square',   draw: (ctx, c) => { ctx.fillStyle=c; ctx.fillRect(-18,-18,36,36); } },
    { id: 'head-oval',   label: 'Oval',     draw: (ctx, c) => { ctx.fillStyle=c; ctx.beginPath(); ctx.ellipse(0,0,16,22,0,0,Math.PI*2); ctx.fill(); } },
  ],
  eyes: [
    { id: 'eyes-round',  label: 'Round',    draw: (ctx, c) => { ctx.fillStyle=c; ctx.beginPath(); ctx.arc(-7,-3,4,0,Math.PI*2); ctx.arc( 7,-3,4,0,Math.PI*2); ctx.fill(); } },
    { id: 'eyes-narrow', label: 'Narrow',   draw: (ctx, c) => { ctx.fillStyle=c; ctx.fillRect(-11,-5,8,3); ctx.fillRect(3,-5,8,3); } },
    { id: 'eyes-wide',   label: 'Wide',     draw: (ctx, c) => { ctx.fillStyle=c; ctx.beginPath(); ctx.arc(-7,-3,6,0,Math.PI*2); ctx.arc( 7,-3,6,0,Math.PI*2); ctx.fill(); } },
  ],
  mouth: [
    { id: 'mouth-smile', label: 'Smile',    draw: (ctx, c) => { ctx.strokeStyle=c; ctx.lineWidth=2; ctx.beginPath(); ctx.arc(0,4,8,0.2,Math.PI-0.2); ctx.stroke(); } },
    { id: 'mouth-flat',  label: 'Flat',     draw: (ctx, c) => { ctx.strokeStyle=c; ctx.lineWidth=2; ctx.beginPath(); ctx.moveTo(-7,5); ctx.lineTo(7,5); ctx.stroke(); } },
    { id: 'mouth-frown', label: 'Frown',    draw: (ctx, c) => { ctx.strokeStyle=c; ctx.lineWidth=2; ctx.beginPath(); ctx.arc(0,10,8,Math.PI+0.2,-0.2); ctx.stroke(); } },
  ],
  hair: [
    { id: 'hair-none',   label: 'None',     draw: () => {} },
    { id: 'hair-short',  label: 'Short',    draw: (ctx, c) => { ctx.fillStyle=c; ctx.fillRect(-18,-20,36,10); } },
    { id: 'hair-long',   label: 'Long',     draw: (ctx, c) => { ctx.fillStyle=c; ctx.fillRect(-20,-20,40,10); ctx.fillRect(-20,-10,6,30); ctx.fillRect(14,-10,6,30); } },
    { id: 'hair-spiky',  label: 'Spiky',    draw: (ctx, c) => {
        ctx.fillStyle=c;
        const pts = [[-18,-20],[-12,-32],[-5,-22],[0,-35],[5,-22],[12,-32],[18,-20]];
        ctx.beginPath(); ctx.moveTo(pts[0][0],pts[0][1]);
        for(const p of pts) ctx.lineTo(p[0],p[1]);
        ctx.lineTo(18,-10); ctx.lineTo(-18,-10); ctx.closePath(); ctx.fill();
      }
    },
  ],
  accessory: [
    { id: 'acc-none',    label: 'None',     draw: () => {} },
    { id: 'acc-glasses', label: 'Glasses',  draw: (ctx, c) => {
        ctx.strokeStyle=c; ctx.lineWidth=1.5;
        ctx.strokeRect(-14,-6,10,8); ctx.strokeRect(4,-6,10,8);
        ctx.beginPath(); ctx.moveTo(-4,-2); ctx.lineTo(4,-2); ctx.stroke();
      }
    },
    { id: 'acc-hat',     label: 'Hat',      draw: (ctx, c) => {
        ctx.fillStyle=c;
        ctx.fillRect(-18,-26,36,6);
        ctx.fillRect(-10,-44,20,18);
      }
    },
  ],
};

// ── Avatar definition ────────────────────────────────────────────────────────

const DEFAULTS = {
  body:      { partId: 'body-round',  color: '#e8b4b8' },
  head:      { partId: 'head-circle', color: '#f5cba7' },
  eyes:      { partId: 'eyes-round',  color: '#2c3e50' },
  mouth:     { partId: 'mouth-smile', color: '#c0392b' },
  hair:      { partId: 'hair-short',  color: '#5d4037' },
  accessory: { partId: 'acc-none',    color: '#7f8c8d' },
};

export class Avatar {
  constructor(definition) {
    /** @type {Record<string,{partId:string,color:string}>} */
    this.parts = JSON.parse(JSON.stringify(definition ?? DEFAULTS));
  }

  setPart(type, partId)   { if (this.parts[type]) this.parts[type].partId = partId; }
  setColor(type, color)   { if (this.parts[type]) this.parts[type].color  = color; }

  toJSON()               { return JSON.parse(JSON.stringify(this.parts)); }
  static fromJSON(json)  { return new Avatar(json); }

  /**
   * Render the avatar centered on (cx, cy) with given scale.
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} cx
   * @param {number} cy
   * @param {number} [scale]
   */
  render(ctx, cx, cy, scale = 1) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(scale, scale);

    const order = ['body', 'head', 'hair', 'eyes', 'mouth', 'accessory'];
    // offsets for each part relative to center
    const offsets = { body:[0,30], head:[0,0], hair:[0,-18], eyes:[0,-2], mouth:[0,4], accessory:[0,-4] };

    for (const type of order) {
      const slot = this.parts[type];
      if (!slot) continue;
      const partDef = (PART_LIBRARY[type] ?? []).find(p => p.id === slot.partId);
      if (!partDef || !partDef.draw) continue;
      const [ox, oy] = offsets[type] ?? [0, 0];
      ctx.save();
      ctx.translate(ox, oy);
      partDef.draw(ctx, slot.color);
      ctx.restore();
    }

    ctx.restore();
  }
}

// ── AvatarCreator UI component ───────────────────────────────────────────────

export class AvatarCreator {
  /**
   * @param {HTMLElement} container
   * @param {{ avatar?: Avatar }} [opts]
   */
  constructor(container, opts = {}) {
    this.container = container;
    this.avatar    = opts.avatar ?? new Avatar(DEFAULTS);
    this.onSave    = null;   // callback(avatar)
    this._canvas   = null;
    this._mounted  = false;
  }

  mount() {
    if (this._mounted) return;

    this.container.innerHTML = `
      <style>
        .ac-root { display:flex; gap:12px; height:100%; font-family:sans-serif; color:#cdd6f4; }
        .ac-preview { display:flex; flex-direction:column; align-items:center; gap:8px; }
        .ac-canvas { background:#1e1e2e; border-radius:8px; border:1px solid #313244; }
        .ac-controls { flex:1; overflow-y:auto; display:flex; flex-direction:column; gap:8px; }
        .ac-section { background:#1e1e2e; border-radius:6px; padding:8px; }
        .ac-section h4 { margin:0 0 6px 0; font-size:12px; text-transform:uppercase; color:#89b4fa; }
        .ac-part-row { display:flex; gap:4px; flex-wrap:wrap; margin-bottom:4px; }
        .ac-part-btn { background:#313244; border:1px solid #45475a; border-radius:4px; padding:3px 8px;
          font-size:11px; cursor:pointer; color:#cdd6f4; }
        .ac-part-btn.active { background:#89b4fa; color:#1e1e2e; border-color:#89b4fa; }
        .ac-color-row { display:flex; align-items:center; gap:6px; font-size:11px; }
        .ac-save-btn { background:#a6e3a1; color:#1e1e2e; border:none; border-radius:6px;
          padding:8px 16px; cursor:pointer; font-weight:bold; margin-top:4px; }
        .ac-save-btn:hover { background:#94e2d5; }
        .ac-json-out { background:#11111b; color:#a6e3a1; font:11px monospace; padding:6px;
          border-radius:4px; overflow:auto; max-height:100px; white-space:pre; }
      </style>
      <div class="ac-root">
        <div class="ac-preview">
          <canvas class="ac-canvas" id="ac-canvas" width="120" height="160"></canvas>
          <button class="ac-save-btn" id="ac-save">💾 Save</button>
          <div class="ac-json-out" id="ac-json"></div>
        </div>
        <div class="ac-controls" id="ac-controls"></div>
      </div>
    `;

    this._canvas = this.container.querySelector('#ac-canvas');
    const controls = this.container.querySelector('#ac-controls');

    for (const type of PART_TYPES) {
      const parts = PART_LIBRARY[type] ?? [];
      const sec = document.createElement('div');
      sec.className = 'ac-section';
      sec.innerHTML = `<h4>${type}</h4>`;

      const row = document.createElement('div');
      row.className = 'ac-part-row';
      for (const p of parts) {
        const btn = document.createElement('button');
        btn.className = 'ac-part-btn' + (this.avatar.parts[type]?.partId === p.id ? ' active' : '');
        btn.textContent = p.label;
        btn.dataset.partType = type;
        btn.dataset.partId   = p.id;
        btn.addEventListener('click', () => {
          this.avatar.setPart(type, p.id);
          row.querySelectorAll('.ac-part-btn').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          this._redraw();
        });
        row.appendChild(btn);
      }
      sec.appendChild(row);

      const colorRow = document.createElement('div');
      colorRow.className = 'ac-color-row';
      colorRow.innerHTML = `<label>Color</label>`;
      const inp = document.createElement('input');
      inp.type  = 'color';
      inp.value = this.avatar.parts[type]?.color ?? '#ffffff';
      inp.addEventListener('input', () => {
        this.avatar.setColor(type, inp.value);
        this._redraw();
      });
      colorRow.appendChild(inp);
      sec.appendChild(colorRow);
      controls.appendChild(sec);
    }

    this.container.querySelector('#ac-save').addEventListener('click', () => {
      const json = JSON.stringify(this.avatar.toJSON(), null, 2);
      this.container.querySelector('#ac-json').textContent = json;
      if (this.onSave) this.onSave(this.avatar);
    });

    this._redraw();
    this._mounted = true;
  }

  _redraw() {
    if (!this._canvas) return;
    const ctx = this._canvas.getContext('2d');
    ctx.clearRect(0, 0, 120, 160);
    ctx.fillStyle = '#1e1e2e';
    ctx.fillRect(0, 0, 120, 160);
    this.avatar.render(ctx, 60, 80, 1.2);
  }
}
