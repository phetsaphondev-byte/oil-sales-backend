const db = require('./db');
async function check() {
    try {
        const [rows] = await db.query('DESCRIBE users');
        console.log(rows);
    } catch(e) {
        console.log(e);
    }
    process.exit(0);
}
check();
