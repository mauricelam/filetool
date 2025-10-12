// Utilities for normalizing implicit protobuf map entry names in a FileDescriptorSet
//
// Go's protodesc requires that for a map field named `foo`, the implicit entry
// message must be nested and named `FooEntry`, and the field's type_name must
// point to that nested entry using a fully-qualified name (e.g.,
// `.package.Parent.FooEntry`).
//
// protobuf.js can emit different entry names (e.g., `Foo`) or leave type
// references unqualified. This module rewrites the generated descriptor object
// to conform to Go's expectations without modifying the original .proto file.

// Helper: Convert snake_case or lowerCamel to UpperCamel
function toUpperCamel(name: string): string {
  return name
    .split(/[_\s]+/)
    .map((part) => (part.length ? part[0].toUpperCase() + part.slice(1) : ""))
    .join("");
}

// Normalize implicit map entry names to match Go protodesc expectations: <FieldName>Entry
export function normalizeMapEntryNames(fds: any) {
  if (!fds || !Array.isArray(fds.file)) return;

  // 1) Build registry of all fully-qualified message names
  const allTypes = new Set<string>();
  const collect = (msg: any, parentFq: string) => {
    const fq = parentFq ? parentFq + "." + msg.name : msg.name;
    if (fq) allTypes.add("." + fq);
    const nested = msg.nestedType || msg.nested_type || [];
    for (const n of nested) collect(n, fq);
  };
  // Defensive quick pass
  for (const file of fds.file) {
    const pkg: string = file.package || "";
    const messages = file.messageType || file.message_type || [];
    for (const msg of messages)
      collect(msg, pkg ? pkg + "." + msg.name.replace(/\..*$/, "") : msg.name);
  }
  // Proper collection pass
  for (const file of fds.file) {
    const pkg: string = file.package || "";
    const messages = file.messageType || file.message_type || [];
    for (const msg of messages) collect(msg, pkg);
  }

  const resolveRef = (shortName: string, parentFq: string, pkg: string): string => {
    if (!shortName) return shortName;
    if (shortName.startsWith(".")) return shortName; // already fq
    const cand1 = "." + parentFq + "." + shortName; // nested under current
    if (parentFq && allTypes.has(cand1)) return cand1;
    const cand2 = "." + (pkg ? pkg + "." : "") + shortName; // package-level
    if (allTypes.has(cand2)) return cand2;
    // Fallback to package-level even if not pre-known; protodesc may still resolve
    return cand2;
  };

  const fixTypeNameRef = (
    fld: any,
    oldName: string,
    newName: string,
    parentFq: string,
    pkg: string
  ) => {
    const update = (tn: string | undefined) => {
      if (!tn) return tn as any;
      let candidate = tn;
      if (oldName && (candidate.endsWith("." + oldName) || candidate === oldName)) {
        // Replace tail
        if (candidate.endsWith("." + oldName)) {
          candidate = candidate.slice(0, -oldName.length) + newName;
        } else if (candidate === oldName) {
          candidate = newName;
        }
      }
      return resolveRef(candidate, parentFq, pkg);
    };
    if (fld.typeName) fld.typeName = update(fld.typeName);
    if (fld.type_name) fld.type_name = update(fld.type_name);
  };

  const visitMessage = (msg: any, parentFqName: string, pkg: string) => {
    if (!msg) return;
    const nested = msg.nestedType || msg.nested_type; // protobufjs uses camelCase; descriptorpb uses snake_case
    const fields = msg.field || [];

    // Build lookup of map-entry nested types by name
    const nestedArr: any[] = Array.isArray(nested) ? nested : [];
    const mapEntriesByName = new Map<string, any>();
    for (const n of nestedArr) {
      const opts = n.options || {};
      const mapEntry = opts.mapEntry ?? opts.map_entry;
      if (mapEntry) {
        mapEntriesByName.set(n.name, n);
      }
    }

    // For each field that references a mapEntry message, ensure entry name matches <FieldName>Entry
    for (const fld of fields) {
      const typeName: string = fld.typeName || fld.type_name || "";
      if (!typeName) continue;
      for (const [oldName, nestedType] of mapEntriesByName) {
        const matches = typeName === oldName || typeName.endsWith("." + oldName);
        if (!matches) continue;
        const expected = toUpperCamel(fld.name) + "Entry";
        if (oldName !== expected) {
          nestedType.name = expected;
        }
        // Ensure field type_name points to the nested entry under this message, fully-qualified
        const fq = "." + parentFqName + "." + expected;
        if (fld.typeName !== undefined) fld.typeName = fq;
        if (fld.type_name !== undefined) fld.type_name = fq;
      }
      // Also fully-qualify any other message references (no-op replace)
      fixTypeNameRef(fld, "", "", parentFqName, pkg);
    }

    // Overwrite nestedType with updated entries to ensure changes take effect
    const updatedNested = nestedArr.map((n) => {
      const opts = n.options || {};
      const mapEntry = opts.mapEntry ?? opts.map_entry;
      if (!mapEntry) return n;
      const fld = fields.find((f: any) => {
        const tn = f.typeName || f.type_name || "";
        return tn === n.name || tn.endsWith("." + n.name);
      });
      if (!fld) return n;
      const expected = toUpperCamel(fld.name) + "Entry";
      if (n.name === expected) return n;
      return { ...n, name: expected };
    });
    if (msg.nestedType) msg.nestedType = updatedNested;
    if (msg.nested_type) msg.nested_type = updatedNested;

    // Recurse into nested types
    for (const n of updatedNested) {
      const childFq = parentFqName ? parentFqName + "." + n.name : n.name;
      visitMessage(n, childFq, pkg);
    }
  };

  for (const file of fds.file) {
    const pkg = file.package || "";
    const messages = file.messageType || file.message_type || [];
    for (const msg of messages) {
      const fq = (pkg ? pkg + "." : "") + (msg.name || "");
      visitMessage(msg, fq, pkg);
    }
  }
}
