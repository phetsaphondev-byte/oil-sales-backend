const db = require('./db');

async function migrate() {
    try {
        await db.query(`ALTER TABLE spare_parts ADD COLUMN image_url TEXT NULL AFTER location`);
        console.log('image_url column added successfully to spare_parts table.');
    } catch(e) {
        console.log('Info or column already exists: ', e.message);
    }
    process.exit(0);
}

migrate();
