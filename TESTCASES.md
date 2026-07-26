# PlacementAgent (Adina AI) — Test Cases

All test cases are run by typing the **Input** into the AI Chat tab unless otherwise noted.
Expected outputs are checked in the **Chat response** and/or **Backend terminal**.

---

## Category 1 — `/skill` Command (Deterministic, 0ms)

| ID | Input | Expected Response | Expected Backend |
|---|---|---|---|
| SK-01 | `/skill Dynamic Programming 25` | `Proficiency for 'Dynamic Programming' is now 25%.` | No LLM call — pure regex |
| SK-02 | `/skill System Design 80` | `Proficiency for 'System Design' is now 80%.` | Instant |
| SK-03 | `/skill Graphs 0` | `Proficiency for 'Graphs' is now 0%.` | Saves 0, not skipped |
| SK-04 | `/skill Graphs 100` | `Proficiency for 'Graphs' is now 100%.` | Clamp-check |
| SK-05 | `/skill graphs 55` | Updates `Graphs` (case-insensitive match) | No duplicate created |
| SK-06 | `/skill Dynamic programming 25` | Updates `Dynamic Programming` (fuzzy match) | No duplicate |
| SK-07 | `/skill NewTopicXYZ 40` | `Proficiency for 'NewTopicXYZ' is now 40%.` | Added as NEW topic |
| SK-08 | `/skill` *(no args)* | Graceful error or fallback message | No crash |

**Verify in Skill Board tab:** Skill values update without page refresh.

---

## Category 2 — `/company` Command + Auto-Trigger

| ID | Input | Expected Response | Side Effect |
|---|---|---|---|
| CO-01 | `/company Google, SDE role, tests on DSA and System Design, Online Assessment on July 25 2026, Technical Interview on August 1 2026` | `✅ Company 'Google' added! Deadlines saved. Regenerating...` | Background plan generation starts |
| CO-02 | `/company Amazon, SDE-1, OA on August 5 2026, HR on August 12 2026` | `✅ Company 'Amazon' added!...` | Second plan version saved |
| CO-03 | `/company TCS, Ninja role, CodeVita on July 30 2026` | `✅ Company 'TCS' added!...` | Third plan version |
| CO-04 | Add same company again: `/company Google, SDE, OA on July 25 2026` | Updated (not duplicated) | Replaces existing entry |
| CO-05 | `/company` *(no args)* | Graceful fallback | No crash |

**After CO-01:** Check backend terminal for:
```
[Plan] Generating plan | trigger='Added company: Google'...
[Gemini] Plan generated successfully (XXXX chars)
[Plan] Saved version: plan_YYYY-MM-DD_HH-MM-SS.json
```
**After plan finishes:** Toast `✅ Your study plan has been successfully updated!` should appear.

---

## Category 3 — `/timetable` Command + Auto-Trigger

| ID | Input | Expected Response | Available Hours |
|---|---|---|---|
| TT-01 | `/timetable college 6, sleep 7, courses 2, other 2` | `✅ Timetable saved! Regenerating...` | `24-6-7-2-2 = 7 hrs` |
| TT-02 | `/timetable college 4, sleep 8, courses 3, other 1` | `✅ Timetable saved! Regenerating...` | `24-4-8-3-1 = 8 hrs` |
| TT-03 | `/timetable I sleep 7 hours and spend 6 in college` | `✅ Timetable saved!...` | Partial parse, fallback to LLM |
| TT-04 | `/timetable` *(no args)* | Graceful fallback | No crash |

**Verify in Study Plan tab:** Plan `time` field changes between TT-01 and TT-02 plans (7 hrs vs 8 hrs).

---

## Category 4 — `/delete` Command

| ID | Input | Expected Response |
|---|---|---|
| DE-01 | `/delete Google` | `All upcoming deadlines and rounds for 'Google' have been deleted.` |
| DE-02 | `/delete Amazon Technical Interview` | `The 'Technical Interview' deadline for 'Amazon' has been deleted.` |
| DE-03 | `/delete NonExistentCo` | Graceful — no crash, "deleted" message (DB finds nothing, 0 rows affected) |
| DE-04 | `/delete` *(no args)* | Graceful fallback |

