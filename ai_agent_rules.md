1. Read the README.md and CONTIRBUTING.md files in the top level, and the README.md for the relevant handlers that you are editing
2. After adding a new feature or making a significant change, update the README file with the expectations for future maintainers
3. When implementing UI changes that add modal dialogs, document the expected behavior in repository docs (prefer `ai_agent_rules.md` for agent/maintainer rules):
	- Modals must include a visible close icon that has an accessible name (e.g. `aria-label="Close"`).
	- Modals should close when clicking the backdrop (outside the dialog content) and when pressing Escape (Esc).
	- Modals should use `role="dialog"` and `aria-modal="true"` and restore focus to the element that opened them when closed.
	- Modal components should accept an `onClose: () => void` prop and call it for any close action.