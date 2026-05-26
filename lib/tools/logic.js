'use strict';

/**
 * Logic tools - Full CRUD for Homey logic variables (boolean, number, string)
 */
module.exports = function registerLogicTools(server, client) {

  server.registerTool(
    'logic_list',
    'List all logic variables (boolean, number, string) on Homey.',
    {
      type: 'object',
      properties: {
        type: { type: 'string', enum: ['boolean', 'number', 'string'], description: 'Filter by variable type' },
      },
    },
    async ({ type }) => {
      const raw = await client.getVariables();
      let vars = Object.values(raw);
      if (type) vars = vars.filter(v => v.type === type);
      return vars.map(v => ({ id: v.id, name: v.name, type: v.type, value: v.value }));
    },
  );

  server.registerTool(
    'logic_get',
    'Get the current value of a logic variable.',
    {
      type: 'object',
      properties: {
        variable_id:   { type: 'string', description: 'Variable ID' },
        variable_name: { type: 'string', description: 'Variable name (alternative to ID)' },
      },
    },
    async ({ variable_id, variable_name }) => {
      // B-06: guard against both args being missing
      if (!variable_id && !variable_name) {
        throw new Error('Provide variable_id or variable_name');
      }
      if (variable_id) {
        return client.getVariable(variable_id);
      }
      // Search by name
      const raw = await client.getVariables();
      const found = Object.values(raw).find(
        v => v.name?.toLowerCase() === variable_name.toLowerCase(),
      );
      if (!found) throw new Error(`Variable not found: "${variable_name}"`);
      return found;
    },
  );

  server.registerTool(
    'logic_set',
    'Set the value of a logic variable.',
    {
      type: 'object',
      properties: {
        variable_id:   { type: 'string', description: 'Variable ID (preferred)' },
        variable_name: { type: 'string', description: 'Variable name (alternative to ID)' },
        value:         { description: 'New value (boolean, number, or string depending on variable type)' },
      },
      required: ['value'],
    },
    async ({ variable_id, variable_name, value }) => {
      let id = variable_id;

      if (!id && variable_name) {
        const raw = await client.getVariables();
        const found = Object.values(raw).find(
          v => v.name?.toLowerCase() === variable_name.toLowerCase(),
        );
        if (!found) throw new Error(`Variable not found: "${variable_name}"`);
        id = found.id;
      }

      if (!id) throw new Error('Provide variable_id or variable_name');

      await client.updateVariable(id, { value });
      return { success: true, variable_id: id, value };
    },
  );

  server.registerTool(
    'logic_create',
    'Create a new logic variable on Homey.',
    {
      type: 'object',
      properties: {
        name:  { type: 'string', description: 'Variable name' },
        type:  { type: 'string', enum: ['boolean', 'number', 'string'], description: 'Variable type' },
        value: { description: 'Initial value' },
      },
      required: ['name', 'type'],
    },
    async ({ name, type, value }) => {
      const body = { name, type };
      if (value !== undefined) body.value = value;
      const result = await client.createVariable(body);
      return { success: true, variable_id: result.id, name, type, value };
    },
  );

  server.registerTool(
    'logic_delete',
    'Delete a logic variable.',
    {
      type: 'object',
      properties: {
        variable_id: { type: 'string', description: 'The variable ID to delete' },
      },
      required: ['variable_id'],
    },
    async ({ variable_id }) => {
      await client.deleteVariable(variable_id);
      return { success: true, variable_id, message: 'Variable deleted' };
    },
  );

};
