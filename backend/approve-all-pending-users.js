const Database = require('better-sqlite3');
const db = new Database('database.sqlite');

try {
    console.log('Approving all pending users...');
    
    // Update all pending users to approved
    const updateStmt = db.prepare(`
        UPDATE users 
        SET status = 'approved', approved_at = datetime('now')
        WHERE status = 'pending' OR status IS NULL
    `);
    const result = updateStmt.run();
    console.log(`Updated ${result.changes} pending user(s) to approved status.`);
    
    // Verify the update
    const pendingCount = db.prepare("SELECT COUNT(*) as count FROM users WHERE status = 'pending'").get();
    const approvedCount = db.prepare("SELECT COUNT(*) as count FROM users WHERE status = 'approved'").get();
    console.log(`Pending users remaining: ${pendingCount.count}`);
    console.log(`Approved users: ${approvedCount.count}`);
    
    // Show all users
    const allUsers = db.prepare("SELECT email, status, created_at, approved_at FROM users").all();
    console.log('\nAll users:');
    allUsers.forEach(user => {
        console.log(`  ${user.email}: ${user.status} (created: ${user.created_at}, approved: ${user.approved_at || 'N/A'})`);
    });
    
    console.log('\nMigration complete!');
} catch (err) {
    console.error('Error approving pending users:', err);
} finally {
    db.close();
}



