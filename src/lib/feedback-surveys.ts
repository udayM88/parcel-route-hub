export type SurveyAnswer = string | number | string[];
export type SurveySection = "overall" | "order" | "comparison" | "future";
export type SurveyQuestionType = "nps" | "stars" | "single" | "multi" | "text";
export type SurveyQuestion = { id: string; title: string; helper?: string; section: SurveySection; type: SurveyQuestionType; options?: string[]; required?: boolean; maxLength?: number; otherAnswerKey?: string };
export type SurveyTemplate = { slug: string; formType: "quick" | "detailed" | "custom"; title: string; description: string; estimatedMinutes: number; smsTemplate: string; questions: SurveyQuestion[] };

const satisfaction = ["Very poor", "Poor", "Average", "Good", "Excellent"];

export const quickExperienceSurvey: SurveyTemplate = {
  slug: "quick-order-feedback", formType: "quick", title: "Quick order feedback",
  description: "A short check-in about your latest ViaSetu order and delivery.", estimatedMinutes: 2,
  smsTemplate: "Dear Customer, thank you for placing your order with ViaSetu. We value your feedback and would love to know about your experience. Please share your feedback here: {#var#}",
  questions: [
    { id: "overall_rating", title: "How satisfied are you with your overall ViaSetu experience?", section: "overall", type: "stars", required: true },
    { id: "delivery_rating", title: "How would you rate your delivery experience?", section: "order", type: "single", options: satisfaction, required: true },
    { id: "delivery_timing", title: "Was your order delivered within the expected time?", section: "order", type: "single", options: ["Yes", "No", "Partially"], required: true },
    { id: "ordering_easy", title: "Was it easy to place your order?", section: "order", type: "single", options: ["Yes", "No", "Somewhat"], required: true },
    { id: "improvements", title: "What could we improve?", helper: "Optional", section: "future", type: "text", maxLength: 1000 },
    { id: "nps_score", title: "How likely are you to recommend ViaSetu to a friend or colleague?", helper: "0 means not at all likely; 10 means extremely likely.", section: "future", type: "nps", required: true },
    { id: "comments", title: "Any other suggestion for us?", helper: "Optional", section: "future", type: "text", maxLength: 1500 },
  ],
};

export const detailedExperienceSurvey: SurveyTemplate = {
  slug: "customer-experience", formType: "detailed", title: "Help us serve you better",
  description: "Tell us about your latest ViaSetu order. Your answers help us improve the customer experience.", estimatedMinutes: 5,
  smsTemplate: "Dear Customer, we hope you had a great experience with ViaSetu. Please take a moment to rate your delivery experience. Your feedback helps us improve: {#var#}",
  questions: [
    { id: "overall_rating", title: "How satisfied are you with your overall ViaSetu experience?", section: "overall", type: "stars", required: true },
    { id: "nps_score", title: "How likely are you to recommend ViaSetu to a friend or colleague?", helper: "0 means not at all likely; 10 means extremely likely.", section: "overall", type: "nps", required: true },
    { id: "ordering_issues", title: "Did you face any issue while placing your order?", section: "order", type: "multi", options: ["Website or app was slow", "Products or services were unavailable", "Options were limited", "I had trouble making a payment", "Payment was deducted but order was not confirmed", "The ordering process was confusing", "There were no issues", "Other"], otherAnswerKey: "ordering_issues_other", required: true },
    { id: "delivery_issues", title: "Did you face any issue with the delivery?", section: "order", type: "multi", options: ["The order was delayed", "The delivery executive was not professional", "The delivery executive was difficult to contact", "The order was delivered to the wrong location", "The order had missing items", "The order had incorrect items", "Products were damaged", "Packaging was dirty or damaged", "Product quality was poor", "The order was cancelled unexpectedly", "Tracking information was inaccurate", "There were no issues", "Other"], otherAnswerKey: "delivery_issues_other", required: true },
    { id: "ordering_rating", title: "How satisfied were you with the ordering experience?", section: "order", type: "single", options: satisfaction, required: true },
    { id: "delivery_rating", title: "How satisfied were you with the delivery experience?", section: "order", type: "single", options: satisfaction, required: true },
    { id: "tracking_rating", title: "How satisfied were you with communication and tracking updates?", section: "order", type: "single", options: [...satisfaction, "I did not use tracking"], required: true },
    { id: "support_rating", title: "How would you rate customer support?", section: "order", type: "single", options: ["Excellent", "Good", "Average", "Poor", "Very poor", "I did not contact support"], required: true },
    { id: "delivery_timing", title: "When did your order arrive?", section: "order", type: "single", options: ["On time", "Earlier than expected", "Later than expected", "I was not informed of a delivery time"], required: true },
    { id: "overall_comparison", title: "Compared with another service, how was your overall ViaSetu experience?", section: "comparison", type: "single", options: ["Much better", "Slightly better", "There is no difference", "Slightly worse", "Much worse", "I have not used another service"], required: true },
    { id: "speed_comparison", title: "How did our delivery speed compare?", section: "comparison", type: "single", options: ["ViaSetu was faster", "There was no difference", "ViaSetu was slower", "I have not used another service"], required: true },
    { id: "quality_comparison", title: "How did product or service quality compare?", section: "comparison", type: "single", options: ["ViaSetu was better", "There was no difference", "ViaSetu was poorer", "I have not used another service"], required: true },
    { id: "price_comparison", title: "How did pricing and delivery charges compare?", section: "comparison", type: "single", options: ["ViaSetu was lower", "There was no difference", "ViaSetu was higher", "I have not used another service"], required: true },
    { id: "order_again", title: "How likely are you to order with ViaSetu again?", section: "future", type: "single", options: ["Definitely", "Probably", "Not sure", "Probably not", "Definitely not"], required: true },
    { id: "improve_first", title: "What should ViaSetu improve first?", section: "future", type: "single", options: ["Faster delivery", "Better product quality", "Better pricing", "More options", "A better app or website", "Better tracking updates", "Better customer support", "A better delivery experience", "Other"], otherAnswerKey: "improve_first_other", required: true },
    { id: "contact_consent", title: "May ViaSetu contact you for offers, updates and research?", section: "future", type: "single", options: ["Yes, I agree to be contacted", "No, I do not wish to be contacted"], required: true },
    { id: "comments", title: "Do you have any other comments, questions or concerns?", helper: "Optional", section: "future", type: "text", maxLength: 1500 },
  ],
};

export const customerExperienceSurvey = detailedExperienceSurvey;
export const surveyTemplates = [quickExperienceSurvey, detailedExperienceSurvey];
export const getSurveyTemplate = (slug?: string) => {
  const builtIn = surveyTemplates.find((survey) => survey.slug === slug);
  if (builtIn || !slug || typeof window === "undefined" || !import.meta.env.DEV) return builtIn;
  try {
    const stored = window.localStorage.getItem(`viasetu-survey-preview-${slug}`);
    return stored ? JSON.parse(stored) as SurveyTemplate : undefined;
  } catch {
    return undefined;
  }
};
export const isQuestionAnswered = (question: SurveyQuestion, value: SurveyAnswer | undefined, answers?: Record<string, SurveyAnswer>) => {
  if (question.required && (value === undefined || (Array.isArray(value) ? value.length === 0 : String(value).trim().length === 0))) return false;
  const includesOther = Array.isArray(value) ? value.includes("Other") : value === "Other";
  return !(includesOther && question.otherAnswerKey && !String(answers?.[question.otherAnswerKey] ?? "").trim());
};
