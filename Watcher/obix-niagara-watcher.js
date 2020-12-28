module.exports = function (RED) {

    const axios = require("axios");
    const convert = require('xml-js');
    const https = require('https');
    const tcpp = require('tcp-ping');

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
            return { "error": error };
        }
    }

    function throwError(node, config, msg, err, status) {
        node.newWatchTimeout1 ? clearTimeout(node.newWatchTimeout1) : null;
        node.pollChangesInterval ? clearInterval(node.pollChangesInterval) : null;

        node.status({ fill: "red", shape: "dot", text: status });
        node.error(err, msg);

        node.newWatchTimeout1 = setTimeout(function () { onCreate(node, config); }, 10000);
    }

    function onCreate(node, config) {

        msg = {};

        // Set Variables
        try {
            // Setting all variables if passed in, if not, we will use the preset values
            var username = node.serverConfig.username;
            var password = node.serverConfig.password;
            var ipAddress = node.serverConfig.host;
            var httpsPort = node.serverConfig.port;
            var pollRate = config.pollRate;
            var paths = config.rules;

            // If missing a configuration variable, return error
            if (!username) { throw "Missing Username"; }
            if (!password) { throw "Missing Password"; }
            if (!ipAddress) { throw "Missing IP Address"; }
            if (!httpsPort) { throw "Missing HTTPS Port"; }
            if (!pollRate || !(pollRate <= 30 && pollRate >= 1)) { throw "Invalid/Missing PollRate"; }
            if (!paths) { throw "Missing a Path" }

            // Slice '/' from the path if it exists
            for (i = 0; i < paths.length; i++) {
                path = paths[i];
                path.charAt(path.length - 1) == '/' ? path = path.slice(0, -1) : null;
                path.charAt(0) == '/' ? path = path.slice(1) : null;
                paths[i] = path;
            }
        } catch (error) {
            throwError(node, config, msg, error, error);
            return;
        }

        // Initial Connection Pings
        tcpp.ping({ "address": ipAddress, "port": Number(httpsPort), "timeout": 4000, "attempts": 1 }, async function (err, data) {

            if (err) {
                throwError(node, config, msg, "Error in TCP Ping: " + err, "Error in TCP Ping");
                return;
            }
            if (data.results[0].err) {
                throwError(node, config, msg, "Host/Port Unavailable - Failed to Ping for Initial Watch Creation", "Host/Port Unavailable");
                return;
            }

            var createWatchData;

            // Make a new Watch
            try {
                var apiCallConfig = {
                    method: 'post',
                    url: 'https://' + ipAddress + ':' + httpsPort + '/obix/watchService/make',
                    auth: {
                        username: username,
                        password: password
                    },
                    httpsAgent: new https.Agent({ rejectUnauthorized: false })
                };
                node.status({ fill: "blue", shape: "dot", text: "Creating Watch" });
                // Make a new Watch
                const createWatchResponse = await axios(apiCallConfig);
                // Convert Response to JSON
                createWatchData = convert.xml2js(createWatchResponse.data, { compact: true, spaces: 4 });
                // Get Watch Number
                var watchNumUrl = (createWatchData.obj._attributes.href).split("/");
                var watchNum = watchNumUrl[watchNumUrl.length - 2];
                node.status({ fill: "green", shape: "dot", text: "Watch Created: " + watchNum });
            } catch (error) {
                throwError(node, config, msg, error, error);
                return;
            }

            // Make ADD POST Request
            try {
                // Prepare Paths for ADD POST Request
                var apiPathsAdd = [];
                paths.forEach((path) => apiPathsAdd.push('<uri val="/obix/config/' + path + '/"/>'));
                var apiAddConfig = {
                    method: 'post',
                    url: createWatchData.obj.op[0]._attributes.href,
                    auth: {
                        username: username,
                        password: password
                    },
                    httpsAgent: new https.Agent({ rejectUnauthorized: false }),
                    data: `<obj
                            is="obix:WatchIn"
                            xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
                            xmlns="http://obix.org/ns/schema/1.0">
                            <list
                                name="hrefs"
                                of="obix:Uri">
                                ` + apiPathsAdd + `
                            </list>
                        </obj>`
                };

                const addPathsResponse = await axios(apiAddConfig);
                const addPathsData = convert.xml2js(addPathsResponse.data, { compact: true, spaces: 4 });

                // Checking for Errors after Add was Successful
                if (addPathsData.obj.list.err) {
                    var x = 0;
                    for (i = 0; i < addPathsData.obj.list.err.length; i++) {
                        x = 1;
                        if (addPathsData.obj.list.err[i]._attributes.is == "obix:BadUriErr")
                            throw "Invalid Path: " + addPathsData.obj.list.err[i]._attributes.display;
                    }
                    if (x == 0)
                        if (addPathsData.obj.list.err._attributes.is == "obix:BadUriErr")
                            throw "Invalid Path: " + addPathsData.obj.list.err._attributes.display;
                    return;
                }
            } catch (error) {
                throwError(node, config, msg, error, error);
                return;
            }

            // Initial Poll Refresh
            try {
                var apiPollRefreshConfig = {
                    method: 'post',
                    url: createWatchData.obj.op[3]._attributes.href,
                    auth: {
                        username: username,
                        password: password
                    },
                    httpsAgent: new https.Agent({ rejectUnauthorized: false })
                };

                const pollRefreshResponse = await axios(apiPollRefreshConfig)
                const pollRefreshData = convert.xml2js(pollRefreshResponse.data, { compact: true, spaces: 4 });

                var values = [];
                if (pollRefreshData.obj.list.real) {
                    if (Array.isArray(pollRefreshData.obj.list.real)) {
                        (pollRefreshData.obj.list.real).forEach((stuff) => values.push(parseValue(stuff)));
                    } else {
                        values.push(parseValue(pollRefreshData.obj.list.real));
                    }
                }
                if (pollRefreshData.obj.list.str) {
                    if (Array.isArray(pollRefreshData.obj.list.str)) {
                        (pollRefreshData.obj.list.str).forEach((stuff) => values.push(parseValue(stuff)));
                    } else {
                        values.push(parseValue(pollRefreshData.obj.list.str));
                    }
                }
                if (pollRefreshData.obj.list.enum) {
                    if (Array.isArray(pollRefreshData.obj.list.enum)) {
                        (pollRefreshData.obj.list.enum).forEach((stuff) => values.push(parseValue(stuff)));
                    } else {
                        values.push(parseValue(pollRefreshData.obj.list.enum));
                    }
                }
                if (pollRefreshData.obj.list.bool) {
                    if (Array.isArray(pollRefreshData.obj.list.bool)) {
                        (pollRefreshData.obj.list.bool).forEach((stuff) => values.push(parseValue(stuff)));
                    } else {
                        values.push(parseValue(pollRefreshData.obj.list.bool));
                    }
                }

                // Send Poll Refresh Values
                msg = {
                    reset: true,
                    payload: values
                }
                node.send(msg);
            } catch (error) {
                throwError(node, config, msg, error, error);
                return;
            }

            node.pollChangesInterval = setInterval(async function () {
                tcpp.ping({ "address": ipAddress, "port": Number(httpsPort), "timeout": 4000, "attempts": 1 }, async function (err, data) {
                    try {
                        if (err) { throw "Error in TCP Ping"; }
                        if (data.results[0].err) { throw "Host/Port Unavailable - Poll Change"; }

                        var apiPollChangesConfig = {
                            method: 'post',
                            url: createWatchData.obj.op[2]._attributes.href,
                            auth: {
                                username: username,
                                password: password
                            },
                            httpsAgent: new https.Agent({ rejectUnauthorized: false })
                        };

                        // Make PollChanges POST Request
                        const pollChangesResponse = await axios(apiPollChangesConfig);
                        const pollChangesData = convert.xml2js(pollChangesResponse.data, { compact: true, spaces: 4 });

                        var values = [];
                        if (pollChangesData.obj.list.real) {
                            if (Array.isArray(pollChangesData.obj.list.real)) {
                                (pollChangesData.obj.list.real).forEach((stuff) => values.push(parseValue(stuff)));
                            } else {
                                values.push(parseValue(pollChangesData.obj.list.real));
                            }
                        }
                        if (pollChangesData.obj.list.str) {
                            if (Array.isArray(pollChangesData.obj.list.str)) {
                                (pollChangesData.obj.list.str).forEach((stuff) => values.push(parseValue(stuff)));
                            } else {
                                values.push(parseValue(pollChangesData.obj.list.str));
                            }
                        }
                        if (pollChangesData.obj.list.enum) {
                            if (Array.isArray(pollChangesData.obj.list.enum)) {
                                (pollChangesData.obj.list.enum).forEach((stuff) => values.push(parseValue(stuff)));
                            } else {
                                values.push(parseValue(pollChangesData.obj.list.enum));
                            }
                        }
                        if (pollChangesData.obj.list.bool) {
                            if (Array.isArray(pollChangesData.obj.list.bool)) {
                                (pollChangesData.obj.list.bool).forEach((stuff) => values.push(parseValue(stuff)));
                            } else {
                                values.push(parseValue(pollChangesData.obj.list.bool));
                            }
                        }

                        msg = {
                            payload: values
                        };
                        node.send(msg);
                    } catch (error) {
                        throwError(node, config, msg, error, error);
                        return;
                    }
                });
            }, pollRate * 1000);
        });
    }

    function WatcherNode(config) {

        RED.nodes.createNode(this, config);

        var node = this;
        node.serverConfig = RED.nodes.getNode(config.serverConfig);

        onCreate(node, config)

        this.on('close', function (removed, done) {
            node.status({ fill: "red", shape: "ring", text: "Disconnected" });
            node.pollChangesInterval ? clearInterval(node.pollChangesInterval) : null;
            node.newWatchTimeout1 ? clearTimeout(node.newWatchTimeout1) : null;
            done();
        });

    }

    RED.nodes.registerType("Niagara Obix Watcher", WatcherNode);
}