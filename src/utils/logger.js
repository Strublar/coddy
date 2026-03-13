/**
 * Winston Logger Configuration
 * 
 * Provides structured logging for bot events, task events, and Claude CLI operations.
 * Exports a singleton logger instance with context-aware logging methods.
 */

import winston from 'winston';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Custom error classes for better error handling
 */
export class ClaudeError extends Error {
  constructor(message, exitCode = null, stderr = null) {
    super(message);
    this.name = 'ClaudeError';
    this.exitCode = exitCode;
    this.stderr = stderr;
  }
}

export class GitHubError extends Error {
  constructor(message, status = null) {
    super(message);
    this.name = 'GitHubError';
    this.status = status;
  }
}

export class TaskError extends Error {
  constructor(message, taskId = null, step = null) {
    super(message);
    this.name = 'TaskError';
    this.taskId = taskId;
    this.step = step;
  }
}

/**
 * Sanitize sensitive data from logs
 * @param {string} text - Text to sanitize
 * @returns {string} - Sanitized text
 */
function sanitizeForLogging(text) {
  if (!text) return text;
  
  // Remove tokens and keys (common patterns)
  return text
    .replace(/(?:token|key|secret|password)["\s]*[:=]["\s]*[a-zA-Z0-9_-]+/gi, '[REDACTED]')
    .replace(/ghp_[a-zA-Z0-9_-]+/g, '[GITHUB_TOKEN]')
    .replace(/sk-[a-zA-Z0-9_-]+/g, '[ANTHROPIC_KEY]')
    .replace(/[A-Za-z0-9_-]{50,}/g, (match) => match.length > 40 ? '[LONG_TOKEN]' : match);
}

/**
 * Create Winston logger instance
 */
function createLogger(transports = null) {
  const logDir = path.join(process.cwd(), 'logs');
  
  const defaultTransports = [
    // Console transport with human-readable format
    new winston.transports.Console({
      level: 'info',
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.timestamp({ format: 'HH:mm:ss' }),
        winston.format.simple(),
        winston.format.printf(({ timestamp, level, message, ...meta }) => {
          const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
          return `${timestamp} ${level}: ${message}${metaStr}`;
        })
      )
    }),
    
    // File transport with JSON format
    new winston.transports.File({
      filename: path.join(logDir, 'coddy.log'),
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      maxsize: 10 * 1024 * 1024, // 10MB
      maxFiles: 5
    }),
    
    // Error file transport
    new winston.transports.File({
      filename: path.join(logDir, 'error.log'),
      level: 'error',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      maxsize: 10 * 1024 * 1024, // 10MB
      maxFiles: 3
    })
  ];

  return winston.createLogger({
    level: 'info',
    transports: transports || defaultTransports,
    exitOnError: false
  });
}

// Singleton logger instance
export const logger = createLogger();

/**
 * Bot event logging methods
 */
export const logBotEvent = {
  command: (commandName, userId, guildId, options = {}) => {
    logger.info('Discord command executed', {
      type: 'bot.command',
      command: commandName,
      userId,
      guildId,
      options: sanitizeForLogging(JSON.stringify(options))
    });
  },
  
  error: (error, context = {}) => {
    logger.error('Bot error occurred', {
      type: 'bot.error',
      error: error.message,
      stack: error.stack,
      context: sanitizeForLogging(JSON.stringify(context))
    });
  },
  
  startup: (message) => {
    logger.info(message, { type: 'bot.startup' });
  },
  
  shutdown: (message) => {
    logger.info(message, { type: 'bot.shutdown' });
  }
};

/**
 * Task event logging methods
 */
export const logTaskEvent = {
  created: (taskId, threadId, repoName, stepsCount) => {
    logger.info('Task created', {
      type: 'task.created',
      taskId,
      threadId,
      repoName,
      stepsCount
    });
  },
  
  updated: (taskId, status, currentStep = null) => {
    logger.info('Task updated', {
      type: 'task.updated',
      taskId,
      status,
      currentStep
    });
  },
  
  approved: (taskId, stepIndex) => {
    logger.info('Task step approved', {
      type: 'task.approved',
      taskId,
      stepIndex
    });
  },
  
  rejected: (taskId, stepIndex, reason) => {
    logger.warn('Task step rejected', {
      type: 'task.rejected',
      taskId,
      stepIndex,
      reason: sanitizeForLogging(reason)
    });
  },
  
  completed: (taskId, totalSteps) => {
    logger.info('Task completed', {
      type: 'task.completed',
      taskId,
      totalSteps
    });
  },
  
  failed: (taskId, error, stepIndex = null) => {
    logger.error('Task failed', {
      type: 'task.failed',
      taskId,
      stepIndex,
      error: error.message,
      stack: error.stack
    });
  }
};

/**
 * Claude CLI event logging methods
 */
export const logClaudeEvent = {
  started: (directive, workspacePath) => {
    logger.info('Claude CLI started', {
      type: 'claude.started',
      directive: sanitizeForLogging(directive.slice(0, 100) + (directive.length > 100 ? '...' : '')),
      workspacePath
    });
  },
  
  progress: (text, taskId = null) => {
    logger.debug('Claude CLI progress', {
      type: 'claude.progress',
      taskId,
      progress: sanitizeForLogging(text.slice(0, 200))
    });
  },
  
  completed: (taskId = null, duration = null) => {
    logger.info('Claude CLI completed', {
      type: 'claude.completed',
      taskId,
      duration
    });
  },
  
  failed: (error, taskId = null, directive = null) => {
    logger.error('Claude CLI failed', {
      type: 'claude.failed',
      taskId,
      error: error.message,
      exitCode: error.exitCode,
      stderr: sanitizeForLogging(error.stderr),
      directive: directive ? sanitizeForLogging(directive.slice(0, 100)) : null
    });
  }
};

/**
 * Create logger with custom transports (for testing)
 * @param {Array} transports - Custom Winston transports
 * @returns {winston.Logger} - Logger instance
 */
export const createCustomLogger = createLogger;

export default logger;