module.exports = function(RED) {
    function ConnectorNode(n) {
        RED.nodes.createNode(this,n);
        this.displayName = n.displayName;
        this.username = n.username;
        this.password = n.password;
        this.host = n.host;
        this.port = n.port;
    }
    RED.nodes.registerType("Niagara Obix Connector", ConnectorNode);
}