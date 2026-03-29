# HPROF Viewer

A high-performance heap dump analyzer.

## Memory Flow (Sankey) Diagram

The Memory Flow diagram provides a visual representation of how memory is retained in the JVM heap.

### How to interpret the diagram

- **Flow Direction:** The diagram shows memory retention from left to right. Nodes on the left dominate (are responsible for keeping alive) the nodes on the right.
- **Node Height:** The vertical height of each node is proportional to its **Total Retained Size**. If an object dominates other objects, its height includes the size of everything it keeps alive.
- **`<self>` Node:** This represents the **Shallow Size** of the parent object itself (the memory consumed by its own fields, excluding the objects it points to).
- **`Others` Node:** When an object dominates a large number of smaller children, they are grouped into this node to keep the diagram readable.
- **Edges:** The links between nodes represent references. Hovering over an edge will show the specific field names that form the reference (if available).

### Interactions

- **Drill-down:** Click on any class/object node to make it the root of the diagram. This allows you to see exactly how that specific object's retained memory is distributed.
- **Back:** Use the "Back" button to return to the previous zoomed state.
- **Reset Zoom:** Returns the view to the GC roots.
- **Depth Control:** Adjust the "Depth" value to see more or fewer layers of the dominator tree at once.
