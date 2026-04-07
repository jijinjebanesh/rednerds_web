# REDNERDS Complete Application Workflow

Generated: 2026-04-07

This document describes the complete functional workflow of the REDNERDS system across frontend, backend, roles, entities, and API modules.

## 1. System Overview

REDNERDS is a role-based manufacturing quality platform with two project classes:

- `device` projects: unit-level tracking using unique products (`product_id`, `mac_address`)
- `accessory` projects: quantity-level tracking using target and stage count logs

The system supports:

- project and batch planning
- product lifecycle tracking
- production testing, debugging, and quality grading
- customer repair lifecycle
- accessory quantity workflows (target -> testing -> debugging -> QC grading)
- dashboard and analytics
- admin user management

## 2. Architecture

## 2.1 Frontend

- Stack: React + TypeScript + Vite + MUI + Redux Toolkit
- Routing: React Router
- API client: Axios with JWT token from localStorage
- Role-based UI visibility: `src/utils/rbac.ts`

Main frontend route map:

- `/login`
- `/` dashboard
- `/manufacturing/projects`
- `/manufacturing/projects/:projectId`
- `/manufacturing/batches`
- `/manufacturing/batches/:batchId`
- `/manufacturing/products`
- `/manufacturing/products/:productId`
- `/quality/testing`
- `/quality/debugging`
- `/quality/repairs`
- `/quality/repairs/:repairId`
- `/quality/grading` (QC Engineer only)
- `/accessories/workflows` (accessory quantity flow)
- `/admin/users` (admin only)

## 2.2 Backend

- Stack: Node.js + Express + MongoDB (Mongoose)
- API prefix: `/api/v1`
- Swagger docs: `/docs`

Main backend modules:

- `auth`
- `user`
- `projects`
- `batches`
- `products`
- `test_logs`
- `debug_sessions`
- `customer_repairs`
- `repair_sessions`
- `analytics`
- `accessory_workflows`

## 3. Core Entities and Data Model

## 3.1 Projects

Fields:

- `project_id` (auto-generated `PR-XXXXXX`)
- `name`, `slug`, `description`, `status`
- `project_type`: `device | accessory`

Purpose:

- `device`: supports batches and per-unit products
- `accessory`: supports quantity-based accessory workflows

## 3.2 Batches (device projects only)

Fields:

- `batch_id` (auto-generated `BT-XXXXXX`)
- `batch_name`, `project_id`, `model_variant`
- `planned_qty`, `produced_qty`, `start_date`, `status`, `notes`

Rule:

- batch creation is blocked for accessory projects

## 3.3 Products (device unit)

Fields:

- identity: `product_id` (auto-generated `<PROJECT_SLUG>_NNNN`), `mac_address`
- routing: `batch_id`, `project_id`, `project_slug`, `model_variant`
- lifecycle: `current_stage`, `status`
- customer: `customer_id`, `warranty_expiry`
- QC: `quality_grade`, `quality_graded_by*`, `quality_graded_at`, `quality_grade_history[]`

## 3.4 Quality Grading (device)

Allowed grades:

- `A`, `B`, `C`, `D`, `SCRAP`

Rule:

- if grade is `SCRAP`, product `status` becomes `scrapped`

Audit captured:

- grader user id/name/email
- graded timestamp
- full grade history list

## 3.5 Accessory Workflow (quantity model)

Entities:

- `AccessoryWorkflow`: project + accessory name + `target_qty`
- `AccessoryTestingLog`: `passed_qty`, `failed_qty`
- `AccessoryDebugLog`: `fixed_qty`, `scrapped_qty`
- `AccessoryQcLog`: `grade_a_qty`, `grade_b_qty`, `grade_c_qty`, `grade_d_qty`, `scrap_qty`

Computed metrics per workflow:

- `tested_total_qty = tested_pass_qty + tested_fail_qty`
- `remaining_for_testing_qty = max(0, target_qty - tested_total_qty)`
- `failed_backlog_qty = max(0, tested_fail_qty - debug_total_qty)`
- `qc_backlog_qty = max(0, tested_pass_qty + debug_fixed_qty - qc_total_graded_qty)`

## 4. Role Model

Normalized roles in system:

- `admin`
- `production_manager`
- `flash_operator`
- `test_operator`
- `debug_technician`
- `repair_technician`
- `manager`
- `operator`
- `technician`
- `quality_engineer`
- `user`

## 4.1 Accessory workflow action roles

- create accessory target: `admin`, `production_manager`, `manager`
- submit accessory testing log: `admin`, `test_operator`
- submit accessory debug log: `admin`, `debug_technician`, `technician`
- submit accessory QC log: `admin`, `quality_engineer`

## 4.2 QC grading action role (device)

