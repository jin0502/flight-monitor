const axios = require('axios');

/**
 * Sends a notification to a Telegram chat.
 * @param {string} message The message content.
 */
async function sendTelegramNotification(message) {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;

    if (!token || !chatId) {
        console.warn('Telegram token or chat ID not set. Skipping notification.');
        return;
    }

    const url = `https://api.telegram.org/bot${token}/sendMessage`;

    try {
        await axios.post(url, {
            chat_id: chatId,
            text: message,
            parse_mode: 'HTML'
        });
    } catch (error) {
        console.error('Error sending Telegram notification:', error.message);
        throw error;
    }
}

module.exports = {
    sendTelegramNotification
};
