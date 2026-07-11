# Interactive Gear Simulator

A TypeScript-first full-stack visualizer for learning base-60 thinking through
gears, cycles, ratios, radial geometry, and harmonic waveforms.

The project is intentionally grounded: it uses gears and sexagesimal math as an
educational model for cycles and modular systems. Speculative ideas can inspire
future visualizations, but the app should label real math/physics separately
from metaphor.

## Current Stack

- React 19 + TypeScript + Vite
- PixiJS 8 for the gear canvas
- Recharts for live waveform/ratio visualizations
- Supabase client boundary for future auth and saved systems
- Vitest for deterministic simulation tests
- Playwright for browser smoke coverage

## Scripts

```bash
pnpm install
pnpm dev
pnpm typecheck
pnpm lint
pnpm test
pnpm build
pnpm test:e2e
```

## Project Map

- `src/simulation/gear-system.ts` - deterministic gear graph types and solver
- `src/components/GearCanvas.tsx` - PixiJS rendering surface
- `src/components/InspectorPanel.tsx` - selected gear controls
- `src/components/VisualizationPanel.tsx` - ratio and waveform visualizations
- `src/lib/supabase.ts` - typed Supabase client factory
- `src/persistence/gear-systems.ts` - save/load adapter for future auth work
- `docs/architecture/system-map.md` - Mermaid architecture diagrams
- `docs/supabase/gear-systems.sql` - planned Supabase table/RLS SQL

## Project Boundaries

- All browser and backend-boundary code is TypeScript-only; no Python backend
  for v1. Persistence goes through the typed Supabase adapter.

## Supabase Environment

The app runs without Supabase credentials. Save/load wiring becomes active after
the future persistence issue connects UI flows to a real project.

```bash
VITE_SUPABASE_URL="https://your-project.supabase.co"
VITE_SUPABASE_PUBLISHABLE_KEY="your-publishable-key"
```

Never put a Supabase service role key in browser-exposed Vite env vars.
