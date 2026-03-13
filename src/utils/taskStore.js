/**
 * In-Memory Task Store
 * 
 * Provides thread-safe in-memory storage for tracking PR plans, execution state,
 * approval waiting, and active tasks across Discord threads and GitHub operations.
 */

import { v4 as uuidv4 } from 'uuid';

/**
 * Task status enumeration
 */
export const TaskStatus = {
  PENDING: 'pending',
  EXECUTING: 'executing', 
  WAITING_APPROVAL: 'waiting-approval',
  COMPLETED: 'completed',
  REJECTED: 'rejected'
};

/**
 * In-memory task storage
 * Key: taskId (UUID)
 * Value: Task object
 */
const tasks = new Map();

/**
 * Task object structure:
 * {
 *   id: string,              // UUID
 *   threadId: string,        // Discord thread ID
 *   status: string,          // TaskStatus enum value
 *   steps: Array,            // Array of step objects
 *   currentStepIndex: number, // Current executing step index
 *   plan: object,            // Original plan from orchestrator
 *   repoName: string,        // GitHub repository name
 *   prUrl: string,           // Current PR URL (if any)
 *   error: string,           // Error message (if failed)
 *   createdAt: Date,         // Task creation timestamp
 *   updatedAt: Date,         // Last update timestamp
 *   userId: string,          // Discord user ID who created task
 *   guildId: string          // Discord guild ID
 * }
 */

/**
 * Create a new task
 * @param {object} taskData - Task data object
 * @param {string} taskData.threadId - Discord thread ID
 * @param {Array} taskData.steps - Array of step objects
 * @param {object} taskData.plan - Original plan object
 * @param {string} taskData.repoName - GitHub repository name
 * @param {string} taskData.userId - Discord user ID
 * @param {string} taskData.guildId - Discord guild ID
 * @returns {string} - Generated task ID
 */
export const createTask = (taskData) => {
  const taskId = uuidv4();
  const now = new Date();
  
  const task = {
    id: taskId,
    threadId: taskData.threadId,
    status: TaskStatus.PENDING,
    steps: taskData.steps || [],
    currentStepIndex: 0,
    plan: taskData.plan || {},
    repoName: taskData.repoName,
    prUrl: null,
    error: null,
    createdAt: now,
    updatedAt: now,
    userId: taskData.userId,
    guildId: taskData.guildId,
    ...taskData // Allow additional properties
  };
  
  tasks.set(taskId, task);
  return taskId;
};

/**
 * Get a task by ID
 * @param {string} taskId - Task UUID
 * @returns {object|null} - Task object or null if not found
 */
export const getTask = (taskId) => {
  return tasks.get(taskId) || null;
};

/**
 * Update a task with new data
 * @param {string} taskId - Task UUID
 * @param {object} updates - Object with properties to update
 * @returns {boolean} - True if task was found and updated, false otherwise
 */
export const updateTask = (taskId, updates) => {
  const task = tasks.get(taskId);
  if (!task) {
    return false;
  }
  
  // Update task properties
  Object.assign(task, updates, {
    updatedAt: new Date()
  });
  
  tasks.set(taskId, task);
  return true;
};

/**
 * Delete a task
 * @param {string} taskId - Task UUID
 * @returns {boolean} - True if task was found and deleted, false otherwise
 */
export const deleteTask = (taskId) => {
  return tasks.delete(taskId);
};

/**
 * Get all active tasks (not completed or rejected)
 * @returns {Array} - Array of active task objects
 */
export const getActiveTasks = () => {
  const activeTasks = [];
  
  for (const task of tasks.values()) {
    if (task.status !== TaskStatus.COMPLETED && task.status !== TaskStatus.REJECTED) {
      activeTasks.push(task);
    }
  }
  
  return activeTasks;
};

/**
 * Get all tasks (for debugging/admin purposes)
 * @returns {Array} - Array of all task objects
 */
