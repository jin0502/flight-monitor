const axios = require('axios');
const { sendTelegramNotification } = require('../../src/alerts/channels/telegram');
const { sendDiscordNotification } = require('../../src/alerts/channels/discord');

jest.mock('axios');

describe('Notification Channels', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        process.env.TELEGRAM_BOT_TOKEN = 'test_bot_token';
        process.env.TELEGRAM_CHAT_ID = 'test_chat_id';
        process.env.DISCORD_WEBHOOK_URL = 'https://discord.com/api/webhooks/test';
    });

    describe('Telegram Channel', () => {
        test('should send a notification to Telegram successfully', async () => {
            const message = 'Test Telegram Alert';
            axios.post.mockResolvedValue({ status: 200, data: { ok: true } });

            await sendTelegramNotification(message);

            expect(axios.post).toHaveBeenCalledWith(
                'https://api.telegram.org/bottest_bot_token/sendMessage',
                {
                    chat_id: 'test_chat_id',
                    text: message,
                    parse_mode: 'HTML'
                }
            );
        });

        test('should throw an error if Telegram notification fails', async () => {
            const message = 'Test Telegram Alert';
            axios.post.mockRejectedValue(new Error('Telegram API Error'));

            await expect(sendTelegramNotification(message)).rejects.toThrow('Telegram API Error');
        });
    });

    describe('Discord Channel', () => {
        test('should send a notification to Discord successfully', async () => {
            const message = 'Test Discord Alert';
            axios.post.mockResolvedValue({ status: 204 });

            await sendDiscordNotification(message);

            expect(axios.post).toHaveBeenCalledWith(
                'https://discord.com/api/webhooks/test',
                {
                    content: message
                }
            );
        });

        test('should throw an error if Discord notification fails', async () => {
            const message = 'Test Discord Alert';
            axios.post.mockRejectedValue(new Error('Discord API Error'));

            await expect(sendDiscordNotification(message)).rejects.toThrow('Discord API Error');
        });
    });
});
