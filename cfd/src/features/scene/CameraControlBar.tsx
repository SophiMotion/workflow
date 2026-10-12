import type { CameraCommand } from "./cameraCommands";

type CameraControlBarProps = {
  disabled?: boolean;
  onCommand(command: CameraCommand): void;
};

const COMMANDS: readonly { command: CameraCommand; label: string; symbol: string }[] = [
  { command: "reset", label: "重置三维视角", symbol: "↺" },
  { command: "rotate-left", label: "向左旋转三维视角", symbol: "←" },
  { command: "rotate-right", label: "向右旋转三维视角", symbol: "→" },
  { command: "zoom-in", label: "放大三维视角", symbol: "+" },
  { command: "zoom-out", label: "缩小三维视角", symbol: "−" },
];

export function CameraControlBar({ disabled = false, onCommand }: CameraControlBarProps) {
  return (
    <div className="camera-control-bar" role="group" aria-label="三维视角控制">
      {COMMANDS.map(({ command, label, symbol }) => (
        <button
          type="button"
          aria-label={label}
          disabled={disabled}
          key={command}
          onClick={() => onCommand(command)}
        >
          <span aria-hidden="true">{symbol}</span>
        </button>
      ))}
    </div>
  );
}
