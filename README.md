## Function: 
Links Node-Red to a Niagara Station through the Obix Protocol.

## Obix - Niagara Setup: 
To set up Obix in Niagara... 
1. Open the obixDriver module from the palette.
2. Drag in the Obix Network (from the palette) into the stations driver folder. 
3. Open the baja module from the palette.
4. Insert the HTTPBasicScheme `(baja -> AuthenticationSchemes -> WebServicesSchemes)` into the Authentication Service in the Services folder `(Config -> Services -> AuthenticationService -> Authentication Schemes)`. 
5. Create a new user with an admin role, and select the HTTPBasicScheme for the Authentication Scheme Name. 
**OBIX uses HTTP only, so HTTP must be enabled and opened in the firewall.**
<!-- Add Pictures -->
---
---

# Niagara Obix History Node
### Config Node:
 - **Username** - Set to the Obix User that has been set up in Niagara using the HTTPBasic Authentication Schema... Obix User must also be set to admin role.
 - **Password** - Password for the Obix User.
 - **IP Address** - IP Address of the Niagara Station.
 - **HTTP Port** - HTTP Port for the Niagara Station... HTTP must be enabled and HTTPS Only must be disabled in the Web Services, and the Port must be exposed on the Niagara Machine (Unless accessing from localhost only).
 
### Additional Fields:
 - **Path** - Used to indicate which history you want to interact with... Path starts after histories... ex. histories/TestHistories/History, only take "TestHistories/History".
 - **Preset Query** - Preset history queries. Can be overridden with a custom query by passing in msg.historyQuery (More details below).
---

### Dynamic Values
Each instance of the Niagara Obix Node can have its values inserted dynamically. Each dynamic value has the same functionality as the values above. Passing the following values will **override** the default values you may pre-configured. 

 - `msg.username` -> Username (String)
 - `msg.password` -> Password (String)
 - `msg.ipAddress` -> IP Address (String)
 - `msg.httpPort` -> HTTP Port (Number)
 - `msg.historyQuery` -> History Query (Overrides the PresetQuery Selection) (JSON Object : See formatting options below)
 - `msg.presetQuery` -> Use a Preset History Query (Overrides the PresetQuery Selection) (String : Values must be one of the following)

     - "yesterday"
     - "last24Hours"
     - "weekToDate"
     - "lastWeek"
     - "last7Days"
     - "monthToDate"
     - "lastMonth"
     - "yearToDate (limit=1000)"
     - "lastYear (limit=1000)"
     - "unboundedQuery"

  - **HistoryQuery** - Used to specify what time period and how many records you want to read from a history... 
    Basic Query format `{"start": "2020-10-11T12:40:05-04:00", "end": "2020-10-14T12:40:05-04:00", "limit": "2"}`.
    Start and end are the periods of reading data, and the limit is the number of records returned. 
    If there are more records than the limit allows, then it returns the number of records starting from the start time.
---

### API Calls
**You will get a Socket Hang Up or ECONNRESET error if the parameters that are passed in are wrong**
Using a GET request, can pass parameters that will override any default values (Same values above, just remove the msg. part). 
But instead of passing 'historyQuery', pass 'start', 'end', and 'limit' individually.

---
---

# Niagara Obix Variable Node
Gets History Records from Niagara using the obix protocol

### Config Node:
 - **Username** - Set to the Obix User that has been set up in Niagara using the HTTPBasic Authentication Schema... Obix User must also be set to admin role.
 - **Password** - Password for the Obix User.
 - **IP Address** - IP Address of the Niagara Station.
 - **HTTP Port** - HTTP Port for the Niagara Station... HTTP must be enabled and HTTPS Only must be disabled in the Web Services, and the Port must be exposed on the Niagara Machine (Unless accessing from localhost only).
 
### Additional Fields:
 - **Path** - Used to indicate which variable/point you want to interact with... Path starts after config... ex. config/TestFolder/TestPoint, only take "TestFolder/TestPoint".
 - **Action** - Pick whether you want to read or write to a specific variable/point in the station's config folder.
 - **Value** - If `Action` is set to `Write`, this is the default value that will be written to the point specified in the path.

---

### Dynamic Values
Each instance of the Niagara Obix Node can have its values inserted dynamically. Each dynamic value has the same functionality as the values above. Passing the following values will **override** the default values you may pre-configured. 

 - `msg.username` -> Username (String)
 - `msg.password` -> Password (String)
 - `msg.ipAddress` -> IP Address (String)
 - `msg.httpPort` -> HTTP Port (Number)
 - `msg.method` -> Action (msg.method must be either 'GET' (for Reading) or 'POST' (for Writing)) (String)
 - `msg.path` -> Path (String)
 - `msg.value` -> Default Value (String, Boolean, or Number)

---

### API Calls
**You will get a Socket Hang Up or ECONNRESET error if the parameters that are passed in are wrong**
- To Read: Using a GET request, can pass parameters that will override any default values (Same values above, just remove the msg. part).
- To Write: Using a POST request, can pass values in the body that will override any default values (Same values above, just remove the msg. part).