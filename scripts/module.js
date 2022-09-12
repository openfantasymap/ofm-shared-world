import './lib/mqtt.min.js';

class SharedWorld extends Application{
    constructor(object, options){
        super(object, options);
        this.client = null;
        Hooks.once('init', async () => {
            SharedWorld.registerSettings(options).then(() => console.log("SharedWorld Settings Registered."));
            
        });
        
        Hooks.once('ready', async () => {
            this.client = mqtt.connect("wss://mqtt.fantasymaps.org:9001");
            const LICENSE = game.settings.get("ofm-shared-world", "LICENSE");
            if (LICENSE){
                this.client.subscribe('ofm/clients/op');
                this.client.publish("ofm/ops/"+LICENSE, JSON.stringify({"action": "channel_create", "client": LICENSE}));
                this.client.subscribe("ofm/ops/"+LICENSE);
                this.client.on("message", (topic, payload) => {
                    const pl = JSON.parse(payload);
                    if (topic === "ofm/ops/"+LICENSE){
                        this.doOperation(pl);
                    }
                })
                this.client.publish("ofm/clients/op", JSON.stringify({"action": "join", "client": LICENSE}));
            }
        });

        Hooks.on('updateScene', (scene, conf, arg, id) => {
            console.log(scene, conf, arg, id);
            const LICENSE = game.settings.get("ofm-shared-world", "LICENSE");
            this.client.publish("ofm/view", JSON.stringify({"world": scene.flags.ofmWorld, "bbox": scene.flags.ofmBbox, "client": LICENSE}));
            this.client.publish("ofm/view/"+LICENSE, JSON.stringify({"world": scene.flags.ofmWorld, "bbox": scene.flags.ofmBbox, "client": LICENSE}));
            
        });

        Hooks.on('createToken', (scene, data, id) => {
            console.log(scene, data, id);
            const LICENSE = game.settings.get("ofm-shared-world", "LICENSE");
            this.client.publish("ofm/view/"+LICENSE, JSON.stringify({"bbox": scene.flags.ofmBbox}));
        });
        
        Hooks.on('deleteToken', (scene, data, id) => {
            console.log(scene, data, id);
            const LICENSE = game.settings.get("ofm-shared-world", "LICENSE");
            this.client.publish("ofm/view/"+LICENSE, JSON.stringify({"bbox": scene.flags.ofmBbox}));
        });
          
        Hooks.on('updateToken',(scene,data,moved)=>{
            if (data.x || data.y){
                const LICENSE = game.settings.get("ofm-shared-world", "LICENSE");
                var activeScene = game.scenes.filter(s=>s.active)[0];
                var ofmBbox = activeScene.flags.ofmBbox;
                var ofmWorld = activeScene.flags.ofmWorld;
                var px = scene.x / activeScene.width;
                var py = (activeScene.height-scene.y) / activeScene.height;
                var cx = ofmBbox[0]+(ofmBbox[2]-ofmBbox[0])*px;
                var cy = ofmBbox[1]+(ofmBbox[3]-ofmBbox[1])*py;
                this.client.publish("ofm/"+ofmWorld+"/actors/"+scene.actorId, JSON.stringify({
                    client: LICENSE,
                    actor: {name: scene.name, id: scene.actorId, texture: scene.texture},
                    x: cx,
                    y: cy,
                    ofm: activeScene.flags
                }));
                this.client.publish("ofm/"+ofmWorld+"/ops", JSON.stringify({
                    type: "Movement",
                    client: LICENSE,
                    actor: scene.actorId,
                    scene: scene.parent.id,
                    x: cx,
                    y: cy,
                    ofm: activeScene.flags
                }))
            }
        }); 

        Hooks.on('ofmSharedWorldChange', (data) => {
            const LICENSE = game.settings.get("ofm-shared-world", "LICENSE");
            const ofmWorld = data.scene.flags.ofmWorld;
            this.client.publish("ofm/"+ofmWorld+"/ops", JSON.stringify({
                type: "World",
                client: LICENSE,
                event: data.event,
                ofm: data.scene.flags
            }))

            var activeScene = game.scenes.filter(s=>s.active)[0];
            var args = activeScene.flags.renderArgs;

            this.client.publish("ofm/ops/"+LICENSE, JSON.stringify({"type": "World", "client": LICENSE, args: args}));

        })
    }

    static async registerSettings(options) {       
        await game.settings.register('ofm-shared-world', 'LICENSE', {
            name: 'License Key',
            hint: 'Go to Fantasymaps.org or [patreon] to get a license key for the special features.',
            scope: 'world',
            config: true,
            type: String,
            default: null,
            filePicker: false,
        });
    }

    async doOperation(payload){
        if(payload.type==="World"){
            Hooks.call('ofmSharedWorldUpdateScene', payload.args);
        } else 
        if(payload.type==="Movement"){
            console.log(payload);
        }
    }
}

const sharedWorld = new SharedWorld();