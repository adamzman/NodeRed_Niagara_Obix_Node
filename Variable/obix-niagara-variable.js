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
        let result, shouldWarn, warnReason;
        const axiosConfig = {
          mode: msg.protocol || node.serverConfig.mode,
          host: msg.host || node.serverConfig.host,
          port: msg.port || node.serverConfig.port,
          username: msg.username || node.serverConfig.username,
          password: msg.password || node.serverConfig.password,
        };
        const obix = new ObixInstance(axiosConfig);
        node.status({ fill: 'blue', shape: 'ring', text: 'Pulling...' });
        const action = msg.action || config.action;
        switch (action) {
          case 'read':
            result = await obix.obixRead({ path: msg.path || config.path });
            break;
          case 'write':
            result = await obix.obixWrite({ path: msg.path || config.path, value: msg.value || config.value });
            break;
          case 'batch':
            result = await obix.obixBatch({ batch: JSON.parse(msg.batch || msg.path || config.batch || null) });
            shouldWarn = result.find((r) => r.error);
            warnReason = 'Batch contains an error';
            break;
          default:
            throw new InvalidActionError();
        }

        const topic = msg.topic || config.topic;
        topic ? (msg.topic = topic) : null;
        msg.payload = result;

        send(msg);
        shouldWarn ? node.status({ fill: 'yellow', shape: 'ring', text: warnReason }) : node.status({});
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
