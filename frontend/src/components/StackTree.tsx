import { useState } from 'react';
import { StackTreeNode, ResourceTiming } from '../types';

interface StackTreeProps {
  tree: StackTreeNode;
  failedResources: ResourceTiming[];
  onSelectStack: (stackPath: string) => void;
  selectedStack: string | null;
}

export function StackTree({
  tree,
  failedResources,
  onSelectStack,
  selectedStack,
}: StackTreeProps) {
  return (
    <div className="stack-tree">
      <h2>Stack Hierarchy</h2>
      <div className="tree-container">
        <TreeNode
          node={tree}
          failedResources={failedResources}
          onSelectStack={onSelectStack}
          selectedStack={selectedStack}
        />
      </div>
    </div>
  );
}

interface TreeNodeProps {
  node: StackTreeNode;
  failedResources: ResourceTiming[];
  onSelectStack: (stackPath: string) => void;
  selectedStack: string | null;
}

function TreeNode({
  node,
  failedResources,
  onSelectStack,
  selectedStack,
}: TreeNodeProps) {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = node.children.length > 0;
  const hasFailed = node.failedCount > 0;
  const isSelected = selectedStack === node.stackPath;

  const stackFailures = failedResources.filter(
    (r) => r.stackPath === node.stackPath
  );

  return (
    <div className="tree-node">
      <div
        className={`tree-node-header ${hasFailed ? 'failed' : 'healthy'} ${
          isSelected ? 'selected' : ''
        }`}
        onClick={() => onSelectStack(node.stackPath)}
        role="button"
        tabIndex={0}
        aria-expanded={expanded}
        aria-label={`Stack ${node.name}, ${node.totalResources} resources, ${node.failedCount} failed`}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onSelectStack(node.stackPath);
          }
        }}
      >
        {hasChildren && (
          <button
            className="tree-toggle"
            onClick={(e) => {
              e.stopPropagation();
              setExpanded(!expanded);
            }}
            aria-label={expanded ? 'Collapse' : 'Expand'}
          >
            {expanded ? '▼' : '▶'}
          </button>
        )}
        {!hasChildren && <span className="tree-toggle-spacer" />}

        <span className={`tree-status-dot ${hasFailed ? 'red' : 'green'}`} />

        <span className="tree-node-name">{node.name}</span>

        <span className="tree-node-stats">
          <span className="tree-stat">{node.totalResources} resources</span>
          {hasFailed && (
            <span className="tree-stat failed-stat">
              {node.failedCount} failed
            </span>
          )}
        </span>
      </div>

      {isSelected && stackFailures.length > 0 && (
        <div className="tree-node-failures">
          {stackFailures.map((r, i) => (
            <div key={i} className="inline-failure">
              <span className="inline-failure-name">{r.logicalId}</span>
              <span className="inline-failure-type">{r.resourceType}</span>
            </div>
          ))}
        </div>
      )}

      {expanded && hasChildren && (
        <div className="tree-children">
          {node.children.map((child) => (
            <TreeNode
              key={child.stackPath}
              node={child}
              failedResources={failedResources}
              onSelectStack={onSelectStack}
              selectedStack={selectedStack}
            />
          ))}
        </div>
      )}
    </div>
  );
}
