const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

async function testProjectsAPI() {
    try {
        console.log('Testing /projects API endpoint...');
        
        const response = await fetch('http://localhost:3000/projects');
        
        console.log('Response status:', response.status);
        console.log('Response statusText:', response.statusText);
        
        if (response.ok) {
            const projects = await response.json();
            console.log(`✓ SUCCESS: Found ${projects.length} projects`);
            
            // Show first few projects
            console.log('\nFirst 3 projects:');
            projects.slice(0, 3).forEach(project => {
                console.log(`- ID: ${project.id}, Name: "${project.name}", Images: ${project.image_ids.length}`);
            });
            
        } else {
            const errorText = await response.text();
            console.log('✗ FAILED:', errorText);
        }
        
    } catch (error) {
        console.error('✗ ERROR:', error.message);
    }
}

testProjectsAPI();
