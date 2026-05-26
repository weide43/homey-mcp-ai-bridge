'use strict';

/**
 * Flow tools - Full CRUD + triggering for Homey basic flows and advanced flows
 */
module.exports = function registerFlowTools(server, client) {

  // ─── Basic Flows ──────────────────────────────────────────────────

  server.registerTool(
    'flows_list',
    'List all basic flows on Homey. Shows name, enabled status, and last run time.',
    {
      type: 'object',
      properties: {
        enabled_only: { type: 'boolean', description: 'Only return enabled flows' },
        search:       { type: 'string',  description: 'Search flows by name (case-insensitive)' },
      },
    },
    async ({ enabled_only, search }) => {
      const raw = await client.getFlows();
      let flows = Object.values(raw);

      if (enabled_only) flows = flows.filter(f => f.enabled);
      if (search) {
        const q = search.toLowerCase();
        flows = flows.filter(f => f.name?.toLowerCase().includes(q));
      }

      return flows.map(f => ({
        id:      f.id,
        name:    f.name,
        enabled: f.enabled,
        broken:  f.broken,
        folder:  f.folder,
        order:   f.order,
      }));
    },
  );

  server.registerTool(
    'flows_get',
    'Get the full details of a basic flow including its trigger (when), conditions (and), and actions (then).',
    {
      type: 'object',
      properties: {
        flow_id: { type: 'string', description: 'The flow ID' },
      },
      required: ['flow_id'],
    },
    async ({ flow_id }) => {
      return client.getFlow(flow_id);
    },
  );

  server.registerTool(
    'flows_trigger',
    'Trigger/run a basic flow by ID or name. If using name, finds the first matching flow.',
    {
      type: 'object',
      properties: {
        flow_id:   { type: 'string', description: 'Flow ID (preferred)' },
        flow_name: { type: 'string', description: 'Flow name (alternative to ID, case-insensitive match)' },
        tokens:    { type: 'object', description: 'Optional flow tokens/variables to pass to the flow' },
      },
    },
    async ({ flow_id, flow_name, tokens }) => {
      let id = flow_id;

      if (!id && flow_name) {
        const raw = await client.getFlows();
        const found = Object.values(raw).find(
          f => f.name?.toLowerCase() === flow_name.toLowerCase(),
        );
        if (!found) throw new Error(`Flow not found with name: "${flow_name}"`);
        id = found.id;
      }

      if (!id) throw new Error('Provide either flow_id or flow_name');

      await client.triggerFlow(id, tokens);
      return { success: true, flow_id: id, message: 'Flow triggered successfully' };
    },
  );

  server.registerTool(
    'flows_enable',
    'Enable or disable a basic flow.',
    {
      type: 'object',
      properties: {
        flow_id: { type: 'string',  description: 'The flow ID' },
        enabled: { type: 'boolean', description: 'true to enable, false to disable' },
      },
      required: ['flow_id', 'enabled'],
    },
    async ({ flow_id, enabled }) => {
      await client.updateFlow(flow_id, { enabled });
      return { success: true, flow_id, enabled };
    },
  );

  server.registerTool(
    'flows_rename',
    'Rename a basic flow.',
    {
      type: 'object',
      properties: {
        flow_id: { type: 'string', description: 'The flow ID' },
        name:    { type: 'string', description: 'New name for the flow' },
      },
      required: ['flow_id', 'name'],
    },
    async ({ flow_id, name }) => {
      await client.updateFlow(flow_id, { name });
      return { success: true, flow_id, name };
    },
  );

  server.registerTool(
    'flows_create',
    `Create a new basic flow. A flow has a trigger (when), optional conditions (and), and actions (then).
Use flowcards_list_triggers/conditions/actions to find card ownerUri and id values.
Each card requires a fully-qualified id and uri:
  id:  "{ownerUri}:{cardId}"  e.g. "homey:manager:cron:every_nth"
  uri: "homey:flowcardtrigger:{ownerUri}:{cardId}"  (or flowcardcondition / flowcardaction)
Example trigger: { "id": "homey:manager:cron:every_nth", "uri": "homey:flowcardtrigger:homey:manager:cron:every_nth", "args": { "n": 5, "type": "minute" } }
Example action:  { "id": "homey:device:[deviceId]:onoff_off", "uri": "homey:flowcardaction:homey:device:[deviceId]:onoff_off", "args": {} }`,
    {
      type: 'object',
      properties: {
        name:       { type: 'string',  description: 'Flow name' },
        enabled:    { type: 'boolean', description: 'Start enabled (default: true)' },
        trigger:    { type: 'object',  description: 'Trigger card object with uri, id, args, droptoken' },
        conditions: { type: 'array',   description: 'Array of condition card objects' },
        actions:    { type: 'array',   description: 'Array of action card objects' },
      },
      required: ['name'],
    },
    async ({ name, enabled = true, trigger, conditions = [], actions = [] }) => {
      const body = { name, enabled, trigger, conditions, actions };
      const result = await client.createFlow(body);
      return { success: true, flow_id: result.id, name, message: 'Flow created' };
    },
  );

  server.registerTool(
    'flows_update',
    'Update an existing basic flow (name, enabled, trigger, conditions, actions).',
    {
      type: 'object',
      properties: {
        flow_id:    { type: 'string',  description: 'The flow ID to update' },
        name:       { type: 'string',  description: 'New name' },
        enabled:    { type: 'boolean', description: 'Enable or disable' },
        trigger:    { type: 'object',  description: 'New trigger card' },
        conditions: { type: 'array',   description: 'New conditions array' },
        actions:    { type: 'array',   description: 'New actions array' },
      },
      required: ['flow_id'],
    },
    async ({ flow_id, name, enabled, trigger, conditions, actions }) => {
      // B-08: pick only known fields — never forward arbitrary keys to the API
      const updates = {};
      if (name       !== undefined) updates.name       = name;
      if (enabled    !== undefined) updates.enabled    = enabled;
      if (trigger    !== undefined) updates.trigger    = trigger;
      if (conditions !== undefined) updates.conditions = conditions;
      if (actions    !== undefined) updates.actions    = actions;
      await client.updateFlow(flow_id, updates);
      return { success: true, flow_id, updated: Object.keys(updates) };
    },
  );

  server.registerTool(
    'flows_delete',
    'Delete a basic flow permanently.',
    {
      type: 'object',
      properties: {
        flow_id: { type: 'string', description: 'The flow ID to delete' },
      },
      required: ['flow_id'],
    },
    async ({ flow_id }) => {
      await client.deleteFlow(flow_id);
      return { success: true, flow_id, message: 'Flow deleted' };
    },
  );

  // ─── Advanced Flows ───────────────────────────────────────────────

  server.registerTool(
    'advanced_flows_list',
    'List all Advanced Flows on Homey.',
    {
      type: 'object',
      properties: {
        enabled_only: { type: 'boolean', description: 'Only return enabled advanced flows' },
        search:       { type: 'string',  description: 'Search by name' },
      },
    },
    async ({ enabled_only, search }) => {
      const raw = await client.getAdvancedFlows();
      let flows = Object.values(raw);

      if (enabled_only) flows = flows.filter(f => f.enabled);
      if (search) {
        const q = search.toLowerCase();
        flows = flows.filter(f => f.name?.toLowerCase().includes(q));
      }

      return flows.map(f => ({
        id:      f.id,
        name:    f.name,
        enabled: f.enabled,
        broken:  f.broken,
        folder:  f.folder,
      }));
    },
  );

  server.registerTool(
    'advanced_flows_get',
    'Get the full structure of an Advanced Flow including all nodes and connections.',
    {
      type: 'object',
      properties: {
        flow_id: { type: 'string', description: 'The advanced flow ID' },
      },
      required: ['flow_id'],
    },
    async ({ flow_id }) => {
      return client.getAdvancedFlow(flow_id);
    },
  );

  server.registerTool(
    'advanced_flows_trigger',
    'Trigger an Advanced Flow by ID or name.',
    {
      type: 'object',
      properties: {
        flow_id:   { type: 'string', description: 'Advanced Flow ID (preferred)' },
        flow_name: { type: 'string', description: 'Advanced Flow name (alternative)' },
        tokens:    { type: 'object', description: 'Optional tokens to pass to the flow' },
      },
    },
    async ({ flow_id, flow_name, tokens }) => {
      let id = flow_id;

      if (!id && flow_name) {
        const raw = await client.getAdvancedFlows();
        const found = Object.values(raw).find(
          f => f.name?.toLowerCase() === flow_name.toLowerCase(),
        );
        if (!found) throw new Error(`Advanced Flow not found: "${flow_name}"`);
        id = found.id;
      }

      if (!id) throw new Error('Provide either flow_id or flow_name');

      await client.triggerAdvancedFlow(id, tokens);
      return { success: true, flow_id: id, message: 'Advanced Flow triggered' };
    },
  );

  server.registerTool(
    'advanced_flows_update',
    `Update an existing Advanced Flow. Use advanced_flows_get first to retrieve the current structure, then pass the modified version.

You can update any combination of: name, enabled, folder, nodes, edges.
Fields you omit will keep their current value — but nodes and edges must always be provided together as a complete set (partial node updates are not supported by Homey).`,
    {
      type: 'object',
      properties: {
        flow_id: { type: 'string',  description: 'The advanced flow ID to update' },
        name:    { type: 'string',  description: 'New name' },
        enabled: { type: 'boolean', description: 'Enable or disable' },
        folder:  { type: 'string',  description: 'Move to folder ID (or null to remove from folder)' },
        nodes:   { type: 'array',   description: 'Full replacement node list', items: { type: 'object' } },
        edges:   { type: 'array',   description: 'Full replacement edge list', items: { type: 'object' } },
      },
      required: ['flow_id'],
    },
    async ({ flow_id, name, enabled, folder, nodes, edges }) => {
      const patch = {};
      if (name    !== undefined) patch.name    = name;
      if (enabled !== undefined) patch.enabled = enabled;
      if (folder  !== undefined) patch.folder  = folder;
      if (nodes   !== undefined) patch.nodes   = nodes;
      if (edges   !== undefined) patch.edges   = edges;
      await client.updateAdvancedFlow(flow_id, patch);
      return { success: true, flow_id };
    },
  );

  server.registerTool(
    'advanced_flows_enable',
    'Enable or disable an Advanced Flow.',
    {
      type: 'object',
      properties: {
        flow_id: { type: 'string',  description: 'The advanced flow ID' },
        enabled: { type: 'boolean', description: 'true to enable, false to disable' },
      },
      required: ['flow_id', 'enabled'],
    },
    async ({ flow_id, enabled }) => {
      await client.updateAdvancedFlow(flow_id, { enabled });
      return { success: true, flow_id, enabled };
    },
  );

  server.registerTool(
    'advanced_flows_delete',
    'Delete an Advanced Flow permanently.',
    {
      type: 'object',
      properties: {
        flow_id: { type: 'string', description: 'The advanced flow ID to delete' },
      },
      required: ['flow_id'],
    },
    async ({ flow_id }) => {
      await client.deleteAdvancedFlow(flow_id);
      return { success: true, flow_id, message: 'Advanced Flow deleted' };
    },
  );

  server.registerTool(
    'advanced_flows_create',
    `Create a new Advanced Flow. Advanced Flows use a node-based graph structure.

Use advanced_flows_get on an existing flow to see real examples of the structure.

Node types:
- trigger: a flowcard trigger (has a "output" port)
- condition: a flowcard condition (has "true" and "false" ports)
- action: a flowcard action (has "output" port)
- delay: waits N seconds (has "output" port)
- any: passes through if any connected trigger fires
- all: passes through only if all connected triggers fire
- note: visual annotation, no logic

Each node needs:
  id      – unique string (e.g. "node_1")
  type    – one of the types above
  x, y    – canvas position (e.g. 0, 0)
  width   – typically 200 for actions/conditions, 400 for triggers
  height  – typically 80

For trigger/condition/action nodes also add:
  uri     – flowcard URI, e.g. "homey:manager:cron"
  args    – object with card arguments

Edges connect node output ports to input ports:
  id         – unique string
  sourceId   – source node id
  sourcePort – port name: "output", "true", "false"
  targetId   – target node id
  targetPort – always "input"

Tip: call advanced_flows_get on any existing Advanced Flow to see a working example before creating a new one.`,
    {
      type: 'object',
      properties: {
        name:    { type: 'string',  description: 'Name of the new Advanced Flow' },
        enabled: { type: 'boolean', description: 'Whether the flow is enabled (default: true)' },
        folder:  { type: 'string',  description: 'Optional folder ID' },
        nodes:   {
          type: 'array',
          description: 'Array of node objects',
          items: { type: 'object' },
        },
        edges: {
          type: 'array',
          description: 'Array of edge (connection) objects',
          items: { type: 'object' },
        },
      },
      required: ['name', 'nodes', 'edges'],
    },
    async ({ name, enabled = true, folder, nodes, edges }) => {
      const body = { name, enabled, nodes, edges };
      if (folder) body.folder = folder;
      const result = await client.createAdvancedFlow(body);
      return { success: true, flow_id: result.id, name: result.name };
    },
  );

  // ─── Flow tokens/variables ────────────────────────────────────────

  server.registerTool(
    'flows_list_tokens',
    'List all available flow tokens (tags) that can be used in flow conditions and actions.',
    { type: 'object', properties: {} },
    async () => {
      const raw = await client.getFlowTokens();
      return Object.values(raw).map(t => ({
        id:    t.id,
        type:  t.type,
        title: t.title,
        uri:   t.uri,
      }));
    },
  );

};