- only `quality_engineer` can call `PUT /products/:id/quality`

## 5. End-to-End Operational Workflows

## 5.1 Authentication and Session

1. User signs in from `/login`.
2. Backend returns JWT.
3. Frontend stores token in localStorage.
4. Protected routes check authentication and optionally allowed roles.

## 5.2 Project Setup Workflow

1. Create project with `name`, `slug`, `status`, `project_type`.
2. Choose project type:
   - `device`: proceed with batches/products
   - `accessory`: proceed with accessory workflow target creation

## 5.3 Device Manufacturing Workflow

1. Create device project.
2. Create batch under device project (`planned_qty`, `model_variant`).
3. Register products with MAC and batch linkage.
4. Product enters testing flow.

## 5.4 Device Testing Workflow

1. Testing team opens `Production Testing` page.
2. Select product in queue.
3. Submit test log (`pass/fail/partial`).
4. Backend updates product state:
   - pass -> stage `qc`, status `active`
   - fail/partial -> stage `testing`, status `repair`

## 5.5 Device Debugging Workflow

1. Debug team opens `Debugging Queue`.
2. Select failed/retest candidate and submit debug session.
3. Backend derives re-test behavior and updates product:
   - re-test required -> stage `testing`, status `active`
   - resolved without re-test -> stage `qc`, status `active`
   - scrapped -> stage `repair`, status `returned` (debug-session path)

## 5.6 Device QC Grading Workflow

1. QC Engineer opens `/quality/grading`.
2. Only products in `qc` stage are shown.
3. QC sets grade: `A/B/C/D/SCRAP`.
4. Backend records audit trail and updates quality fields.
5. If `SCRAP`, product status becomes `scrapped`.

## 5.7 Device Product Traceability Workflow

`Product Details` page provides:

- product identity and current lifecycle state
- test logs
- debug sessions
- repair cases/sessions
- event timeline
- quality grading details and quality history

## 5.8 Customer Repair Workflow

1. Create customer repair case by product.
2. Move case through statuses (`received`, `in_progress`, etc.).
3. Log repair sessions with issue/root-cause/action/parts.
4. Close as `returned_to_customer` or `unrepairable`.

## 5.9 Accessory Quantity Workflow

1. Create accessory project (`project_type=accessory`).
2. Create accessory target in `/accessories/workflows` with `target_qty` and `accessory_name`.
3. Testing team logs pass/fail quantities.
4. Debug team logs fixed/scrapped quantities from failed backlog.
5. QC team logs grade distribution (`A/B/C/D/Scrap`) from QC backlog.
6. System recomputes all metrics and backlogs after each entry.

Validation rules enforced server-side:

- Testing entry total must not exceed `remaining_for_testing_qty`.
- Debug entry total must not exceed `failed_backlog_qty`.
- QC grading total must not exceed `qc_backlog_qty`.
- All quantities must be non-negative integers.

## 6. Feature-by-Feature Frontend Workflow

## 6.1 Dashboard

- system KPIs and operational snapshots
- testing/debug/repair trends and counts

## 6.2 Projects

- create/edit/delete projects
- filter by status and type
- project detail drill-down

## 6.3 Project Details

- for `device`: batches/products/produced metrics
- for `accessory`: accessory target/tested/qc metrics + shortcut to accessory workflow

## 6.4 Batches

- device-project batches only
- create/update/cancel batches
- planned vs produced progress

## 6.5 Batch Details

- batch metadata
- product list under batch

## 6.6 Products

- register new device units
- search/filter
- stage/status update
- open product details

## 6.7 Product Details

- full lifecycle view (test, debug, repair, events)
- QC grade and grading history visibility

## 6.8 Production Testing

- fresh queue and re-test queue
- record test log and auto product status/stage updates

## 6.9 Debugging Queue

- pending debug candidates
- add debug resolution and re-test decision
- product transition updates

## 6.10 QC Quality Grading

- QC-only page
- only `qc` stage products
- set grade and persist audit

## 6.11 Accessory Workflows

- create accessory targets
- log testing/debug/QC quantities by role
- see computed backlogs in one place

## 6.12 Customer Repairs

- intake and tracking of customer complaints
- status transitions and session history

## 6.13 User Management

- admin-only user listing/edit/delete
- role assignment and station mapping

## 7. API Workflow Map (Module-Level)

## 7.1 Auth

- `POST /auth/signup`
- `POST /auth/login`
- `POST /auth/send-verification-link`
- `GET /auth/verify/:verificationToken`

## 7.2 User

- `GET /user`
- `GET /user/:userId`
- `PUT /user/:userId`
- `DELETE /user/:userId`

## 7.3 Projects

