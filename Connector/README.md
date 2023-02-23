## Niagara Obix Connector Node

> **ENSURE README IS FOR CORRECT VERSION OF PACKAGE**

Holds the configuration values for the Niagara Obix Nodes.

- **Use Settings Credentials** - Toggles whether to use built in username and password fields, or use the username and password from the Node-RED settings file.
- **Key** - Key that is used grab the username and password from the Node-RED settings file.
- **Username** - Obix user that has been set up in Niagara using the HTTPBasic Authentication Schema... obix user must have a role with the correct permissions to read/write to any points or histories.
- **Password** - Password for obix user.
- **IP Address** - IP Address of the Niagara station.
- **Protocol** - Protocol used by the Niagara web service... HTTPS/HTTP must be enabled in the web services.
- **Port** - Port used by the Niagara web service... port must be exposed on the Niagara Machine (Unless accessing from localhost only)

Example settings file credentials:

```
...
niagaraObix: {
  key1: {
    username: 'obixExample1',
    password: 'obixPassword1',
  },
  key2: {
    username: 'obixExample2',
    password: 'obixPassword2',
  },
},
...
```
