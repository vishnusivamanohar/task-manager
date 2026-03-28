import sqlite3
from flask import Flask, render_template, request, jsonify, session
from werkzeug.security import generate_password_hash, check_password_hash
import os
import threading
import time
import subprocess
from datetime import datetime

app = Flask(__name__)

def daily_reminder_thread():
    last_notified_date = None
    notified_file = os.path.join(BASE_DIR, '.last_notified')
    try:
        if os.path.exists(notified_file):
            with open(notified_file, 'r') as f:
                last_notified_date = f.read().strip()
    except: pass
    sent_daily_reminders = set()
    
    while True:
        now = datetime.now()
        current_date_str = now.strftime('%Y-%m-%d')
        current_time_str = now.strftime('%Y-%m-%dT%H:%M')
        
        # Trigger strict morning notification roughly at or after 6 AM
        if now.hour >= 6 and now.hour < 12 and last_notified_date != current_date_str:
            try:
                conn = sqlite3.connect(DB_NAME)
                try:
                    conn.execute('ALTER TABLE users ADD COLUMN morning_notify BOOLEAN DEFAULT 1')
                except:
                    pass
                count = conn.execute('SELECT COUNT(*) FROM users WHERE morning_notify = 1 OR morning_notify IS NULL').fetchone()[0]
                conn.close()
                if count > 0:
                    ps_script = """
                    [reflection.assembly]::loadwithpartialname("System.Windows.Forms") | Out-Null
                    $notify = New-Object System.Windows.Forms.NotifyIcon
                    $notify.Icon = [System.Drawing.SystemIcons]::Information
                    $notify.Visible = $true
                    $notify.ShowBalloonTip(10000, "Task Manager", "Good Morning! Time to check your daily tasks!", [system.windows.forms.tooltipicon]::Info)
                    """
                    subprocess.Popen(["powershell", "-WindowStyle", "Hidden", "-Command", ps_script], creationflags=0x08000000)
                    last_notified_date = current_date_str
                    try:
                        with open(notified_file, 'w') as f:
                            f.write(last_notified_date)
                    except: pass
            except Exception: pass

        # Check specific task reminders
        try:
            conn = sqlite3.connect(DB_NAME)
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            tasks = cursor.execute('''
                SELECT id, title, reminder_datetime, reminder_sent 
                FROM tasks 
                WHERE reminder_datetime IS NOT NULL 
                AND reminder_datetime != "" 
            ''').fetchall()
            
            for t in tasks:
                rem_dt = t['reminder_datetime']
                t_id = t['id']
                
                # Format 1: Exact DateTime (e.g. 2026-03-27T22:15)
                if len(rem_dt) == 16:
                    if (not t['reminder_sent']) and current_time_str >= rem_dt:
                        msg = f"Complete your task: {t['title']}!"
                        ps_script = f"""
                        [reflection.assembly]::loadwithpartialname("System.Windows.Forms") | Out-Null
                        $notify = New-Object System.Windows.Forms.NotifyIcon
                        $notify.Icon = [System.Drawing.SystemIcons]::Information
                        $notify.Visible = $true
                        $notify.ShowBalloonTip(10000, "Task Reminder", "{msg}", [system.windows.forms.tooltipicon]::Info)
                        """
                        subprocess.Popen(["powershell", "-WindowStyle", "Hidden", "-Command", ps_script], creationflags=0x08000000)
                        cursor.execute('UPDATE tasks SET reminder_sent = 1 WHERE id = ?', (t_id,))
                
                # Format 2: Daily Time (e.g. 22:15)
                elif len(rem_dt) == 5:
                    current_hm = now.strftime('%H:%M')
                    if current_hm == rem_dt:
                        memory_key = f"{t_id}_{current_date_str}"
                        if memory_key not in sent_daily_reminders:
                            msg = f"Complete your task: {t['title']}!"
                            ps_script = f"""
                            [reflection.assembly]::loadwithpartialname("System.Windows.Forms") | Out-Null
                            $notify = New-Object System.Windows.Forms.NotifyIcon
                            $notify.Icon = [System.Drawing.SystemIcons]::Information
                            $notify.Visible = $true
                            $notify.ShowBalloonTip(10000, "Task Reminder", "{msg}", [system.windows.forms.tooltipicon]::Info)
                            """
                            subprocess.Popen(["powershell", "-WindowStyle", "Hidden", "-Command", ps_script], creationflags=0x08000000)
                            sent_daily_reminders.add(memory_key)
            
            conn.commit()
            conn.close()
        except Exception:
            pass
            
        time.sleep(60)

