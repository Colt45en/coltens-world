/**
 * GraphicsPipeline – Canvas 2D scene-graph renderer.
 *
 * Hierarchy:
 *   Pipeline
 *     └─ Layer[]        (z-ordered render buckets)
 *          └─ RenderNode[]  (drawable items: sprite / shape / text)
 *
 * The pipeline is driven by the world engine tick via MessageBus but can also
 * be driven manually with pipeline.render().
 */

// ── RenderNode types ─────────────────────────────────────────────────────────

export class RenderNode {
  constructor(opts = {}) {
    this.id        = opts.id        ?? crypto.randomUUID();
    this.x         = opts.x         ?? 0;
    this.y         = opts.y         ?? 0;
    this.rotation  = opts.rotation  ?? 0;   // radians
    this.scaleX    = opts.scaleX    ?? 1;
    this.scaleY    = opts.scaleY    ?? 1;
    this.alpha     = opts.alpha     ?? 1;
    this.visible   = opts.visible   ?? true;
  }

  /** Override in subclasses. */
  // eslint-disable-next-line no-unused-vars
  draw(ctx) {}

  _applyTransform(ctx) {
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rotation);
    ctx.scale(this.scaleX, this.scaleY);
    ctx.globalAlpha *= this.alpha;
  }
}

export class ShapeNode extends RenderNode {
  constructor(opts = {}) {
    super(opts);
    this.shape      = opts.shape      ?? 'rect';   // 'rect' | 'circle' | 'polygon'
    this.width      = opts.width      ?? 32;
    this.height     = opts.height     ?? 32;
    this.radius     = opts.radius     ?? 16;
    this.points     = opts.points     ?? [];       // for polygon
    this.fillStyle  = opts.fillStyle  ?? '#ffffff';
    this.strokeStyle= opts.strokeStyle?? null;
    this.lineWidth  = opts.lineWidth  ?? 1;
  }

  draw(ctx) {
    ctx.save();
    this._applyTransform(ctx);
    ctx.fillStyle = this.fillStyle;
    if (this.strokeStyle) { ctx.strokeStyle = this.strokeStyle; ctx.lineWidth = this.lineWidth; }

    if (this.shape === 'rect') {
      ctx.fillRect(-this.width / 2, -this.height / 2, this.width, this.height);
      if (this.strokeStyle) ctx.strokeRect(-this.width / 2, -this.height / 2, this.width, this.height);

    } else if (this.shape === 'circle') {
      ctx.beginPath();
      ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
      ctx.fill();
      if (this.strokeStyle) ctx.stroke();

    } else if (this.shape === 'polygon' && this.points.length >= 3) {
      ctx.beginPath();
      ctx.moveTo(this.points[0][0], this.points[0][1]);
      for (let i = 1; i < this.points.length; i++) ctx.lineTo(this.points[i][0], this.points[i][1]);
      ctx.closePath();
      ctx.fill();
      if (this.strokeStyle) ctx.stroke();
    }
    ctx.restore();
  }
}

export class TextNode extends RenderNode {
  constructor(opts = {}) {
    super(opts);
    this.text      = opts.text      ?? '';
    this.font      = opts.font      ?? '14px monospace';
    this.fillStyle = opts.fillStyle ?? '#ffffff';
    this.align     = opts.align     ?? 'center';
    this.baseline  = opts.baseline  ?? 'middle';
  }

  draw(ctx) {
    ctx.save();
    this._applyTransform(ctx);
    ctx.font         = this.font;
    ctx.fillStyle    = this.fillStyle;
    ctx.textAlign    = this.align;
    ctx.textBaseline = this.baseline;
    ctx.fillText(this.text, 0, 0);
    ctx.restore();
  }
}

export class SpriteNode extends RenderNode {
  /**
   * @param {{ image: HTMLImageElement|ImageBitmap, width?:number, height?:number } & object} opts
   */
  constructor(opts = {}) {
    super(opts);
    this.image  = opts.image  ?? null;
    this.width  = opts.width  ?? 32;
    this.height = opts.height ?? 32;
    this.sx     = opts.sx     ?? 0;   // source crop x
    this.sy     = opts.sy     ?? 0;
    this.sw     = opts.sw     ?? null; // null → use full image width
    this.sh     = opts.sh     ?? null;
  }

  draw(ctx) {
    if (!this.image) return;
    ctx.save();
    this._applyTransform(ctx);
    const sw = this.sw ?? this.image.width;
    const sh = this.sh ?? this.image.height;
    ctx.drawImage(this.image, this.sx, this.sy, sw, sh,
                  -this.width / 2, -this.height / 2, this.width, this.height);
    ctx.restore();
  }
}

// ── Layer ────────────────────────────────────────────────────────────────────

export class Layer {
  constructor(name, zIndex = 0) {
    this.name   = name;
    this.zIndex = zIndex;
    /** @type {Map<string, RenderNode>} */
    this._nodes = new Map();
  }

  add(node) {
    this._nodes.set(node.id, node);
    return node;
  }
  remove(id) { this._nodes.delete(id); }
  get(id)    { return this._nodes.get(id); }
  get nodes(){ return [...this._nodes.values()]; }

  render(ctx) {
    for (const node of this._nodes.values()) {
      if (node.visible) node.draw(ctx);
    }
  }
}

// ── GraphicsPipeline ─────────────────────────────────────────────────────────

export class GraphicsPipeline {
  /**
   * @param {HTMLCanvasElement} canvas
   * @param {import('../../bus/src/MessageBus.js').MessageBus} [bus]
   */
  constructor(canvas, bus) {
    this.canvas = canvas;
    this.ctx    = canvas.getContext('2d');
    this.bus    = bus ?? null;

    /** @type {Map<string, Layer>} */
    this._layers = new Map();
    this._bgColor = '#0d0d1a';

    if (this.bus) {
      this.bus.on('world:tick', () => this.render());
    }
  }

  // ── Layer management ────────────────────────────────────────────────────────

  /**
   * Add a rendering layer.
   * @param {string} name
   * @param {number} [zIndex]
   * @returns {Layer}
   */
  addLayer(name, zIndex = this._layers.size) {
    const layer = new Layer(name, zIndex);
    this._layers.set(name, layer);
    return layer;
  }

  getLayer(name) { return this._layers.get(name); }

  _sortedLayers() {
    return [...this._layers.values()].sort((a, b) => a.zIndex - b.zIndex);
  }

  // ── Rendering ───────────────────────────────────────────────────────────────

  /** Clear and redraw all layers. */
  render() {
    const { ctx, canvas } = this;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = this._bgColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    for (const layer of this._sortedLayers()) {
      layer.render(ctx);
    }
  }

  /** Resize the canvas. */
  resize(w, h) {
    this.canvas.width  = w;
    this.canvas.height = h;
    this.render();
  }

  set background(color) {
    this._bgColor = color;
  }
}
