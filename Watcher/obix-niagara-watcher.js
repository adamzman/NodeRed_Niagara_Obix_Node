module.exports = function (RED) {

    const axios = require("axios");
    const convert = require('xml-js');
    const https = require('https');

    // function parseValue(value) {
    //     try {
    //         var variable = (value._attributes.href).split("/obix/config/");
    //         variable = variable[1].slice(0, -1);

    //         msg = {
    //             "Variable": variable,
    //             "Value": value._attributes.val
    //         }
    //         return msg;
    //     } catch (error) {
    //         return { "error": error };
    //     }
    // }

    function WatcherNode(n) {

        RED.nodes.createNode(this, n);

        this.serverConfig = RED.nodes.getNode(n.serverConfig);

        this.topic = n.topic;
        this.pollRate = (n.pollRate || 0) < 5 ? 10 : n.pollRate;
        this.relativize = n.relativize;
        this.rules = n.rules;
        this.loading = false;

        const instance = axios.create({
            baseURL: this.serverConfig.mode + '://' + this.serverConfig.host + ':' + this.serverConfig.port + '/obix/',
            timeout: 2000,
            auth: {
                username: this.serverConfig.username,
                password: this.serverConfig.password
            },
            httpsAgent: new https.Agent({ rejectUnauthorized: false }),
            transformResponse: [function (data) {
                try {
                    return convert.xml2js(data, { compact: true, spaces: 4 })
                } catch (error) {
                    return data
                }
            }],
        })

        this.on("input", async function (msg, send, done) {
            try {
                // Prevent spamming of inject
                if (this.loading) { return; }
                this.loading = true;

                // Delete Previous Watch if there was one
                if (this.prevWatchDelete) { await instance.post(this.prevWatchDelete); }

                // Make Watch
                var watchRes = await instance.post('/watchService/make');
                this.watchNumber = watchRes.data.obj._attributes.href.split(/[\s/]+/).slice(-2)[0];
                this.prevWatchDelete = watchRes.data.obj.op[4]._attributes.href;

                console.log(this.watchNumber);

                // Change Lease Time
                var leaseRes = await instance.put(watchRes.data.obj.reltime._attributes.href, `<real val="${((this.pollRate + 5) * 1000)}" />`);


                // TODO: Countdown when the pull will happen
                // TODO: Make status yellow when using http
                // TODO: Make status blue when pulling
                this.loading = false;
                this.status({ fill: "green", shape: "dot", text: "Watch Created: " + this.watchNumber });
                send({ watchRes: watchRes, leaseRes: leaseRes })
            } catch (error) {

                // Formatting Errors
                // If cannot connect to server
                if (error.code == "ECONNABORTED") {
                    var friendlyError = "Connection Error - Timeout"
                    var inDepthError = 'Error ECONNABORTED- Connection to server could not be established:\n' + 
                    '\n1. Check the configured IP Address and Port' + 
                    '\n2. Ensure http/https is enabled in the WebServices in Niagara';
                }
                // If invalid credentials
                else if (error.message == "Request failed with status code 401") {
                    var friendlyError = "Invalid Username/Password - 401";
                    var inDepthError = 'Error 401 - Invalid Credentials:\n' + 
                    '\n1. Ensure the Username / Password is correct' +
                    '\n2. Ensure the Obix user account has HTTPBasicScheme authentication (Check Documentation in Github for more details)';
                }
                // If permission error
                else if (error.message == "Request failed with status code 403") {
                    var friendlyError = "Permission Error - 403";
                    var inDepthError = 'Error 403 - Permission Error:\n' + 
                    '\n1. Ensure the obix user has the admin role assigned / admin privileges';
                }
                // If obix driver missing
                else if (error.message == "Request failed with status code 404") {
                    var friendlyError = "Obix Driver Missing - 404";
                    var inDepthError = 'Error 404 - Obix Driver most likely missing:\n' +
                    '\n1. Ensure the obix driver is placed directly under the Drivers in the Niagara tree (Check Documentation in Github for more details)';
                }
                else {
                    var friendlyError = "Unknown Error";
                    var inDepthError = error;
                    send({ error: error })
                }

                // Set Node Error Information
                this.loading = false;
                this.status({ fill: "red", shape: "dot", text: friendlyError });
                this.error(inDepthError, msg);
            }
        });

        this.on('close', function (removed, done) {
            this.status({ fill: "red", shape: "ring", text: "Disconnected" });
            done();
        });

    }

    RED.nodes.registerType("Niagara Obix Watcher", WatcherNode);

    RED.httpAdmin.post("/obixwatcher/:id", RED.auth.needsPermission("obixwatcher.write"), function (req, res) {
        var node = RED.nodes.getNode(req.params.id);
        if (node != null) {
            try {
                node.receive();
                res.sendStatus(200);
            } catch (err) {
                res.sendStatus(500);
                node.error(RED._("inject.failed", { error: err.toString() }));
            }
        } else {
            res.sendStatus(404);
        }
    });
}