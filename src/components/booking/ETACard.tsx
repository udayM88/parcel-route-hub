import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Truck, Clock, Check, Zap, Star, Info, AlertTriangle } from "lucide-react";
import { getPartnerLogo } from "@/config/partnerLogos";
import { useState } from "react";
import { computeBaseFare } from "@/lib/pricing";

interface CourierData {
  partner_id: string;
  partner_code: string;
  partner_name: string;
  logo_url?: string;
  service_code: string;
  service_name: string;
  price: number;
  tat_days: number;
  is_cod: boolean;
  insurance: boolean;
  delivery_modes?: { express: boolean; standard: boolean };
  rate_id: string;
}

interface ETAData {
  adjusted_days: number;
  delivery_date_earliest: string;
  delivery_date_latest: string;
  delivery_label: string;
  confidence_score: number | null;
  confidence_label: string;
  confidence_color: string;
  risk_factors: string[];
  eta_display: string;
  eta_range: string;
}

interface ETACardProps {
  courierData: CourierData;
  etaData: ETAData | null;
  isSelected: boolean;
  onSelect: () => void;
  platformFee?: number;
  rank?: number;
  rating?: number | null;
  cons?: string[];
  avgDelayDays?: number | null;
  isAssisted?: boolean;
}

/** Column header row rendered once above the list */
export const ETACardHeader = () => (
  <div className="flex items-center gap-2 px-2 sm:px-3 py-2 text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider text-foreground bg-background rounded-lg border border-border select-none">
    {/* Spacer for radio + logo */}
    <div className="w-[60px] shrink-0" />
    {/* Partner */}
    <div className="flex-1 min-w-0 text-left">Partner</div>
    {/* Rating */}
    <div className="w-[42px] text-center shrink-0">★</div>
    {/* ETA */}
    <div className="w-[40px] text-center shrink-0">ETA</div>
    {/* Confidence - hidden on mobile */}
    <div className="hidden sm:flex w-[62px] text-center shrink-0 items-center justify-center gap-0.5">
      <span>Reliability</span>
      <TooltipProvider delayDuration={200}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Info className="h-2.5 w-2.5 text-muted-foreground/60 cursor-help" />
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-[200px] text-xs">
            AI-predicted on-time delivery probability based on route history, weather &amp; courier performance.
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
    {/* Price */}
    <div className="w-[60px] sm:w-[68px] text-right shrink-0">Price</div>
  </div>
);

export const ETACardSkeleton = () => (
  <div className="flex items-center gap-3 p-3 rounded-lg border border-border bg-card animate-pulse">
    <Skeleton className="h-5 w-5 rounded-full shrink-0" />
    <Skeleton className="h-9 w-9 rounded-md shrink-0" />
    <div className="flex-1 space-y-1.5">
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-3 w-16" />
    </div>
    <Skeleton className="h-4 w-10" />
    <Skeleton className="h-4 w-14" />
    <Skeleton className="h-4 w-14" />
    <Skeleton className="h-6 w-16 rounded" />
  </div>
);

