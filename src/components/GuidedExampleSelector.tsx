import { GUIDED_EXAMPLES, type GuidedExampleId } from "../data/guided-examples";

interface GuidedExampleSelectorProps {
  activeExampleId: GuidedExampleId | null;
  onSelectExample: (exampleId: GuidedExampleId) => boolean;
}

export function GuidedExampleSelector({
  activeExampleId,
  onSelectExample,
}: GuidedExampleSelectorProps) {
  return (
    <div className="exampleSelector">
      <label htmlFor="guided-example-select">Guided example</label>
      <select
        id="guided-example-select"
        value={activeExampleId ?? ""}
        onChange={(event) => {
          const accepted = onSelectExample(
            event.target.value as GuidedExampleId,
          );

          if (!accepted) {
            event.target.value = activeExampleId ?? "";
          }
        }}
      >
        {activeExampleId === null && (
          <option value="" disabled>
            Custom System
          </option>
        )}
        {GUIDED_EXAMPLES.map((example) => (
          <option key={example.id} value={example.id}>
            {example.title}
          </option>
        ))}
      </select>
    </div>
  );
}
