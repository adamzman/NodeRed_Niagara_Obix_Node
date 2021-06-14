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

    function handleErrors(error, node, msg) {
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
        node.watchInterval ? clearInterval(node.watchInterval) : null

        // Set Node Error Information
        node.loading = false;
        node.status({ fill: "red", shape: "dot", text: friendlyError });
        node.error(inDepthError, msg);
        node.resendOnFail = setTimeout(() => node.emit("input", {}), 5000)
    }

    function findBadURI(pathsErrors, node, msg) {
        try {
            node.badPaths = [];
            if (pathsErrors) {
                if (Array.isArray(pathsErrors)) {
                    pathsErrors.forEach(error => {
                        if (error._attributes.is == "obix:BadUriErr") {
                            // node.badPaths.includes(error._attributes.display) ? null :
                            node.badPaths.push(error._attributes.display);
                        }
                    })
                } else {
                    if (pathsErrors._attributes.is == "obix:BadUriErr") {
                        // node.badPaths.includes(pathsErrors._attributes.display) ? null :
                        node.badPaths.push(pathsErrors._attributes.display);
                    }
                }
            }

            if (node.badPaths.length != 0) {
                node.status({ fill: "yellow", shape: "dot", text: node.badPaths.length + " invalid path(s) found - " + node.watchNumber });
                node.error({ invalidPaths: node.badPaths }, msg);
            } else {
                node.status({ fill: node.serverConfig.mode == "http" ? "yellow" : "green", shape: "ring", text: "Pulling From Watch: " + node.watchNumber });
            }
        } catch (error) {
            handleErrors(error, node, msg);
        }
    }

    async function addToWatch(node, msg) {
        try {
            var pathsAddXML = [];
            node.paths.forEach((path) => pathsAddXML.push('<uri val="/obix/config/' + path + '/"/>'));

            var addRes = await node.instance.post(node.watchRes.data.obj.op[0]._attributes.href,
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
            return addRes;
        } catch (error) {
            handleErrors(error, node, msg);
        }
    }

    function WatcherNode(n) {

        RED.nodes.createNode(this, n);

        this.serverConfig = RED.nodes.getNode(n.serverConfig);
        this.status({ fill: "blue", shape: "dot", text: "Ready" });

        this.topic = n.topic;
        this.pollRate = (n.pollRate || 0) < 5 ? 10 : n.pollRate;
        // this.pullChangesOnly = n.pullChangesOnly;
        this.relativize = n.relativize;
        this.rules = n.rules;

        this.loading = false;
        this.badPaths = [];

        // Clean up relativize path
        this.relativize.charAt(this.relativize.length - 1) == '/' ? this.relativize = this.relativize.slice(0, -1) : null;
        this.relativize.charAt(0) == '/' ? this.relativize = this.relativize.slice(1) : null;

        this.instance = axios.create({
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

        var node = this;

        // Prepare Paths - Remove '/' and prepend relativize
        node.paths = [];
        this.rules.forEach(rule => {
            var path = rule.pathName;
            path.charAt(path.length - 1) == '/' ? path = path.slice(0, -1) : null;
            path.charAt(0) == '/' ? path = path.slice(1) : null;

            if (rule.relFlag) {
                path = node.relativize + '/' + path
            }
            node.paths.push(path);
        })

        setTimeout(() => node.emit("input", {}), 1000);

        this.on("input", async function (msg, send, done) {
            try {
                // Prevent spamming of inject
                if (this.loading) { return; }

                // Clearing Poll Change Interval and Resend on Fail
                this.watchInterval ? clearInterval(this.watchInterval) : null
                this.resendOnFail ? clearTimeout(this.resendOnFail) : null;
                this.status({ fill: "blue", shape: "dot", text: "Creating Watch" });
                this.loading = true;

                // Call - Delete Previous Watch if there was one
                if (this.prevWatchDelete) { await this.instance.post(this.prevWatchDelete); }

                // Call - Make Watch
                this.watchRes = await this.instance.post('/watchService/make');
                this.watchNumber = this.watchRes.data.obj._attributes.href.split(/[\s/]+/).slice(-2)[0];
                this.prevWatchDelete = this.watchRes.data.obj.op[4]._attributes.href;
                this.status({ fill: "green", shape: "dot", text: "Watch Created: " + this.watchNumber });

                // Call - Change Lease Time
                await this.instance.put(this.watchRes.data.obj.reltime._attributes.href, `<real val="${((this.pollRate + 5) * 1000)}" />`);

                // Call - Adds paths to watch
                var results = await addToWatch(node, msg);
                findBadURI(results.data.obj.list.err, node, msg);                
                var results = parseData(results.data);
                node.send({ topic: node.topic, payload: results });

                // Call - Poll Change - Get values that have changed
                this.watchInterval = setInterval(async () => {
                    // TODO: Countdown when the pull will happen
                    try {
                        // Call - Adds paths to watch
                        var results = await addToWatch(node, msg);
                        // Check for bad paths
                        findBadURI(results.data.obj.list.err, node, msg);
                        
                        // TODO: Change so, on input, actually does a poll refresh/change instead
                        // Call - Poll Refresh - Get initial values
                        // var pollResults = await node.instance.post(node.pullChangesOnly ? node.watchRes.data.obj.op[2]._attributes.href : node.watchRes.data.obj.op[3]._attributes.href);
                        
                        var results = parseData(results.data);
                        node.send({ topic: node.topic, payload: results });
                    } catch (error) {
                        handleErrors(error, node, msg);
                    }
                }, this.pollRate * 1000);

                this.loading = false;
            } catch (error) {
                handleErrors(error, node, msg);
            }
        });

        this.on('close', async function (removed, done) {
            // Call - Delete Previous Watch if there was one
            if (this.prevWatchDelete) {
                await this.instance.post(this.prevWatchDelete);
                delete this.prevWatchDelete;
            }

            // Clearing Poll Change Interval and Resend on Fail
            this.watchInterval ? clearInterval(this.watchInterval) : null
            this.resendOnFail ? clearTimeout(this.resendOnFail) : null;

            this.loading = false;
            this.badPaths = [];
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