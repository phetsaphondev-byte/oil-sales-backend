const db = require('./db');

async function reset() {
    console.log('Resetting Phonhong branch (branch_id = 2) database records...');

    // 1. Reset debt_amount to 0 for all members in branch 2
    await db.query('UPDATE members SET debt_amount = 0.00 WHERE branch_id = 2');
    console.log('✓ Reset debt_amount = 0.00 for members in Phonhong branch.');

    // 2. Delete all sales transactions for branch 2
    await db.query('DELETE FROM sales_transactions WHERE branch_id = 2');
    console.log('✓ Deleted all sales transactions for Phonhong branch.');

    // 3. Delete all fuel imports history for branch 2
    await db.query('DELETE FROM fuel_imports WHERE branch_id = 2');
    console.log('✓ Deleted fuel imports history for Phonhong branch.');

    // 4. Revert fuel stock quantity_liters to 5000.00 for all stocks in branch 2
    await db.query('UPDATE branch_stock SET quantity_liters = 5000.00 WHERE branch_id = 2');
    console.log('✓ Reverted fuel stocks to 5,000.00 Liters for Phonhong branch.');

    console.log('Phonhong branch reset successfully!');
    process.exit(0);
}

reset().catch(err => {
    console.error('Reset failed:', err);
    process.exit(1);
});
