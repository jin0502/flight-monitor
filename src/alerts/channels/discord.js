const axios = require('axios');

/**
 * Sends a notification to a specific Discord channel under a Category.
 */
async function sendDiscordNotification(message, channelName, categoryName = 'System') {
    const token = process.env.DISCORD_BOT_TOKEN;
    const guildId = process.env.DISCORD_GUILD_ID;

    if (!token || !guildId) return;

    try {
        // Rate Limit Protection: Wait 1 second between alerts
        await new Promise(r => setTimeout(r, 1000));

        const normalizedCat = categoryName; // Keep original case for matching
        const normalizedChan = channelName.toLowerCase().replace(/\s+/g, '-');

        const categoryId = await getOrCreateCategory(guildId, normalizedCat, token);
        const channelId = await getOrCreateChannel(guildId, normalizedChan, categoryId, token);

        await axios.post(`https://discord.com/api/v10/channels/${channelId}/messages`, 
            { content: message },
            { headers: { Authorization: `Bot ${token}` } }
        );
    } catch (err) {
        if (err.response?.status === 429) {
            console.log(`[Discord] Rate limited. Waiting ${err.response.data.retry_after}s...`);
            await new Promise(r => setTimeout(r, err.response.data.retry_after * 1000));
        } else {
            console.error(`[Discord] Error: ${err.response?.data?.message || err.message}`);
        }
    }
}

async function getOrCreateCategory(guildId, name, token) {
    const headers = { Authorization: `Bot ${token}` };
    const { data: channels } = await axios.get(`https://discord.com/api/v10/guilds/${guildId}/channels`, { headers });
    
    // CASE-INSENSITIVE MATCH: Find if "China" or "CHINA" or "china" exists
    const existing = channels.find(c => c.name.toLowerCase() === name.toLowerCase() && c.type === 4);
    if (existing) return existing.id;

    console.log(`[Discord] Creating category: ${name}`);
    const { data: newCat } = await axios.post(`https://discord.com/api/v10/guilds/${guildId}/channels`, 
        { name, type: 4 }, { headers });
    return newCat.id;
}

async function getOrCreateChannel(guildId, name, categoryId, token) {
    const headers = { Authorization: `Bot ${token}` };
    const { data: channels } = await axios.get(`https://discord.com/api/v10/guilds/${guildId}/channels`, { headers });
    
    // CASE-INSENSITIVE MATCH: Avoid duplicate channels like #Tokyo vs #tokyo
    const existing = channels.find(c => c.name.toLowerCase() === name.toLowerCase() && c.parent_id === categoryId);
    if (existing) return existing.id;

    console.log(`[Discord] Creating channel: #${name}`);
    const { data: newChan } = await axios.post(`https://discord.com/api/v10/guilds/${guildId}/channels`, 
        { name, type: 0, parent_id: categoryId }, { headers });
    return newChan.id;
}

module.exports = { sendDiscordNotification };
