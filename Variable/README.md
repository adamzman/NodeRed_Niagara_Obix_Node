# Function: 
**Links to a Niagara Station through the Obix Protocol... The Output of the Obix Node will be a JSON Object of the value and variable**

---
# Setup: 
To set up Obix in Niagara, drag in the Obix Network (from the palette) into the drivers folder. Then drag in the HTTP BasicScheme from the baja palette (baja -> AuthenticationSchemes -> WebServicesSchemes -> HTTPBasic) into the Authentication Service in the Services folder (Services -> AuthenticationService -> Authentication Schemes). Next, create a new user with an admin role and select the HTTPBasicScheme for the Authentication Scheme Name. OBIX uses HTTP only, so HTTP must be enabled and opened in the firewall.

---
# Fields:
 - **Username** - Set to the Obix User that has been set up in Niagara using the HTTPBasic Authentication Schema... Obix User must also be set to admin role.
 - **Password** - Password for the Obix User.
 - **IP Address** - IP Address of the Niagara Station.
 - **HTTP Port** - HTTP Port for the Niagara Station... HTTP must be enabled and HTTPS Only must be disabled in the Web Services, and the Port must be exposed on the Niagara Machine.
 - **Action** - Pick whether you want to read or write to a specific variable/point in the station's config folder.
 - **Path** - Used to indicate which variable/point you want to interact with... Path starts after config... ex. config/TestFolder/Point, only take "TestFolder/Point".
 - **Default Value** - If `Action` is set to `Write`, this is the default value that will be written to the point specified in the path.

---
# Pre-Set Instances

##  **- Variables/Points**
###  Reading
Set the Username, Password, IP Address, and HTTP Port for your station. Then set `Action` to `Read`. Now specify the path of the variable you want to read. All other fields can be ignored.
###  Writing
Set the Username, Password, IP Address, and HTTP Port for your station. Then set `Action` to `Write`, and `Default Value` to any value you desire (To override the default value, just pass in a number in `msg.value`). Now specify the path of the variable you want to write. All other fields can be ignored.

---
# Dynamic Instances
Each instance of the Obix Connector can have its data inserted dynamically. Each dynamic value has the same functionality as the Fields Documentation above states. Passing the following values will override the default values you may pre-configured. 
 - `msg.username` -> Username (String)
 - `msg.password` -> Password (String)
 - `msg.ipAddress` -> IP Address (String)
 - `msg.httpPort` -> HTTP Port (Number)
 - `msg.method` -> Action (msg.method must be either 'GET' (for Reading) or 'POST' (for Writing)) (String)
 - `msg.path` -> Path (String)
 - `msg.value` -> Default Value (String, Boolean, or Number)

---
# API Calls
**You will get a Socket Hang Up or ECONNRESET error if the parameters that are passed in are wrong**

##  **- Variables/Points**
###  Reading
Using a GET request, can pass parameters in the request itself or in the body. The same values above will override any default values (Just remove the msg part).
###  Writing
Using a POST request, can pass parameters in the request itself or in the body. The same values above will override any default values (Just remove the msg part).
