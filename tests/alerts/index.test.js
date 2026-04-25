const { sendTopDealAlerts } = require('../../src/alerts/index');
const { initDB, saveFlight, saveCombinations } = require('../../src/db/index');

// Mock notification channels
jest.mock('../../src/alerts/channels/telegram', () => ({
    sendTelegramNotification: jest.fn().mockResolvedValue(true)
}));
jest.mock('../../src/alerts/channels/discord', () => ({
    sendDiscordNotification: jest.fn().mockResolvedValue(true)
}));

const { sendTelegramNotification } = require('../../src/alerts/channels/telegram');
const { sendDiscordNotification } = require('../../src/alerts/channels/discord');

describe('Alert Engine (New Architecture)', () => {
    let db;

    beforeAll(async () => {
        db = await initDB(':memory:');
    });

    afterAll((done) => {
        db.close(done);
    });

    test('should send alerts for top flight deals', async () => {
        const outFlight = {
            id: 1,
            origin: 'PVG',
            destination: 'NRT',
            date: '2026-05-01',
            flightNo: 'JL872',
            airline: 'Japan Airlines',
            departTime: '09:00',
            price: 2500,
            aircraftType: 'Boeing 787'
        };

        const retFlight = {
            id: 2,
            origin: 'NRT',
            destination: 'PVG',
            date: '2026-05-07',
            flightNo: 'JL873',
            airline: 'Japan Airlines',
            departTime: '14:00',
            price: 2300,
            aircraftType: 'Boeing 787'
        };

        // Save flights to get IDs
        const outId = await saveFlight(outFlight);
        const retId = await saveFlight(retFlight);

        const dealData = {
            outbound: outFlight,
            inbound: retFlight,
            total_price: 4800,
            gap_days: 6
        };

        await saveCombinations([dealData]);

        // Get the combination with its ID
        const deal = await new Promise((resolve) => {
            db.get("SELECT c.*, o.dest as destination_code FROM flight_combinations c JOIN flights o ON c.outbound_id = o.id", (err, row) => {
                resolve(row);
            });
        });

        await sendTopDealAlerts([deal], db);

        expect(sendTelegramNotification).toHaveBeenCalled();
        expect(sendDiscordNotification).toHaveBeenCalled();
        
        // Verify it was marked as alerted
        return new Promise((resolve) => {
            db.get("SELECT alerted FROM flight_combinations WHERE id = ?", [deal.id], (err, row) => {
                expect(row.alerted).toBe(1);
                resolve();
            });
        });
    });
});
