import { useState, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Star, Clock, Shield, Truck, Check, Zap, ArrowUpDown, Filter } from "lucide-react";
import { getPartnerLogo } from "@/config/partnerLogos";
import { normalizeTatDays } from "@/lib/tat-utils";
import { computeBaseFare, computeRetailPrice, computeSavingsPct } from "@/lib/pricing";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type SortOption = 'price-asc' | 'price-desc' | 'time-asc' | 'rating-desc';
type ModeFilter = 'all' | 'express' | 'standard';

const inferMode = (serviceName: string, deliveryModes?: { express: boolean; standard: boolean }): string => {
  const name = serviceName.toLowerCase();
  if (deliveryModes?.express || name.includes('express') || name.includes('air')) return 'Express';
  return 'Standard';
};

interface Service {
  service_code: string;
  service_name: string;
  tat_days: number;
  is_cod: boolean;
  pickup: boolean;
  delivery: boolean;
  insurance: boolean;
  rate: {
    rate_id: string;
    price: {
      currency: string;
      amount: number;
      type: string;
    };
    description: string;
  };
  delivery_modes?: {
    express: boolean;
    standard: boolean;
  };
}
interface Partner {
  partner_id: string;
  partner_code: string;
  partner_name: string;
  logo_url?: string;
  rating: number;
  is_serviceable: boolean;
  services: Service[];
  capabilities?: any;
  error?: string;
}
interface AIRating {
  rating: number;
  review_count: number;
  summary: string;
  pros: string[];
  cons: string[];
  badges: string[];
}
interface PartnerComparisonTableProps {
  partners: Partner[];
  selectedServiceId: string | null;
  onServiceSelect: (partnerId: string, serviceCode: string, rateId: string) => void;
  ratings: Map<string, AIRating>;
  platformFee?: number;
}
const PartnerComparisonTable = ({
  partners,
  selectedServiceId,
  onServiceSelect,
  ratings,
  platformFee = 50
}: PartnerComparisonTableProps) => {
  const [imageErrors, setImageErrors] = useState<Set<string>>(new Set());

  // Flatten partners with their services for table rows
  const tableRows = partners.flatMap(partner => partner.services.map(service => ({
    partner,
    service,
    serviceId: `${partner.partner_id}_${service.service_code}`,
    price: computeBaseFare(service.rate?.price?.amount || 0),
    aiRating: ratings.get(partner.partner_code)
  })));

  const [sortBy, setSortBy] = useState<SortOption>('price-asc');
  const [modeFilter, setModeFilter] = useState<ModeFilter>('all');

  // Apply filter and sort
  const sortedRows = useMemo(() => {
    let filtered = [...tableRows];
    
    if (modeFilter !== 'all') {
      filtered = filtered.filter(r => {
        const mode = inferMode(r.service.service_name, r.service.delivery_modes).toLowerCase();
        return mode === modeFilter;
      });
    }

    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'price-asc': return a.price - b.price;
        case 'price-desc': return b.price - a.price;
        case 'time-asc': return normalizeTatDays(a.service.tat_days, a.service.service_name) - normalizeTatDays(b.service.tat_days, b.service.service_name);
        case 'rating-desc': return (b.aiRating?.rating || b.partner.rating || 0) - (a.aiRating?.rating || a.partner.rating || 0);
        default: return 0;
      }
    });
    return filtered;
  }, [tableRows, sortBy, modeFilter]);

  // Find lowest price and fastest for badges
  const lowestPrice = Math.min(...tableRows.map(r => r.price));
  const fastestDays = Math.min(...tableRows.map(r => normalizeTatDays(r.service.tat_days, r.service.service_name)));
  const handleImageError = (partnerId: string) => {
    setImageErrors(prev => new Set(prev).add(partnerId));
  };
  const getPartnerImage = (partner: Partner) => {
    const logo = partner.logo_url || getPartnerLogo(partner.partner_code, partner.partner_name);
    if (!logo || logo === "/placeholder.svg" || imageErrors.has(partner.partner_id)) {
      return null;
    }
    return logo;
  };
  return <div className="space-y-3">
      {/* Sort & Filter Controls */}
      <div className="flex flex-wrap gap-2">
        <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}>
          <SelectTrigger className="w-[160px] h-9 text-xs">
            <ArrowUpDown className="h-3 w-3 mr-1" />
            <SelectValue placeholder="Sort by" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="price-asc">Price: Low → High</SelectItem>
            <SelectItem value="price-desc">Price: High → Low</SelectItem>
            <SelectItem value="time-asc">Fastest First</SelectItem>
            <SelectItem value="rating-desc">Highest Rated</SelectItem>
          </SelectContent>
        </Select>
        <Select value={modeFilter} onValueChange={(v) => setModeFilter(v as ModeFilter)}>
          <SelectTrigger className="w-[140px] h-9 text-xs">
            <Filter className="h-3 w-3 mr-1" />
            <SelectValue placeholder="Filter" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Modes</SelectItem>
            <SelectItem value="express">Express</SelectItem>
            <SelectItem value="standard">Standard</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-xl border border-border overflow-hidden bg-card">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50 hover:bg-muted/50">
            <TableHead className="w-12"></TableHead>
            <TableHead>Partner</TableHead>
            <TableHead>Mode</TableHead>
            <TableHead className="text-center">Rating</TableHead>
            <TableHead className="text-center">Delivery</TableHead>
            <TableHead className="text-right">Price <span className="text-[10px] font-normal text-muted-foreground">(incl. GST)</span></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedRows.map(({
          partner,
          service,
          serviceId,
          price,
          aiRating
        }) => {
          const isSelected = selectedServiceId === serviceId;
          const logo = getPartnerImage(partner);
          const displayRating = aiRating?.rating || partner.rating;
          const isLowestPrice = price === lowestPrice;
          const isFastest = service.tat_days === fastestDays;
          return <TableRow key={serviceId} onClick={() => onServiceSelect(partner.partner_id, service.service_code, service.rate?.rate_id)} className={`cursor-pointer transition-colors ${isSelected ? "bg-primary/10 hover:bg-primary/15 border-l-4 border-l-primary" : "hover:bg-muted/50"}`}>
                {/* Selection */}
                <TableCell className="pr-0">
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${isSelected ? "border-primary bg-primary" : "border-muted-foreground/40"}`}>
                    {isSelected && <Check className="h-3 w-3 text-primary-foreground" />}
                  </div>
                </TableCell>

                {/* Partner */}
                <TableCell>
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-white rounded-md flex items-center justify-center overflow-hidden border border-border shrink-0">
                      {logo ? <img src={logo} alt={partner.partner_name} className="w-6 h-6 object-contain" onError={() => handleImageError(partner.partner_id)} /> : <Truck className="h-4 w-4 text-muted-foreground" />}
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate">{partner.partner_name}</p>
                      {(isLowestPrice || isFastest) && <div className="flex gap-1 mt-0.5">
                          {isLowestPrice && <Badge className="bg-success/20 border-0 text-[10px] px-1 py-0 text-primary-foreground">
                              Best Price
                            </Badge>}
                          {isFastest && !isLowestPrice && <Badge className="border-0 text-[10px] px-1 py-0 text-primary-foreground bg-primary-glow">
                              Fastest
                            </Badge>}
                        </div>}
                    </div>
                  </div>
                </TableCell>

                {/* Mode */}
                <TableCell>
                  <p className="text-sm">{inferMode(service.service_name, service.delivery_modes)}</p>
                </TableCell>

                {/* Rating */}
                <TableCell className="text-center">
                  {displayRating > 0 ? <div className="flex items-center justify-center gap-1">
                      <Star className="h-3.5 w-3.5 fill-warning text-warning" />
                      <span className="text-sm font-medium">{displayRating.toFixed(1)}</span>
                    </div> : <span className="text-xs text-muted-foreground">—</span>}
                </TableCell>

                {/* Delivery Time */}
                <TableCell className="text-center">
                  <div className="flex items-center justify-center gap-1 text-sm">
                    <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                    <span>
                      {(() => {
                    const days = normalizeTatDays(service.tat_days, service.service_name);
                    return `${days} ${days === 1 ? "day" : "days"}`;
                  })()}
                    </span>
                  </div>
                </TableCell>

                {/* Price */}
                <TableCell className="text-right">
                  {(() => {
                const rawRate = Math.round(service.rate?.price?.amount || 0);
                const retail = computeRetailPrice(rawRate);
                const savings = computeSavingsPct(retail, price);
                return <div className="inline-flex flex-col items-end gap-0.5">
                        {retail > price && <span className="text-[9px] uppercase tracking-wide text-muted-foreground">Retail outlet rate</span>}
                        {retail > price && <span className="text-sm text-muted-foreground line-through">₹{retail}</span>}
                        <span className="text-sm font-semibold bg-foreground text-background px-2 py-0.5 rounded">₹{price}</span>
                        {savings > 0 && <span className="text-[10px] font-semibold text-emerald-600">Save {savings}%</span>}
                      </div>;
              })()}
                </TableCell>
              </TableRow>;
        })}
        </TableBody>
      </Table>
    </div>
    </div>;
};
export default PartnerComparisonTable;