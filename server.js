// server.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('./db');

const fs = require('fs');
const path = require('path');

const JWT_SECRET = process.env.JWT_SECRET || 'your-default-super-secret-key-123456';

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' })); // ຮອງຮັບການສົ່ງຂໍ້ມູນແບບ JSON (ຂະຫຍາຍຂະໜາດ)
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')));

// ==========================================
// 1. MIDDLEWARES & AUTHENTICATION
// ==========================================

// Middleware: ກວດສອບ JWT Token
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // "Bearer <TOKEN>"

    if (!token) {
        return res.status(401).json({ success: false, message: 'ກະລຸນາເຂົ້າສູ່ລະບົບ (Unauthorized)' });
    }

    jwt.verify(token, JWT_SECRET, (err, decoded) => {
        if (err) {
            return res.status(403).json({ success: false, message: 'Token ບໍ່ຖືກຕ້ອງ ຫຼື ໝົດອາຍຸ (Forbidden)' });
        }
        req.user = decoded;
        next();
    });
};

// Middleware: ກວດສອບສິດ/ບົດບາດ (Role check)
const requireRole = (allowedRoles) => {
    return (req, res, next) => {
        if (!req.user || !allowedRoles.includes(req.user.role)) {
            return res.status(403).json({ success: false, message: 'ທ່ານບໍ່ມີສິດໃນການດຳເນີນການນີ້ (Forbidden)' });
        }
        next();
    };
};

// ==========================================
// 2. AUTHENTICATION & USERS APIs
// ==========================================

