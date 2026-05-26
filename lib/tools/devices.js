'use strict';

/**
 * Device tools - Full CRUD + capability control for all Homey devices
 */
module.exports = function registerDeviceTools(server, client) {

  // ─── List all devices ─────────────────────────────────────────────

  server.registerTool(
    'devices_list',
    'List all devices on Homey. Optionally filter by zone ID, device class, or capability.',
    {
      type: 'object',
      properties: {
        zone_id:    { type: 'string', description: 'Filter by zone ID' },
        class:      { type: 'string', description: 'Filter by device class (e.g. light, socket, sensor, thermostat, speaker, tv, lock, camera, fan, heater, windowcoverings)' },
        capability: { type: 'string', description: 'Filter devices that have a specific capability (e.g. onoff, dim, measure_temperature)' },
        available:  { type: 'boolean', description: 'Filter by availability (true = only available devices)' },
      },
    },
    async ({ zone_id, class: deviceClass, capability, available }) => {
      const raw = await client.getDevices();
      let devices = Object.values(raw);

      if (zone_id)      devices = devices.filter(d => d.zone === zone_id);
      if (deviceClass)  devices = devices.filter(d => d.class === deviceClass);
      if (capability)   devices = devices.filter(d => d.capabilities?.includes(capability));
      if (available !== undefined) devices = devices.filter(d => d.available === available);

      return devices.map(d => ({
        id:           d.id,
        name:         d.name,
        class:        d.class,
        zone:         d.zone,
        available:    d.available,
        capabilities: d.capabilities,
        ui_indicator: d.ui?.quickAction,
      }));
    },
  );

  // ─── Get single device ────────────────────────────────────────────

  server.registerTool(
    'devices_get',
    'Get full details of a specific device including all capability values, settings, and metadata.',
    {
      type: 'object',
      properties: {
        device_id: { type: 'string', description: 'The device ID' },
      },
      required: ['device_id'],
    },
    async ({ device_id }) => {
      const device = await client.getDevice(device_id);
      return {
        id:                device.id,
        name:              device.name,
        class:             device.class,
        zone:              device.zone,
        available:         device.available,
        ready:             device.ready,
        capabilities:      device.capabilities,
        capabilitiesObj:   device.capabilitiesObj,
        settings:          device.settings,
        driverUri:         device.driverUri,
        driverId:          device.driverId,
        data:              device.data,
        icon:              device.icon,
        energy:            device.energy,
      };
    },
  );

  // ─── Get device state (all capability values) ─────────────────────

  server.registerTool(
    'devices_get_state',
    'Get the current state (all capability values) of a specific device.',
    {
      type: 'object',
      properties: {
        device_id: { type: 'string', description: 'The device ID' },
      },
      required: ['device_id'],
    },
    async ({ device_id }) => {
      const device = await client.getDevice(device_id);
      return {
        id:              device.id,
        name:            device.name,
        available:       device.available,
        capabilitiesObj: device.capabilitiesObj,
      };
    },
  );

  // ─── Set capability value ─────────────────────────────────────────

  server.registerTool(
    'devices_set_capability',
    `Set any capability value on any device. This is the universal control tool.
Examples:
- Turn on a light: capability="onoff", value=true
- Dim a light to 50%: capability="dim", value=0.5 (0.0–1.0)
- Set thermostat to 21°C: capability="target_temperature", value=21
- Set volume to 40%: capability="volume_set", value=0.4
- Change AC mode: capability="thermostat_mode", value="heat"`,
    {
      type: 'object',
      properties: {
        device_id:  { type: 'string',  description: 'The device ID' },
        capability: { type: 'string',  description: 'Capability name (e.g. onoff, dim, target_temperature, volume_set)' },
        value:      {                  description: 'New value. Type depends on capability: boolean for onoff, number 0-1 for dim, number for temperatures, string for modes.' },
      },
      required: ['device_id', 'capability', 'value'],
    },
    async ({ device_id, capability, value }) => {
      await client.setCapability(device_id, capability, value);
      return { success: true, device_id, capability, value };
    },
  );

  // ─── Get capability value ─────────────────────────────────────────

  server.registerTool(
    'devices_get_capability',
    'Get the current value of a specific capability on a device.',
    {
      type: 'object',
      properties: {
        device_id:  { type: 'string', description: 'The device ID' },
        capability: { type: 'string', description: 'Capability name (e.g. onoff, dim, measure_temperature)' },
      },
      required: ['device_id', 'capability'],
    },
    async ({ device_id, capability }) => {
      const result = await client.getCapability(device_id, capability);
      // B-04: getCapabilityValue returns the raw value, not an object
      if (result === null || result === undefined) {
        throw new Error(`Capability "${capability}" not found or has no value on device "${device_id}"`);
      }
      // The API may return the raw value directly or an object with .value
      const value = (result !== null && typeof result === 'object' && 'value' in result)
        ? result.value
        : result;
      const lastUpdated = (result !== null && typeof result === 'object') ? result.lastUpdated : undefined;
      return { device_id, capability, value, lastUpdated };
    },
  );

  // ─── Rename device ────────────────────────────────────────────────

  server.registerTool(
    'devices_rename',
    'Rename a device.',
    {
      type: 'object',
      properties: {
        device_id: { type: 'string', description: 'The device ID' },
        name:      { type: 'string', description: 'New name for the device' },
      },
      required: ['device_id', 'name'],
    },
    async ({ device_id, name }) => {
      await client.updateDevice(device_id, { name });
      return { success: true, device_id, name };
    },
  );

  // ─── Move device to zone ──────────────────────────────────────────

  server.registerTool(
    'devices_move_to_zone',
    'Move a device to a different zone/room.',
    {
      type: 'object',
      properties: {
        device_id: { type: 'string', description: 'The device ID' },
        zone_id:   { type: 'string', description: 'Target zone ID' },
      },
      required: ['device_id', 'zone_id'],
    },
    async ({ device_id, zone_id }) => {
      await client.updateDevice(device_id, { zone: zone_id });
      return { success: true, device_id, zone_id };
    },
  );

  // ─── Delete device ────────────────────────────────────────────────

  server.registerTool(
    'devices_delete',
    'Remove/delete a device from Homey. This cannot be undone.',
    {
      type: 'object',
      properties: {
        device_id: { type: 'string', description: 'The device ID to delete' },
      },
      required: ['device_id'],
    },
    async ({ device_id }) => {
      await client.deleteDevice(device_id);
      return { success: true, device_id, message: 'Device deleted successfully' };
    },
  );

  // ─── Bulk control zone devices ────────────────────────────────────

  server.registerTool(
    'devices_zone_set_capability',
    'Set a capability on ALL devices in a zone that support it. Useful for turning all lights on/off in a room.',
    {
      type: 'object',
      properties: {
        zone_id:    { type: 'string',  description: 'The zone ID' },
        capability: { type: 'string',  description: 'Capability to set on all matching devices in the zone' },
        value:      {                  description: 'Value to set' },
        class:      { type: 'string',  description: 'Optional: only affect devices of this class (e.g. light)' },
      },
      required: ['zone_id', 'capability', 'value'],
    },
    async ({ zone_id, capability, value, class: deviceClass }) => {
      const raw = await client.getDevices();
      let devices = Object.values(raw).filter(d =>
        d.zone === zone_id && d.capabilities?.includes(capability) && d.available,
      );
      if (deviceClass) devices = devices.filter(d => d.class === deviceClass);

      const results = await Promise.allSettled(
        devices.map(d => client.setCapability(d.id, capability, value)),
      );

      const succeeded = results.filter(r => r.status === 'fulfilled').length;
      const failed    = results.filter(r => r.status === 'rejected').length;

      // B-12: surface a clear error when every device failed
      if (devices.length > 0 && succeeded === 0) {
        throw new Error(
          `Failed to set "${capability}" on all ${failed} device(s) in zone. ` +
          `Devices: ${devices.map(d => d.name).join(', ')}`
        );
      }

      return {
        zone_id, capability, value,
        devicesAffected: succeeded,
        devicesFailed:   failed,
        deviceNames:     devices.map(d => d.name),
      };
    },
  );

  // ─── Get all device states (full home overview) ───────────────────

  server.registerTool(
    'devices_get_all_states',
    'Get the current state of ALL devices in the home. Returns a compact overview grouped by zone.',
    {
      type: 'object',
      properties: {
        zone_id:   { type: 'string', description: 'Optional: only return devices in this zone' },
        class:     { type: 'string', description: 'Optional: filter by device class' },
      },
    },
    async ({ zone_id, class: deviceClass }) => {
      const raw = await client.getDevices();
      let devices = Object.values(raw);

      if (zone_id)     devices = devices.filter(d => d.zone === zone_id);
      if (deviceClass) devices = devices.filter(d => d.class === deviceClass);

      // Group by zone
      const byZone = {};
      for (const d of devices) {
        const z = d.zone || 'unassigned';
        if (!byZone[z]) byZone[z] = [];
        byZone[z].push({
          id:        d.id,
          name:      d.name,
          class:     d.class,
          available: d.available,
          state:     d.capabilitiesObj,
        });
      }
      return byZone;
    },
  );

};
