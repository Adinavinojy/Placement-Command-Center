Software Requirements Specification

PlacementAgent - Personal Offline Placement Preparation System

Version 1.0 | 16 July 2026

# 1\. Introduction

## 1.1 Purpose

This document specifies the functional and non-functional requirements for PlacementAgent, a locally-run, privacy-first assistant that helps a single user (a CSE student) organize placement preparation material, assess and calibrate technical skill level, and track deadlines. It is a lightweight, practical SRS intended for personal-project use, not a formal contractual specification.

## 1.2 Scope

PlacementAgent covers the whole system end-to-end:

- The existing core agent loop (agent.py) that talks to a local Ollama LLM and persists data via SQLite (db.py).
- A structured knowledge_vault/ directory that organizes personal, communication, aptitude, subject, and company-specific material.
- A diagnostic/skill-assessment engine (assess.py) that runs a baseline test, generates daily questions, and continuously calibrates a per-topic proficiency score.
- A local calendar and notification layer that visualizes deadlines in a Streamlit dashboard and fires native OS reminders via plyer.

Out of scope: cloud calendar sync (e.g. Google Calendar API), multi-user accounts, mobile apps, and any feature requiring an external network service.

## 1.3 Intended Audience

The primary reader is the developer/user themself - this document acts as a personal design contract and a reference when extending the system later.

## 1.4 Definitions & Acronyms

- SRS - Software Requirements Specification.
- SDD - System Design Document.
- JD - Job Description.
- GD - Group Discussion.
- Vault - the knowledge_vault/ directory tree.
- Proficiency score - an integer 1-5 rating of skill in a topic, stored per topic in skill_levels.
- Ollama - the local runtime that serves an LLM for chat/question generation.

## 1.5 Assumptions & Dependencies

