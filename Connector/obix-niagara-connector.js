module.exports = function (RED) {
  function ConnectorNode(n) {
    RED.nodes.createNode(this, n);
    this.displayName = n.displayName;
    this.useCredentialsFromSettings = n.useCredentialsFromSettings;
    this.credentialsKey = n.credentialsKey;
    this.protocol = n.protocol || 'https';
    this.host = n.host || 'localhost';
    this.port = n.port || (this.protocol == 'https' ? 443 : 80);
  }
  RED.nodes.registerType('Niagara Obix Connector', ConnectorNode, {
    credentials: {
      username: { type: 'text' },
      password: { type: 'password' },
    },
  });
};
