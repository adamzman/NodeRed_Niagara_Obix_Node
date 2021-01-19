## Niagara Obix Watcher Node
Watches several points and returns an array which includes all the points that changed since the last pull. **Can only read the 'out' value of a control point**

- **Poll Rate** - The interval at which points are returned. Must be between 1 - 30 seconds.
- **Search Paths** - Searches through the list of paths that are configured below.
- **Paths** - The list of paths that are returned on each pull. **After the initial pull, Only values that have changed since the last pull will be returned.** Add a new Path by clicking the "Add New Path" and Delete a path by clicking the "x" next to the path. You can also sort the list by clicking the sort button or dragging the three bars next to the path.