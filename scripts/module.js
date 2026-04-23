import './lib/mqtt.min.js';
import { GhostLayer } from './ghost-layer.js';

const MODULE_ID = "ofm-shared-world";
const DEFAULT_BROKER_URL = "wss://mqtt.fantasymaps.org:9001";

function ofmFlags(scene) {
    const f = scene?.flags ?? {};
    const n = f.ofm ?? {};
    return {
        world: n.world ?? f.ofmWorld ?? null,
        bbox: n.bbox ?? f.ofmBbox ?? null,
        license: n.license ?? f.ofmLicense ?? null,
        renderArgs: n.renderArgs ?? f.renderArgs ?? null
    };
}

function getSetting(key) {
    return game.settings.get(MODULE_ID, key);
}

class SharedWorld {
    constructor() {
        this.client = null;
        this.license = null;
        this.subscriptions = new Set();
        this.ghostLayer = new GhostLayer();

        Hooks.once('init', () => SharedWorld.registerSettings());
        Hooks.once('ready', () => this.onReady());

        Hooks.on('canvasReady', () => this.onCanvasReady());
        Hooks.on('canvasTearDown', () => this.ghostLayer.detach());
    }

    static async registerSettings() {
        game.settings.register(MODULE_ID, 'LICENSE', {
            name: 'License Key',
            hint: 'Key used as the client identifier on the geomqtt channel.',
            scope: 'world',
            config: true,
            type: String,
            default: ""
        });

        game.settings.register(MODULE_ID, 'BROKER_URL', {
            name: 'geomqtt WebSocket URL',
            hint: 'MQTT-over-WebSocket endpoint of the geomqtt broker.',
            scope: 'world',
            config: true,
            type: String,
            default: DEFAULT_BROKER_URL
        });
    }

    onReady() {
        this.license = getSetting("LICENSE") || null;
        const url = getSetting("BROKER_URL") || DEFAULT_BROKER_URL;
        if (!this.license) {
            console.log(`${MODULE_ID} | no license set — geomqtt link disabled`);
            return;
        }

        try {
            this.client = mqtt.connect(url, { clientId: `ofm-${this.license}-${Date.now()}` });
        } catch (err) {
            console.error(`${MODULE_ID} | MQTT connect failed`, err);
            return;
        }

        this.client.on("connect", () => {
            console.log(`${MODULE_ID} | connected to ${url}`);
            this.onCanvasReady();
        });
        this.client.on("message", (topic, payload) => this.onMqttMessage(topic, payload));
        this.client.on("error", (err) => console.error(`${MODULE_ID} | MQTT`, err));
        this.client.on("close", () => console.log(`${MODULE_ID} | MQTT closed`));

        // expose public API for sibling OFM modules
        const mod = game.modules.get(MODULE_ID);
        if (mod) {
            mod.api = {
                GhostLayer,
                ghostLayer: this.ghostLayer,
                onGhostClick: (fn) => this.ghostLayer.onClick(fn),
                sharedWorld: this
            };
        }
    }

    onCanvasReady() {
        this.ghostLayer.detach();
        this._unsubscribeAll();

        const scene = canvas?.scene;
        if (!scene) return;
        const flags = ofmFlags(scene);
        if (!flags.world || !flags.bbox) return;

        this.ghostLayer.attach(scene, flags);
        this._subscribeWorld(flags.world);
    }

    _subscribeWorld(world) {
        if (!this.client?.connected) return;
        const tileTopic = `geo/${world}/+/+/+`;
        const objectTopic = `objects/+`;
        this._subscribe(tileTopic);
        this._subscribe(objectTopic);
    }

    _subscribe(topic) {
        if (this.subscriptions.has(topic)) return;
        this.client.subscribe(topic, (err) => {
            if (err) console.error(`${MODULE_ID} | subscribe ${topic}`, err);
        });
        this.subscriptions.add(topic);
    }

    _unsubscribeAll() {
        if (!this.client?.connected) {
            this.subscriptions.clear();
            return;
        }
        for (const topic of this.subscriptions) {
            try { this.client.unsubscribe(topic); } catch (_) {}
        }
        this.subscriptions.clear();
    }

    onMqttMessage(topic, payload) {
        let msg;
        try { msg = JSON.parse(payload.toString()); }
        catch (_) { return; }

        if (topic.startsWith("geo/")) {
            this._handleGeoEvent(topic, msg);
        } else if (topic.startsWith("objects/")) {
            this._handleObjectEvent(topic, msg);
        }
    }

    // geo/<world>/<z>/<x>/<y> — {op, id, lat, lng, attrs?, ts}
    _handleGeoEvent(topic, msg) {
        if (!msg || !msg.op || !msg.id) return;
        // drop echoes of our own publishes
        if (msg.attrs?.client && msg.attrs.client === this.license) return;

        switch (msg.op) {
            case "snapshot":
            case "add":
            case "move":
                if (typeof msg.lat === "number" && typeof msg.lng === "number") {
                    this.ghostLayer.upsert(msg.id, msg.lat, msg.lng, msg.attrs ?? {});
                }
                break;
            case "remove":
                this.ghostLayer.remove(msg.id);
                break;
            case "attr":
                // tile-side attr updates (forward-compat with v0.2)
                if (msg.attrs) {
                    const g = this.ghostLayer.ghosts.get(msg.id);
                    if (g) this.ghostLayer.upsert(msg.id, g.lastLatLng.lat, g.lastLatLng.lng, msg.attrs);
                }
                break;
        }
    }

    // objects/<obid> — {op, id, attrs?, ts}
    _handleObjectEvent(topic, msg) {
        if (!msg || !msg.id) return;
        if (msg.op === "delete") {
            this.ghostLayer.remove(msg.id);
            return;
        }
        const g = this.ghostLayer.ghosts.get(msg.id);
        if (!g || !msg.attrs) return;
        // apply attr changes without moving
        g.attrs = { ...g.attrs, ...msg.attrs };
        this.ghostLayer._applyInteractivity(g, msg.id);
        if (msg.attrs.name && g.label) {
            try { g.label.text = String(msg.attrs.name); } catch (_) {}
        }
    }
}

new SharedWorld();
