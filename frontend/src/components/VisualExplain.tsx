"use client";

import React, { useEffect } from 'react';
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  MarkerType,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle, Info, Bot } from 'lucide-react';
import { Button } from './ui/button';

export function VisualExplain({ 
  plan, 
  query, 
  connectionId, 
  optimization, 
  isOptimizing,
  onOptimize 
}: { 
  plan: any, 
  query: string,
  connectionId: string,
  optimization?: any,
  isOptimizing?: boolean,
  onOptimize?: () => void
}) {
  const [nodes, setNodes, onNodesChange] = useNodesState<any>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<any>([]);

  useEffect(() => {
    if (!plan) return;
    
    const newNodes: any[] = [];
    const newEdges: any[] = [];
    
    let yPos = 50;
    
    const parseNode = (data: any, parentId?: string, xPos = 250, level = 0) => {
        const id = `node-${newNodes.length}`;
        let label = "Node";
        let details = "";
        
        if (typeof data === 'object' && data !== null) {
            if (data["Node Type"]) {
                label = data["Node Type"];
                details = `Cost: ${data["Total Cost"] || '?'} \nRows: ${data["Plan Rows"] || '?'}`;
            } else if (data["operatorType"]) { 
                label = data["operatorType"];
                details = `Id: ${data["identifiers"]?.join(', ') || ''}`;
            } else if (data["type"]) {
                label = data["type"];
            } else {
                const keys = Object.keys(data);
                label = keys.length > 0 ? keys[0] : "Data";
                if (keys.length > 0 && typeof data[keys[0]] === 'string') {
                    details = data[keys[0]];
                }
            }
        } else {
            label = String(data);
        }

        const isCostly = typeof data === 'object' && data && (
            (data["Total Cost"] && parseFloat(data["Total Cost"]) > 500) || 
            (label.includes("Seq Scan") && data["Plan Rows"] && parseInt(data["Plan Rows"]) > 1000) ||
            (label.includes("Full") && data["Plan Rows"] && parseInt(data["Plan Rows"]) > 1000)
        );

        newNodes.push({
            id,
            position: { x: xPos + (level % 2 === 0 ? 0 : 150), y: yPos },
            data: { 
                label: (
                    <div className={`p-2 flex flex-col ${isCostly ? 'text-red-500 dark:text-red-400' : ''}`}>
                        <span className="font-bold border-b border-border pb-1 mb-1">{label}</span>
                        <span className="text-xs whitespace-pre-wrap">{details}</span>
                    </div>
                ) 
            },
            style: {
                border: isCostly ? '2px solid rgb(239 68 68)' : '1px solid var(--border)',
                borderRadius: '8px',
                backgroundColor: 'var(--card)',
                color: 'var(--card-foreground)',
                minWidth: '150px'
            }
        });

        yPos += 120;

        if (parentId) {
            newEdges.push({
                id: `e-${parentId}-${id}`,
                source: id,
                target: parentId,
                markerEnd: { type: MarkerType.ArrowClosed, color: isCostly ? 'rgb(239 68 68)' : '#94a3b8' },
                animated: isCostly,
                style: { stroke: isCostly ? 'rgb(239 68 68)' : '#94a3b8' }
            });
        }

        if (typeof data === 'object' && data !== null) {
            if (data["Plans"]) {
                data["Plans"].forEach((child: any) => parseNode(child, id, xPos - 100, level + 1));
            } else if (data["children"]) {
                data["children"].forEach((child: any) => parseNode(child, id, xPos - 100, level + 1));
            }
        }
    };

    let root = plan;
    if (Array.isArray(plan) && plan[0] && plan[0].Plan) {
        root = plan[0].Plan;
    } else if (plan && plan.plan) { // fallback
        root = plan.plan;
    } else if (plan && plan.query) { // elastic
        root = plan.query;
    }

    parseNode(root);

    if (newNodes.length === 0) {
        newNodes.push({
            id: '1', position: {x: 250, y: 150}, data: {label: "Could not parse visual plan"}
        });
    }

    setNodes(newNodes);
    setEdges(newEdges);
  }, [plan, setNodes, setEdges]);

  return (
    <div className="flex flex-col gap-4 h-full w-full min-h-[500px]">
        <div className="flex-1 bg-muted/30 border rounded-xl overflow-hidden relative">
            <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                fitView
                attributionPosition="bottom-right"
                colorMode="system"
            >
                <Background />
                <Controls />
                <MiniMap className="bg-background border-border" maskColor="var(--muted)" nodeColor="var(--primary)" />
            </ReactFlow>
        </div>

        {optimization ? (
            <Card className="border-blue-200 dark:border-blue-900 shadow-sm overflow-y-auto max-h-[40vh]">
                <CardHeader className="bg-blue-50 dark:bg-blue-900/20 pb-3">
                    <CardTitle className="text-base flex items-center gap-2 text-blue-700 dark:text-blue-400">
                        <Bot className="h-5 w-5" />
                        AI Optimization Analysis
                    </CardTitle>
                </CardHeader>
                <CardContent className="pt-4 space-y-4">
                    <div>
                        <h4 className="text-sm font-semibold mb-1 flex items-center gap-1">
                            <AlertTriangle className="h-4 w-4 text-amber-500" />
                            Bottleneck Analysis
                        </h4>
                        <p className="text-sm text-muted-foreground whitespace-pre-wrap">{optimization.analysis}</p>
                    </div>
                    <div>
                        <h4 className="text-sm font-semibold mb-1 flex items-center gap-1">
                            <Info className="h-4 w-4 text-blue-500" />
                            Recommendation
                        </h4>
                        <pre className="bg-muted p-3 rounded-md text-sm overflow-x-auto border border-border/50 font-mono text-blue-600 dark:text-blue-400">
                            {optimization.recommendation}
                        </pre>
                    </div>
                </CardContent>
            </Card>
        ) : (
            <div className="flex justify-end">
                <Button onClick={onOptimize} disabled={isOptimizing} className="gap-2">
                    <Bot className="h-4 w-4" />
                    {isOptimizing ? "Analyzing..." : "Ask AI to Optimize"}
                </Button>
            </div>
        )}
    </div>
  );
}
