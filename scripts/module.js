

class SharedWorld extends Application{
    socket = null;
    constructor(object, options){
        super(object, options);
        Hooks.once('init', async () => {
            SharedWorld.registerSettings(options).then(() => console.log("SharedWorld Settings Registered."));
        });
        
        Hooks.once('ready', async () => {
            //this.socket = new WebSocket("ws://javascript.info");
            //this.socket.onopen = function(e) {
            //  alert("[open] Connection established");
            //  alert("Sending to server");
            //  this.socket.send("My name is John");
            //};
        });

        //this.socket.onmessage = function(event) {
        //    alert(`[message] Data received from server: ${event.data}`);
        //};
          
        Hooks.on('updateToken',(scene,data,moved)=>{
            if (data.x || data.y){
                var activeScene = game.scenes.filter(s=>s.active)[0];
                var ofmBbox = activeScene.flags.ofmBbox;
                var px = scene.x / activeScene.width;
                var py = (activeScene.height-scene.y) / activeScene.height;
                var cx = ofmBbox[0]+(ofmBbox[2]-ofmBbox[0])*px;
                var cy = ofmBbox[1]+(ofmBbox[3]-ofmBbox[1])*py;
                $.post("http://51.15.160.236:9999/api/move", {
                    movement: JSON.stringify({
                        actor: {name: scene.name, id: scene.actorId, texture: scene.texture},
                        x: cx,
                        y: cy,
                        ofm: activeScene.flags
                    })
                }, ()=>{
                    console.log('token', scene.actorId, 'moved', scene.x, scene.y, cx, cy);
                }, 'json')
                //this.socket.send(JSON.stringify({msg: 'move', instance: '', }))
            }
        }); 
    }
    
    static async registerSettings(options) {       
        await game.settings.register('ofm-map-canvas', 'LICENSE', {
            name: 'License Key',
            hint: 'Go to Fantasymaps.org or [patreon] to get a license key for the special features.',
            scope: 'world',
            config: true,
            type: String,
            default: null,
            filePicker: false,
        });

        await game.settings.register('ofm-map-canvas', 'WORLD_TO_LOAD', {
            name: 'FantasyMaps shared-world to play on',
            hint: 'FantasyMaps shared-world to play on',
            scope: 'world',
            config: true,
            default: 'toril',
            choices: {
                toril: "Toril",
                barovia: "Barovia",
                tl2k: "Twilight2000",
            },
            type: String
        });
    }
}

const sharedWorld = new SharedWorld();