// 2.1 API: ລົງທະບຽນຜູ້ໃຊ້ໃໝ່ (Register)
app.post('/api/register', async (req, res) => {
    const { username, password, fullname, role, branch_id } = req.body;

    // ກວດສອບຂໍ້ມູນເບື້ອງຕົ້ນ
    if (!username || !password || !fullname) {
        return res.status(400).json({ success: false, message: 'ກະລຸນາປ້ອນຂໍ້ມູນໃຫ້ຄົບຖ້ວນ' });
    }

    try {
        // ກວດສອບວ່າມີ username ນີ້ແລ້ວຫຼືບໍ່
        const [existingUser] = await db.query('SELECT id FROM users WHERE username = ?', [username]);
        if (existingUser.length > 0) {
            return res.status(400).json({ success: false, message: 'ຊື່ຜູ້ໃຊ້ນີ້ຖືກໃຊ້ໄປແລ້ວ' });
        }

        // Hash ລະຫັດຜ່ານດ້ວຍ bcryptjs
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // ບັນທຶກລົງຖານຂໍ້ມູນ (ຮອງຮັບ branch_id)
        const sql = 'INSERT INTO users (username, password, fullname, role, branch_id) VALUES (?, ?, ?, ?, ?)';
        const [result] = await db.query(sql, [
            username, 
            hashedPassword, 
            fullname, 
            role || 'staff', 
            branch_id || null
        ]);

        res.status(201).json({
            success: true,
            message: 'ລົງທະບຽນຜູ້ໃຊ້ໃໝ່ສຳເລັດ',
            userId: result.insertId
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// 2.2 API: ເຂົ້າສູ່ລະບົບ (Login)
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;

    // ກວດສອບຂໍ້ມູນເບື້ອງຕົ້ນ
    if (!username || !password) {
        return res.status(400).json({ success: false, message: 'ກະລຸນາປ້ອນຊື່ຜູ້ໃຊ້ ແລະ ລະຫັດຜ່ານ' });
    }

    try {
        // ຄົ້ນຫາຜູ້ໃຊ້ໃນຖານຂໍ້ມູນ
        const [users] = await db.query('SELECT * FROM users WHERE username = ?', [username]);
        if (users.length === 0) {
            return res.status(401).json({ success: false, message: 'ຊື່ຜູ້ໃຊ້ ຫຼື ລະຫັດຜ່ານບໍ່ຖືກຕ້ອງ' });
        }

        const user = users[0];

        // ກວດສອບລະຫັດຜ່ານ (ຮອງຮັບທັງ plain-text ສໍາລັບ admin ເດີມ ແລະ bcrypt)
        let isMatch = false;
        if (user.password.startsWith('$2a$') || user.password.startsWith('$2b$')) {
            isMatch = await bcrypt.compare(password, user.password);
        } else {
            isMatch = (password === user.password);
        }

        if (!isMatch) {
            return res.status(401).json({ success: false, message: 'ຊື່ຜູ້ໃຊ້ ຫຼື ລະຫັດຜ່ານບໍ່ຖືກຕ້ອງ' });
        }

        // ສ້າງ JWT Token (ເພີ່ມ branch_id ແລະ role ເຂົ້າໄປ)
        const token = jwt.sign(
            { 
                id: user.id, 
                username: user.username, 
                fullname: user.fullname, 
                role: user.role,
                branch_id: user.branch_id
            },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.json({
            success: true,
            message: 'ເຂົ້າສູ່ລະບົບສຳເລັດ',
            token,
            user: {
                id: user.id,
                username: user.username,
                fullname: user.fullname,
                role: user.role,
                branch_id: user.branch_id
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// ==========================================
// 3. BRANCH MANAGEMENT APIs (Super Admin only)
// ==========================================

// 3.1 API: ສ້າງສາຂາໃໝ່
app.post('/api/branches', authenticateToken, requireRole(['super_admin']), async (req, res) => {
    const { name, address, phone } = req.body;
    if (!name) {
        return res.status(400).json({ success: false, message: 'ກະລຸນາປ້ອນຊື່ສາຂາ' });
    }
    try {
        const [result] = await db.query(
            'INSERT INTO branches (name, address, phone) VALUES (?, ?, ?)', 
            [name, address, phone]
        );
        res.status(201).json({ success: true, message: 'ສ້າງສາຂາໃໝ່ສຳເລັດ', branchId: result.insertId });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// 3.2 API: ດຶງລາຍຊື່ສາຂາທັງໝົດ (Public - ໃຊ້ໃນການເລືອກສາຂາຕອນສະໝັກສະມາຊິກ)
app.get('/api/branches', async (req, res) => {
    try {
        const [rows] = await db.query('SELECT * FROM branches');
        res.json({ success: true, data: rows });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// ==========================================
// 4. BRANCH INVENTORY / STOCK APIs (Isolated)
// ==========================================

// 4.1 API: ເບິ່ງສະຕອກນ້ຳມັນຄົງເຫຼືອຂອງສາຂາ
app.get('/api/stock', authenticateToken, async (req, res) => {
    try {
        // ກຳນົດ branch_id ທີ່ຕ້ອງການເບິ່ງ
        let targetBranchId = req.user.branch_id;
        
        // ຖ້າເປັນ Super Admin ສາມາດກັ່ນຕອງເບິ່ງສາຂາອື່ນຜ່ານ Query Param ໄດ້
        if (req.user.role === 'super_admin' && req.query.branch_id) {
            targetBranchId = parseInt(req.query.branch_id);
        }

        if (!targetBranchId) {
            return res.status(400).json({ success: false, message: 'ກະລຸນາລະບຸ ID ສາຂາ' });
        }

        const sql = `
            SELECT bs.id, bs.branch_id, b.name AS branch_name, bs.fuel_type_id, ft.name AS fuel_name, ft.price_per_liter, bs.quantity_liters, bs.updated_at
            FROM branch_stock bs
            JOIN branches b ON bs.branch_id = b.id
            JOIN fuel_types ft ON bs.fuel_type_id = ft.id
            WHERE bs.branch_id = ?
        `;
        const [rows] = await db.query(sql, [targetBranchId]);
        res.json({ success: true, data: rows });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// 4.2 API: ປັບປຸງ/ເພີ່ມສະຕອກນ້ຳມັນໃນສາຂາ (ສຳລັບ ເຈົ້າຂອງສາຂາ, ຜູ້ດູແລລະບົບ ຫຼື Super Admin)
app.post('/api/stock/adjust', authenticateToken, requireRole(['super_admin', 'branch_owner', 'admin']), async (req, res) => {
    const { fuel_type_id, quantity_liters, branch_id } = req.body;
    
    let targetBranchId = req.user.branch_id;
    if (req.user.role === 'super_admin' && branch_id) {
        targetBranchId = branch_id;
    }

    if (!targetBranchId || !fuel_type_id || quantity_liters === undefined) {
        return res.status(400).json({ success: false, message: 'ກະລຸນາປ້ອນຂໍ້ມູນໃຫ້ຄົບຖ້ວນ' });
    }

    try {
        // ກວດສອບວ່າມີແຖວສະຕອກນີ້ໃນສາຂາແລ້ວຫຼືບໍ່
        const [existing] = await db.query(
            'SELECT id, quantity_liters FROM branch_stock WHERE branch_id = ? AND fuel_type_id = ?',
            [targetBranchId, fuel_type_id]
        );

        if (existing.length > 0) {
            // ອັບເດດສະຕອກທີ່ມີຢູ່ແລ້ວ
            const newQty = parseFloat(existing[0].quantity_liters) + parseFloat(quantity_liters);
            await db.query(
                'UPDATE branch_stock SET quantity_liters = ? WHERE id = ?',
                [newQty, existing[0].id]
            );
        } else {
            // ເພີ່ມແຖວໃໝ່
            await db.query(
                'INSERT INTO branch_stock (branch_id, fuel_type_id, quantity_liters) VALUES (?, ?, ?)',
                [targetBranchId, fuel_type_id, quantity_liters]
            );
        }

        res.json({ success: true, message: 'ປັບປຸງສະຕອກສິນຄ້າສຳເລັດແລ້ວ' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// ==========================================
// 5. MEMBERS MANAGEMENT APIs (Isolated)
// ==========================================

// 5.1 API: ເພີ່ມສະມາຊິກໃໝ່ (ແຍກຕາມສາຂາ)
app.post('/api/members', authenticateToken, async (req, res) => {
    const { fullname, phone, branch_id } = req.body;
    
    let targetBranchId = req.user.branch_id;
    if (req.user.role === 'super_admin' && branch_id) {
        targetBranchId = branch_id;
    }

    if (!fullname || !targetBranchId) {
        return res.status(400).json({ success: false, message: 'ກະລຸນາປ້ອນຂໍ້ມູນສະມາຊິກໃຫ້ຄົບຖ້ວນ' });
    }

    try {
        const [result] = await db.query(
            'INSERT INTO members (fullname, phone, branch_id) VALUES (?, ?, ?)',
            [fullname, phone || '', targetBranchId]
        );
        res.status(201).json({ success: true, message: 'ເພີ່ມສະມາຊິກສຳເລັດແລ້ວ', memberId: result.insertId });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// 5.2 API: ດຶງລາຍຊື່ສະມາຊິກທັງໝົດຂອງສາຂາ
app.get('/api/members', authenticateToken, async (req, res) => {
    try {
        let targetBranchId = req.user.branch_id;
        if (req.user.role === 'super_admin' && req.query.branch_id) {
            targetBranchId = parseInt(req.query.branch_id);
        }

        let sql = 'SELECT * FROM members';
        let params = [];

        if (targetBranchId) {
            sql = 'SELECT * FROM members WHERE branch_id = ?';
            params = [targetBranchId];
        }

        const [rows] = await db.query(sql, params);
        res.json({ success: true, data: rows });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// ==========================================
// 5.1 VEHICLES MANAGEMENT APIs (Isolated)
// ==========================================

// 5.1.1 API: ເພີ່ມລົດໃໝ່ (ແຍກຕາມສາຂາ)
app.post('/api/vehicles', authenticateToken, async (req, res) => {
    const { plate_number, branch_id } = req.body;
    
    let targetBranchId = req.user.branch_id;
    if (req.user.role === 'super_admin' && branch_id) {
        targetBranchId = branch_id;
    }

    if (!plate_number || !targetBranchId) {
        return res.status(400).json({ success: false, message: 'ກະລຸນາປ້ອນຂໍ້ມູນທະບຽນລົດ' });
    }

    try {
        // ກວດສອບວ່າມີທະບຽນລົດນີ້ໃນສາຂານີ້ແລ້ວຫຼືບໍ່
        const [existing] = await db.query(
            'SELECT id FROM vehicles WHERE branch_id = ? AND plate_number = ?',
            [targetBranchId, plate_number.trim()]
        );

        if (existing.length > 0) {
            return res.status(400).json({ success: false, message: 'ທະບຽນລົດນີ້ມີຢູ່ໃນລະບົບຂອງສາຂານີ້ແລ້ວ' });
        }

        const [result] = await db.query(
            'INSERT INTO vehicles (plate_number, branch_id) VALUES (?, ?)',
            [plate_number.trim(), targetBranchId]
        );
        res.status(201).json({ success: true, message: 'ເພີ່ມທະບຽນລົດສຳເລັດແລ້ວ', vehicleId: result.insertId });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// 5.1.2 API: ດຶງລາຍຊື່ທະບຽນລົດທັງໝົດຂອງສາຂາ
app.get('/api/vehicles', authenticateToken, async (req, res) => {
    try {
        let targetBranchId = req.user.branch_id;
        if (req.user.role === 'super_admin' && req.query.branch_id) {
            targetBranchId = parseInt(req.query.branch_id);
        }

        let sql = 'SELECT * FROM vehicles';
        let params = [];

        if (targetBranchId) {
            sql = 'SELECT * FROM vehicles WHERE branch_id = ?';
            params = [targetBranchId];
        }

        const [rows] = await db.query(sql, params);
        res.json({ success: true, data: rows });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// ==========================================
// 6. FUEL TYPES APIs (Global list)
// ==========================================

// 6.1 API: ດຶງລາຍການປະເພດນ້ຳມັນ ແລະ ລາຄາກາງທັງໝົດ
app.get('/api/fuel', async (req, res) => {
    try {
        const [rows] = await db.query('SELECT * FROM fuel_types');
        res.json({ success: true, data: rows });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// 6.2 API: ປັບປຸງລາຄານ້ຳມັນ (ສຳລັບ ເຈົ້າຂອງສາຂາ, ຜູ້ດູແລລະບົບ ຫຼື Super Admin)
app.post('/api/fuel/update-price', authenticateToken, requireRole(['super_admin', 'branch_owner', 'admin']), async (req, res) => {
    const { fuel_type_id, price_per_liter } = req.body;
    
    if (!fuel_type_id || !price_per_liter) {
        return res.status(400).json({ success: false, message: 'ກະລຸນາປ້ອນຂໍ້ມູນໃຫ້ຄົບຖ້ວນ' });
    }

    try {
        const newPrice = parseFloat(price_per_liter);
        if (isNaN(newPrice) || newPrice <= 0) {
            return res.status(400).json({ success: false, message: 'ກະລຸນາປ້ອນລາຄາທີ່ຖືກຕ້ອງ' });
        }

        await db.query('UPDATE fuel_types SET price_per_liter = ? WHERE id = ?', [newPrice, fuel_type_id]);
        res.json({ success: true, message: 'ປັບປຸງລາຄານ້ຳມັນສຳເລັດແລ້ວ' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// ==========================================
// 7. SALES RECORDING & REPORTING APIs (With Isolation and Auto Stock Deduction)
// ==========================================

// 7.1 API: ບັນທຶກການຂາຍນ້ຳມັນໃໝ່ (ແຍກສາຂາ + ຕັດສະຕອກອັດຕະໂນມັດ)
app.post('/api/sales', authenticateToken, async (req, res) => {
    const { fuel_type_id, liters_sold, total_price, vehicle_info, payment_method, debtor_name } = req.body;
    const user_id = req.user.id;
    const branch_id = req.user.branch_id;

    if (!fuel_type_id || !liters_sold || !total_price) {
        return res.status(400).json({ success: false, message: 'ກະລຸນາປ້ອນຂໍ້ມູນໃຫ້ຄົບຖ້ວນ' });
    }

    if (!branch_id) {
        return res.status(400).json({ success: false, message: 'ບັນຊີຜູ້ໃຊ້ນີ້ບໍ່ໄດ້ຜູກມັດກັບສາຂາໃດໆ, ບໍ່ສາມາດບັນທຶກການຂາຍໄດ້' });
    }

    const final_payment_method = payment_method || 'cash';

    try {
        // --- ຂັ້ນຕອນທີ 1: ກວດສອບ ແລະ ຕັດສະຕອກໃນສາຂາ ---
        const [stockRows] = await db.query(
            `SELECT bs.id, bs.quantity_liters, ft.price_per_liter 
             FROM branch_stock bs 
             JOIN fuel_types ft ON bs.fuel_type_id = ft.id 
             WHERE bs.branch_id = ? AND bs.fuel_type_id = ?`,
            [branch_id, fuel_type_id]
        );

        if (stockRows.length === 0) {
            return res.status(400).json({ success: false, message: 'ບໍ່ມີຂໍ້ມູນສະຕອກນ້ຳມັນປະເພດນີ້ໃນສາຂາຂອງທ່ານ' });
        }

        const currentStock = parseFloat(stockRows[0].quantity_liters);
        const requiredLiters = parseFloat(liters_sold);
        const currentPrice = parseFloat(stockRows[0].price_per_liter);

        if (currentStock < requiredLiters) {
            return res.status(400).json({ 
                success: false, 
                message: `ຈຳນວນນ້ຳມັນໃນສະຕອກບໍ່ພໍຂາຍ (ມີຄົງເຫຼືອພຽງ ${currentStock} ລິດ)` 
            });
        }

        // --- ຂັ້ນຕອນທີ 2: ປັບປຸງສະຕອກໃໝ່ (ຕັດລິດທີ່ຂາຍອອກ) ---
        const newStockQty = currentStock - requiredLiters;
        await db.query(
            'UPDATE branch_stock SET quantity_liters = ? WHERE id = ?',
            [newStockQty, stockRows[0].id]
        );

        // --- ຂັ້ນຕອນທີ 3: ບັນທຶກທຸລະກຳການຂາຍ (ພ້ອມບັນທຶກລາຄາຕໍ່ລິດໃນຂະນະນັ້ນ) ---
        const sql = `INSERT INTO sales_transactions (fuel_type_id, liters_sold, total_price, price_per_liter, user_id, branch_id, vehicle_info, payment_method, debtor_name) 
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`;
        const [result] = await db.query(sql, [
            fuel_type_id, 
            liters_sold, 
            total_price, 
            currentPrice,
            user_id, 
            branch_id, 
            vehicle_info || null, 
            final_payment_method, 
            final_payment_method === 'debt' ? debtor_name : null
        ]);
        
        res.status(201).json({ 
            success: true, 
            message: 'ບັນທຶກການຂາຍ ແລະ ຕັດສະຕອກສຳເລັດແລ້ວ', 
            transactionId: result.insertId 
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// 7.2 API: ເບິ່ງລາຍງານການຂາຍ (Isolated ຕາມບົດບາດ ແລະ ສາຂາ)
app.get('/api/sales-report', authenticateToken, async (req, res) => {
    try {
        let sql = `
            SELECT st.id, b.name AS branch_name, ft.name AS fuel_name, st.liters_sold, st.total_price, 
                   COALESCE(st.price_per_liter, ft.price_per_liter) AS price_per_liter,
                   st.vehicle_info, st.payment_method, st.debtor_name, u.fullname AS seller, st.sale_date 
            FROM sales_transactions st
            JOIN fuel_types ft ON st.fuel_type_id = ft.id
            JOIN users u ON st.user_id = u.id
            LEFT JOIN branches b ON st.branch_id = b.id
        `;
        let params = [];

        // ຖ້າບໍ່ແມ່ນ Super Admin ຈະເຫັນສະເພາະປະຫວັດຂອງສາຂາຕົນເອງ
        if (req.user.role !== 'super_admin') {
            sql += ' WHERE st.branch_id = ?';
            params = [req.user.branch_id];
        } else if (req.query.branch_id) {
            // Super Admin ຕ້ອງການກັ່ນຕອງຕາມສາຂາ
            sql += ' WHERE st.branch_id = ?';
            params = [parseInt(req.query.branch_id)];
        }

        sql += ' ORDER BY st.sale_date DESC';

        const [rows] = await db.query(sql, params);
        res.json({ success: true, data: rows });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// 7.3 API: ດຶງສະຫຼຸບການຂາຍປະຈຳວັນ (Isolated ຕາມບົດບາດ ແລະ ສາຂາ)
app.get('/api/sales/today-summary', authenticateToken, async (req, res) => {
    try {
        let targetBranchId = req.user.branch_id;
        if (req.user.role === 'super_admin' && req.query.branch_id) {
            targetBranchId = parseInt(req.query.branch_id);
        }

        if (!targetBranchId) {
            return res.status(400).json({ success: false, message: 'ກະລຸນາລະບຸ ID ສາຂາ' });
        }

        const sql = `
            SELECT 
                COALESCE(SUM(st.liters_sold), 0) AS total_liters,
                COALESCE(SUM(st.total_price), 0) AS total_revenue,
                COALESCE(SUM(CASE WHEN st.payment_method = 'cash' THEN st.total_price ELSE 0 END), 0) AS total_cash,
                COALESCE(SUM(CASE WHEN st.payment_method = 'debt' THEN st.total_price ELSE 0 END), 0) AS total_debt,
                COUNT(st.id) AS sales_count
            FROM sales_transactions st
            WHERE st.branch_id = ? AND DATE(st.sale_date) = CURDATE()
        `;

        const [rows] = await db.query(sql, [targetBranchId]);
        res.json({ success: true, data: rows[0] });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});
// ==========================================
// 8. SPARE PARTS MANAGEMENT APIs (Isolated)
// ==========================================

// 8.1 API: ດຶງລາຍຊື່ອາໄຫຼ່ທັງໝົດໃນສາຂາ
app.get('/api/spare-parts', authenticateToken, async (req, res) => {
    try {
        let targetBranchId = req.user.branch_id;
        if (req.user.role === 'super_admin' && req.query.branch_id) {
            targetBranchId = parseInt(req.query.branch_id);
        }

        if (!targetBranchId) {
            return res.status(400).json({ success: false, message: 'ກະລຸນາລະບຸ ID ສາຂາ' });
        }

        const [rows] = await db.query(
            'SELECT * FROM spare_parts WHERE branch_id = ? ORDER BY category, name',
            [targetBranchId]
        );
        res.json({ success: true, data: rows });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// 8.2 API: ເພີ່ມອາໄຫຼ່ໃໝ່ (ເຈົ້າຂອງສາຂາ, ຜູ້ດູແລລະບົບ ຫຼື Super Admin)
app.post('/api/spare-parts', authenticateToken, requireRole(['super_admin', 'branch_owner', 'admin']), async (req, res) => {
    const { code, name, category, quantity, location, branch_id, brand, model_code, shop_name, buyer_name, image_url } = req.body;
    
    let targetBranchId = req.user.branch_id;
    if (req.user.role === 'super_admin' && branch_id) {
        targetBranchId = branch_id;
    }

    if (!code || !name || !category || !targetBranchId) {
        return res.status(400).json({ success: false, message: 'ກະລຸນາປ້ອນຂໍ້ມູນໃຫ້ຄົບຖ້ວນ' });
    }

    try {
        // ກວດສອບວ່າລະຫັດອາໄຫຼ່ນີ້ມີຢູ່ແລ້ວໃນສາຂາຫຼືບໍ່
        const [existing] = await db.query(
            'SELECT id FROM spare_parts WHERE branch_id = ? AND code = ?',
            [targetBranchId, code.toUpperCase().trim()]
        );

        if (existing.length > 0) {
            return res.status(400).json({ success: false, message: 'ລະຫັດອາໄຫຼ່ນີ້ມີຢູ່ໃນລະບົບຂອງສາຂານີ້ແລ້ວ' });
        }

        const [result] = await db.query(
            `INSERT INTO spare_parts (branch_id, code, name, brand, model_code, shop_name, buyer_name, category, quantity, location, image_url) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                targetBranchId, 
                code.toUpperCase().trim(), 
                name.trim(), 
                brand ? brand.trim() : null,
                model_code ? model_code.trim() : null,
                shop_name ? shop_name.trim() : null,
                buyer_name ? buyer_name.trim() : null,
                category.trim(), 
                quantity || 0, 
                location || '',
                image_url ? image_url.trim() : null
            ]
        );

        res.status(201).json({ success: true, message: 'ເພີ່ມອາໄຫຼ່ໃໝ່ສຳເລັດແລ້ວ', partId: result.insertId });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// 8.2.1 API: ອັບໂຫຼດຮູບພາບ (ຜ່ານ Base64 ໄປເກັບໃນ Backend Server)
app.post('/api/upload', authenticateToken, async (req, res) => {
    try {
        const { base64Data, fileName } = req.body;
        if (!base64Data) {
            return res.status(400).json({ success: false, message: 'ກະລຸນາສົ່ງຂໍ້ມູນຮູບພາບ (base64Data)' });
        }
        
        const buffer = Buffer.from(base64Data, 'base64');
        const uploadDir = path.join(__dirname, 'public', 'uploads');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        
        const finalFileName = `${Date.now()}_${fileName || 'image.jpg'}`;
        const filePath = path.join(uploadDir, finalFileName);
        fs.writeFileSync(filePath, buffer);
        
        const imageUrl = `${req.protocol}://${req.get('host')}/uploads/${finalFileName}`;
        res.json({ success: true, imageUrl });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// 8.2.2 API: ແກ້ໄຂຂໍ້ມູນອາໄຫຼ່
app.put('/api/spare-parts/:id', authenticateToken, requireRole(['super_admin', 'branch_owner', 'admin']), async (req, res) => {
    const { id } = req.params;
    const { code, name, category, quantity, location, brand, model_code, shop_name, buyer_name, image_url } = req.body;
    const branch_id = req.user.branch_id;
    
    try {
        let sql = 'SELECT id, branch_id FROM spare_parts WHERE id = ?';
        let params = [id];
        if (req.user.role !== 'super_admin') {
            sql += ' AND branch_id = ?';
            params.push(branch_id);
        }
        
        const [parts] = await db.query(sql, params);
        if (parts.length === 0) {
            return res.status(404).json({ success: false, message: 'ບໍ່ພົບຂໍ້ມູນອາໄຫຼ່ນີ້ໃນສາຂາຂອງທ່ານ' });
        }
        
        await db.query(
            `UPDATE spare_parts 
             SET code = ?, name = ?, category = ?, quantity = ?, location = ?, brand = ?, model_code = ?, shop_name = ?, buyer_name = ?, image_url = ?
             WHERE id = ?`,
            [
                code.toUpperCase().trim(),
                name.trim(),
                category.trim(),
                quantity || 0,
                location || '',
                brand ? brand.trim() : null,
                model_code ? model_code.trim() : null,
                shop_name ? shop_name.trim() : null,
                buyer_name ? buyer_name.trim() : null,
                image_url || null,
                id
            ]
        );
        
        res.json({ success: true, message: 'ອັບເດດຂໍ້ມູນອາໄຫຼ່ສຳເລັດແລ້ວ' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// 8.2.3 API: ລົບຂໍ້ມູນອາໄຫຼ່
app.delete('/api/spare-parts/:id', authenticateToken, requireRole(['super_admin', 'branch_owner', 'admin']), async (req, res) => {
    const { id } = req.params;
    const branch_id = req.user.branch_id;
    
    try {
        let sql = 'SELECT id, branch_id FROM spare_parts WHERE id = ?';
        let params = [id];
        if (req.user.role !== 'super_admin') {
            sql += ' AND branch_id = ?';
            params.push(branch_id);
        }
        
        const [parts] = await db.query(sql, params);
        if (parts.length === 0) {
            return res.status(404).json({ success: false, message: 'ບໍ່ພົບຂໍ້ມູນອາໄຫຼ່ນີ້ໃນສາຂາຂອງທ່ານ' });
        }
        
        await db.query('DELETE FROM spare_parts WHERE id = ?', [id]);
        res.json({ success: true, message: 'ລົບຂໍ້ມູນອາໄຫຼ່ສຳເລັດແລ້ວ' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// 8.3 API: ປັບປຸງສະຕອກອາໄຫຼ່ (ເພີ່ມ/ຫຼຸດ)
app.post('/api/spare-parts/adjust', authenticateToken, async (req, res) => {
    const { id, quantity } = req.body;
    const branch_id = req.user.branch_id;

    if (!id || quantity === undefined) {
        return res.status(400).json({ success: false, message: 'ກະລຸນາປ້ອນຂໍ້ມູນໃຫ້ຄົບຖ້ວນ' });
    }

    try {
        // ກວດສອບສິດຄວາມເປັນເຈົ້າຂອງສາຂາກ່ອນ
        let sql = 'SELECT id, quantity, branch_id FROM spare_parts WHERE id = ?';
        let params = [id];
        if (req.user.role !== 'super_admin') {
            sql += ' AND branch_id = ?';
            params.push(branch_id);
        }

        const [parts] = await db.query(sql, params);
        if (parts.length === 0) {
            return res.status(404).json({ success: false, message: 'ບໍ່ພົບຂໍ້ມູນອາໄຫຼ່ນີ້ໃນສາຂາຂອງທ່ານ' });
        }

        const newQty = parseInt(parts[0].quantity) + parseInt(quantity);
        if (newQty < 0) {
            return res.status(400).json({ success: false, message: 'ບໍ່ສາມາດປັບສະຕອກໃຫ້ຕິດລົບໄດ້' });
        }

        await db.query(
            'UPDATE spare_parts SET quantity = ? WHERE id = ?',
            [newQty, id]
        );

        res.json({ success: true, message: 'ປັບປຸງສະຕອກອາໄຫຼ່ສຳເລັດແລ້ວ', newQuantity: newQty });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// ==========================================
// 9. ORDERS & HEADQUARTERS APIs (For Branch Orders and HQ Dashboard)
// ==========================================

// 9.1 API: Create an order request (From branch to HQ)
app.post('/api/orders', authenticateToken, async (req, res) => {
    const { item_type, item_detail, quantity } = req.body;
    const branch_id = req.user.branch_id;

    if (!branch_id || !item_type || !item_detail || quantity === undefined) {
        return res.status(400).json({ success: false, message: 'ກະລຸນາປ້ອນຂໍ້ມູນການສັ່ງຊື້ໃຫ້ຄົບຖ້ວນ' });
    }

    try {
        const [result] = await db.query(
            `INSERT INTO branch_orders (branch_id, item_type, item_detail, quantity, status) 
             VALUES (?, ?, ?, ?, 'pending')`,
            [branch_id, item_type, item_detail, quantity]
        );
        res.status(201).json({ success: true, message: 'ສົ່ງຄຳຮ້ອງຂໍອໍເດີ້ສຳເລັດແລ້ວ', orderId: result.insertId });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// 9.2 API: Get orders (HQ sees all, Branch sees its own)
app.get('/api/orders', authenticateToken, async (req, res) => {
    try {
        let sql = `
            SELECT o.*, b.name AS branch_name 
            FROM branch_orders o
            JOIN branches b ON o.branch_id = b.id
        `;
        let params = [];

        // If not super_admin, filter by branch_id
        if (req.user.role !== 'super_admin') {
            sql += ' WHERE o.branch_id = ?';
            params.push(req.user.branch_id);
        } else if (req.query.branch_id) {
            // super_admin can filter by branch
            sql += ' WHERE o.branch_id = ?';
            params.push(parseInt(req.query.branch_id));
        }

        sql += ' ORDER BY o.created_at DESC';

        const [rows] = await db.query(sql, params);
        res.json({ success: true, data: rows });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// 9.3 API: Update order status (HQ only)
app.put('/api/orders/:id/status', authenticateToken, requireRole(['super_admin', 'manager']), async (req, res) => {
    const { id } = req.params;
    const { status } = req.body; // pending, approved, rejected, completed

    if (!status) {
        return res.status(400).json({ success: false, message: 'ກະລຸນາລະບຸສະຖານະອໍເດີ້' });
    }

    try {
        await db.query('UPDATE branch_orders SET status = ? WHERE id = ?', [status, id]);
        res.json({ success: true, message: 'ອັບເດດສະຖານະອໍເດີ້ສຳເລັດແລ້ວ' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// 9.4 API: Get aggregated Headquarters report
app.get('/api/reports/headquarters', authenticateToken, requireRole(['super_admin', 'manager']), async (req, res) => {
    try {
        const { branch_id } = req.query;
        let branchFilterSales = '';
        let branchFilterStock = '';
        let params = [];

        if (branch_id && branch_id !== 'all') {
            branchFilterSales = ' WHERE branch_id = ?';
            branchFilterStock = ' WHERE branch_id = ?';
            params.push(branch_id);
        }

        // Query 1: Total Sales Revenue All Branches (Today vs Total)
        const [salesData] = await db.query(`
            SELECT 
                SUM(CASE WHEN DATE(sale_date) = CURDATE() THEN total_price ELSE 0 END) AS today_revenue,
                SUM(CASE WHEN DATE(sale_date) = CURDATE() THEN liters_sold ELSE 0 END) AS today_liters,
                SUM(total_price) AS total_revenue,
                SUM(liters_sold) AS total_liters
            FROM sales_transactions
            ${branchFilterSales}
        `, params);

        // Query 2: Total Stock Liters All Branches
        const [stockData] = await db.query(`
            SELECT SUM(quantity_liters) AS total_stock_liters 
            FROM branch_stock
            ${branchFilterStock}
        `, params);

        // Query 3: Branches Count
        const [branchesData] = await db.query('SELECT COUNT(*) AS branch_count FROM branches');

        // Query 4: Sales per branch for chart
        const [branchSales] = await db.query(`
            SELECT b.name as branch_name, SUM(st.total_price) as total_revenue
            FROM branches b
            LEFT JOIN sales_transactions st ON b.id = st.branch_id
            GROUP BY b.id
        `);

        // Query 5: Low Stock Spare Parts (quantity <= 5)
        const [lowStockParts] = await db.query(`
            SELECT sp.*, b.name as branch_name
            FROM spare_parts sp
            JOIN branches b ON sp.branch_id = b.id
            WHERE sp.quantity <= 5
            ${branchFilterStock ? 'AND sp.branch_id = ?' : ''}
            ORDER BY sp.quantity ASC
        `, params);

        res.json({
            success: true,
            data: {
                summary: {
                    today_revenue: salesData[0].today_revenue || 0,
                    today_liters: salesData[0].today_liters || 0,
                    total_revenue: salesData[0].total_revenue || 0,
                    total_stock_liters: stockData[0].total_stock_liters || 0,
                    branch_count: branchesData[0].branch_count || 0
                },
                branch_sales: branchSales,
                low_stock_parts: lowStockParts
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// ເປີດ Server
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server is running on port ${PORT}`);
});