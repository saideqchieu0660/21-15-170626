import React, { useEffect, useRef, useState } from "react";
import * as d3 from "d3";
import { X, Calendar, Clock, Trophy, TrendingUp, BarChart2 } from "lucide-react";
import { store, ReviewRecord } from "../lib/store";

interface WeeklyStudyAnalyticsModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
}

interface DayData {
  dayName: string; // "Thứ 2", "Thứ 3", ... "CN"
  dateStr: string; // "12/06"
  minutes: number;
  cardsCount: number;
  rawDate: Date;
}

export default function WeeklyStudyAnalyticsModal({
  isOpen,
  onClose,
  userId,
}: WeeklyStudyAnalyticsModalProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [tooltipData, setTooltipData] = useState<{
    dayName: string;
    dateStr: string;
    minutes: number;
    cardsCount: number;
    x: number;
    y: number;
  } | null>(null);

  const [weeklyData, setWeeklyData] = useState<DayData[]>([]);
  const [totalWeeklyMinutes, setTotalWeeklyMinutes] = useState(0);
  const [bestDay, setBestDay] = useState<{ dayName: string; minutes: number } | null>(null);

  useEffect(() => {
    if (!isOpen || !userId) return;

    // 1. Get current week days (Thứ 2 - CN)
    const getDaysOfCurrentWeek = () => {
      const dates: Date[] = [];
      const today = new Date();
      const currentDay = today.getDay(); // 0: CN, 1: Thứ 2, ...
      const distanceToMonday = currentDay === 0 ? 6 : currentDay - 1;

      const monday = new Date(today);
      monday.setDate(today.getDate() - distanceToMonday);
      monday.setHours(0, 0, 0, 0);

      for (let i = 0; i < 7; i++) {
        const day = new Date(monday);
        day.setDate(monday.getDate() + i);
        dates.push(day);
      }
      return dates;
    };

    const days = getDaysOfCurrentWeek();
    const history: ReviewRecord[] = store.getReviewHistory(userId) || [];

    const dayLabels = [
      "Thứ 2",
      "Thứ 3",
      "Thứ 4",
      "Thứ 5",
      "Thứ 6",
      "Thứ 7",
      "Chủ Nhật",
    ];

    const NEW_SESSION_THRESHOLD = 5 * 60 * 1000; // 5 mins
    const DEFAULT_CARD_TIME = 15 * 1000; // 15 mins

    let totalMinsAccumulator = 0;
    let maxMins = -1;
    let maxMinsDayLabel = "";

    const weeklyStats: DayData[] = days.map((day, index) => {
      const startOfDay = new Date(day);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(day);
      endOfDay.setHours(23, 59, 59, 999);

      const dayRecords = history
        .filter(
          (r) =>
            r.timestamp >= startOfDay.getTime() &&
            r.timestamp <= endOfDay.getTime()
        )
        .sort((a, b) => a.timestamp - b.timestamp);

      // Compute elapsed milliseconds
      let msUsed = 0;
      for (let i = 0; i < dayRecords.length; i++) {
        if (i === 0) {
          msUsed += DEFAULT_CARD_TIME;
        } else {
          const diff = dayRecords[i].timestamp - dayRecords[i - 1].timestamp;
          if (diff <= NEW_SESSION_THRESHOLD) {
            msUsed += diff;
          } else {
            msUsed += DEFAULT_CARD_TIME;
          }
        }
      }

      const totalMinutes = Math.round((msUsed / (1000 * 60)) * 10) / 10; // decimal rounded to 1 place
      totalMinsAccumulator += totalMinutes;

      if (totalMinutes > maxMins) {
        maxMins = totalMinutes;
        maxMinsDayLabel = dayLabels[index];
      }

      const dateStr = `${day.getDate()}/${day.getMonth() + 1}`;

      return {
        dayName: dayLabels[index],
        dateStr,
        minutes: totalMinutes,
        cardsCount: dayRecords.length,
        rawDate: day,
      };
    });

    setWeeklyData(weeklyStats);
    setTotalWeeklyMinutes(Math.round(totalMinsAccumulator * 10) / 10);
    if (maxMins > 0) {
      setBestDay({ dayName: maxMinsDayLabel, minutes: maxMins });
    } else {
      setBestDay(null);
    }
  }, [isOpen, userId]);

  // 2. Render D3 Chart inside useEffect when weeklyData changes
  useEffect(() => {
    if (!isOpen || weeklyData.length === 0 || !svgRef.current) return;

    // Clear previous SVG content
    d3.select(svgRef.current).selectAll("*").remove();

    const margin = { top: 30, right: 20, bottom: 40, left: 45 };
    const width = 500 - margin.left - margin.right;
    const height = 280 - margin.top - margin.bottom;

    const svg = d3
      .select(svgRef.current)
      .attr("width", "100%")
      .attr("height", "100%")
      .attr("viewBox", `0 0 500 280`)
      .attr("preserveAspectRatio", "xMidYMid meet")
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    // X Scale
    const x = d3
      .scaleBand()
      .range([0, width])
      .domain(weeklyData.map((d) => d.dayName))
      .padding(0.35);

    // Y Scale (capped at min 15 minutes max for neat visualization if values are tiny)
    const maxVal = d3.max(weeklyData, (d) => d.minutes) || 0;
    const yMax = Math.max(10, Math.ceil(maxVal * 1.25));

    const y = d3.scaleLinear().range([height, 0]).domain([0, yMax]);

    // Horizontal grid lines
    svg
      .append("g")
      .attr("class", "grid-lines")
      .selectAll("line")
      .data(y.ticks(5))
      .enter()
      .append("line")
      .attr("x1", 0)
      .attr("x2", width)
      .attr("y1", (d) => y(d))
      .attr("y2", (d) => y(d))
      .attr("stroke", "#e5e7eb")
      .attr("stroke-width", 1)
      .attr("stroke-dasharray", "3,3")
      .style("opacity", "0.4");

    // X Axis
    svg
      .append("g")
      .attr("transform", `translate(0,${height})`)
      .call(d3.axisBottom(x).tickSize(0))
      .call((g) => g.select(".domain").attr("stroke", "#d1d5db").style("opacity", "0.5"))
      .selectAll("text")
      .attr("fill", "#6b7280")
      .style("font-size", "11px")
      .style("font-weight", "500")
      .attr("dy", "10px");

    // Y Axis
    svg
      .append("g")
      .call(d3.axisLeft(y).ticks(5).tickFormat((d) => `${d}m`))
      .call((g) => g.select(".domain").remove())
      .selectAll("text")
      .attr("fill", "#6b7280")
      .style("font-size", "11px");

    // Draw bars with gradients and drop shadow
    const defs = svg.append("defs");
    
    // Gradient definitions
    const gradient = defs
      .append("linearGradient")
      .attr("id", "bar-gradient")
      .attr("x1", "0%")
      .attr("y1", "0%")
      .attr("x2", "0%")
      .attr("y2", "100%");

    gradient
      .append("stop")
      .attr("offset", "0%")
      .attr("stop-color", "#f59e0b"); // Yellow-500

    gradient
      .append("stop")
      .attr("offset", "100%")
      .attr("stop-color", "#d97706"); // Amber-600

    const hoverGradient = defs
      .append("linearGradient")
      .attr("id", "bar-gradient-hover")
      .attr("x1", "0%")
      .attr("y1", "0%")
      .attr("x2", "0%")
      .attr("y2", "100%");

    hoverGradient
      .append("stop")
      .attr("offset", "0%")
      .attr("stop-color", "#fbbf24"); // Yellow-400

    hoverGradient
      .append("stop")
      .attr("offset", "100%")
      .attr("stop-color", "#f59e0b"); // Yellow-500

    // Drop shadow filter for elegant chart aesthetics
    const filter = defs.append("filter").attr("id", "shadow").attr("height", "130%");
    filter
      .append("feGaussianBlur")
      .attr("in", "SourceAlpha")
      .attr("stdDeviation", "2");
    filter.append("feOffset").attr("dx", "0").attr("dy", "1.5");
    const feMerge = filter.append("feMerge");
    feMerge.append("feMergeNode");
    feMerge.append("feMergeNode").attr("in", "SourceGraphic");

    svg
      .selectAll(".bar")
      .data(weeklyData)
      .enter()
      .append("rect")
      .attr("class", "bar")
      .attr("x", (d) => x(d.dayName) || 0)
      .attr("y", height) // starting state for transition
      .attr("width", x.bandwidth())
      .attr("height", 0) // starting state for transition
      .attr("rx", 5) // Rounded corners
      .attr("ry", 5)
      .attr("fill", "url(#bar-gradient)")
      .attr("filter", "url(#shadow)")
      .style("cursor", "pointer")
      .on("mouseover", function (event, d) {
        d3.select(this)
          .transition()
          .duration(150)
          .attr("fill", "url(#bar-gradient-hover)");

        // Tooltip geometry positioning
        const [mx, my] = d3.pointer(event);
        const svgRect = svgRef.current?.getBoundingClientRect();
        if (svgRect) {
          // Normalize coordinates nicely to the container
          setTooltipData({
            dayName: d.dayName,
            dateStr: d.dateStr,
            minutes: d.minutes,
            cardsCount: d.cardsCount,
            x: mx + margin.left,
            y: y(d.minutes) + margin.top - 15,
          });
        }
      })
      .on("mousemove", function (event, d) {
        const [mx] = d3.pointer(event);
        setTooltipData((prev) =>
          prev
            ? {
                ...prev,
                x: mx + margin.left,
                y: y(d.minutes) + margin.top - 15,
              }
            : null
        );
      })
      .on("mouseleave", function () {
        d3.select(this)
          .transition()
          .duration(150)
          .attr("fill", "url(#bar-gradient)");
        setTooltipData(null);
      })
      // Elegant entrance animation
      .transition()
      .duration(800)
      .delay((_d, i) => i * 50)
      .attr("y", (d) => y(d.minutes))
      .attr("height", (d) => height - y(d.minutes));

    // Value Labels on top of each bar (if minutes > 0)
    svg
      .selectAll(".val-label")
      .data(weeklyData.filter((d) => d.minutes > 0))
      .enter()
      .append("text")
      .attr("class", "val-label")
      .attr("x", (d) => (x(d.dayName) || 0) + x.bandwidth() / 2)
      .attr("y", (d) => y(d.minutes) - 6)
      .attr("text-anchor", "middle")
      .attr("fill", "#b45309") // Amber 700
      .style("font-size", "10px")
      .style("font-family", "monospace")
      .style("font-weight", "600")
      .text((d) => `${d.minutes}m`)
      .style("opacity", 0)
      .transition()
      .duration(800)
      .delay((_d, i) => i * 50 + 400)
      .style("opacity", 1);

  }, [isOpen, weeklyData]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-55 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-zinc-900/50 dark:bg-black/70 backdrop-blur-md transition-opacity"
        onClick={onClose}
        id="weekly-study-backdrop"
      />

      {/* Modal Card */}
      <div
        ref={containerRef}
        className="relative w-full max-w-lg glass select-none dark:bg-zinc-900/95 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-2xl p-6 md:p-8 animate-in zoom-in-95 duration-200 focus:outline-none"
        id="weekly-study-modal-container"
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-6 pb-4 border-b border-zinc-100 dark:border-zinc-800/80">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-orange-500/10 rounded-xl text-orange-600 dark:text-orange-400">
              <BarChart2 className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-display font-extrabold text-zinc-900 dark:text-zinc-100">
                Phân Tích Học Tập Tuần
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                Chi tiết thời lượng ôn tập trong tuần này
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-805 rounded-full text-zinc-400 dark:text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-200 transition"
            id="weekly-study-close-btn"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mini stats dashboard */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="p-4 bg-orange-500/5 dark:bg-orange-500/10 rounded-2xl border border-orange-500/10 dark:border-orange-400/20 flex items-center gap-3">
            <Clock className="w-8 h-8 text-orange-500 flex-shrink-0" />
            <div>
              <p className="text-[10px] uppercase font-bold tracking-wider opacity-60">
                Tổng cộng tuần
              </p>
              <p className="text-lg font-mono font-bold text-zinc-800 dark:text-zinc-200 mt-0.5">
                {totalWeeklyMinutes} phút
              </p>
            </div>
          </div>

          <div className="p-4 bg-orange-500/5 dark:bg-orange-500/10 rounded-2xl border border-orange-500/10 dark:border-orange-400/20 flex items-center gap-3">
            <Trophy className="w-8 h-8 text-orange-500 flex-shrink-0" />
            <div>
              <p className="text-[10px] uppercase font-bold tracking-wider opacity-60">
                Ngày tập trung nhất
              </p>
              <p className="text-base font-bold text-zinc-800 dark:text-zinc-200 mt-0.5 leading-tight">
                {bestDay ? `${bestDay.dayName} (${bestDay.minutes}m)` : "Chưa ghi nhận"}
              </p>
            </div>
          </div>
        </div>

        {/* Main D3 Chart viewport */}
        <div className="relative p-3 bg-zinc-50 dark:bg-zinc-950/40 border border-zinc-100 dark:border-zinc-800/60 rounded-2xl h-72">
          {totalWeeklyMinutes === 0 ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center opacity-60 p-6 text-center">
              <Calendar className="w-10 h-10 text-zinc-400 dark:text-zinc-600 mb-3" />
              <p className="text-sm font-semibold">Chưa có dữ liệu bài học</p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 max-w-[280px]">
                Hãy tiến hành ôn luyện hoặc học tập từ bộ thẻ để kích hoạt biểu đồ phân tích hàng ngày!
              </p>
            </div>
          ) : (
            <>
              <svg ref={svgRef} className="w-full h-full" id="weekly-study-d3-chart" />

              {/* Tooltip Overlay */}
              {tooltipData && (
                <div
                  className="absolute pointer-events-none bg-zinc-900/95 dark:bg-zinc-900 border border-zinc-800/90 dark:border-zinc-700/80 text-white rounded-lg px-2.5 py-1.5 text-[11px] shadow-xl flex flex-col gap-0.5 font-sans z-50 transform -translate-x-1/2 -translate-y-full tracking-wide"
                  style={{
                    left: `${tooltipData.x}px`,
                    top: `${tooltipData.y}px`,
                  }}
                >
                  <p className="font-bold border-b border-white/10 pb-0.5 mb-0.5 text-orange-400 text-center">
                    {tooltipData.dayName} ({tooltipData.dateStr})
                  </p>
                  <p className="flex justify-between gap-3 text-zinc-300">
                    <span>Thời gian học:</span>
                    <strong className="text-white text-right">{tooltipData.minutes} phút</strong>
                  </p>
                  <p className="flex justify-between gap-3 text-zinc-300">
                    <span>Số thẻ đã ôn:</span>
                    <strong className="text-white text-right">{tooltipData.cardsCount} thẻ</strong>
                  </p>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="mt-5 text-center text-zinc-450 dark:text-zinc-500 text-[11px] font-sans">
          <p className="flex items-center justify-center gap-1">
            <TrendingUp className="w-3.5 h-3.5 text-orange-500" />
            Biểu đồ đồng bộ và tự động làm mới thời lượng học theo thời gian thực!
          </p>
        </div>
      </div>
    </div>
  );
}
