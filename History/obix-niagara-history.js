module.exports = function (RED) {
  const { ObixInstance } = require('obix-js');

  function HistoryNode(config) {
    RED.nodes.createNode(this, config);
    const node = this;

    node.serverConfig = RED.nodes.getNode(config.serverConfig);

    node.on('input', async function (msg, send, done) {
      // prettier-ignore
      send = send || function() { node.send.apply(node, arguments) }
      try {
        const settingCredentials = RED.settings.niagaraObix?.[msg.credentialsKey || node.serverConfig.credentialsKey];
        const { username, password } =
          (msg.credentialsKey || node.serverConfig.useCredentialsFromSettings ? settingCredentials : node.serverConfig.credentials) || {};
        const axiosConfig = {
          protocol: msg.protocol || node.serverConfig.protocol,
          host: msg.host || node.serverConfig.host,
          port: msg.port || node.serverConfig.port,
          username: msg.username || username,
          password: msg.password || password,
        };
        const obix = new ObixInstance(axiosConfig);

        node.status({ fill: 'blue', shape: 'ring', text: 'Pulling...' });

        const defaultQuery = config.queryType == 'presetQuery' ? config.presetQuery : config.historyQuery;
        const result = await obix.history({ path: msg.path || config.path, query: msg.historyQuery || msg.presetQuery || defaultQuery });

        const topic = msg.topic || config.topic;
        topic ? (msg.topic = topic) : null;
        msg.payload = result;

        send(msg);
        node.status({});
        done && done();
      } catch (error) {
        node.status({ fill: 'red', shape: 'dot', text: error.friendlyError || 'Error' });
        if (done) done(error.inDepthError || error);
        else node.error(error.inDepthError || error, msg);
      }
    });
  }
  RED.nodes.registerType('Niagara Obix History', HistoryNode);

  RED.httpAdmin.post('/obixhistory/:id', RED.auth.needsPermission('obixhistory.write'), function (req, res) {
    var node = RED.nodes.getNode(req.params.id);
    if (node != null) {
      try {
        node.receive();
        res.sendStatus(200);
      } catch (err) {
        res.sendStatus(500);
        node.error(RED._('inject.failed', { error: err.toString() }));
      }
    } else {
      res.sendStatus(404);
    }
  });
};
