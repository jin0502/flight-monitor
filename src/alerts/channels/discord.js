const axios = require('axios');

/**
 * Sends a notification to a Discord channel via webhook.
 * @param {string} message The message content.
 */
async function sendDiscordNotification(message) {
    const webhookUrl = process.env.DISCORD_WEBHOOK_URL;

    if (!webhookUrl) {
        console.warn('Discord webhook URL not set. Skipping notification.');
        return;
    }

    try {
        await axios.post(webhookUrl, {
            content: message
        });
    } catch (error) {
        console.error('Error sending Discord notification:', error.message);
        throw error;
    }
}

module.exports = {
    sendDiscordNotification
};
