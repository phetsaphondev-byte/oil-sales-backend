const db = require('./db');
async function run() {
    try {
        await db.query(`ALTER TABLE users MODIFY COLUMN role VARCHAR(50) DEFAULT 'staff'`);
        console.log("Successfully altered 'role' column to VARCHAR(50)");
    } catch(e) {
        console.log(e);
    }
    process.exit(0);
}
run();
