# Node Red Obix - Niagara Connector:

Links Node-Red to a Niagara Station through the Obix Protocol. **Only used for basic read and write ('out' and 'set') to control points under Drivers (in the Niagara Tree). And can read histories using the History Connector**

### Obix - Niagara Setup:

To set up Obix in Niagara...

1. Open the obixDriver module from the palette.
2. Drag in the Obix Network (from the palette) into the station's driver folder.
   ![ObixDriverSetup](ObixDriverSetup.jpg?raw=true "ObixDriverSetup")
3. Open the baja module from the palette.
4. Insert the HTTPBasicScheme `(baja -> AuthenticationSchemes -> WebServicesSchemes)` into the Authentication Service in the Services folder `(Config -> Services -> AuthenticationService -> Authentication Schemes)`.
   ![HTTPBasicSetup](HTTPBasicSetup.jpg?raw=true "HTTPBasicSetup")
5. Create a new user with an admin role, and select the HTTPBasicScheme for the Authentication Scheme Name.
   ![UserSetup](UserSetup.jpg?raw=true "UserSetup")

# Nodes

## Niagara Obix Connector Node

Holds the configuration values for the Niagara Obix Nodes

-   **Username** - Set to the Obix User that has been set up in Niagara using the HTTPBasic Authentication Schema... Obix User must also be set to admin role.
-   **Password** - Password for the Obix User.
-   **IP Address** - IP Address of the Niagara Station.
-   **HTTPS/HTTP Port** - HTTPS/HTTP Port for the Niagara Station... HTTPS/HTTP must be enabled in the Web Services, and the Port must be exposed on the Niagara Machine (Unless accessing from localhost only).

## Niagara Obix History Node

Returns Histories from the connected Niagara Station

-   **Path** - Used to indicate which history you want to interact with... Path starts after histories... ex. histories/TestHistories/History, only take "TestHistories/History".
-   **Preset Query** - Preset history queries. Can be overridden with a custom query by passing in msg.historyQuery (More details below).

### Dynamic Values

Each instance of the Niagara Obix Node can have its values inserted dynamically. Each dynamic value has the same functionality as the values above. Passing the following values will **override** the default values you may pre-configured.

-   `msg.username` -> Username (String)
-   `msg.password` -> Password (String)
-   `msg.host` -> IP Address (String)
-   `msg.protocol` -> 'https' or 'http' (String)
-   `msg.port` -> HTTPS/HTTP Port (Number)
-   `msg.path` -> Path (String)
-   `msg.historyQuery` -> History Query (Overrides the PresetQuery Selection) (JSON Object : See formatting options below)
-   `msg.presetQuery` -> Use a Preset History Query (Overrides the PresetQuery Selection) (String : Values must be one of the following)

    -   "yesterday"
    -   "last24Hours"
    -   "weekToDate"
    -   "lastWeek"
    -   "last7Days"
    -   "monthToDate"
    -   "lastMonth"
    -   "yearToDate (limit=1000)"
    -   "lastYear (limit=1000)"
    -   "unboundedQuery"

-   **msg.historyQuery** - Used to specify what time period and how many records you want to read from a history...
    -   Basic Query format `{"start": "2020-10-11T12:40:05-04:00", "end": "2020-10-14T12:40:05-04:00", "limit": "2"}`.
    -   Start and end are the periods of reading data, and the limit is the number of records returned.
    -   If there are more records than the limit allows, then it returns the number of records starting from the start time.

## Niagara Obix Variable Node

Returns/Writes points to the Niagara using the obix protocol. **Can only read the 'out' value of a control point, and write to the 'set' value.**

-   **Path** - Used to indicate which variable/point you want to interact with... Path starts after config... ex. config/TestFolder/TestPoint, only take "TestFolder/TestPoint".
-   **Action** - Pick whether you want to read or write to a specific variable/point in the station's config folder.
-   **Value** - If `Action` is set to `Write`, this is the default value that will be written to the point specified in the path.

### Dynamic Values

Each instance of the Niagara Obix Node can have its values inserted dynamically. Each dynamic value has the same functionality as the values above. Passing the following values will **override** the default values you may pre-configured.

-   `msg.username` -> Username (String)
-   `msg.password` -> Password (String)
-   `msg.host` -> IP Address (String)
-   `msg.protocol` -> 'https' or 'http' (String)
-   `msg.port` -> HTTPS/HTTP Port (Number)
-   `msg.path` -> Path to Variable (String)
-   `msg.action` -> 'read' or 'write' (String)
-   `msg.value` -> Default Value (String, Boolean, or Number)

## Niagara Obix Watcher Node

Watches several points and returns an array of values. **Will read the 'out' value of the path**
The inject button is similar to redeploying node red. It just restarts the poll.

-   **Topic** - The topic for the msg output (optional).
-   **Poll Rate** - The interval at which points are returned. Must be 5 or more seconds.
-   **Relativize** - The path to be prepended to the configured paths below. (optional, will only prepend to paths that have the Relativized checkbox checked)
-   **Search Paths** - Searches through the list of paths that are configured below.
-   **Paths** - The list of paths that are returned on each pull. Add a new Path by clicking the "Add New Path" and Delete a path by clicking the "x" next to the path. You can also sort the list by clicking the sort button or dragging the three bars next to the path. The duplicate button does duplicates the values of that row to a new row.

![Example of Niagara Tree](Watcher/niagara.jpg?raw=true "Example of Niagara Tree")
![Example of Node Red configuration](Watcher/nodered.jpg?raw=true "Example of Node Red configuration")
