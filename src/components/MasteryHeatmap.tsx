import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { useTheme } from './ThemeProvider';

interface HeatmapData {
  deckTitle: string;
  day: string; // e.g., 'Mon', 'Tue', OR Date strings
  mastery: number; // 0 to 100
}

interface MasteryHeatmapProps {
  data: HeatmapData[];
}

export function MasteryHeatmap({ data }: MasteryHeatmapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { theme } = useTheme();

  useEffect(() => {
    if (!containerRef.current || !data || data.length === 0) return;

    let svg = d3.select(containerRef.current).select('svg');
    
    // Instead of using effect on purely static width, let's use ResizeObserver to update width/height
    const renderChart = (width: number, height: number) => {
      d3.select(containerRef.current).selectAll('*').remove();
      
      const margin = { top: 20, right: 20, bottom: 40, left: 100 };
      const svg = d3.select(containerRef.current)
        .append('svg')
        .attr('width', width)
        .attr('height', height)
        .attr('viewBox', `0 0 ${width} ${height}`)
        .attr('preserveAspectRatio', 'xMidYMid meet');

      const innerWidth = width - margin.left - margin.right;
      const innerHeight = height - margin.top - margin.bottom;

      const g = svg.append('g')
        .attr('transform', `translate(${margin.left},${margin.top})`);

      const days = Array.from(new Set(data.map(d => d.day)));
      const decks = Array.from(new Set(data.map(d => d.deckTitle)));

      const x = d3.scaleBand()
        .domain(days)
        .range([0, innerWidth])
        .padding(0.05);

      const y = d3.scaleBand()
        .domain(decks)
        .range([innerHeight, 0])
        .padding(0.05);

      const colorScale = d3.scaleSequential()
        .domain([0, 100])
        // Dark yellow to bright yellow/gold
        .interpolator(d3.interpolateRgb('rgba(234, 179, 8, 0.1)', 'rgba(234, 179, 8, 1)'));

      // Tooltip
      const tooltip = d3.select(containerRef.current)
        .append('div')
        .attr('class', 'absolute pointer-events-none opacity-0 bg-white dark:bg-zinc-900 border border-neutral-200 dark:border-neutral-800 p-2 rounded-lg shadow-lg text-xs font-mono z-10 transition-opacity')
        .style('left', '0px')
        .style('top', '0px');

      g.selectAll('rect')
        .data(data)
        .enter()
        .append('rect')
        .attr('x', d => x(d.day) || 0)
        .attr('y', d => y(d.deckTitle) || 0)
        .attr('width', x.bandwidth())
        .attr('height', y.bandwidth())
        .attr('rx', 4)
        .attr('ry', 4)
        .style('fill', d => colorScale(d.mastery))
        .style('stroke', theme === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)')
        .style('stroke-width', 1)
        .on('mouseover', function(event, d) {
          d3.select(this)
            .style('stroke', '#eab308')
            .style('stroke-width', 2);
          
          tooltip.transition().duration(200).style('opacity', 1);
          tooltip.html(`
            <div class="font-bold text-zinc-800 dark:text-zinc-200">${d.deckTitle}</div>
            <div class="text-zinc-500 dark:text-zinc-400">${d.day}</div>
            <div class="mt-1 font-bold text-orange-600 dark:text-orange-400">Mastery: ${d.mastery}%</div>
          `)
            .style('left', (event.pageX + 10) + 'px')
            .style('top', (event.pageY - 28) + 'px');
        })
        .on('mousemove', function(event) {
          tooltip
            .style('left', (event.pageX + 10) + 'px')
            .style('top', (event.pageY - 28) + 'px');
        })
        .on('mouseout', function() {
          d3.select(this)
            .style('stroke', theme === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)')
            .style('stroke-width', 1);
          tooltip.transition().duration(500).style('opacity', 0);
        });

      // Add Axes
      const xAxis = d3.axisBottom(x).tickSizeOuter(0);
      g.append('g')
        .attr('transform', `translate(0,${innerHeight})`)
        .call(xAxis)
        .selectAll('text')
        .style('fill', theme === 'dark' ? '#a1a1aa' : '#52525b')
        .style('font-family', 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace')
        .style('font-size', '10px');

      g.selectAll('.domain').remove(); // remove axis line
      g.selectAll('.tick line').remove(); // remove tick lines

      const yAxis = d3.axisLeft(y).tickSizeOuter(0);
      g.append('g')
        .call(yAxis)
        .selectAll('text')
        .style('fill', theme === 'dark' ? '#a1a1aa' : '#52525b')
        .style('font-family', 'ui-sans-serif, system-ui, -apple-system, sans-serif')
        .style('font-size', '11px')
        .style('font-weight', 'bold');

      g.selectAll('.domain').remove();
      g.selectAll('.tick line').remove();
    };

    let resizeTimer: NodeJS.Timeout;
    const observer = new ResizeObserver((entries) => {
       if (entries.length === 0) return;
       const { width, height } = entries[0].contentRect;
       if (width === 0) return;
       clearTimeout(resizeTimer);
       resizeTimer = setTimeout(() => {
           renderChart(width, height > 100 ? height : 280);
       }, 50);
    });

    observer.observe(containerRef.current);

    return () => {
        observer.disconnect();
        clearTimeout(resizeTimer);
    };
  }, [data, theme]);

  return (
    <div className="w-full h-full relative min-h-[18rem]" ref={containerRef} />
  );
}
