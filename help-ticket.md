# Help Desk Ticket Shortcut Feature Plan

## Project Type
- **WEB** (React, TypeScript)

## Success Criteria
1. "Help" dropdown shortcut is added above "Log Out" in `Header.tsx` for all users.
2. Shortcut opens a modal that allows any user to create a support ticket.
3. Support ticket is saved in the database under `public.support_tickets`.
4. Ticket is automatically assigned to a user with the `developer` role.
5. Assigned developer receives a notification directing them to resolve the ticket.
6. The `developer` role is granted `access_support_desk` permission via a migration.

## File Structure
- `supabase/migrations/20260611_add_support_permission_to_developer.sql` (NEW)
- `components/support/HelpTicketModal.tsx` (NEW)
- `components/layouts/Header.tsx` (MODIFY)

## Task Breakdown

### Task 1: Database Permission Migration
- **Agent**: `database-architect`
- **Skills**: `database-design`
- **Priority**: High
- **Dependencies**: None
- **INPUT**: Database roles schema.
- **OUTPUT**: A SQL migration adding `access_support_desk` permission to the `developer` role.
- **VERIFY**: Check migration contents or execute SQL query on roles table.

### Task 2: Help Ticket Modal Component
- **Agent**: `frontend-specialist`
- **Skills**: `frontend-design`, `react-best-practices`
- **Priority**: High
- **Dependencies**: Task 1
- **INPUT**: `support_tickets` table structure, yup schemas.
- **OUTPUT**: `components/support/HelpTicketModal.tsx` component with form handling, file uploads, developer queries, ticket submission, and notification dispatch.
- **VERIFY**: Component compiles without TypeScript errors.

### Task 3: Profile Menu Integration
- **Agent**: `frontend-specialist`
- **Skills**: `frontend-design`
- **Priority**: High
- **Dependencies**: Task 2
- **INPUT**: `components/layouts/Header.tsx`.
- **OUTPUT**: Render the Help option in the menu dropdown and hook up the modal trigger.
- **VERIFY**: Dropdown shows "Help" above "Log Out" and opens the modal.

### Task 4: verification
- **Agent**: `test-engineer`
- **Skills**: `webapp-testing`
- **Priority**: Medium
- **Dependencies**: Task 3
- **INPUT**: Modified workspace.
- **OUTPUT**: Build check and validation tests.
- **VERIFY**: Run `npm run build` and checklist validation script.
