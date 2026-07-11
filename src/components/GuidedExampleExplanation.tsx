import type { GuidedExampleDefinition } from "../data/guided-examples";

interface GuidedExampleExplanationProps {
  example: GuidedExampleDefinition;
}

export function GuidedExampleExplanation({
  example,
}: GuidedExampleExplanationProps) {
  return (
    <section
      className="exampleExplanation"
      aria-label="Guided example explanation"
    >
      <div>
        <h2>{example.title}</h2>
        <p>{example.shortDescription}</p>
      </div>
      <ul>
        {example.relationshipLabels.map((label) => (
          <li key={label}>{label}</li>
        ))}
      </ul>
    </section>
  );
}
