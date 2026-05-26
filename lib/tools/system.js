'use strict';

/**
 * System tools - Homey system info, speech, LED ring
 */
module.exports = function registerSystemTools(server, client, homeyInstance) {

  server.registerTool(
    'system_get_info',
    'Get Homey system information: version, platform, memory, CPU, uptime, and network info.',
    { type: 'object', properties: {} },
    async () => {
      return client.getSystemInfo();
    },
  );

  server.registerTool(
    'system_get_memory',
    'Get Homey memory (RAM) usage statistics.',
    { type: 'object', properties: {} },
    async () => {
      return client.getSystemMemory();
    },
  );

  server.registerTool(
    'system_get_storage',
    'Get Homey storage (disk) usage statistics.',
    { type: 'object', properties: {} },
    async () => {
      return client.getSystemStorage();
    },
  );

  server.registerTool(
    'system_rename',
    'Rename the Homey (changes the system name visible in the app).',
    {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'New name for the Homey' },
      },
      required: ['name'],
    },
    async ({ name }) => {
      await client.setSystemName(name);
      return { success: true, name };
    },
  );

  server.registerTool(
    'system_reboot',
    '⚠️ Reboot the Homey. All apps will restart. Use with caution.',
    {
      type: 'object',
      properties: {
        confirm: { type: 'boolean', description: 'Must be true to confirm the reboot' },
      },
      required: ['confirm'],
    },
    async ({ confirm }) => {
      if (!confirm) throw new Error('Set confirm=true to reboot the Homey');
      await client.rebootSystem();
      return { success: true, message: 'Homey is rebooting...' };
    },
  );

  // ─── Speech output (TTS) ──────────────────────────────────────────

  server.registerTool(
    'speech_say',
    'Make Homey say something out loud using text-to-speech.',
    {
      type: 'object',
      properties: {
        text:     { type: 'string', description: 'Text to speak' },
        language: { type: 'string', description: 'Language code (e.g. "en", "nl", "de", "fr", "es"). Defaults to Homey system language.' },
      },
      required: ['text'],
    },
    async ({ text, language }) => {
      if (!homeyInstance) throw new Error('Homey instance not available');
      const opts = {};
      if (language) opts.language = language;
      await homeyInstance.speechOutput.say(text, opts);
      return { success: true, text, language };
    },
  );

  // ─── LED ring ─────────────────────────────────────────────────────

  server.registerTool(
    'ledring_animate',
    'Animate the Homey LED ring. Available animations: "loading", "pulse", "solid", "off".',
    {
      type: 'object',
      properties: {
        animation: {
          type: 'string',
          enum: ['loading', 'pulse', 'solid', 'off'],
          description: 'Animation type',
        },
        color: {
          type: 'string',
          description: 'Color as hex string (e.g. "#ff0000" for red). Used for solid and pulse.',
        },
        duration: {
          type: 'number',
          description: 'Duration in milliseconds (optional, for temporary animations)',
        },
      },
      required: ['animation'],
    },
    async ({ animation, color, duration }) => {
      if (!homeyInstance) throw new Error('Homey instance not available');
      const ledring = homeyInstance.ledring;
      // B-14: guard against null ledring manager before any call
      if (!ledring) throw new Error("Manager 'ledring' is not available on this Homey");

      if (animation === 'off') {
        await ledring.stopAll();
        return { success: true, animation: 'off' };
      }

      const animObj = { animation };
      if (color)    animObj.color = color;
      if (duration) animObj.duration = duration;

      await ledring.animate(animObj);
      return { success: true, animation, color, duration };
    },
  );

  // ─── Energy overview ──────────────────────────────────────────────

  server.registerTool(
    'system_get_energy',
    'Get the current energy overview from Homey Energy (if available).',
    { type: 'object', properties: {} },
    async () => {
      try {
        return await client.getEnergyOverview();
      } catch (e) {
        return { error: 'Energy manager not available', details: e.message };
      }
    },
  );

};