threading.Thread(target=daily_reminder_thread, daemon=True).start()
app.secret_key = 'super_secret_key_for_task_manager'
import os
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_NAME = os.path.join(BASE_DIR, 'tasksv2.db') # Changed DB name to ensure fresh schema with user_id

def get_db_connection():
    conn = sqlite3.connect(DB_NAME)
    conn.execute('PRAGMA foreign_keys = ON')
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db_connection()
    c = conn.cursor()
    c.execute('''
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT NOT NULL,
                password TEXT NOT NULL
            )  ''')
    c.execute('''
        CREATE TABLE IF NOT EXISTS tasks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            title TEXT NOT NULL,
            description TEXT,
            start_date TEXT NOT NULL,
            end_date TEXT,
            time TEXT,
            priority TEXT,
            notify BOOLEAN NOT NULL CHECK (notify IN (0, 1)),
            FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
        )
    ''')
    try:
        c.execute('ALTER TABLE tasks ADD COLUMN reminder_datetime TEXT')
        c.execute('ALTER TABLE tasks ADD COLUMN reminder_sent INTEGER DEFAULT 0')
    except sqlite3.OperationalError:
        pass
    try:
        c.execute('ALTER TABLE users ADD COLUMN morning_notify BOOLEAN DEFAULT 1')
    except sqlite3.OperationalError:
        pass
    c.execute('''
        CREATE TABLE IF NOT EXISTS task_progress (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            task_id INTEGER NOT NULL,
            user_id INTEGER NOT NULL,
            date TEXT NOT NULL,
            status INTEGER NOT NULL CHECK (status IN (0, 1)),
            UNIQUE(task_id, date),
            FOREIGN KEY(task_id) REFERENCES tasks(id) ON DELETE CASCADE,
            FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
        )
    ''')
    c.execute('''
        CREATE TABLE IF NOT EXISTS non_daily_tasks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            title TEXT NOT NULL,
            duration TEXT,
            FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
        )
    ''')
    conn.commit()
    conn.close()

init_db()

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/auth/login', methods=['POST'])
def login():
    data = request.json
    username = data.get('username')
    password = data.get('password')
    
    if not username or not password:
        return jsonify({'error': 'Username and password required'}), 400

    username = username.strip().lower()

    conn = get_db_connection()
    users = conn.execute('SELECT * FROM users WHERE username = ?', (username,)).fetchall()
    
    matched_user = None
    if users:
        for u in users:
            if check_password_hash(u['password'], password):
                matched_user = u
                break
                
    if matched_user:
        session['user_id'] = matched_user['id']
        session['username'] = matched_user['username']
        conn.close()
        return jsonify({'success': True, 'username': matched_user['username']})
    else:
        all_users = conn.execute('SELECT password FROM users').fetchall()
        for u in all_users:
            if check_password_hash(u['password'], password):
                conn.close()
                return jsonify({'error': 'Invalid credentials. If you are trying to create a new account, this password is already in use!'}), 401

        # Auto-register new account since password didn't match any existing username records
        hashed_pw = generate_password_hash(password)
        cursor = conn.execute('INSERT INTO users (username, password) VALUES (?, ?)', (username, hashed_pw))
        conn.commit()
        
        user_id = cursor.lastrowid
        session['user_id'] = user_id
        session['username'] = username
        conn.close()
        
        return jsonify({'success': True, 'is_new': True, 'username': username})

@app.route('/api/auth/logout', methods=['POST'])
def logout():
    session.clear()
    return jsonify({'success': True})

@app.route('/api/auth/status', methods=['GET'])
def auth_status():
    if 'user_id' in session:
        return jsonify({'logged_in': True, 'username': session['username']})
    return jsonify({'logged_in': False})

