'use strict';

/**
 * Notification tools - Send and manage Homey notifications
 */
module.exports = function registerNotificationTools(server, client) {

  server.registerTool(
    'notifications_send',
    'Send a notification to the Homey mobile app.',
    {
      type: 'object',
      properties: {
        message: { type: 'string', description: 'Notification message text' },
        excerpt: { type: 'string', description: 'Short excerpt shown in notification list (optional, defaults to message)' },
      },
      required: ['message'],
    },
    async ({ message, excerpt }) => {
      const body = {
        ownerUri: 'homey:app:community.mcp-ai-bridge',
        excerpt:  excerpt || message.substring(0, 100),
      };
      const result = await client.createNotification(body);
      return { success: true, notification_id: result?.id, message };
    },
  );

  server.registerTool(
    'notifications_list',
    'Get recent notifications from Homey.',
    {
      type: 'object',
      properties: {
        limit: { type: 'number', description: 'Maximum number of notifications to return (default: 20)' },
      },
    },
    async ({ limit = 20 }) => {
      const raw = await client.getNotifications();
      const notifications = Object.values(raw).slice(0, limit);
      return notifications.map(n => ({
        id:        n.id,
        excerpt:   n.excerpt,
        ownerUri:  n.ownerUri,
        dateAdded: n.dateAdded,
      }));
    },
  );

  server.registerTool(
    'notifications_delete',
    'Delete a notification.',
    {
      type: 'object',
      properties: {
        notification_id: { type: 'string', description: 'The notification ID to delete' },
      },
      required: ['notification_id'],
    },
    async ({ notification_id }) => {
      await client.deleteNotification(notification_id);
      return { success: true, notification_id };
    },
  );

};
