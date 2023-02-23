## Niagara Obix Watcher Node

> **ENSURE README IS FOR CORRECT VERSION OF PACKAGE**

Watches several points and returns an array of values. **Will read the 'out' value of the path**

- **Topic** - The topic sent with the msg every poll (optional).
- **Poll Rate** - The interval at which points are returned. Must be 5 or more seconds.
- **Poll Changes** - Toggle whether the poll only returns points which the value has changed since the last poll, or return the values of all the points every poll.
- **Paths** - The list of paths that are returned on each poll.

### Dynamic Values

Passing the following values will **override** the default values you may pre-configured.

- `msg.topic` -> Attached as the topic for every poll message (Any)
- `msg.username` -> Username (String)
- `msg.password` -> Password (String)
- `msg.credentialsKey` -> Key used to obtain credentials from Node-RED settings file (Overrides `msg.username` and `msg.password`) (String)
- `msg.protocol` -> 'https' or 'http' (String)
- `msg.host` -> IP Address (String)
- `msg.port` -> HTTPS/HTTP Port (Number)
- `msg.pollRate` -> Rate at which the poll will be fired (Number >= 5)
- `msg.pollRefresh` -> Set to `true` to poll all watcher's configured paths (Boolean)
- `msg.pollChanges` -> Set to `true` to poll all watcher's configured paths that have changed since last poll (Boolean)
- `msg.pollStop` -> Set to `true` to stop polling and delete the current watcher (Boolean)
- `msg.pollChangesOnly` -> **Use when creating the watcher.** Toggle whether the poll only returns points which the value has changed since the last poll, or return the values of all the points every poll (Boolean)
- `msg.paths` -> Paths to add to watcher (String[] || String)
  - Basic paths format
    ```
    ["Point/Test", "Point/Test1"]
    ```
