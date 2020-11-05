module.exports = function(RED) {
    function HistoryNode(config) {
        RED.nodes.createNode(this,config);
        const node = this;
        var context = this.context();
        const axios = require("axios");
        const https = require('https');
        const convert = require('xml-js');
        const moment = require('moment-timezone');

        // Connecting Configuration Node
        node.serverConfig = RED.nodes.getNode(config.serverConfig);

        node.on('input', function(msg, send, done) {

            if(node.serverConfig){

                var presetOptions = ["yesterday", "last24Hours", "weekToDate", "lastWeek", "last7Days", "monthToDate", "lastMonth", "yearToDate (limit=1000)", "lastYear (limit=1000)", "unboundedQuery"];
                
                // Setting all variables if passed in, if not, we will use the preset values
                context.set('username', msg.username || node.serverConfig.username);
                context.set('password', msg.password || node.serverConfig.password);
                context.set('ipAddress', msg.ipAddress || node.serverConfig.host);
                context.set('httpsPort', msg.httpsPort || node.serverConfig.port);
                context.set('path', msg.path || config.path);
                context.set('historyQuery', msg.historyQuery || null);
                context.set('presetQuery', msg.presetQuery || config.presetQuery);
                const presetCheck = (val) => val === context.get('presetQuery');

                
                // If missing a configuration variable, return error
                if(!context.get('username')){ throwError(msg, "Invalid Parameters : Missing Obix Username", "red", "ring", "Missing Username"); return; }
                if(!context.get('password')){ throwError(msg, "Invalid Parameters : Missing Obix Password", "red", "ring", "Missing Password"); return; }
                if(!context.get('ipAddress')){ throwError(msg, "Invalid Parameters : Missing Niagara IP Address", "red", "ring", "Missing IP Address"); return; }
                if(!context.get('httpsPort')){ throwError(msg, "Invalid Parameters : Missing Niagara HTTPS Port", "red", "ring", "Missing HTTPS Port"); return; }
                if(!context.get('path')){ throwError(msg, "Invalid Parameters : Missing History Path", "red", "ring", "Missing History Path"); return; }
                if(!presetOptions.some(presetCheck)){ throwError(msg, "Invalid Parameters : PresetQuery Value Invalid", "red", "ring", "PresetQuery Value Invalid"); return; }
                
                // Slice '/' from the path if it exists
                context.get('path').charAt(context.get('path').length - 1) == '/' ? context.get('path') = context.get('path').slice(0, -1) : null;
                context.get('path').charAt(0) == '/' ? context.get('path') = context.get('path').slice(1) : null;

                // Check if passed in custom history query, if not, we will use the preset that is selected
                if(context.get('historyQuery')){

                    // Check Custom Query Dates... Ensure they are valid
                    if(context.get('historyQuery.start')){
                        // Format into Date and check if it is valid
                        start = new Date(context.get('historyQuery.start'));
                        if(start.getTime()){
                            // If valid, set to the proper format needed by the API
                            context.set('historyQuery.start', start.toISOString());
                        }else{
                            throwError(msg, "HistoryQuery Start is an Invalid Timestamp", "red", "ring", "HistoryQuery Start is an Invalid Timestamp");
                            return;
                        }
                    }
                    if(context.get('historyQuery.end')){
                        // Format into Date and check if it is valid
                        end = new Date(context.get('historyQuery.end'));
                        if(end.getTime()){
                            // If valid, set to the proper format needed by the API
                            context.set('historyQuery.end', end.toISOString());
                        }else{
                            throwError(msg, "HistoryQuery End is an Invalid Timestamp", "red", "ring", "HistoryQuery End is an Invalid Timestamp");
                            return;
                        }
                    }

                    url = "https://" + context.get('ipAddress') + ":" + context.get('httpsPort') + "/obix/histories/" + context.get('path') + "/~historyQuery/";

                    axios.get(url, { params: context.get('historyQuery'), auth: {username: context.get('username'), password: context.get('password')}, httpsAgent: new https.Agent({ rejectUnauthorized: false }), })
                    .then(function (response) {
                        // Convert Response to JSON
                        var data = convert.xml2js(response.data, {compact: true, spaces: 4});

                        if(data.err){
                            data.err._attributes.is == "obix:BadUriErr" ? status = "Invalid History Path" : status = "Unknown Error";
                            throwError(msg, "Error in Preset Query Search: " + status, "red", "dot", status);
                            return;
                        }

                        msg = parseData(msg, data);
                        node.status({fill:"green",shape:"dot",text:"Success"});
                        node.send(msg);
                        
                    }).catch(function (error) {
                        if(String(error).includes("404")){throwError(msg, "Error Invalid IP/Port: " + error, "red", "dot", "Invalid IP/Port"); return;}
                        if(String(error).includes("401")){throwError(msg, "Error Invalid Credentials: " + error, "red", "dot", "Invalid Credentials"); return;}
                        throwError(msg, "Error with Custom History Query Fetch: " + error, "red", "dot", "Error with Custom History Query Fetch");
                        return;
                    })
                }else{
                    context.set('historyQuery', "");
                    presetQueryParameter = "";
                    url = "https://" + context.get('ipAddress') + ":" + context.get('httpsPort') + "/obix/histories/" + context.get('path') + "/";

                    // Fetch for Preset Query
                    axios.get(url, { auth: {username: context.get('username'), password: context.get('password')}, httpsAgent: new https.Agent({ rejectUnauthorized: false }), })
                    .then(function (response) {
                        // Convert Response to JSON
                        var data = convert.xml2js(response.data, {compact: true, spaces: 4});
    
                        // Check if Error Occurred
                        if(data.err){
                            data.err._attributes.is == "obix:BadUriErr" ? status = "Invalid History Path" : status = "Unknown Error";
                            throwError(msg, "Error in Preset Query Search: " + status, "red", "dot", status);
                            return;
                        }else{
                            // If previous request was successful, then append the preset history query to the new request                            
                            for(i = 0; i < data.obj.ref.length; i++){
                                if(data.obj.ref[i]._attributes.name == context.get('presetQuery')){
                                    presetQueryParameter = data.obj.ref[i]._attributes.href;
                                    break;
                                }
                                if(i >= (data.obj.ref.length - 1)){
                                    throwError(msg, "Error in Preset Query Search: Invalid History Path", "red", "dot", "Invalid History Path");
                                    return;
                                }
                            }
                            url = url + presetQueryParameter;
                        }

                        axios.get(url, { auth: {username: context.get('username'), password: context.get('password')}, httpsAgent: new https.Agent({ rejectUnauthorized: false }), })
                        .then(function (response) {
                            // Convert Response to JSON
                            var data = convert.xml2js(response.data, {compact: true, spaces: 4});
                            msg = parseData(msg, data);
                            node.status({fill:"green",shape:"dot",text:"Success"});
                            node.send(msg);
                            
                        }).catch(function (error) {
                            throwError(msg, "Error: " + error, "red", "dot", "Error");
                            return;
                        })
                    }).catch(function (error) {
                        if(String(error).includes("404")){throwError(msg, "Error Invalid IP/Port: " + error, "red", "dot", "Invalid IP/Port"); return;}
                        if(String(error).includes("401")){throwError(msg, "Error Invalid Credentials: " + error, "red", "dot", "Invalid Credentials"); return;}
                        throwError(msg, "Error with Preset History Query Fetch: " + error, "red", "dot", "Error with Preset History Query Fetch");
                        return;
                    })
                }
            }
            else{
                throwError(msg, "No Config Node Set (If Passing in config variables from msg, Configure a blank config node)", "red", "ring", "No Config Set");
                return;
            }

            if (done) {
                done();
            }
        });

        function throwError(msg, err, color, shape, status){
            node.error(err, msg);
            node.status({fill: color, shape: shape, text: status});
            msg.payload = err;
            node.send(msg);
        }

        function parseData(msg, data) {
            // After the Requests are made, and the JSON data is returned...
            value = [];
            timezone = data.obj.abstime[0]._attributes.tz;
            limit = data.obj.int._attributes.val;
            start = moment(data.obj.abstime[0]._attributes.val).tz(timezone).format('LLLL z');
            end = moment(data.obj.abstime[1]._attributes.val).tz(timezone).format('LLLL z');
            
            for(i = 0; i < Number(limit); i++){
                value[i] = {
                    "Timestamp": moment(data.obj.list.obj[i].abstime._attributes.val).tz(timezone).format('LLLL z'),
                    "Value": String(data.obj.list.obj[i].real._attributes.val)
                }
            }

            msg.payload = {
                "History": context.get('path'),
                "Start": start,
                "End": end,
                "Limit": limit,
                "Timezone": timezone,
                "Results": value,
            };

            return msg;
        }
    }


    RED.nodes.registerType("Niagara Obix History", HistoryNode);
}