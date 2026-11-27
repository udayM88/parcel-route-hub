import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  Check,
  Clock3,
  Heart,
  LockKeyhole,
  PackageCheck,
  ShieldCheck,
  Star,
} from "lucide-react";
import { Helmet } from "react-helmet-async";
import viasetuLogo from "@/assets/merchant-console/viasetu.png";
import { supabase } from "@/integrations/supabase/client";
import {
  getSurveyTemplate,
  isQuestionAnswered,
  type SurveyAnswer,
  type SurveyQuestion,
  type SurveyTemplate,
} from "@/lib/feedback-surveys";

const NPS_COLORS = [
  "#e5484d",
  "#e5484d",
  "#e5484d",
  "#ed7047",
  "#ed7047",
  "#ed7047",
  "#f2ad3d",
  "#f2ad3d",
  "#f2ad3d",
  "#18a66a",
  "#18a66a",
];
const sectionLabels = {
  overall: ["Your overall experience", "Start with the big picture."],
  order: [
    "Ordering and delivery",
    "Tell us what worked and where the journey broke down.",
  ],
  comparison: [
    "How ViaSetu compares",
    "Help us understand where we stand against alternatives.",
  ],
  future: [
    "What happens next",
    "Your priorities will guide our improvement work.",
  ],
} as const;

type CustomerContext = {
  first_name: string;
  order_reference: string;
  expires_at?: string;
};

