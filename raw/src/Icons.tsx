import type { ReactNode } from "react";

function Icon({ children, filled = false }: { children: ReactNode; filled?: boolean }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </svg>
  );
}

export const PinIcon = ({ filled }: { filled: boolean }) => (
  <Icon filled={filled}>
    <path d="M14.8 4.1 20 9.3l-3.2 1.3-3.5 3.5-1 4.6-1.2 1.2-3.3-5.7-4.5-2.6 1.2-1.2 4.6-1 3.5-3.5 1.2-3.1 1-1Z" />
    <path d="m9.1 14.1-5 5" />
  </Icon>
);

export const LockIcon = ({ locked }: { locked: boolean }) => (
  <Icon>
    <rect x="5" y="11" width="14" height="9" rx="2" />
    <path d={locked ? "M8 11V8a4 4 0 0 1 8 0v3" : "M8 11V8a4 4 0 0 1 7.5-2"} />
  </Icon>
);

export const PlusIcon = () => (
  <Icon>
    <path d="M12 5v14M5 12h14" />
  </Icon>
);

export const MinusIcon = () => (
  <Icon>
    <path d="M5 12h14" />
  </Icon>
);

export const MinimizeIcon = () => (
  <Icon>
    <path d="M6 12h12" />
  </Icon>
);

export const CloseIcon = () => (
  <Icon>
    <path d="m6 6 12 12M18 6 6 18" />
  </Icon>
);

// small screen outline with a block marking where the file lands
export const SpotIcon = ({ x, y }: { x: number; y: number }) => (
  <svg aria-hidden="true" viewBox="0 0 24 24">
    <rect x="3" y="5" width="18" height="14" rx="2.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
    <rect x={x} y={y} width="5" height="4" rx="1" fill="currentColor" />
  </svg>
);
