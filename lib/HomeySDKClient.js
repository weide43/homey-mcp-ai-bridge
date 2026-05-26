'use strict';

const HomeyClient = require('./HomeyClient');

/**
 * HomeySDKClient — wraps HomeyAPIV3Local (via createAppAPI) for reads,
 * and HomeyClient in cloud mode (via PAT) for flow write operations.
 *
 * Constructor expects { api, pat, cloudId, homey }:
 *   api     — HomeyAPIV3Local instance from HomeyAPI.createAppAPI({ homey })
 *   pat     — Personal Access Token with homey.flow scope (optional)
 *   cloudId — Homey cloud ID for cloud API routing
 *   homey   — raw Homey App SDK instance (this.homey in app.js)
 */
class HomeySDKClient {

  constructor({ api, flowApi = null, homey }) {
    this.api     = api;
    this.flowApi = flowApi; // HomeyAPIV3Local session created at startup with PAT
    this.homey   = homey;
  }

  _flowApi() {
    if (!this.flowApi) {
      throw new Error(
        'Flow schrijfoperaties zijn niet beschikbaar. Controleer of het PAT token correct is ingesteld ' +
        'en herstart de app (Homey → MCP AI Bridge → Uitschakelen/Inschakelen).'
      );
    }
    return this.flowApi;
  }

  // ─── Devices ──────────────────────────────────────────────────────

  getDevices() {
    return this.api.devices.getDevices();
  }

  getDevice(id) {
    return this.api.devices.getDevice({ id });
  }

  async updateDevice(id, body) {
    return this.api.devices.updateDevice({ id, device: body });
  }

  async deleteDevice(id) {
    return this.api.devices.deleteDevice({ id });
  }

  async getCapability(id, capability) {
    return this.api.devices.getCapabilityValue({ deviceId: id, capabilityId: capability });
  }

  async setCapability(id, capability, value) {
    return this.api.devices.setCapabilityValue({ deviceId: id, capabilityId: capability, value });
  }

  // ─── Zones ────────────────────────────────────────────────────────

  getZones() {
    return this.api.zones.getZones();
  }

  getZone(id) {
    return this.api.zones.getZone({ id });
  }

  createZone(body) {
    return this.api.zones.createZone({ zone: body });
  }

  updateZone(id, body) {
    return this.api.zones.updateZone({ id, zone: body });
  }

  deleteZone(id) {
    return this.api.zones.deleteZone({ id });
  }

  // ─── Flows ────────────────────────────────────────────────────────

  getFlows() {
    return this.api.flow.getFlows();
  }

  getFlow(id) {
    return this.api.flow.getFlow({ id });
  }

  createFlow(body)              { return this._flowApi().flow.createFlow({ flow: body }); }
  updateFlow(id, body)          { return this._flowApi().flow.updateFlow({ id, flow: body }); }
  deleteFlow(id)                { return this._flowApi().flow.deleteFlow({ id }); }

  triggerFlow(id, tokens) {
    return this.api.flow.triggerFlow({ id, tokens: tokens || {} });
  }

  // ─── Advanced Flows ───────────────────────────────────────────────

  getAdvancedFlows() {
    return this.api.flow.getAdvancedFlows();
  }

  getAdvancedFlow(id) {
    return this.api.flow.getAdvancedFlow({ id });
  }

  createAdvancedFlow(body)              { return this._flowApi().flow.createAdvancedFlow({ advancedflow: body }); }
  updateAdvancedFlow(id, body)          { return this._flowApi().flow.updateAdvancedFlow({ id, advancedflow: body }); }
  deleteAdvancedFlow(id)                { return this._flowApi().flow.deleteAdvancedFlow({ id }); }

  triggerAdvancedFlow(id, tokens) {
    return this.api.flow.triggerAdvancedFlow({ id, tokens: tokens || {} });
  }

  getFlowTokens() {
    return this.api.flowtoken.getFlowTokens();
  }

  // ─── Flow Cards ───────────────────────────────────────────────────

  getFlowCardTriggers() {
    return this.api.flow.getFlowCardTriggers();
  }

  getFlowCardConditions() {
    return this.api.flow.getFlowCardConditions();
  }

  getFlowCardActions() {
    return this.api.flow.getFlowCardActions();
  }

  runFlowCardAction({ uri, id, args }) {
    return this.api.flow.runFlowCardAction({ uri, id, args: args || {} });
  }

  runFlowCardCondition({ uri, id, args }) {
    return this.api.flow.runFlowCardCondition({ uri, id, args: args || {} });
  }

  // ─── Flow Folders ─────────────────────────────────────────────────

  getFlowFolders() {
    return this.api.flow.getFlowFolders();
  }

  createFlowFolder(body)              { return this._flowApi().flow.createFlowFolder({ flowfolder: body }); }
  updateFlowFolder(id, body)          { return this._flowApi().flow.updateFlowFolder({ id, flowfolder: body }); }
  deleteFlowFolder(id)                { return this._flowApi().flow.deleteFlowFolder({ id }); }

  // ─── Logic (Variables) ────────────────────────────────────────────

  getVariables() {
    return this.api.logic.getVariables();
  }

  getVariable(id) {
    return this.api.logic.getVariable({ id });
  }

  createVariable(body) {
    return this.api.logic.createVariable({ variable: body });
  }

  updateVariable(id, body) {
    return this.api.logic.updateVariable({ id, variable: body });
  }

  deleteVariable(id) {
    return this.api.logic.deleteVariable({ id });
  }

  // ─── Insights ─────────────────────────────────────────────────────

  getInsightLogs() {
    return this.api.insights.getLogs();
  }

