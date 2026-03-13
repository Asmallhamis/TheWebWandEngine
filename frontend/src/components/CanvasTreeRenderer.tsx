import React, { useEffect, useRef, useMemo, useState } from 'react';
import { EvalNode, SpellDb, AppSettings } from '../types';
import { getIconUrl } from '../lib/evaluatorAdapter';

interface CanvasTreeRendererProps {
  data: EvalNode;
  spellDb: SpellDb;
  settings: AppSettings;
  width?: number;
  height?: number;
  onHover?: (indices: number[] | null) => void;
  showIndices?: boolean;
  absoluteToOrdinal?: Record<number, number> | null;
  markedSlots?: number[];
  onToggleMark?: (indices: number[]) => void;
}

const BASE_NODE_HEIGHT = 44;
const HORIZONTAL_GAP = 36;
const VERTICAL_GAP = 12;
const ICON_SIZE = 28;
// 绘制 Cast 标题的高度 / Height for drawing Cast headers
const CAST_HEADER_HEIGHT = 32;

/**
 * 递归计算节点总数（用于 Header 显示）
 * Recursively count total nodes (used for Header display)
 */
function countNodes(node: EvalNode): number {
  let count = 1;
  node.children?.forEach(c => {
    count += countNodes(c);
  });
  return count;
}

interface ComputedNode {
  node: EvalNode;
  x: number;
  y: number;
  width: number;
  height: number;
  subtreeHeight: number;
  children: ComputedNode[];
  isCast: boolean;
}

const imageCache: Record<string, HTMLImageElement> = {};
function getCachedImage(url: string): HTMLImageElement {
  if (imageCache[url]) return imageCache[url];
  const img = new Image();
  img.src = url;
  imageCache[url] = img;
  return img;
}

