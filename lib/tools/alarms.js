'use strict';

/**
 * Alarm tools - Full CRUD for Homey alarm clock
 */
module.exports = function registerAlarmTools(server, client) {

  server.registerTool(
    'alarms_list',
    'List all alarm clocks configured on Homey.',
    {
      type: 'object',
      properties: {
        enabled_only: { type: 'boolean', description: 'Only return enabled alarms' },
      },
    },
    async ({ enabled_only }) => {
      const raw = await client.getAlarms();
      let alarms = Object.values(raw);
      if (enabled_only) alarms = alarms.filter(a => a.enabled);
      return alarms.map(a => ({
        id:      a.id,
        name:    a.name,
        enabled: a.enabled,
        time:    a.time,
        days:    a.days,
        nextOccurrence: a.nextOccurrence,
      }));
    },
  );

  server.registerTool(
    'alarms_get',
    'Get details of a specific alarm.',
    {
      type: 'object',
      properties: {
        alarm_id: { type: 'string', description: 'The alarm ID' },
      },
      required: ['alarm_id'],
    },
    async ({ alarm_id }) => {
      return client.getAlarm(alarm_id);
    },
  );

  server.registerTool(
    'alarms_create',
    'Create a new alarm clock on Homey.',
    {
      type: 'object',
      properties: {
        name:    { type: 'string',  description: 'Alarm name (e.g. "Wake up")' },
        time:    { type: 'string',  description: 'Alarm time in HH:MM format (e.g. "07:30")' },
        enabled: { type: 'boolean', description: 'Start enabled (default: true)' },
        days:    {
          type: 'array',
          items: { type: 'number', minimum: 0, maximum: 6 },
          description: 'Days of week: 0=Monday, 1=Tuesday, ... 6=Sunday. Empty = one-time alarm.',
        },
      },
      required: ['name', 'time'],
    },
    async ({ name, time, enabled = true, days = [] }) => {
      const result = await client.createAlarm({ name, time, enabled, days });
      return { success: true, alarm_id: result.id, name, time, enabled, days };
    },
  );

  server.registerTool(
    'alarms_update',
    'Update an existing alarm (name, time, days, enabled).',
    {
      type: 'object',
      properties: {
        alarm_id: { type: 'string',  description: 'The alarm ID to update' },
        name:     { type: 'string',  description: 'New name' },
        time:     { type: 'string',  description: 'New time in HH:MM format' },
        enabled:  { type: 'boolean', description: 'Enable or disable the alarm' },
        days:     { type: 'array', items: { type: 'number' }, description: 'New days array (0=Mon ... 6=Sun)' },
      },
      required: ['alarm_id'],
    },
    async ({ alarm_id, name, time, enabled, days }) => {
      // B-08: pick only known fields — never forward arbitrary keys to the API
      const updates = {};
      if (name    !== undefined) updates.name    = name;
      if (time    !== undefined) updates.time    = time;
      if (enabled !== undefined) updates.enabled = enabled;
      if (days    !== undefined) updates.days    = days;
      await client.updateAlarm(alarm_id, updates);
      return { success: true, alarm_id, updated: updates };
    },
  );

  server.registerTool(
    'alarms_delete',
    'Delete an alarm clock.',
    {
      type: 'object',
      properties: {
        alarm_id: { type: 'string', description: 'The alarm ID to delete' },
      },
      required: ['alarm_id'],
    },
    async ({ alarm_id }) => {
      await client.deleteAlarm(alarm_id);
      return { success: true, alarm_id, message: 'Alarm deleted' };
    },
  );

};
