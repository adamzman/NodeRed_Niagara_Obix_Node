module.exports = function (RED) {
  function VariableNode(config) {
    RED.nodes.createNode(this, config);
    const node = this;

    node.serverConfig = RED.nodes.getNode(config.serverConfig);

    node.on('input', async function (msg, send, done) {
      // Compatibility with older Node Red versions
      // prettier-ignore
      send = send || function() { node.send.apply(node, arguments) }
      try {
        let response, result;
        const axiosConfig = {
          mode: msg.protocol || node.serverConfig.mode,
          host: msg.host || node.serverConfig.host,
          port: msg.port || node.serverConfig.port,
          username: msg.username || node.serverConfig.username,
          password: msg.password || node.serverConfig.password,
        };

        if (axiosConfig.mode != 'https' && axiosConfig.mode != 'http') throw new ProtocolError();

        // Set up Axios Instance
        const instance = createInstance(axiosConfig);
        node.status({ fill: 'blue', shape: 'ring', text: 'Pulling...' });

        const action = msg.action || config.action;
        const path = (msg.path || config.path)?.replaceAll(/^\/|\/$/g, ''); // Slice '/' from the path if it exists

        switch (action) {
          case 'read': {
            response = await instance.get(path + '/out/');
            result = { path, value: parseValue(response.data), action: 'read' };
            break;
          }
          case 'write': {
            response = await instance.post(path + '/set/', `<real val="${msg.value || config.value}"/>`);
            result = { path, value: parseValue(response.data), action: 'write' };
            break;
          }
          case 'batch': {
            let paths = msg.paths || config.batchJson;
            try {
              paths = JSON.parse(paths);
              // eslint-disable-next-line no-empty
            } catch (e) {}
            if (!Array.isArray(paths)) throw new BatchInvalidFormatError();

            let body = '<list is="obix:BatchIn">';
            paths.forEach((p) => {
              const { is, val } = p.action == 'write' || (!p.action && p.value) ? { is: 'Invoke', val: 'set' } : { is: 'Read', val: 'out' };
              const vPath = p.path?.replaceAll(/^\/|\/$/g, ''); // Slice '/' from the path if it exists
              body += `<uri is="obix:${is}" val="${getObixBaseUri(axiosConfig)}/config/${vPath}/${val}"><real name="in" val="${p.value}" /></uri>`;
            });
            body += '</list>';
            response = await instance.post(`${getObixBaseUri(axiosConfig)}/batch`, body);
            result = { ...batchParse(response.data.list), action: 'batch' };
            break;
          }
          default:
            throw new InvalidActionError();
        }

        const topic = msg.topic || config.topic;
        topic ? (msg.topic = topic) : null;
        msg.payload = result;

        send(msg);
        result.containsError ? node.status({ fill: 'yellow', shape: 'ring', text: 'Batch contains an error' }) : node.status({});
        done && done();
      } catch (error) {
        // eslint-disable-next-line no-ex-assign
        if (!(error instanceof NodeRedError)) error = new NodeRedError({ inDepthError: error });
        error.throwNodeRedError({ node, done, msg });
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
