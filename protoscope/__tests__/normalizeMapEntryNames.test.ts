import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as protobuf from 'protobufjs';
import 'protobufjs/ext/descriptor';
import { normalizeMapEntryNames } from '../normalizeMapEntryNames';

function loadDescriptorFromProto(protoRelPath: string) {
  const protoPath = path.resolve(__dirname, protoRelPath);
  const protoText = fs.readFileSync(protoPath, 'utf8');
  const parsed = protobuf.parse(protoText, { keepCase: false });
  const root = parsed.root;
  root.resolveAll();
  const fds = (root as any).toDescriptor();
  return fds;
}

function findMessage(fds: any, pkg: string, msgName: string) {
  const file = fds.file.find((f: any) => (f.package || '') === pkg);
  if (!file) return undefined;
  return (file.messageType || file.message_type || []).find((m: any) => m.name === msgName);
}

describe('normalizeMapEntryNames (real proto)', () => {
  it('normalizes SubmergeMap.elements map entry and fully-qualifies field type', () => {
    const fds = loadDescriptorFromProto('../__tests__/fixtures/test.proto');
    normalizeMapEntryNames(fds);

    const submergeMap = findMessage(fds, 'pkg.example', 'SubmergeMap');
    expect(submergeMap).toBeTruthy();
    const field: any = submergeMap.field.find((f: any) => f.name === 'elements');
    const nestedEntry = (submergeMap.nestedType || submergeMap.nested_type).find((n: any) => (n.options?.mapEntry || n.options?.map_entry));

    expect(nestedEntry.name).toBe('ElementsEntry');
    expect(field.typeName || field.type_name).toBe('.pkg.example.SubmergeMap.ElementsEntry');
  });

  it('normalizes VectorClock.node_clock_values entry and fully-qualifies field type', () => {
    const fds = loadDescriptorFromProto('../__tests__/fixtures/test.proto');
    normalizeMapEntryNames(fds);

    const vectorClock = findMessage(fds, 'pkg.example', 'VectorClock');
    expect(vectorClock).toBeTruthy();
    const field: any = vectorClock.field.find((f: any) => f.name === 'nodeClockValues' || f.name === 'node_clock_values');
    const nestedEntry = (vectorClock.nestedType || vectorClock.nested_type).find((n: any) => (n.options?.mapEntry || n.options?.map_entry));

    expect(nestedEntry.name).toBe('NodeClockValuesEntry');
    expect(field.typeName || field.type_name).toBe('.pkg.example.VectorClock.NodeClockValuesEntry');
  });
});
