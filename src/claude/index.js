/**
 * Claude CLI Wrapper
 * 
 * Manages subprocess execution of Claude CLI with proper streaming,
 * progress reporting, and error handling for the Coddy bot.
 */

import { execa } from 'execa';
import { ClaudeError, logClaudeEvent } from '../utils/logger.js';

/**
 * Execute Claude CLI with streaming progress reporting
 * 
 * @param {object} options - Execution options
 * @param {string} options.directive - The directive to pass to Claude CLI
 * @param {string} options.workspacePath - Path to the workspace directory
 * @param {Function} [options.onProgress] - Optional progress callback function
 * @returns {Promise<void>} - Resolves when Claude CLI completes successfully
 * 
 * @throws {ClaudeError} - When Claude CLI fails or returns non-zero exit code
 * 
 * @example
 * ```js
 * import { runClaudeCLI } from './src/claude/index.js';
 * 
 * try {
 *   await runClaudeCLI({
 *     directive: 'Fix the bug in src/utils/helper.js',
 *     workspacePath: '/tmp/my-repo',
 *     onProgress: (text) => {
 *       console.log('Progress:', text);
 *     }
 *   });
 *   console.log('Claude CLI completed successfully');
 * } catch (error) {
 *   console.error('Claude CLI failed:', error.message);
 *   console.error('Exit code:', error.exitCode);
 *   console.error('Stderr:', error.stderr);
 * }
 * ```
 */
export async function runClaudeCLI({ directive, workspacePath, onProgress }) {
  if (!directive || typeof directive !== 'string') {
    throw new ClaudeError('Directive must be a non-empty string');
  }
  
  if (!workspacePath || typeof workspacePath !== 'string') {
    throw new ClaudeError('Workspace path must be a non-empty string');
  }
  
  logClaudeEvent.started(directive, workspacePath);
  const startTime = Date.now();
  
  let proc;
  let buffer = '';
  
  try {
    // Spawn Claude CLI process with required flags
    proc = execa('claude', [
      '-p', directive,
      '--allowedTools', 'Edit,Write,Read,Bash,Glob,Grep',
      '--output-format', 'stream-json',
      '--verbose'
    ], {
      cwd: workspacePath,
      timeout: 600_000, // 10 minutes timeout
      env: {
        ...process.env,
        // Ensure Claude CLI has access to necessary environment variables
        ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY
      },
      // Capture both stdout and stderr
      stdio: ['pipe', 'pipe', 'pipe']
    });
    
    // Handle streaming stdout data
    proc.stdout.on('data', (chunk) => {
      buffer += chunk.toString();
      
      // Split buffer into complete lines (ending with \n)
      const lines = buffer.split('\n');
      
      // Keep the last incomplete line in buffer
      buffer = lines.pop() || '';
      
      // Process complete lines
      for (const line of lines) {
        if (line.trim()) {
          try {
            const event = JSON.parse(line);
            
            // Extract text content from assistant messages
            if (event.type === 'assistant' && event.message?.content) {
              const textBlocks = event.message.content.filter(block => block.type === 'text');
              const text = textBlocks.map(block => block.text).join('');
              
              if (text && text.trim()) {
                // Limit text to 300 characters as specified
                const truncatedText = text.length > 300 ? text.slice(0, 300) : text;
                
                // Log progress and call callback if provided
                logClaudeEvent.progress(truncatedText);
                if (typeof onProgress === 'function') {
                  try {
                    onProgress(truncatedText);
                  } catch (callbackError) {
                    // Don't let callback errors break the CLI execution
                    console.warn('Progress callback error:', callbackError.message);
                  }
                }
              }
            }
          } catch (parseError) {
            // Skip lines that aren't valid JSON
            // This is normal for Claude CLI output that includes non-JSON lines
          }
        }
      }
    });
    
    // Handle stderr data for debugging
    let stderrData = '';
    proc.stderr.on('data', (chunk) => {
      stderrData += chunk.toString();
    });
    
    // Wait for process to complete
    const result = await proc;
    const duration = Date.now() - startTime;
    
    // Check exit code
    if (result.exitCode !== 0) {
      const error = new ClaudeError(
        `Claude CLI failed with exit code ${result.exitCode}${stderrData ? ': ' + stderrData : ''}`,
        result.exitCode,
        stderrData
      );
      
      logClaudeEvent.failed(error, null, directive);
      throw error;
    }
    
    logClaudeEvent.completed(null, duration);
    
  } catch (error) {
    const duration = Date.now() - startTime;
    
    if (error instanceof ClaudeError) {
      // Re-throw ClaudeError as-is
      throw error;
    }
    
    // Handle different types of execa errors
    let claudeError;
    
    if (error.exitCode !== undefined) {
      // Process exited with non-zero code
      claudeError = new ClaudeError(
        `Claude CLI failed with exit code ${error.exitCode}${error.stderr ? ': ' + error.stderr : ''}`,
        error.exitCode,
        error.stderr
      );
    } else if (error.timedOut) {
      // Process timed out
      claudeError = new ClaudeError(
        'Claude CLI timed out after 10 minutes',
        null,
        'Timeout exceeded'
      );
    } else if (error.killed) {
      // Process was killed
      claudeError = new ClaudeError(
        `Claude CLI was killed: ${error.signal || 'Unknown signal'}`,
        null,
        error.signal
      );
    } else {
      // Other errors (spawn failures, etc.)
      claudeError = new ClaudeError(
        `Claude CLI execution failed: ${error.message}`,
        null,
        error.message
      );
    }
    
    logClaudeEvent.failed(claudeError, null, directive);
    throw claudeError;
  }
}

/**
 * Check if Claude CLI is installed and accessible
 * 
 * @returns {Promise<boolean>} - True if Claude CLI is available, false otherwise
 */
export async function validateClaudeCLI() {
  try {
    // Try to get Claude CLI version
    const result = await execa('claude', ['--version'], {
      timeout: 5000,
      stdio: 'pipe'
    });
    
    return result.exitCode === 0;
  } catch (error) {
    return false;
  }
}

/**
 * Get Claude CLI version information
 * 
 * @returns {Promise<string|null>} - Version string or null if not available
 */
export async function getClaudeCLIVersion() {
  try {
    const result = await execa('claude', ['--version'], {
      timeout: 5000,
      stdio: 'pipe'
    });
    
    if (result.exitCode === 0) {
      return result.stdout.trim();
    }
    
    return null;
  } catch (error) {
    return null;
  }
}