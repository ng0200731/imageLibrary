const Database = require('better-sqlite3');
const db = new Database('database.sqlite', { verbose: console.log });

function setupUserSystem() {
    console.log('Setting up user management system...');
    
    // Create users table
    db.exec(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT NOT NULL UNIQUE,
            status TEXT NOT NULL DEFAULT 'pending',
            role TEXT NOT NULL DEFAULT 'user',
            level INTEGER DEFAULT 1,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            approved_at DATETIME,
            last_login DATETIME
        );
    `);
    
    // Create verification codes table
    db.exec(`
        CREATE TABLE IF NOT EXISTS verification_codes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT NOT NULL,
            code TEXT NOT NULL,
            expires_at DATETIME NOT NULL,
            used BOOLEAN DEFAULT FALSE,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
    `);
    
    // Create login sessions table
    db.exec(`
        CREATE TABLE IF NOT EXISTS login_sessions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            session_token TEXT NOT NULL UNIQUE,
            expires_at DATETIME NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
        );
    `);
    
    // Insert default admin user
    const adminEmail = 'eric.brilliant@gmail.com';
    const existingAdmin = db.prepare('SELECT id FROM users WHERE email = ?').get(adminEmail);
    
    if (!existingAdmin) {
        db.prepare(`
            INSERT INTO users (email, status, role, level, approved_at) 
            VALUES (?, 'approved', 'admin', 3, datetime('now'))
        `).run(adminEmail);
        console.log(`✓ Created admin user: ${adminEmail} with level 3`);
    } else {
        // Update existing user to admin if not already
        db.prepare(`
            UPDATE users 
            SET status = 'approved', role = 'admin', level = 3, approved_at = datetime('now')
            WHERE email = ?
        `).run(adminEmail);
        console.log(`✓ Updated admin user: ${adminEmail} to level 3`);
    }
    
    console.log('User management system setup complete!');
}

// Run setup
try {
    setupUserSystem();
} catch (error) {
    console.error('Error setting up user system:', error);
} finally {
    db.close();
}
