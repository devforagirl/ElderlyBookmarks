import { initialize } from './ui/renderer_logic.js';

/**
 * Application Entry Point
 */
async function main() {
    try {
        await initialize();
        console.log('Application initialized successfully.');
    } catch (error) {
        console.error('Initialization failed:', error);
    }
}

main();