- `POST /projects`
- `GET /projects`
- `GET /projects/:id`
- `GET /projects/slug/:slug`
- `PUT /projects/:id`
- `DELETE /projects/:id`

## 7.4 Batches

- `POST /batches`
- `GET /batches`
- `GET /batches/:id`
- `GET /batches/project/:project_id`
- `PUT /batches/:id`
- `PUT /batches/:id/production`
- `DELETE /batches/:id`

## 7.5 Products

- `POST /products`
- `GET /products`
- `GET /products/testing/queue`
- `GET /products/:id`
- `GET /products/mac/:mac_address`
- `GET /products/batch/:batch_id`
- `GET /products/project/:project_id`
- `PUT /products/:id/stage`
- `PUT /products/:id/quality` (JWT + QC role)
- `PUT /products/:id/customer`
- `PUT /products/:id`
- `GET /products/stats/project/:project_id`
- `GET /products/stats/batch/:batch_id`

## 7.6 Test Logs

- `POST /test-logs`
- `GET /test-logs`
- `GET /test-logs/:id`
- `PUT /test-logs/:id`
- `DELETE /test-logs/:id`
- `GET /test-logs/product/:product_id`
- `GET /test-logs/station/:station`
- `GET /test-logs/result/:result`

## 7.7 Debug Sessions

- `POST /debug-sessions`
- `GET /debug-sessions`
- `GET /debug-sessions/:id`
- `PUT /debug-sessions/:id`
- `DELETE /debug-sessions/:id`
- `GET /debug-sessions/test-log/:test_log_id`
- `GET /debug-sessions/product/:product_id`

## 7.8 Customer Repairs

- `POST /customer-repairs`
- `GET /customer-repairs`
- `GET /customer-repairs/:id`
- `PUT /customer-repairs/:id`
- `DELETE /customer-repairs/:id`
- `PUT /customer-repairs/:id/status`
- `GET /customer-repairs/product/:product_id`
- `GET /customer-repairs/customer/:customer_id`

## 7.9 Repair Sessions

- `POST /repair-sessions`
- `GET /repair-sessions`
- `GET /repair-sessions/:id`
- `PUT /repair-sessions/:id`
- `DELETE /repair-sessions/:id`
- `GET /repair-sessions/repair/:repair_id`
- `GET /repair-sessions/product/:product_id`

## 7.10 Analytics

- `GET /analytics/project/:projectId/common-problems`
- `GET /analytics/project/:projectId/root-causes`
- `GET /analytics/project/:projectId/testing-insights`
- `GET /analytics/project/:projectId/dashboard`

## 7.11 Accessory Workflows (JWT required)

- `POST /accessory-workflows`
- `GET /accessory-workflows`
- `GET /accessory-workflows/:id`
- `GET /accessory-workflows/:id/summary`
- `POST /accessory-workflows/:id/testing-logs`
- `POST /accessory-workflows/:id/debug-logs`
- `POST /accessory-workflows/:id/qc-logs`
- `GET /accessory-workflows/:id/testing-logs`
- `GET /accessory-workflows/:id/debug-logs`
- `GET /accessory-workflows/:id/qc-logs`

## 8. Security and Authorization Notes

- Frontend route/feature access is controlled by `rbac.ts`.
- Backend hard role checks are implemented for:
  - product quality update endpoint
  - accessory workflow endpoints
- Accessory workflow endpoints are JWT-protected at route level.

## 9. Current Business Rules in Force

1. Project must have a type (`device` or `accessory`).
2. Batches can be created only for `device` projects.
3. Products can be created only for `device` projects.
4. QC grading page only lists products in `qc` stage.
5. Accessory quantities are log-based and backlog-constrained.
6. QC grading (device) is fully audited per action.

## 10. Recommended Daily Operating Sequence

## 10.1 Device Projects

1. `production_manager` creates project/batches.
2. `flash_operator`/production team registers products.
3. `test_operator` runs tests.
4. `debug_technician` handles failures and re-test loop.
5. `quality_engineer` grades QC outputs.
6. repair teams manage post-sales repairs.

## 10.2 Accessory Projects

1. `production_manager` or `manager` creates accessory target.
2. `test_operator` logs pass/fail quantities.
3. `debug_technician`/`technician` logs fixed/scrapped quantities.
4. `quality_engineer` logs grade distribution.
5. monitor backlogs until target is fully resolved.

## 11. Role-Wise Task Execution Guide

This section explains how each user role should perform day-to-day tasks in the system.

## 11.1 Admin

Primary responsibility:

- full system governance (users, projects, monitoring, corrections)

Typical steps:

1. Login and review dashboard for overall status.
2. Open `User Management` (`/admin/users`) and create/update users, roles, and stations.
3. Create or update projects (device/accessory) in `Projects`.
4. Support operations by creating accessory targets when needed.
5. Monitor quality and repair health from dashboards and detailed pages.

