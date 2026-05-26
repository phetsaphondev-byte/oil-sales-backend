const db = require('./db');
async function migrate() {
    try {
        await db.query(`
            CREATE TABLE IF NOT EXISTS branch_orders (
                id INT AUTO_INCREMENT PRIMARY KEY,
                branch_id INT NOT NULL,
                item_type VARCHAR(50) NOT NULL,
                item_detail VARCHAR(255) NOT NULL,
                quantity DECIMAL(10, 2) NOT NULL,
                status VARCHAR(50) DEFAULT 'pending',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);
        console.log('branch_orders table created successfully');
    } catch(e) {
        console.log('Error: ', e.message);
    }
    process.exit(0);
}
migrate();
