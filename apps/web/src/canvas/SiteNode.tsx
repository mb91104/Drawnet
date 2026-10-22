import { Handle, Position, type NodeProps } from "@xyflow/react";
import { useProjectStore } from "../store/projectStore";
import type { SiteFlowNode } from "./types";
import { inHandle, outHandle } from "./types";

export function SiteNodeView({ data, selected }: NodeProps<SiteFlowNode>) {
  const { node } = data;
  const enterSite = useProjectStore((s) => s.enterSite);

  return (
    <div className={`dn-node dn-site${selected ? " selected" : ""}`}>
      <div className="dn-head">
        <div className="dn-icon">{data.icon}</div>
        <div className="dn-title">
          <div className="dn-name" title={node.name}>
            {node.name}
          </div>
          <div className="dn-sub">{data.label}</div>
        </div>
      </div>

      <div className="dn-ports">
        {node.boundaryPorts.map((port) => (
          <div key={port.id} className={`dn-port med-${port.status === "down" ? "down" : port.medium}`}>
            <span
              className={`led ${port.status === "down" ? "" : port.medium === "wireless" ? "wireless" : "up"}`}
            />
            <span className="dn-port-name">{port.name}</span>
            <Handle type="target" position={Position.Left} id={inHandle(port.id)} className="port-handle" />
            <Handle type="source" position={Position.Right} id={outHandle(port.id)} className="port-handle" />
          </div>
        ))}
      </div>

      <div className="site-foot">
        <span>
          {data.childDevices} {data.childDevices === 1 ? "device" : "devices"} · {data.childLinks}{" "}
          {data.childLinks === 1 ? "cable" : "cables"}
        </span>
        <button
          type="button"
          className="site-open nodrag"
          onClick={(event) => {
            event.stopPropagation();
            enterSite(node.id);
          }}
        >
          Open →
        </button>
      </div>
      <span className="dn-origin" aria-hidden="true" />
    </div>
  );
}
