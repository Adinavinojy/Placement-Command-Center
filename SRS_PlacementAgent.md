# Software Requirements Specification
# Placement Command Center (PCC) - formerly PlacementAgent
Version 1.1

## 1. Introduction
### 1.1 Purpose
This document specifies the functional and non-functional requirements for the Placement Command Center (PCC), a privacy-first, offline, and integrated dashboard for a CSE student to manage placement preparations, college schedules, and technical skill growth.

### 1.2 Scope
PCC covers the whole system end-to-end:
- An integrated dashboard (app.py) providing a unified UI for Tracker, Vault, Assessments, and Calendar.
- The core agent loop (agent.py) that talks to a local Ollama LLM and persists data via SQLite (db.py).
- A structured knowledge_vault/ directory that organizes personal, communication, aptitude, subject, and company-specific material.
- A diagnostic/skill-assessment engine (assess.py) that runs a comprehensive baseline assessment and daily micro-tests.
- A local calendar and notification layer using an internal APScheduler to trigger OS reminders via plyer.
- In-App Scheduling reading constraints from timetable.txt to allocate optimal daily preparation time.

## 2. Functional Requirements

### 2.1 Knowledge Vault Management & Onboarding
* **FR-1: Integrated Dashboard:** A single-entry point (`app.py`) providing a unified UI for Tracker, Vault, Assessments, and Calendar.
* **FR-2: Intelligent Onboarding:** A first-run "Wizard" that collects user documents (CVs, JDs, Timetables) and auto-sorts them into the fixed five-branch hierarchy: knowledge_vault/Personal/, /Communication/, /Aptitude/, /Subjects/, and /Companies/{Company_Name}/.

### 2.2 Diagnostic / Skill Assessment Engine
* **FR-3: Diagnostic Engine:** Performs a comprehensive baseline assessment (2 coding + 5 aptitude) on initialization and daily micro-tests to calibrate a `skill_profile.json` (or database equivalent).
* **FR-4: Coding Platform Integration:** AI-generated daily coding challenges must include direct, clickable URLs to platforms like LeetCode or NeetCode.
* **FR-5:** The system shall lower a topic's proficiency score after incorrect answers and raise it after sustained correct answers.

### 2.3 Calendar & Scheduler
* **FR-6: In-App Scheduling:** An integrated scheduler that reads constraints (College hours, Course load) from `timetable.txt` to allocate optimal daily preparation time.
* **FR-7: OS Notifications:** Uses an internal `APScheduler` to trigger `plyer` native Windows notifications for upcoming rounds, eliminating the need for Windows Task Scheduler.

## 3. Non-Functional Requirements

* **NFR-1: Privacy:** Zero network egress; all processing is local.
* **NFR-2: Ease of Use:** Non-technical interface; no terminal interaction required after initial launch.
* **NFR-3: Persistence:** All data stored on the `E:` drive; system state is fully recoverable.
* **NFR-4: Performance:** The dashboard shall render typical data volumes (< 500 rows) in under 2 seconds.
