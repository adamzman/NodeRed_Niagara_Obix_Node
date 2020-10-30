module.exports = function(RED) {
    function HistoryNode(config) {
        RED.nodes.createNode(this,config);
        const node = this;
        // Library for TCP Ping, to verify if port is open before connecting
        const tcpie = require('tcpie');
        const axios = require("axios");
        const convert = require('xml-js');
        const moment = require('moment-timezone');

        // Connecting Configuration Node
        node.serverConfig = RED.nodes.getNode(config.serverConfig);

        node.on('input', async function(msg) {

            if(node.serverConfig){

                var apiUsername = null;
                var apiPassword = null;
                var apiIpAddress = null;
                var apiHttpPort = null;
                var apiPath = null;
                var apiHistoryQuery;
                var apiPresetQuery;
                var presetOptions = ["yesterday", "last24Hours", "weekToDate", "lastWeek", "last7Days", "monthToDate", "lastMonth", "yearToDate (limit=1000)", "lastYear (limit=1000)", "unboundedQuery"];
                
                // If msg was sent through API Request
                try{
                    if(msg.req){
                        // If API is sent with query parameters
                        if(JSON.stringify(msg.payload) !== '{}'){
                            apiUsername = msg.payload.username || null;
                            apiPassword = msg.payload.password || null;
                            apiIpAddress = msg.payload.ipAddress || null;
                            apiHttpPort = msg.payload.httpPort || null;
                            apiPath = msg.payload.path || null;
                            apiPresetQuery = msg.payload.presetQuery || null;
    
                            // History Query Parameters
                            if(msg.payload.start || msg.payload.end || msg.payload.limit){
                                apiHistoryQuery = {};
                                msg.payload.start ? apiHistoryQuery.start = msg.payload.start : null;
                                msg.payload.end ? apiHistoryQuery.end = msg.payload.end : null;
                                msg.payload.limit ? apiHistoryQuery.limit = msg.payload.limit : null;
                            }
                        }
                    }
                }catch(error){
                    throwError(node, msg, "Error with API Call: " + error, "red", "dot", "Error with API Call");
                    return;
                }

                // Setting all variables if passed in, if not, we will use the preset values
                username = apiUsername || msg.username || node.serverConfig.username;
                password = apiPassword || msg.password || node.serverConfig.password;
                ipAddress = apiIpAddress || msg.ipAddress || node.serverConfig.host;
                httpPort = apiHttpPort || msg.httpPort || node.serverConfig.port;
                path = apiPath || msg.path || config.path;
                historyQuery = apiHistoryQuery || msg.historyQuery || null;
                presetQuery = apiPresetQuery || config.presetQuery;
                const presetCheck = (val) => val === presetQuery;
                
                // If missing a configuration variable, return error
                if(!username){ throwError(node, msg, "Invalid Parameters : Missing Obix Username", "red", "ring", "Missing Username"); return; }
                if(!password){ throwError(node, msg, "Invalid Parameters : Missing Obix Password", "red", "ring", "Missing Password"); return; }
                if(!ipAddress){ throwError(node, msg, "Invalid Parameters : Missing Niagara IP Address", "red", "ring", "Missing IP Address"); return; }
                if(!httpPort){ throwError(node, msg, "Invalid Parameters : Missing Niagara HTTP Port", "red", "ring", "Missing HTTP Port"); return; }
                if(!path){ throwError(node, msg, "Invalid Parameters : Missing History Path", "red", "ring", "Missing History Path"); return; }
                if(!presetOptions.some(presetCheck)){ throwError(node, msg, "Invalid Parameters : PresetQuery Value Invalid", "red", "ring", "PresetQuery Value Invalid"); return; }
                
                // Slice '/' from the path if it exists
                path.charAt(path.length - 1) == '/' ? path = path.slice(0, -1) : null;
                path.charAt(0) == '/' ? path = path.slice(1) : null;
                
                // Used to pass in config into functions easily
                var userConfig = {
                    "username": username,
                    "password": password,
                    "ipAddress": ipAddress,
                    "httpPort": httpPort,
                    "path": path,
                };

                // Pinging to ensure Connection Exists
                try {
                    const ping = tcpie(ipAddress, Number(httpPort), {count: 1, interval: 1, timeout: 500})
                    pingStatus = await tcpPing(node, msg, ping, userConfig);
                    if(!pingStatus) return;
                } catch(error) {
                    throwError(node, msg, "Error with TCP Ping: " + error, "red", "dot", "Error with TCP Ping");
                    return;
                }

                // Check if passed in custom history query, if not, we will use the preset that is selected
                if(historyQuery){

                    // Check Custom Query Dates... Ensure they are valid
                    if(historyQuery.start){
                        // Format into Date and check if it is valid
                        start = new Date(historyQuery.start);
                        if(start.getTime()){
                            // If valid, set to the proper format needed by the API
                            historyQuery.start = start.toISOString();
                        }else{
                            throwError(node, msg, "HistoryQuery Start is an Invalid Timestamp", "red", "ring", "HistoryQuery Start is an Invalid Timestamp");
                            return;
                        }
                    }
                    if(historyQuery.end){
                        // Format into Date and check if it is valid
                        end = new Date(historyQuery.end);
                        if(end.getTime()){
                            // If valid, set to the proper format needed by the API
                            historyQuery.end = end.toISOString();
                        }else{
                            throwError(node, msg, "HistoryQuery End is an Invalid Timestamp", "red", "ring", "HistoryQuery End is an Invalid Timestamp");
                            return;
                        }
                    }

                    // Fetch for Custom Query
                    try{
                        url = "http://" + ipAddress + ":" + httpPort + "/obix/histories/" + path + "/~historyQuery/";
                        const response = await axios.get(url, { params: historyQuery, auth: {username: username, password: password} });
                        var data = convert.xml2js(response.data, {compact: true, spaces: 4});

                        if(data.err){
                            data.err._attributes.is == "obix:BadUriErr" ? status = "Invalid History Path" : status = "Unknown Error";
                            throwError(node, msg, "Error in Preset Query Search: " + status, "red", "dot", status);
                            return;
                        }
                    }catch(error){
                        if(String(error).includes("404")){throwError(node, msg, "Error Invalid IP/Port: " + error, "red", "dot", "Invalid IP/Port"); return;}
                        if(String(error).includes("401")){throwError(node, msg, "Error Invalid Credentials: " + error, "red", "dot", "Invalid Credentials"); return;}

                        throwError(node, msg, "Error with Custom History Query Fetch: " + error, "red", "dot", "Error with Custom History Query Fetch");
                        return;
                    }

                }else{
                    historyQuery = "";
                    presetQueryParameter = "";
                    url = "http://" + ipAddress + ":" + httpPort + "/obix/histories/" + path + "/";

                    // Fetch for Preset Query
                    try{
                        // Make Fetch to get the preset query
                        const response = await axios.get(url, { auth: {username: username, password: password} });
                        var data = convert.xml2js(response.data, {compact: true, spaces: 4});

                        // Check if Error Occurred
                        if(data.err){
                            data.err._attributes.is == "obix:BadUriErr" ? status = "Invalid History Path" : status = "Unknown Error";
                            throwError(node, msg, "Error in Preset Query Search: " + status, "red", "dot", status);
                            return;
                        }else{
                            // If previous request was successful, then append the preset history query to the new request                            
                            for(i = 0; i < data.obj.ref.length; i++){
                                if(data.obj.ref[i]._attributes.name == presetQuery){
                                    presetQueryParameter = data.obj.ref[i]._attributes.href;
                                    break;
                                }
                                if(i >= (data.obj.ref.length - 1)){
                                    throwError(node, msg, "Error in Preset Query Search: Invalid History Path", "red", "dot", "Invalid History Path");
                                    return;
                                }
                            }
                            url = url + presetQueryParameter;
                        }

                        // Fetch with preset query
                        const response2 = await axios.get(url, { auth: {username: username, password: password} });
                        var data = convert.xml2js(response2.data, {compact: true, spaces: 4});

                    }catch(error){
                        if(String(error).includes("404")){throwError(node, msg, "Error Invalid IP/Port: " + error, "red", "dot", "Invalid IP/Port"); return;}
                        if(String(error).includes("401")){throwError(node, msg, "Error Invalid Credentials: " + error, "red", "dot", "Invalid Credentials"); return;}

                        throwError(node, msg, "Error with Preset History Query Fetch: " + error, "red", "dot", "Error with Preset History Query Fetch");
                        return;
                    }
                }

                // After the Requests are made, and the JSON data is returned...
                try{
                    value = [];
                    timezone = data.obj.abstime[0]._attributes.tz;
                    limit = data.obj.int._attributes.val;
                    start = moment(data.obj.abstime[0]._attributes.val).tz(timezone).format('LLLL z');
                    end = moment(data.obj.abstime[1]._attributes.val).tz(timezone).format('LLLL z');
                    
                    for(i = 0; i < Number(limit); i++){
                        value[i] = {
                            "Timestamp": moment(data.obj.list.obj[i].abstime._attributes.val).tz(timezone).format('LLLL z'),
                            // "Value": String(Number(data.obj.list.obj[i].real._attributes.val).toFixed(1))
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
                }catch(error){
                    throwError(node, msg, "Error with History Parsing: " + error, "red", "dot", "Error with History Parsing");
                    return;
                }
            }
            else{
                throwError(node, msg, "No Config Node Set (If Passing in config variables from msg, Configure a blank config node)", "red", "ring", "No Config Set");
                return;
            }

            node.status({fill:"green",shape:"dot",text:"Success"});
            node.send(msg);
        });

        node.status({fill: "blue", shape: "dot", text: "ready"});
    }

    function tcpPing(node, msg, ping, userConfig){
        return new Promise(function(resolve) {
            ping.on('end', function(stats) {
                pingResults = stats;
                // If Ping Fails, throw error and exit
                if(!(pingResults.success >= 1)){ 
                    errorMsg = "Error: Host Unreachable - " + userConfig.ipAddress + ":" + userConfig.httpPort;
                    throwError(node, msg, errorMsg, "red", "ring", errorMsg); 
                    resolve(false);
                }else{
                    resolve(true);
                }
            }).start();
        });
    }

    function throwError(node, msg, err, color, shape, status){
        node.error(err, msg);
        node.status({fill: color, shape: shape, text: status});
        msg.payload = err;
        node.send(msg);
    }

    RED.nodes.registerType("Niagara Obix History", HistoryNode);
}