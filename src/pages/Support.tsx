import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { 
  ArrowLeft, 
  Phone, 
  MessageCircle, 
  Mail, 
  HelpCircle,
  Star,
  Send
} from "lucide-react";
import PageSeo from "@/components/PageSeo";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import PageBackground from "@/components/PageBackground";
import BottomNav from "@/components/BottomNav";

const Support = () => {
  const [selectedIssue, setSelectedIssue] = useState<string>('');
  const [message, setMessage] = useState('');
  const [orderId, setOrderId] = useState('');
  const [rating, setRating] = useState(0);
  const navigate = useNavigate();
  const { toast } = useToast();

  const commonIssues = [
    "Delivery Delayed",
    "Package Damaged",
    "Wrong Address",
    "Payment Issue",
    "Courier Contact",
    "Track Package",
    "Refund Request",
    "Other"
  ];

  const handleSubmitTicket = () => {
    if (!selectedIssue || !message) {
      toast({
        title: "Missing Information",
        description: "Please select an issue type and describe your problem",
        variant: "destructive"
      });
      return;
    }

    toast({
      title: "Support Ticket Created",
      description: "We'll get back to you within 24 hours",
    });

    setSelectedIssue('');
    setMessage('');
    setOrderId('');
  };

  const handleRatingSubmit = () => {
    if (rating === 0) {
      toast({
        title: "Rating Required",
        description: "Please select a rating before submitting",
        variant: "destructive"
      });
      return;
    }

    toast({
      title: "Thank you for your feedback!",
      description: "Your rating helps us improve our service",
    });

    setRating(0);
  };

  return (
    <div className="min-h-screen relative pb-24 md:pb-4">
      <PageSeo title="Support & Help — Contact ViaSetu" description="Get help with your courier booking, tracking, refunds or account. Reach ViaSetu support by phone, chat or email." path="/support" />
      <PageBackground variant="parcels" opacity={0.8} />
      
      {/* Header */}
      <header className="bg-white/10 backdrop-blur-xl border-b border-white/20 p-4 sticky top-0 z-50">
        <div className="flex items-center gap-3 max-w-md mx-auto">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="text-white hover:bg-white/10">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-xl font-semibold text-white">Support & Help</h1>
        </div>
      </header>

      <div className="p-4 space-y-6 max-w-md mx-auto relative z-10">
        {/* Quick Contact */}
        <Card className="bg-white/10 backdrop-blur-xl border-white/20">
          <CardHeader>
            <CardTitle className="text-white">Need Immediate Help?</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <a
              href="mailto:support@viasetu.com"
              className="flex items-center gap-4 p-4 rounded-xl bg-white/10 border border-white/20 text-white hover:bg-white/20 transition-colors"
            >
              <div className="h-11 w-11 rounded-full bg-[#00A8A8]/20 flex items-center justify-center flex-shrink-0">
                <Mail className="h-5 w-5 text-[#00A8A8]" />
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-[15px]">Email Us</p>
                <p className="text-sm text-white/80 truncate">support@viasetu.com</p>
                <p className="text-xs text-white/60 mt-0.5">We reply within 24 hours</p>
              </div>
            </a>

            <a
              href="tel:+919013999909"
              className="flex items-center gap-4 p-4 rounded-xl bg-white/10 border border-white/20 text-white hover:bg-white/20 transition-colors"
            >
              <div className="h-11 w-11 rounded-full bg-[#00A8A8]/20 flex items-center justify-center flex-shrink-0">
                <Phone className="h-5 w-5 text-[#00A8A8]" />
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-[15px]">Call Us</p>
                <p className="text-sm text-white/80 truncate">+91 90139 99909</p>
                <p className="text-xs text-white/60 mt-0.5">Mon–Sat, 9 AM – 7 PM IST</p>
              </div>
            </a>
          </CardContent>
        </Card>

        {/* Rate Your Experience */}
        <Card className="bg-white/10 backdrop-blur-xl border-white/20">
          <CardHeader>
            <CardTitle className="text-white">Rate Your Experience</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-center gap-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  onClick={() => setRating(star)}
                  className="transition-colors"
                >
                  <Star 
                    className={`h-8 w-8 ${
                      star <= rating 
                        ? 'fill-warning text-warning' 
                        : 'text-white/40'
                    }`} 
                  />
                </button>
              ))}
            </div>
            <Button 
              onClick={handleRatingSubmit}
              disabled={rating === 0}
              className="w-full"
            >
              Submit Rating
            </Button>
          </CardContent>
        </Card>

        {/* Report an Issue */}
        <Card className="bg-white/10 backdrop-blur-xl border-white/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
              <HelpCircle className="h-5 w-5" />
              Report an Issue
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-white/90">Order ID (Optional)</label>
              <Input
                value={orderId}
                onChange={(e) => setOrderId(e.target.value)}
                placeholder="Enter your order ID"
                className="bg-white/20 border-white/30 text-white placeholder:text-white/50"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-white/90">What's the issue?</label>
              <div className="flex flex-wrap gap-2">
                {commonIssues.map((issue) => (
                  <Badge
                    key={issue}
                    variant={selectedIssue === issue ? "default" : "outline"}
                    className={`cursor-pointer ${selectedIssue !== issue ? 'bg-white/10 border-white/30 text-white hover:bg-white/20' : ''}`}
                    onClick={() => setSelectedIssue(issue)}
                  >
                    {issue}
                  </Badge>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-white/90">Describe your problem</label>
              <Textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Please provide details about your issue..."
                rows={4}
                className="bg-white/20 border-white/30 text-white placeholder:text-white/50"
              />
            </div>

            <Button 
              onClick={handleSubmitTicket}
              className="w-full flex items-center gap-2"
            >
              <Send className="h-4 w-4" />
              Submit Support Ticket
            </Button>
          </CardContent>
        </Card>

        {/* FAQ Section */}
        <Card className="bg-white/10 backdrop-blur-xl border-white/20">
          <CardHeader>
            <CardTitle className="text-white">Frequently Asked Questions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {[
              "How can I track my package?",
              "What if my package is delayed?",
              "How do I change delivery address?",
              "What payment methods are accepted?",
              "How do I cancel an order?"
            ].map((faq, index) => (
              <button
                key={index}
                className="w-full text-left p-3 bg-white/10 rounded-lg hover:bg-white/20 transition-colors text-sm text-white"
              >
                {faq}
              </button>
            ))}
          </CardContent>
        </Card>
      </div>
      <BottomNav />
    </div>
  );
};

export default Support;