  getInsightEntries(uri, id, opts) {
    return this.api.insights.getLogEntries({ uri, id, ...(opts || {}) });
  }

  // ─── Notifications ────────────────────────────────────────────────

  getNotifications() {
    return this.api.notifications.getNotifications();
  }

  async createNotification(body) {
    // Notification creation is only available via the App SDK, not the REST API
    return this.homey.notifications.createNotification({ excerpt: body.excerpt || body.message || String(body) });
  }

  deleteNotification(id) {
    return this.api.notifications.deleteNotification({ id });
  }

  // ─── Apps ─────────────────────────────────────────────────────────

  getApps() {
    return this.api.apps.getApps();
  }

  getApp(id) {
    return this.api.apps.getApp({ id });
  }

  enableApp(id)    { return this.api.apps.enableApp({ id }); }
  disableApp(id)   { return this.api.apps.disableApp({ id }); }
  restartApp(id)   { return this.api.apps.restartApp({ id }); }
  updateApp(id)    { return this.api.apps.updateApp({ id }); }
  uninstallApp(id) { return this.api.apps.uninstallApp({ id }); }

  async getAppSettings(appId) {
    return this.api.apps.getAppSettings({ id: appId });
  }

  async setAppSetting(appId, key, value) {
    return this.api.apps.setAppSetting({ id: appId, name: key, value });
  }

  async unsetAppSetting(appId, key) {
    return this.api.apps.unsetAppSetting({ id: appId, name: key });
  }

  // ─── Users ────────────────────────────────────────────────────────

  getUsers() {
    return this.api.users.getUsers();
  }

  // ─── Geolocation ──────────────────────────────────────────────────

  async getGeolocation() {
    return this.api.geolocation.getState();
  }

  // ─── Presence ─────────────────────────────────────────────────────

  getPresence() {
    return this.api.presence.getPresent();
  }

  setPresence(userId, body) {
    return this.api.presence.setPresent({ id: userId, value: body.present !== undefined ? body.present : body });
  }

  setPresenceMe(body) {
    return this.api.presence.setPresentMe({ value: body.present !== undefined ? body.present : body });
  }

  setAsleep(userId, body) {
    return this.api.presence.setAsleep({ id: userId, value: body.asleep !== undefined ? body.asleep : body });
  }

  setAsleepMe(body) {
    return this.api.presence.setAsleepMe({ value: body.asleep !== undefined ? body.asleep : body });
  }

  // ─── Alarms ───────────────────────────────────────────────────────

  getAlarms() {
    return this.api.alarms.getAlarms();
  }

  getAlarm(id) {
    return this.api.alarms.getAlarm({ id });
  }

  createAlarm(body) {
    return this.api.alarms.createAlarm({ alarm: body });
  }

  updateAlarm(id, body) {
    return this.api.alarms.updateAlarm({ id, alarm: body });
  }

  deleteAlarm(id) {
    return this.api.alarms.deleteAlarm({ id });
  }

  // ─── System ───────────────────────────────────────────────────────

  getSystemInfo() {
    return this.api.system.getInfo();
  }

  getSystemMemory() {
    return this.api.system.getMemoryInfo();
  }

  getSystemStorage() {
    return this.api.system.getStorageInfo();
  }

  setSystemName(name) {
    return this.api.system.setSystemName({ name });
  }

  rebootSystem() {
    return this.api.system.reboot();
  }

  // ─── Energy ───────────────────────────────────────────────────────

  getEnergyOverview() {
    return this.api.energy.getState();
  }

  getEnergyLiveReport() {
    return this.api.energy.getLiveReport();
  }

  async getEnergyCurrency() {
    const state = await this.api.energy.getState();
    return state?.currency ?? null;
  }

  // B-02: these methods were called in energy.js but missing here
  async getEnergyKWhCost() {
    const state = await this.api.energy.getState();
    return state?.pricePerKWh ?? state?.costPerKwh ?? null;
  }

  async setEnergyKWhCost({ value }) {
    if (typeof this.api.energy.updateState === 'function') {
      return this.api.energy.updateState({ pricePerKWh: value });
    }
    throw new Error('Setting kWh cost is not supported by this Homey firmware version');
  }

  async setEnergyCurrency({ value }) {
    if (typeof this.api.energy.updateState === 'function') {
      return this.api.energy.updateState({ currency: value });
    }
    throw new Error('Setting energy currency is not supported by this Homey firmware version');
  }

  // ─── Audio (via App SDK — not in REST API) ────────────────────────

  async getAudioVolume() {
    const m = this.homey.audio;
    if (!m) throw new Error("Manager 'audio' is not available on this Homey");
    if (m.getVolume)       return m.getVolume();
    if (m.getOutputVolume) return m.getOutputVolume();
    throw new Error('getAudioVolume not available');
  }

  async setAudioVolume({ value }) {
    const m = this.homey.audio;
    if (!m) throw new Error("Manager 'audio' is not available on this Homey");
    if (m.setVolume)       { await m.setVolume({ volume: value }); return; }
    if (m.setOutputVolume) { await m.setOutputVolume({ volume: value }); return; }
    throw new Error('setAudioVolume not available');
  }

  // ─── Speech (via App SDK) ─────────────────────────────────────────

  async say(text, opts) {
    return this.homey.speechOutput.say(text, opts);
  }

  // ─── Ledring (via App SDK) ────────────────────────────────────────

  async ledringAnimate(anim) {
    const m = this.homey.ledring;
    if (!m) throw new Error("Manager 'ledring' is not available on this Homey");
    return m.animate(anim);
  }

}

module.exports = HomeySDKClient;
