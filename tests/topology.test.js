import test from 'node:test';
import assert from 'node:assert/strict';
import { createDefaultState } from '../site/js/data/default-state.js';
import { getTopologyNodes, selectTopologyNode } from '../site/js/core/topology.js';

test('topology includes six VLANs and conceptual hybrid-network components', () => {
  const state = createDefaultState();
  const nodes = getTopologyNodes(state);
  assert.equal(nodes.filter((node) => node.kind === 'segment' && node.vlan !== null).length, 6);
  for (const id of ['internet', 'firewall-pfsense', 'active-directory', 'entra-id', 'rocky-linux', 'azure']) {
    assert.ok(nodes.some((node) => node.id === id), `missing ${id}`);
  }
  assert.ok(nodes.every((node) => node.synthetic === true));
});

test('selectTopologyNode returns detailed data for a segment and a resource', () => {
  const state = createDefaultState();
  const segment = selectTopologyNode('vlan-20-users', state);
  assert.equal(segment.kind, 'segment');
  assert.equal(segment.vlan, 20);
  const resource = selectTopologyNode('resource-database', state);
  assert.equal(resource.kind, 'resource');
  assert.equal(resource.ip, '10.30.30.30');
  assert.equal(resource.synthetic, true);
});

test('unknown topology node returns null rather than throwing', () => {
  assert.equal(selectTopologyNode('missing', createDefaultState()), null);
});