def login_required(f):
    def wrap(*args, **kwargs):
        if 'user_id' not in session:
            return jsonify({'error': 'Unauthorized'}), 401
        return f(*args, **kwargs)
    wrap.__name__ = f.__name__
    return wrap

@app.route('/api/account/username', methods=['POST'])
@login_required
def update_username():
    user_id = session['user_id']
    new_username = request.json.get('username', '').strip().lower()
    if not new_username:
        return jsonify({'error': 'Username required'}), 400
    conn = get_db_connection()
    try:
        conn.execute('UPDATE users SET username = ? WHERE id = ?', (new_username, user_id))
        conn.commit()
        session['username'] = new_username
    except Exception as e:
        conn.close()
        return jsonify({'error': 'Failed to update username'}), 500
    conn.close()
    return jsonify({'success': True, 'username': new_username})

@app.route('/api/account/password', methods=['POST'])
@login_required
def update_password():
    user_id = session['user_id']
    new_password = request.json.get('password', '')
    if not new_password:
        return jsonify({'error': 'Password required'}), 400
        
    conn = get_db_connection()
    all_users = conn.execute('SELECT id, password FROM users').fetchall()
    for u in all_users:
        if check_password_hash(u['password'], new_password):
            conn.close()
            return jsonify({'error': 'This password is already in use. Please choose a different unique password.'}), 400

    hashed_pw = generate_password_hash(new_password)
    conn.execute('UPDATE users SET password = ? WHERE id = ?', (hashed_pw, user_id))
    conn.commit()
    conn.close()
    return jsonify({'success': True})

@app.route('/api/account/clear', methods=['POST'])
@login_required
def clear_account_data():
    user_id = session['user_id']
    action = request.json.get('action')
    conn = get_db_connection()
    if action in ['tasks', 'all']:
        conn.execute('DELETE FROM tasks WHERE user_id = ?', (user_id,))
    if action in ['works', 'all']:
        conn.execute('DELETE FROM non_daily_tasks WHERE user_id = ?', (user_id,))
    if action in ['progress', 'all']:
        conn.execute('DELETE FROM task_progress WHERE user_id = ?', (user_id,))
    conn.commit()
    conn.close()
    return jsonify({'success': True})

@app.route('/api/settings', methods=['GET', 'POST'])
@login_required
def api_settings():
    user_id = session['user_id']
    conn = get_db_connection()
    if request.method == 'POST':
        data = request.json
        morning_notify = data.get('morning_notify', True)
        if isinstance(morning_notify, bool):
            morning_notify = 1 if morning_notify else 0
        conn.execute('UPDATE users SET morning_notify = ? WHERE id = ?', (morning_notify, user_id))
        conn.commit()
        conn.close()
        return jsonify({'success': True})
    else:
        user = conn.execute('SELECT * FROM users WHERE id = ?', (user_id,)).fetchone()
        conn.close()
        notify = True
        if user:
            try:
                val = user['morning_notify']
                if val is not None:
                    notify = bool(val)
            except IndexError:
                pass
        return jsonify({'morning_notify': notify})

@app.route('/api/tasks')
@login_required
def api_tasks():
    user_id = session['user_id']
    conn = get_db_connection()
    tasks_rows = conn.execute('SELECT * FROM tasks WHERE user_id = ?', (user_id,)).fetchall()
    progress_rows = conn.execute('SELECT * FROM task_progress WHERE user_id = ?', (user_id,)).fetchall()
    non_daily_rows = conn.execute('SELECT * FROM non_daily_tasks WHERE user_id = ?', (user_id,)).fetchall()
    conn.close()

    return jsonify({
        'tasks': [dict(row) for row in tasks_rows],
        'progress': [dict(row) for row in progress_rows],
        'non_daily_tasks': [dict(row) for row in non_daily_rows]
    })

