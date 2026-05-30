const db = require('./db');

async function runMigrations() {
  try {
    console.log('Starting migrations...');

    // Create users table if not exists
    await db.query(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(255) NOT NULL UNIQUE,
        password VARCHAR(255) NOT NULL,
        fullname VARCHAR(255) NOT NULL,
        role VARCHAR(50) DEFAULT 'staff',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
    console.log('✓ users table checked/created.');

    // 0. Create fuel_types table if not exists
    await db.query(`
      CREATE TABLE IF NOT EXISTS fuel_types (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        price_per_liter DECIMAL(18, 2) NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
    console.log('✓ fuel_types table checked/created.');

    // Seed default fuel types if empty or missing
    const [existingFuels] = await db.query(`SELECT * FROM fuel_types`);
    if (existingFuels.length === 0) {
      await db.query(`
        INSERT INTO fuel_types (name, price_per_liter) VALUES 
        ('ກາຊ່ວນ', 15000.00),
        ('ແອັດຊັງ', 19000.00)
      `);
      console.log('✓ Seeded default fuel types: ກາຊ່ວນ, ແອັດຊັງ');
    } else {
      const hasPetrol = existingFuels.some(f => f.name.includes('ແອັດຊັງ'));
      if (!hasPetrol) {
        await db.query(`INSERT INTO fuel_types (name, price_per_liter) VALUES ('ແອັດຊັງ', 19000.00)`);
        console.log('✓ Seeded ແອັດຊັງ fuel type.');
      }
    }

    // 1. Create branches table
    await db.query(`
      CREATE TABLE IF NOT EXISTS branches (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        address TEXT,
        phone VARCHAR(50),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
    console.log('✓ branches table checked/created.');

    // 2. Create branch_stock table
    await db.query(`
      CREATE TABLE IF NOT EXISTS branch_stock (
        id INT AUTO_INCREMENT PRIMARY KEY,
        branch_id INT NOT NULL,
        fuel_type_id INT NOT NULL,
        quantity_liters DECIMAL(18, 2) DEFAULT 0.00,
        price_per_liter DECIMAL(18, 2) NOT NULL DEFAULT 0.00,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE CASCADE,
        FOREIGN KEY (fuel_type_id) REFERENCES fuel_types(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
    console.log('✓ branch_stock table checked/created.');

    // 3. Create members table
    await db.query(`
      CREATE TABLE IF NOT EXISTS members (
        id INT AUTO_INCREMENT PRIMARY KEY,
        branch_id INT NOT NULL,
        fullname VARCHAR(255) NOT NULL,
        phone VARCHAR(50),
        points INT DEFAULT 0,
        debt_amount DECIMAL(18, 2) DEFAULT 0.00,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
    console.log('✓ members table checked/created.');

    // 3.0 Create branch_orders table
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
    console.log('✓ branch_orders table checked/created.');

    // 3.1 Create spare_parts table
    await db.query(`
      CREATE TABLE IF NOT EXISTS spare_parts (
        id INT AUTO_INCREMENT PRIMARY KEY,
        branch_id INT NOT NULL,
        code VARCHAR(100) NOT NULL,
        name VARCHAR(255) NOT NULL,
        brand VARCHAR(100),
        model_code VARCHAR(100),
        shop_name VARCHAR(255),
        buyer_name VARCHAR(100),
        category VARCHAR(100) NOT NULL,
        quantity INT DEFAULT 0,
        location VARCHAR(100),
        image_url TEXT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
    console.log('✓ spare_parts table checked/created.');

    // 3.2 Create vehicles table
    await db.query(`
      CREATE TABLE IF NOT EXISTS vehicles (
        id INT AUTO_INCREMENT PRIMARY KEY,
        branch_id INT NOT NULL,
        plate_number VARCHAR(100) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
    console.log('✓ vehicles table checked/created.');

    // 3.2.1 Create fuel_imports table
    await db.query(`
      CREATE TABLE IF NOT EXISTS fuel_imports (
        id INT AUTO_INCREMENT PRIMARY KEY,
        branch_id INT NOT NULL,
        fuel_type_id INT NOT NULL,
        quantity_liters DECIMAL(15, 2) NOT NULL,
        purchase_price_per_liter DECIMAL(18, 2) NOT NULL,
        total_cost DECIMAL(18, 2) NOT NULL,
        import_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE CASCADE,
        FOREIGN KEY (fuel_type_id) REFERENCES fuel_types(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
    console.log('✓ fuel_imports table checked/created.');

    // 3.3 Create sales_transactions table if not exists
    await db.query(`
      CREATE TABLE IF NOT EXISTS sales_transactions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        fuel_type_id INT NOT NULL,
        liters_sold DECIMAL(18, 2) NOT NULL,
        total_price DECIMAL(18, 2) NOT NULL,
        price_per_liter DECIMAL(18, 2) NULL,
        user_id INT NULL,
        branch_id INT NULL,
        vehicle_info VARCHAR(255) NULL,
        payment_method VARCHAR(50) DEFAULT 'cash',
        debtor_name VARCHAR(255) NULL,
        remaining_debt DECIMAL(18, 2) NULL,
        sale_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (fuel_type_id) REFERENCES fuel_types(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
        FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
    console.log('✓ sales_transactions table checked/created.');

    // 4. Add branch_id to users if not exists
    const [userColumns] = await db.query(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = 'users' AND COLUMN_NAME = 'branch_id' AND TABLE_SCHEMA = DATABASE()
    `);
    if (userColumns.length === 0) {
      await db.query(`
        ALTER TABLE users ADD COLUMN branch_id INT NULL;
      `);
      await db.query(`
        ALTER TABLE users ADD FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE SET NULL;
      `);
      console.log('✓ Added branch_id column to users table.');
    } else {
      console.log('✓ branch_id column already exists in users table.');
    }

    // 5. Add branch_id to sales_transactions if not exists
    const [salesColumns] = await db.query(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = 'sales_transactions' AND COLUMN_NAME = 'branch_id' AND TABLE_SCHEMA = DATABASE()
    `);
    if (salesColumns.length === 0) {
      await db.query(`
        ALTER TABLE sales_transactions ADD COLUMN branch_id INT NULL;
      `);
      await db.query(`
        ALTER TABLE sales_transactions ADD FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE SET NULL;
      `);
      console.log('✓ Added branch_id column to sales_transactions table.');
    } else {
      console.log('✓ branch_id column already exists in sales_transactions table.');
    }

    // 5.1 Add vehicle_info to sales_transactions if not exists
    const [vehicleColumns] = await db.query(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = 'sales_transactions' AND COLUMN_NAME = 'vehicle_info' AND TABLE_SCHEMA = DATABASE()
    `);
    if (vehicleColumns.length === 0) {
      await db.query(`
        ALTER TABLE sales_transactions ADD COLUMN vehicle_info VARCHAR(255) NULL;
      `);
      console.log('✓ Added vehicle_info column to sales_transactions table.');
    } else {
      console.log('✓ vehicle_info column already exists in sales_transactions table.');
    }

    // 5.2 Add payment_method to sales_transactions if not exists
    const [paymentMethodColumns] = await db.query(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = 'sales_transactions' AND COLUMN_NAME = 'payment_method' AND TABLE_SCHEMA = DATABASE()
    `);
    if (paymentMethodColumns.length === 0) {
      await db.query(`
        ALTER TABLE sales_transactions ADD COLUMN payment_method VARCHAR(50) DEFAULT 'cash';
      `);
      console.log('✓ Added payment_method column to sales_transactions table.');
    } else {
      console.log('✓ payment_method column already exists in sales_transactions table.');
    }

    // 5.3 Add debtor_name to sales_transactions if not exists
    const [debtorNameColumns] = await db.query(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = 'sales_transactions' AND COLUMN_NAME = 'debtor_name' AND TABLE_SCHEMA = DATABASE()
    `);
    if (debtorNameColumns.length === 0) {
      await db.query(`
        ALTER TABLE sales_transactions ADD COLUMN debtor_name VARCHAR(255) NULL;
      `);
      console.log('✓ Added debtor_name column to sales_transactions table.');
    } else {
      console.log('✓ debtor_name column already exists in sales_transactions table.');
    }

    // 5.4 Add price_per_liter to sales_transactions if not exists
    const [pricePerLiterColumns] = await db.query(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = 'sales_transactions' AND COLUMN_NAME = 'price_per_liter' AND TABLE_SCHEMA = DATABASE()
    `);
    if (pricePerLiterColumns.length === 0) {
      await db.query(`
        ALTER TABLE sales_transactions ADD COLUMN price_per_liter DECIMAL(10, 2) NULL;
      `);
      console.log('✓ Added price_per_liter column to sales_transactions table.');
      // Backfill any existing records
      await db.query(`
        UPDATE sales_transactions st 
        JOIN fuel_types ft ON st.fuel_type_id = ft.id 
        SET st.price_per_liter = ft.price_per_liter 
        WHERE st.price_per_liter IS NULL
      `);
      console.log('✓ Backfilled price_per_liter for existing sales transactions.');
    } else {
      console.log('✓ price_per_liter column already exists in sales_transactions table.');
    }

    // 5.5 Add price_per_liter to branch_stock if not exists
    const [branchStockPriceColumns] = await db.query(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = 'branch_stock' AND COLUMN_NAME = 'price_per_liter' AND TABLE_SCHEMA = DATABASE()
    `);
    if (branchStockPriceColumns.length === 0) {
      await db.query(`
        ALTER TABLE branch_stock ADD COLUMN price_per_liter DECIMAL(10, 2) NOT NULL DEFAULT 0.00;
      `);
      console.log('✓ Added price_per_liter column to branch_stock table.');
      // Backfill any existing records
      await db.query(`
        UPDATE branch_stock bs 
        JOIN fuel_types ft ON bs.fuel_type_id = ft.id 
        SET bs.price_per_liter = ft.price_per_liter
      `);
      console.log('✓ Backfilled price_per_liter for existing branch stock records.');
    } else {
      console.log('✓ price_per_liter column already exists in branch_stock table.');
    }

    // 5.6 Add debt_amount to members if not exists
    const [debtAmountColumns] = await db.query(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = 'members' AND COLUMN_NAME = 'debt_amount' AND TABLE_SCHEMA = DATABASE()
    `);
    if (debtAmountColumns.length === 0) {
      await db.query(`
        ALTER TABLE members ADD COLUMN debt_amount DECIMAL(18, 2) DEFAULT 0.00;
      `);
      console.log('✓ Added debt_amount column to members table.');
    } else {
      console.log('✓ debt_amount column already exists in members table.');
    }

    // 5.7 Add remaining_debt to sales_transactions if not exists
    const [remainingDebtColumns] = await db.query(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = 'sales_transactions' AND COLUMN_NAME = 'remaining_debt' AND TABLE_SCHEMA = DATABASE()
    `);
    if (remainingDebtColumns.length === 0) {
      await db.query(`
        ALTER TABLE sales_transactions ADD COLUMN remaining_debt DECIMAL(18, 2) NULL;
      `);
      console.log('✓ Added remaining_debt column to sales_transactions table.');
    } else {
      console.log('✓ remaining_debt column already exists in sales_transactions table.');
    }

    // 6. Ensure branches exist
    const [existingBranches] = await db.query(`SELECT * FROM branches`);
    let mainBranchId;
    let phonhongBranchId;

    const mainBranch = existingBranches.find(b => b.name.includes('ສາຂາຫຼັກ') || b.name.includes('Vientiane'));
    if (!mainBranch) {
      const [res] = await db.query(`
        INSERT INTO branches (name, address, phone) 
        VALUES ('ສາຂາຫຼັກ (Vientiane)', 'ນະຄອນຫຼວງວຽງຈັນ', '020 5555 5555')
      `);
      mainBranchId = res.insertId;
      console.log('✓ Created default branch with ID:', mainBranchId);
    } else {
      mainBranchId = mainBranch.id;
      console.log('✓ Default branch exists with ID:', mainBranchId);
    }

    const phonhongBranch = existingBranches.find(b => b.name.includes('ໂພນໂຮງ') || b.name.includes('Phonhong'));
    if (!phonhongBranch) {
      const [res] = await db.query(`
        INSERT INTO branches (name, address, phone) 
        VALUES ('ສາຂາໂພນໂຮງ (Phonhong)', 'ແຂວງວຽງຈັນ, ເມືອງໂພນໂຮງ', '020 5555 6666')
      `);
      phonhongBranchId = res.insertId;
      console.log('✓ Created Phonhong branch with ID:', phonhongBranchId);
    } else {
      phonhongBranchId = phonhongBranch.id;
      console.log('✓ Phonhong branch exists with ID:', phonhongBranchId);
    }

    // 7. Update existing users to have default branch if branch_id is NULL
    await db.query(`UPDATE users SET branch_id = ? WHERE branch_id IS NULL AND role != 'super_admin'`, [mainBranchId]);
    console.log('✓ Assigned default branch to existing users.');

    const [allBranches] = await db.query(`SELECT id FROM branches`);

    // 8. Seed default stocks for all branches
    const [fuelTypes] = await db.query(`SELECT id FROM fuel_types`);
    for (const branch of allBranches) {
      for (const fuel of fuelTypes) {
        const [existingStock] = await db.query(`
          SELECT id FROM branch_stock WHERE branch_id = ? AND fuel_type_id = ?
        `, [branch.id, fuel.id]);
        if (existingStock.length === 0) {
          await db.query(`
            INSERT INTO branch_stock (branch_id, fuel_type_id, quantity_liters)
            VALUES (?, ?, 0.00)
          `, [branch.id, fuel.id]);
          console.log(`✓ Seeded 0L stock for fuel type ${fuel.id} in branch ${branch.id}`);
        }
      }
    }

    // 9. Seed default spare parts for all branches
    const defaultParts = [
      { code: 'NZ-ZVA-01', name: 'ຫົວຈ່າຍນ້ຳມັນ ZVA Slimline 2', category: 'ຫົວຈ່າຍ (Nozzles)', quantity: 12, location: 'ຊັ້ນວາງ A1' },
      { code: 'PP-TK-80', name: 'ປ້ຳດູດນ້ຳມັນ Tokheim 80 LPM', category: 'ປ້ຳດູດ (Pumps)', quantity: 3, location: 'ຊັ້ນວາງ B4' },
      { code: 'HS-EL-45', name: 'ສາຍສົ່ງນ້ຳມັນ Elaflex 4.5 ແມັດ', category: 'ສາຍສົ່ງ (Hoses)', quantity: 25, location: 'ຊັ້ນວາງ C2' },
      { code: 'FL-GB-30', name: 'ກອງນ້ຳມັນ Gilbarco 30 Micron', category: 'ກອງນ້ຳມັນ (Filters)', quantity: 48, location: 'ຊັ້ນວາງ A3' },
      { code: 'VL-OPW-2', name: 'ວາວປ້ອງກັນໄຫຼຍ້ອນ OPW 2 ນິ້ວ', category: 'ວາວ (Valves)', quantity: 8, location: 'ຊັ້ນວາງ D1' }
    ];

    for (const branch of allBranches) {
      for (const part of defaultParts) {
        const [existingPart] = await db.query(`
          SELECT id FROM spare_parts WHERE branch_id = ? AND code = ?
        `, [branch.id, part.code]);
        if (existingPart.length === 0) {
          await db.query(`
            INSERT INTO spare_parts (branch_id, code, name, category, quantity, location)
            VALUES (?, ?, ?, ?, ?, ?)
          `, [branch.id, part.code, part.name, part.category, part.quantity, part.location]);
          console.log(`✓ Seeded spare part ${part.code} in branch ${branch.id}`);
        }
      }
    }

    // 9.1 Seed default vehicles for all branches
    const defaultVehicles = [
      'ກກ 1111',
      'ຂຂ 2222',
      'ຄຄ 3333',
      'ງງ 4444'
    ];
    for (const branch of allBranches) {
      for (const plate of defaultVehicles) {
        const [existingVehicle] = await db.query(`
          SELECT id FROM vehicles WHERE branch_id = ? AND plate_number = ?
        `, [branch.id, plate]);
        if (existingVehicle.length === 0) {
          await db.query(`
            INSERT INTO vehicles (branch_id, plate_number)
            VALUES (?, ?)
          `, [branch.id, plate]);
          console.log(`✓ Seeded default vehicle ${plate} in branch ${branch.id}`);
        }
      }
    }

    // 9.2 Seed default members/debtors for all branches
    const defaultMembers = [
      { fullname: 'ສົມພອນ ແສງແກ້ວ', phone: '020 5555 1111' },
      { fullname: 'ຈັນທາ ພົມມະຈັນ', phone: '020 5555 2222' },
      { fullname: 'ອານຸສອນ ໄຊຍະວົງ', phone: '020 5555 3333' }
    ];
    for (const branch of allBranches) {
      for (const member of defaultMembers) {
        const [existingMember] = await db.query(`
          SELECT id FROM members WHERE branch_id = ? AND fullname = ?
        `, [branch.id, member.fullname]);
        if (existingMember.length === 0) {
          await db.query(`
            INSERT INTO members (branch_id, fullname, phone)
            VALUES (?, ?, ?)
          `, [branch.id, member.fullname, member.phone]);
          console.log(`✓ Seeded default member ${member.fullname} in branch ${branch.id}`);
        }
      }
    }

    console.log('All migrations completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

runMigrations();
