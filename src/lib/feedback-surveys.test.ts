import { describe, expect, it } from "bun:test";
import { getSurveyTemplate, isQuestionAnswered, surveyTemplates } from "./feedback-surveys";

describe("feedback survey templates", () => {
  it("ships quick and detailed order-linked forms", () => {
    expect(surveyTemplates.map((survey) => survey.slug)).toEqual(["quick-order-feedback", "customer-experience"]);
    expect(getSurveyTemplate("quick-order-feedback")?.questions).toHaveLength(7);
    expect(getSurveyTemplate("customer-experience")?.questions).toHaveLength(17);
  });

  it("keeps all question identifiers unique inside a survey", () => {
    for (const survey of surveyTemplates) {
      const ids = survey.questions.map((question) => question.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it("requires a non-empty response only for required questions", () => {
    expect(isQuestionAnswered({ id: "nps", title: "NPS", section: "overall", type: "nps", required: true }, undefined)).toBe(false);
    expect(isQuestionAnswered({ id: "issues", title: "Issues", section: "order", type: "multi", required: true }, [])).toBe(false);
    expect(isQuestionAnswered({ id: "notes", title: "Notes", section: "future", type: "text" }, undefined)).toBe(true);
  });

  it("requires details when Other is selected", () => {
    const question = { id: "issues", title: "Issues", section: "order" as const, type: "multi" as const, required: true, otherAnswerKey: "issues_other" };
    expect(isQuestionAnswered(question, ["Other"], { issues: ["Other"] })).toBe(false);
    expect(isQuestionAnswered(question, ["Other"], { issues: ["Other"], issues_other: "A different issue" })).toBe(true);
  });
});
