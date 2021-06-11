module.exports = function (RED) {

    const axios = require("axios");
    const convert = require('xml-js');
    const https = require('https');

    function parseValue(value) {
        try {
            var variable = (value._attributes.href).split("/obix/config/");
            variable = variable[1].slice(0, -1);

            msg = {
                "Variable": variable,
                "Value": value._attributes.val
            }
            return msg;
        } catch (error) {
            return { error: error };
        }
    }

    function parseData(data) {
        var values = [];
        if (data.obj.list.real) {
            if (Array.isArray(data.obj.list.real)) {
                (data.obj.list.real).forEach((stuff) => values.push(parseValue(stuff)));
            } else {
                values.push(parseValue(data.obj.list.real));
            }
        }
        if (data.obj.list.str) {
            if (Array.isArray(data.obj.list.str)) {
                (data.obj.list.str).forEach((stuff) => values.push(parseValue(stuff)));
            } else {
                values.push(parseValue(data.obj.list.str));
            }
        }
        if (data.obj.list.enum) {
            if (Array.isArray(data.obj.list.enum)) {
                (data.obj.list.enum).forEach((stuff) => values.push(parseValue(stuff)));
            } else {
                values.push(parseValue(data.obj.list.enum));
            }
        }
        if (data.obj.list.bool) {
            if (Array.isArray(data.obj.list.bool)) {
                (data.obj.list.bool).forEach((stuff) => values.push(parseValue(stuff)));
            } else {
                values.push(parseValue(data.obj.list.bool));
            }
        }
        return values;
    }

    function WatcherNode(n) {

        RED.nodes.createNode(this, n);

        this.serverConfig = RED.nodes.getNode(n.serverConfig);
        this.status({ fill: "blue", shape: "dot", text: "Ready" });

        this.topic = n.topic;
        this.pollRate = (n.pollRate || 0) < 5 ? 10 : n.pollRate;
        this.pullChangesOnly = n.pullChangesOnly;
        this.relativize = n.relativize;
        this.rules = n.rules;
        this.loading = false;
        
        // Clean up relativize path
        this.relativize.charAt(this.relativize.length - 1) == '/' ? this.relativize = this.relativize.slice(0, -1) : null;
        this.relativize.charAt(0) == '/' ? this.relativize = this.relativize.slice(1) : null;

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

        this.emit("input", {});

        this.on("input", async function (msg, send, done) {
            try {
                var node = this;

                // Prevent spamming of inject
                if (this.loading) { return; }

                // Clearing Poll Change Interval and Resend on Fail
                this.pollChangeInterval ? clearInterval(this.pollChangeInterval) : null
                this.resendOnFail ? clearTimeout(this.resendOnFail) : null;
                this.setStatus ? clearTimeout(this.setStatus) : null;
                this.status({ fill: "blue", shape: "dot", text: "Creating Watch" });
                this.loading = true;

                // Call - Delete Previous Watch if there was one
                if (this.prevWatchDelete) { await instance.post(this.prevWatchDelete); }

                // Call - Make Watch
                var watchRes = await instance.post('/watchService/make');
                this.watchNumber = watchRes.data.obj._attributes.href.split(/[\s/]+/).slice(-2)[0];
                this.prevWatchDelete = watchRes.data.obj.op[4]._attributes.href;

                // Call - Change Lease Time
                var leaseRes = await instance.put(watchRes.data.obj.reltime._attributes.href, `<real val="${((this.pollRate + 5) * 1000)}" />`);

                // Prepare Paths - Remove '/' and prepend relativize
                var paths = [];
                this.rules.forEach(rule => {
                    var path = rule.pathName;
                    path.charAt(path.length - 1) == '/' ? path = path.slice(0, -1) : null;
                    path.charAt(0) == '/' ? path = path.slice(1) : null;

                    if (rule.relFlag) {
                        path = node.relativize + '/' + path
                    }
                    paths.push(path)
                })

                // Call - Adds paths to watch
                var pathsAddXML = [];
                paths.forEach((path) => pathsAddXML.push('<uri val="/obix/config/' + path + '/"/>'));
                var addRes = await instance.post(watchRes.data.obj.op[0]._attributes.href,
                    `<obj
                        is="obix:WatchIn"
                        xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
                        xmlns="http://obix.org/ns/schema/1.0">
                        <list
                            name="hrefs"
                            of="obix:Uri">
                            ` + pathsAddXML + `
                        </list>
                    </obj>`);

                // Check for bad paths
                var pathsAddErrors = addRes.data.obj.list.err
                var badPaths = [];
                if (pathsAddErrors) {
                    pathsAddErrors.forEach(error => {
                        if (error._attributes.is == "obix:BadUriErr") badPaths.push(error._attributes.display);
                    })
                }

                // Call - Poll Refresh - Get initial values
                var refreshRes = await instance.post(watchRes.data.obj.op[3]._attributes.href);
                var results = parseData(refreshRes.data);
                node.send({ topic: node.topic, reset: true, payload: results });


                // Call - Poll Change - Get values that have changed
                this.pollChangeInterval = setInterval(async () => {
                    try {
                        // TODO: Countdown when the pull will happen
                        var pollChangeRes = await instance.post(node.pullChangesOnly ? watchRes.data.obj.op[2]._attributes.href : watchRes.data.obj.op[3]._attributes.href);
                        var results = parseData(pollChangeRes.data);
                        node.send({ topic: node.topic, payload: results });
                    } catch (error) {
                        console.log(error)
                    }
                }, this.pollRate * 1000);

                this.loading = false;
                this.status({ fill: "green", shape: "dot", text: "Watch Created: " + this.watchNumber });
                this.setStatus = setTimeout(() => node.status({ fill: node.serverConfig.mode == "http" ? "yellow" : "green", shape: "ring", text: "Pulling From Watch: " + node.watchNumber }), 5000);
                if (badPaths.length != 0) {
                    this.status({ fill: "yellow", shape: "ring", text: badPaths.length + " invalid path(s) found" });
                    this.error({ invalidPaths: badPaths }, msg);
                }

                // For debugging
                // send({ watchRes: watchRes, leaseRes: leaseRes, addRes: addRes, refreshRes: refreshRes, invalidPaths: badPaths });
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
                }

                // Clearing Poll Change Interval
                this.pollChangeInterval ? clearInterval(this.pollChangeInterval) : null
                this.setStatus ? clearTimeout(this.setStatus) : null;

                // Set Node Error Information
                this.loading = false;
                this.status({ fill: "red", shape: "dot", text: friendlyError });
                this.error(inDepthError, msg);
                this.resendOnFail = setTimeout(() => node.emit("input", {}), 5000)
            }
        });

        this.on('close', async function (removed, done) {
            // Call - Delete Previous Watch if there was one
            if (this.prevWatchDelete) {
                await instance.post(this.prevWatchDelete);
                delete this.prevWatchDelete;
            }

            // Clearing Poll Change Interval and Resend on Fail
            this.pollChangeInterval ? clearInterval(this.pollChangeInterval) : null
            this.resendOnFail ? clearTimeout(this.resendOnFail) : null;

            this.loading = false;
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