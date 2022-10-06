module.exports = function (RED) {
  function ConnectorNode(n) {
    RED.nodes.createNode(this, n);
    this.displayName = n.displayName;
    this.username = n.username;
    this.password = n.password;
    this.mode = n.mode || 'https';
    this.host = n.host || 'localhost';
    this.port = n.port || (this.mode == 'https' ? 443 : 80);
  }
  RED.nodes.registerType('Niagara Obix Connector', ConnectorNode);
};
