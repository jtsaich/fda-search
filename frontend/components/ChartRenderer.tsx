"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { domToPng } from "modern-screenshot";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  ScatterChart,
  Scatter,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

interface ChartData {
  chartType: string;
  title: string;
  data: Record<string, unknown>[];
  xAxis: string;
  yAxis: string | string[];
  filename?: string;
}

const COLORS = [
  "#3b82f6",
  "#ef4444",
  "#22c55e",
  "#f59e0b",
  "#8b5cf6",
  "#ec4899",
  "#06b6d4",
  "#f97316",
];

export function ChartRenderer({ chart }: { chart: ChartData }) {
  const chartRef = useRef<HTMLDivElement>(null);
  const [downloading, setDownloading] = useState(false);

  const yAxes = useMemo(
    () => (Array.isArray(chart.yAxis) ? chart.yAxis : [chart.yAxis]),
    [chart.yAxis]
  );

  const handleDownload = useCallback(async () => {
    const container = chartRef.current;
    if (!container || downloading) return;

    setDownloading(true);
    try {
      const dataUrl = await domToPng(container, {
        backgroundColor: "#ffffff",
        scale: 2,
      });

      const link = document.createElement("a");
      const safeName = (chart.title || "chart")
        .replace(/[^a-zA-Z0-9 ]/g, "")
        .replace(/\s+/g, "_");
      link.download = `${safeName}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error("Chart download failed:", err);
    } finally {
      setDownloading(false);
    }
  }, [chart.title, downloading]);

  const chartContent = useMemo(() => {
    switch (chart.chartType) {
      case "bar":
        return (
          <BarChart data={chart.data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey={chart.xAxis} tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip />
            <Legend />
            {yAxes.map((key, i) => (
              <Bar
                key={key}
                dataKey={key}
                fill={COLORS[i % COLORS.length]}
              />
            ))}
          </BarChart>
        );

      case "line":
        return (
          <LineChart data={chart.data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey={chart.xAxis} tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip />
            <Legend />
            {yAxes.map((key, i) => (
              <Line
                key={key}
                type="monotone"
                dataKey={key}
                stroke={COLORS[i % COLORS.length]}
                strokeWidth={2}
              />
            ))}
          </LineChart>
        );

      case "pie":
        return (
          <PieChart>
            <Tooltip />
            <Legend />
            <Pie
              data={chart.data}
              dataKey={yAxes[0]}
              nameKey={chart.xAxis}
              cx="50%"
              cy="50%"
              outerRadius={100}
              label
            >
              {chart.data.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Pie>
          </PieChart>
        );

      case "scatter":
        return (
          <ScatterChart>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey={chart.xAxis} name={chart.xAxis} tick={{ fontSize: 12 }} />
            <YAxis dataKey={yAxes[0]} name={yAxes[0]} tick={{ fontSize: 12 }} />
            <Tooltip cursor={{ strokeDasharray: "3 3" }} />
            <Legend />
            <Scatter name={yAxes[0]} data={chart.data} fill={COLORS[0]} />
          </ScatterChart>
        );

      case "area":
        return (
          <AreaChart data={chart.data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey={chart.xAxis} tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip />
            <Legend />
            {yAxes.map((key, i) => (
              <Area
                key={key}
                type="monotone"
                dataKey={key}
                stroke={COLORS[i % COLORS.length]}
                fill={COLORS[i % COLORS.length]}
                fillOpacity={0.3}
              />
            ))}
          </AreaChart>
        );

      default:
        return (
          <div className="text-sm text-gray-500 p-4">
            Unsupported chart type: {chart.chartType}
          </div>
        );
    }
  }, [chart, yAxes]);

  return (
    <div className="mt-3 p-3 bg-white rounded-lg border border-gray-200">
      <div className="flex items-center justify-between mb-2">
        {chart.title ? (
          <h4 className="text-sm font-semibold text-gray-700 flex-1 text-center">
            {chart.title}
          </h4>
        ) : (
          <div className="flex-1" />
        )}
        <button
          onClick={handleDownload}
          disabled={downloading}
          title="Download chart as PNG"
          className="flex items-center gap-1 px-2 py-1 text-xs text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors disabled:opacity-50"
        >
          {downloading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Download className="h-3.5 w-3.5" />
          )}
          PNG
        </button>
      </div>
      <div ref={chartRef}>
        <ResponsiveContainer width="100%" height={300}>
          {chartContent}
        </ResponsiveContainer>
      </div>
      {chart.filename && (
        <p className="text-xs text-gray-400 mt-1 text-center">
          Source: {chart.filename}
        </p>
      )}
    </div>
  );
}
