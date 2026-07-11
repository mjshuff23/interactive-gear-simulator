import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  formatSexagesimalAngle,
  type GearNode,
  type GearSystem,
  type SolvedGearSystem,
} from "../simulation/gear-system";

interface VisualizationPanelProps {
  gear: GearNode | undefined;
  gearSystem: GearSystem;
  solvedSystem: SolvedGearSystem;
}

export function VisualizationPanel({
  gear,
  gearSystem,
  solvedSystem,
}: VisualizationPanelProps) {
  const driverId = gearSystem.drivers[0];
  const driverFrame = driverId
    ? solvedSystem.framesByGear[driverId]
    : undefined;
  const selectedFrame = gear ? solvedSystem.framesByGear[gear.id] : undefined;
  const ratio =
    driverFrame && selectedFrame && driverFrame.rpm !== 0
      ? selectedFrame.rpm / driverFrame.rpm
      : 0;
  const waveform = Array.from({ length: 60 }, (_, tick) => {
    const angle =
      (((selectedFrame?.angleDegrees ?? 0) + tick * 6) * Math.PI) / 180;

    return {
      tick,
      value: Number(Math.sin(angle).toFixed(3)),
    };
  });

  return (
    <section className="panelSection visualizations">
      <div className="sectionHeader">
        <h2>Visualizations</h2>
        <span>Base-60</span>
      </div>

      <div className="ratioCard">
        <span>Ratio</span>
        <strong>{ratio.toFixed(2)}:1</strong>
        <p>
          {gear?.label ?? "No gear"} at{" "}
          {formatSexagesimalAngle(selectedFrame?.angleDegrees ?? 0)}
        </p>
      </div>

      <div className="chartFrame" aria-label="Waveform">
        <ResponsiveContainer height={150} width="100%">
          <LineChart
            data={waveform}
            margin={{ top: 12, right: 8, bottom: 0, left: -28 }}
          >
            <XAxis
              dataKey="tick"
              interval={14}
              stroke="#7e8895"
              tick={{ fontSize: 10 }}
            />
            <YAxis domain={[-1, 1]} stroke="#7e8895" tick={{ fontSize: 10 }} />
            <Tooltip
              contentStyle={{
                background: "#171c22",
                border: "1px solid #303844",
                borderRadius: 6,
                color: "#f7f2e8",
              }}
            />
            <Line
              dataKey="value"
              dot={false}
              isAnimationActive={false}
              stroke="#72d2c6"
              strokeWidth={2}
              type="monotone"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="connectionList">
        {gearSystem.connections.map((connection) => (
          <div key={connection.id}>
            <span>{connection.kind}</span>
            <strong>
              {connection.sourceGearId} → {connection.targetGearId}
            </strong>
          </div>
        ))}
      </div>
    </section>
  );
}
