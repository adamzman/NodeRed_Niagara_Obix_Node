## Niagara Obix Watcher Node

Watches several points and returns an array of values. **Will read the 'out' value of the path**
The inject button is similar to redeploying node red. It just restarts the poll.

-   **Topic** - The topic for the msg output (optional).
-   **Poll Rate** - The interval at which points are returned. Must be 5 or more seconds.
-   **Relativize** - The path to be prepended to the configured paths below. (optional, will only prepend to paths that have the Relativized checkbox checked)
-   **Search Paths** - Searches through the list of paths that are configured below.
-   **Paths** - The list of paths that are returned on each pull. Add a new Path by clicking the "Add New Path" and Delete a path by clicking the "x" next to the path. You can also sort the list by clicking the sort button or dragging the three bars next to the path. The duplicate button does duplicates the values of that row to a new row.

![Example of Niagara Tree](niagara.jpg?raw=true "Example of Niagara Tree")
![Example of Node Red configuration](nodered.jpg?raw=true "Example of Node Red configuration")