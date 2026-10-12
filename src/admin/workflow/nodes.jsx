import { Handle, Position } from '@xyflow/react';
import { getDef } from './schema';
import { useUsers } from '../../context/UsersContext';
import { usePicklists } from '../../context/PicklistsContext';

// A node's optional "Step name" (config.label) replaces the generic type name
// as its title, so a graph with many similar steps stays readable.
function NodeCard({ def, config, children }) {
  const name = (config?.label || '').trim();
  return (
    <div className={`wf-node wf-node-${def.kind}`}>
      <div className="wf-node-head">
        <span className="wf-node-icon" style={{ background: def.color }} title={def.label}>{def.icon}</span>
        <div className="wf-node-title">{name || def.label}</div>
        {def.kind === 'trigger' && <span className="wf-node-badge">Start</span>}
      </div>
      {children}
    </div>
  );
}

function NodeSummary({ def, config }) {
  const { users } = useUsers();
  const { getList } = usePicklists();
  let text;
  try { text = def.summary(config, { users, getList }); } catch { text = ''; }
  if (!text) return null;
  return <div className="wf-node-summary">{text}</div>;
}

export function TriggerNode({ data }) {
  const def = getDef(data.actionType);
  return (
    <NodeCard def={def} config={data.config}>
      <p className="wf-node-desc">{def.description}</p>
      <Handle type="source" position={Position.Right} className="wf-handle" />
    </NodeCard>
  );
}

export function ActionNode({ data }) {
  const def = getDef(data.actionType);
  return (
    <NodeCard def={def} config={data.config}>
      <NodeSummary def={def} config={data.config} />
      <Handle type="target" position={Position.Left} className="wf-handle" />
      <Handle type="source" position={Position.Right} className="wf-handle" />
    </NodeCard>
  );
}

export function ConditionNode({ data }) {
  const def = getDef(data.actionType);
  return (
    <NodeCard def={def} config={data.config}>
      <NodeSummary def={def} config={data.config} />
      <Handle type="target" position={Position.Left} className="wf-handle" />
      <div className="wf-branches">
        <span className="wf-branch-true">True</span>
        <span className="wf-branch-false">False</span>
      </div>
      <Handle id="true"  type="source" position={Position.Right} className="wf-handle wf-handle-true"  style={{ top: '58%' }} />
      <Handle id="false" type="source" position={Position.Right} className="wf-handle wf-handle-false" style={{ top: '78%' }} />
    </NodeCard>
  );
}

export const nodeTypes = { trigger: TriggerNode, action: ActionNode, condition: ConditionNode };