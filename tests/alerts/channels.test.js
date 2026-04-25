const axios = require('axios');
const { sendTelegramNotification } = require('../../src/alerts/channels/telegram');
const { sendDiscordNotification } = require('../../src/alerts/channels/discord');

jest.mock('axios');

describe('Notification Channels', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        process.env.TELEGRAM_BOT_TOKEN = 'test_bot_token';
        process.env.TELEGRAM_CHAT_ID = 'test_chat_id';
        process.env.DISCORD_BOT_TOKEN = 'test_discord_token';
        process.env.DISCORD_GUILD_ID = 'test_guild_id';
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
    });

    describe('Discord Channel', () => {
        test('should find existing channel and send notification', async () => {
            const message = 'Test Discord Alert';
            const country = 'Japan';
            const channelId = '12345';
            
            // Mock getOrCreateChannel calls
            axios.get.mockResolvedValue({ data: [{ name: 'japan', id: channelId, type: 0 }] });
            axios.post.mockResolvedValue({ status: 200, data: { id: 'msg123' } });

            await sendDiscordNotification(message, country);

            // Verify channel list request
            expect(axios.get).toHaveBeenCalledWith(
                `https://discord.com/api/v10/guilds/test_guild_id/channels`,
                expect.any(Object)
            );
            
            // Verify message send request
            expect(axios.post).toHaveBeenCalledWith(
                `https://discord.com/api/v10/channels/${channelId}/messages`,
                { content: message },
                expect.any(Object)
            );
        });

        test('should create channel if not found and send notification', async () => {
            const message = 'Test Discord Alert';
            const country = 'Thailand';
            const newChannelId = '67890';
            
            // Mock channel search (empty), channel create, then msg send
            axios.get.mockResolvedValue({ data: [] });
            axios.post
                .mockResolvedValueOnce({ status: 201, data: { id: newChannelId } }) // Create channel
                .mockResolvedValueOnce({ status: 200, data: { id: 'msg456' } });  // Send message

            await sendDiscordNotification(message, country);

            expect(axios.post).toHaveBeenCalledWith(
                `https://discord.com/api/v10/guilds/test_guild_id/channels`,
                { name: 'thailand', type: 0 },
                expect.any(Object)
            );
        });
    });
});
