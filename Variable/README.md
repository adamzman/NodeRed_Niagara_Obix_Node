## Niagara Obix Variable Node

Returns/Writes points to the Niagara using the obix protocol. **Can only read the 'out' value of a control point, and write to the 'set' value.**

- **Path** - Used to indicate which variable/point you want to interact with... Path starts after config... ex. config/TestFolder/TestPoint, only take "TestFolder/TestPoint".
- **Action** - Pick whether you want to read or write to a specific variable/point in the station's config folder.
- **Value** - If `Action` is set to `Write`, this is the default value that will be written to the point specified in the path.

### Dynamic Values

Each instance of the Niagara Obix Node can have its values inserted dynamically. Each dynamic value has the same functionality as the values above. Passing the following values will **override** the default values you may pre-configured.

- `msg.username` -> Username (String)
- `msg.password` -> Password (String)
- `msg.host` -> IP Address (String)
- `msg.protocol` -> 'https' or 'http' (String)
- `msg.port` -> HTTPS/HTTP Port (Number)
- `msg.path` -> Path to Variable (String)
- `msg.action` -> 'read' or 'write' (String)
- `msg.value` -> Default Value (String, Boolean, or Number)