---

## Category 5 — `/status` Command

| ID | Input | Expected Response |
|---|---|---|
| ST-01 | `/status` | Instant Markdown report: avg proficiency %, list of upcoming deadlines | 
| ST-02 | `/status` *(with no companies added)* | Shows skills avg, says "No upcoming deadlines" |

> No LLM call — pure DB query, should respond in < 1 second.

---

## Category 6 — Free-Text Chat

| ID | Input | Expected Response | Time |
|---|---|---|---|
| CH-01 | `What should I focus on this week?` | 2-4 sentence actionable answer | < 10s |
| CH-02 | `How do I prepare for a Google SDE interview?` | Concise tips | < 10s |
| CH-03 | `What is dynamic programming?` | Brief explanation | < 10s |
| CH-04 | `How many days until my Google OA?` | Uses tracker data to answer | < 10s |

---

## Category 7 — Focus Intent Auto-Trigger

| ID | Input | Expected Response | Side Effect |
|---|---|---|---|
| FI-01 | `I want to focus on Graphs and Dynamic Programming` | `✅ Got it! I'll focus your study plan on Graphs and Dynamic Programming. Updating...` | Plan regenerates with those topics prioritized |
| FI-02 | `I need to practice more on System Design and OS` | Same trigger response | Plan regenerates |
| FI-03 | `I want to study Arrays this week` | Same trigger response | Plan regenerates |
| FI-04 | `I want to concentrate on DBMS` | Same trigger response | Plan regenerates |
| FI-05 | `I want to brush up on Networks` | Same trigger response | Plan regenerates |

> **Note:** FI-01 through FI-05 are subject to the 60-second debounce. Space them out or wait for the toast before sending the next one.

---

## Category 8 — `/study update` Command

| ID | Input | Expected Response | Side Effect |
|---|---|---|---|
| SU-01 | `/study I want to add 1 hour of aptitude practice every day` | `✅ Updating your study plan...` | Calls `trigger_plan_regeneration` — new version saved |
| SU-02 | `/study Push all System Design topics to next week` | `✅ Updating your study plan...` | New version saved |
| SU-03 | `/study regenerate` | `Your study plan auto-updates whenever you add a company...` | No plan generation triggered |
| SU-04 | `/study reset` | Same info message as SU-03 | No generation |

---

## Category 9 — Study Plan Versioning

| ID | Steps | Expected |
|---|---|---|
| VH-01 | Add Google → Add Amazon → Change timetable | Study Plan tab version dropdown shows 3 entries |
| VH-02 | Click oldest version in dropdown | Plan display changes to older version's content |
| VH-03 | Select "Latest" in dropdown | Current plan restored |
| VH-04 | Add 16+ companies quickly (wait between each) | Dropdown shows max 15 entries (oldest auto-pruned) |
| VH-05 | Check `knowledge_vault/Personal/study_plan_versions/` | Files named `plan_YYYY-MM-DD_HH-MM-SS.json` exist |
| VH-06 | Open a version file | Contains `version`, `trigger`, `available_hours`, `plan` keys |

---

## Category 10 — Auto-Refresh (No Page Reload)

| ID | Steps | Expected |
|---|---|---|
| AR-01 | Type `/skill Graphs 75` → click Skill Board tab | Graphs shows 75% — no refresh needed |
| AR-02 | Type `/company Infosys, OA on Aug 20 2026` → stay on Chat tab | After toast, switch to Study Plan tab — plan shows Infosys deadline |
| AR-03 | Open two browser tabs of the app, type command in one | Other tab doesn't auto-update (expected — no WebSocket) |

---

## Category 11 — Debounce (Rate Limit Protection)

