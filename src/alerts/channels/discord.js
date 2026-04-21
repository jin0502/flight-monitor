const axios = require('axios');

/**
 * Sends a notification to a specific Discord channel based on the country.
 * @param {string} message The message content.
 * @param {string} country The destination country.
 */
async function sendDiscordNotification(message, country) {
    const token = process.env.DISCORD_BOT_TOKEN;
    const guildId = process.env.DISCORD_GUILD_ID;

    if (!token || !guildId) {
        console.warn('Discord bot token or guild ID not set. Skipping notification.');
        return;
    }

    try {
        const channelId = await getOrCreateChannel(country);
        const url = `https://discord.com/api/v10/channels/${channelId}/messages`;

        await axios.post(url, {
            content: message
        }, {
            headers: {
                'Authorization': `Bot ${token}`,
                'Content-Type': 'application/json'
            }
        });
    } catch (error) {
        console.error('Error sending Discord notification:', error.response?.data || error.message);
        throw error;
    }
}

/**
 * Finds a channel by name (normalized country) or creates it if it doesn't exist.
 * @param {string} countryName 
 * @returns {Promise<string>} The channel ID.
 */
async function getOrCreateChannel(countryName = 'general') {
    const token = process.env.DISCORD_BOT_TOKEN;
    const guildId = process.env.DISCORD_GUILD_ID;
    
    // Normalize country name for Discord channel channel-name (lowercase, alphanumeric, dashes)
    const normalizedName = countryName.toLowerCase()
        .replace(/[^a-z0-9\s]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .trim();
    
    const headers = { 'Authorization': `Bot ${token}` };

    // 1. List channels to find existing
    const { data: channels } = await axios.get(`https://discord.com/api/v10/guilds/${guildId}/channels`, { headers });
    
    const existing = channels.find(c => c.name === normalizedName && c.type === 0);
    if (existing) return existing.id;

    // 2. Not found, create it
    console.log(`Creating Discord channel #${normalizedName} for country: ${countryName}`);
    try {
        const { data: newChannel } = await axios.post(`https://discord.com/api/v10/guilds/${guildId}/channels`, {
            name: normalizedName,
            type: 0 // Guild Text Channel
        }, { headers });
        return newChannel.id;
    } catch (createError) {
        console.error(`Failed to create channel #${normalizedName}:`, createError.response?.data || createError.message);
        // Fallback to general if available
        const general = channels.find(c => c.name === 'general' && c.type === 0);
        return general ? general.id : channels[0].id;
    }
}

module.exports = {
    sendDiscordNotification
};
