const Database = require('better-sqlite3');
const db = new Database('database.sqlite');

try {
    console.log('Setting all projects ownership to eric.brilliant@gmail.com...');
    
    // Update all projects to have eric.brilliant@gmail.com as owner
    const updateStmt = db.prepare(`
        UPDATE projects 
        SET ownership = 'eric.brilliant@gmail.com'
    `);
    const result = updateStmt.run();
    console.log(`Updated ${result.changes} project(s) ownership to eric.brilliant@gmail.com.`);
    
    // Verify the update
    const totalProjects = db.prepare("SELECT COUNT(*) as count FROM projects").get();
    const projectsWithOwnership = db.prepare("SELECT COUNT(*) as count FROM projects WHERE ownership = 'eric.brilliant@gmail.com'").get();
    console.log(`\nTotal projects: ${totalProjects.count}`);
    console.log(`Projects owned by eric.brilliant@gmail.com: ${projectsWithOwnership.count}`);
    
    // Show sample projects
    const sampleProjects = db.prepare("SELECT id, name, ownership FROM projects LIMIT 10").all();
    console.log('\nSample projects:');
    sampleProjects.forEach(p => {
        console.log(`  Project ${p.id}: "${p.name}" - owned by ${p.ownership}`);
    });
    
    console.log('\nUpdate complete!');
} catch (err) {
    console.error('Error updating project ownership:', err);
} finally {
    db.close();
}



