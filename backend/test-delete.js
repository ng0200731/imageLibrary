const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

async function testDelete() {
    try {
        console.log('Testing DELETE endpoint...');
        
        // Test with image ID 148 (which exists)
        const response = await fetch('http://localhost:3000/images/148', {
            method: 'DELETE'
        });
        
        console.log('Response status:', response.status);
        console.log('Response statusText:', response.statusText);
        
        const responseText = await response.text();
        console.log('Response body:', responseText);
        
        if (response.ok) {
            console.log('✓ DELETE request successful');
        } else {
            console.log('✗ DELETE request failed');
        }
        
    } catch (error) {
        console.error('Error testing DELETE:', error.message);
    }
}

testDelete();
