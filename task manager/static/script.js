document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const appContent = document.getElementById('app-content');
    const loginModal = document.getElementById('login-modal');
    const loginForm = document.getElementById('login-form');
    const welcomeText = document.getElementById('welcome-text');
    const logoutBtn = document.getElementById('logout-btn');

    const themeToggle = document.getElementById('theme-toggle');
    const addTaskBtn = document.getElementById('add-task-btn');
    const taskModal = document.getElementById('task-modal');
    const taskForm = document.getElementById('task-form');
    
    const addNdBtn = document.getElementById('add-nondaily-btn');
    const ndModal = document.getElementById('nondaily-modal');
    const ndForm = document.getElementById('nondaily-form');

    const searchInput = document.getElementById('search-input');
    const filterPriority = document.getElementById('filter-priority');
    
    const pendingCountEl = document.getElementById('pending-tasks-count');
    const todayCountEl = document.getElementById('today-tasks-count');
    
    const trackingHeader = document.getElementById('tracking-header');
    const trackingBody = document.getElementById('tracking-body');
    const nondailyList = document.getElementById('nondaily-list');
    
    let speedometerChart = null;
    let allTasks = [];
    let allProgress = [];
    let allNonDaily = [];
    let currentUser = null;

    const getLocalYYYYMMDD = (d) => {
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    };

    // --- Theme Logic ---
    const initTheme = () => {
        const savedTheme = localStorage.getItem('theme') || 'light';
        document.documentElement.setAttribute('data-theme', savedTheme);
        themeToggle.querySelector('i').className = savedTheme === 'light' ? 'fas fa-moon' : 'fas fa-sun';
        themeToggle.querySelector('i').style.width = '20px';
    };

    const toggleTheme = () => {
        const current = document.documentElement.getAttribute('data-theme');
        const next = current === 'light' ? 'dark' : 'light';
        document.documentElement.setAttribute('data-theme', next);
        localStorage.setItem('theme', next);
        themeToggle.querySelector('i').className = next === 'light' ? 'fas fa-moon' : 'fas fa-sun';
        themeToggle.querySelector('i').style.width = '20px';
        if (speedometerChart) speedometerChart.update();
    };

    themeToggle.addEventListener('click', toggleTheme);
    initTheme();

    const fetchSettings = async () => {
        try {
            const res = await fetch('/api/settings');
            if (res.ok) {
                const data = await res.json();
                const notifyToggle = document.getElementById('morning-notify-toggle');
                if (notifyToggle) {
                    notifyToggle.checked = data.morning_notify;
                }
            }
        } catch(e) {}
    };

    const notifyToggle = document.getElementById('morning-notify-toggle');
    if (notifyToggle) {
        notifyToggle.addEventListener('change', async (e) => {
            try {
                await fetch('/api/settings', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ morning_notify: e.target.checked })
                });
                showToast('Notification settings updated');
            } catch(err) {
                showToast('Failed to update settings', 'error');
                e.target.checked = !e.target.checked;
            }
        });
    }

    const settingsBtn = document.getElementById('settings-btn');
    const settingsDropdown = document.getElementById('settings-dropdown');
    if (settingsBtn) {
        settingsBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            document.querySelectorAll('.dropdown-menu.show').forEach(m => {
                if (m !== settingsDropdown) m.classList.remove('show');
            });
            settingsDropdown.classList.toggle('show');
        });
    }

    // Browser Notification replaced by Native Python OS Background Agent

    // --- Auth Logic ---
    const checkAuth = async () => {
        try {
            const res = await fetch('/api/auth/status');
            const data = await res.json();
            if (data.logged_in) {
                currentUser = data.username;
                showApp();
            } else {
                showLogin();
            }
        } catch (e) {
            showLogin();
        }
    };

    const showApp = () => {
        loginModal.classList.remove('active');
        appContent.style.display = 'block';
        welcomeText.textContent = `Hello, ${currentUser}`;
        const progressHeader = document.getElementById('overall-progress-header');
        if (progressHeader) {
            progressHeader.textContent = `Overall Progress of ${currentUser}`;
        }
        fetchSettings();
        fetchData();
    };

    const showLogin = () => {
        appContent.style.display = 'none';
        loginModal.classList.add('active');
    };

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = document.getElementById('login-username').value;
        const password = document.getElementById('login-password').value;
        
        try {
            const res = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });
            const data = await res.json();
            if (data.success) {
                currentUser = data.username;
                showToast(`Welcome, ${currentUser}!`, 'success');
                loginForm.reset();
                showApp();
            } else {
                showToast(data.error, 'error');
            }
        } catch (err) {
            showToast('Login failed', 'error');
        }
    });

    logoutBtn.addEventListener('click', async () => {
        await fetch('/api/auth/logout', { method: 'POST' });
        currentUser = null;
        showLogin();
    });

    // --- Modal Logic ---
    const openModal = (modalEl) => modalEl.classList.add('active');
    const closeModal = (modalEl) => modalEl.classList.remove('active');

    document.querySelectorAll('.close-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const modalId = btn.getAttribute('data-modal');
            closeModal(document.getElementById(modalId));
        });
    });

    window.addEventListener('click', (e) => {
        if (e.target.classList.contains('modal')) closeModal(e.target);
        
        // Close dropdowns if clicked outside
        if (!e.target.closest('.actions-cell') && !e.target.closest('.nd-actions') && !e.target.closest('#settings-btn') && !e.target.closest('#settings-dropdown')) {
            document.querySelectorAll('.dropdown-menu.show').forEach(m => m.classList.remove('show'));
        }
    });

    window.toggleDropdown = (id, type = 'task') => {
        // Close others first
        document.querySelectorAll('.dropdown-menu.show').forEach(m => {
            if (m.id !== `dropdown-${type}-${id}`) m.classList.remove('show');
        });
        document.getElementById(`dropdown-${type}-${id}`).classList.toggle('show');
    };

    addTaskBtn.addEventListener('click', () => {
        document.getElementById('modal-title').textContent = 'Add New Task';
        taskForm.reset();
        document.getElementById('task-id').value = '';
        document.getElementById('task-start').value = getLocalYYYYMMDD(new Date());
        openModal(taskModal);
    });

    document.getElementById('btn-tomorrow').addEventListener('click', () => {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        document.getElementById('task-start').value = getLocalYYYYMMDD(tomorrow);
    });

    addNdBtn.addEventListener('click', () => {
        document.getElementById('nd-modal-title').textContent = 'Add Work';
        ndForm.reset();
        document.getElementById('nd-id').value = '';
        openModal(ndModal);
    });

    // --- Data Fetch & Render ---
    const fetchData = async () => {
        try {
            const res = await fetch('/api/tasks');
            if (res.status === 401) { showLogin(); return; }
            const data = await res.json();
            allTasks = data.tasks;
            allProgress = data.progress;
            allNonDaily = data.non_daily_tasks;
            renderDashboard();
            renderNonDaily();
        } catch (err) {
            showToast('Failed to load data', 'error');
        }
    };

    const formatDate = (dateStr) => {
        const d = new Date(dateStr);
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    };

    const generateDates = () => {
        const todayD = new Date();
        const todayStr = getLocalYYYYMMDD(todayD);
        
        let earliestDateStr = todayStr;
        
        allTasks.forEach(t => {
            if (t.start_date < earliestDateStr) earliestDateStr = t.start_date;
        });

        const minDate = new Date();
        minDate.setDate(minDate.getDate() - 6);
        const minDateStr = getLocalYYYYMMDD(minDate);

        if (minDateStr < earliestDateStr) earliestDateStr = minDateStr;

        const dates = [];
        const startD = new Date(earliestDateStr);
        const endD = new Date(todayStr);

        for (let d = new Date(startD); d <= endD; d.setDate(d.getDate() + 1)) {
            dates.push(getLocalYYYYMMDD(d));
        }
        return dates;
    };

    let showFutureTasks = false;
    const toggleFutureBtn = document.getElementById('toggle-future-btn');
    if (toggleFutureBtn) {
        toggleFutureBtn.addEventListener('click', () => {
            showFutureTasks = !showFutureTasks;
            toggleFutureBtn.innerHTML = showFutureTasks ? '<i class="fas fa-eye-slash"></i> Hide Future Tasks' : '<i class="fas fa-eye"></i> Show Future Tasks';
            renderDashboard();
        });
    }

    const renderDashboard = () => {
        const query = searchInput.value.toLowerCase();
        const priorityFilter = filterPriority.value;
        const todayStr = getLocalYYYYMMDD(new Date());

        let filteredTasks = allTasks.filter(t => {
            const matchSearch = t.title.toLowerCase().includes(query) || (t.description || '').toLowerCase().includes(query);
            const matchPriority = priorityFilter === 'all' || t.priority === priorityFilter;
            const hasStarted = t.start_date <= todayStr;
            return matchSearch && matchPriority && (showFutureTasks || hasStarted);
        });
        
        const todayTasksCount = allTasks.filter(t => t.start_date <= todayStr && (!t.end_date || t.end_date >= todayStr)).length;
        todayCountEl.textContent = todayTasksCount;

        let pendingCount = 0;
        allTasks.forEach(t => {
            if (t.start_date <= todayStr && (!t.end_date || t.end_date >= todayStr)) {
                const todayProgress = allProgress.find(p => p.task_id === t.id && p.date === todayStr);
                if (!todayProgress || todayProgress.status === 0) pendingCount++;
            }
        });
        pendingCountEl.textContent = pendingCount;

        const datesView = generateDates();
        
        // Header with Actions first
        trackingHeader.innerHTML = `<th style="width: 50px; text-align: center;"><i class="fas fa-cog"></i></th><th>Task Details</th>`;
        datesView.forEach(date => {
            const isToday = date === todayStr;
            if (isToday) {
                trackingHeader.innerHTML += `<th style="text-align: center;"><span class="today-header-pill">Today</span></th>`;
            } else {
                trackingHeader.innerHTML += `<th style="text-align: center; opacity: 0.7;">${formatDate(date)}</th>`;
            }
        });

        trackingBody.innerHTML = '';
        if (filteredTasks.length === 0) {
            trackingBody.innerHTML = `<tr><td colspan="${datesView.length + 2}" style="text-align:center; padding: 40px; color: var(--text-muted);">No tasks found. Click "Add Task" to start!</td></tr>`;
        }

        let totalCompletionPoints = 0;
        let totalPossiblePoints = 0;

        const pastTodayTasks = filteredTasks.filter(t => t.start_date <= todayStr);
        const futureTasks = filteredTasks.filter(t => t.start_date > todayStr);
        const sortedFilteredTasks = [...pastTodayTasks, ...futureTasks];
        
        let renderedFutureHeader = false;

        sortedFilteredTasks.forEach(task => {
            if (task.start_date > todayStr && !renderedFutureHeader && pastTodayTasks.length > 0) {
                renderedFutureHeader = true;
                const trDiv = document.createElement('tr');
                trDiv.style.background = 'transparent';
                trDiv.style.boxShadow = 'none';
                trDiv.style.pointerEvents = 'none';
                trDiv.innerHTML = `<td colspan="${datesView.length + 2}" style="padding: 15px 0; border: none;">
                    <hr style="border: 0; border-top: 2px dashed rgba(255, 255, 255, 0.3); margin: 0;">
                </td>`;
                trackingBody.appendChild(trDiv);
            }
            const tr = document.createElement('tr');
            
            let taskCompletedDays = 0;
            let taskValidDays = 0;

            const stDate = new Date(task.start_date);
            const todayDate = new Date(todayStr);
            const enDate = task.end_date ? new Date(task.end_date) : todayDate;
            const endLimit = todayDate < enDate ? todayDate : enDate;

            for (let d = new Date(stDate); d <= endLimit; d.setDate(d.getDate() + 1)) {
                taskValidDays++;
                const curStr = d.toISOString().split('T')[0];
                const p = allProgress.find(x => x.task_id === task.id && x.date === curStr);
                if (p && p.status === 1) taskCompletedDays++;
            }

            const taskProgressPercent = taskValidDays > 0 ? Math.round((taskCompletedDays / taskValidDays) * 100) : 0;
            totalCompletionPoints += taskCompletedDays;
            totalPossiblePoints += taskValidDays;

            // Mark task visually as completed if 100%
            if (taskProgressPercent === 100 && taskValidDays > 0) tr.classList.add('completed-task');

            let rowHtml = `
                <td class="actions-cell">
                    <button class="kebab-btn" onclick="toggleDropdown(${task.id}, 'task')" title="Options">
                        <i class="fas fa-ellipsis-v"></i>
                    </button>
                    <div id="dropdown-task-${task.id}" class="dropdown-menu" style="left: 0; top: 35px;">
                        <button class="drop-item" onclick="viewTaskDetails(${task.id})"><i class="fas fa-info-circle"></i> Details</button>
                        <button class="drop-item" onclick="editTask(${task.id})"><i class="fas fa-pen"></i> Edit</button>
                        <button class="drop-item del" onclick="deleteTask(${task.id})"><i class="fas fa-trash"></i> Delete</button>
                    </div>
                </td>
                <td class="task-cell">
                    <div class="task-title-wrap">
                        <span class="task-title">${task.title}</span>
                        ${task.time ? `<div class="task-meta"><span><i class="far fa-clock"></i> ${task.time}</span></div>` : ''}
                    </div>
                </td>
            `;

            datesView.forEach(date => {
                const isBeforeStart = date < task.start_date;
                const isAfterEnd = task.end_date && date > task.end_date;
                const isFuture = date > todayStr;
                
                const p = allProgress.find(x => x.task_id === task.id && x.date === date);
                const checked = p && p.status === 1 ? 'checked' : '';
                
                let cellClass = 'date-cell';
                let disabled = '';
                
                if (isBeforeStart || isAfterEnd || isFuture) {
                    cellClass += ' disabled';
                    disabled = 'disabled';
                } else if (date < todayStr) {
                    disabled = 'disabled';
                }

                rowHtml += `
                    <td class="${cellClass}">
                        <input type="checkbox" class="check-input" 
                            data-task-id="${task.id}" 
                            data-date="${date}" 
                            ${checked} ${disabled}
                            onchange="updateProgress(this)">
                    </td>
                `;
            });

            tr.innerHTML = rowHtml;
            trackingBody.appendChild(tr);
        });

        const overallPercent = totalPossiblePoints > 0 ? Math.round((totalCompletionPoints / totalPossiblePoints) * 100) : 0;
        document.getElementById('avg-completion').textContent = `${overallPercent}%`;
        
        // Calculate Today's Rate
        const todayCompletedCount = todayTasksCount - pendingCount;
        const todayRate = todayTasksCount > 0 ? Math.round((todayCompletedCount / todayTasksCount) * 100) : 0;
        document.getElementById('today-rate').textContent = `${todayRate}%`;

        // Calculate Active Streak
        let streak = 0;
        for (let i = 0; i <= 30; i++) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            const str = getLocalYYYYMMDD(d);
            const hasCompleted = allProgress.some(p => p.date === str && p.status === 1);
            if (hasCompleted) streak++;
            else if (i > 0) break; 
        }
        document.getElementById('active-streak').textContent = `${streak} Days`;

        renderSpeedometer(overallPercent);
    };

    const renderNonDaily = () => {
        nondailyList.innerHTML = '';
        if (allNonDaily.length === 0) {
            nondailyList.innerHTML = `<li style="text-align:center; padding: 20px; color: var(--text-muted);">No non-daily works added.</li>`;
            return;
        }

        allNonDaily.forEach(nd => {
            const li = document.createElement('li');
            li.className = 'nd-item';
            li.innerHTML = `
                <div class="nd-info">
                    <span class="nd-title">${nd.title}</span>
                    ${nd.duration ? `<span class="nd-duration"><i class="far fa-clock"></i> ${nd.duration}</span>` : ''}
                </div>
                <div class="nd-actions">
                    <button class="kebab-btn" onclick="toggleDropdown(${nd.id}, 'nd')" title="Options">
                        <i class="fas fa-ellipsis-v"></i>
                    </button>
                    <div id="dropdown-nd-${nd.id}" class="dropdown-menu" style="right: 0; left: auto; top: 30px;">
                        <button class="drop-item" onclick="editNdTask(${nd.id})"><i class="fas fa-pen"></i> Edit</button>
                        <button class="drop-item del" onclick="deleteNdTask(${nd.id})"><i class="fas fa-trash"></i> Delete</button>
                    </div>
                </div>
            `;
            nondailyList.appendChild(li);
        });
    };

    // --- Account Management ---
    const accAction = async (actionStr, confirmMsg, successMsg) => {
        if (!confirm(confirmMsg)) return;
        try {
            const res = await fetch('/api/account/clear', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: actionStr })
            });
            if (res.status === 401) { showLogin(); return; }
            if (res.ok) {
                showToast(successMsg, 'success');
                fetchData();
            }
        } catch (e) {
            showToast('Action failed', 'error');
        }
        document.getElementById('settings-dropdown').classList.remove('show');
    };

    document.getElementById('del-tasks-btn')?.addEventListener('click', () => accAction('tasks', 'Delete all daily tasks?', 'All tasks deleted'));
    document.getElementById('del-works-btn')?.addEventListener('click', () => accAction('works', 'Delete all works?', 'All works deleted'));
    document.getElementById('reset-progress-btn')?.addEventListener('click', () => accAction('progress', 'Reset all tracking progress?', 'Progress reset'));
    document.getElementById('reset-account-btn')?.addEventListener('click', () => accAction('all', 'WARNING: Reset entire account? This deletes all your data forever.', 'Account completely reset'));

    document.getElementById('change-username-btn')?.addEventListener('click', () => {
        document.getElementById('settings-dropdown').classList.remove('show');
        document.getElementById('username-form').reset();
        openModal(document.getElementById('change-username-modal'));
    });
    document.getElementById('change-password-btn')?.addEventListener('click', () => {
        document.getElementById('settings-dropdown').classList.remove('show');
        document.getElementById('password-form').reset();
        openModal(document.getElementById('change-password-modal'));
    });

    document.getElementById('username-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const newUsername = document.getElementById('new-username').value;
        try {
            const res = await fetch('/api/account/username', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: newUsername })
            });
            const data = await res.json();
            if (data.success) {
                currentUser = data.username;
                document.getElementById('welcome-text').textContent = `Hello, ${currentUser}`;
                const progressHeader = document.getElementById('overall-progress-header');
                if (progressHeader) progressHeader.textContent = `Overall Progress of ${currentUser}`;
                showToast('Username updated!', 'success');
                closeModal(document.getElementById('change-username-modal'));
            } else {
                showToast(data.error || 'Failed to update username', 'error');
            }
        } catch (e) { showToast('Network error', 'error'); }
    });

    document.getElementById('password-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const newPassword = document.getElementById('new-password').value;
        try {
            const res = await fetch('/api/account/password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password: newPassword })
            });
            const data = await res.json();
            if (data.success) {
                showToast('Password updated successfully!', 'success');
                closeModal(document.getElementById('change-password-modal'));
            } else {
                showToast(data.error || 'Failed to update password', 'error');
            }
        } catch (e) { showToast('Network error', 'error'); }
    });

    // --- Daily Task CRUD ---
    taskForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = document.getElementById('task-id').value;
        const taskData = {
            title: document.getElementById('task-title').value,
            description: document.getElementById('task-desc').value,
            start_date: document.getElementById('task-start').value,
            end_date: document.getElementById('task-end').value,
            time: document.getElementById('task-time').value,
            priority: document.getElementById('task-priority').value,
            notify: false,
            reminder_datetime: (() => {
                const rTime = document.getElementById('task-reminder-time').value;
                const rDate = document.getElementById('task-reminder-date').value;
                if (!rTime) return '';
                return rDate ? `${rDate}T${rTime}` : rTime;
            })()
        };
        const url = id ? `/update/${id}` : '/add';
        
        try {
            const res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(taskData)
            });
            const data = await res.json();
            if (data.success) {
                showToast(id ? 'Task updated!' : 'Task added successfully!', 'success');
                closeModal(taskModal);
                fetchData();
            } else {
                showToast(data.error || 'Operation failed', 'error');
                if (res.status === 401) showLogin();
            }
        } catch (err) { showToast('Error saving task', 'error'); }
    });

    window.viewTaskDetails = (id) => {
        const task = allTasks.find(t => t.id === id);
        if (task) {
            document.getElementById('det-title').textContent = task.title;
            document.getElementById('det-desc').textContent = task.description || 'No description provided.';
            document.getElementById('det-start').textContent = formatDate(task.start_date);
            document.getElementById('det-end').textContent = task.end_date ? formatDate(task.end_date) : 'Every Day';
            
            const priorityEl = document.getElementById('det-priority');
            const pt = task.priority || 'Medium';
            priorityEl.textContent = pt;
            priorityEl.style.color = pt === 'High' ? 'var(--danger)' : pt === 'Medium' ? 'var(--warning)' : 'var(--success)';
            
            const notifyEl = document.getElementById('det-notify');
            const rem_dt = task.reminder_datetime || '';
            if (rem_dt.length === 16) {
                const dt = new Date(rem_dt);
                notifyEl.textContent = dt.toLocaleString([], {dateStyle: 'short', timeStyle: 'short'});
                notifyEl.style.background = 'rgba(16, 185, 129, 0.1)';
                notifyEl.style.color = 'var(--success)';
            } else if (rem_dt.length === 5) {
                notifyEl.textContent = `Everyday at ${rem_dt}`;
                notifyEl.style.background = 'rgba(59, 130, 246, 0.1)';
                notifyEl.style.color = 'var(--primary-color)';
            } else {
                notifyEl.textContent = 'None';
                notifyEl.style.background = 'rgba(239, 68, 68, 0.1)';
                notifyEl.style.color = 'var(--danger)';
            }
            openModal(document.getElementById('details-modal'));
        }
    };

    window.editTask = (id) => {
        const task = allTasks.find(t => t.id === id);
        if (task) {
            document.getElementById('modal-title').textContent = 'Edit Task';
            document.getElementById('task-id').value = task.id;
            document.getElementById('task-title').value = task.title;
            document.getElementById('task-desc').value = task.description || '';
            document.getElementById('task-start').value = task.start_date;
            document.getElementById('task-end').value = task.end_date || '';
            document.getElementById('task-time').value = task.time || '';
            document.getElementById('task-priority').value = task.priority || 'Medium';
            const rem_dt = task.reminder_datetime || '';
            let rTimeVal = '', rDateVal = '';
            if (rem_dt.length === 16) {
                const parts = rem_dt.split('T');
                rDateVal = parts[0];
                rTimeVal = parts[1];
            } else if (rem_dt.length === 5) {
                rTimeVal = rem_dt;
            }
            document.getElementById('task-reminder-time').value = rTimeVal;
            document.getElementById('task-reminder-date').value = rDateVal;
            openModal(taskModal);
        }
    };

    window.deleteTask = async (id) => {
        if (!confirm('Are you sure you want to delete this task?')) return;
        try {
            const res = await fetch(`/delete/${id}`, { method: 'DELETE' });
            if (res.status === 401) { showLogin(); return; }
            showToast('Task deleted', 'success');
            fetchData();
        } catch (err) { showToast('Error deleting', 'error'); }
    };

    window.updateProgress = async (checkbox) => {
        const taskId = checkbox.getAttribute('data-task-id');
        const date = checkbox.getAttribute('data-date');
        const status = checkbox.checked ? 1 : 0;

        try {
            const res = await fetch('/progress', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ task_id: taskId, date: date, status: status })
            });
            if (res.status === 401) { showLogin(); return; }
            
            const existing = allProgress.find(p => p.task_id == taskId && p.date == date);
            if (existing) existing.status = status;
            else allProgress.push({ task_id: parseInt(taskId), date: date, status: status });
            
            renderDashboard(); // Re-render to update progress bar smoothly
        } catch (err) {
            showToast('Error saving progress', 'error');
            checkbox.checked = !checkbox.checked;
        }
    };

    // --- Non-Daily Tasks CRUD ---
    ndForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = document.getElementById('nd-id').value;
        const taskData = {
            title: document.getElementById('nd-title').value,
            duration: document.getElementById('nd-duration').value
        };
        const url = id ? `/api/non_daily/${id}` : '/api/non_daily';
        
        try {
            const res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(taskData)
            });
            if (res.status === 401) { showLogin(); return; }
            const data = await res.json();
            if (data.success) {
                showToast('Work saved!', 'success');
                closeModal(ndModal);
                fetchData();
            }
        } catch (err) { showToast('Error saving work', 'error'); }
    });

    window.editNdTask = (id) => {
        const task = allNonDaily.find(t => t.id === id);
        if (task) {
            document.getElementById('nd-modal-title').textContent = 'Edit Work';
            document.getElementById('nd-id').value = task.id;
            document.getElementById('nd-title').value = task.title;
            document.getElementById('nd-duration').value = task.duration || '';
            openModal(ndModal);
        }
    };

    window.deleteNdTask = async (id) => {
        if (!confirm('Delete this work?')) return;
        try {
            const res = await fetch(`/api/non_daily/${id}`, { method: 'DELETE' });
            if (res.status === 401) { showLogin(); return; }
            showToast('Work deleted', 'success');
            fetchData();
        } catch (err) { showToast('Error deleting', 'error'); }
    };

    // --- Charts & Toasts ---
    const renderSpeedometer = (percent) => {
        const ctx = document.getElementById('speedometerChart').getContext('2d');
        const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
        const color = percent > 75 ? '#10b981' : (percent > 40 ? '#f59e0b' : '#ef4444');
        const bg = isDark ? 'rgba(55, 65, 81, 0.5)' : 'rgba(229, 231, 235, 0.5)';

        if (speedometerChart) {
            speedometerChart.data.datasets[0].data = [percent, 100 - percent];
            speedometerChart.data.datasets[0].backgroundColor = [color, bg];
            speedometerChart.update();
            return;
        }

        speedometerChart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['Completed', 'Pending'],
                datasets: [{
                    data: [percent, 100 - percent],
                    backgroundColor: [color, bg],
                    borderWidth: 0,
                    circumference: 180,
                    rotation: 270,
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '80%',
                plugins: { legend: { display: false }, tooltip: { enabled: false } }
            }
        });
    };

    const showToast = (message, type = 'success') => {
        const container = document.getElementById('toast-container');
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        const icon = type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle';
        toast.innerHTML = `<i class="fas ${icon}"></i> <span>${message}</span>`;
        container.appendChild(toast);
        setTimeout(() => {
            toast.style.opacity = '0';
            setTimeout(() => toast.remove(), 400);
        }, 3000);
    };

    searchInput.addEventListener('input', renderDashboard);
    filterPriority.addEventListener('change', renderDashboard);

    // Initial Start
    checkAuth();
});
