/**
 * Discord Bot Entry Point
 * 
 * This module initializes the Discord client, registers slash commands,
 * and sets up event handlers for the Coddy bot.
 */

import { validateClaudeCLI, getClaudeCLIVersion } from '../claude/index.js';
import { logBotEvent } from '../utils/logger.js';

/**
 * Validate Claude CLI installation at startup
 */
async function validateStartupRequirements() {
  logBotEvent.startup('Validating startup requirements...');
  
  // Check if Claude CLI is installed and accessible
  const isClaudeInstalled = await validateClaudeCLI();
  
  if (!isClaudeInstalled) {
    const errorMessage = 'Claude CLI is not installed or not accessible. Please install Claude CLI and ensure it\'s in your PATH.';
    logBotEvent.error(new Error(errorMessage), { 
      component: 'startup',
      requirement: 'claude-cli' 
    });
    console.error('\n❌ STARTUP FAILED:', errorMessage);
    console.error('   Install Claude CLI from: https://github.com/anthropics/claude-cli');
    console.error('   Then ensure it\'s in your PATH and try again.\n');
    process.exit(1);
  }
  
  // Log successful validation
  const claudeVersion = await getClaudeCLIVersion();
  logBotEvent.startup(`Claude CLI validated successfully${claudeVersion ? ` (${claudeVersion})` : ''}`);
  console.log(`✅ Claude CLI is available${claudeVersion ? ` (${claudeVersion})` : ''}`);
  
  // Validate environment variables
  const requiredEnvVars = [
    'DISCORD_TOKEN',
    'DISCORD_CLIENT_ID', 
    'DISCORD_GUILD_ID',
    'GITHUB_TOKEN',
    'GITHUB_OWNER',
    'ANTHROPIC_API_KEY'
  ];
  
  const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName]);
  
  if (missingEnvVars.length > 0) {
    const errorMessage = `Missing required environment variables: ${missingEnvVars.join(', ')}`;
    logBotEvent.error(new Error(errorMessage), { 
      component: 'startup',
      requirement: 'environment',
      missing: missingEnvVars 
    });
    console.error('\n❌ STARTUP FAILED:', errorMessage);
    console.error('   Please check your .env file and ensure all required variables are set.\n');
    process.exit(1);
  }
  
  logBotEvent.startup('Environment variables validated successfully');
  console.log('✅ Environment variables are configured');
}

/**
 * Main startup function
 */
async function main() {
  try {
    // Load environment variables
    if (process.env.NODE_ENV !== 'production') {
      const { config } = await import('dotenv');
      config();
    }
    
    logBotEvent.startup('Coddy bot starting up...');
    console.log('🚀 Coddy bot starting up...');
    
    // Validate requirements
    await validateStartupRequirements();
    
    // TODO: Initialize Discord client (will be implemented in future PRs)
    console.log('✅ Startup validation complete');
    logBotEvent.startup('Startup validation complete - Discord client initialization pending');
    
    console.log('\n📝 Note: Full Discord bot functionality will be available in upcoming PRs');
    console.log('   This startup script validates Claude CLI and environment setup.');
    
  } catch (error) {
    logBotEvent.error(error, { component: 'startup' });
    console.error('❌ Startup failed:', error.message);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  logBotEvent.shutdown('Received SIGINT, shutting down gracefully...');
  console.log('\n🛑 Shutting down gracefully...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  logBotEvent.shutdown('Received SIGTERM, shutting down gracefully...');
  console.log('\n🛑 Shutting down gracefully...');
  process.exit(0);
});

// Start the bot if this file is run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

// Placeholder for Discord bot initialization - will be implemented in subsequent PRs
export default {};