@app.route('/add', methods=['POST'])
@login_required
def add_task():
    user_id = session['user_id']
    data = request.json
    title = data.get('title')
    description = data.get('description', '')
    start_date = data.get('start_date')
    end_date = data.get('end_date', '')
    time = data.get('time', '')
    priority = data.get('priority', 'Medium')
    notify = 0
    reminder_datetime = data.get('reminder_datetime', '')

    if not title or not start_date:
        return jsonify({'error': 'Title and Start Date are required'}), 400

    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute('''
        INSERT INTO tasks (user_id, title, description, start_date, end_date, time, priority, notify, reminder_datetime, reminder_sent)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
    ''', (user_id, title, description, start_date, end_date, time, priority, notify, reminder_datetime))
    conn.commit()
    task_id = cur.lastrowid
    conn.close()
    return jsonify({'success': True, 'id': task_id})

@app.route('/update/<int:id>', methods=['POST'])
@login_required
def update_task(id):
    user_id = session['user_id']
    data = request.json
    title = data.get('title')
    description = data.get('description', '')
    start_date = data.get('start_date')
    end_date = data.get('end_date', '')
    time = data.get('time', '')
    priority = data.get('priority', 'Medium')
    notify = 0
    reminder_datetime = data.get('reminder_datetime', '')

    conn = get_db_connection()
    conn.execute('''
        UPDATE tasks 
        SET title = ?, description = ?, start_date = ?, end_date = ?, time = ?, priority = ?, notify = ?, reminder_datetime = ?, reminder_sent = 0
        WHERE id = ? AND user_id = ?
    ''', (title, description, start_date, end_date, time, priority, notify, reminder_datetime, id, user_id))
    conn.commit()
    conn.close()
    return jsonify({'success': True})

@app.route('/delete/<int:id>', methods=['DELETE'])
@login_required
def delete_task(id):
    user_id = session['user_id']
    conn = get_db_connection()
    conn.execute('DELETE FROM tasks WHERE id = ? AND user_id = ?', (id, user_id))
    conn.commit()
    conn.close()
    return jsonify({'success': True})

@app.route('/progress', methods=['POST'])
@login_required
def update_progress():
    user_id = session['user_id']
    data = request.json
    task_id = data.get('task_id')
    date = data.get('date')
    status = data.get('status')
    
    if not task_id or not date or status is None:
        return jsonify({'error': 'Missing parameters'}), 400

    conn = get_db_connection()
    try:
        conn.execute('''
            INSERT INTO task_progress (task_id, user_id, date, status)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(task_id, date) DO UPDATE SET status=excluded.status
        ''', (task_id, user_id, date, status))
        conn.commit()
    except Exception as e:
        conn.close()
        return jsonify({'error': str(e)}), 500
        
    conn.close()
    return jsonify({'success': True})

# Non-daily tasks routes
@app.route('/api/non_daily', methods=['POST'])
@login_required
def add_non_daily():
    user_id = session['user_id']
    data = request.json
    title = data.get('title')
    duration = data.get('duration', '')
    
    if not title:
        return jsonify({'error': 'Title required'}), 400
        
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute('INSERT INTO non_daily_tasks (user_id, title, duration) VALUES (?, ?, ?)', (user_id, title, duration))
    conn.commit()
    task_id = cur.lastrowid
    conn.close()
    return jsonify({'success': True, 'id': task_id})

@app.route('/api/non_daily/<int:id>', methods=['POST'])
@login_required
def update_non_daily(id):
    user_id = session['user_id']
    data = request.json
    title = data.get('title')
    duration = data.get('duration', '')
    
    conn = get_db_connection()
    conn.execute('UPDATE non_daily_tasks SET title = ?, duration = ? WHERE id = ? AND user_id = ?', (title, duration, id, user_id))
    conn.commit()
    conn.close()
    return jsonify({'success': True})

@app.route('/api/non_daily/<int:id>', methods=['DELETE'])
@login_required
def delete_non_daily(id):
    user_id = session['user_id']
    conn = get_db_connection()
    conn.execute('DELETE FROM non_daily_tasks WHERE id = ? AND user_id = ?', (id, user_id))
    conn.commit()
    conn.close()
    return jsonify({'success': True})

if __name__ == '__main__':
    app.run(debug=True, port=5000)
