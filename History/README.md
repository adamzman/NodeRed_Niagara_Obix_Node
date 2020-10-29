# Function: 
**Links to a Niagara Station through the Obix Protocol... The Output of the Obix Node will be a JSON Object of a history with the queried records**

---
# Setup: 
To set up Obix in Niagara, drag in the Obix Network (from the palette) into the drivers folder. Then drag in the HTTP BasicScheme from the baja palette (baja -> AuthenticationSchemes -> WebServicesSchemes -> HTTPBasic) into the Authentication Service in the Services folder (Services -> AuthenticationService -> Authentication Schemes). Next, create a new user with an admin role and select the HTTPBasicScheme for the Authentication Scheme Name. OBIX uses HTTP only, so HTTP must be enabled and opened in the firewall.

---
# Fields:
 - **Username** - Set to the Obix User that has been set up in Niagara using the HTTPBasic Authentication Schema... Obix User must also be set to admin role.
 - **Password** - Password for the Obix User.
 - **IP Address** - IP Address of the Niagara Station.
 - **HTTP Port** - HTTP Port for the Niagara Station... HTTP must be enabled and HTTPS Only must be disabled in the Web Services, and the Port must be exposed on the Niagara Machine.
 - **Path** - Used to indicate which variable/point you want to interact with... Path starts after config... ex. config/TestFolder/Point, only take "TestFolder/Point".
 - **HistoryQuery** - Used to specify what time period and how many records you want to read from a history... Basic Query format `{"start": "2020-10-11T12:40:05-04:00", "end": "2020-10-14T12:40:05-04:00", "limit": "2"}` where start and end are the periods of reading data, and the limit is the number of records returned. If there are more records than the limit allows, then it returns the number of records starting from the start time.

---
# Pre-Set Instances

##  **- Histories**
###  Reading
Set the Username, Password, IP Address, and HTTP Port for your station. Then set `Path` to the path of the history you want to read, and `HistoryQuery` to the parameters you want (example of a query in the Fields Documentation above). All other fields can be ignored.

---
# Dynamic Instances
Each instance of the Obix Connector can have its data inserted dynamically. Each dynamic value has the same functionality as the Fields Documentation above states. Passing the following values will override the default values you may pre-configured. 
 - `msg.username` -> Username (String)
 - `msg.password` -> Password (String)
 - `msg.ipAddress` -> IP Address (String)
 - `msg.httpPort` -> HTTP Port (Number)
 - `msg.historyQuery` -> History Query (Overrides the PresetQuery Selection) (JSON Object)

---
# API Calls
**You will get a Socket Hang Up or ECONNRESET error if the parameters that are passed in are wrong**

##  **- Histories**
###  Reading
Using a GET request, can pass parameters in the request itself. The same values above will override any default values (Just remove the msg part). **But instead of passing 'historyQuery', pass 'start', 'end', and 'limit' individually.**