import { Handle, Position, type NodeProps } from "@xyflow/react";
import type { DeviceFlowNode } from "./types";
import { inHandle, outHandle } from "./types";

export function DeviceNodeView({ data, selected }: NodeProps<DeviceFlowNode>) {
  const { node } = data;
  const ports = node.interfaces;

  return (
    <div className={`dn-node${selected ? " selected" : ""}`} style={{ width: data.width }}>
      <div className="dn-head">
        <div className="dn-icon">{data.icon}</div>
        <div className="dn-title">
          <div className="dn-name" title={node.name}>
            {node.name}
          </div>
          <div className="dn-sub">
            {data.label} · {ports.length} {ports.length === 1 ? "port" : "ports"}
          </div>
        </div>
      </div>

      <div className="dn-ports">
        {ports.map((port) => (
          <div key={port.id} className={`dn-port med-${port.status === "down" ? "down" : port.medium}`}>
            <span
              className={`led ${port.status === "down" ? "" : port.medium === "wireless" ? "wireless" : "up"}`}
              title={port.status === "down" ? "Administratively down" : `${port.medium} · up`}
            />
            <span className="dn-port-name">{port.name}</span>
            <span className="dn-port-ip">{port.ip}</span>
            <Handle type="target" position={Position.Left} id={inHandle(port.id)} className="port-handle" />
            <Handle type="source" position={Position.Right} id={outHandle(port.id)} className="port-handle" />
          </div>
        ))}
      </div>

      {node.notes ? <div className="dn-note">{node.notes}</div> : null}
      <span className="dn-origin" aria-hidden="true" />
    </div>
  );
}
