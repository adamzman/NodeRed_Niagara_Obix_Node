## Niagara Obix Variable Node

Returns/Writes points to the connected Niagara station using the obix protocol. **Can read the 'out' value of a control point, write to the 'set' value, and batch read/write**

- **Path** - Used to indicate which variable/point to interact with... path starts after config... ex. `config/TestFolder/TestPoint`, only take `"TestFolder/TestPoint"`.
- **Action** - Read, write, or batch.
- **Value** - If `Action` is set to `Write`, the value that will be written to the point specified in the path.
- **Batch** - If `Action` is set to `Batch`, the mixture of read/write commands to be executed (More details below).

### Dynamic Values

Passing the following values will **override** the default values you may pre-configured.

- `msg.username` -> Username (String)
- `msg.password` -> Password (String)
- `msg.credentialsKey` -> Key used to obtain credentials from Node-RED settings file (Overrides `msg.username` and `msg.password`) (String)
- `msg.protocol` -> 'https' or 'http' (String)
- `msg.host` -> IP Address (String)
- `msg.port` -> HTTPS/HTTP Port (Number)
- `msg.path` -> Path (String)
- `msg.action` -> 'read', 'write', or 'batch' (String)
- `msg.value` -> If `action` is `write`, value used when writing to path (String, Boolean, or Number)
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