| ID | Steps | Expected Backend |
|---|---|---|
| DB-01 | Add company → immediately add another company | Second trigger logs `[Plan] Debounce: last plan was Xs ago, skipping` |
| DB-02 | Wait 60s after first plan → add another company | Second trigger generates a new plan (debounce expired) |
| DB-03 | Use focus intent chat → use it again within 60s | Second: `[Plan] Debounce: ...skipping` |

---

## Category 12 — Gemini API Fallback

| ID | Steps | Expected |
|---|---|---|
| FB-01 | Delete/corrupt `GEMINI_API_KEY` in `.env` → restart → add company | `[Gemini] No API key — falling back to local model` in terminal. Plan still generates (via `qwen2.5:1.5b`, ~25s) |
| FB-02 | Set `GEMINI_API_KEY=invalid_key` → add company | `[Gemini] Plan API error 400` → fallback to local |
| FB-03 | Internet off → add company | `[Gemini] Plan request error: ...` → fallback to local |

---

## Category 13 — Assessment Engine

| ID | Steps | Expected |
|---|---|---|
| AS-01 | Click **Assessment** tab → click **Start Baseline Test** | 8 questions load: 2 coding (LeetCode URLs), OS, DBMS, Networks, System Design, Aptitude, Language |
| AS-02 | Complete a coding question → paste approach → click "Mark as Done" | AI evaluates approach → proficiency updated in Skill Board |
| AS-03 | Click a LeetCode URL in a question | Opens in new tab |
| AS-04 | Click "Mark as Done" without pasting approach | Handled gracefully |

---

## Category 14 — Edge Cases & Stress

| ID | Input / Steps | Expected |
|---|---|---|
| EC-01 | Very long company description in `/company` | Parsed correctly, no crash |
| EC-02 | `/skill Topic With Spaces 50` | `Topic With Spaces` saved as topic with proficiency 50 |
| EC-03 | `/skill Topic 150` | Saves 150 (no server-side clamping — UI may show it) |
| EC-04 | Two rapid `/skill` commands back-to-back | Both processed correctly |
| EC-05 | Restart backend mid-plan-generation | Plan save is atomic — no corrupt JSON |
| EC-06 | Empty study plan (no companies) → open Study Plan tab | Empty state shows `/company` and `/timetable` hints |
| EC-07 | No internet + no ollama running | Backend returns 500 with traceback — UI shows error gracefully |
| EC-08 | `/doc` without attaching file | Handled by frontend (disabled send if no file for /doc) |

---

## Category 15 — Career Review & Document Management

| ID | Input / Steps | Expected |
|---|---|---|
| CR-01 | Open **Documents** tab → Select `12th Grade` in dropdown → Upload PDF | PDF uploads successfully and appears in the UI list under the `12th Grade` category. |
| CR-02 | Hover over an uploaded document in the list → Click trash icon | Document is deleted from the UI and backend filesystem. |
| CR-03 | Open **Career Review** tab without any academic documents → Click Generate | Displays helpful message: "No academic documents found. Please upload..." |
| CR-04 | Upload CV/resumes to `CV_Resume` → Open **Career Review** tab → Click Generate | Shows loading state, then renders a detailed Markdown summary and improvement plan tailored for trending CS careers. |

---

## Quick Smoke Test Sequence (Run This First)

Copy-paste these in order, waiting for each response:

```
1. /skill Dynamic Programming 25
2. /skill System Design 60
3. /skill Graphs 40
4. /status
5. /timetable college 6, sleep 7, courses 2, other 2
   [wait for toast: "study plan updated"]
6. /company Google, SDE role, DSA and System Design, OA on July 25 2026, Technical Interview on August 1 2026
   [wait for toast]
7. What should I focus on this week?
8. I want to focus on Graphs and Dynamic Programming
   [wait for toast]
9. /study I want to add 1 hour of aptitude practice every day
   [wait for toast]
10. /delete Google
```

After all 10:
- **Skill Board**: DP=25%, System Design=60%, Graphs=40%
- **Study Plan tab**: 3 versions in dropdown (timetable, Google, focus update)
- **Deadlines widget**: Google gone (deleted in step 10)
- **No page refresh used throughout**
