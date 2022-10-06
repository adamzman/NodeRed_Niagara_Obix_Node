module.exports = function (RED) {
  const axios = require('axios');
  const convert = require('xml-js');
  const https = require('https');

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
      node.status({ fill: 'yellow', shape: 'dot', text: 'invalid path' });
      node.error({ invalidPath: error.split(':').pop() }, msg);
      return;
    }
    // If invalid https/http
    else if (error == 'Invalid Security Protocol') {
      var friendlyError = 'Invalid Security Protocol';
      var inDepthError = 'Invalid Security Protocol:\n' + '\nmsg.protocol must be either "https" or "http"';
    }
    // If invalid input type
    else if (error == 'Invalid Input Type') {
      var friendlyError = 'Invalid Input Type';
      var inDepthError = 'Invalid Input Type:\n' + '\nData Type of input does not match that of value trying to be written to';
    }
    // Cant find parsing data type
    else if (error == 'Unknown Data Type') {
      var friendlyError = 'Unknown Data Type';
      var inDepthError = 'Error with Path Parsing: Unknown Data Type';
    }
    // Cant find parsing data type
    else if (error == 'Invalid Data Action') {
      var friendlyError = 'Invalid Action';
      var inDepthError = 'Action must be "read" or "write"';
    }
    // Possibly Wrong Port
    else if (String(error.message).includes('wrong version number')) {
      var friendlyError = 'Possibly Wrong Port/Protocol';
      var inDepthError = 'Check the port and security protocol';
    } else {
      var friendlyError = 'Unknown Error';
      var inDepthError = error;
    }

    // Set Node Error Information
    node.status({ fill: 'red', shape: 'dot', text: friendlyError });
    node.error(inDepthError, msg);
  }

  function VariableNode(n) {
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
        var action = msg.action || n.action;
        var value = msg.value || n.value;

        if (action != 'read' && action != 'write') {
          throw 'Invalid Data Action';
        }
        if (mode != 'https' && mode != 'http') {
          throw 'Invalid Security Protocol';
        }

        // Set up Axios Instance
        var instance = axios.create({
          baseURL: mode + '://' + (msg.host || this.serverConfig.host) + ':' + (msg.port || this.serverConfig.port) + '/obix/config/',
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

        // If Reading/Writing Variable
        var response = action == 'read' ? await instance.get(path + '/out/') : await instance.post(path + '/set/', `<real val="${value}"/>`);

        // Catch Bad Path
        if (response.data.err) {
          if (response.data.err._attributes.is == 'obix:BadUriErr') {
            throw 'Invalid Path:' + path;
          }
          if (response.data.err._attributes.display.includes('Invalid')) {
            throw 'Invalid Input Type';
          }
        }

        var result;
        if (response.data.enum) {
          result = response.data.enum._attributes.val;
        } else if (response.data.bool) {
          result = response.data.bool._attributes.val;
        } else if (response.data.str) {
          result = response.data.str._attributes.val;
        } else if (response.data.real) {
          result = response.data.real._attributes.val;
        } else {
          throw 'Unknown Data Type';
        }

        topic ? (msg.topic = topic) : null;
        msg.payload = {
          Variable: path,
          Value: result,
        };

        this.status({ fill: mode == 'http' ? 'yellow' : 'green', shape: 'ring', text: 'Success' });
        this.send(msg);
      } catch (error) {
        handleErrors(error, node, msg);
      }
    });
  }
  RED.nodes.registerType('Niagara Obix Variable', VariableNode);

  RED.httpAdmin.post('/obixvariable/:id', RED.auth.needsPermission('obixvariable.write'), function (req, res) {
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
