import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  Check,
  Clipboard,
  Download,
  ExternalLink,
  FileText,
  Link2,
  Mail,
  MessageSquareText,
  Pause,
  Pencil,
  Play,
  Plus,
  Search,
  Send,
  Settings2,
  Smartphone,
  Sparkles,
  Star,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  surveyTemplates,
  type SurveyQuestion,
  type SurveyQuestionType,
} from "@/lib/feedback-surveys";
import type { Json } from "@/integrations/supabase/types";

type SurveyRow = {
  id: string;
  slug: string;
  form_type: "quick" | "detailed" | "custom";
  title: string;
  description: string;
  status: string;
  estimated_minutes: number;
  question_count: number;
  questions: SurveyQuestion[];
  sms_template: string;
  dlt_template_id: string | null;
  email_subject: string;
  email_template: string;
  public_enabled: boolean;
  version: number;
};
type ResponseRow = {
  id: number;
  survey_id: string;
  booking_id: string | null;
  answers: Json;
  nps_score: number | null;
  overall_rating: number | null;
  source: string;
  submitted_at: string;
};
type BookingRow = {
  id: string;
  user_id: string;
  receiver_name: string;
  masked_phone: string;
  masked_email: string;
  has_sms: boolean;
  has_email: boolean;
  status: string | null;
  payment_status: string | null;
  created_at: string;
};
type GeneratedLink = {
  url: string;
  customer: string;
  orderReference: string;
  expiresAt: string;
  maskedPhone?: string;
  maskedEmail?: string;
  sent?: boolean;
  channel?: "sms" | "email";
};
type CampaignRow = {
  id: string;
  name: string;
  channels: string[];
  requested_count: number;
  sent_count: number;
  failed_count: number;
  skipped_count: number;
  status: string;
  created_at: string;
};
type ChannelStatus = { sms: boolean; email: boolean; ai: boolean };
type AiDraft = {
  campaign_name: string;
  email_subject: string;
  email_template: string;
  audience_note: string;
};

const fallbackSurveys: SurveyRow[] = surveyTemplates.map((survey, index) => ({
  id:
    index === 0
      ? "2adff0b3-c853-4e0f-b63c-3791f2245a4d"
      : "19cad4ce-dd52-4055-88d5-b7b809a67678",
  slug: survey.slug,
  form_type: survey.formType,
  title: survey.title,
  description: survey.description,
  status: "published",
  estimated_minutes: survey.estimatedMinutes,
  question_count: survey.questions.length,
  questions: survey.questions,
  sms_template: survey.smsTemplate,
  dlt_template_id: null,
  email_subject: "Tell us about your ViaSetu order",
  email_template:
    "Hi {first_name},\n\nWe would value your feedback about order #{order_reference}. It takes only a few minutes:\n\n{link}\n\nThank you,\nTeam ViaSetu",
  public_enabled: true,
  version: 1,
}));
const emptyQuestion = (position: number): SurveyQuestion => ({
  id: `question_${position}_${Date.now().toString(36)}`,
  title: "",
  section: "order",
  type: "single",
  options: ["Option 1", "Option 2"],
  required: true,
});
const shortOrder = (id: string | null) =>
  id ? id.slice(-8).toUpperCase() : "SHARED";

