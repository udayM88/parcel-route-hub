import * as React from "react";
import { Eye, EyeOff } from "lucide-react";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type PasswordInputProps = Omit<React.ComponentPropsWithoutRef<typeof Input>, "type"> & {
  visibilityLabel?: string;
};

const PasswordInput = React.forwardRef<HTMLInputElement, PasswordInputProps>(({
  className,
  disabled,
  visibilityLabel = "password",
  ...props
}, ref) => {
  const [visible, setVisible] = React.useState(false);
  const action = visible ? "Hide" : "Show";

  return (
    <div className="relative">
      <Input
        ref={ref}
        type={visible ? "text" : "password"}
        disabled={disabled}
        className={cn("pr-11", className)}
        {...props}
      />
      <button
        type="button"
        aria-label={`${action} ${visibilityLabel}`}
        aria-pressed={visible}
        title={`${action} ${visibilityLabel}`}
        disabled={disabled}
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => setVisible((current) => !current)}
        className="absolute right-1.5 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
      >
        {visible ? <EyeOff className="size-4" aria-hidden="true" /> : <Eye className="size-4" aria-hidden="true" />}
      </button>
    </div>
  );
});

PasswordInput.displayName = "PasswordInput";

export default PasswordInput;
