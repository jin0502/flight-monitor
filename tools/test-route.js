const { runFullScan } = require('../src/scanner/index');
const { initDB } = require('../src/db');

async function testKIX() {
    console.log('--- TESTING PVG -> KIX WITH UPDATED ONEWAY SCANNER ---');
    await initDB();
    await runFullScan('PVG', 'KIX');
}

testKIX();