const Choice = ({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: React.ReactNode;
  onClick: () => void;
}) => (
  <button
    type="button"
    aria-pressed={active}
    onClick={onClick}
    className={`flex min-h-12 w-full items-center gap-3 border px-4 py-3 text-left text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#168e8b] focus-visible:ring-offset-2 ${active ? "border-[#168e8b] bg-[#edf9f8] text-[#103e43]" : "border-[#d8e2e2] bg-white text-[#334b52] hover:border-[#80bfbd]"}`}
  >
    <span
      className={`grid h-5 w-5 shrink-0 place-items-center border ${active ? "border-[#168e8b] bg-[#168e8b] text-white" : "border-[#b9c9cb]"}`}
    >
      {active && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
    </span>
    {children}
  </button>
);

const QuestionField = ({
  question,
  value,
  answers,
  onChange,
  onOtherChange,
}: {
  question: SurveyQuestion;
  value?: SurveyAnswer;
  answers: Record<string, SurveyAnswer>;
  onChange: (value: SurveyAnswer) => void;
  onOtherChange: (key: string, value: string) => void;
}) => {
  if (question.type === "nps")
    return (
      <div>
        <div className="grid grid-cols-6 gap-2 sm:grid-cols-11">
          {Array.from({ length: 11 }, (_, score) => (
            <button
              key={score}
              type="button"
              onClick={() => onChange(score)}
              aria-label={`${score} out of 10`}
              aria-pressed={value === score}
              className={`relative grid aspect-square min-h-11 place-items-center rounded-md border-2 text-sm font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${value === score ? "scale-[1.05] border-[#102f43] bg-white text-[#102f43] shadow-md" : "border-transparent text-white hover:-translate-y-0.5"}`}
              style={{
                backgroundColor: value === score ? "white" : NPS_COLORS[score],
              }}
            >
              {score}
              {value === score && (
                <span
                  className="absolute -bottom-1 h-1.5 w-7 rounded-full"
                  style={{ backgroundColor: NPS_COLORS[score] }}
                />
              )}
            </button>
          ))}
        </div>
        <div className="mt-2 flex justify-between text-xs text-[#6b7d82]">
          <span>Not at all likely</span>
          <span>Extremely likely</span>
        </div>
      </div>
    );

  if (question.type === "stars")
    return (
      <div
        className="flex flex-wrap gap-2"
        role="radiogroup"
        aria-label={question.title}
      >
        {[1, 2, 3, 4, 5].map((rating) => (
          <button
            key={rating}
            type="button"
            role="radio"
            aria-checked={value === rating}
            aria-label={`${rating} star${rating > 1 ? "s" : ""}`}
            onClick={() => onChange(rating)}
            className={`grid h-14 w-14 place-items-center rounded-md border p-3 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#168e8b] ${Number(value) >= rating ? "border-[#e5aa35] bg-[#fff8df] text-[#df9918]" : "border-[#d8e2e2] bg-white text-[#aab9bc]"}`}
          >
            <Star
              className="h-7 w-7"
              fill={Number(value) >= rating ? "currentColor" : "none"}
            />
          </button>
        ))}
      </div>
    );

  if (question.type === "text")
    return (
      <div>
        <textarea
          value={typeof value === "string" ? value : ""}
          maxLength={question.maxLength}
          rows={5}
          onChange={(event) => onChange(event.target.value)}
          placeholder="Write your feedback here…"
          className="w-full resize-y border border-[#cad7d8] bg-white p-4 text-base text-[#15313b] outline-none transition placeholder:text-[#9aabad] focus:border-[#168e8b] focus:ring-4 focus:ring-[#168e8b]/10"
        />
        <p className="mt-2 text-right text-xs text-[#708187]">
          {typeof value === "string" ? value.length : 0} / {question.maxLength}
        </p>
      </div>
    );

  const selected = Array.isArray(value) ? value : [];
  const includesOther = Array.isArray(value)
    ? value.includes("Other")
    : value === "Other";
  return (
    <div>
      <div className="grid gap-2 sm:grid-cols-2">
        {question.options?.map((option) => {
          const active =
            question.type === "multi"
              ? selected.includes(option)
              : value === option;
          return (
            <Choice
              key={option}
              active={active}
              onClick={() => {
                if (question.type === "multi") {
                  if (active)
                    onChange(selected.filter((item) => item !== option));
                  else if (option === "There were no issues")
                    onChange([option]);
                  else
                    onChange([
                      ...selected.filter(
                        (item) => item !== "There were no issues",
                      ),
                      option,
                    ]);
                } else onChange(option);
              }}
            >
              {option}
            </Choice>
          );
        })}
      </div>
      {includesOther && question.otherAnswerKey && (
        <div className="mt-3 border-l-4 border-[#31aaa6] bg-[#f1f9f8] p-3">
          <label
            htmlFor={question.otherAnswerKey}
            className="mb-2 block text-sm font-semibold text-[#23484d]"
          >
            Please tell us more
          </label>
          <input
            id={question.otherAnswerKey}
            value={String(answers[question.otherAnswerKey] ?? "")}
            maxLength={300}
            onChange={(event) =>
              onOtherChange(question.otherAnswerKey!, event.target.value)
            }
            placeholder="Type your answer"
            className="min-h-11 w-full border border-[#b9cece] bg-white px-3 text-sm outline-none focus:border-[#168e8b] focus:ring-4 focus:ring-[#168e8b]/10"
          />
        </div>
      )}
    </div>
  );
};

const FeedbackSurvey = () => {
  const { slug } = useParams();
  const builtInSurvey = getSurveyTemplate(slug);
  const params = useMemo(() => new URLSearchParams(window.location.search), []);
  const token = params.get("token") || "";
  const preview =
    import.meta.env.DEV &&
    params.get("preview") === "1" &&
    Boolean(builtInSurvey);
  const sharedMode =
    (preview && params.get("shared") === "1") || (!preview && !token);
  const startedAt = useRef(Date.now());
  const [answers, setAnswers] = useState<Record<string, SurveyAnswer>>({});
  const [errors, setErrors] = useState<Set<string>>(new Set());
  const [availability, setAvailability] = useState<
    "checking" | "available" | "unavailable"
  >(preview ? "available" : "checking");
  const [customer, setCustomer] = useState<CustomerContext | null>(
    preview && !sharedMode
      ? { first_name: "Customer", order_reference: "PREVIEW01" }
      : null,
  );
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [complete, setComplete] = useState(false);
  const [company, setCompany] = useState("");
  const [survey, setSurvey] = useState<SurveyTemplate | undefined>(
    builtInSurvey,
  );

  useEffect(() => {
    if (preview) return;
    let active = true;
    const request = sharedMode
      ? { action: "public_status", slug }
      : { action: "status", token };
    supabase.functions
      .invoke("feedback-survey", { body: request })
      .then(({ data, error }) => {
        if (!active) return;
        if (error || !data?.available || data.survey?.slug !== slug)
          setAvailability("unavailable");
        else {
          setSurvey({
            slug: data.survey.slug,
            formType: data.survey.form_type || "custom",
            title: data.survey.title,
            description: data.survey.description || "",
            estimatedMinutes: data.survey.estimated_minutes || 3,
            smsTemplate: data.survey.sms_template || "",
            questions: Array.isArray(data.survey.questions)
              ? data.survey.questions
              : [],
          });
          setCustomer(sharedMode ? null : data.customer);
          setAvailability("available");
        }
      })
      .catch(() => {
        if (active) setAvailability("unavailable");
      });
    return () => {
      active = false;
    };
  }, [preview, sharedMode, slug, token]);

  if (availability === "available" && !survey)
    return (
      <main className="grid min-h-screen place-items-center bg-[#eef5f4] p-6">
        <div className="max-w-md text-center">
          <h1 className="text-3xl font-bold text-[#102b3f]">
            Survey not found
          </h1>
          <p className="mt-3 text-[#5e7278]">
            This feedback link is incomplete.
          </p>
          <Link to="/" className="mt-6 inline-flex text-[#0e7f82] underline">
            Return to ViaSetu
          </Link>
        </div>
      </main>
    );
  if (availability !== "available")
    return (
      <main className="grid min-h-screen place-items-center bg-[#eef5f4] p-6">
        <div className="max-w-md text-center">
          <img
            src={viasetuLogo}
            alt="ViaSetu"
            className="mx-auto h-12 w-auto"
          />
          {availability === "checking" ? (
            <>
              <div className="mx-auto mt-10 h-9 w-9 animate-spin rounded-full border-4 border-[#cce5e3] border-t-[#0e8f8a]" />
              <p className="mt-4 text-[#5e7278]">Opening your feedback form…</p>
            </>
          ) : (
            <>
              <LockKeyhole className="mx-auto mt-10 h-10 w-10 text-[#759095]" />
              <h1 className="mt-5 text-3xl font-bold text-[#102b3f]">
                This feedback link is unavailable
              </h1>
              <p className="mt-3 text-[#5e7278]">
                {sharedMode
                  ? "This shared form is paused or has not been enabled by the ViaSetu team."
                  : "The link may have expired, already been used or been replaced by a newer link."}
              </p>
              <Link
                to="/"
                className="mt-6 inline-flex text-[#0e7f82] underline"
              >
                Return to ViaSetu
              </Link>
            </>
          )}
        </div>
      </main>
    );

  const updateAnswer = (id: string, value: SurveyAnswer) => {
    setAnswers((current) => ({ ...current, [id]: value }));
    setErrors((current) => {
      const next = new Set(current);
      next.delete(id);
      return next;
    });
    setSubmitError("");
  };

  const submit = async () => {
    const missing = survey.questions
      .filter(
        (question) =>
          !isQuestionAnswered(question, answers[question.id], answers),
      )
      .map((question) => question.id);
    if (missing.length) {
      setErrors(new Set(missing));
      document
        .getElementById(`question-${missing[0]}`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    setSubmitting(true);
    setSubmitError("");
    const payload = sharedMode
      ? {
          action: "public_submit",
          slug,
          answers,
          source: "shared",
          client_elapsed_ms: Date.now() - startedAt.current,
          company,
        }
      : {
          token,
          answers,
          source: params.get("source") || "web",
          client_elapsed_ms: Date.now() - startedAt.current,
          company,
        };
    try {
      if (preview) {
        const stored = JSON.parse(
          localStorage.getItem("viasetu-survey-preview-responses") || "[]",
        );
        stored.push({
          id: `local-${Date.now()}`,
          survey_id: survey.slug,
          booking_id: sharedMode ? null : "preview",
          answers,
          nps_score:
            answers.nps_score == null ? null : Number(answers.nps_score),
          overall_rating:
            answers.overall_rating == null
              ? null
              : Number(answers.overall_rating),
          source: sharedMode ? "shared" : "preview",
          submitted_at: new Date().toISOString(),
        });
        localStorage.setItem(
          "viasetu-survey-preview-responses",
          JSON.stringify(stored.slice(-100)),
        );
      } else {
        const { data, error } = await supabase.functions.invoke(
          "feedback-survey",
          { body: payload },
        );
        if (error || !data?.success)
          throw new Error(data?.error || "submission_failed");
      }
      setComplete(true);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch {
      setSubmitError(
        sharedMode
          ? "Your response could not be saved. Confirm that this shared form is still active, then try again."
          : "Your response could not be saved. Check that this link is still valid, then try again.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const sections = ["overall", "order", "comparison", "future"] as const;
  return (
    <main className="min-h-screen bg-[#edf4f3] pb-16 text-[#102b3f]">
      <Helmet>
        <title>{survey.title} | ViaSetu</title>
        <meta name="robots" content="noindex,nofollow" />
      </Helmet>
      <header className="border-b border-[#d8e4e3] bg-white">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-5 sm:px-8">
          <img src={viasetuLogo} alt="ViaSetu" className="h-10 w-auto" />
          <span className="flex items-center gap-2 text-xs font-semibold text-[#587075]">
            <ShieldCheck className="h-4 w-4 text-[#148b87]" /> Secure feedback
          </span>
        </div>
      </header>

      {complete ? (
        <section className="mx-auto mt-10 max-w-2xl px-4">
          <div className="border border-[#d4e2e1] bg-white px-6 py-14 text-center shadow-[0_18px_60px_rgba(16,43,63,.08)] sm:px-12">
            <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-[#def5ed] text-[#13865e]">
              <Heart className="h-8 w-8" fill="currentColor" />
            </span>
            <h1 className="mt-7 text-3xl font-bold">
              {sharedMode
                ? "Thank you for your feedback."
                : `Thank you, ${customer?.first_name}.`}
            </h1>
            <p className="mx-auto mt-4 max-w-lg leading-7 text-[#5e7278]">
              {sharedMode
                ? "Your response has been recorded and will help the ViaSetu team improve."
                : `Your feedback for order #${customer?.order_reference} has been recorded. This secure link is now closed.`}
            </p>
            <Link
              to="/"
              className="mt-8 inline-flex min-h-12 items-center bg-[#102b3f] px-7 font-semibold text-white hover:bg-[#173d55]"
            >
              Return to ViaSetu
            </Link>
          </div>
        </section>
      ) : (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
          className="mx-auto mt-7 max-w-4xl px-3 sm:mt-10 sm:px-6"
        >
          <section className="overflow-hidden border border-[#d4e2e1] bg-white shadow-[0_18px_60px_rgba(16,43,63,.08)]">
            <div className="bg-[#102b3f] px-5 py-8 text-white sm:px-10 sm:py-10">
              <p className="text-sm font-semibold text-[#6bd6d0]">
                ViaSetu customer experience
              </p>
              <h1 className="mt-3 text-3xl font-bold leading-tight sm:text-4xl">
                {survey.title}
              </h1>
              <p className="mt-3 max-w-2xl leading-7 text-[#cfdddf]">
                {survey.description}
              </p>
              <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-xs text-[#dce7e9]">
                <span className="flex items-center gap-2">
                  <Clock3 className="h-4 w-4 text-[#6bd6d0]" /> About{" "}
                  {survey.estimatedMinutes} minutes
                </span>
                <span className="flex items-center gap-2">
                  <LockKeyhole className="h-4 w-4 text-[#6bd6d0]" />
                  {sharedMode
                    ? "No login or personal details required"
                    : "One response per secure link"}
                </span>
              </div>
            </div>
            <div className="border-b border-[#d9e5e4] bg-[#f1faf9] px-5 py-4 sm:px-10">
              <div className="flex items-center gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-full bg-white text-[#148b87] shadow-sm">
                  <PackageCheck className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-sm font-bold">
                    {sharedMode
                      ? "Shared feedback form"
                      : `Hi ${customer?.first_name}, this form is linked to your order`}
                  </p>
                  <p className="mt-0.5 text-xs text-[#647a7f]">
                    {sharedMode
                      ? "Share your experience without entering an order number or personal details"
                      : `Order reference #${customer?.order_reference} · No personal details are shown or requested`}
                  </p>
                </div>
              </div>
            </div>

            <div className="px-5 sm:px-10">
              {sections
                .filter((section) =>
                  survey.questions.some(
                    (question) => question.section === section,
                  ),
                )
                .map((section) => {
                  const questions = survey.questions.filter(
                    (question) => question.section === section,
                  );
                  return (
                    <section
                      key={section}
                      className="border-b border-dashed border-[#cfdcdd] py-9 last:border-b-0 sm:py-11"
                    >
                      <div className="mb-8">
                        <h2 className="text-xl font-bold">
                          {sectionLabels[section][0]}
                        </h2>
                        <p className="mt-1 text-sm text-[#6a7c81]">
                          {sectionLabels[section][1]}
                        </p>
                      </div>
                      <div className="space-y-10">
                        {questions.map((question) => {
                          const number =
                            survey.questions.findIndex(
                              (item) => item.id === question.id,
                            ) + 1;
                          const selectedOther =
                            (Array.isArray(answers[question.id]) &&
                              answers[question.id].includes("Other")) ||
                            answers[question.id] === "Other";
                          return (
                            <div
                              key={question.id}
                              id={`question-${question.id}`}
                              className="scroll-mt-6"
                            >
                              <div className="mb-4 flex gap-3">
                                <span className="mt-0.5 w-5 shrink-0 whitespace-nowrap text-sm font-bold tabular-nums text-[#168e8b]">
                                  {String(number).padStart(2, "0")}
                                </span>
                                <div className="min-w-0">
                                  <h3 className="font-bold leading-6">
                                    {question.title}
                                    {question.required && (
                                      <span className="ml-1 text-[#d85248]">
                                        *
                                      </span>
                                    )}
                                  </h3>
                                  {question.helper && (
                                    <p className="mt-1 text-sm text-[#718287]">
                                      {question.helper}
                                    </p>
                                  )}
                                </div>
                              </div>
                              <QuestionField
                                question={question}
                                value={answers[question.id]}
                                answers={answers}
                                onChange={(value) =>
                                  updateAnswer(question.id, value)
                                }
                                onOtherChange={(key, value) =>
                                  updateAnswer(key, value)
                                }
                              />
                              {errors.has(question.id) && (
                                <p
                                  role="alert"
                                  className="mt-3 text-sm font-semibold text-[#b34037]"
                                >
                                  {question.otherAnswerKey && selectedOther
                                    ? "Please describe your Other selection."
                                    : "Please answer this question."}
                                </p>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </section>
                  );
                })}
            </div>

            <label className="absolute -left-[9999px]" aria-hidden="true">
              Company
              <input
                tabIndex={-1}
                autoComplete="off"
                value={company}
                onChange={(event) => setCompany(event.target.value)}
              />
            </label>
            <div className="border-t border-[#d8e4e3] bg-[#f6f9f9] px-5 py-6 sm:flex sm:items-center sm:justify-between sm:px-10">
              <p className="max-w-lg text-xs leading-5 text-[#687b80]">
                {sharedMode
                  ? "Please send one thoughtful response per person. No personal information is requested."
                  : "By sending feedback, you confirm these answers reflect your experience with this order."}
              </p>
              <button
                type="submit"
                disabled={submitting}
                className="mt-4 inline-flex min-h-12 w-full items-center justify-center bg-[#ee5d5d] px-8 font-bold text-white transition hover:bg-[#da4e4e] disabled:cursor-wait disabled:opacity-60 sm:mt-0 sm:w-auto"
              >
                {submitting ? "Saving feedback…" : "Send feedback"}
              </button>
            </div>
            {submitError && (
              <p
                role="alert"
                className="border-t border-[#efc9c4] bg-[#fff1ef] px-5 py-4 text-sm font-semibold text-[#a23c32] sm:px-10"
              >
                {submitError}
              </p>
            )}
          </section>
        </form>
      )}
    </main>
  );
};

export default FeedbackSurvey;
