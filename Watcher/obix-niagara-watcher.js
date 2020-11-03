module.exports = function(RED) {

    function WatcherNode(config) {
        RED.nodes.createNode(this,config);
        const node = this;
        // Connecting Configuration Node
        node.serverConfig = RED.nodes.getNode(config.serverConfig);

        async function makeWatch () {
            
        }

        msg = {
            "payload": config.rules
        };

        var timer = setInterval(function(){ node.send(msg) }, config.pollRate * 1000);


        this.on('close', function(removed, done) {
            if (removed) {
                // This node has been disabled/deleted
            } else {
                // This node is being restarted
            }
            clearInterval(timer);
            done();
        });
    }

    RED.nodes.registerType("Niagara Obix Watcher", WatcherNode);
}