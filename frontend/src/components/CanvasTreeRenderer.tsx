import React, { useEffect, useRef, useMemo, useState } from 'react';
import { EvalNode, SpellDb, AppSettings } from '../types';
import { getIconUrl } from '../lib/evaluatorAdapter';
import { useInView } from 'react-intersection-observer';

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

// 虚拟化画布的一个分块的边长（逻辑像素）
const TILE_SIZE = 2000;

/**
 * 递归计算节点总数（用于 Header 显示）
 */
function countNodes(node: EvalNode): number {
  let count = 1;
  node.children?.forEach((c: EvalNode) => {
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

// ----------------------------------------------------------------------
// CanvasTile: 单个分块的渲染组件
// ----------------------------------------------------------------------
interface CanvasTileProps {
  tileX: number;
  tileY: number;
  width: number;
  height: number;
  dpr: number;
  computedLayout: { roots: ComputedNode[]; totalWidth: number; totalHeight: number };
  data: EvalNode;
  spellDb: SpellDb;
  settings: AppSettings;
  hoverNode: ComputedNode | null;
  markedSlots: number[] | undefined;
  showIndices: boolean | undefined;
  absoluteToOrdinal: Record<number, number> | null | undefined;
}

const CanvasTile: React.FC<CanvasTileProps> = React.memo(({
  tileX, tileY, width, height, dpr, computedLayout, data, spellDb, settings,
  hoverNode, markedSlots, showIndices, absoluteToOrdinal
}) => {
  const { ref, inView } = useInView({
    rootMargin: '100% 100%', // 预加载周围的区块
    triggerOnce: false,
  });

  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!inView || !canvasRef.current || !computedLayout) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set physical size once when mounted
    if (canvas.width !== width * dpr) {
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
    }

    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, width, height);

    // 偏移视口，使得 (0,0) 的绘制对应 Logical 的 (tileX, tileY)
    ctx.translate(-tileX, -tileY);

    const tileRight = tileX + width;
    const tileBottom = tileY + height;

    // --- 绘制节点逻辑 ---
    function drawNode(cn: ComputedNode, ctx: CanvasRenderingContext2D) {
      const { node, x, y, width: nodeW, height: nodeH, subtreeHeight, isCast } = cn;

      // CULLING 剪枝优化：如果完全不在该 Tile 内，则跳过
      // 注意：连线可能会穿过本 Tile，但由于我们这里的 check 并不是完全连线级别的精确剪枝，
      // 对于超级深的子树，我们采用更宽泛的安全校验。
      const safeMargin = 100;
      const isOutsideHorizontal = x > tileRight + safeMargin || x + nodeW < tileX - safeMargin;
      const isOutsideVertical = y > tileBottom + safeMargin || y + subtreeHeight < tileY - safeMargin;

      if (isOutsideHorizontal || isOutsideVertical) {
        return; // 此节点的所有子节点都在右侧/下侧/上侧，不再进入
      }

      const spell = spellDb[node.name];
      const isHovered = hoverNode?.node === node;

      // 1. Connection lines to children
      if (cn.children.length > 0) {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.55)';
        ctx.lineWidth = 1;

        const startX = x + nodeW;
        const startY = y + nodeH / 2;

        if (cn.children.length > 1) {
          const firstChild = cn.children[0];
          const lastChild = cn.children[cn.children.length - 1];
          // 垂直连线是否在本 Tile 可见范围内？
          const lineMinY = firstChild.y + nodeH / 2;
          const lineMaxY = lastChild.y + nodeH / 2;
          const lineX = startX + HORIZONTAL_GAP / 2;
          if (lineX >= tileX && lineX <= tileRight && lineMaxY >= tileY && lineMinY <= tileBottom) {
            ctx.beginPath();
            ctx.moveTo(lineX, lineMinY);
            ctx.lineTo(lineX, lineMaxY);
            ctx.stroke();
          }
        }

        cn.children.forEach(child => {
          // 只绘制大概位于本 Tile 或者穿过本 Tile 的水平线
          ctx.beginPath();
          ctx.moveTo(startX, startY);
          ctx.lineTo(startX + HORIZONTAL_GAP / 2, startY);
          ctx.lineTo(startX + HORIZONTAL_GAP / 2, child.y + nodeH / 2);
          ctx.lineTo(child.x, child.y + nodeH / 2);
          ctx.stroke();
          drawNode(child, ctx);
        });
      }

      // 节点本体坐标如果完全不在 Tile 内，则不画 UI（但前面已经处理了它的子节点连线了）
      if (x > tileRight || x + nodeW < tileX || y > tileBottom || y + nodeH < tileY) {
        return;
      }

      // 2. Node Box
      ctx.save();
      if (isHovered) {
        ctx.shadowBlur = 15;
        ctx.shadowColor = 'rgba(99, 102, 241, 0.4)';
        ctx.translate(0, -2);
      }

      const isMarked = node.index && node.index.some((idx: number) => markedSlots?.includes(idx));

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
      ctx.roundRect(x, y, nodeW, nodeH, 4);
      ctx.fill();
      ctx.stroke();

      // 3. Icon Logic (WandDBG style)
      let currentIconUrl = null;
      let badgeText = null;
      const sourceBadge = !isCast && (node.source === 'action' || node.source === 'draw')
        ? (node.source === 'action'
          ? { text: 'A', bg: '#7f1d1d', border: 'rgba(248, 113, 113, 0.5)' }
          : { text: 'D', bg: '#1d4ed8', border: 'rgba(96, 165, 250, 0.5)' })
        : null;

      if (spell) {
        currentIconUrl = getIconUrl(spell.icon, false);

        if (settings.triggerVisualizationMode === 'wanddbg' && cn.children.length > 0) {
          if (node.name.includes('TRIGGER') || node.name.includes('TIMER')) {
            const payloadNode = cn.children.find(c => spellDb[c.node.name]);
            if (payloadNode) {
              const payloadSpell = spellDb[payloadNode.node.name];
              if (payloadSpell) currentIconUrl = getIconUrl(payloadSpell.icon, false);
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

      let currentX = x + (nodeW - innerW) / 2;

      // Draw Icon
      if (hasIcon) {
        if (currentIconUrl) {
          const img = getCachedImage(currentIconUrl);
          if (img.complete && img.naturalWidth > 0) {
            ctx.imageSmoothingEnabled = false;
            ctx.drawImage(img, currentX, y + (nodeH - ICON_SIZE) / 2, ICON_SIZE, ICON_SIZE);
          } else {
            ctx.fillStyle = '#18181b';
            ctx.fillRect(currentX, y + (nodeH - ICON_SIZE) / 2, ICON_SIZE, ICON_SIZE);
            img.onload = () => window.dispatchEvent(new CustomEvent('canvas-redraw'));
          }
        }

        // Source Badge at bottom-left of node
        if (sourceBadge) {
          ctx.fillStyle = sourceBadge.bg;
          ctx.strokeStyle = sourceBadge.border;
          ctx.beginPath();
          ctx.roundRect(x - 2, y + nodeH - 6, 14, 14, 2);
          ctx.fill();
          ctx.stroke();
          ctx.fillStyle = '#fff';
          ctx.font = 'black 8px Inter';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(sourceBadge.text, x + 5, y + nodeH + 1);
          ctx.textBaseline = 'middle';
        }

        // Trigger Badge inside Icon
        if (badgeText) {
          ctx.fillStyle = '#2563eb';
          ctx.strokeStyle = 'rgba(96, 165, 250, 0.5)';
          ctx.beginPath();
          const iconY = y + (nodeH - ICON_SIZE) / 2;
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
        ctx.fillText(displayName, currentX, y + nodeH / 2);
        currentX += ctx.measureText(displayName).width;
      }

      // Multiplier xN
      if (node.count > 1) {
        if (primaryW > 0) currentX += 8;
        ctx.fillStyle = '#6366f1';
        ctx.beginPath();
        ctx.roundRect(currentX, y + nodeH / 2 - 8, badgeW, 16, 3);
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.font = 'black 10px Inter';
        ctx.textAlign = 'center';
        ctx.fillText(`x${node.count}`, currentX + badgeW / 2, y + nodeH / 2 + 1);
      }

      // Shot ID @N
      let shotIdW = 0;
      if (node.shot_id) {
        const shotText = `@${node.shot_id}`;
        shotIdW = Math.max(16, ctx.measureText(shotText).width + 6);
        ctx.fillStyle = '#2563eb';
        ctx.strokeStyle = 'rgba(96, 165, 250, 0.5)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(x + nodeW - shotIdW + 4, y - 8, shotIdW, 14, 2);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#fff';
        ctx.font = 'black 8px Inter';
        ctx.textAlign = 'center';
        ctx.fillText(shotText, x + nodeW - shotIdW / 2 + 4, y - 1);
      }

      // Recursion / Iteration
      ctx.textBaseline = 'middle';
      if (settings.recursionIterationDisplay !== 'none') {
        if (node.iteration !== undefined) {
          ctx.fillStyle = '#a78bfa';
          ctx.font = 'black 10px Inter';
          ctx.textAlign = 'right';
          const itText = settings.recursionIterationDisplay === 'labeled' ? `i${node.iteration}` : node.iteration.toString();
          ctx.fillText(itText, x + nodeW + 2 - (node.shot_id ? shotIdW - 2 : 0), y);
        }
        if (node.recursion !== undefined) {
          ctx.fillStyle = '#34d399';
          ctx.font = 'black 10px Inter';
          ctx.textAlign = 'left';
          const reText = settings.recursionIterationDisplay === 'labeled' ? `r${node.recursion}` : node.recursion.toString();
          ctx.fillText(reText, x - 2, y);
        }
      }

      // Indices
      if (showIndices && node.index && node.index.length > 0) {
        ctx.font = 'black 10px Inter';
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        ctx.shadowColor = 'rgba(0,0,0,0.8)';
        ctx.shadowBlur = 3;
        const idxValues = node.index
          .map((idx: number) => absoluteToOrdinal?.[idx])
          .filter((value): value is number => typeof value === 'number' && value > 0);
        const isAlwaysCastNode = idxValues.length === 0;
        const idxText = (isAlwaysCastNode ? node.index : idxValues).join(',');
        ctx.fillStyle = isAlwaysCastNode ? '#f59e0b' : '#22d3ee';
        ctx.fillText(idxText, x + nodeW + 4, y + nodeH);
        ctx.shadowBlur = 0;
      }

      ctx.restore();
    } // end drawNode

    computedLayout.roots.forEach(r => {
      if (data.name === 'Wand') {
        const hdrY = r.y - 12;
        const tw = computedLayout.totalWidth;

        // 检查 Header 是否在此 Tile 中 (宽泛检查)
        if (hdrY >= tileY - CAST_HEADER_HEIGHT && hdrY <= tileBottom) {
          ctx.save();
          ctx.fillStyle = '#71717a';
          ctx.font = 'black 10px Inter, sans-serif';
          ctx.textAlign = 'left';
          ctx.textBaseline = 'bottom';

          const castName = r.node.name.toUpperCase();
          ctx.fillText(castName, r.x, hdrY);

          const nameW = ctx.measureText(castName).width;
          const nodesCount = countNodes(r.node);
          const countText = `${nodesCount} NODES`.toUpperCase();
          const countW = ctx.measureText(countText).width;

          ctx.beginPath();
          ctx.strokeStyle = '#27272a';
          ctx.lineWidth = 1;
          ctx.moveTo(r.x + nameW + 12, hdrY - 4);
          ctx.lineTo(tw - countW - 12, hdrY - 4);
          ctx.stroke();

          ctx.fillStyle = '#3f3f46';
          ctx.textAlign = 'right';
          ctx.fillText(countText, tw, hdrY);
          ctx.restore();
        }
      }
      drawNode(r, ctx);
    });

    ctx.restore();

  }, [inView, tileX, tileY, width, height, dpr, computedLayout, spellDb, hoverNode, markedSlots, showIndices, absoluteToOrdinal, settings, data.name]);

  return (
    <div
      ref={ref}
      className="absolute box-border pointer-events-none"
      style={{ left: tileX, top: tileY, width, height }}
    >
      {inView && (
        <canvas
          ref={canvasRef}
          style={{ display: 'block', imageRendering: 'pixelated' }}
        />
      )}
    </div>
  );
});


// ----------------------------------------------------------------------
// 主渲染组件
// ----------------------------------------------------------------------
export const CanvasTreeRenderer: React.FC<CanvasTreeRendererProps> = ({ data, spellDb, settings, width = 1200, height = 800, onHover, showIndices, absoluteToOrdinal, markedSlots, onToggleMark }) => {
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
        if (hasIcon) contentWidth += 4;
        contentWidth += ctx!.measureText(displayName).width;
      }

      let badgeW = 0;
      if (node.count > 1) {
        ctx!.font = 'black 10px Inter';
        badgeW = ctx!.measureText(`x${node.count}`).width + 8;
        ctx!.font = 'bold 10px Inter, sans-serif';
      }

      let innerW = contentWidth;
      if (badgeW > 0) innerW += 8 + badgeW;

      return Math.max(40, innerW + 16);
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
    let currentY = 8;

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
  }, [data, spellDb, settings.showSpellId]);

  // Redraw Events
  const [redrawTicket, setRedrawTicket] = useState(0);
  useEffect(() => {
    const redraw = () => setRedrawTicket(t => t + 1);
    window.addEventListener('canvas-redraw', redraw);
    window.addEventListener('canvas-redraw-internal', redraw);
    return () => {
      window.removeEventListener('canvas-redraw', redraw);
      window.removeEventListener('canvas-redraw-internal', redraw);
    };
  }, []);

  // Hover detection
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!computedLayout || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const scaleX = containerRef.current.offsetWidth / rect.width;
    const scaleY = containerRef.current.offsetHeight / rect.height;

    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;
    setMousePos({ x, y });

    let found: ComputedNode | null = null;
    function check(cn: ComputedNode) {
      if (found) return;
      if (y < cn.y - 100 || y > cn.y + cn.subtreeHeight + 100) return;

      if (x >= cn.x && x <= cn.x + cn.width && y >= cn.y && y <= cn.y + cn.height) {
        found = cn;
        return;
      }
      for (let i = 0; i < cn.children.length; i++) {
        if (found) break;
        check(cn.children[i]);
      }
    }
    for (let i = 0; i < computedLayout.roots.length; i++) {
      if (found) break;
      check(computedLayout.roots[i]);
    }
    setHoverNode(found);
    if (found) {
      onHover?.((found as ComputedNode).node.index);
    } else {
      onHover?.(null);
    }
  };

  if (!computedLayout) return null;

  const logicalWidth = Math.max(800, computedLayout.totalWidth + 100);
  const logicalHeight = Math.max(600, computedLayout.totalHeight + 100);
  const dpr = Math.max(2, window.devicePixelRatio || 1);

  // Generate Tile Coordinates
  const tiles = [];
  for (let y = 0; y < logicalHeight; y += TILE_SIZE) {
    for (let x = 0; x < logicalWidth; x += TILE_SIZE) {
      tiles.push({
        x,
        y,
        w: Math.min(TILE_SIZE, logicalWidth - x),
        h: Math.min(TILE_SIZE, logicalHeight - y)
      });
    }
  }

  return (
    <div
      ref={containerRef}
      className="relative bg-black/40 rounded-xl border border-white/5 overflow-hidden"
      style={{ width: logicalWidth, height: logicalHeight, cursor: 'crosshair', minWidth: 'max-content' }}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => { setHoverNode(null); onHover?.(null); }}
      onAuxClick={(e) => {
        if (e.button === 1 && hoverNode) {
          e.preventDefault();
          e.stopPropagation();
          onToggleMark?.(hoverNode.node.index);
        }
      }}
      onMouseDown={(e) => {
        if (e.button === 1) e.preventDefault(); // 防止 Windows 中键滚轮图标出现
      }}
    >
      <div key={redrawTicket} className="absolute inset-0 pointer-events-none">
        {tiles.map(tile => (
          <CanvasTile
            key={`${tile.x}-${tile.y}`}
            tileX={tile.x}
            tileY={tile.y}
            width={tile.w}
            height={tile.h}
            dpr={dpr}
            computedLayout={computedLayout}
            data={data}
            spellDb={spellDb}
            settings={settings}
            hoverNode={hoverNode}
            markedSlots={markedSlots}
            showIndices={showIndices}
            absoluteToOrdinal={absoluteToOrdinal}
          />
        ))}
      </div>

      {/* Tooltip for extra info */}
      {hoverNode && hoverNode.node.extra && (
        <div
          className="absolute pointer-events-none z-[9999] bg-zinc-950/95 text-[9px] font-bold px-2 py-1.5 rounded border border-white/20 text-zinc-100 shadow-2xl uppercase tracking-tighter leading-tight whitespace-pre-wrap max-w-[240px]"
          style={{
            left: mousePos.x + 10,
            top: mousePos.y - 10,
            transform: 'translateY(-100%)', // 在鼠标上方显示
          }}
        >
          {hoverNode.node.extra}
        </div>
      )}
    </div>
  );
};
