/**
 * PrefabCreator – blueprint/template system for reusable game objects.
 *
 * A Prefab is a serialisable JSON template describing the default components
 * an entity should have when instantiated.  The registry resolves inheritance
 * (a prefab can extend another prefab) and instantiates entities into the
 * world engine.
 */

export class PrefabDef {
  /**
   * @param {string} name
   * @param {Record<string,any>} components
   * @param {string|null} [parent]  name of parent prefab to extend
   */
  constructor(name, components = {}, parent = null) {
    this.name       = name;
    this.components = components;
    this.parent     = parent;
    this.tags       = [];
  }

  toJSON() {
    return { name: this.name, components: this.components, parent: this.parent, tags: this.tags };
  }

  static fromJSON(json) {
    const p = new PrefabDef(json.name, json.components ?? {}, json.parent ?? null);
    p.tags = json.tags ?? [];
    return p;
  }
}

export class PrefabRegistry {
  constructor() {
    /** @type {Map<string, PrefabDef>} */
    this._prefabs = new Map();
  }

  /**
   * Register a prefab definition.
   * @param {PrefabDef} def
   */
  register(def) {
    this._prefabs.set(def.name, def);
  }

  /**
   * Get a prefab by name.
   * @param {string} name
   * @returns {PrefabDef|undefined}
   */
  get(name) {
    return this._prefabs.get(name);
  }

  /** All registered prefab names. */
  get names() {
    return [...this._prefabs.keys()];
  }

  /**
   * Resolve the full component map for a prefab, merging parent components
   * (child overrides parent).
   * @param {string} name
   * @returns {Record<string,any>}
   */
  resolve(name) {
    const def = this._prefabs.get(name);
    if (!def) throw new Error(`Prefab '${name}' not found`);
    const base = def.parent ? this.resolve(def.parent) : {};
    return { ...base, ...def.components };
  }

  /**
   * Instantiate a prefab as an entity in the world engine.
   * @param {string} prefabName
   * @param {string} entityId       unique id for the new entity
   * @param {Record<string,any>} [overrides]  per-component overrides
   * @param {import('../../world-engine/src/WorldEngine.js').WorldEngine} world
   * @returns {import('../../world-engine/src/WorldEngine.js').Entity}
   */
  instantiate(prefabName, entityId, overrides = {}, world) {
    const components = { ...this.resolve(prefabName), ...overrides, _prefab: prefabName };
    return world.spawn(entityId, components);
  }

  exportAll() {
    return [...this._prefabs.values()].map(p => p.toJSON());
  }

  importAll(json) {
    for (const item of json) this.register(PrefabDef.fromJSON(item));
  }
}

// ── PrefabCreator UI component ───────────────────────────────────────────────

export class PrefabCreator {
  /**
   * @param {HTMLElement} container
   * @param {PrefabRegistry} registry
   */
  constructor(container, registry) {
    this.container = container;
    this.registry  = registry;
    this.onSave    = null;   // callback(prefabDef)
    this._mounted  = false;
    this._editing  = new PrefabDef('new-prefab', {});
  }

