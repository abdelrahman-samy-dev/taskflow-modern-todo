class ModernTodoApp {
    constructor() {
        this.tasks = [];
        this.currentFilter = 'all';
        this.searchTerm = '';
        this.taskIdCounter = 1;
        
        this.initializeApp();
        this.bindEvents();
        this.loadTasksFromStorage();
        this.updateStats();
    }

    initializeApp() {
        // Initialize Lucide icons
        setTimeout(() => {
            if (typeof lucide !== 'undefined') {
                lucide.createIcons();
            }
        }, 100);

        // Show loading screen briefly for better UX
        setTimeout(() => {
            const loadingScreen = document.getElementById('loadingScreen');
            const appContainer = document.getElementById('appContainer');
            
            loadingScreen.style.opacity = '0';
            setTimeout(() => {
                loadingScreen.style.display = 'none';
                appContainer.classList.add('loaded');
            }, 500);
        }, 1000);

        // Load theme preference
        const savedTheme = localStorage.getItem('theme') || 'light';
        document.documentElement.setAttribute('data-theme', savedTheme);
        this.updateThemeIcon(savedTheme);
    }

    bindEvents() {
        // Task input
        const taskInput = document.getElementById('taskInput');
        const addTaskBtn = document.getElementById('addTaskBtn');
        const charCounter = document.getElementById('charCounter');

        taskInput.addEventListener('input', (e) => {
            const length = e.target.value.length;
            charCounter.textContent = `${length}/100`;
            charCounter.style.color = length > 90 ? 'var(--danger-color)' : 'var(--text-secondary)';
        });

        taskInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.addTask();
            }
        });

        addTaskBtn.addEventListener('click', () => this.addTask());

        // Theme toggle
        document.getElementById('themeToggle').addEventListener('click', () => this.toggleTheme());

        // Clear all tasks
        document.getElementById('clearAllBtn').addEventListener('click', () => this.showModal(
            'Clear All Tasks',
            'Are you sure you want to delete all tasks? This action cannot be undone.',
            () => this.clearAllTasks()
        ));

        // Search functionality
        document.getElementById('searchInput').addEventListener('input', (e) => {
            this.searchTerm = e.target.value.toLowerCase();
            this.filterAndDisplayTasks();
        });

        // Filter buttons
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                this.currentFilter = e.target.dataset.filter;
                this.filterAndDisplayTasks();
            });
        });

        // Tasks list event delegation
        document.getElementById('tasksList').addEventListener('click', (e) => {
            const taskItem = e.target.closest('.task-item');
            if (!taskItem) return;

            const taskId = parseInt(taskItem.dataset.taskId);

            if (e.target.closest('.task-btn.complete')) {
                this.toggleTaskCompletion(taskId);
            } else if (e.target.closest('.task-btn.delete')) {
                this.showModal(
                    'Delete Task',
                    'Are you sure you want to delete this task?',
                    () => this.deleteTask(taskId)
                );
            }
        });

        // Modal events
        document.getElementById('modalClose').addEventListener('click', () => this.hideModal());
        document.getElementById('modalCancel').addEventListener('click', () => this.hideModal());
        document.getElementById('modalOverlay').addEventListener('click', (e) => {
            if (e.target === document.getElementById('modalOverlay')) {
                this.hideModal();
            }
        });
    }

    addTask() {
        const taskInput = document.getElementById('taskInput');
        const prioritySelect = document.getElementById('prioritySelect');
        const taskText = taskInput.value.trim();

        if (!taskText) {
            this.showToast('Please enter a task', 'error');
            taskInput.focus();
            return;
        }

        const newTask = {
            id: this.taskIdCounter++,
            text: taskText,
            priority: prioritySelect.value,
            completed: false,
            createdAt: new Date().toISOString(),
            completedAt: null
        };

        this.tasks.unshift(newTask);
        this.saveTasksToStorage();
        this.filterAndDisplayTasks();
        this.updateStats();

        // Reset form
        taskInput.value = '';
        document.getElementById('charCounter').textContent = '0/100';
        prioritySelect.value = 'medium';

        this.showToast('Task added successfully!', 'success');
        taskInput.focus();
    }

    toggleTaskCompletion(taskId) {
        const task = this.tasks.find(t => t.id === taskId);
        if (task) {
            task.completed = !task.completed;
            task.completedAt = task.completed ? new Date().toISOString() : null;
            
            this.saveTasksToStorage();
            this.filterAndDisplayTasks();
            this.updateStats();
            
            const message = task.completed ? 'Task completed!' : 'Task marked as pending';
            this.showToast(message, 'success');
        }
    }

    deleteTask(taskId) {
        this.tasks = this.tasks.filter(t => t.id !== taskId);
        this.saveTasksToStorage();
        this.filterAndDisplayTasks();
        this.updateStats();
        this.showToast('Task deleted successfully', 'success');
        this.hideModal();
    }

    clearAllTasks() {
        this.tasks = [];
        this.taskIdCounter = 1;
        this.saveTasksToStorage();
        this.filterAndDisplayTasks();
        this.updateStats();
        this.showToast('All tasks cleared', 'success');
        this.hideModal();
    }

    filterAndDisplayTasks() {
        let filteredTasks = [...this.tasks];

        // Apply search filter
        if (this.searchTerm) {
            filteredTasks = filteredTasks.filter(task =>
                task.text.toLowerCase().includes(this.searchTerm)
            );
        }

        // Apply status/priority filter
        switch (this.currentFilter) {
            case 'completed':
                filteredTasks = filteredTasks.filter(task => task.completed);
                break;
            case 'pending':
                filteredTasks = filteredTasks.filter(task => !task.completed);
                break;
            case 'high':
                filteredTasks = filteredTasks.filter(task => task.priority === 'high');
                break;
        }

        // Sort tasks: incomplete first, then by priority, then by creation date
        filteredTasks.sort((a, b) => {
            if (a.completed !== b.completed) {
                return a.completed - b.completed;
            }
            
            const priorityOrder = { high: 3, medium: 2, low: 1 };
            if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
                return priorityOrder[b.priority] - priorityOrder[a.priority];
            }
            
            return new Date(b.createdAt) - new Date(a.createdAt);
        });

        this.displayTasks(filteredTasks);
    }

    displayTasks(tasks) {
        const tasksList = document.getElementById('tasksList');
        const emptyState = document.getElementById('emptyState');
        const noResults = document.getElementById('noResults');

        // Hide all states initially
        emptyState.classList.remove('show');
        noResults.classList.remove('show');

        if (this.tasks.length === 0) {
            tasksList.innerHTML = '';
            emptyState.classList.add('show');
            return;
        }

        if (tasks.length === 0) {
            tasksList.innerHTML = '';
            noResults.classList.add('show');
            return;
        }

        const tasksHTML = tasks.map(task => this.createTaskHTML(task)).join('');
        tasksList.innerHTML = tasksHTML;

        // Reinitialize icons for new elements
        setTimeout(() => {
            if (typeof lucide !== 'undefined') {
                lucide.createIcons();
            }
        }, 100);
    }

    createTaskHTML(task) {
        const createdDate = new Date(task.createdAt).toLocaleDateString();
        const completedDate = task.completedAt ? new Date(task.completedAt).toLocaleDateString() : null;
        
        return `
            <div class="task-item priority-${task.priority} ${task.completed ? 'completed' : ''}" data-task-id="${task.id}">
                <div class="task-header">
                    <span class="task-priority ${task.priority}">${task.priority}</span>
                    <div class="task-actions">
                        <button class="task-btn complete" title="${task.completed ? 'Mark as pending' : 'Mark as complete'}">
                            <i data-lucide="${task.completed ? 'rotate-ccw' : 'check'}"></i>
                        </button>
                        <button class="task-btn delete" title="Delete task">
                            <i data-lucide="trash-2"></i>
                        </button>
                    </div>
                </div>
                <div class="task-content">${this.escapeHtml(task.text)}</div>
                <div class="task-meta">
                    <div class="task-date">
                        <i data-lucide="calendar"></i>
                        <span>Created: ${createdDate}</span>
                    </div>
                    ${completedDate ? `
                        <div class="task-date">
                            <i data-lucide="check-circle"></i>
                            <span>Completed: ${completedDate}</span>
                        </div>
                    ` : ''}
                </div>
            </div>
        `;
    }

    updateStats() {
        const total = this.tasks.length;
        const completed = this.tasks.filter(task => task.completed).length;
        const pending = total - completed;

        document.getElementById('totalTasks').textContent = total;
        document.getElementById('completedTasks').textContent = completed;
        document.getElementById('pendingTasks').textContent = pending;
    }

    toggleTheme() {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        
        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme', newTheme);
        this.updateThemeIcon(newTheme);
    }

    updateThemeIcon(theme) {
        const themeToggle = document.getElementById('themeToggle');
        const icon = themeToggle.querySelector('i');
        icon.setAttribute('data-lucide', theme === 'dark' ? 'sun' : 'moon');
        
        setTimeout(() => {
            if (typeof lucide !== 'undefined') {
                lucide.createIcons();
            }
        }, 100);
    }

    showToast(message, type = 'success') {
        const toast = document.getElementById('toast');
        const toastMessage = toast.querySelector('.toast-message');
        const toastIcon = toast.querySelector('.toast-icon');

        // Set message and icon based on type
        toastMessage.textContent = message;
        
        if (type === 'error') {
            toast.style.background = 'var(--danger-color)';
            toastIcon.setAttribute('data-lucide', 'x-circle');
        } else {
            toast.style.background = 'var(--success-color)';
            toastIcon.setAttribute('data-lucide', 'check-circle');
        }

        // Recreate icons
        setTimeout(() => {
            if (typeof lucide !== 'undefined') {
                lucide.createIcons();
            }
        }, 100);

        // Show toast
        toast.classList.add('show');

        // Hide after 3 seconds
        setTimeout(() => {
            toast.classList.remove('show');
        }, 3000);
    }

    showModal(title, message, onConfirm) {
        const modal = document.getElementById('modalOverlay');
        const modalTitle = document.getElementById('modalTitle');
        const modalMessage = document.getElementById('modalMessage');
        const modalConfirm = document.getElementById('modalConfirm');

        modalTitle.textContent = title;
        modalMessage.textContent = message;

        // Remove existing event listeners and add new one
        const newConfirmBtn = modalConfirm.cloneNode(true);
        modalConfirm.parentNode.replaceChild(newConfirmBtn, modalConfirm);
        
        newConfirmBtn.addEventListener('click', () => {
            onConfirm();
            this.hideModal();
        });

        modal.classList.add('show');
    }

    hideModal() {
        document.getElementById('modalOverlay').classList.remove('show');
    }

    saveTasksToStorage() {
        try {
            localStorage.setItem('modern_todo_tasks', JSON.stringify(this.tasks));
            localStorage.setItem('modern_todo_counter', this.taskIdCounter.toString());
        } catch (error) {
            console.error('Failed to save tasks to localStorage:', error);
            this.showToast('Failed to save tasks', 'error');
        }
    }

    loadTasksFromStorage() {
        try {
            const savedTasks = localStorage.getItem('modern_todo_tasks');
            const savedCounter = localStorage.getItem('modern_todo_counter');
            
            if (savedTasks) {
                this.tasks = JSON.parse(savedTasks);
            }
            
            if (savedCounter) {
                this.taskIdCounter = parseInt(savedCounter);
            }
            
            this.filterAndDisplayTasks();
        } catch (error) {
            console.error('Failed to load tasks from localStorage:', error);
            this.showToast('Failed to load saved tasks', 'error');
        }
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new ModernTodoApp();
});

// Service Worker registration for offline functionality (optional)
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
            .then(registration => console.log('SW registered'))
            .catch(registrationError => console.log('SW registration failed'));
    });
}