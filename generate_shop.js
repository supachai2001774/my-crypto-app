const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'data');
const SHOP_FILE = path.join(DATA_DIR, 'shop.json');

// Configuration for Exponential Progression
const LEVELS = 100;
const BASE_PRICE = 500;
const BASE_INCOME_MO = 300; // Income per month in Baht
const MULT_PRICE = 1.135; // 13.5% price increase per level
const MULT_INCOME = 1.10; // 10% income increase per level

// Helper to format large numbers
function formatPrice(num) {
    if (num < 1000) return Math.round(num / 10) * 10; // Round to nearest 10
    if (num < 10000) return Math.round(num / 100) * 100; // Round to nearest 100
    if (num < 1000000) return Math.round(num / 1000) * 1000; // Round to nearest 1000
    return Math.round(num / 10000) * 10000; // Round to nearest 10000
}

function getTier(lv) {
    if (lv <= 20) return 'basic';
    if (lv <= 50) return 'mid';
    if (lv <= 80) return 'pro';
    if (lv < 100) return 'legendary';
    return 'limited';
}

function getIcon(lv) {
    if (lv <= 20) return 'fa-fan';
    if (lv <= 40) return 'fa-server';
    if (lv <= 60) return 'fa-microchip';
    if (lv <= 80) return 'fa-memory';
    if (lv < 100) return 'fa-brain';
    return 'fa-rocket';
}

function getTag(lv) {
    if (lv === 1) return 'new';
    if (lv === 100) return 'best';
    if (lv % 25 === 0) return 'hot';
    if (lv % 10 === 0) return 'sale';
    return '';
}

const items = [];

console.log('Generating Shop Items...');
console.log('LV | Price | Income/Mo | Speed (Baht/s) | Break-Even (Mo)');
console.log('-----------------------------------------------------------');

for (let i = 1; i <= LEVELS; i++) {
    const rawPrice = BASE_PRICE * Math.pow(MULT_PRICE, i - 1);
    const price = formatPrice(rawPrice);
    
    const incomeMo = BASE_INCOME_MO * Math.pow(MULT_INCOME, i - 1);
    
    // Speed in existing system seems to be "Baht per Second" based on display logic
    // ≈ ฿${(i.speed * 86400).toLocaleString()}/วัน
    // Income/Day = IncomeMo / 30
    // Speed = IncomeDay / 86400 = IncomeMo / (30 * 86400)
    const speed = incomeMo / (30 * 24 * 3600);
    
    const breakEven = price / incomeMo;

    items.push({
        id: i,
        name: `AI Miner System Lv.${i}`,
        price: price,
        speed: speed,
        tier: getTier(i),
        icon: getIcon(i),
        tag: getTag(i)
    });

    if (i === 1 || i === 100 || i % 20 === 0) {
        console.log(`${i.toString().padEnd(3)} | ${price.toLocaleString().padEnd(10)} | ${Math.round(incomeMo).toLocaleString().padEnd(10)} | ${speed.toFixed(6).padEnd(10)} | ${breakEven.toFixed(1)}`);
    }
}

if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR);
}

fs.writeFileSync(SHOP_FILE, JSON.stringify(items, null, 2));
console.log(`\nSuccessfully wrote ${items.length} items to ${SHOP_FILE}`);
