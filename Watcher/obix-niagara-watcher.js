module.exports = function (RED) {
  const { ObixInstance } = require('obix-js');

  function WatcherNode(config) {
    RED.nodes.createNode(this, config);
    const node = this;

    node.serverConfig = RED.nodes.getNode(config.serverConfig);

    //#region Helpers
    const handleError = async (error, msg, done) => {
      node.status({ fill: 'red', shape: 'dot', text: error.friendlyError || 'Error' });
      await cleanup();
      if (done) done(error.inDepthError || error);
      else node.error(error.inDepthError || error, msg);
    };

    const cleanup = async () => {
      try {
        await node.watcher?.delete();
        // eslint-disable-next-line no-empty
      } catch (error) {}
      clearInterval(node.watchInterval);
      delete node.watcher;
      node.loading = false;
    };

    const findWarningResult = (results) => {
      const shouldWarn = results.find((r) => r.error);
      if (shouldWarn) {
        node.status({ fill: 'yellow', shape: 'ring', text: `Watch Warning: ${node.watcher.name}` });
        node.warn('Error found in watcher request');
      } else {
        node.status({ fill: 'blue', shape: 'dot', text: `Watch Polled: ${node.watcher.name}` });
      }
    };
    //#endregion Helpers

    node.on('input', async function (msg, send, done) {
      // prettier-ignore
      send = send || function() { node.send.apply(node, arguments) }
      try {
        const pollChangesOnly = msg.pollChangesOnly == false ? false : msg.pollChangesOnly || config.pollChangesOnly;
        const topic = msg.topic || config.topic;
        const pollRate = Number(msg.pollRate || config.pollRate) * 1000;
        let paths = msg.paths || config.paths || null;
        paths = typeof paths == 'string' ? JSON.parse(paths) : paths;
        const { pollRefresh, pollChanges, pollStop } = msg;

        if (pollRate < 5000) {
          node.status({ fill: 'yellow', shape: 'ring', text: `pollRate must be 5 or greater` });
          node.warn(`pollRate must be 5 or greater`);
          done && done();
          return;
        }

        if (pollRefresh || pollChanges || pollStop) {
          if (!node.watcher) {
            node.status({ fill: 'yellow', shape: 'ring', text: `No watcher has been created` });
            node.warn(`No watcher has been created`);
            done && done();
            return;
          }
          if (pollRefresh || pollChanges) {
            const results = pollRefresh ? await node.watcher.pollRefresh() : await node.watcher.pollChanges();
            findWarningResult(results);
            topic ? (msg.topic = topic) : null;
            msg.payload = results;
            send(msg);
          }
          if (pollStop) {
            node.status({ fill: 'blue', shape: 'ring', text: `Watch Stopped: ${node.watcher.name}` });
            await cleanup();
          }
          done && done();
          return;
        }

        // Prevent spamming of inject
        if (node.loading) {
          done && done();
          return;
        }
        node.loading = true;
        node.status({ fill: 'blue', shape: 'dot', text: 'Creating Watch' });

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

        clearInterval(node.watchInterval);
        try {
          await node.watcher?.delete();
          // eslint-disable-next-line no-empty
        } catch (error) {}

        node.watcher = await obix.watcherCreate();
        node.status({ fill: 'green', shape: 'dot', text: `Watch Created: ${node.watcher.name}` });
        const results = (await Promise.all([node.watcher.lease({ leaseTime: pollRate * 2 }), node.watcher.add({ paths })]))[1];

        node.watchInterval = setInterval(async () => {
          try {
            const results = pollChangesOnly ? await node.watcher.pollChanges() : await node.watcher.pollRefresh();
            findWarningResult(results);
            const msg = { payload: results };
            topic ? (msg.topic = topic) : null;
            send(msg);
          } catch (error) {
            handleError(error, msg);
          }
        }, pollRate);

        topic ? (msg.topic = topic) : null;
        msg.payload = results;
        findWarningResult(results);
        node.loading = false;
        send(msg);
        done && done();
      } catch (error) {
        handleError(error, msg, done);
      }
    });

    node.on('close', async function (removed, done) {
      node.status({});
      await cleanup();
      done && done();
    });
  }

  RED.nodes.registerType('Niagara Obix Watcher', WatcherNode);

  RED.httpAdmin.post('/obixwatcher/:id', RED.auth.needsPermission('obixwatcher.write'), function (req, res) {
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
