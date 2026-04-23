![](https://img.shields.io/badge/Foundry-v11--v13-informational)
![Latest Release Download Count](https://img.shields.io/github/downloads/openfantasymap/ofm-shared-world/latest/module.zip)
![Forge Installs](https://img.shields.io/badge/dynamic/json?label=Forge%20Installs&query=package.installs&suffix=%25&url=https%3A%2F%2Fforge-vtt.com%2Fapi%2Fbazaar%2Fpackage%2Fofm-shared-world&colorB=4aa94a)

# FantasyMaps Shared Worlds

_Requires [FantasyMaps Map Canvas](https://github.com/openfantasymap/ofm-map-canvas)._

See other tables' actors move across the same shared world, live. This module is a [geomqtt](https://github.com/openfantasymap/geomqtt) client for Foundry: it subscribes to the tiles covered by the active scene and renders incoming positions as lightweight canvas "ghosts" — no token creation, no DB writes, no socket chatter.

![image](https://user-images.githubusercontent.com/319800/187656240-26635b84-d731-4f94-ad36-34e12c817c03.png)
![image](https://user-images.githubusercontent.com/319800/187656253-5f8ee6e1-f394-4343-aa27-4a78c3576683.png)

## How it works

When a scene with `flags.ofm.world` + `flags.ofm.bbox` is active (scenes produced by `ofm-map-canvas`), the module:

1. Connects to the configured geomqtt broker over MQTT/WS.
2. Subscribes to `geo/<world>/+/+/+` (tile events) and `objects/+` (attribute events) per the [geomqtt protocol](https://github.com/openfantasymap/geomqtt/blob/main/PROTOCOL.md).
3. Projects each incoming `{lat, lng}` back onto the scene using its bbox and draws a sprite on a dedicated overlay `PIXI.Container` above the canvas.
4. Keyed by the geomqtt `id`: `snapshot`/`add`/`move` upsert the sprite, `remove`/`delete` destroy it.
5. Echoes of this table's own publishes (messages where `attrs.client === LICENSE`) are filtered out.

## Interactive ghosts

A ghost is plain visual by default. If its payload carries `attrs.interactive === true` the sprite becomes pointer-enabled and fires a hook on click:

```js
Hooks.on("ofmSharedWorldGhostClick", (payload, pixiEvent) => {
    // payload = { id, attrs, world, scene, lat, lng }
    console.log("clicked ghost", payload.id, payload.attrs);
});
```

Or from a sibling module using the exposed API:

```js
const api = game.modules.get("ofm-shared-world").api;
api.onGhostClick(({ id, attrs }) => { /* ... */ });
```

The container itself uses `eventMode: "passive"` so normal Foundry token interaction is untouched; only ghosts that opt in capture pointer events.

## Settings

| Setting | Purpose |
| --- | --- |
| License Key | Identifies this table on the geomqtt channel; also the self-echo filter key |
| geomqtt WebSocket URL | MQTT-over-WS endpoint of the geomqtt broker (default `wss://mqtt.fantasymaps.org:9001`) |

## API

`game.modules.get("ofm-shared-world").api`:

| Member | |
| --- | --- |
| `GhostLayer` | Class — reusable overlay layer |
| `ghostLayer` | Live instance attached to the current scene |
| `onGhostClick(fn)` | Register a click handler; returns an unregister function |
| `sharedWorld` | The orchestrator instance |

## Compatibility

- Foundry **v11 – v13** (verified on v13).
- Reads `flags.ofm.{world,bbox,renderArgs}` with a fallback to the legacy flat `flags.ofmWorld`/`flags.ofmBbox` — scenes from older versions of `ofm-map-canvas` still work.
- PIXI v7 (Foundry v11/v12) and v8 (Foundry v13) both supported.
