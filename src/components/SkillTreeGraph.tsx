import React, { useEffect, useRef, useState , useMemo } from 'react';
import * as d3 from 'd3';
import { useTheme } from './ThemeProvider';
import { useNavigate } from 'react-router-dom';
import { cn } from '../lib/utils';
import { Lock, Unlock, Award, Gem, BookOpen } from 'lucide-react';
import { getConfetti } from '../lib/celebration';

interface NodeData extends d3.SimulationNodeDatum {
  id: string;
  title: string;
  subject: string;
  mastery: number;
  wordCount: number;
  points: number;
  status: 'locked' | 'unlocked' | 'mastered';
}

interface LinkData extends d3.SimulationLinkDatum<NodeData> {
  source: string | NodeData;
  target: string | NodeData;
}

interface SkillTreeProps {
  decks: any[];
}

export const SkillTreeGraph = React.memo(function SkillTreeGraph({ decks }: SkillTreeProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { theme } = useTheme();
  const navigate = useNavigate();
  const [selectedNode, setSelectedNode] = useState<NodeData | null>(null);
  const [hoveredNode, setHoveredNode] = useState<NodeData | null>(null);
  
  // Nâng cấp: Lọc theo danh mục (Subject filter)
  const [selectedSubject, setSelectedSubject] = useState<string>("All");

  const uniqueSubjects = useMemo(() => {
     const subs = new Set<string>();
     decks.forEach(d => subs.add(d.subject || 'Chung'));
     return Array.from(subs);
  }, [decks]);

  useEffect(() => {
    if (!containerRef.current || decks.length === 0) return;

    // Filter decks based on selected subject
    const filteredDecks = selectedSubject === "All" ? decks : decks.filter(d => (d.subject || 'Chung') === selectedSubject);

    // Calculate node states
    const nodeMap = new Map<string, NodeData>();
    const subjectMap = new Map<string, string[]>();
    
    filteredDecks.forEach(deck => {
      const cards = deck.cards || [];
      const avgMastery = cards.length 
        ? cards.reduce((sum: number, c: any) => sum + c.mastery, 0) / cards.length 
        : 0;
      
      const sub = deck.subject || 'Chung';
      if (!subjectMap.has(sub)) subjectMap.set(sub, []);
      subjectMap.get(sub)!.push(deck.id);

      nodeMap.set(deck.id, {
        id: deck.id,
        title: deck.title,
        subject: sub,
        mastery: avgMastery,
        wordCount: cards.length,
        points: cards.length * 10,
        status: 'locked' // default
      });
    });

    const nodesData = Array.from(nodeMap.values());
    
    // Dynamically build prerequisites
    const dynamicPrereqs: Record<string, string[]> = {};
    subjectMap.forEach(deckIds => {
       deckIds.forEach((id, index) => {
         if (index > 0) {
            dynamicPrereqs[id] = [deckIds[index - 1]];
         } else {
            dynamicPrereqs[id] = [];
         }
       });
    });

    // Evaluate status based on 100% dependencies
    nodesData.forEach(node => {
      if (node.mastery >= 100) {
        node.status = 'mastered';
      } else {
        const prereqs = dynamicPrereqs[node.id] || [];
        const isUnlocked = prereqs.every(pid => {
          const pNode = nodeMap.get(pid);
          return pNode && pNode.mastery >= 100; // Strict 100% required
        });
        node.status = (prereqs.length === 0 || isUnlocked) ? 'unlocked' : 'locked';
      }
    });

    const linksData: LinkData[] = [];
    Object.entries(dynamicPrereqs).forEach(([targetId, sourceIds]) => {
      sourceIds.forEach(sourceId => {
        if (nodeMap.has(sourceId) && nodeMap.has(targetId)) {
          linksData.push({ source: sourceId, target: targetId });
        }
      });
    });

    const renderGraph = (width: number, height: number) => {
      d3.select(containerRef.current).select('svg').remove();

      const svg = d3.select(containerRef.current)
        .append('svg')
        .attr('width', width)
        .attr('height', height)
        .call(d3.zoom<SVGSVGElement, unknown>().scaleExtent([0.5, 4]).on('zoom', (event) => {
          g.attr('transform', event.transform);
        }))
        .append('g');

      const g = svg.append('g');

      // Glow effect defs
      const defs = svg.append("defs");
      const filter = defs.append("filter").attr("id", "glow").attr('x', '-50%').attr('y', '-50%').attr('width', '200%').attr('height', '200%');
      filter.append("feGaussianBlur").attr("stdDeviation", "8").attr("result", "coloredBlur");
      const feMerge = filter.append("feMerge");
      feMerge.append("feMergeNode").attr("in", "coloredBlur");
      feMerge.append("feMergeNode").attr("in", "SourceGraphic");

      const lineGlow = defs.append("linearGradient").attr("id", "lineGlow").attr("x1", "0%").attr("y1", "0%").attr("x2", "100%").attr("y2", "0%");
      lineGlow.append("stop").attr("offset", "0%").attr("stop-color", "#38bdf8");
      lineGlow.append("stop").attr("offset", "100%").attr("stop-color", "#818cf8");

      const goldGlow = defs.append("radialGradient").attr("id", "goldGlow").attr("cx", "50%").attr("cy", "50%").attr("r", "50%");
      goldGlow.append("stop").attr("offset", "0%").attr("stop-color", "#fde047");
      goldGlow.append("stop").attr("offset", "100%").attr("stop-color", "#ca8a04");

      const blueGlow = defs.append("radialGradient").attr("id", "blueGlow").attr("cx", "50%").attr("cy", "50%").attr("r", "50%");
      blueGlow.append("stop").attr("offset", "0%").attr("stop-color", "#7dd3fc");
      blueGlow.append("stop").attr("offset", "100%").attr("stop-color", "#0ea5e9");

      const simulation = d3.forceSimulation<NodeData>(nodesData)
        .force('link', d3.forceLink<NodeData, LinkData>(linksData).id(d => d.id).distance(250))
        .force('charge', d3.forceManyBody().strength(-3500))
        .force('center', d3.forceCenter(width / 2, height / 2))
        .force('collision', d3.forceCollide().radius(150));

      // Draw links
      const link = g.append('g')
        .attr('stroke-opacity', 0.9)
        .selectAll('line')
        .data(linksData)
        .join('line')
        .attr('stroke-width', d => {
           const targetNode = typeof d.target === 'string' ? nodeMap.get(d.target) : d.target;
           return targetNode && targetNode.status !== 'locked' ? 4 : 2;
        })
        .attr('stroke', d => {
           const targetNode = typeof d.target === 'string' ? nodeMap.get(d.target) : d.target;
           if (targetNode && targetNode.status !== 'locked') return 'url(#lineGlow)';
           return theme === 'dark' ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)';
        })
        .attr('stroke-dasharray', d => {
           const targetNode = typeof d.target === 'string' ? nodeMap.get(d.target) : d.target;
           return targetNode && targetNode.status === 'locked' ? '6,6' : 'none';
        })
        .style('filter', d => {
           const targetNode = typeof d.target === 'string' ? nodeMap.get(d.target) : d.target;
           return targetNode && targetNode.status !== 'locked' ? 'url(#glow)' : 'none';
        });

      // Node groups
      const node = g.append('g')
        .selectAll('g')
        .data(nodesData)
        .join('g')
        .style('cursor', d => d.status === 'locked' ? 'not-allowed' : 'pointer')
        .call(d3.drag<SVGGElement, NodeData>()
          .on('start', (event, d) => {
            if (!event.active) simulation.alphaTarget(0.3).restart();
            d.fx = d.x;
            d.fy = d.y;
          })
          .on('drag', (event, d) => {
            d.fx = event.x;
            d.fy = event.y;
          })
          .on('end', (event, d) => {
            if (!event.active) simulation.alphaTarget(0);
            d.fx = null;
            d.fy = null;
          })
        )
        .on('mouseover', (event, d) => setHoveredNode(d))
        .on('mouseout', () => setHoveredNode(null))
        .on('click', (event, d) => {
           if (d.status !== 'locked') {
               setSelectedNode(d);
               if (d.status === 'unlocked' && d.mastery === 0) {
                  getConfetti()({
                    particleCount: 50,
                    spread: 60,
                    origin: { y: 0.8 },
                    colors: ['#38bdf8', '#818cf8', '#facc15']
                  });
               }
           }
        });

      // Outer mechanical ring
      node.append('circle')
        .attr('r', 48)
        .attr('fill', d => {
          if (d.status === 'mastered') return 'url(#goldGlow)'; // Golden gradient
          if (d.status === 'unlocked') return 'url(#blueGlow)'; // Neon blue gradient
          return theme === 'dark' ? '#27272a' : '#d4d4d8'; 
        })
        .style('filter', d => d.status !== 'locked' ? 'url(#glow)' : 'none');

      // Inner mechanical body (Skill Badge Style)
      node.append('circle')
        .attr('r', 42)
        .attr('fill', d => {
          if (d.status === 'mastered') return theme === 'dark' ? '#18181b' : '#fef9c3';
          if (d.status === 'unlocked') return theme === 'dark' ? '#18181b' : '#e0f2fe';
          return theme === 'dark' ? '#18181b' : '#f4f4f5'; // Locked
        })
        .attr('stroke', d => {
          if (d.status === 'mastered') return '#fbbf24';
          if (d.status === 'unlocked') return '#38bdf8';
          return theme === 'dark' ? '#3f3f46' : '#e4e4e7';
        })
        .attr('stroke-width', d => d.status === 'locked' ? 2 : 4)
        .attr('stroke-dasharray', d => d.status === 'locked' ? 'none' : '4,2');

      // Node Icons or Text (center)
      node.append('text')
        .text(d => {
           if (d.status === 'locked') return '🔒';
           if (d.status === 'mastered') return '🏆';
           return `${Math.round(d.mastery)}%`;
        })
        .attr('text-anchor', 'middle')
        .attr('dy', '0.35em')
        .attr('font-size', '20px')
        .attr('font-weight', '900')
        .attr('fill', d => {
           if (d.status === 'unlocked') return '#38bdf8';
           if (d.status === 'mastered') return '#fbbf24';
           return theme === 'dark' ? '#52525b' : '#a1a1aa';
        });

      // Node Title (below)
      node.append('text')
        .text(d => d.title)
        .attr('text-anchor', 'middle')
        .attr('dy', '70px')
        .attr('font-size', '14px')
        .attr('font-weight', 'bold')
        .attr('font-family', 'ui-sans-serif, system-ui, sans-serif')
        .attr('fill', d => {
           if (d.status === 'locked') return theme === 'dark' ? '#52525b' : '#a1a1aa';
           if (d.status === 'mastered') return '#ca8a04';
           return '#0ea5e9';
        });

      simulation.on('tick', () => {
        link
          .attr('x1', d => (d.source as NodeData).x!)
          .attr('y1', d => (d.source as NodeData).y!)
          .attr('x2', d => (d.target as NodeData).x!)
          .attr('y2', d => (d.target as NodeData).y!);

        node.attr('transform', d => `translate(${d.x},${d.y})`);
      });

      return () => {
         simulation.stop();
      };
    };

    let resizeTimer: NodeJS.Timeout;
    const observer = new ResizeObserver((entries) => {
       if (entries.length === 0) return;
       const { width } = entries[0].contentRect;
       if (width === 0) return;
       clearTimeout(resizeTimer);
       resizeTimer = setTimeout(() => {
           renderGraph(width, 600); // taller height for cinematic view
       }, 50);
    });

    observer.observe(containerRef.current);

    return () => {
        observer.disconnect();
        clearTimeout(resizeTimer);
    };

  }, [decks, theme, selectedSubject]);

  return (
    <div className="relative w-full h-[600px] rounded-xl overflow-hidden glass border border-black/10 dark:border-white/10 shadow-inner">
       <div className="absolute top-4 right-4 z-10 flex items-center gap-3 bg-white/70 dark:bg-black/70 backdrop-blur-md p-2 px-4 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-800">
          <span className="text-sm font-bold opacity-70">Lọc môn học:</span>
          <select 
             value={selectedSubject} 
             onChange={(e) => setSelectedSubject(e.target.value)}
             className="bg-transparent border-none text-sm font-bold focus:ring-0 cursor-pointer"
          >
             <option value="All">Tất cả</option>
             {uniqueSubjects.map(sub => (
                <option key={sub} value={sub}>{sub}</option>
             ))}
          </select>
       </div>
       <div ref={containerRef} className="w-full h-full cursor-grab active:cursor-grabbing" />
       
       {/* TOOLTIP ON HOVER */}
       {hoveredNode && (
         <div className="absolute top-4 right-4 z-10 w-72 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-xl p-5 rounded-xl border border-sky-500/30 shadow-[0_0_40px_rgba(56,189,248,0.2)] animate-in fade-in zoom-in-95 pointer-events-none transition-all">
            <h4 className="font-display font-black text-xl mb-1 leading-tight text-transparent bg-clip-text bg-gradient-to-r from-sky-600 to-indigo-500 dark:from-sky-400 dark:to-indigo-400">
              {hoveredNode.title}
            </h4>
            <div className="flex items-center gap-1.5 text-xs font-bold text-zinc-500 dark:text-zinc-400 mb-4 tracking-wider uppercase bg-black/5 dark:bg-white/5 inline-flex px-2 py-1 rounded">
               <BookOpen className="w-3.5 h-3.5" /> Chủ đề: {hoveredNode.subject || "Chung"}
            </div>
            
            <div className="flex flex-col gap-3">
               <div className="flex items-center justify-between border-b border-black/5 dark:border-white/5 pb-2">
                  <span className="text-sm font-bold opacity-70">Từ vựng/Kiến thức:</span>
                  <span className="font-mono font-bold text-lg">{hoveredNode.wordCount} thẻ</span>
               </div>
               <div className="flex items-center justify-between bg-orange-500/10 dark:bg-orange-500/10 px-3 py-2 rounded-lg border border-orange-500/30 shadow-inner">
                  <span className="text-sm font-bold text-orange-700 dark:text-orange-400 flex items-center gap-1.5">
                     <Gem className="w-4 h-4" /> Điểm danh dự
                  </span>
                  <span className="font-mono font-bold text-orange-600 dark:text-orange-400 text-lg">+{hoveredNode.points} XP</span>
               </div>
            </div>
         </div>
       )}

       {selectedNode && (
         <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-xl p-6 rounded-2xl border border-sky-500/30 shadow-[0_0_50px_rgba(56,189,248,0.2)] flex flex-col items-center min-w-[340px] animate-in slide-in-from-bottom-5">
            <h3 className="text-2xl font-black font-display text-transparent bg-clip-text bg-gradient-to-r from-sky-600 to-indigo-500 dark:from-sky-400 dark:to-indigo-400 mb-5 text-center">
              {selectedNode.title}
            </h3>
            <div className="flex gap-4 w-full mb-6">
              <div className="flex-1 bg-zinc-100 dark:bg-zinc-800 border border-black/5 dark:border-white/5 rounded-xl p-4 text-center shadow-inner">
                 <div className="text-xs uppercase tracking-wider font-bold opacity-60 mb-2">Thông thạo</div>
                 <div className="text-3xl font-black font-mono text-zinc-800 dark:text-zinc-100">{Math.round(selectedNode.mastery)}%</div>
              </div>
              <div className="flex-1 bg-zinc-100 dark:bg-zinc-800 border border-black/5 dark:border-white/5 rounded-xl p-4 text-center flex flex-col items-center justify-center shadow-inner">
                 <div className="text-xs uppercase tracking-wider font-bold opacity-60 mb-2">Trạng thái</div>
                 <div className={cn("text-base font-bold flex items-center justify-center gap-1.5", selectedNode.status === 'mastered' ? "text-orange-600 dark:text-orange-400" : "text-sky-600 dark:text-sky-400")}>
                    {selectedNode.status === 'mastered' ? <><Award className="w-5 h-5" /> Đã làm chủ</> : <><Unlock className="w-5 h-5"/> Đang Mở</>}
                 </div>
              </div>
            </div>
            
            <div className="flex gap-3 w-full">
              <button onClick={() => setSelectedNode(null)} className="flex-1 px-4 py-3 rounded-xl font-bold bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-300 dark:hover:bg-zinc-700 transition">Đóng lại</button>
              <button 
                 onClick={() => navigate(`/study/${selectedNode.id}`)} 
                 className="flex-1 px-4 py-3 rounded-xl font-bold font-display bg-gradient-to-r from-sky-500 to-indigo-500 hover:from-sky-600 hover:to-indigo-600 text-white transition shadow-lg shadow-sky-500/25 shrink-0 flex justify-center items-center gap-2 transform hover:scale-105 active:scale-95"
              >
                 Bắt Đầu Học <Unlock className="w-5 h-5"/>
              </button>
            </div>
         </div>
       )}

       <div className="absolute top-4 left-4 flex flex-col gap-3 text-xs font-mono font-bold bg-white/70 dark:bg-black/70 backdrop-blur-md p-3.5 rounded-xl border border-black/10 dark:border-white/10 pointer-events-none shadow-lg">
          <div className="opacity-50 tracking-wider mb-1 uppercase">Bản chú giải</div>
          <div className="flex items-center gap-3">
             <span className="w-4 h-4 rounded-full bg-orange-400 shadow-[0_0_15px_rgba(251,191,36,0.8)] border-2 border-orange-200"></span> 
             <span className="text-orange-700 dark:text-orange-400">Mastered (100%)</span>
          </div>
          <div className="flex items-center gap-3">
             <span className="w-4 h-4 rounded-full bg-sky-400 shadow-[0_0_15px_rgba(56,189,248,0.8)] border-2 border-sky-200"></span> 
             <span className="text-sky-700 dark:text-sky-400">Unlocked</span>
          </div>
          <div className="flex items-center gap-3">
             <span className="w-4 h-4 rounded-full bg-zinc-300 dark:bg-zinc-700 border-2 border-zinc-400 dark:border-zinc-500 border-dashed"></span> 
             <span className="opacity-60">Locked</span>
          </div>
       </div>
    </div>
  );
});


