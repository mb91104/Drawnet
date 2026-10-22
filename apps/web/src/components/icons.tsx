interface IconProps {
  size?: number;
}

const base = (size = 15) => ({
  width: size,
  height: size,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
});

export function UndoIcon({ size }: IconProps) {
  return (
    <svg {...base(size)}>
      <path d="M9 14 4 9l5-5" />
      <path d="M4 9h10a5 5 0 0 1 5 5v1a5 5 0 0 1-5 5h-3" />
    </svg>
  );
}

export function RedoIcon({ size }: IconProps) {
  return (
    <svg {...base(size)}>
      <path d="m15 14 5-5-5-5" />
      <path d="M20 9H10a5 5 0 0 0-5 5v1a5 5 0 0 0 5 5h3" />
    </svg>
  );
}

export function PlusIcon({ size }: IconProps) {
  return (
    <svg {...base(size)}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

export function FolderIcon({ size }: IconProps) {
  return (
    <svg {...base(size)}>
      <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" />
    </svg>
  );
}

export function SaveIcon({ size }: IconProps) {
  return (
    <svg {...base(size)}>
      <path d="M5 3h11l3 3v15H5z" />
      <path d="M8 3v6h8V3M8 21v-7h8v7" />
    </svg>
  );
}

export function DownloadIcon({ size }: IconProps) {
  return (
    <svg {...base(size)}>
      <path d="M12 3v12m0 0 4-4m-4 4-4-4" />
      <path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
    </svg>
  );
}

export function UploadIcon({ size }: IconProps) {
  return (
    <svg {...base(size)}>
      <path d="M12 15V3m0 0 4 4m-4-4L8 7" />
      <path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
    </svg>
  );
}

export function TrashIcon({ size }: IconProps) {
  return (
    <svg {...base(size)}>
      <path d="M4 7h16M9 7V4h6v3M6 7l1 14h10l1-14" />
      <path d="M10 11v6M14 11v6" />
    </svg>
  );
}

export function GridIcon({ size }: IconProps) {
  return (
    <svg {...base(size)}>
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  );
}

export function SearchIcon({ size }: IconProps) {
  return (
    <svg {...base(size)}>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m16 16 4.5 4.5" />
    </svg>
  );
}

export function ChevronDownIcon({ size }: IconProps) {
  return (
    <svg {...base(size)}>
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

export function CubeIcon({ size }: IconProps) {
  return (
    <svg {...base(size)}>
      <path d="M12 2.8 21 7.6v8.8l-9 4.8-9-4.8V7.6Z" />
      <path d="m3 7.6 9 4.9 9-4.9M12 12.5v8.7" />
    </svg>
  );
}

export function LayersIcon({ size }: IconProps) {
  return (
    <svg {...base(size)}>
      <path d="m12 3 9 5-9 5-9-5Z" />
      <path d="m3 13 9 5 9-5M3 17l9 5 9-5" />
    </svg>
  );
}

export function KeyboardIcon({ size }: IconProps) {
  return (
    <svg {...base(size)}>
      <rect x="2.5" y="5.5" width="19" height="13" rx="2" />
      <path d="M6 9h.01M9 9h.01M12 9h.01M15 9h.01M18 9h.01M6 12.5h.01M9 12.5h.01M12 12.5h.01M15 12.5h.01M18 12.5h.01M8 16h8" />
    </svg>
  );
}

export function MarkIcon({ size }: IconProps) {
  return (
    <svg {...base(size)} viewBox="0 0 24 24">
      <circle cx="6" cy="7" r="2.4" />
      <circle cx="18" cy="7" r="2.4" />
      <circle cx="6" cy="17" r="2.4" />
      <circle cx="18" cy="17" r="2.4" />
      <path d="M8.4 7h7.2M8.4 17h7.2M6 9.4v5.2M18 9.4v5.2" />
    </svg>
  );
}
