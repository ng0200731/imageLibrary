const Database = require('better-sqlite3');
const db = new Database('database.sqlite');

try {
    console.log('Adding ownership and level columns...');
    
    // Add ownership column to projects table
    try {
        db.exec(`
            ALTER TABLE projects 
            ADD COLUMN ownership TEXT
        `);
        console.log('Added ownership column to projects table.');
    } catch (err) {
        if (err.message.includes('duplicate column')) {
            console.log('Ownership column already exists in projects table.');
        } else {
            throw err;
        }
    }
    
    // Add level column to users table
    try {
        db.exec(`
            ALTER TABLE users 
            ADD COLUMN level INTEGER DEFAULT 1
        `);
        console.log('Added level column to users table.');
    } catch (err) {
        if (err.message.includes('duplicate column')) {
            console.log('Level column already exists in users table.');
        } else {
            throw err;
        }
    }
    
    // Set default level for existing users
    // Admin users (role = 'admin') get level 3, others get level 1
    const updateLevelStmt = db.prepare(`
        UPDATE users 
        SET level = CASE 
            WHEN role = 'admin' THEN 3 
            ELSE 1 
        END
        WHERE level IS NULL
    `);
    const levelResult = updateLevelStmt.run();
    console.log(`Updated level for ${levelResult.changes} user(s).`);
    
    // Set ownership for existing projects (default to eric.brilliant@gmail.com)
    const updateOwnershipStmt = db.prepare(`
        UPDATE projects 
        SET ownership = 'eric.brilliant@gmail.com'
        WHERE ownership IS NULL
    `);
    const ownershipResult = updateOwnershipStmt.run();
    console.log(`Updated ownership for ${ownershipResult.changes} project(s).`);
    
    // Verify the update
    const projectCount = db.prepare("SELECT COUNT(*) as count FROM projects").get();
    const projectsWithOwnership = db.prepare("SELECT COUNT(*) as count FROM projects WHERE ownership IS NOT NULL").get();
    const userCount = db.prepare("SELECT COUNT(*) as count FROM users").get();
    const usersWithLevel = db.prepare("SELECT COUNT(*) as count FROM users WHERE level IS NOT NULL").get();
    
    console.log(`\nProjects: ${projectsWithOwnership.count}/${projectCount.count} have ownership`);
    console.log(`Users: ${usersWithLevel.count}/${userCount.count} have level`);
    
    // Show sample data
    const sampleProjects = db.prepare("SELECT id, name, ownership FROM projects LIMIT 5").all();
    console.log('\nSample projects:');
    sampleProjects.forEach(p => {
        console.log(`  Project ${p.id}: "${p.name}" - owned by ${p.ownership}`);
    });
    
    const sampleUsers = db.prepare("SELECT email, role, level FROM users LIMIT 5").all();
    console.log('\nSample users:');
    sampleUsers.forEach(u => {
        console.log(`  ${u.email}: role=${u.role}, level=${u.level}`);
    });
    
    console.log('\nMigration complete!');
} catch (err) {
    console.error('Error adding project ownership:', err);
} finally {
    db.close();
}



