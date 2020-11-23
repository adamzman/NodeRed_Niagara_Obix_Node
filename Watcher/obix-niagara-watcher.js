module.exports = function (RED) {

    const axios = require("axios");
    const convert = require('xml-js');
    const https = require('https');
    const tcpp = require('tcp-ping');

    function WatcherNode(config) {
        RED.nodes.createNode(this, config);
        const node = this;
        var context = this.context();

        var pollChanges;
        // Connecting Configuration Node
        node.serverConfig = RED.nodes.getNode(config.serverConfig);

        // Setting all variables if passed in, if not, we will use the preset values
        context.set('username', node.serverConfig.username);
        context.set('password', node.serverConfig.password);
        context.set('ipAddress', node.serverConfig.host);
        context.set('httpsPort', node.serverConfig.port);
        context.set('pollRate', config.pollRate);
        context.set('paths', config.rules);

        // If missing a configuration variable, return error
        if (!context.get('username')) { throwError("red", "ring", "Missing Username"); return; }
        if (!context.get('password')) { throwError("red", "ring", "Missing Password"); return; }
        if (!context.get('ipAddress')) { throwError("red", "ring", "Missing IP Address"); return; }
        if (!context.get('httpsPort')) { throwError("red", "ring", "Missing HTTPS Port"); return; }
        if (!context.get('pollRate') || !(context.get('pollRate') <= 30 && context.get('pollRate') >= 1)) { throwError("red", "ring", "PollRate Invalid"); return; }
        if (!context.get('paths')) { throwError("red", "ring", "Missing a Path"); return; }

        // Slice '/' from the path if it exists
        for (i = 0; i < context.get('paths').length; i++) {
            path = context.get('paths')[i];
            path.charAt(path.length - 1) == '/' ? path = path.slice(0, -1) : null;
            path.charAt(0) == '/' ? path = path.slice(1) : null;
            context.get('paths')[i] = path;
        }

        var apiCallConfig = {
            method: 'post',
            url: 'https://' + context.get('ipAddress') + ':' + context.get('httpsPort') + '/obix/watchService/make',
            auth: {
                username: context.get('username'),
                password: context.get('password')
            },
            httpsAgent: new https.Agent({ rejectUnauthorized: false })
        };
        node.status({ fill: "blue", shape: "dot", text: "Creating Watch" });

        // Establish Watch
        axios(apiCallConfig)
            .then(function (response) {
                // Convert Response to JSON
                var data = convert.xml2js(response.data, { compact: true, spaces: 4 });

                // Get Watch Number
                var watchNumUrl = (data.obj._attributes.href).split("/");
                var watchNum = watchNumUrl[watchNumUrl.length - 2];
                node.status({ fill: "green", shape: "dot", text: "Watch Created: " + watchNum });

                // Prepare Paths for ADD POST Request
                var apiPathsAdd = [];
                context.get('paths').forEach((path) => apiPathsAdd.push('<uri val="/obix/config/' + path + '/"/>'));
                var apiAddConfig = {
                    method: 'post',
                    url: data.obj.op[0]._attributes.href,
                    auth: {
                        username: context.get('username'),
                        password: context.get('password')
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

                // Make ADD POST Request
                axios(apiAddConfig)
                    .then(function (response) {
                        // Convert Response to JSON
                        var addData = convert.xml2js(response.data, { compact: true, spaces: 4 });

                        // Checking for Errors after Add was Successful
                        if (addData.obj.list.err) {
                            var x = 0;
                            for (i = 0; i < addData.obj.list.err.length; i++) {
                                x = 1;
                                addData.obj.list.err[i]._attributes.is == "obix:BadUriErr" ? throwError("red", "ring", "Invalid Path: " + addData.obj.list.err[i]._attributes.display) : null;
                            }
                            x == 0 ? (addData.obj.list.err._attributes.is == "obix:BadUriErr" ? throwError("red", "ring", "Invalid Path: " + addData.obj.list.err._attributes.display) : null) : null;
                            return;
                        }

                        var apiPollRefreshConfig = {
                            method: 'post',
                            url: data.obj.op[3]._attributes.href,
                            auth: {
                                username: context.get('username'),
                                password: context.get('password')
                            },
                            httpsAgent: new https.Agent({ rejectUnauthorized: false })
                        };

                        // Make PollRefresh POST Request
                        axios(apiPollRefreshConfig)
                            .then(function (response) {
                                // Convert Response to JSON
                                var pollRefreshData = convert.xml2js(response.data, { compact: true, spaces: 4 });


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

                                msg = {
                                    // pollRefreshData: pollRefreshData,
                                    payload: values
                                }
                                node.send(msg)

                                // After Watch has been created and established
                                pollChanges = setInterval(function () {
                                    // Make PollChanges POST Request
                                    var apiPollChangesConfig = {
                                        method: 'post',
                                        url: data.obj.op[2]._attributes.href,
                                        auth: {
                                            username: context.get('username'),
                                            password: context.get('password')
                                        },
                                        httpsAgent: new https.Agent({ rejectUnauthorized: false })
                                    };

                                    axios(apiPollChangesConfig)
                                        .then(function (response) {
                                            // Convert Response to JSON
                                            var pollChangesData = convert.xml2js(response.data, { compact: true, spaces: 4 });

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
                                                // pollChangesData: pollChangesData,
                                                payload: values
                                            }
                                            node.send(msg)

                                        }).catch(function (error) {
                                            clearInterval(pollChanges);
                                            throwError("red", "dot", "Error in PollChange");
                                            node.send({ "error": error });
                                            return;
                                        })
                                }, context.get('pollRate') * 1000);

                            }).catch(function (error) {
                                throwError("red", "dot", "Error in PollRefresh");
                                node.send({ "error": error });
                                return;
                            })

                    }).catch(function (error) {
                        throwError("red", "dot", "Error in Add");
                        node.send({ "error": error });
                        return;
                    })

            })
            .catch(function (error) {
                // handle error
                throwError("red", "dot", "Error in Connector");
                return;
            })

        this.on('close', function (removed, done) {
            clearInterval(pollChanges);
            done();
        });

        function throwError(color, shape, status) {
            node.status({ fill: color, shape: shape, text: status });
        }

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
                throwError("red", "dot", "Error");
                return { "error": error };
            }
        }
    }

    RED.nodes.registerType("Niagara Obix Watcher", WatcherNode);
}