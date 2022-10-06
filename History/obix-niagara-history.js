module.exports = function (RED) {
  const axios = require('axios');
  const convert = require('xml-js');
  const https = require('https');
  const moment = require('moment-timezone');

  function handleErrors(error, node, msg) {
    // Formatting Errors
    // If cannot connect to server
    if (error.code == 'ECONNABORTED') {
      var friendlyError = 'Connection Error - Timeout';
      var inDepthError =
        'Error ECONNABORTED- Connection to server could not be established:\n' +
        '\n1. Check the configured IP Address and Port' +
        '\n2. Ensure http/https is enabled in the WebServices in Niagara';
    }
    // If invalid credentials
    else if (error.message == 'Request failed with status code 401') {
      var friendlyError = 'Invalid Username/Password - 401';
      var inDepthError =
        'Error 401 - Invalid Credentials:\n' +
        '\n1. Ensure the Username / Password is correct' +
        '\n2. Ensure the Obix user account has HTTPBasicScheme authentication (Check Documentation in Github for more details)';
    }
    // If permission error
    else if (error.message == 'Request failed with status code 403') {
      var friendlyError = 'Permission Error - 403';
      var inDepthError = 'Error 403 - Permission Error:\n' + '\n1. Ensure the obix user has the admin role assigned / admin privileges';
    }
    // If obix driver missing
    else if (error.message == 'Request failed with status code 404') {
      var friendlyError = 'Obix Driver Missing - 404';
      var inDepthError =
        'Error 404 - Obix Driver most likely missing:\n' +
        '\n1. Ensure the obix driver is placed directly under the Drivers in the Niagara tree (Check Documentation in Github for more details)';
    }
    // If invalid Path
    else if (String(error).includes('Invalid Path:')) {
      node.status({ fill: 'yellow', shape: 'dot', text: 'invalid history path' });
      node.error({ invalidPath: error.split(':').pop() }, msg);
      return;
    }
    // If PresetQuery Value Invalid
    else if (error == 'PresetQuery Value Invalid') {
      var friendlyError = 'PresetQuery Value Invalid';
      var inDepthError =
        'PresetQuery Value Invalid:\n' +
        '\nmsg.presetQuery must be one of the following\n' +
        '\n"yesterday"' +
        '\n"last24Hours"' +
        '\n"weekToDate"' +
        '\n"lastWeek"' +
        '\n"last7Days"' +
        '\n"monthToDate"' +
        '\n"lastMonth"' +
        '\n"yearToDate (limit=1000)"' +
        '\n"lastYear (limit=1000)"' +
        '\n"unboundedQuery"';
    }
    // If invalid https/http
    else if (error == 'Invalid Security Protocol') {
      var friendlyError = 'Invalid Security Protocol';
      var inDepthError = 'Invalid Security Protocol:\n' + '\nmsg.protocol must be either "https" or "http"';
    }
    // Possibly Wrong Port
    else if (String(error.message).includes('wrong version number')) {
      var friendlyError = 'Possibly Wrong Port/Protocol';
      var inDepthError = 'Check the port and security protocol';
    }
    // Start Invalid Timestamp
    else if (error == 'HistoryQuery Start Invalid Timestamp') {
      var friendlyError = 'historyQuery.start invalid timestamp';
      var inDepthError = 'HistoryQuery Start Invalid Timestamp: Make a valid timestamp';
    }
    // End Invalid Timestamp
    else if (error == 'HistoryQuery End Invalid Timestamp') {
      var friendlyError = 'historyQuery.end invalid timestamp';
      var inDepthError = 'HistoryQuery End Invalid Timestamp: Make a valid timestamp';
    }
    // Limit Invalid
    else if (error == 'HistoryQuery Limit Invalid') {
      var friendlyError = 'historyQuery.limit invalid';
      var inDepthError = 'HistoryQuery Limit Invalid: Make a valid integer';
    } else {
      var friendlyError = 'Unknown Error';
      var inDepthError = error;
    }

    // Set Node Error Information
    node.status({ fill: 'red', shape: 'dot', text: friendlyError });
    node.error(inDepthError, msg);
  }

  function parseData(node, msg, data, path) {
    try {
      var values = [];
      var timezone = data.abstime[0]._attributes.tz;
      var limit = data.int._attributes.val;
      var start = moment(data.abstime[0]._attributes.val).tz(timezone).format('LLLL z');
      var end = moment(data.abstime[1]._attributes.val).tz(timezone).format('LLLL z');

      if (Array.isArray(data.list.obj)) {
        data.list.obj.forEach((dataItem) => {
          values.push({
            Timestamp: moment(dataItem.abstime._attributes.val).tz(timezone).format('LLLL z'),
            Value: String(dataItem.real._attributes.val),
          });
        });
      }
      // If only one value in table
      else if (data.list.obj) {
        values.push({
          Timestamp: moment(data.list.obj.abstime._attributes.val).tz(timezone).format('LLLL z'),
          Value: String(data.list.obj.real._attributes.val),
        });
      }

      var payload = {
        History: path,
        Start: start,
        End: end,
        Limit: limit,
        Timezone: timezone,
        Results: values,
      };
      return payload;
    } catch (error) {
      handleErrors(error, node, msg);
    }
  }

  function HistoryNode(n) {
    RED.nodes.createNode(this, n);

    this.serverConfig = RED.nodes.getNode(n.serverConfig);
    this.status({ fill: 'blue', shape: 'dot', text: 'Ready' });
    var node = this;

    this.on('input', async function (msg, send, done) {
      try {
        // Setting all variables if passed in, if not, we will use the preset values
        var topic = n.topic || msg.topic;
        var mode = msg.protocol || this.serverConfig.mode;
        var path = msg.path || n.path;
        var historyQuery = msg.historyQuery || null;
        var presetQuery = msg.presetQuery || n.presetQuery;

        var presetOptions = [
          'yesterday',
          'last24Hours',
          'weekToDate',
          'lastWeek',
          'last7Days',
          'monthToDate',
          'lastMonth',
          'yearToDate (limit=1000)',
          'lastYear (limit=1000)',
          'unboundedQuery',
        ];
        const presetCheck = (val) => val === presetQuery;

        if (mode != 'https' && mode != 'http') {
          throw 'Invalid Security Protocol';
        }
        if (!presetOptions.some(presetCheck)) {
          throw 'PresetQuery Value Invalid';
        }

        // Set up Axios Instance
        var instance = axios.create({
          baseURL: mode + '://' + (msg.host || this.serverConfig.host) + ':' + (msg.port || this.serverConfig.port) + '/obix/histories/',
          timeout: 2000,
          auth: {
            username: msg.username || this.serverConfig.username,
            password: msg.password || this.serverConfig.password,
          },
          httpsAgent: new https.Agent({ rejectUnauthorized: false }),
          transformResponse: [
            function (data) {
              try {
                return convert.xml2js(data, { compact: true, spaces: 4 });
              } catch (error) {
                return data;
              }
            },
          ],
        });

        // Slice '/' from the path if it exists
        path.charAt(path.length - 1) == '/' ? (path = path.slice(0, -1)) : null;
        path.charAt(0) == '/' ? (path = path.slice(1)) : null;
        this.status({ fill: 'blue', shape: 'ring', text: 'Pulling...' });

        // Checking historyQuery Values
        if (historyQuery) {
          // Check Custom Query Dates... Ensure they are valid
          if (historyQuery.start) {
            var start = new Date(historyQuery.start);
            if (start.getTime()) {
              historyQuery.start = start.toISOString();
            } else {
              throw 'HistoryQuery Start Invalid Timestamp';
            }
          }
          if (historyQuery.end) {
            var end = new Date(historyQuery.end);
            if (end.getTime()) {
              historyQuery.end = end.toISOString();
            } else {
              throw 'HistoryQuery End Invalid Timestamp';
            }
          }
          if (historyQuery.limit) {
            if (Number.isInteger(Number(historyQuery.limit))) {
              null;
            } else {
              throw 'HistoryQuery Limit Invalid';
            }
          }

          // Call with historyQuery
          var response = await instance.get(path + '/~historyQuery/', { params: historyQuery });
          // Catch Bad Path
          if (response.data.err) {
            if (response.data.err._attributes.is == 'obix:BadUriErr') {
              throw 'Invalid Path:' + path;
            }
          }
        }

        // If selecting a preset query, need to override the history query
        else {
          // Call to get all preset queries
          var response = await instance.get(path);
          // Catch Bad Path
          if (response.data.err) {
            if (response.data.err._attributes.is == 'obix:BadUriErr') {
              throw 'Invalid Path:' + path;
            }
          }

          // Override the historyQuery value
          response.data.obj.ref.forEach((query) => {
            query._attributes.name == presetQuery ? (historyQuery = query._attributes.href) : null;
          });

          // Call with historyQuery
          var response = await instance.get(path + historyQuery);
        }

        topic ? (msg.topic = topic) : null;
        msg.payload = parseData(node, msg, response.data.obj, path);

        this.status({ fill: mode == 'http' ? 'yellow' : 'green', shape: 'ring', text: 'Success' });
        this.send(msg);
      } catch (error) {
        handleErrors(error, node, msg);
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