## 11.2 Production Manager

Primary responsibility:

- launch and manage production plans

Typical steps:

1. Create project in `Projects` and choose correct `project_type`.
2. For `device` projects:
3. Create batches in `Batches` with planned quantity and start date.
4. Track produced quantity and status through batch updates.
5. For `accessory` projects:
6. Open `Accessory Workflows` and create target quantities per accessory.
7. Review backlog metrics and coordinate with test/debug/QC teams.

## 11.3 Manager

Primary responsibility:

- supervise both project classes and operational throughput

Typical steps:

1. Review `Projects`, `Batches`, and `Accessory Workflows`.
2. Create accessory targets when production manager delegates.
3. Track delays using backlog values (`remaining_for_testing`, `failed_backlog`, `qc_backlog`).
4. Trigger corrective action with relevant team leads.

## 11.4 Flash Operator

Primary responsibility:

- register device units into production

Typical steps:

1. Open `Products`.
2. Register each unit with MAC address, project, batch, and variant.
3. Ensure product appears in device flow for testing queue.

Note:

- Flash operator workflow applies to `device` projects only.

## 11.5 Test Operator

Primary responsibility:

- execute testing and record outcomes

Typical steps for device projects:

1. Open `Production Testing`.
2. Select queued product.
3. Submit pass/fail/partial test log.
4. Confirm product transition is reflected (QC path or repair path).

Typical steps for accessory projects:

1. Open `Accessory Workflows`.
2. Find the workflow row.
3. Click `Add Test`.
4. Enter `passed_qty` and `failed_qty`.
5. Save and verify updated `remaining_for_testing` and `failed_backlog`.

## 11.6 Debug Technician

Primary responsibility:

- resolve failed units/quantities and control retest or scrap decisions

Typical steps for device projects:

1. Open `Debugging Queue`.
2. Pick pending item and log issue/root cause/action.
3. Mark resolution and retest requirement.
4. Verify product stage update.

Typical steps for accessory projects:

1. Open `Accessory Workflows`.
2. Click `Add Debug`.
3. Enter `fixed_qty` and `scrapped_qty` against failed backlog.
4. Save and verify failed backlog decreases.

## 11.7 Technician

Primary responsibility:

- support debugging and repair operations

Typical steps:

1. Work on `Debugging` and `Repairs` pages for device flow as assigned.
2. In accessory flow, open `Accessory Workflows` and submit debug quantity logs.
3. Keep notes clear for traceability.

## 11.8 Repair Technician

Primary responsibility:

- process customer repair lifecycle

Typical steps:

1. Open `Customer Repairs`.
2. Handle intake and case status progression.
3. Add repair sessions with issue/cause/action/parts.
4. Close case as returned/unrepairable with complete records.

## 11.9 Quality Engineer

Primary responsibility:

- final quality grading and quality control closure

Typical steps for device projects:

1. Open `QC Quality Grading` (`/quality/grading`).
2. Review only products in `qc` stage.
3. Select grade `A/B/C/D/SCRAP`.
4. Save and verify quality history is visible in Product Details.

Typical steps for accessory projects:

1. Open `Accessory Workflows`.
2. Click `Add QC`.
3. Enter grade distribution (`A/B/C/D/Scrap` quantities).
4. Save and verify QC backlog reduction.

## 11.10 Operator

Primary responsibility:

- basic testing tasks in permitted areas

Typical steps:

1. Use `Production Testing` for assigned products.
2. Record accurate results and notes.
3. Escalate failures to debugging team.

## 11.11 User (Read-Only Role)

Primary responsibility:

- basic visibility only

Typical steps:

1. Login.
2. View dashboard-level insights allowed by role.
3. No operational create/update actions.

## 12. File Pointers for Key Logic

Frontend:

- Routing: `src/App.tsx`
- Role map: `src/utils/rbac.ts`
- Project UI: `src/pages/ProjectsPage.tsx`, `src/pages/ProjectDetailsPage.tsx`
- Batch UI: `src/pages/BatchesPage.tsx`
- Product + QC UI: `src/pages/ProductsPage.tsx`, `src/pages/QualityGradingPage.tsx`, `src/pages/ProductDetailsPage.tsx`
- Accessory UI: `src/pages/AccessoryWorkflowPage.tsx`

Backend:

- Route mounting: `server.js`
- Projects: `src/projects/*`
- Batches: `src/batches/*`
- Products + quality: `src/products/*`
- Test/debug: `src/test_logs/*`, `src/debug_sessions/*`
- Repairs: `src/customer_repairs/*`, `src/repair_sessions/*`
- Accessory workflow: `src/accessory_workflows/*`

---