const SurveyCenter = () => {
  const [surveys, setSurveys] = useState<SurveyRow[]>(fallbackSurveys);
  const [selectedId, setSelectedId] = useState(fallbackSurveys[0].id);
  const [responses, setResponses] = useState<ResponseRow[]>([]);
  const [bookings, setBookings] = useState<BookingRow[]>([]);
  const [campaigns, setCampaigns] = useState<CampaignRow[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [backendReady, setBackendReady] = useState(true);
  const [workingId, setWorkingId] = useState("");
  const [generated, setGenerated] = useState<GeneratedLink | null>(null);
  const [editor, setEditor] = useState<SurveyRow | null>(null);
  const [saving, setSaving] = useState(false);
  const [channels, setChannels] = useState<ChannelStatus>({
    sms: false,
    email: false,
    ai: false,
  });
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkSelection, setBulkSelection] = useState<string[]>([]);
  const [bulkChannels, setBulkChannels] = useState<("sms" | "email")[]>([
    "sms",
  ]);
  const [campaignName, setCampaignName] = useState("");
  const [bulkPreview, setBulkPreview] = useState<Record<string, number> | null>(
    null,
  );
  const [bulkConfirmed, setBulkConfirmed] = useState(false);
  const [bulkWorking, setBulkWorking] = useState(false);
  const [aiWorking, setAiWorking] = useState(false);
  const [aiDraft, setAiDraft] = useState<AiDraft | null>(null);

  const survey = surveys.find((item) => item.id === selectedId) || surveys[0];
  const publicUrl = survey
    ? `${window.location.origin}/feedback/${survey.slug}?source=shared`
    : "";
  const publicPreviewUrl =
    import.meta.env.DEV && survey
      ? `${window.location.origin}/feedback/${survey.slug}?preview=1&shared=1`
      : publicUrl;
  const publicActive =
    backendReady && survey?.public_enabled && survey.status === "published";
  const surveyResponses = useMemo(
    () => responses.filter((row) => row.survey_id === survey?.id),
    [responses, survey?.id],
  );

  const load = useCallback(async () => {
    setLoading(true);
    const [surveyResult, responseResult, audienceResult, campaignResult] =
      await Promise.all([
        supabase
          .from("feedback_surveys")
          .select(
            "id,slug,form_type,title,description,status,estimated_minutes,question_count,questions,sms_template,dlt_template_id,email_subject,email_template,public_enabled,version",
          )
          .order("created_at"),
        supabase
          .from("feedback_responses")
          .select(
            "id,survey_id,booking_id,answers,nps_score,overall_rating,source,submitted_at",
          )
          .order("submitted_at", { ascending: false })
          .limit(500),
        supabase.functions.invoke("feedback-survey", {
          body: { action: "audience_preview", limit: 100 },
        }),
        supabase
          .from("feedback_campaigns")
          .select(
            "id,name,channels,requested_count,sent_count,failed_count,skipped_count,status,created_at",
          )
          .order("created_at", { ascending: false })
          .limit(12),
      ]);
    if (audienceResult.data?.audience)
      setBookings(audienceResult.data.audience as BookingRow[]);
    if (campaignResult.data) setCampaigns(campaignResult.data as CampaignRow[]);
    if (
      surveyResult.error ||
      responseResult.error ||
      !surveyResult.data?.length
    ) {
      setBackendReady(false);
      setSurveys(fallbackSurveys);
      setResponses([]);
    } else {
      setBackendReady(true);
      const order = { quick: 0, detailed: 1, custom: 2 } as const;
      const rows = surveyResult.data
        .map((row) => ({
          ...row,
          form_type: row.form_type as SurveyRow["form_type"],
          questions: row.questions as unknown as SurveyQuestion[],
        }))
        .sort((a, b) => order[a.form_type] - order[b.form_type]);
      setSurveys(rows);
      setResponses(responseResult.data ?? []);
      setSelectedId((current) =>
        rows.some((row) => row.id === current) ? current : rows[0].id,
      );
    }
    setLoading(false);
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!backendReady || !survey?.id) return;
    void supabase.functions
      .invoke("feedback-survey", {
        body: { action: "channel_status", survey_id: survey.id },
      })
      .then(({ data }) => {
        if (data?.channels) setChannels(data.channels as ChannelStatus);
      });
  }, [backendReady, survey?.id]);

  const filteredBookings = useMemo(() => {
    const term = search.trim().toLowerCase();
    const eligible = bookings.filter(
      (booking) => !/cancel|failed|refund/i.test(String(booking.status || "")),
    );
    if (!term) return eligible.slice(0, 8);
    return eligible
      .filter(
        (booking) =>
          booking.id.toLowerCase().includes(term) ||
          booking.receiver_name.toLowerCase().includes(term) ||
          booking.masked_phone.toLowerCase().includes(term) ||
          booking.masked_email.toLowerCase().includes(term),
      )
      .slice(0, 12);
  }, [bookings, search]);
  const metrics = useMemo(() => {
    const nps = surveyResponses
      .map((row) => row.nps_score)
      .filter((score): score is number => score !== null);
    const ratings = surveyResponses
      .map((row) => row.overall_rating)
      .filter((score): score is number => score !== null);
    return {
      total: surveyResponses.length,
      nps: nps.length
        ? Math.round(
            ((nps.filter((score) => score >= 9).length -
              nps.filter((score) => score <= 6).length) /
              nps.length) *
              100,
          )
        : null,
      rating: ratings.length
        ? (
            ratings.reduce((sum, score) => sum + score, 0) / ratings.length
          ).toFixed(1)
        : null,
    };
  }, [surveyResponses]);

  const copy = async (value: string, label: string) => {
    await navigator.clipboard.writeText(value);
    toast.success(`${label} copied`);
  };
  const runInvitation = async (
    booking: BookingRow,
    channel: "link" | "sms" | "email",
  ) => {
    if (!survey) return;
    setWorkingId(`${booking.id}:${channel}`);
    setGenerated(null);
    const { data, error } = await supabase.functions.invoke("feedback-survey", {
      body: {
        action:
          channel === "sms"
            ? "send_invite_sms"
            : channel === "email"
              ? "send_invite_email"
              : "create_invite",
        booking_id: booking.id,
        survey_id: survey.id,
        base_url: window.location.origin,
      },
    });
    setWorkingId("");
    if (data?.token && data?.url)
      setGenerated({
        url: data.url,
        customer: data.customer?.first_name || booking.receiver_name,
        orderReference:
          data.customer?.order_reference || shortOrder(booking.id),
        expiresAt: data.expires_at,
        maskedPhone: data.customer?.masked_phone,
        maskedEmail: data.customer?.masked_email,
        sent: Boolean(data?.sms?.ok || data?.email?.ok),
        channel: channel === "link" ? undefined : channel,
      });
    if (error || !data?.success) {
      const reason =
        data?.sms?.reason ||
        data?.email?.reason ||
        (data?.error === "booking_not_eligible"
          ? "This order is not eligible for feedback"
          : "The feedback invitation could not be completed");
      toast.error(reason);
      return;
    }
    toast.success(
      channel === "sms"
        ? "Feedback SMS accepted by provider"
        : channel === "email"
          ? "Feedback email sent"
          : "Secure customer link created",
    );
  };

  const openBulkCampaign = () => {
    setBulkSelection([]);
    setBulkChannels(channels.sms ? ["sms"] : channels.email ? ["email"] : []);
    setCampaignName(
      `${survey.title} · ${new Date().toLocaleDateString("en-IN")}`,
    );
    setBulkPreview(null);
    setBulkConfirmed(false);
    setAiDraft(null);
    setBulkOpen(true);
  };
  const toggleBulkBooking = (bookingId: string) => {
    setBulkSelection((current) =>
      current.includes(bookingId)
        ? current.filter((id) => id !== bookingId)
        : current.length < 25
          ? [...current, bookingId]
          : current,
    );
    setBulkPreview(null);
    setBulkConfirmed(false);
  };
  const toggleBulkChannel = (channel: "sms" | "email") => {
    setBulkChannels((current) =>
      current.includes(channel)
        ? current.filter((item) => item !== channel)
        : [...current, channel],
    );
    setBulkPreview(null);
    setBulkConfirmed(false);
  };
  const previewBulkCampaign = async () => {
    if (!bulkSelection.length || !bulkChannels.length)
      return toast.error("Select customers and at least one delivery channel");
    setBulkWorking(true);
    const { data, error } = await supabase.functions.invoke("feedback-survey", {
      body: {
        action: "bulk_send",
        dry_run: true,
        survey_id: survey.id,
        booking_ids: bulkSelection,
        channels: bulkChannels,
        campaign_name: campaignName,
        base_url: window.location.origin,
      },
    });
    setBulkWorking(false);
    if (error || !data?.success) {
      const message =
        data?.error === "sms_not_configured"
          ? "Configure the approved DLT SMS template before using SMS"
          : data?.error === "email_not_configured"
            ? "Configure the email service before using email"
            : "Campaign audience could not be verified";
      return toast.error(message);
    }
    setBulkPreview({
      requested: Number(data.requested || 0),
      eligible: Number(data.eligible || 0),
      sms_ready: Number(data.sms_ready || 0),
      email_ready: Number(data.email_ready || 0),
    });
    setBulkConfirmed(false);
  };
  const sendBulkCampaign = async () => {
    if (!bulkPreview || !bulkConfirmed) return;
    setBulkWorking(true);
    const { data, error } = await supabase.functions.invoke("feedback-survey", {
      body: {
        action: "bulk_send",
        survey_id: survey.id,
        booking_ids: bulkSelection,
        channels: bulkChannels,
        campaign_name: campaignName,
        base_url: window.location.origin,
      },
    });
    setBulkWorking(false);
    if (error || !data?.campaign_id) {
      toast.error(
        "Campaign could not be sent. No automatic retry was started.",
      );
      return;
    }
    if (Number(data.failed || 0) > 0)
      toast.warning(
        `Campaign completed with ${data.sent || 0} sent and ${data.failed} failed deliveries`,
      );
    else toast.success(`Campaign sent: ${data.sent || 0} deliveries`);
    setBulkOpen(false);
    await load();
  };
  const requestAiCampaign = async () => {
    setAiWorking(true);
    const { data, error } = await supabase.functions.invoke("feedback-survey", {
      body: { action: "suggest_campaign", survey_id: survey.id },
    });
    setAiWorking(false);
    if (error || !data?.suggestion)
      return toast.error(data?.reason || "AI campaign planner is unavailable");
    const suggestion = data.suggestion as AiDraft;
    setAiDraft(suggestion);
    setCampaignName(suggestion.campaign_name);
    toast.success("AI campaign brief is ready for review");
  };
  const reviewAiEmailCopy = () => {
    if (!aiDraft) return;
    setEditor({
      ...survey,
      email_subject: aiDraft.email_subject,
      email_template: aiDraft.email_template,
      questions: survey.questions.map((question) => ({
        ...question,
        options: question.options ? [...question.options] : undefined,
      })),
    });
    setBulkOpen(false);
  };
  const changeStatus = async () => {
    if (!backendReady || !survey) return;
    const status = survey.status === "published" ? "paused" : "published";
    const { error } = await supabase
      .from("feedback_surveys")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", survey.id);
    if (error) return toast.error("Could not update form status");
    setSurveys((rows) =>
      rows.map((row) => (row.id === survey.id ? { ...row, status } : row)),
    );
    toast.success(status === "published" ? "Form published" : "Form paused");
  };

  const togglePublicLink = async () => {
    if (!backendReady || !survey) return;
    const public_enabled = !survey.public_enabled;
    const { error } = await supabase
      .from("feedback_surveys")
      .update({ public_enabled, updated_at: new Date().toISOString() })
      .eq("id", survey.id);
    if (error) return toast.error("Could not update the shared link");
    setSurveys((rows) =>
      rows.map((row) =>
        row.id === survey.id ? { ...row, public_enabled } : row,
      ),
    );
    toast.success(
      public_enabled ? "Shared link enabled" : "Shared link disabled",
    );
  };

  const openCreate = () =>
    setEditor({
      id: "",
      slug: "",
      form_type: "custom",
      title: "",
      description: "",
      status: "draft",
      estimated_minutes: 3,
      question_count: 1,
      questions: [emptyQuestion(1)],
      sms_template:
        "Thank you for choosing ViaSetu! How was your recent order experience? Share your feedback here: {#var#}",
      dlt_template_id: null,
      email_subject: "Tell us about your ViaSetu order",
      email_template:
        "Hi {first_name},\n\nWe would value your feedback about order #{order_reference}. It takes only a few minutes:\n\n{link}\n\nThank you,\nTeam ViaSetu",
      public_enabled: false,
      version: 1,
    });
  const saveEditor = async () => {
    if (!editor) return;
    if (
      !editor.title.trim() ||
      editor.questions.some((question) => !question.title.trim())
    )
      return toast.error("Add a title for the form and every question");
    if (!editor.sms_template.includes("{#var#}"))
      return toast.error(
        "SMS template must contain {#var#} for the secure link",
      );
    if (
      !editor.email_subject.trim() ||
      !editor.email_template.includes("{link}")
    )
      return toast.error("Email needs a subject and the {link} placeholder");
    if (!backendReady) {
      const slug = editor.slug || `custom-preview-${Date.now().toString(36)}`;
      const row: SurveyRow = {
        ...editor,
        id: editor.id || `local-${Date.now()}`,
        slug,
        form_type: editor.form_type || "custom",
        question_count: editor.questions.length,
      };
      window.localStorage.setItem(
        `viasetu-survey-preview-${slug}`,
        JSON.stringify({
          slug,
          formType: "custom",
          title: row.title,
          description: row.description,
          estimatedMinutes: row.estimated_minutes,
          smsTemplate: row.sms_template,
          questions: row.questions,
        }),
      );
      setSurveys((rows) =>
        editor.id
          ? rows.map((item) => (item.id === row.id ? row : item))
          : [...rows, row],
      );
      setSelectedId(row.id);
      setEditor(null);
      toast.success(
        "Local preview form saved. Lovable publish is still required for live sending.",
      );
      return;
    }
    setSaving(true);
    const action = editor.id ? "update_survey" : "save_survey";
    const payload = { ...editor, question_count: editor.questions.length };
    const { data, error } = await supabase.functions.invoke("feedback-survey", {
      body: { action, survey: payload },
    });
    setSaving(false);
    if (error || !data?.success)
      return toast.error(
        "Could not save the form. Check the questions and DLT settings.",
      );
    const row = {
      ...data.survey,
      form_type: data.survey.form_type as SurveyRow["form_type"],
      questions: data.survey.questions as SurveyQuestion[],
    } as SurveyRow;
    setSurveys((rows) =>
      editor.id
        ? rows.map((item) => (item.id === row.id ? row : item))
        : [...rows, row],
    );
    setSelectedId(row.id);
    setEditor(null);
    toast.success(editor.id ? "Form updated" : "Custom form created");
  };

  const updateQuestion = (index: number, changes: Partial<SurveyQuestion>) =>
    setEditor((current) =>
      current
        ? {
            ...current,
            questions: current.questions.map((question, position) =>
              position === index ? { ...question, ...changes } : question,
            ),
          }
        : current,
    );
  const moveQuestion = (index: number, direction: -1 | 1) =>
    setEditor((current) => {
      if (!current) return current;
      const target = index + direction;
      if (target < 0 || target >= current.questions.length) return current;
      const questions = [...current.questions];
      [questions[index], questions[target]] = [
        questions[target],
        questions[index],
      ];
      return { ...current, questions };
    });
  const removeQuestion = (index: number) =>
    setEditor((current) =>
      current && current.questions.length > 1
        ? {
            ...current,
            questions: current.questions.filter(
              (_, position) => position !== index,
            ),
          }
        : current,
    );

  const exportCsv = () => {
    if (!surveyResponses.length) return toast.info("No responses to export");
    const escape = (value: unknown) =>
      `"${String(value ?? "").replace(/"/g, '""')}"`;
    const csv = [
      "response_id,form,order_reference,submitted_at,source,nps_score,overall_rating,answers",
      ...surveyResponses.map((row) =>
        [
          row.id,
          survey.title,
          shortOrder(row.booking_id),
          row.submitted_at,
          row.source,
          row.nps_score,
          row.overall_rating,
          JSON.stringify(row.answers),
        ]
          .map(escape)
          .join(","),
      ),
    ].join("\n");
    const url = URL.createObjectURL(
      new Blob([csv], { type: "text/csv;charset=utf-8" }),
    );
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${survey.slug}-responses.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  if (!survey) return null;
  return (
    <div className="space-y-6 pt-2 text-[#102b3f]">
      {!backendReady && (
        <div className="border border-[#e2b65a] bg-[#fff8e7] p-4 text-sm text-[#624a16]">
          <p className="font-bold">
            Feedback backend is waiting for Lovable publish
          </p>
          <p className="mt-1">
            Both built-in forms can be previewed locally. Secure links,
            custom-form saving and real SMS sending activate after the migration
            and Edge Function are published.
          </p>
        </div>
      )}

      <section className="border border-[#d8e4e4] bg-white p-5 sm:p-7">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
          <div>
            <p className="text-xs font-bold uppercase tracking-[.18em] text-[#168e8b]">
              Survey centre
            </p>
            <h2 className="mt-2 text-2xl font-bold">Choose a feedback form</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[#65797e]">
              Use Form 1 for a quick response, Form 2 for detailed research, or
              build a reusable custom form.
            </p>
          </div>
          <button
            onClick={openCreate}
            className="inline-flex min-h-11 items-center justify-center gap-2 bg-[#168e8b] px-5 text-sm font-bold text-white"
          >
            <Plus className="h-4 w-4" />
            Create custom form
          </button>
        </div>
        <div className="mt-6 grid gap-3 lg:grid-cols-3">
          {surveys.map((item) => (
            <button
              key={item.id}
              onClick={() => {
                setSelectedId(item.id);
                setGenerated(null);
              }}
              className={`min-h-36 border p-5 text-left transition ${item.id === survey.id ? "border-[#168e8b] bg-[#eff9f8] shadow-[inset_0_0_0_1px_#168e8b]" : "border-[#d8e4e4] hover:border-[#8ebfbd]"}`}
            >
              <div className="flex items-start justify-between gap-3">
                <span className="grid h-10 w-10 place-items-center bg-[#e5f4f3] text-[#168e8b]">
                  <FileText className="h-5 w-5" />
                </span>
                <span
                  className={`px-2 py-1 text-[10px] font-bold uppercase ${item.status === "published" ? "bg-[#dff5ed] text-[#14704f]" : "bg-[#efece4] text-[#665d4e]"}`}
                >
                  {item.status}
                </span>
              </div>
              <p className="mt-4 text-xs font-bold uppercase tracking-wider text-[#73868b]">
                {item.form_type === "custom"
                  ? "Custom form"
                  : item.form_type === "quick"
                    ? "Form 1 · quick"
                    : "Form 2 · detailed"}
              </p>
              <h3 className="mt-1 font-bold">{item.title}</h3>
              <p className="mt-2 text-xs text-[#718287]">
                {item.question_count} questions · about {item.estimated_minutes}{" "}
                min
              </p>
            </button>
          ))}
          <button
            onClick={openCreate}
            className="grid min-h-36 place-items-center border border-dashed border-[#9fbfc0] bg-[#f8fbfb] p-5 text-center text-[#117b78]"
          >
            <span>
              <Plus className="mx-auto h-6 w-6" />
              <span className="mt-2 block font-bold">Create Custom Form</span>
              <span className="mt-1 block text-xs text-[#718287]">
                Your questions, options and DLT template
              </span>
            </span>
          </button>
        </div>
      </section>

      <section className="overflow-hidden border border-[#d8e4e4] bg-white">
        <div className="flex flex-col justify-between gap-5 border-b border-[#e1eaea] bg-[#f3f8f8] p-5 sm:flex-row sm:items-start sm:p-7">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-2xl font-bold">{survey.title}</h2>
              <span className="bg-white px-2 py-1 text-[11px] font-bold text-[#65797e]">
                {survey.form_type}
              </span>
            </div>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[#65797e]">
              {survey.description}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {import.meta.env.DEV && (
              <a
                href={`/feedback/${survey.slug}?preview=1`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-10 items-center gap-2 border border-[#bfd0d1] bg-white px-4 text-sm font-semibold"
              >
                Preview <ExternalLink className="h-4 w-4" />
              </a>
            )}
            <button
              onClick={() =>
                setEditor({
                  ...survey,
                  questions: survey.questions.map((q) => ({
                    ...q,
                    options: q.options ? [...q.options] : undefined,
                  })),
                })
              }
              className="inline-flex min-h-10 items-center gap-2 border border-[#bfd0d1] bg-white px-4 text-sm font-semibold"
            >
              <Pencil className="h-4 w-4" />
              Edit form & messages
            </button>
            <button
              onClick={() => void changeStatus()}
              disabled={!backendReady}
              className="inline-flex min-h-10 items-center gap-2 bg-[#102b3f] px-4 text-sm font-semibold text-white disabled:opacity-50"
            >
              {survey.status === "published" ? (
                <>
                  <Pause className="h-4 w-4" />
                  Pause
                </>
              ) : (
                <>
                  <Play className="h-4 w-4" />
                  Publish
                </>
              )}
            </button>
          </div>
        </div>
        <div className="grid divide-y divide-[#e1eaea] sm:grid-cols-3 sm:divide-x sm:divide-y-0">
          <div className="p-5">
            <div className="flex items-center gap-2 text-xs font-semibold text-[#718187]">
              <MessageSquareText className="h-4 w-4 text-[#168e8b]" />
              Responses
            </div>
            <p className="mt-2 text-3xl font-bold">{metrics.total}</p>
          </div>
          <div className="p-5">
            <div className="flex items-center gap-2 text-xs font-semibold text-[#718187]">
              <Check className="h-4 w-4 text-[#168e8b]" />
              Net Promoter Score
            </div>
            <p className="mt-2 text-3xl font-bold">{metrics.nps ?? "—"}</p>
          </div>
          <div className="p-5">
            <div className="flex items-center gap-2 text-xs font-semibold text-[#718187]">
              <Star className="h-4 w-4 text-[#168e8b]" />
              Average rating
            </div>
            <p className="mt-2 text-3xl font-bold">{metrics.rating ?? "—"}</p>
          </div>
        </div>
      </section>

      <section className="border border-[#9bc9c7] bg-[#eff9f8] p-5 sm:p-7">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <span className="grid h-10 w-10 place-items-center bg-white text-[#168e8b]">
                <Link2 className="h-5 w-5" />
              </span>
              <div>
                <h3 className="text-lg font-bold">Share with anyone</h3>
                <p className="mt-1 text-sm text-[#567075]">
                  Reusable link for your team, WhatsApp groups, email or
                  internal testing.
                </p>
              </div>
              <span
                className={`px-2 py-1 text-[11px] font-bold ${publicActive ? "bg-[#dff5ed] text-[#14704f]" : "bg-[#fff2d2] text-[#735713]"}`}
              >
                {publicActive ? "Accepting responses" : "Disabled"}
              </span>
            </div>
            <div className="mt-5 flex min-w-0 items-center border border-[#b9d6d4] bg-white">
              <p className="min-w-0 flex-1 truncate px-4 py-3 text-sm text-[#405b61]">
                {publicUrl}
              </p>
              <button
                onClick={() => void copy(publicUrl, "Shared link")}
                disabled={!publicActive}
                className="grid h-11 w-11 shrink-0 place-items-center border-l border-[#d2e1e0] text-[#117b78] disabled:text-[#9aabad]"
                aria-label="Copy shared feedback link"
              >
                <Clipboard className="h-4 w-4" />
              </button>
            </div>
            <p className="mt-2 text-xs leading-5 text-[#667d81]">
              Shared responses are labelled separately and never attach
              themselves to an order.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 lg:justify-end">
            <a
              href={publicPreviewUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-11 items-center gap-2 border border-[#168e8b] bg-white px-4 text-sm font-bold text-[#117b78]"
            >
              Open form <ExternalLink className="h-4 w-4" />
            </a>
            <button
              onClick={() => void togglePublicLink()}
              disabled={!backendReady || survey.status !== "published"}
              className="inline-flex min-h-11 items-center gap-2 bg-[#102b3f] px-4 text-sm font-bold text-white disabled:opacity-50"
            >
              {survey.public_enabled ? (
                <Pause className="h-4 w-4" />
              ) : (
                <Play className="h-4 w-4" />
              )}
              {survey.public_enabled
                ? "Disable shared link"
                : "Enable shared link"}
            </button>
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.3fr)_minmax(320px,.7fr)]">
        <div className="border border-[#d8e4e4] bg-white">
          <div className="border-b border-[#e1eaea] p-5 sm:p-6">
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
              <div>
                <h3 className="text-lg font-bold">Customer invitations</h3>
                <p className="mt-1 max-w-2xl text-sm text-[#667a7f]">
                  Create one secure link, send it to the delivery phone by SMS,
                  or use the order account email.
                </p>
              </div>
              <button
                onClick={openBulkCampaign}
                disabled={!backendReady || (!channels.sms && !channels.email)}
                className="inline-flex min-h-10 items-center justify-center gap-2 bg-[#102b3f] px-4 text-sm font-bold text-white disabled:opacity-50"
              >
                <Users className="h-4 w-4" />
                Bulk campaign
              </button>
            </div>
            <label className="relative mt-4 block">
              <Search className="absolute left-3 top-3 h-4 w-4 text-[#7e9195]" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search by customer, masked contact or order ID"
                className="min-h-10 w-full border border-[#cbd9da] pl-10 pr-3 text-sm outline-none focus:border-[#168e8b] focus:ring-4 focus:ring-[#168e8b]/10"
              />
            </label>
          </div>
          <div className="divide-y divide-[#e8eeee]">
            {filteredBookings.map((booking) => (
              <div
                key={booking.id}
                className="grid gap-3 p-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center lg:px-6"
              >
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-bold">{booking.receiver_name}</p>
                    <span className="inline-flex items-center gap-1 bg-[#f1f6f6] px-2 py-1 text-xs text-[#52686f]">
                      <Smartphone className="h-3 w-3" />
                      {booking.masked_phone}
                    </span>
                    <span className="inline-flex items-center gap-1 bg-[#f1f6f6] px-2 py-1 text-xs text-[#52686f]">
                      <Mail className="h-3 w-3" />
                      {booking.masked_email}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-[#718287]">
                    Order #{shortOrder(booking.id)} ·{" "}
                    {booking.status || "Created"} ·{" "}
                    {new Date(booking.created_at).toLocaleDateString("en-IN")}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => void runInvitation(booking, "link")}
                    disabled={!backendReady || Boolean(workingId)}
                    className="inline-flex min-h-10 items-center gap-2 border border-[#168e8b] px-3 text-sm font-bold text-[#117b78] disabled:opacity-50"
                  >
                    <Link2 className="h-4 w-4" />
                    {workingId === `${booking.id}:link`
                      ? "Creating…"
                      : "Create link"}
                  </button>
                  <button
                    onClick={() => void runInvitation(booking, "sms")}
                    disabled={
                      !backendReady ||
                      !channels.sms ||
                      !booking.has_sms ||
                      Boolean(workingId)
                    }
                    title={
                      !channels.sms
                        ? "Configure the approved DLT SMS channel first"
                        : !booking.has_sms
                          ? "This order has no valid delivery phone"
                          : "Send feedback SMS"
                    }
                    className="inline-flex min-h-10 items-center gap-2 bg-[#168e8b] px-3 text-sm font-bold text-white disabled:opacity-50"
                  >
                    <Smartphone className="h-4 w-4" />
                    {workingId === `${booking.id}:sms`
                      ? "Sending…"
                      : "Send SMS"}
                  </button>
                  <button
                    onClick={() => void runInvitation(booking, "email")}
                    disabled={
                      !backendReady ||
                      !channels.email ||
                      !booking.has_email ||
                      Boolean(workingId)
                    }
                    title={
                      !channels.email
                        ? "Configure the email channel first"
                        : !booking.has_email
                          ? "This order account has no valid email"
                          : "Send feedback email"
                    }
                    className="inline-flex min-h-10 items-center gap-2 bg-[#dff2f1] px-3 text-sm font-bold text-[#0c6866] disabled:opacity-50"
                  >
                    <Mail className="h-4 w-4" />
                    {workingId === `${booking.id}:email`
                      ? "Sending…"
                      : "Send email"}
                  </button>
                </div>
              </div>
            ))}
            {!loading && !filteredBookings.length && (
              <p className="p-8 text-center text-sm text-[#718287]">
                No eligible order matches this search.
              </p>
            )}
          </div>
        </div>
        <div className="space-y-6">
          <div
            className={`border p-5 ${generated ? "border-[#8bc9c6] bg-[#eff9f8]" : "border-[#d8e4e4] bg-white"}`}
          >
            <div className="flex items-center gap-2">
              {generated?.channel === "email" ? (
                <Mail className="h-5 w-5 text-[#168e8b]" />
              ) : (
                <Send className="h-5 w-5 text-[#168e8b]" />
              )}
              <h3 className="font-bold">
                {generated?.sent
                  ? generated.channel === "email"
                    ? "Email sent"
                    : "SMS sent"
                  : generated
                    ? "Secure link ready"
                    : "Invitation result"}
              </h3>
            </div>
            {generated ? (
              <>
                <p className="mt-3 text-sm text-[#405b61]">
                  {generated.customer} · Order #{generated.orderReference}
                  {generated.maskedPhone ? ` · ${generated.maskedPhone}` : ""}
                  {generated.maskedEmail ? ` · ${generated.maskedEmail}` : ""}
                </p>
                <p className="mt-3 break-all border border-[#c9dedd] bg-white p-3 text-xs leading-5 text-[#52686f]">
                  {generated.url}
                </p>
                <p className="mt-2 text-xs text-[#718287]">
                  Single use · Expires{" "}
                  {new Date(generated.expiresAt).toLocaleDateString("en-IN")}
                </p>
                <button
                  onClick={() => void copy(generated.url, "Secure link")}
                  className="mt-4 inline-flex min-h-10 w-full items-center justify-center gap-2 bg-[#102b3f] px-4 text-sm font-semibold text-white"
                >
                  <Clipboard className="h-4 w-4" />
                  Copy link
                </button>
              </>
            ) : (
              <p className="mt-3 text-sm leading-6 text-[#718287]">
                Every customer receives a random, one-time URL. Raw customer and
                order IDs are not placed in the link.
              </p>
            )}
          </div>
          <div className="border border-[#d8e4e4] bg-white p-5">
            <div className="flex items-center justify-between gap-3">
              <h3 className="font-bold">Approved DLT SMS</h3>
              <button
                onClick={() =>
                  generated &&
                  void copy(
                    survey.sms_template.replace("{#var#}", generated.url),
                    "SMS message",
                  )
                }
                disabled={!generated}
                className="text-sm font-semibold text-[#117b78] disabled:text-[#9aabad]"
              >
                Copy
              </button>
            </div>
            <p className="mt-3 text-sm leading-6 text-[#52686f]">
              {survey.sms_template.replace(
                "{#var#}",
                generated?.url || "[secure customer link]",
              )}
            </p>
            <div
              className={`mt-4 p-3 text-xs ${survey.dlt_template_id ? "bg-[#eaf7f4] text-[#256159]" : "bg-[#fff7e3] text-[#6b5319]"}`}
            >
              <Settings2 className="mr-2 inline h-4 w-4" />
              {survey.dlt_template_id
                ? `DLT template configured: ${survey.dlt_template_id}`
                : "Add your approved DLT template ID in Edit form & SMS before sending."}
            </div>
          </div>
          <div className="border border-[#d8e4e4] bg-white p-5">
            <div className="flex items-center gap-2">
              <Mail className="h-5 w-5 text-[#168e8b]" />
              <h3 className="font-bold">Email invitation</h3>
            </div>
            <p className="mt-3 text-sm font-semibold text-[#102b3f]">
              {survey.email_subject}
            </p>
            <p className="mt-2 whitespace-pre-line text-sm leading-6 text-[#52686f]">
              {survey.email_template
                .replace("{first_name}", generated?.customer || "Customer")
                .replace(
                  "{order_reference}",
                  generated?.orderReference || "ORDER",
                )
                .replace("{link}", generated?.url || "[secure customer link]")}
            </p>
            <div
              className={`mt-4 p-3 text-xs ${channels.email ? "bg-[#eaf7f4] text-[#256159]" : "bg-[#fff7e3] text-[#6b5319]"}`}
            >
              {channels.email
                ? "Email service ready. Recipient comes from the order account profile."
                : "Configure SMTP before sending email invitations."}
            </div>
          </div>
          <div className="border border-[#bee0de] bg-[#f0f9f8] p-5 text-sm leading-6 text-[#315b60]">
            <p className="font-bold text-[#102b3f]">
              Contact and AI safeguards
            </p>
            <p className="mt-2">
              SMS uses the saved delivery phone. Email uses the saved order
              account email. Bulk campaigns are limited to 25 orders and keep
              masked, auditable delivery records.
            </p>
            <p className="mt-2">
              Gemini receives only form details and aggregate audience counts—no
              customer names, phone numbers, emails or order IDs. Approved DLT
              SMS text is never rewritten by AI.
            </p>
          </div>
        </div>
      </section>

      <section className="border border-[#d8e4e4] bg-white">
        <div className="border-b border-[#e1eaea] p-5 sm:px-6">
          <h3 className="font-bold">Recent campaigns</h3>
          <p className="mt-1 text-xs text-[#718287]">
            Audited SMS and email batches. Recipient details remain masked.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="bg-[#f5f8f8] text-xs text-[#61767b]">
              <tr>
                <th className="px-6 py-3">Campaign</th>
                <th className="px-4 py-3">Channels</th>
                <th className="px-4 py-3">Requested</th>
                <th className="px-4 py-3">Sent</th>
                <th className="px-4 py-3">Failed</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e7eeee]">
              {campaigns.map((campaign) => (
                <tr key={campaign.id}>
                  <td className="px-6 py-3">
                    <p className="font-semibold">{campaign.name}</p>
                    <p className="mt-1 text-xs text-[#718287]">
                      {new Date(campaign.created_at).toLocaleString("en-IN")}
                    </p>
                  </td>
                  <td className="px-4 py-3 capitalize">
                    {campaign.channels.join(" + ")}
                  </td>
                  <td className="px-4 py-3">{campaign.requested_count}</td>
                  <td className="px-4 py-3 font-bold text-[#14704f]">
                    {campaign.sent_count}
                  </td>
                  <td className="px-4 py-3 font-bold text-[#a8423a]">
                    {campaign.failed_count}
                  </td>
                  <td className="px-4 py-3 capitalize">{campaign.status}</td>
                </tr>
              ))}
              {!campaigns.length && (
                <tr>
                  <td
                    colSpan={6}
                    className="px-6 py-8 text-center text-[#718287]"
                  >
                    No bulk campaign has been sent yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="border border-[#d8e4e4] bg-white">
        <div className="flex items-center justify-between border-b border-[#e1eaea] p-5 sm:px-6">
          <div>
            <h3 className="font-bold">Recent responses</h3>
            <p className="mt-1 text-xs text-[#718287]">
              Showing responses for {survey.title}
            </p>
          </div>
          <button
            onClick={exportCsv}
            className="inline-flex min-h-10 items-center gap-2 border border-[#c5d4d5] px-4 text-sm font-semibold"
          >
            <Download className="h-4 w-4" />
            Export CSV
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[680px] text-left text-sm">
            <thead className="bg-[#f5f8f8] text-xs text-[#61767b]">
              <tr>
                <th className="px-6 py-3">Order</th>
                <th className="px-4 py-3">Submitted</th>
                <th className="px-4 py-3">Source</th>
                <th className="px-4 py-3">NPS</th>
                <th className="px-4 py-3">Rating</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e7eeee]">
              {surveyResponses.slice(0, 20).map((row) => (
                <tr key={row.id}>
                  <td className="px-6 py-3 font-semibold">
                    {row.booking_id
                      ? `#${shortOrder(row.booking_id)}`
                      : "Shared link"}
                  </td>
                  <td className="px-4 py-3 text-[#65797e]">
                    {new Date(row.submitted_at).toLocaleString("en-IN")}
                  </td>
                  <td className="px-4 py-3 capitalize">{row.source}</td>
                  <td className="px-4 py-3 font-bold">
                    {row.nps_score ?? "—"}
                  </td>
                  <td className="px-4 py-3">
                    {row.overall_rating ? `${row.overall_rating}/5` : "—"}
                  </td>
                </tr>
              ))}
              {!surveyResponses.length && (
                <tr>
                  <td
                    colSpan={5}
                    className="px-6 py-10 text-center text-[#718287]"
                  >
                    No customer has submitted this form yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {bulkOpen && (
        <div
          className="fixed inset-0 z-[110] overflow-y-auto bg-[#092235]/75 p-3 sm:p-8"
          role="dialog"
          aria-modal="true"
          aria-label="Bulk feedback campaign"
        >
          <div className="mx-auto max-w-6xl bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-[#dce6e6] bg-[#102b3f] px-5 py-5 text-white sm:px-7">
              <div>
                <div className="flex items-center gap-2 text-[#71d5d1]">
                  <Users className="h-5 w-5" />
                  <span className="text-sm font-bold">Bulk campaign</span>
                </div>
                <h2 className="mt-2 text-2xl font-bold">{survey.title}</h2>
                <p className="mt-1 max-w-2xl text-sm text-[#c6d7dc]">
                  Select up to 25 eligible orders. Contacts are resolved and
                  validated on the server immediately before sending.
                </p>
              </div>
              <button
                onClick={() => setBulkOpen(false)}
                aria-label="Close bulk campaign"
                className="grid h-10 w-10 shrink-0 place-items-center border border-white/30"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="grid lg:grid-cols-[minmax(0,1fr)_360px]">
              <div className="border-b border-[#dce6e6] p-5 sm:p-7 lg:border-b-0 lg:border-r">
                <h3 className="font-bold">1. Choose delivery channels</h3>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <button
                    onClick={() => toggleBulkChannel("sms")}
                    disabled={!channels.sms}
                    className={`flex min-h-20 items-center gap-3 border p-4 text-left disabled:opacity-45 ${
                      bulkChannels.includes("sms")
                        ? "border-[#168e8b] bg-[#eff9f8]"
                        : "border-[#d8e4e4]"
                    }`}
                  >
                    <Smartphone className="h-6 w-6 text-[#168e8b]" />
                    <span>
                      <span className="block font-bold">DLT SMS</span>
                      <span className="mt-1 block text-xs text-[#65797e]">
                        Saved delivery phone
                      </span>
                    </span>
                  </button>
                  <button
                    onClick={() => toggleBulkChannel("email")}
                    disabled={!channels.email}
                    className={`flex min-h-20 items-center gap-3 border p-4 text-left disabled:opacity-45 ${
                      bulkChannels.includes("email")
                        ? "border-[#168e8b] bg-[#eff9f8]"
                        : "border-[#d8e4e4]"
                    }`}
                  >
                    <Mail className="h-6 w-6 text-[#168e8b]" />
                    <span>
                      <span className="block font-bold">Email</span>
                      <span className="mt-1 block text-xs text-[#65797e]">
                        Saved order-account email
                      </span>
                    </span>
                  </button>
                </div>

                <div className="mt-7 flex flex-wrap items-end justify-between gap-3">
                  <div>
                    <h3 className="font-bold">2. Select customers</h3>
                    <p className="mt-1 text-xs text-[#718287]">
                      {bulkSelection.length}/25 selected
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        const selected = bookings
                          .filter(
                            (booking) =>
                              (bulkChannels.includes("sms") &&
                                booking.has_sms) ||
                              (bulkChannels.includes("email") &&
                                booking.has_email),
                          )
                          .slice(0, 25)
                          .map((booking) => booking.id);
                        setBulkSelection(selected);
                        setBulkPreview(null);
                        setBulkConfirmed(false);
                      }}
                      className="min-h-9 border border-[#bfd0d1] px-3 text-xs font-bold"
                    >
                      Select ready
                    </button>
                    <button
                      onClick={() => {
                        setBulkSelection([]);
                        setBulkPreview(null);
                        setBulkConfirmed(false);
                      }}
                      className="min-h-9 border border-[#bfd0d1] px-3 text-xs font-bold"
                    >
                      Clear
                    </button>
                  </div>
                </div>
                <div className="mt-3 max-h-[430px] divide-y divide-[#e7eeee] overflow-y-auto border border-[#d8e4e4]">
                  {bookings.map((booking) => {
                    const channelReady =
                      (bulkChannels.includes("sms") && booking.has_sms) ||
                      (bulkChannels.includes("email") && booking.has_email);
                    return (
                      <label
                        key={booking.id}
                        className={`flex cursor-pointer items-start gap-3 p-4 ${
                          channelReady ? "bg-white" : "bg-[#f7f9f9] opacity-60"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={bulkSelection.includes(booking.id)}
                          disabled={!channelReady}
                          onChange={() => toggleBulkBooking(booking.id)}
                          className="mt-1"
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block font-bold">
                            {booking.receiver_name}
                          </span>
                          <span className="mt-1 flex flex-wrap gap-x-3 text-xs text-[#65797e]">
                            <span>#{shortOrder(booking.id)}</span>
                            <span>{booking.masked_phone}</span>
                            <span>{booking.masked_email}</span>
                          </span>
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <aside className="space-y-5 bg-[#f5f9f9] p-5 sm:p-7">
                <div>
                  <label className="text-sm font-bold">
                    Campaign name
                    <input
                      value={campaignName}
                      onChange={(event) => {
                        setCampaignName(event.target.value);
                        setBulkPreview(null);
                        setBulkConfirmed(false);
                      }}
                      maxLength={120}
                      className="mt-2 min-h-11 w-full border border-[#cbd9da] bg-white px-3 font-normal"
                    />
                  </label>
                </div>

                <div className="border border-[#b8dcda] bg-white p-4">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-[#168e8b]" />
                    <h3 className="font-bold">AI campaign planner</h3>
                  </div>
                  <p className="mt-2 text-xs leading-5 text-[#65797e]">
                    Gemini uses aggregate audience counts only. It suggests an
                    email draft and never changes the approved DLT SMS.
                  </p>
                  <button
                    onClick={() => void requestAiCampaign()}
                    disabled={!channels.ai || aiWorking}
                    className="mt-3 min-h-10 w-full border border-[#168e8b] px-3 text-sm font-bold text-[#117b78] disabled:opacity-50"
                  >
                    {aiWorking ? "Thinking…" : "Suggest campaign"}
                  </button>
                  {aiDraft && (
                    <div className="mt-4 border-t border-[#dce7e7] pt-4 text-xs leading-5 text-[#52686f]">
                      <p>{aiDraft.audience_note}</p>
                      <p className="mt-3 font-bold text-[#102b3f]">
                        {aiDraft.email_subject}
                      </p>
                      <button
                        onClick={reviewAiEmailCopy}
                        className="mt-3 font-bold text-[#117b78] underline"
                      >
                        Review and save this email copy
                      </button>
                    </div>
                  )}
                </div>

                {bulkPreview ? (
                  <div className="border border-[#8bc9c6] bg-[#eff9f8] p-4">
                    <h3 className="font-bold">Audience verified</h3>
                    <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <dt className="text-xs text-[#65797e]">Eligible</dt>
                        <dd className="text-xl font-bold">
                          {bulkPreview.eligible}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-xs text-[#65797e]">SMS ready</dt>
                        <dd className="text-xl font-bold">
                          {bulkPreview.sms_ready}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-xs text-[#65797e]">Email ready</dt>
                        <dd className="text-xl font-bold">
                          {bulkPreview.email_ready}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-xs text-[#65797e]">Requested</dt>
                        <dd className="text-xl font-bold">
                          {bulkPreview.requested}
                        </dd>
                      </div>
                    </dl>
                    <label className="mt-4 flex items-start gap-2 border-t border-[#cbe2e1] pt-4 text-xs leading-5">
                      <input
                        type="checkbox"
                        checked={bulkConfirmed}
                        onChange={(event) =>
                          setBulkConfirmed(event.target.checked)
                        }
                        className="mt-1"
                      />
                      Send real messages to these saved customer contacts.
                    </label>
                  </div>
                ) : (
                  <div className="border border-[#d8e4e4] bg-white p-4 text-xs leading-5 text-[#65797e]">
                    Review validates eligibility and contact availability. It
                    does not create links or send any message.
                  </div>
                )}

                {!bulkPreview ? (
                  <button
                    onClick={() => void previewBulkCampaign()}
                    disabled={
                      bulkWorking ||
                      !bulkSelection.length ||
                      !bulkChannels.length ||
                      !campaignName.trim()
                    }
                    className="min-h-12 w-full bg-[#168e8b] px-4 font-bold text-white disabled:opacity-50"
                  >
                    {bulkWorking ? "Checking…" : "Review audience"}
                  </button>
                ) : (
                  <button
                    onClick={() => void sendBulkCampaign()}
                    disabled={bulkWorking || !bulkConfirmed}
                    className="min-h-12 w-full bg-[#102b3f] px-4 font-bold text-white disabled:opacity-50"
                  >
                    {bulkWorking ? "Sending…" : "Send campaign"}
                  </button>
                )}
              </aside>
            </div>
          </div>
        </div>
      )}

      {editor && (
        <div
          className="fixed inset-0 z-[100] overflow-y-auto bg-[#092235]/70 p-3 sm:p-8"
          role="dialog"
          aria-modal="true"
          aria-label="Survey editor"
        >
          <div className="mx-auto max-w-5xl bg-white shadow-2xl">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[#dce6e6] bg-white px-5 py-4 sm:px-7">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-[#168e8b]">
                  {editor.id ? "Edit form" : "New custom form"}
                </p>
                <h2 className="mt-1 text-xl font-bold">Form builder</h2>
              </div>
              <button
                onClick={() => setEditor(null)}
                aria-label="Close form builder"
                className="grid h-10 w-10 place-items-center border border-[#d3dfdf]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="grid gap-7 p-5 sm:p-7 lg:grid-cols-[minmax(0,1fr)_320px]">
              <div className="space-y-4">
                <label className="block text-sm font-bold">
                  Form title
                  <input
                    value={editor.title}
                    onChange={(e) =>
                      setEditor({ ...editor, title: e.target.value })
                    }
                    className="mt-2 min-h-11 w-full border border-[#cbd9da] px-3 font-normal outline-none focus:border-[#168e8b]"
                  />
                </label>
                <label className="block text-sm font-bold">
                  Description
                  <textarea
                    value={editor.description}
                    onChange={(e) =>
                      setEditor({ ...editor, description: e.target.value })
                    }
                    rows={3}
                    className="mt-2 w-full border border-[#cbd9da] p-3 font-normal outline-none focus:border-[#168e8b]"
                  />
                </label>
                <div className="flex items-center justify-between pt-3">
                  <div>
                    <h3 className="font-bold">Questions</h3>
                    <p className="text-xs text-[#718287]">
                      Reorder, require, or remove any question.
                    </p>
                  </div>
                  <button
                    onClick={() =>
                      setEditor({
                        ...editor,
                        questions: [
                          ...editor.questions,
                          emptyQuestion(editor.questions.length + 1),
                        ],
                      })
                    }
                    className="inline-flex min-h-10 items-center gap-2 border border-[#168e8b] px-3 text-sm font-bold text-[#117b78]"
                  >
                    <Plus className="h-4 w-4" />
                    Add question
                  </button>
                </div>
                {editor.questions.map((question, index) => (
                  <div
                    key={question.id}
                    className="border border-[#d8e4e4] bg-[#fafcfc] p-4"
                  >
                    <div className="flex items-start gap-3">
                      <span className="grid h-8 w-8 shrink-0 place-items-center bg-[#e5f4f3] text-xs font-bold text-[#168e8b]">
                        {index + 1}
                      </span>
                      <div className="grid min-w-0 flex-1 gap-3 sm:grid-cols-[1fr_150px]">
                        <input
                          value={question.title}
                          onChange={(e) =>
                            updateQuestion(index, { title: e.target.value })
                          }
                          placeholder="Write the question"
                          className="min-h-10 border border-[#cbd9da] bg-white px-3 text-sm outline-none focus:border-[#168e8b]"
                        />
                        <select
                          value={question.type}
                          onChange={(e) => {
                            const type = e.target.value as SurveyQuestionType;
                            updateQuestion(index, {
                              type,
                              options:
                                type === "single" || type === "multi"
                                  ? question.options?.length
                                    ? question.options
                                    : ["Option 1", "Option 2"]
                                  : undefined,
                              maxLength: type === "text" ? 1000 : undefined,
                            });
                          }}
                          className="min-h-10 border border-[#cbd9da] bg-white px-2 text-sm"
                        >
                          <option value="single">Single choice</option>
                          <option value="multi">Multiple choice</option>
                          <option value="stars">Star rating</option>
                          <option value="nps">NPS 0–10</option>
                          <option value="text">Text answer</option>
                        </select>
                      </div>
                      <div className="flex shrink-0 gap-1">
                        <button
                          onClick={() => moveQuestion(index, -1)}
                          disabled={index === 0}
                          aria-label="Move question up"
                          className="grid h-8 w-8 place-items-center border disabled:opacity-30"
                        >
                          <ArrowUp className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => moveQuestion(index, 1)}
                          disabled={index === editor.questions.length - 1}
                          aria-label="Move question down"
                          className="grid h-8 w-8 place-items-center border disabled:opacity-30"
                        >
                          <ArrowDown className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => removeQuestion(index)}
                          disabled={editor.questions.length === 1}
                          aria-label="Delete question"
                          className="grid h-8 w-8 place-items-center border text-[#b34037] disabled:opacity-30"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                    {(question.type === "single" ||
                      question.type === "multi") && (
                      <label className="mt-3 block text-xs font-bold text-[#65797e]">
                        Options (one per line)
                        <textarea
                          value={(question.options || []).join("\n")}
                          onChange={(e) =>
                            updateQuestion(index, {
                              options: e.target.value
                                .split("\n")
                                .map((value) => value.trim())
                                .filter(Boolean),
                              otherAnswerKey: e.target.value
                                .split("\n")
                                .some((value) => value.trim() === "Other")
                                ? `${question.id}_other`
                                : undefined,
                            })
                          }
                          rows={3}
                          className="mt-1 w-full border border-[#cbd9da] bg-white p-3 font-normal outline-none focus:border-[#168e8b]"
                        />
                      </label>
                    )}
                    <div className="mt-3 flex flex-wrap gap-4">
                      <label className="flex items-center gap-2 text-xs font-semibold">
                        <input
                          type="checkbox"
                          checked={Boolean(question.required)}
                          onChange={(e) =>
                            updateQuestion(index, {
                              required: e.target.checked,
                            })
                          }
                        />
                        Required
                      </label>
                      <label className="flex items-center gap-2 text-xs font-semibold">
                        Section
                        <select
                          value={question.section}
                          onChange={(e) =>
                            updateQuestion(index, {
                              section: e.target
                                .value as SurveyQuestion["section"],
                            })
                          }
                          className="border bg-white px-2 py-1"
                        >
                          <option value="overall">Overall</option>
                          <option value="order">Order & delivery</option>
                          <option value="comparison">Comparison</option>
                          <option value="future">Future</option>
                        </select>
                      </label>
                    </div>
                  </div>
                ))}
              </div>
              <aside className="space-y-5">
                <div className="border border-[#d8e4e4] p-4">
                  <h3 className="font-bold">Publishing</h3>
                  <label className="mt-4 block text-xs font-bold">
                    Status
                    <select
                      value={editor.status}
                      onChange={(e) =>
                        setEditor({ ...editor, status: e.target.value })
                      }
                      className="mt-1 min-h-10 w-full border border-[#cbd9da] bg-white px-2 text-sm font-normal"
                    >
                      <option value="draft">Draft</option>
                      <option value="published">Published</option>
                      <option value="paused">Paused</option>
                    </select>
                  </label>
                  <label className="mt-3 block text-xs font-bold">
                    Estimated minutes
                    <input
                      type="number"
                      min={1}
                      max={30}
                      value={editor.estimated_minutes}
                      onChange={(e) =>
                        setEditor({
                          ...editor,
                          estimated_minutes: Number(e.target.value),
                        })
                      }
                      className="mt-1 min-h-10 w-full border border-[#cbd9da] px-3 text-sm font-normal"
                    />
                  </label>
                  <label className="mt-4 flex items-start gap-2 border-t border-[#e1eaea] pt-4 text-xs font-bold">
                    <input
                      type="checkbox"
                      checked={editor.public_enabled}
                      onChange={(event) =>
                        setEditor({
                          ...editor,
                          public_enabled: event.target.checked,
                        })
                      }
                      className="mt-0.5"
                    />
                    <span>
                      Enable reusable shared link
                      <span className="mt-1 block font-normal leading-5 text-[#718287]">
                        Anyone with the link can respond without an order token.
                      </span>
                    </span>
                  </label>
                </div>
                <div className="border border-[#d8e4e4] p-4">
                  <h3 className="font-bold">DLT SMS</h3>
                  <p className="mt-1 text-xs leading-5 text-[#718287]">
                    Paste the exact approved template ID. Keep{" "}
                    <code>{"{#var#}"}</code> where the secure link belongs.
                  </p>
                  <label className="mt-4 block text-xs font-bold">
                    Approved DLT template ID
                    <input
                      value={editor.dlt_template_id || ""}
                      onChange={(e) =>
                        setEditor({
                          ...editor,
                          dlt_template_id: e.target.value || null,
                        })
                      }
                      placeholder="e.g. 1707…"
                      className="mt-1 min-h-10 w-full border border-[#cbd9da] px-3 text-sm font-normal"
                    />
                  </label>
                  <label className="mt-3 block text-xs font-bold">
                    Approved SMS content
                    <textarea
                      value={editor.sms_template}
                      onChange={(e) =>
                        setEditor({ ...editor, sms_template: e.target.value })
                      }
                      rows={7}
                      className="mt-1 w-full border border-[#cbd9da] p-3 text-sm font-normal outline-none focus:border-[#168e8b]"
                    />
                  </label>
                </div>
                <div className="border border-[#d8e4e4] p-4">
                  <h3 className="font-bold">Email invitation</h3>
                  <p className="mt-1 text-xs leading-5 text-[#718287]">
                    Plain text is converted into a branded email. Keep{" "}
                    <code>{"{link}"}</code>; optional placeholders are{" "}
                    <code>{"{first_name}"}</code> and{" "}
                    <code>{"{order_reference}"}</code>.
                  </p>
                  <label className="mt-4 block text-xs font-bold">
                    Email subject
                    <input
                      value={editor.email_subject}
                      onChange={(event) =>
                        setEditor({
                          ...editor,
                          email_subject: event.target.value,
                        })
                      }
                      maxLength={160}
                      className="mt-1 min-h-10 w-full border border-[#cbd9da] px-3 text-sm font-normal"
                    />
                  </label>
                  <label className="mt-3 block text-xs font-bold">
                    Email message
                    <textarea
                      value={editor.email_template}
                      onChange={(event) =>
                        setEditor({
                          ...editor,
                          email_template: event.target.value,
                        })
                      }
                      rows={9}
                      maxLength={4000}
                      className="mt-1 w-full border border-[#cbd9da] p-3 text-sm font-normal outline-none focus:border-[#168e8b]"
                    />
                  </label>
                </div>
              </aside>
            </div>
            <div className="sticky bottom-0 flex justify-end gap-3 border-t border-[#dce6e6] bg-white px-5 py-4 sm:px-7">
              <button
                onClick={() => setEditor(null)}
                className="min-h-11 border border-[#cbd9da] px-5 text-sm font-bold"
              >
                Cancel
              </button>
              <button
                onClick={() => void saveEditor()}
                disabled={saving}
                className="min-h-11 bg-[#168e8b] px-6 text-sm font-bold text-white disabled:opacity-50"
              >
                {saving
                  ? "Saving…"
                  : editor.id
                    ? "Save changes"
                    : "Create form"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SurveyCenter;