export const getAllTasks = () => {
  return Array.from(tasks.values());
};

/**
 * Set task as waiting for approval with PR data
 * @param {string} taskId - Task UUID
 * @param {object} prData - PR data object
 * @param {string} prData.url - PR URL
 * @param {number} prData.number - PR number
 * @param {string} prData.branch - PR branch name
 * @returns {boolean} - True if task was found and updated, false otherwise
 */
export const setTaskWaitingForApproval = (taskId, prData) => {
  return updateTask(taskId, {
    status: TaskStatus.WAITING_APPROVAL,
    prUrl: prData.url,
    prNumber: prData.number,
    prBranch: prData.branch
  });
};

/**
 * Get all tasks waiting for approval
 * @returns {Array} - Array of task objects waiting for approval
 */
export const getTasksWaitingForApproval = () => {
  const waitingTasks = [];
  
  for (const task of tasks.values()) {
    if (task.status === TaskStatus.WAITING_APPROVAL) {
      waitingTasks.push(task);
    }
  }
  
  return waitingTasks;
};

/**
 * Get tasks by thread ID
 * @param {string} threadId - Discord thread ID
 * @returns {Array} - Array of task objects in the thread
 */
export const getTasksByThread = (threadId) => {
  const threadTasks = [];
  
  for (const task of tasks.values()) {
    if (task.threadId === threadId) {
      threadTasks.push(task);
    }
  }
  
  return threadTasks;
};

/**
 * Get tasks by user ID
 * @param {string} userId - Discord user ID
 * @returns {Array} - Array of task objects created by the user
 */
export const getTasksByUser = (userId) => {
  const userTasks = [];
  
  for (const task of tasks.values()) {
    if (task.userId === userId) {
      userTasks.push(task);
    }
  }
  
  return userTasks;
};

/**
 * Advance task to next step
 * @param {string} taskId - Task UUID
 * @returns {boolean} - True if task was advanced, false if at last step or not found
 */
export const advanceTaskStep = (taskId) => {
  const task = tasks.get(taskId);
  if (!task) {
    return false;
  }
  
  if (task.currentStepIndex >= task.steps.length - 1) {
    // Already at last step
    return false;
  }
  
  return updateTask(taskId, {
    currentStepIndex: task.currentStepIndex + 1,
    status: TaskStatus.PENDING,
    prUrl: null, // Clear previous PR URL
    prNumber: null,
    prBranch: null
  });
};

/**
 * Complete a task
 * @param {string} taskId - Task UUID
 * @returns {boolean} - True if task was found and completed, false otherwise
 */
export const completeTask = (taskId) => {
  return updateTask(taskId, {
    status: TaskStatus.COMPLETED
  });
};

/**
 * Reject a task with reason
 * @param {string} taskId - Task UUID
 * @param {string} reason - Rejection reason
 * @returns {boolean} - True if task was found and rejected, false otherwise
 */
export const rejectTask = (taskId, reason) => {
  return updateTask(taskId, {
    status: TaskStatus.REJECTED,
    error: reason
  });
};

/**
 * Clear all tasks (for testing)
 * @returns {void}
 */
export const clearAllTasks = () => {
  tasks.clear();
};

/**
 * Get task store statistics
 * @returns {object} - Statistics object
 */
export const getTaskStats = () => {
  const stats = {
    total: tasks.size,
    pending: 0,
    executing: 0,
    waitingApproval: 0,
    completed: 0,
    rejected: 0
  };
  
  for (const task of tasks.values()) {
    switch (task.status) {
      case TaskStatus.PENDING:
        stats.pending++;
        break;
      case TaskStatus.EXECUTING:
        stats.executing++;
        break;
      case TaskStatus.WAITING_APPROVAL:
        stats.waitingApproval++;
        break;
      case TaskStatus.COMPLETED:
        stats.completed++;
        break;
      case TaskStatus.REJECTED:
        stats.rejected++;
        break;
    }
  }
  
  return stats;
};