- Primary target OS is Windows (required for plyer's native toast notifications); other OSes are best-effort.
- Python 3.x is installed, along with sqlite3 (stdlib), streamlit, plyer, and an ollama client library.
- An Ollama server is running locally with at least one model already pulled.
- The system is single-user and single-machine; no authentication layer is required.
- agent.py and db.py already exist as a working baseline (chat loop + SQLite storage) and are being extended, not rebuilt.

# 2\. Overall Description

## 2.1 Product Perspective

PlacementAgent is a standalone local application composed of a CLI-driven agent, a background notifier, and an optional Streamlit web UI, all reading/writing a single SQLite database and a folder of markdown/reference files on disk. It has no server-side or multi-tenant component.

## 2.2 User Characteristics

A single technical user, comfortable with the command line, Python scripts, and basic file management. No onboarding flow for non-technical users is required.

## 2.3 Design & Implementation Constraints

- Must remain fully offline / privacy-respecting - no data or credentials leave the local machine.
- No paid or cloud APIs; the only "AI" dependency is the locally-hosted Ollama model.
- Storage is confined to the local SQLite file and the knowledge_vault/ folder tree.

## 2.4 Assumptions About the Existing Codebase

Because the current contents of db.py and agent.py were not fully provided, this SRS treats their existing responsibilities (a working chat loop, a database connection helper, and some notion of company/deadline data implied by "next_deadline") as a given baseline, and layers the three new feature sets on top. Section 6 lists the specific assumptions made and flags them for verification.

# 3\. Functional Requirements

## 3.1 Knowledge Vault Management

| **ID** | **Requirement**                                                                                                                                                                        | **Priority** |
| ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| FR-1   | The system shall store all reference material under a fixed five-branch hierarchy: knowledge_vault/Personal/, /Communication/, /Aptitude/, /Subjects/, and /Companies/{Company_Name}/. | High         |
| FR-2   | The system shall auto-create the five top-level folders on first launch if they do not already exist.                                                                                  | High         |
| FR-3   | The agent shall read Personal/profile.md at startup and use its contents (bio, links, self-assessed strengths) as seed context.                                                        | Medium       |
| FR-4   | Each entry under Companies/ shall be able to hold a JD file, process notes, and a roadmap file specific to that company.                                                               | Medium       |

## 3.2 Diagnostic / Skill Assessment Engine

| **ID** | **Requirement**                                                                                                                              | **Priority** |
| ------ | -------------------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| FR-5   | On first run, the system shall present a 10-question adaptive baseline test covering core topics.                                            | High         |
| FR-6   | assess.py shall maintain (or generate via the LLM) a bank of technical questions spanning the Subjects/ topics.                              | High         |
| FR-7   | After every test or interaction, the system shall update the skill_levels table with a proficiency score (1-5) per topic.                    | High         |
| FR-8   | The system shall lower a topic's proficiency score after incorrect answers and raise it after sustained correct answers (calibration logic). | High         |
| FR-9   | When a proficiency score changes, the system shall regenerate or adjust the roadmap file for any company currently being prepared for.       | Medium       |
| FR-10  | The system shall support a "Daily Diagnostic": one AI-generated question, per selected topic, per day.                                       | Medium       |
| FR-11  | get_daily_diagnostic() shall build a prompt from the user's current proficiency in that topic and send it to the local Ollama model.         | Medium       |

## 3.3 Calendar & Scheduler

| **ID** | **Requirement**                                                                                                          | **Priority** |
| ------ | ------------------------------------------------------------------------------------------------------------------------ | ------------ |
| FR-12  | The system shall persist upcoming deadlines/events (e.g. next_deadline) in SQLite.                                       | High         |
| FR-13  | The system shall provide a Streamlit dashboard that visually renders deadlines from SQLite as a calendar or agenda view. | Medium       |
| FR-14  | The system shall trigger native OS notifications via plyer ahead of a scheduled event (e.g. a 09:00 AM reporting time).  | High         |
| FR-15  | The notification lead time shall be configurable, with a sensible default (e.g. 30 minutes before the event).            | Low          |
| FR-16  | All scheduling data shall remain local; the system shall not call any external calendar API.                             | High         |

## 3.4 Core Agent & Data Layer

| **ID** | **Requirement**                                                                                                                                                               | **Priority** |
| ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| FR-17  | agent.py shall route free-form user queries to the local Ollama model and return the response in the CLI.                                                                     | High         |
| FR-18  | db.py's init routine shall create or upgrade the schema idempotently, including the new skill_levels table, without destroying existing data.                                 | High         |
| FR-19  | The system shall associate company-specific data (JD, process notes, roadmap) with the corresponding Companies/{Company_Name}/ folder and, where relevant, a database record. | Medium       |

# 4\. Non-Functional Requirements

| **ID** | **Requirement**                                                                                                                                         | **Priority** |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| NFR-1  | Privacy/Offline - no data leaves the local machine; no third-party API keys are required beyond the local Ollama runtime.                               | High         |
| NFR-2  | Performance - the dashboard shall render typical data volumes (< 500 rows) in under 2 seconds.                                                          | Medium       |
| NFR-3  | Portability - notifications rely on plyer/Windows; on non-Windows platforms the system shall degrade gracefully (skip notifications rather than crash). | Medium       |
| NFR-4  | Reliability - database writes shall be transactional; schema migrations shall never silently drop historical proficiency or deadline data.              | High         |
| NFR-5  | Usability - setup for the single intended user shall require no more than installing dependencies and running one init command.                         | Medium       |
| NFR-6  | Maintainability - db.py, agent.py, assess.py, dashboard.py, and the notifier shall stay loosely coupled with single, clear responsibilities.            | Medium       |

# 5\. External Interface Requirements

## 5.1 User Interfaces

- CLI chat loop (agent.py).
- Streamlit web dashboard, served locally, for the calendar/proficiency view.
- Native OS toast notifications (Windows, via plyer).

## 5.2 Software Interfaces

- Local Ollama HTTP/CLI API for chat and question generation.
- SQLite database file for all structured data.
- Local filesystem (knowledge_vault/) for unstructured reference material.

## 5.3 Hardware Interfaces

- None beyond the user's own machine; no external hardware is required.

# 6\. Open Questions & Assumptions to Verify

The following were not specified in the original request and were assumed for the purposes of this document. Please confirm or correct them against the actual codebase:

- The exact existing schema of db.py beyond skill_levels (e.g. a companies table and a table holding next_deadline) is assumed rather than confirmed.
- The adaptive-test difficulty algorithm is assumed to be a simple "correct → +1 proficiency tier, incorrect → −1 proficiency tier" rule; a more sophisticated IRT-style adaptive engine was not assumed unless you want one.
- The logic for choosing which topic gets the "Daily Diagnostic" question is assumed to prioritize the lowest current proficiency score first.
- Notification scheduling (i.e., what actually wakes the notifier up at the right time) is discussed as a design gap in the SDD, since plyer itself only fires a notification - it does not schedule one.