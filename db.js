// db.js
const mysql = require('mysql2');
require('dotenv').config(); // Load environment variables from .env file

const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '1234',
    database: process.env.DB_NAME || 'db_local',
    port: process.env.DB_PORT ? parseInt(process.env.DB_PORT) : 3306,
    ssl: (process.env.DB_SSL === 'true' || process.env.DB_HOST) ? { rejectUnauthorized: false } : undefined,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

module.exports = pool.promise(); // ໃຊ້ Promise ເພື່ອໃຫ້ຂຽນ async/await ໄດ້ງ່າຍ