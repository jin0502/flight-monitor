const OneWayScanner = require('../../src/scanner/oneway-scanner');

describe('OneWayScanner', () => {
    let scanner;
    let mockPage;

    beforeEach(() => {
        mockPage = {
            url: jest.fn().mockReturnValue('https://us.trip.com/'),
            goto: jest.fn().mockResolvedValue({}),
            evaluate: jest.fn()
        };
        scanner = new OneWayScanner(mockPage);
    });

    test('scrapeDetailed should fetch flights and enrich with comfort data', async () => {
        const mockFlights = [
            {
                flightSegments: [{
                    flightNo: 'JL872',
                    airlineName: 'Japan Airlines',
                    departDateTime: '2026-05-01 09:00',
                    arriveDateTime: '2026-05-01 13:00'
                }],
                priceList: [{ price: 2500 }]
            }
        ];

        const mockComfort = [
            {
                flightNo: 'JL872',
                aircraftType: 'Boeing 787',
                hasWifi: true,
                hasEntertainment: true,
                hasPower: true
            }
        ];

        // First evaluate call is for FlightListSearch, second is for BatchGetFlightComfort
        mockPage.evaluate
            .mockResolvedValueOnce(mockFlights)
            .mockResolvedValueOnce(mockComfort);

        const results = await scanner.scrapeDetailed('PVG', 'NRT', '2026-05-01');

        expect(results).toHaveLength(1);
        expect(results[0].flightNo).toBe('JL872');
        expect(results[0].aircraftType).toBe('Boeing 787');
        expect(results[0].hasWifi).toBe(1);
        expect(mockPage.evaluate).toHaveBeenCalledTimes(2);
    });

    test('searchPOI should return results from API', async () => {
        const mockPOI = [{ name: 'Shanghai', code: 'SHA' }];
        mockPage.evaluate.mockResolvedValueOnce(mockPOI);

        const results = await scanner.searchPOI('Shanghai');
        expect(results).toHaveLength(1);
        expect(results[0].code).toBe('SHA');
    });
});
