class InvalidActionError extends Error {
  constructor() {
    super(`Invalid Action : allowed action include "read", "write", or "batch"`);
    this.name = 'InvalidActionError';
    this.friendlyError = 'Invalid Action';
    this.inDepthError = this.message;
  }
}

module.exports = function (RED) {
  const { ObixInstance } = require('obix-js');

  function VariableNode(config) {
    RED.nodes.createNode(this, config);
    const node = this;

    node.serverConfig = RED.nodes.getNode(config.serverConfig);

    node.on('input', async function (msg, send, done) {
      // prettier-ignore
      send = send || function() { node.send.apply(node, arguments) }
      try {
        let result, shouldWarnBatch, warningMessage;

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
        const action = msg.action || config.action;
        switch (action) {
          case 'read':
            result = await obix.read({ path: msg.path || config.path });
            break;
          case 'write':
            result = await obix.write({ path: msg.path || config.path, value: msg.value || config.value });
            break;
          case 'batch': {
            const batch = msg.batch || config.batch || null;
            result = await obix.batch({ batch: typeof batch == 'string' ? JSON.parse(batch) : batch });
            warningMessage = 'Batch contains an error';
            shouldWarnBatch = result.find((r) => r.error);
            shouldWarnBatch && node.warn(warningMessage);
            break;
          }
          case 'rawGet':
            result = await obix.get({ path: msg.path || config.path });
            break;
          case 'rawPost':
            result = await obix.post({ path: msg.path || config.path, payload: msg.xmlPayload || config.xmlPayload });
            break;
          default:
            throw new InvalidActionError();
        }

        const topic = msg.topic || config.topic;
        topic ? (msg.topic = topic) : null;
        msg.payload = result;

        send(msg);
        shouldWarnBatch ? node.status({ fill: 'yellow', shape: 'ring', text: warningMessage }) : node.status({});
        done && done();
      } catch (error) {
        node.status({ fill: 'red', shape: 'dot', text: error.friendlyError || 'Error' });
        if (done) done(error.inDepthError || error);
        else node.error(error.inDepthError || error, msg);
      }
    });
  }

  RED.nodes.registerType('Niagara Obix Variable', VariableNode);

  RED.httpAdmin.post('/obixvariable/:id', RED.auth.needsPermission('obixvariable.write'), function (req, res) {
    const node = RED.nodes.getNode(req.params.id);
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
