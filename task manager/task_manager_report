# Task Manager Application Report

## Executive Overview
The Task Manager is a full-stack, Flask-powered productivity dashboard designed for elegant, fast-paced task management. Built with a responsive "glassmorphism" design language, the app features dynamic Daily Task Tracking, asynchronous UI experiences via embedded JavaScript, and robust security patterns.

---

## Database Architecture
The backend strictly leverages a local SQLite3 database enforcing schema normalization across 4 primary tables.

1. users Table (Auth & Options)
Acts as the central entity layer ensuring multi-tenant capabilities.
* id (INTEGER PRIMARY KEY)
* username (TEXT): Non-unique and case-insensitive to allow flexible name mapping.
* password (TEXT): Werkzeug cryptographic hashes. Acts as the universally unique identity key for each account.
* morning_notify (BOOLEAN): Toggles the generation of OS-level reminder popups.

2. tasks Table (Routines)
Stores configurations for habitual workflow.
* id (INTEGER PRIMARY KEY)
* user_id (INTEGER): Foreign Key linking to the users table.
* title (TEXT) & description (TEXT)
* priority (TEXT): Categorical tags (High, Medium, Low).
* start_date (TEXT), end_date (TEXT), time (TEXT)

3. task_progress Table (Daily State)
A granular tracking table that records a row for each intersection of Date + Task.
* id (INTEGER PRIMARY KEY)
* task_id (INTEGER)
* user_id (INTEGER)
* date (TEXT): Stored as locally-derived YYYY-MM-DD timestamps avoiding UTC shift-bugs.
* status (INTEGER): Binary toggle (0 for unchecked, 1 for completed).

4. non_daily_tasks Table (To-Dos)
Standard single-purpose task bin.
* id (INTEGER PRIMARY KEY)
* user_id (INTEGER)
* title (TEXT)
* date (TEXT): A target fulfillment deadline.

---

## Core Modules & Capabilities

Fluid Client/Server Asynchrony
All modifications made by the user, ranging from ticking off a task to altering account themes, are routed quietly through fetch() API routes. This allows script.js to instantly rewrite the DOM arrays dynamically without requiring the user to reload the page.

Daily Tracking & Streak Algorithms
The Daily Tracker renders a rolling window of history (up to the last 7 days + today). The JavaScript engine loops backward through the allProgress JSON dictionary to calculate contiguous active progress arrays mathematically, driving the Active Streak multiplier. The completion fractions are aggregated and pumped straight into dynamic Chart.js arcs (the Speedometer).

Master Key Authentication
Because usernames are permitted to collide (e.g., several users named "Jane"), the server enforces strict validation checks evaluating the hashed password. A user is seamlessly instantiated a completely new workspace instance merely by attempting a novel password combination.

Account Management & Resets
The Settings menu provides robust lifecycle options, allowing users granular control over their workspace containing protective confirmation prompts:
* Change Username/Password: Custom modals allow users to instantly and asynchronously modify their display name and unique login password. Changes auto-update across the dashboard in real-time.
* Delete Tasks/Works: Specific buttons allow users to wipe their recurring Daily Tasks or one-off Works without impacting their historical tracking data.
* Reset Progress: A powerful tool to purge all checked history, reverting the Active Streak and Speedometers to 0%, while preserving the task templates.
* Reset Account: The "Nuclear Option" invokes a backend command to purge the user's footprint entirely from tasks, non_daily_tasks, and task_progress, yielding a completely fresh state.

Dynamic Filtering & Searching
* Live Search: Users can type into the omnipresent search bar to instantly query their task titles and descriptions. The JavaScript array filter() executes live keystroke matching without page reloads.
* Priority Selection: A dropdown filters the Daily Tracker down to specifically tagged priorities (High, Medium, Low), enabling focused execution during heavy workload days.

---

## Interface Layout Strategy

1. The Header
Responsive toolbar bundling the Theme switch, Priority isolated-dropdown, and deep-search filter arrays together.

2. Tracking Matrix
A massive horizontal sequence grid providing an overview over the trailing week's completion data. Older tasks are natively suspended/disabled from tampering.

3. Bottom Sections Layer
* Dashboard Stats: A flexible left-bound panel holding the live completion rates and streak integers.
* Works to Reminder: A scroll-managed bounding box capturing independent target tasks.
* Mobile Response: Transitions perfectly using viewport cascading, snapping the Statistics panel underneath the independent tasks for optimal scroll paths.