const ETACard = ({ courierData, etaData, isSelected, onSelect, platformFee = 0, rank, rating, cons, avgDelayDays, isAssisted = false }: ETACardProps) => {
  const [imageError, setImageError] = useState(false);
  const logo = courierData.logo_url || getPartnerLogo(courierData.partner_code, courierData.partner_name);
  const hasValidLogo = logo && logo !== "/placeholder.svg" && !imageError;
  const partnerPrice = Math.round(courierData.price || 0);
  const totalPrice = computeBaseFare(courierData.price);

  const days = etaData?.adjusted_days ?? courierData.tat_days;
  const confidenceScore = etaData?.confidence_score;

  // Flag low reliability when either the AI rating or the on-time delay
  // score looks weak. Reason is sourced from AI-aggregated cons.
  const isLowReliability =
    (rating != null && rating < 4) ||
    (avgDelayDays != null && avgDelayDays > 1);
  const reliabilityReasons = (cons || []).filter((c) => c && c.trim()).slice(0, 2);
  const reliabilityReason = reliabilityReasons.length > 0
    ? reliabilityReasons.join(" · ")
    : "Mixed customer feedback on recent shipments.";

  return (
    <div
      onClick={onSelect}
      className={`relative flex items-center gap-2 sm:gap-3 p-2 sm:p-3 rounded-lg border cursor-pointer transition-all ${
        isSelected
          ? "border-primary bg-primary/10 ring-1 ring-primary"
          : "border-border bg-card hover:border-primary/40 hover:bg-accent/50"
      }`}
    >
      {/* Rank badge */}
      {rank === 1 && (
        <div className="absolute -top-2 -left-1 z-10">
          <Badge className="bg-primary text-primary-foreground text-[9px] px-1.5 py-0 border-0 shadow-sm">
            Best
          </Badge>
        </div>
      )}

      {/* Selection circle */}
      <div
        className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
          isSelected ? "border-primary bg-primary" : "border-muted-foreground/30"
        }`}
      >
        {isSelected && <Check className="h-3 w-3 text-primary-foreground" />}
      </div>

      {/* Logo */}
      <div className="w-8 h-8 sm:w-9 sm:h-9 bg-white rounded-md flex items-center justify-center overflow-hidden border border-border shrink-0">
        {hasValidLogo ? (
          <img
            src={logo}
            alt={courierData.partner_name}
            className="w-6 h-6 sm:w-7 sm:h-7 object-contain"
            onError={() => setImageError(true)}
          />
        ) : (
          <Truck className="h-4 w-4 text-muted-foreground" />
        )}
      </div>

      {/* Partner info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <p className="font-semibold text-xs sm:text-sm truncate">{courierData.partner_name}</p>
          {courierData.delivery_modes?.express && (
            <Zap className="h-3 w-3 text-warning shrink-0" />
          )}
        </div>
        <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5 capitalize truncate">
          {courierData.service_name.replace(/_/g, " ")}
        </p>
        {isLowReliability && (
          <TooltipProvider delayDuration={150}>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={(e) => e.stopPropagation()}
                  className="mt-1 inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-50 px-1.5 py-0.5 text-[9px] sm:text-[10px] font-medium text-amber-800 leading-none"
                >
                  <AlertTriangle className="h-2.5 w-2.5" />
                  Lower reliability
                  <Info className="h-2.5 w-2.5 opacity-70" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-[220px] text-xs">
                <p className="font-semibold mb-0.5">Why this flag?</p>
                <p>{reliabilityReason}</p>
                {avgDelayDays != null && avgDelayDays > 1 && (
                  <p className="mt-1 text-muted-foreground">
                    Avg. delay: {avgDelayDays.toFixed(1)} day{avgDelayDays >= 2 ? "s" : ""} on this route history.
                  </p>
                )}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>


      {/* Rating */}
      <div className="w-[42px] text-center shrink-0">
        {rating != null ? (
          <div className="flex items-center justify-center gap-0.5">
            <Star className="h-3 w-3 text-warning fill-warning" />
            <span className="text-xs font-medium">{rating.toFixed(1)}</span>
          </div>
        ) : (
          <span className="text-[10px] text-muted-foreground">—</span>
        )}
      </div>

      {/* ETA */}
      <div className="w-[40px] text-center shrink-0">
        <div className="flex items-center justify-center gap-0.5 text-xs sm:text-sm font-medium text-foreground">
          <Clock className="h-3 w-3 text-muted-foreground" />
          <span>{days}d</span>
        </div>
      </div>

      {/* Confidence / Reliability — hidden on mobile */}
      <div className="hidden sm:block w-[62px] text-center shrink-0">
        {confidenceScore !== null && confidenceScore !== undefined ? (
          <div>
            <div className="w-10 h-1.5 rounded-full bg-muted mx-auto overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${confidenceScore}%`,
                  backgroundColor: etaData?.confidence_color || "hsl(var(--primary))",
                }}
              />
            </div>
            <p className="text-[10px] font-medium mt-0.5">{confidenceScore}%</p>
          </div>
        ) : (
          <span className="text-[10px] text-muted-foreground">—</span>
        )}
      </div>

      {/* Price */}
      <div className={`${isAssisted ? "w-[96px] sm:w-[108px]" : "w-[74px] sm:w-[84px]"} shrink-0 text-right`}>
        {retailPrice > totalPrice && (
          <p className="text-[9px] text-muted-foreground line-through leading-none">₹{retailPrice}</p>
        )}
        <span className="text-xs sm:text-sm font-bold bg-foreground text-background px-1.5 sm:px-2 py-0.5 rounded inline-block mt-0.5">
          ₹{totalPrice}
        </span>
        <p className="text-[9px] text-muted-foreground mt-0.5">incl. GST</p>
        {savingsPct > 0 && (
          <p className="text-[9px] font-semibold text-emerald-600 leading-none">Save {savingsPct}%</p>
        )}
        {isAssisted && (
          <p className="text-[9px] font-medium text-amber-700 mt-0.5" title="Actual price quoted by courier partner">
            Partner ₹{partnerPrice}
          </p>
        )}
      </div>

    </div>
  );
};

export default ETACard;
