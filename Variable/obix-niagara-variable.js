module.exports = function(RED) {
    function VariableNode(config) {
        RED.nodes.createNode(this,config);
        // Connecting Configuration Node
        this.serverConfig = RED.nodes.getNode(config.serverConfig);
        
        this.on('input', function(msg) {

            if(this.serverConfig){
                msg.payload = {
                    displayName: this.serverConfig.displayName,
                    username: this.serverConfig.username,
                    password: this.serverConfig.password,
                    host: this.serverConfig.host,
                    port: this.serverConfig.port
                };
            }
            else{
                this.error("No Config Node Set", msg);
            }
            this.send(msg);
        });
    }
    RED.nodes.registerType("Niagara Obix Variable", VariableNode);
}