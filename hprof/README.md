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

### Node Labels and Identifiers

- **Class Names:** Nodes are aggregated by class. If a class has a single root instance in the dominator tree, it shows the class name.
- **Hex Addresses:** If a class has multiple independent root instances, they may be shown individually with their hex addresses (e.g., `java.lang.String @ 0x12345678`).
- **0-byte Items:** You may see items with 0 bytes retained (e.g., `java.lang.Object`). These are instances that don't dominate any other objects (their own size is accounted for in the parent's shallow size, and they don't point to anything else that isn't already dominated by something else).

### Interactions

- **Drill-down:** Click on any class node to make it the root of the diagram. This allows you to see exactly how that specific class's retained memory is distributed.
- **Back:** Use the "Back" button to return to the previous zoomed state.
- **Reset Zoom:** Returns the view to the GC roots.
- **Depth Control:** Adjust the "Depth" value to see more or fewer layers of the dominator tree at once.
- **Split Count:** Configure how many top items are shown individually before they are grouped into the "Others" node.
