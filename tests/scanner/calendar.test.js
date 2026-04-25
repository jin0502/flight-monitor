const DirectCalendarScanner = require('../../src/scanner/direct-calendar-scanner');
const https = require('https');
const EventEmitter = require('events');

jest.mock('https');

describe('DirectCalendarScanner', () => {
    let scanner;

    beforeEach(() => {
        scanner = new DirectCalendarScanner();
        jest.clearAllMocks();
    });

    test('fetchDomestic should return top 3 cheap dates', async () => {
        const mockResponse = JSON.stringify({
            data: {
                oneWayPrice: [{
                    '20260501': 500,
                    '20260502': 400,
                    '20260503': 600,
                    '20260504': 300
                }]
            }
        });

        const mockRes = new EventEmitter();
        mockRes.on('data', () => {}); // Just for interface
        
        https.get.mockImplementation((url, options, callback) => {
            const res = new EventEmitter();
            process.nextTick(() => {
                res.emit('data', mockResponse);
                res.emit('end');
            });
            callback(res);
            return { on: jest.fn() };
        });

        const dates = await scanner.fetchDomestic('PVG', 'CAN');
        expect(dates).toHaveLength(3);
        expect(dates[0]).toBe('2026-05-04'); // Cheapest
        expect(dates[1]).toBe('2026-05-02');
    });

    test('fetchInternational should return cheap dates from priceList', async () => {
        // 2026-05-10
        const date1 = new Date('2026-05-10').getTime();
        // 2026-05-15
        const date2 = new Date('2026-05-15').getTime();

        const mockResponse = JSON.stringify({
            priceList: [
                { price: 1000, departDate: `/Date(${date1}+0800)/` },
                { price: 800, departDate: `/Date(${date2}+0800)/` }
            ]
        });

        const mockReq = new EventEmitter();
        mockReq.write = jest.fn();
        mockReq.end = jest.fn();

        https.request.mockImplementation((options, callback) => {
            const res = new EventEmitter();
            process.nextTick(() => {
                res.emit('data', mockResponse);
                res.emit('end');
            });
            callback(res);
            return mockReq;
        });

        const dates = await scanner.fetchInternational('PVG', 'NRT');
        expect(dates).toHaveLength(2);
        expect(dates[0]).toBe('2026-05-15'); // Cheapest price first
    });
});
