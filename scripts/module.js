

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
            if (moved.x >0 || moved.y > 0){
                ChatMessage.create({content: "They see me walkin', they hatin'"});
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

        await game.settings.register('ofm-shared-world', 'WORLD_TO_LOAD', {
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