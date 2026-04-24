/**
 * Curated list of 48 airports for the Shanghai Flight Monitor.
 * Includes major hubs in East Asia, Southeast Asia, Europe, and Oceania.
 */
const airports = [
    // China (21)
    { code: 'CAN', name: 'Guangzhou', region: 'China' },
    { code: 'SZX', name: 'Shenzhen', region: 'China' },
    { code: 'CTU', name: 'Chengdu Shuangliu', region: 'China' },
    { code: 'TFU', name: 'Chengdu Tianfu', region: 'China' },
    { code: 'CKG', name: 'Chongqing', region: 'China' },
    { code: 'XMN', name: 'Xiamen', region: 'China' },
    { code: 'XIY', name: 'Xi\'an', region: 'China' },
    { code: 'KMG', name: 'Kunming', region: 'China' },
    { code: 'SYX', name: 'Sanya', region: 'China' },
    { code: 'FOC', name: 'Fuzhou', region: 'China' },
    { code: 'KWL', name: 'Guilin', region: 'China' },
    { code: 'LJG', name: 'Lijiang', region: 'China' },
    { code: 'HAK', name: 'Haikou', region: 'China' },
    { code: 'URC', name: 'Urumqi', region: 'China' },
    { code: 'DLC', name: 'Dalian', region: 'China' },
    { code: 'TNA', name: 'Jinan', region: 'China' },
    { code: 'CGO', name: 'Zhengzhou', region: 'China' },
    { code: 'NNG', name: 'Nanning', region: 'China' },
    { code: 'SJW', name: 'Shijiazhuang', region: 'China' },
    { code: 'LHW', name: 'Lanzhou', region: 'China' },
    { code: 'INC', name: 'Yinchuan', region: 'China' },

    // Japan (7)
    { code: 'NRT', name: 'Tokyo Narita', region: 'Japan' },
    { code: 'HND', name: 'Tokyo Haneda', region: 'Japan' },
    { code: 'KIX', name: 'Osaka Kansai', region: 'Japan' },
    { code: 'NGO', name: 'Nagoya', region: 'Japan' },
    { code: 'FUK', name: 'Fukuoka', region: 'Japan' },
    { code: 'CTS', name: 'Sapporo', region: 'Japan' },
    { code: 'OKA', name: 'Okinawa', region: 'Japan' },

    // South Korea (3)
    { code: 'ICN', name: 'Seoul Incheon', region: 'South Korea' },
    { code: 'PUS', name: 'Busan', region: 'South Korea' },
    { code: 'CJU', name: 'Jeju', region: 'South Korea' },

    // Southeast Asia (17)
    { code: 'BKK', name: 'Bangkok Suvarnabhumi', region: 'Thailand' },
    { code: 'DMK', name: 'Bangkok Don Mueang', region: 'Thailand' },
    { code: 'HKT', name: 'Phuket', region: 'Thailand' },
    { code: 'CNX', name: 'Chiang Mai', region: 'Thailand' },
    { code: 'SGN', name: 'Ho Chi Minh City', region: 'Vietnam' },
    { code: 'HAN', name: 'Hanoi', region: 'Vietnam' },
    { code: 'DAD', name: 'Da Nang', region: 'Vietnam' },
    { code: 'SIN', name: 'Singapore', region: 'Singapore' },
    { code: 'KUL', name: 'Kuala Lumpur', region: 'Malaysia' },
    { code: 'MNL', name: 'Manila', region: 'Philippines' },
    { code: 'CEB', name: 'Cebu', region: 'Philippines' },
    { code: 'PNH', name: 'Phnom Penh', region: 'Cambodia' },
    { code: 'REP', name: 'Siem Reap', region: 'Cambodia' },
    { code: 'CGK', name: 'Jakarta', region: 'Indonesia' },
    { code: 'DPS', name: 'Bali', region: 'Indonesia' },

    // Europe (12)
    { code: 'LHR', name: 'London Heathrow', region: 'UK' },
    { code: 'CDG', name: 'Paris Charles de Gaulle', region: 'France' },
    { code: 'FRA', name: 'Frankfurt', region: 'Germany' },
    { code: 'MUC', name: 'Munich', region: 'Germany' },
    { code: 'FCO', name: 'Rome Fiumicino', region: 'Italy' },
    { code: 'MXP', name: 'Milan Malpensa', region: 'Italy' },
    { code: 'MAD', name: 'Madrid', region: 'Spain' },
    { code: 'AMS', name: 'Amsterdam', region: 'Netherlands' },
    { code: 'ZRH', name: 'Zurich', region: 'Switzerland' },
    { code: 'BRU', name: 'Brussels', region: 'Belgium' },
    { code: 'VIE', name: 'Vienna', region: 'Austria' },

    // Middle East (3)
    { code: 'DXB', name: 'Dubai', region: 'UAE' },
    { code: 'AUH', name: 'Abu Dhabi', region: 'UAE' },
    { code: 'DOH', name: 'Doha', region: 'Qatar' },

    // Oceania (2)
    { code: 'SYD', name: 'Sydney', region: 'Australia' },
    { code: 'MEL', name: 'Melbourne', region: 'Australia' }
];

module.exports = airports;
