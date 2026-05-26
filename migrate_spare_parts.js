const db = require('./db');
async function migrate() {
    try {
        await db.query(`ALTER TABLE spare_parts ADD COLUMN brand VARCHAR(100) NULL AFTER name`);
        await db.query(`ALTER TABLE spare_parts ADD COLUMN model_code VARCHAR(100) NULL AFTER brand`);
        await db.query(`ALTER TABLE spare_parts ADD COLUMN shop_name VARCHAR(255) NULL AFTER model_code`);
        await db.query(`ALTER TABLE spare_parts ADD COLUMN buyer_name VARCHAR(100) NULL AFTER shop_name`);
        console.log('Columns added successfully');
    } catch(e) {
        console.log('Error or columns already exist: ', e.message);
    }
    process.exit(0);
}
migrate();