  mount() {
    if (this._mounted) return;

    this.container.innerHTML = `
      <style>
        .pc-root { display:flex; gap:10px; height:100%; font-family:sans-serif; color:#cdd6f4; }
        .pc-list { width:140px; display:flex; flex-direction:column; gap:4px; }
        .pc-list h4 { margin:0 0 6px 0; font-size:12px; color:#89b4fa; text-transform:uppercase; }
        .pc-item { background:#313244; border:1px solid #45475a; border-radius:4px; padding:4px 8px;
          font-size:12px; cursor:pointer; }
        .pc-item:hover { background:#45475a; }
        .pc-item.active { border-color:#89b4fa; }
        .pc-new-btn { background:#cba6f7; color:#1e1e2e; border:none; border-radius:4px;
          padding:4px 8px; cursor:pointer; font-size:12px; }
        .pc-editor { flex:1; display:flex; flex-direction:column; gap:8px; overflow-y:auto; }
        .pc-field { display:flex; flex-direction:column; gap:3px; }
        .pc-field label { font-size:11px; color:#a6adc8; }
        .pc-input { background:#1e1e2e; color:#cdd6f4; border:1px solid #45475a; border-radius:4px;
          padding:4px 8px; font-size:12px; font-family:monospace; }
        .pc-input:focus { outline:none; border-color:#89b4fa; }
        .pc-textarea { background:#1e1e2e; color:#cdd6f4; border:1px solid #45475a; border-radius:4px;
          padding:4px 8px; font-size:11px; font-family:monospace; resize:vertical; min-height:120px; }
        .pc-save-btn { background:#a6e3a1; color:#1e1e2e; border:none; border-radius:6px;
          padding:8px 16px; cursor:pointer; font-weight:bold; align-self:flex-start; }
        .pc-err { color:#f38ba8; font-size:11px; }
      </style>
      <div class="pc-root">
        <div class="pc-list">
          <h4>Prefabs</h4>
          <div id="pc-items"></div>
          <button class="pc-new-btn" id="pc-new">+ New</button>
        </div>
        <div class="pc-editor">
          <div class="pc-field">
            <label>Name</label>
            <input class="pc-input" id="pc-name" type="text" placeholder="prefab-name"/>
          </div>
          <div class="pc-field">
            <label>Extends (parent prefab)</label>
            <input class="pc-input" id="pc-parent" type="text" placeholder="(none)"/>
          </div>
          <div class="pc-field">
            <label>Components (JSON)</label>
            <textarea class="pc-textarea" id="pc-components"></textarea>
          </div>
          <div class="pc-field">
            <label>Tags (comma-separated)</label>
            <input class="pc-input" id="pc-tags" type="text" placeholder="tag1, tag2"/>
          </div>
          <div class="pc-err" id="pc-err"></div>
          <button class="pc-save-btn" id="pc-save">💾 Save Prefab</button>
        </div>
      </div>
    `;

    this._refreshList();
    this._loadEditing(this._editing);

    this.container.querySelector('#pc-new').addEventListener('click', () => {
      this._editing = new PrefabDef('new-prefab', {});
      this._loadEditing(this._editing);
    });

    this.container.querySelector('#pc-save').addEventListener('click', () => {
      this._saveCurrent();
    });

    this._mounted = true;
  }

  _refreshList() {
    const items = this.container.querySelector('#pc-items');
    if (!items) return;
    items.innerHTML = '';
    for (const name of this.registry.names) {
      const el = document.createElement('div');
      el.className = 'pc-item' + (name === this._editing?.name ? ' active' : '');
      el.textContent = name;
      el.addEventListener('click', () => {
        this._editing = PrefabDef.fromJSON(this.registry.get(name).toJSON());
        this._loadEditing(this._editing);
        items.querySelectorAll('.pc-item').forEach(i => i.classList.remove('active'));
        el.classList.add('active');
      });
      items.appendChild(el);
    }
  }

  _loadEditing(def) {
    const q = id => this.container.querySelector(id);
    if (!q('#pc-name')) return;
    q('#pc-name').value       = def.name;
    q('#pc-parent').value     = def.parent ?? '';
    q('#pc-components').value = JSON.stringify(def.components, null, 2);
    q('#pc-tags').value       = (def.tags ?? []).join(', ');
    q('#pc-err').textContent  = '';
  }

  _saveCurrent() {
    const q = id => this.container.querySelector(id);
    const err = q('#pc-err');
    try {
      const name       = q('#pc-name').value.trim();
      const parent     = q('#pc-parent').value.trim() || null;
      const components = JSON.parse(q('#pc-components').value || '{}');
      const tags       = q('#pc-tags').value.split(',').map(t => t.trim()).filter(Boolean);
      if (!name) throw new Error('Name is required');
      const def = new PrefabDef(name, components, parent);
      def.tags = tags;
      this.registry.register(def);
      this._editing = def;
      err.textContent = '';
      this._refreshList();
      if (this.onSave) this.onSave(def);
    } catch (e) {
      err.textContent = `Error: ${e.message}`;
    }
  }
}
