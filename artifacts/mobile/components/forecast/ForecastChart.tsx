import Svg, { Circle, Line, Polyline, Text as SvgText } from "react-native-svg";
import { Text, View } from "react-native";

import { shortDate, ui } from "@/components/PlanningUI";
import { TYPOGRAPHY } from "@/constants/typography";
import type { ForecastPoint } from "@/finance/forecast";
import type { Colors } from "@/components/PlanningUI";
import { usePreferences } from "@/context/PreferencesContext";

function valueAt(points: ForecastPoint[], date: string) {
  let value = points[0]?.balance ?? 0;
  for (const point of points) {
    if (point.date > date) break;
    value = point.balance;
  }
  return value;
}

export function ForecastChart({ points, scenarioPoints, width, colors }: {
  points: ForecastPoint[];
  scenarioPoints?: ForecastPoint[];
  width: number;
  colors: Colors;
}) {
  const { t } = usePreferences();
  const height = 178, paddingX = 12, paddingY = 16;
  const dates = [...new Set([...points.map(p => p.date), ...(scenarioPoints ?? []).map(p => p.date)])].sort();
  if (!dates.length) return null;
  const values = [...points, ...(scenarioPoints ?? [])].map(p => p.balance);
  let min = Math.min(...values), max = Math.max(...values);
  if (min === max) { min -= 1; max += 1; }
  const span = max - min;
  const chartWidth = Math.max(1, width - paddingX * 2);
  const chartHeight = height - paddingY * 2 - 14;
  const x = (index: number) => paddingX + (dates.length === 1 ? chartWidth / 2 : index / (dates.length - 1) * chartWidth);
  const y = (value: number) => paddingY + (max - value) / span * chartHeight;
  const pointString = (source: ForecastPoint[]) => dates.map((date, index) => `${x(index)},${y(valueAt(source, date))}`).join(" ");
  const zeroVisible = min < 0 && max > 0;
  const zeroY = zeroVisible ? y(0) : undefined;

  return (
    <View accessibilityLabel={t("Projected account balances over time")}>
      <Svg width={width} height={height} accessibilityRole="image">
        {[0, 0.5, 1].map((portion, index) => {
          const yPos = paddingY + portion * chartHeight;
          return <Line key={index} x1={paddingX} y1={yPos} x2={width - paddingX} y2={yPos} stroke={colors.border} strokeWidth={1} />;
        })}
        {zeroY !== undefined ? <Line x1={paddingX} y1={zeroY} x2={width - paddingX} y2={zeroY} stroke={colors.destructive} strokeWidth={1} strokeDasharray="4 4" /> : null}
        {points.length > 1 ? <Polyline points={pointString(points)} fill="none" stroke={colors.primary} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" /> : null}
        {points.length === 1 ? <Circle cx={x(0)} cy={y(points[0].balance)} r={4} fill={colors.primary} /> : null}
        {scenarioPoints && scenarioPoints.length > 1 ? <Polyline points={pointString(scenarioPoints)} fill="none" stroke={colors.accent} strokeWidth={2.5} strokeDasharray="6 4" strokeLinecap="round" strokeLinejoin="round" /> : null}
        <SvgText x={paddingX} y={height - 1} fill={colors.mutedForeground} fontSize={TYPOGRAPHY.supporting} textAnchor="start">{shortDate(dates[0])}</SvgText>
        <SvgText x={width - paddingX} y={height - 1} fill={colors.mutedForeground} fontSize={TYPOGRAPHY.supporting} textAnchor="end">{shortDate(dates[dates.length - 1])}</SvgText>
      </Svg>
      <View style={[ui.row, { justifyContent: "center", marginTop: 8, gap: 18 }]}>
        <View style={[ui.row, { gap: 6 }]}>
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary }} />
          <Text style={[ui.small, { color: colors.mutedForeground }]}>{t("Baseline")}</Text>
        </View>
        {scenarioPoints ? (
          <View style={[ui.row, { gap: 6 }]}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.accent }} />
            <Text style={[ui.small, { color: colors.mutedForeground }]}>{t("Simulation")}</Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}
