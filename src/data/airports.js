/**
 * Verified list of airports with DIRECT flights to/from Shanghai (PVG/SHA).
 * Hierarchy:
 * - Europe (excl UK) & SE Asia: { code, name, city, cityCode, country, region }
 * - Others: { code, name, city, cityCode, country, region: country }
 */
const airports = [
    // --- CHINA (Region = Country) ---
    { code: 'CAN', name: 'Guangzhou Baiyun', city: 'Guangzhou', cityCode: 'CAN', country: 'China', region: 'China' },
    { code: 'SZX', name: 'Shenzhen Bao\'an', city: 'Shenzhen', cityCode: 'SZX', country: 'China', region: 'China' },
    { code: 'CTU', name: 'Chengdu Shuangliu', city: 'Chengdu', cityCode: 'CTU', country: 'China', region: 'China' },
    { code: 'TFU', name: 'Chengdu Tianfu', city: 'Chengdu', cityCode: 'CTU', country: 'China', region: 'China' },
    { code: 'CKG', name: 'Chongqing Jiangbei', city: 'Chongqing', cityCode: 'CKG', country: 'China', region: 'China' },
    { code: 'XMN', name: 'Xiamen Gaoqi', city: 'Xiamen', cityCode: 'XMN', country: 'China', region: 'China' },
    { code: 'XIY', name: 'Xi\'an Xianyang', city: 'Xi\'an', cityCode: 'XIY', country: 'China', region: 'China' },
    { code: 'KMG', name: 'Kunming Changshui', city: 'Kunming', cityCode: 'KMG', country: 'China', region: 'China' },
    { code: 'SYX', name: 'Sanya Phoenix', city: 'Sanya', cityCode: 'SYX', country: 'China', region: 'China' },
    { code: 'FOC', name: 'Fuzhou Changle', city: 'Fuzhou', cityCode: 'FOC', country: 'China', region: 'China' },
    { code: 'KWL', name: 'Guilin Liangjiang', city: 'Guilin', cityCode: 'KWL', country: 'China', region: 'China' },
    { code: 'LJG', name: 'Lijiang Sanyi', city: 'Lijiang', cityCode: 'LJG', country: 'China', region: 'China' },
    { code: 'HAK', name: 'Haikou Meilan', city: 'Haikou', cityCode: 'HAK', country: 'China', region: 'China' },
    { code: 'URC', name: 'Urumqi Diwopu', city: 'Urumqi', cityCode: 'URC', country: 'China', region: 'China' },
    { code: 'DLC', name: 'Dalian Zhoushuizi', city: 'Dalian', cityCode: 'DLC', country: 'China', region: 'China' },
    { code: 'TNA', name: 'Jinan Yaoqiang', city: 'Jinan', cityCode: 'TNA', country: 'China', region: 'China' },
    { code: 'CGO', name: 'Zhengzhou Xinzheng', city: 'Zhengzhou', cityCode: 'CGO', country: 'China', region: 'China' },
    { code: 'NNG', name: 'Nanning Wuxu', city: 'Nanning', cityCode: 'NNG', country: 'China', region: 'China' },
    { code: 'SJW', name: 'Shijiazhuang Zhengding', city: 'Shijiazhuang', cityCode: 'SJW', country: 'China', region: 'China' },
    { code: 'LHW', name: 'Lanzhou Zhongchuan', city: 'Lanzhou', cityCode: 'LHW', country: 'China', region: 'China' },
    { code: 'INC', name: 'Yinchuan Hedong', city: 'Yinchuan', cityCode: 'INC', country: 'China', region: 'China' },

    // --- JAPAN (Region = Country) ---
    { code: 'NRT', name: 'Tokyo Narita', city: 'Tokyo', cityCode: 'TYO', country: 'Japan', region: 'Japan' },
    { code: 'HND', name: 'Tokyo Haneda', city: 'Tokyo', cityCode: 'TYO', country: 'Japan', region: 'Japan' },
    { code: 'KIX', name: 'Osaka Kansai', city: 'Osaka', cityCode: 'OSA', country: 'Japan', region: 'Japan' },
    { code: 'NGO', name: 'Nagoya Chubu', city: 'Nagoya', cityCode: 'OSA', country: 'Japan', region: 'Japan' },
    { code: 'FUK', name: 'Fukuoka', city: 'Fukuoka', cityCode: 'FUK', country: 'Japan', region: 'Japan' },
    { code: 'CTS', name: 'Sapporo New Chitose', city: 'Sapporo', cityCode: 'SPK', country: 'Japan', region: 'Japan' },
    { code: 'OKA', name: 'Okinawa Naha', city: 'Okinawa', cityCode: 'OKA', country: 'Japan', region: 'Japan' },

    // --- SOUTH KOREA (Region = Country) ---
    { code: 'ICN', name: 'Seoul Incheon', city: 'Seoul', cityCode: 'SEL', country: 'South Korea', region: 'South Korea' },
    { code: 'GMP', name: 'Seoul Gimpo', city: 'Seoul', cityCode: 'SEL', country: 'South Korea', region: 'South Korea' },
    { code: 'PUS', name: 'Busan Gimhae', city: 'Busan', cityCode: 'PUS', country: 'South Korea', region: 'South Korea' },
    { code: 'CJU', name: 'Jeju', city: 'Jeju', cityCode: 'CJU', country: 'South Korea', region: 'South Korea' },

    // --- SOUTHEAST ASIA (Region = Southeast Asia) ---
    { code: 'BKK', name: 'Bangkok Suvarnabhumi', city: 'Bangkok', cityCode: 'BKK', country: 'Thailand', region: 'Southeast Asia' },
    { code: 'DMK', name: 'Bangkok Don Mueang', city: 'Bangkok', cityCode: 'BKK', country: 'Thailand', region: 'Southeast Asia' },
    { code: 'HKT', name: 'Phuket', city: 'Phuket', cityCode: 'HKT', country: 'Thailand', region: 'Southeast Asia' },
    { code: 'CNX', name: 'Chiang Mai', city: 'Chiang Mai', cityCode: 'CNX', country: 'Thailand', region: 'Southeast Asia' },
    { code: 'SGN', name: 'Ho Chi Minh City', city: 'Ho Chi Minh City', cityCode: 'SGN', country: 'Vietnam', region: 'Southeast Asia' },
    { code: 'HAN', name: 'Hanoi', city: 'Hanoi', cityCode: 'HAN', country: 'Vietnam', region: 'Southeast Asia' },
    { code: 'SIN', name: 'Singapore Changi', city: 'Singapore', cityCode: 'SIN', country: 'Singapore', region: 'Southeast Asia' },
    { code: 'KUL', name: 'Kuala Lumpur', city: 'Kuala Lumpur', cityCode: 'KUL', country: 'Malaysia', region: 'Southeast Asia' },
    { code: 'MNL', name: 'Manila Ninoy Aquino', city: 'Manila', cityCode: 'MNL', country: 'Philippines', region: 'Southeast Asia' },
    { code: 'CGK', name: 'Jakarta Soekarno-Hatta', city: 'Jakarta', cityCode: 'JKT', country: 'Indonesia', region: 'Southeast Asia' },
    { code: 'DPS', name: 'Bali Denpasar', city: 'Bali', cityCode: 'DPS', country: 'Indonesia', region: 'Southeast Asia' },

    // --- EUROPE (EXCL UK) (Region = Europe) ---
    { code: 'CDG', name: 'Paris Charles de Gaulle', city: 'Paris', cityCode: 'PAR', country: 'France', region: 'Europe' },
    { code: 'FRA', name: 'Frankfurt', city: 'Frankfurt', cityCode: 'FRA', country: 'Germany', region: 'Europe' },
    { code: 'MUC', name: 'Munich', city: 'Munich', cityCode: 'MUC', country: 'Germany', region: 'Europe' },
    { code: 'FCO', name: 'Rome Fiumicino', city: 'Rome', cityCode: 'ROM', country: 'Italy', region: 'Europe' },
    { code: 'MXP', name: 'Milan Malpensa', city: 'Milan', cityCode: 'MIL', country: 'Italy', region: 'Europe' },
    { code: 'MAD', name: 'Madrid Barajas', city: 'Madrid', cityCode: 'MAD', country: 'Spain', region: 'Europe' },
    { code: 'BCN', name: 'Barcelona El Prat', city: 'Barcelona', cityCode: 'BCN', country: 'Spain', region: 'Europe' },
    { code: 'AMS', name: 'Amsterdam Schiphol', city: 'Amsterdam', cityCode: 'AMS', country: 'Netherlands', region: 'Europe' },
    { code: 'ZRH', name: 'Zurich', city: 'Zurich', cityCode: 'ZRH', country: 'Switzerland', region: 'Europe' },
    { code: 'BRU', name: 'Brussels', city: 'Brussels', cityCode: 'BRU', country: 'Belgium', region: 'Europe' },
    { code: 'VIE', name: 'Vienna', city: 'Vienna', cityCode: 'VIE', country: 'Austria', region: 'Europe' },

    // --- UNITED KINGDOM (Region = Country) ---
    { code: 'LHR', name: 'London Heathrow', city: 'London', cityCode: 'LON', country: 'United Kingdom', region: 'United Kingdom' },
    { code: 'LGW', name: 'London Gatwick', city: 'London', cityCode: 'LON', country: 'United Kingdom', region: 'United Kingdom' },

    // --- AUSTRALIA (Region = Country) ---
    { code: 'SYD', name: 'Sydney', city: 'Sydney', cityCode: 'SYD', country: 'Australia', region: 'Australia' },
    { code: 'MEL', name: 'Melbourne', city: 'Melbourne', cityCode: 'MEL', country: 'Australia', region: 'Australia' },
    { code: 'BNE', name: 'Brisbane', city: 'Brisbane', cityCode: 'BNE', country: 'Australia', region: 'Australia' },
    { code: 'PER', name: 'Perth', city: 'Perth', cityCode: 'PER', country: 'Australia', region: 'Australia' }
];

module.exports = airports;