export const CanvasTreeRenderer: React.FC<CanvasTreeRendererProps> = ({ data, spellDb, settings, width = 1200, height = 800, onHover, showIndices, absoluteToOrdinal, markedSlots, onToggleMark }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoverNode, setHoverNode] = useState<ComputedNode | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  // Compute Layout
  const computedLayout = useMemo(() => {
    const ctx = document.createElement('canvas').getContext('2d');
    if (!ctx) return null;
    ctx.font = 'bold 10px Inter, sans-serif';

    function measure(node: EvalNode): number {
      const spell = spellDb[node.name];
      const hasIcon = spell && !!spell.icon;
      const showText = settings.showSpellId || !hasIcon;
      const displayName = showText ? (settings.showSpellId ? node.name : (spell ? (spell.en_name || spell.name || node.name) : node.name)) : '';
      
      let contentWidth = 0;
      if (hasIcon) contentWidth += ICON_SIZE;
      if (showText) {
         if (hasIcon) contentWidth += 4; // gap between icon and text
         contentWidth += ctx!.measureText(displayName).width;
      }
      
      let badgeW = 0;
      if (node.count > 1) {
         ctx!.font = 'black 10px Inter';
         badgeW = ctx!.measureText(`x${node.count}`).width + 8; // px-1
         ctx!.font = 'bold 10px Inter, sans-serif';
      }
      
      let innerW = contentWidth;
      if (badgeW > 0) innerW += 8 + badgeW; // gap-2

      return Math.max(40, innerW + 16); // padding 8px each side
    }

    function layout(node: EvalNode, x: number, startY: number): { cNode: ComputedNode; totalHeight: number } {
      const isCast = node.name.startsWith('Cast #') || node.name === 'Wand';
      const nodeW = measure(node);
      const nodeH = BASE_NODE_HEIGHT;
      
      const childrenNodes: ComputedNode[] = [];
      let currentY = startY;

      if (node.children && node.children.length > 0) {
        for (const child of node.children) {
          const { cNode, totalHeight } = layout(child, x + nodeW + HORIZONTAL_GAP, currentY);
          childrenNodes.push(cNode);
          currentY += totalHeight + VERTICAL_GAP;
        }
      }

      const subtreeHeight = Math.max(nodeH, currentY - startY - (node.children?.length ? VERTICAL_GAP : 0));
      
      const cNode: ComputedNode = {
        node,
        x,
        y: startY,
        width: nodeW,
        height: nodeH,
        subtreeHeight,
        children: childrenNodes,
        isCast
      };

      return { cNode, totalHeight: subtreeHeight };
    }

    function getMaxWidth(cn: ComputedNode): number {
      let max = cn.x + cn.width;
      cn.children.forEach(c => max = Math.max(max, getMaxWidth(c)));
      return max;
    }

    const roots: ComputedNode[] = [];
    let currentY = 20;
    
    if (data.name === 'Wand' && data.children && data.children.length > 0) {
       for (const child of data.children) {
          const { cNode, totalHeight } = layout(child, 20, currentY + CAST_HEADER_HEIGHT);
          roots.push(cNode);
          currentY += totalHeight + CAST_HEADER_HEIGHT + VERTICAL_GAP * 2;
       }
    } else {
       const { cNode, totalHeight } = layout(data, 20, currentY);
       roots.push(cNode);
       currentY += totalHeight + VERTICAL_GAP;
    }
    
    let tw = 0;
    roots.forEach(r => tw = Math.max(tw, getMaxWidth(r)));

    return { roots, totalHeight: currentY, totalWidth: tw };
  }, [data, spellDb]);

  // Redraw logic
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !computedLayout) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // High DPI Support - Use higher multiplier for crisper text on zoom
    const dpr = Math.max(2, window.devicePixelRatio || 1);
    const logicalWidth = Math.max(800, computedLayout.totalWidth + 100);
    const logicalHeight = Math.max(600, computedLayout.totalHeight + 100);

    canvas.width = logicalWidth * dpr;
    canvas.height = logicalHeight * dpr;
    canvas.style.width = `${logicalWidth}px`;
    canvas.style.height = `${logicalHeight}px`;

    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, logicalWidth, logicalHeight);

    function drawNode(cn: ComputedNode, ctx: CanvasRenderingContext2D) {
      const { node, x, y, width, height, isCast } = cn;
      const spell = spellDb[node.name];
      const isHovered = hoverNode?.node === node;

      // 1. Connection lines to children
      if (cn.children.length > 0) {
        ctx.strokeStyle = '#27272a'; // Zinc-800
        ctx.lineWidth = 1;
        
        const startX = x + width;
        const startY = y + height / 2;
        
        // Vertical line
        if (cn.children.length > 1) {
          const firstChild = cn.children[0];
          const lastChild = cn.children[cn.children.length - 1];
          ctx.beginPath();
          ctx.moveTo(startX + HORIZONTAL_GAP/2, firstChild.y + height/2);
          ctx.lineTo(startX + HORIZONTAL_GAP/2, lastChild.y + height/2);
          ctx.stroke();
        }

        // Horizontal lines to children
        cn.children.forEach(child => {
          ctx.beginPath();
          ctx.moveTo(startX, startY);
          ctx.lineTo(startX + HORIZONTAL_GAP/2, startY);
          ctx.lineTo(startX + HORIZONTAL_GAP/2, child.y + height/2);
          ctx.lineTo(child.x, child.y + height/2);
          ctx.stroke();
          drawNode(child, ctx);
        });
      }

      // 2. Node Box
      ctx.save();
      if (isHovered) {
        ctx.shadowBlur = 15;
        ctx.shadowColor = 'rgba(99, 102, 241, 0.4)';
        ctx.translate(0, -2);
      }

      const isMarked = node.index && node.index.some(idx => markedSlots?.includes(idx));

      // Background
      if (isCast) {
        ctx.fillStyle = 'rgba(99, 102, 241, 0.1)';
        ctx.strokeStyle = isMarked ? '#f59e0b' : 'rgba(99, 102, 241, 0.3)';
        ctx.lineWidth = isMarked ? 2 : 1;
      } else {
        ctx.fillStyle = '#111114'; // Zinc-900 like
        ctx.strokeStyle = isMarked ? '#f59e0b' : 'rgba(255, 255, 255, 0.1)';
        ctx.lineWidth = isMarked ? 2 : 1;
      }

      if (isHovered) {
        ctx.strokeStyle = '#818cf8'; // Indigo-400
        ctx.fillStyle = 'rgba(99, 102, 241, 0.2)';
      }

      ctx.beginPath();
      ctx.roundRect(x, y, width, height, 4);
      ctx.fill();
      ctx.stroke();

      // 3. Icon Logic (WandDBG style)
      let currentIconUrl = null;
      let badgeText = null;

      if (spell) {
        currentIconUrl = getIconUrl(spell.icon, false);
        
        if (settings.triggerVisualizationMode === 'wanddbg' && cn.children.length > 0) {
           if (node.name.includes('TRIGGER') || node.name.includes('TIMER')) {
              const payloadNode = cn.children.find(c => spellDb[c.node.name]);
              if (payloadNode) {
                 const payloadSpell = spellDb[payloadNode.node.name];
                 currentIconUrl = getIconUrl(payloadSpell.icon, false);
                 badgeText = node.name.includes('TIMER') ? 'Tm' : (node.name.includes('DEATH') ? 'D' : 'T');
              }
           }
        }
      }

      const hasIcon = !!currentIconUrl;
      const showText = settings.showSpellId || !hasIcon;
      const displayName = showText ? (settings.showSpellId ? node.name : (spell ? (spell.en_name || spell.name || node.name) : node.name)) : '';
      
      let primaryW = 0;
      if (hasIcon) primaryW += ICON_SIZE;
      if (showText) {
          if (hasIcon) primaryW += 4;
          primaryW += ctx.measureText(displayName).width;
      }
      
      let badgeW = 0;
      if (node.count > 1) {
          ctx.font = 'black 10px Inter';
          badgeW = ctx.measureText(`x${node.count}`).width + 8;
          ctx.font = 'bold 10px Inter, sans-serif';
      }
      
      let innerW = primaryW;
      if (badgeW > 0) innerW += 8 + badgeW;
      
      let currentX = x + (width - innerW) / 2;
      
      // Draw Icon
      if (hasIcon) {
        if (currentIconUrl) {
          const img = getCachedImage(currentIconUrl);
          if (img.complete && img.naturalWidth > 0) {
            ctx.imageSmoothingEnabled = false;
            ctx.drawImage(img, currentX, y + (height - ICON_SIZE)/2, ICON_SIZE, ICON_SIZE);
          } else {
            ctx.fillStyle = '#18181b';
            ctx.fillRect(currentX, y + (height - ICON_SIZE)/2, ICON_SIZE, ICON_SIZE);
            img.onload = () => window.dispatchEvent(new CustomEvent('canvas-redraw'));
          }
        }
        
        // Trigger Badge inside Icon
        if (badgeText) {
           ctx.fillStyle = '#2563eb';
           ctx.strokeStyle = 'rgba(96, 165, 250, 0.5)';
           ctx.beginPath();
           const iconY = y + (height - ICON_SIZE)/2;
           ctx.roundRect(currentX + 16, iconY + 16, 14, 14, 2);
           ctx.fill();
           ctx.stroke();
           ctx.fillStyle = '#fff';
           ctx.font = 'black 8px Inter';
           ctx.textAlign = 'center';
           ctx.textBaseline = 'middle';
           ctx.fillText(badgeText, currentX + 23, iconY + 23.5);
           ctx.textBaseline = 'middle'; // reset
        }
        
        currentX += ICON_SIZE;
      }

      // 4. Text and labels
      ctx.fillStyle = isHovered ? '#fff' : (isCast ? '#818cf8' : '#a1a1aa');
      ctx.font = 'bold 10px Inter, sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      if (showText) {
         if (hasIcon) currentX += 4;
         ctx.fillText(displayName, currentX, y + height/2);
         currentX += ctx.measureText(displayName).width;
      }

      // Multiplier xN - inline
      if (node.count > 1) {
        if (primaryW > 0) currentX += 8;
        ctx.fillStyle = '#6366f1';
        ctx.beginPath();
        ctx.roundRect(currentX, y + height/2 - 8, badgeW, 16, 3);
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.font = 'black 10px Inter';
        ctx.textAlign = 'center';
        ctx.fillText(`x${node.count}`, currentX + badgeW/2, y + height/2 + 1);
      }

      // Shot ID @N - top right corner floating
      let shotIdW = 0;
      if (node.shot_id) {
         const shotText = `@${node.shot_id}`;
         shotIdW = Math.max(16, ctx.measureText(shotText).width + 6);
         ctx.fillStyle = '#2563eb';
         ctx.strokeStyle = 'rgba(96, 165, 250, 0.5)';
         ctx.lineWidth = 1;
         ctx.beginPath();
         // DOM: absolute -top-1.5 -right-1.5 => Overlaps border by half
         ctx.roundRect(x + width - shotIdW + 4, y - 8, shotIdW, 14, 2);
         ctx.fill();
         ctx.stroke();
         ctx.fillStyle = '#fff';
         ctx.font = 'black 8px Inter';
         ctx.textAlign = 'center';
         ctx.fillText(shotText, x + width - shotIdW/2 + 4, y - 1);
      }

      // Recursion / Iteration
      ctx.textBaseline = 'middle';
      if (settings.recursionIterationDisplay !== 'none') {
         if (node.iteration !== undefined) {
            ctx.fillStyle = '#a78bfa';
            ctx.font = 'black 10px Inter';
            ctx.textAlign = 'right';
            const itText = settings.recursionIterationDisplay === 'labeled' ? `i${node.iteration}` : node.iteration.toString();
            ctx.fillText(itText, x + width + 2 - (node.shot_id ? shotIdW - 2 : 0), y);
         }
         if (node.recursion !== undefined) {
            ctx.fillStyle = '#34d399';
            ctx.font = 'black 10px Inter';
            ctx.textAlign = 'left';
            const reText = settings.recursionIterationDisplay === 'labeled' ? `r${node.recursion}` : node.recursion.toString();
            ctx.fillText(reText, x - 2, y);
         }
      }

      // Indices - WandEvaluator puts this absolute -bottom-1.5 -right-1 (overflowing the border corner perfectly)
      if (showIndices && node.index && node.index.length > 0) {
         ctx.fillStyle = '#22d3ee'; // Cyan-400
         ctx.font = 'black 10px Inter';
         ctx.textAlign = 'right';
         ctx.textBaseline = 'middle';
         
         ctx.shadowColor = 'rgba(0,0,0,0.8)';
         ctx.shadowBlur = 3;
         const idxText = node.index.map(idx => absoluteToOrdinal?.[idx] ?? idx).join(',');
         ctx.fillText(idxText, x + width + 4, y + height);
         ctx.shadowBlur = 0;
    }

    ctx.restore();
  }

   computedLayout.roots.forEach(r => {
     if (data.name === 'Wand') {
        const hdrY = r.y - 12;
        const totalW = computedLayout.totalWidth;
        
        ctx.save();
        ctx.fillStyle = '#71717a'; // zinc-500
        ctx.font = 'black 10px Inter, sans-serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'bottom';
        
        const castName = r.node.name.toUpperCase();
        ctx.fillText(castName, r.x, hdrY);
        
        const nameW = ctx.measureText(castName).width;
        const nodesCount = countNodes(r.node);
        const countText = `${nodesCount} NODES`.toUpperCase();
        const countW = ctx.measureText(countText).width;
        
        // Separator line
        ctx.beginPath();
        ctx.strokeStyle = '#27272a'; // zinc-800
        ctx.lineWidth = 1;
        ctx.moveTo(r.x + nameW + 12, hdrY - 4);
        ctx.lineTo(totalW - countW - 12, hdrY - 4);
        ctx.stroke();
        
        // Count badge style
        ctx.fillStyle = '#3f3f46'; // zinc-700
        ctx.textAlign = 'right';
        ctx.fillText(countText, totalW, hdrY);
        ctx.restore();
     }
     drawNode(r, ctx);
   });
}, [computedLayout, spellDb, hoverNode, markedSlots, showIndices, absoluteToOrdinal, settings, getIconUrl, getCachedImage]);

  // Hover detection
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!computedLayout || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const scaleX = canvasRef.current.offsetWidth / rect.width;
    const scaleY = canvasRef.current.offsetHeight / rect.height;
    
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;
    setMousePos({ x, y });

    let found: ComputedNode | null = null;
    function check(cn: ComputedNode) {
      if (x >= cn.x && x <= cn.x + cn.width && y >= cn.y && y <= cn.y + cn.height) {
        found = cn;
        return;
      }
      cn.children.forEach(check);
    }
    computedLayout.roots.forEach(check);
    setHoverNode(found);
    if (found) {
      onHover?.((found as ComputedNode).node.index);
    } else {
      onHover?.(null);
    }
  };

  useEffect(() => {
    const redraw = () => window.dispatchEvent(new CustomEvent('canvas-redraw-internal'));
    window.addEventListener('canvas-redraw', redraw);
    return () => window.removeEventListener('canvas-redraw', redraw);
  }, []);

  if (!computedLayout) return null;

  return (
    <div 
      ref={containerRef}
      className="relative w-max h-max bg-black/40 rounded-xl border border-white/5"
      onMouseMove={handleMouseMove}
      onMouseLeave={() => { setHoverNode(null); onHover?.(null); }}
    >
      <canvas
        ref={canvasRef}
        width={computedLayout.totalWidth + 100}
        height={computedLayout.totalHeight + 100}
        style={{ display: 'block', imageRendering: 'pixelated' }}
        onAuxClick={(e) => {
          if (e.button === 1 && hoverNode) {
            e.preventDefault();
            e.stopPropagation();
            onToggleMark?.(hoverNode.node.index);
          }
        }}
        onMouseDown={(e) => {
          if (e.button === 1) {
            e.preventDefault(); // 防止 Windows 中键滚轮图标出现
          }
        }}
      />
      
      {/* Tooltip for extra info */}
      {hoverNode && hoverNode.node.extra && (
        <div 
          className="absolute pointer-events-none z-[9999] bg-zinc-950/95 text-[9px] font-bold px-2 py-1.5 rounded border border-white/20 text-zinc-100 shadow-2xl uppercase tracking-tighter leading-tight whitespace-pre-wrap max-w-[240px]"
          style={{ 
            left: mousePos.x + 10, 
            top: mousePos.y - 10,
            transform: 'translateY(-100%)', // 在鼠标上方显示，类似 WandEvaluator
          }}
        >
          {hoverNode.node.extra}
        </div>
      )}
    </div>
  );
};
