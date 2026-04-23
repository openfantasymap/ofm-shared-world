const DEFAULT_ICON_SIZE = 40;
const DEFAULT_LABEL_STYLE = {
    fill: 0xffffff,
    fontSize: 14,
    fontFamily: "Signika, sans-serif",
    stroke: 0x000000,
    strokeThickness: 3,
    align: "center"
};

// PIXI v7 accepts `(text, style)`; v8 accepts `{text, style}`. Detect once.
function makePixiText(text, style) {
    try {
        return new PIXI.Text({ text, style });
    } catch (_) {
        return new PIXI.Text(text, style);
    }
}

function project(lat, lng, bbox, scene) {
    const [w, s, e, n] = bbox;
    const px = (lng - w) / (e - w);
    const py = (lat - s) / (n - s);
    return {
        x: px * scene.width,
        y: scene.height - py * scene.height
    };
}

export class GhostLayer {
    constructor() {
        this.container = null;
        this.ghosts = new Map();
        this.scene = null;
        this.bbox = null;
        this.world = null;
        this.clickHandlers = new Set();
    }

    attach(scene, flags) {
        this.detach();
        if (!flags?.world || !flags?.bbox) return false;
        this.scene = scene;
        this.world = flags.world;
        this.bbox = flags.bbox;

        this.container = new PIXI.Container();
        this.container.name = "ofm-shared-world-ghosts";
        this.container.eventMode = "passive";
        this.container.sortableChildren = true;
        this.container.zIndex = 900;

        canvas.stage.addChild(this.container);
        return true;
    }

    detach() {
        if (this.container) {
            try { this.container.parent?.removeChild(this.container); } catch (_) {}
            try { this.container.destroy({ children: true }); } catch (_) {}
        }
        this.container = null;
        this.ghosts.clear();
        this.scene = null;
        this.world = null;
        this.bbox = null;
    }

    onClick(fn) {
        this.clickHandlers.add(fn);
        return () => this.clickHandlers.delete(fn);
    }

    _emitClick(payload, event) {
        for (const fn of this.clickHandlers) {
            try { fn(payload, event); } catch (err) { console.error("ofm-shared-world | ghost click handler", err); }
        }
        Hooks.callAll("ofmSharedWorldGhostClick", payload, event);
    }

    upsert(id, lat, lng, attrs = {}) {
        if (!this.container) return;
        const { x, y } = project(lat, lng, this.bbox, this.scene);

        let g = this.ghosts.get(id);
        if (!g) {
            g = this._createGhost(id, attrs);
            if (!g) return;
            this.ghosts.set(id, g);
            this.container.addChild(g.sprite);
            if (g.label) this.container.addChild(g.label);
        } else {
            g.attrs = { ...g.attrs, ...attrs };
            this._applyInteractivity(g, id);
            if (attrs.name && g.label) {
                try { g.label.text = attrs.name; } catch (_) {}
            }
        }

        g.sprite.position.set(x, y);
        if (g.label) g.label.position.set(x, y - (DEFAULT_ICON_SIZE / 2) - 4);
        g.lastLatLng = { lat, lng };
    }

    remove(id) {
        const g = this.ghosts.get(id);
        if (!g) return;
        try { g.sprite.destroy(); } catch (_) {}
        try { g.label?.destroy(); } catch (_) {}
        this.ghosts.delete(id);
    }

    _createGhost(id, attrs) {
        let sprite;
        const textureUrl = attrs.texture?.src ?? attrs.texture ?? attrs.icon ?? null;
        try {
            sprite = textureUrl
                ? PIXI.Sprite.from(textureUrl)
                : new PIXI.Sprite(PIXI.Texture.WHITE);
        } catch (_) {
            sprite = new PIXI.Sprite(PIXI.Texture.WHITE);
        }
        sprite.anchor.set(0.5, 0.5);
        sprite.width = attrs.size ?? DEFAULT_ICON_SIZE;
        sprite.height = attrs.size ?? DEFAULT_ICON_SIZE;
        sprite.alpha = attrs.alpha ?? 0.85;
        sprite.zIndex = 10;

        let label = null;
        if (attrs.name) {
            label = makePixiText(String(attrs.name), DEFAULT_LABEL_STYLE);
            label.anchor.set(0.5, 1);
            label.zIndex = 11;
        }

        const g = { sprite, label, attrs };
        this._applyInteractivity(g, id);
        return g;
    }

    _applyInteractivity(g, id) {
        const interactive = Boolean(g.attrs?.interactive);
        if (interactive) {
            g.sprite.eventMode = "static";
            g.sprite.cursor = "pointer";
            if (!g.sprite._ofmClickBound) {
                g.sprite.on("pointerdown", (event) => {
                    this._emitClick({
                        id,
                        attrs: g.attrs,
                        world: this.world,
                        scene: this.scene,
                        lat: g.lastLatLng?.lat,
                        lng: g.lastLatLng?.lng
                    }, event);
                });
                g.sprite._ofmClickBound = true;
            }
        } else {
            g.sprite.eventMode = "none";
            g.sprite.cursor = "default";
        }
    }
}
