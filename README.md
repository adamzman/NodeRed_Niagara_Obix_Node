# Node-RED Obix Niagara Connector:

Links Node-RED to a Niagara Station through the Obix Protocol.

- **Can read and write ('out' and 'set' slots) to control points under Drivers (in the Niagara Tree)**
- **Can read histories**
- **Can setup watchers which poll several points at a time on an interval**

## Obix - Niagara Setup:

To set up Obix in Niagara...

1. Open the obixDriver module from the palette.
2. Drag in the Obix Network (from the palette) into the station's driver folder.
   ![ObixDriverSetup](https://github.com/adamz0210/NodeRed_Niagara_Obix_Node/blob/master/images/ObixDriverSetup.jpg?raw=true 'ObixDriverSetup')
3. Open the baja module from the palette.
4. Insert the HTTPBasicScheme `(baja -> AuthenticationSchemes -> WebServicesSchemes)` into the Authentication Service in the Services folder `(Config -> Services -> AuthenticationService -> Authentication Schemes)`.
   ![HTTPBasicSetup](https://github.com/adamz0210/NodeRed_Niagara_Obix_Node/blob/master/images/HTTPBasicSetup.jpg?raw=true 'HTTPBasicSetup')
5. Create a new user with an assigned role (role must have correct permissions to read/write to any points or histories), and select the HTTPBasicScheme for the Authentication Scheme Name.
   - It is recommended to enable `Auto Logoff` with a short time period, or disabling `Allow Concurrent Sessions`, to reduce the amount of obix sessions Niagara has to manage.
     ![UserSetup](https://github.com/adamz0210/NodeRed_Niagara_Obix_Node/blob/master/images/UserSetup.jpg?raw=true 'UserSetup')

## Nodes

- [Connector](Connector/README.md)
- [History Node](History/README.md)
- [Variable Node](Variable/README.md)
- [Watcher Node](Watcher/README.md)
