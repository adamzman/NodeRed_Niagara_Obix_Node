module.exports = function(RED) {
    function VariableNode(config) {
        RED.nodes.createNode(this,config);
        const node = this;
        // Library for TCP Ping, to verify if port is open before connecting
        const tcpie = require('tcpie');
        const axios = require("axios");
        const convert = require('xml-js');

        // Connecting Configuration Node
        node.serverConfig = RED.nodes.getNode(config.serverConfig);
        
        this.on('input', async function(msg, send, done) {

            if(node.serverConfig){

                // Setting all variables if passed in, if not, we will use the preset values
                username = msg.username || node.serverConfig.username;
                password = msg.password || node.serverConfig.password;
                ipAddress = msg.ipAddress || node.serverConfig.host;
                httpsPort = msg.httpsPort || node.serverConfig.port;
                path = msg.path || config.path;
                action = msg.method || config.action;
                value = msg.value || config.value;

                // If missing a configuration variable, return error
                if(!username){ throwError(node, msg, "Invalid Parameters : Missing Obix Username", "red", "ring", "Missing Username"); return; }
                if(!password){ throwError(node, msg, "Invalid Parameters : Missing Obix Password", "red", "ring", "Missing Password"); return; }
                if(!ipAddress){ throwError(node, msg, "Invalid Parameters : Missing Niagara IP Address", "red", "ring", "Missing IP Address"); return; }
                if(!httpsPort){ throwError(node, msg, "Invalid Parameters : Missing Niagara HTTPS Port", "red", "ring", "Missing HTTPS Port"); return; }
                if(!path){ throwError(node, msg, "Invalid Parameters : Missing Variable Path", "red", "ring", "Missing Variable Path"); return; }
                if((!value) && (action == "POST")){ throwError(node, msg, "Invalid Parameters : Missing Write Value", "red", "ring", "Missing Write Value"); return; }
                
                // Slice '/' from the path if it exists
                path.charAt(path.length - 1) == '/' ? path = path.slice(0, -1) : null;
                path.charAt(0) == '/' ? path = path.slice(1) : null;
                
                // Used to pass in config into functions easily
                var userConfig = {
                    "username": username,
                    "password": password,
                    "ipAddress": ipAddress,
                    "httpsPort": httpsPort,
                    "path": path,
                    "action": action,
                    "value": value,
                };

                // Pinging to ensure Connection Exists
                try {
                    const ping = tcpie(ipAddress, Number(httpsPort), {count: 1, interval: 1, timeout: 500})
                    pingStatus = await tcpPing(node, msg, ping, userConfig);
                    if(!pingStatus) return;
                } catch(error) {
                    throwError(node, msg, "Error with TCP Ping: " + error, "red", "dot", "Error with TCP Ping");
                    return;
                }

                // Fetch for Variable
                try{
                    // Set Fetch parameters
                    if(action == "POST"){
                        var apiCallConfig = {
                            method: 'post',
                            url: "https://" + ipAddress + ":" + httpsPort + "/obix/config/" + path + "/set/",
                            auth: {
                                username: username, 
                                password: password
                            },
                            data : '<real val="' + value + '"/>'
                        };
                    }else{
                        var apiCallConfig = {
                            method: 'get',
                            url: "https://" + ipAddress + ":" + httpsPort + "/obix/config/" + path + "/out/",
                            auth: {
                                username: username, 
                                password: password
                            }
                        };
                    }
                    
                    // Variable Fetch
                    var response = await axios(apiCallConfig);
                    var data = convert.xml2js(response.data, {compact: true, spaces: 4});
                    
                    if(data.err){
                        data.err._attributes.is == "obix:BadUriErr" ? status = "Invalid Variable Path" : status = "Unknown Error";
                        data.err._attributes.display.includes("Invalid") ? status = "Invalid Data Type" : null;
                        throwError(node, msg, "Error in Preset Query Search: " + status, "red", "dot", status);
                        return;
                    }

                }catch(error){
                    if(String(error).includes("404")){throwError(node, msg, "Error Invalid IP/Port: " + error, "red", "dot", "Invalid IP/Port"); return;}
                    if(String(error).includes("401")){throwError(node, msg, "Error Invalid Credentials: " + error, "red", "dot", "Invalid Credentials"); return;}
                    
                    throwError(node, msg, "Error with Variable Fetch: " + error, "red", "dot", "Error with Variable Fetch");
                    return;
                }

                // After the Request is made, and the JSON data is returned...
                try{     
                    if(data.enum){ value = data.enum._attributes.val; }
                    else if(data.bool){ value = data.bool._attributes.val; }
                    else if(data.str){ value = data.str._attributes.val; }
                    else if(data.real){ value = data.real._attributes.val; }
                    else{ throwError(node, msg, "Error with Variable Parsing, Can't Find Data Type", "red", "dot", "Error with Variable Parsing"); return; }
                    msg.payload = {
                        "Variable": path,
                        "Value": value,
                    };
                }catch(error){
                    throwError(node, msg, "Error with Variable Parsing: " + error, "red", "dot", "Error with Variable Parsing");
                    return;
                }
                
            }
            else{
                throwError(node, msg, "No Config Node Set (If Passing in config variables from msg, Configure a blank config node)", "red", "ring", "No Config Set");
                return;
            }

            node.status({fill:"green",shape:"dot",text:"Success"});
            node.send(msg);
            
            if (done) {
                done();
            }
        });
    }

    function tcpPing(node, msg, ping, userConfig){
        return new Promise(function(resolve) {
            ping.on('end', function(stats) {
                pingResults = stats;
                // If Ping Fails, throw error and exit
                if(!(pingResults.success >= 1)){ 
                    errorMsg = "Error: Host Unreachable - " + userConfig.ipAddress + ":" + userConfig.httpsPort;
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

    RED.nodes.registerType("Niagara Obix Variable", VariableNode);
}