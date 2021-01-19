module.exports = function (RED) {

    const axios = require("axios");
    const convert = require('xml-js');
    const https = require('https');
    const tcpp = require('tcp-ping');

    function throwError(node, msg, err, status) {
        if(typeof status != "string") status = "Error - Ensure HTTPS/HTTP is available, and configured Port is used with proper Connection Mode";
        node.status({ fill: "red", shape: "dot", text: status });
        node.error(err, msg);
    }

    function onInput(node, config, msg) {
        // Variables
        try {
            // Setting all variables if passed in, if not, we will use the preset values
            var username = msg.username || node.serverConfig.username;
            var password = msg.password || node.serverConfig.password;
            var ipAddress = msg.ipAddress || node.serverConfig.host;
            var httpMode = msg.mode || node.serverConfig.mode;
            var httpsPort = msg.httpsPort || node.serverConfig.port;
            var path = msg.path || config.path;
            var action = msg.method || config.action;
            var value = msg.value || config.value;

            // If missing a configuration variable, return error
            if (!username) { throw "Missing Username"; }
            if (!password) { throw "Missing Password"; }
            if (!ipAddress) { throw "Missing IP Address"; }
            if (!httpMode) { throw "Select HTTP or HTTPS"; }
            if (!httpsPort) { throw "Missing HTTPS Port"; }
            if (!path) { throw "Missing Variable Path"; }
            if ((!value) && (action == "POST")) { throw "Missing Write Value"; }

            // Slice '/' from the path if it exists
            path.charAt(path.length - 1) == '/' ? path = path.slice(0, -1) : null;
            path.charAt(0) == '/' ? path = path.slice(1) : null;
            node.status({ fill: "blue", shape: "ring", text: "Pulling..." });

        } catch (error) {
            throwError(node, msg, error, error);
            return;
        }

        tcpp.ping({ "address": ipAddress, "port": Number(httpsPort), "timeout": 2000, "attempts": 2 }, async function (err, data) {
            if (err) { throwError(node, msg, "Error in TCP Ping: " + err, "Error in TCP Ping"); return; }
            if (data.results[0].err) { throwError(node, msg, "TCP Ping Failed: Host/Port Invalid", "Host/Port Unavailable"); return; }

            // Success Connection
            // Set Fetch parameters
            if (action == "POST") {
                var apiCallConfig = {
                    method: 'post',
                    url: httpMode + "://" + ipAddress + ":" + httpsPort + "/obix/config/" + path + "/set/",
                    auth: {
                        username: username,
                        password: password
                    },
                    httpsAgent: new https.Agent({ rejectUnauthorized: false }),
                    data: '<real val="' + value + '"/>'
                };
            } else {
                var apiCallConfig = {
                    method: 'get',
                    url: httpMode + "://" + ipAddress + ":" + httpsPort + "/obix/config/" + path + "/out/",
                    auth: {
                        username: username,
                        password: password
                    },
                    httpsAgent: new https.Agent({ rejectUnauthorized: false }),
                };
            }

            try {
                const response = await axios(apiCallConfig);
                const data = convert.xml2js(response.data, { compact: true, spaces: 4 });

                if (data.err) {
                    data.err._attributes.is == "obix:BadUriErr" ? status = "Invalid Variable Path" : status = "Unknown Error";
                    data.err._attributes.display.includes("Invalid") ? status = "Invalid Data Type" : null;
                    throwError(node, msg, "Error: " + status, status);
                    return;
                }

                // After the Request is made, and the JSON data is returned...
                try {
                    var result;
                    if (data.enum) { result = data.enum._attributes.val }
                    else if (data.bool) { result = data.bool._attributes.val }
                    else if (data.str) { result = data.str._attributes.val }
                    else if (data.real) { result = data.real._attributes.val }
                    else { throw "Error with Variable Parsing: Can't Find Data Type"; }
                    msg.payload = {
                        "Variable": path,
                        "Value": result,
                    };
                } catch (error) {
                    throwError(node, msg, error, error);
                    return;
                }

                node.status({ fill: "green", shape: "dot", text: "Success" });
                node.send(msg);
            } catch (error) {
                throwError(node, msg, error, error);
                return;
            }
        });

    }

    function VariableNode(config) {

        RED.nodes.createNode(this, config);

        var node = this;
        node.serverConfig = RED.nodes.getNode(config.serverConfig);

        this.on('input', async function (msg) {
            onInput(node, config, msg);
        });
        node.status({ fill: "blue", shape: "dot", text: "Ready" });
    }
    RED.nodes.registerType("Niagara Obix Variable", VariableNode);
}