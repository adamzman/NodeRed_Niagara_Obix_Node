## Niagara Obix Variable Node

> **ENSURE README IS FOR CORRECT VERSION OF PACKAGE**

Returns/Writes points to the connected Niagara station using the obix protocol. **Can read the 'out' value of a control point, write to the 'set' value, batch read/write, and GET or POST in the Niagara Tree and return as JSON**

- **Path** - Used to indicate which variable/point to interact with... path starts after config... ex. `config/TestFolder/TestPoint`, only take `"TestFolder/TestPoint"`.
- **Action** - Read, Write, Batch, Raw Get, or Raw Post.
- **Value** - If `Action` is set to `Write`, the value that will be written to the point specified in the path.
- **Batch** - If `Action` is set to `Batch`, the mixture of read/write commands to be executed (More details below).

---

- **Raw Get** - If `Action` is set to `Raw Get`, returns the raw JSON after being converted from the XML response. **The path will also be inputted without prepending `config/`**
- **Raw Post** - If `Action` is set to `Raw Post`, returns the raw JSON after being converted from the XML response; also sends a xml string as the body of the request. **The path will also be inputted without prepending `config/`**
  > The payload must replace any special characters: [Replace Special Characters](https://stackoverflow.com/questions/1091945/what-characters-do-i-need-to-escape-in-xml-documents#:~:text=XML%20escape%20characters,the%20W3C%20Markup%20Validation%20Service)

### Dynamic Values

Passing the following values will **override** the default values you may pre-configured.

- `msg.username` -> Username (String)
- `msg.password` -> Password (String)
- `msg.credentialsKey` -> Key used to obtain credentials from Node-RED settings file (Overrides `msg.username` and `msg.password`) (String)
- `msg.protocol` -> 'https' or 'http' (String)
- `msg.host` -> IP Address (String)
- `msg.port` -> HTTPS/HTTP Port (Number)
- `msg.path` -> Path (String)
- `msg.action` -> 'read', 'write', 'batch', 'rawGet', 'rawPost' (String)
- `msg.value` -> If `action` is `write`, value used when writing to path (String, Boolean, or Number)
- `msg.xmlPayload` -> If `action` is `rawPost`, payload sent as body in POST request (String)
- `msg.batch` -> If `action` is `batch`, batch read/write (Object or Object[])
  - Basic batch format
    ```
    [
      {
        "path": "Point/Test",
        "action": "write",
        "value": "test"
      },
      {
        "path": "Point/Test1",
        "action": "read"
      },
    ]
    ```
