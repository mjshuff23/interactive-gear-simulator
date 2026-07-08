## Goal

Make the selected gear editable through production-style controls.

## Deliverables

- Selected gear picker.
- Teeth, radius, RPM, phase, direction, locked axle, and color controls.
- Driver RPM editing protected so follower RPM is solver-controlled.
- Resolved RPM and direction readouts.

## Acceptance Criteria

- Editing controls updates React state immediately.
- Canvas render and visualization panels respond to the updated gear state.
- Driver/follower state is clear and prevents invalid accidental edits.
