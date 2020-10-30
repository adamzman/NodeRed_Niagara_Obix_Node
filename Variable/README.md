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
To Read: Using a GET request, can pass parameters that will override any default values (Same values above, just remove the msg. part).
To Write: Using a POST request, can pass values in the body that will override any default values (Same values above, just remove the msg. part).