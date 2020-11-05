module.exports = function(RED) {
    function VariableNode(config) {
        RED.nodes.createNode(this,config);
        const node = this;
        var context = this.context();
        const axios = require("axios");
        const convert = require('xml-js');
        const https = require('https');

        // Connecting Configuration Node
        node.serverConfig = RED.nodes.getNode(config.serverConfig);
        
        this.on('input', function(msg, send, done) {

            if(node.serverConfig){

                // Setting all variables if passed in, if not, we will use the preset values
                context.set('username', msg.username || node.serverConfig.username);
                context.set('password', msg.password || node.serverConfig.password);
                context.set('ipAddress', msg.ipAddress || node.serverConfig.host);
                context.set('httpsPort', msg.httpsPort || node.serverConfig.port);
                context.set('path', msg.path || config.path);
                context.set('action', msg.method || config.action);
                context.set('value', msg.value || config.value);

                // If missing a configuration variable, return error
                if(!context.get('username')){ throwError(msg, "Invalid Parameters : Missing Obix Username", "red", "ring", "Missing Username"); return; }
                if(!context.get('password')){ throwError(msg, "Invalid Parameters : Missing Obix Password", "red", "ring", "Missing Password"); return; }
                if(!context.get('ipAddress')){ throwError(msg, "Invalid Parameters : Missing Niagara IP Address", "red", "ring", "Missing IP Address"); return; }
                if(!context.get('httpsPort')){ throwError(msg, "Invalid Parameters : Missing Niagara HTTPS Port", "red", "ring", "Missing HTTPS Port"); return; }
                if(!context.get('path')){ throwError(msg, "Invalid Parameters : Missing Variable Path", "red", "ring", "Missing Variable Path"); return; }
                if((!context.get('value')) && (context.get('action') == "POST")){ throwError(msg, "Invalid Parameters : Missing Write Value", "red", "ring", "Missing Write Value"); return; }
                
                // Slice '/' from the path if it exists
                context.get('path').charAt(context.get('path').length - 1) == '/' ? context.set('path', context.get('path').slice(0, -1)) : null;
                context.get('path').charAt(0) == '/' ? context.set('path', context.get('path').slice(1)) : null;

                // Set Fetch parameters
                if(context.get('action') == "POST"){
                    var apiCallConfig = {
                        method: 'post',
                        url: "https://" + context.get('ipAddress') + ":" + context.get('httpsPort') + "/obix/config/" + context.get('path') + "/set/",
                        auth: {
                            username: context.get('username'), 
                            password: context.get('password')
                        },
                        httpsAgent: new https.Agent({ rejectUnauthorized: false }),
                        data : '<real val="' + context.get('value') + '"/>'
                    };
                }else{
                    var apiCallConfig = {
                        method: 'get',
                        url: "https://" + context.get('ipAddress') + ":" + context.get('httpsPort') + "/obix/config/" + context.get('path') + "/out/",
                        auth: {
                            username: context.get('username'), 
                            password: context.get('password')
                        },
                        httpsAgent: new https.Agent({ rejectUnauthorized: false }),
                    };
                }

                axios(apiCallConfig)
                .then(function (response) {
                    // Convert Response to JSON
                    var data = convert.xml2js(response.data, {compact: true, spaces: 4});

                    if(data.err){
                        data.err._attributes.is == "obix:BadUriErr" ? status = "Invalid Variable Path" : status = "Unknown Error";
                        data.err._attributes.display.includes("Invalid") ? status = "Invalid Data Type" : null;
                        throwError(msg, "Error in Preset Query Search: " + status, "red", "dot", status);
                        return;
                    }

                    // After the Request is made, and the JSON data is returned...
                    try{     
                        if(data.enum){ context.set('value', data.enum._attributes.val) }
                        else if(data.bool){ context.set('value', data.bool._attributes.val) }
                        else if(data.str){ context.set('value', data.str._attributes.val) }
                        else if(data.real){ context.set('value', data.real._attributes.val) }
                        else{ throwError(msg, "Error with Variable Parsing, Can't Find Data Type", "red", "dot", "Error with Variable Parsing"); return; }
                        msg.payload = {
                            "Variable": context.get('path'),
                            "Value": context.get('value'),
                        };
                    }catch(error){
                        throwError(msg, "Error with Variable Parsing: " + error, "red", "dot", "Error with Variable Parsing");
                        return;
                    }

                    node.status({fill:"green",shape:"dot",text:"Success"});
                    node.send(msg);

                }).catch(function (error) {
                    if(String(error).includes("404")){throwError(msg, "Error Invalid IP/Port: " + error, "red", "dot", "Invalid IP/Port"); return;}
                    if(String(error).includes("401")){throwError(msg, "Error Invalid Credentials: " + error, "red", "dot", "Invalid Credentials"); return;}
                    throwError(msg, "Error with Variable Fetch: " + error, "red", "dot", "Error with Variable Fetch");
                    return;
                })
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
    }
    RED.nodes.registerType("Niagara Obix Variable", VariableNode);
}