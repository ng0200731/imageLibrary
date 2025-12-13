const Database = require('better-sqlite3');
const db = new Database('database.sqlite');

try {
    console.log('Updating admin users to level 3...');
    
    const result = db.prepare('UPDATE users SET level = 3 WHERE role = ?').run('admin');
    console.log(`Updated ${result.changes} admin user(s) to level 3.`);
    
    // Verify
    const admins = db.prepare('SELECT email, role, level FROM users WHERE role = ?').all('admin');
    console.log('\nAdmin users:');
    admins.forEach(u => {
        console.log(`  ${u.email}: role=${u.role}, level=${u.level}`);
    });
    
    console.log('\nUpdate complete!');
} catch (err) {
    console.error('Error updating admin level:', err);
} finally {
    db.close();
}



