import { Button } from "@/components/ui/button";
import { ArrowLeftRight } from "lucide-react";

interface PincodeSwapButtonProps {
  onSwap: () => void;
  disabled?: boolean;
  className?: string;
}

/**
 * Small control that reverses pickup <-> delivery pincodes in one click.
 * Used in both the consumer and business booking flows.
 */
const PincodeSwapButton = ({ onSwap, disabled, className }: PincodeSwapButtonProps) => (
  <div className={`flex justify-center ${className || ""}`}>
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={onSwap}
      disabled={disabled}
      className="gap-2"
      aria-label="Swap pickup and delivery pincodes"
    >
      <ArrowLeftRight className="h-4 w-4" />
      Swap pincodes
    </Button>
  </div>
);

export default PincodeSwapButton;
