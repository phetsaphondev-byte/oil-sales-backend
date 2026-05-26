const db = require('./db');
const bcrypt = require('bcryptjs');

async function seedUsers() {
  try {
    console.log('Seeding default users to Aiven Cloud Database...');

    // 1. Hash passwords
    const salt = await bcrypt.genSalt(10);
    const adminPassword = await bcrypt.hash('admin123', salt);
    const staffPassword = await bcrypt.hash('staff123', salt);

    // 2. Check and seed super_admin
    const [existingAdmin] = await db.query('SELECT id FROM users WHERE username = ?', ['admin']);
    if (existingAdmin.length === 0) {
      await db.query(`
        INSERT INTO users (username, password, fullname, role, branch_id) 
        VALUES ('admin', ?, 'Super Admin', 'super_admin', 1)
      `, [adminPassword]);
      console.log('✓ Created default super_admin (username: admin, password: admin123)');
    } else {
      console.log('✓ super_admin already exists.');
    }

    // 3. Check and seed staff
    const [existingStaff] = await db.query('SELECT id FROM users WHERE username = ?', ['staff']);
    if (existingStaff.length === 0) {
      await db.query(`
        INSERT INTO users (username, password, fullname, role, branch_id) 
        VALUES ('staff', ?, 'Staff Member', 'staff', 1)
      `, [staffPassword]);
      console.log('✓ Created default staff user (username: staff, password: staff123)');
    } else {
      console.log('✓ staff user already exists.');
    }

    console.log('User seeding completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Seeding failed:', error);
    process.exit(1);
  }
}

seedUsers();
