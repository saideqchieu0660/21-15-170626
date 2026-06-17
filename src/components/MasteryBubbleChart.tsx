import React, { useRef, useEffect } from 'react';
import * as d3 from 'd3';

type BubbleData = {
  id: string;
  value: number; // For sizing
  mastery: number; // For coloring
  label: string;
};

export const MasteryBubbleChart = ({ data }: { data: BubbleData[] }) => {
  const d3Container = useRef<SVGSVGElement | null>(null);

  useEffect(() => {
    if (data.length > 0 && d3Container.current) {
      const width = 600;
      const height = 400;

      // Clear previous
      d3.select(d3Container.current).selectAll('*').remove();

      const svg = d3.select(d3Container.current)
        .attr('width', width)
        .attr('height', height)
        .attr('viewBox', [0, 0, width, height] as any)
        .style('max-width', '100%')
        .style('height', 'auto');

      const colorScale = d3.scaleSequential(d3.interpolateYlOrBr)
        .domain([0, 100]); // Assuming mastery is 0-100

      // D3 pack layout
      const pack = d3.pack<BubbleData>()
        .size([width, height])
        .padding(5);

      const root = d3.hierarchy({ children: data } as any)
        .sum((d: any) => d.value)
        .sort((a, b) => b.value - a.value);

      const leaf = svg.selectAll('g')
        .data(pack(root).leaves())
        .join('g')
        .attr('transform', d => `translate(${d.x + 1},${d.y + 1})`);

      leaf.append('circle')
        .attr('r', d => d.r)
        .attr('fill-opacity', 0.7)
        .attr('fill', d => {
            const mastery = (d.data as BubbleData).mastery;
            return colorScale(mastery);
        })
        .attr('stroke', '#d97706')
        .attr('stroke-width', 2);

      leaf.on('mouseover', function () {
        d3.select(this).select('circle').attr('fill-opacity', 1).attr('stroke-width', 3);
      })
      .on('mouseout', function () {
        d3.select(this).select('circle').attr('fill-opacity', 0.7).attr('stroke-width', 2);
      });

      leaf.append('text')
        .text(d => (d.data as BubbleData).label)
        .attr('text-anchor', 'middle')
        .style('font-size', d => Math.min(d.r / 3, 14) + 'px')
        .style('font-weight', 'bold')
        .style('fill', '#000') // Better contrast
        .attr('dy', '-0.2em');
        
      leaf.append('text')
        .text(d => `M: ${(d.data as BubbleData).mastery}%`)
        .attr('text-anchor', 'middle')
        .style('font-size', d => Math.min(d.r / 4, 12) + 'px')
        .style('fill', '#444') // Better contrast
        .attr('dy', '1.2em');

      // Add tooltips
      leaf.append('title')
        .text(d => `${(d.data as BubbleData).label}\nMastery: ${(d.data as BubbleData).mastery}%`);
    }
  }, [data]);

  return (
    <div className="w-full h-full flex justify-center items-center rounded-xl p-4">
      <svg ref={d3Container} className="overflow-visible" />
    </div>
  );
};
