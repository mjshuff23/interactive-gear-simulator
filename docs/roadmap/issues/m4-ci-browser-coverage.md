# Goal

Keep the app verifiable as the simulator becomes more interactive.

## Deliverables

- GitHub Actions workflow for install, typecheck, lint, unit tests, and build.
- Playwright smoke coverage for the primary screen and playback.
- Additional browser tests for gear creation, selection, dragging, and inspector edits.
- Documented local verification commands.

## Acceptance Criteria

- CI runs on pull requests and `main`.
- `pnpm test:e2e` passes locally.
- Browser tests assert visible user behavior rather than implementation details.
