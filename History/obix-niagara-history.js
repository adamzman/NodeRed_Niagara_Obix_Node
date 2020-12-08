module.exports = function (RED) {

    const axios = require("axios");
    const convert = require('xml-js');
    const https = require('https');
    const tcpp = require('tcp-ping');
    const moment = require('moment-timezone');

    function parseData(msg, data, path) {
        // After the Requests are made, and the JSON data is returned...
        try {
            value = [];
            timezone = data.obj.abstime[0]._attributes.tz;
            limit = data.obj.int._attributes.val;
            start = moment(data.obj.abstime[0]._attributes.val).tz(timezone).format('LLLL z');
            end = moment(data.obj.abstime[1]._attributes.val).tz(timezone).format('LLLL z');

            for (i = 0; i < Number(limit); i++) {
                value[i] = {
                    "Timestamp": moment(data.obj.list.obj[i].abstime._attributes.val).tz(timezone).format('LLLL z'),
                    "Value": String(data.obj.list.obj[i].real._attributes.val)
                }
            }

            msg.payload = {
                "History": path,
                "Start": start,
                "End": end,
                "Limit": limit,
                "Timezone": timezone,
                "Results": value,
            };

            return msg;
        } catch (error) {
            msg.payload = "Error in History Parsing";
            console.log(error);
            return msg;
        }
    }

    function throwError(node, msg, err, status1) {
        node.status({ fill: "red", shape: "dot", text: status1 });
        node.error(err, msg);
    }

    function onInput(node, config, msg) {

        var url;

        // Variables
        try {
            var presetOptions = ["yesterday", "last24Hours", "weekToDate", "lastWeek", "last7Days", "monthToDate", "lastMonth", "yearToDate (limit=1000)", "lastYear (limit=1000)", "unboundedQuery"];

            // Setting all variables if passed in, if not, we will use the preset values
            var username = msg.username || node.serverConfig.username;
            var password = msg.password || node.serverConfig.password;
            var ipAddress = msg.ipAddress || node.serverConfig.host;
            var httpsPort = msg.httpsPort || node.serverConfig.port;
            var path = msg.path || config.path;
            var historyQuery = msg.historyQuery || null;
            var presetQuery = msg.presetQuery || config.presetQuery;
            const presetCheck = (val) => val === presetQuery;

            // If missing a configuration variable, return error
            if (!username) { throw "Missing Username"; }
            if (!password) { throw "Missing Password"; }
            if (!ipAddress) { throw "Missing IP Address"; }
            if (!httpsPort) { throw "Missing HTTPS Port"; }
            if (!path) { throw "Missing History Path"; }
            if (!presetOptions.some(presetCheck)) { throw "PresetQuery Value Invalid"; }

            // Slice '/' from the path if it exists
            path.charAt(path.length - 1) == '/' ? path = path.slice(0, -1) : null;
            path.charAt(0) == '/' ? path = path.slice(1) : null;

        } catch (error) {
            throwError(node, msg, error, error);
            return;
        }

        tcpp.ping({ "address": ipAddress, "port": Number(httpsPort), "timeout": 1000, "attempts": 1 }, async function (err, data) {
            try {
                // Check if passed in custom history query, if not, we will use the preset that is selected
                if (historyQuery) {
                    try {
                        // Check Custom Query Dates... Ensure they are valid
                        if (historyQuery.start) {
                            // Format into Date and check if it is valid
                            start = new Date(historyQuery.start);
                            if (start.getTime()) { historyQuery.start = start.toISOString(); }
                            else { throw "HistoryQuery Start is an Invalid Timestamp"; }
                        }
                        if (historyQuery.end) {
                            // Format into Date and check if it is valid
                            end = new Date(historyQuery.end);
                            if (end.getTime()) { historyQuery.end = end.toISOString(); }
                            else { throw "HistoryQuery End is an Invalid Timestamp"; }
                        }

                        url = "https://" + ipAddress + ":" + httpsPort + "/obix/histories/" + path + "/~historyQuery/";

                        const historyQueryResponse = await axios.get(url, { params: historyQuery, auth: { username: username, password: password }, httpsAgent: new https.Agent({ rejectUnauthorized: false }), })
                        const historyQueryData = convert.xml2js(historyQueryResponse.data, { compact: true, spaces: 4 });

                        if (historyQueryData.err) {
                            historyQueryData.err._attributes.is == "obix:BadUriErr" ? status = "Invalid History Path" : status = "Unknown Error";
                            throw status;
                        }

                        msg = parseData(msg, historyQueryData, path);
                        if (msg.payload == "Error in History Parsing") { throw "Error in History Parsing"; }
                        node.status({ fill: "green", shape: "dot", text: "Success" });
                        node.send(msg);
                    } catch (error) {
                        if (String(error).includes("404")) { error = "Invalid IP/Port"; }
                        if (String(error).includes("401")) { error = "Invalid Credentials"; }
                        if (String(error).includes("ssl3_get_record")) { error = "Possibly change port to HTTPS port instead of HTTP"; }
                        throwError(node, msg, error, error);
                        return;
                    }
                } else {
                    try {
                        historyQuery = "";
                        presetQueryParameter = "";
                        url = "https://" + ipAddress + ":" + httpsPort + "/obix/histories/" + path + "/";

                        const presetQueryResponse = await axios.get(url, { auth: { username: username, password: password }, httpsAgent: new https.Agent({ rejectUnauthorized: false }), });
                        const presetQueryData = convert.xml2js(presetQueryResponse.data, { compact: true, spaces: 4 });

                        // Check if Error Occurred
                        if (presetQueryData.err) {
                            presetQueryData.err._attributes.is == "obix:BadUriErr" ? status = "Invalid History Path" : status = "Unknown Error";
                            throw status;
                        } else {
                            // If previous request was successful, then append the preset history query to the new request                            
                            for (i = 0; i < presetQueryData.obj.ref.length; i++) {
                                if (presetQueryData.obj.ref[i]._attributes.name == presetQuery) {
                                    presetQueryParameter = presetQueryData.obj.ref[i]._attributes.href;
                                    break;
                                }
                                if (i >= (presetQueryData.obj.ref.length - 1)) { throw "Invalid History Path"; }
                            }
                            url = url + presetQueryParameter;
                        }

                        try {
                            const presetQueryResponse2 = await axios.get(url, { auth: { username: username, password: password }, httpsAgent: new https.Agent({ rejectUnauthorized: false }), })
                            const presetQueryData2 = convert.xml2js(presetQueryResponse2.data, { compact: true, spaces: 4 });

                            msg = parseData(msg, presetQueryData2, path);
                            if (msg.payload == "Error in History Parsing") { throw "Error in History Parsing" }
                            node.status({ fill: "green", shape: "dot", text: "Success" });
                            node.send(msg);
                        } catch (error) {
                            throwError(node, msg, error, error);
                            return;
                        }
                    } catch (error) {
                        throwError(node, msg, error, error);
                        return;
                    }
                }
            } catch (error) {
                throwError(node, msg, error, error);
                return;
            }
        });
    }

    function HistoryNode(config) {

        RED.nodes.createNode(this, config);

        var node = this;
        node.serverConfig = RED.nodes.getNode(config.serverConfig);

        node.on('input', function (msg, send, done) {
            onInput(node, config, msg);
        });
        node.status({ fill: "blue", shape: "dot", text: "Ready" });
    }
    RED.nodes.registerType("Niagara Obix History", HistoryNode);
}