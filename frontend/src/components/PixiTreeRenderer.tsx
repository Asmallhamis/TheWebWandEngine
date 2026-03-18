import React, { useMemo, useCallback } from 'react';
import { Stage, Container, Sprite, Text, Graphics, useTick } from '@pixi/react';
import * as PIXI from 'pixi.js';
import { EvalNode, SpellDb, AppSettings } from '../types';
import { getIconUrl } from '../lib/evaluatorAdapter';

interface PixiTreeRendererProps {
  data: EvalNode;
  spellDb: SpellDb;
  settings: AppSettings;
  width?: number;
  height?: number;
}

const NODE_WIDTH = 120;
const NODE_HEIGHT = 40;
const HORIZONTAL_GAP = 40;
const VERTICAL_GAP = 10;

interface RenderNode {
  node: EvalNode;
  x: number;
  y: number;
  width: number;
  height: number;
  children: RenderNode[];
  parentLine?: { x1: number; y1: number; x2: number; y2: number };
}

/**
 * Calculates the layout of the tree recursively.
 */
function calculateLayout(
  node: EvalNode,
  x: number,
  startY: number
): { renderNode: RenderNode; totalHeight: number } {
  const childrenRenderNodes: RenderNode[] = [];
  let currentY = startY;

  if (node.children && node.children.length > 0) {
    for (const child of node.children) {
      const { renderNode: childRenderNode, totalHeight: childHeight } = calculateLayout(
        child,
        x + NODE_WIDTH + HORIZONTAL_GAP,
        currentY
      );
      childrenRenderNodes.push(childRenderNode);
      currentY += childHeight + VERTICAL_GAP;
    }
  }

  const totalHeight = Math.max(NODE_HEIGHT, currentY - startY - VERTICAL_GAP);
  const centerY = startY + totalHeight / 2;

  const renderNode: RenderNode = {
    node,
    x,
    y: centerY - NODE_HEIGHT / 2,
    width: NODE_WIDTH,
    height: NODE_HEIGHT,
    children: childrenRenderNodes,
  };

  // Adjust children relative to parent for drawing lines
  childrenRenderNodes.forEach(child => {
    child.parentLine = {
      x1: x + NODE_WIDTH,
      y1: centerY,
      x2: child.x,
      y2: child.y + NODE_HEIGHT / 2
    };
  });

  return { renderNode, totalHeight };
}

const PixiNode: React.FC<{ renderNode: RenderNode; spellDb: SpellDb }> = ({ renderNode, spellDb }) => {
  const { node, x, y, width, height } = renderNode;
  const spell = spellDb[node.name];
  const iconUrl = spell ? getIconUrl(spell.icon, false) : null;
  
  const textStyle = useMemo(() => new PIXI.TextStyle({
    fill: '#ffffff',
    fontSize: 10,
    fontWeight: 'bold',
    fontFamily: 'monospace',
  }), []);

  return (
    <Container x={x} y={y}>
      {/* Background */}
      <Graphics
        draw={useCallback((g: PIXI.Graphics) => {
          g.clear();
          g.beginFill(0x1a1a1a, 0.8);
          g.lineStyle(1, 0x333333, 1);
          g.drawRoundedRect(0, 0, width, height, 4);
          g.endFill();
        }, [width, height])}
      />
      
      {/* Icon */}
      {iconUrl && (
        <Sprite
          image={iconUrl}
          x={4}
          y={4}
          width={32}
          height={32}
        />
      )}

      {/* Text */}
      <Text
        text={node.name.length > 10 ? node.name.substring(0, 8) + '..' : node.name}
        x={iconUrl ? 40 : 8}
        y={14}
        style={textStyle}
      />
      
      {/* Children Lines */}
      {renderNode.children.map((child, i) => (
        <Graphics
          key={i}
          draw={useCallback((g: PIXI.Graphics) => {
            if (child.parentLine) {
              g.clear();
              g.lineStyle(1, 0x444444, 1);
              // Move start point relative to this container (x,y)
              g.moveTo(width, height / 2);
              g.lineTo(child.x - x, (child.y + NODE_HEIGHT / 2) - y);
            }
          }, [width, height, child.x, child.y, x, y])}
        />
      ))}

      {/* Render children nodes */}
      {renderNode.children.map((child, i) => (
        <PixiNode key={i} renderNode={child} spellDb={spellDb} />
      ))}
    </Container>
  );
};

export const PixiTreeRenderer: React.FC<PixiTreeRendererProps> = ({ data, spellDb, settings, width = 800, height = 600 }) => {
  const layout = useMemo(() => calculateLayout(data, 20, 20), [data]);

  return (
    <Stage
      width={width}
      height={height}
      options={{ backgroundColor: 0x050505, antialias: true, resolution: window.devicePixelRatio || 1 }}
    >
      <Container>
        <PixiNode renderNode={layout.renderNode} spellDb={spellDb} />
      </Container>
    </Stage>
  );
};
