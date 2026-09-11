import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { 
      user_id, 
      full_name, 
      phone, 
      email,
      preferred_language, 
      theme_preference, 
      sms_notifications, 
      promo_notifications,
      survey_source,
      survey_frequency,
      survey_courier_type,
    } = await req.json();

    const FREQ = ["1-5", "5-10", "10+"];
    const COURIER = ["Documents", "Box Items"];
    if (survey_frequency !== undefined && survey_frequency !== null && !FREQ.includes(survey_frequency)) {
      return new Response(JSON.stringify({ error: "invalid survey_frequency" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (survey_courier_type !== undefined && survey_courier_type !== null && !COURIER.includes(survey_courier_type)) {
      return new Response(JSON.stringify({ error: "invalid survey_courier_type" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (survey_source !== undefined && survey_source !== null && String(survey_source).length > 200) {
      return new Response(JSON.stringify({ error: "survey_source too long" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (!user_id) {
      return new Response(
        JSON.stringify({ error: "user_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Check if profile exists
    const { data: existingProfile } = await supabase
      .from("profiles")
      .select("*")
      .eq("user_id", user_id)
      .maybeSingle();

    if (existingProfile) {
      // Update existing profile
      const updateData: Record<string, any> = { updated_at: new Date().toISOString() };
      if (full_name !== undefined) updateData.full_name = full_name;
      if (phone !== undefined) updateData.phone = phone;
      if (email !== undefined) updateData.email = email;
      if (preferred_language !== undefined) updateData.preferred_language = preferred_language;
      if (theme_preference !== undefined) updateData.theme_preference = theme_preference;
      if (sms_notifications !== undefined) updateData.sms_notifications = sms_notifications;
      if (promo_notifications !== undefined) updateData.promo_notifications = promo_notifications;
      if (survey_source !== undefined) updateData.survey_source = survey_source;
      if (survey_frequency !== undefined) updateData.survey_frequency = survey_frequency;
      if (survey_courier_type !== undefined) updateData.survey_courier_type = survey_courier_type;
      const surveyComplete =
        (survey_source !== undefined ? survey_source : existingProfile.survey_source) &&
        (survey_frequency !== undefined ? survey_frequency : existingProfile.survey_frequency) &&
        (survey_courier_type !== undefined ? survey_courier_type : existingProfile.survey_courier_type);
      if (surveyComplete && !existingProfile.survey_completed_at) {
        updateData.survey_completed_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from("profiles")
        .update(updateData)
        .eq("user_id", user_id);

      if (error) throw error;
    } else {
      // Create new profile
      const surveyComplete = survey_source && survey_frequency && survey_courier_type;
      const { error } = await supabase
        .from("profiles")
        .insert({
          user_id,
          full_name: full_name || null,
          phone: phone || null,
          email: email || null,
          preferred_language: preferred_language || 'en',
          theme_preference: theme_preference || 'light',
          sms_notifications: sms_notifications ?? true,
          promo_notifications: promo_notifications ?? true,
          survey_source: survey_source || null,
          survey_frequency: survey_frequency || null,
          survey_courier_type: survey_courier_type || null,
          survey_completed_at: surveyComplete ? new Date().toISOString() : null,
        });

      if (error) throw error;
    }

    // Return the updated profile
    const { data: profile, error: fetchError } = await supabase
      .from("profiles")
      .select("*")
      .eq("user_id", user_id)
      .single();

    if (fetchError) throw fetchError;

    return new Response(
      JSON.stringify({ success: true, profile }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error updating profile:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
