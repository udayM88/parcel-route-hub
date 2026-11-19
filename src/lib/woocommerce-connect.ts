type FunctionFailure = {
  name?: string;
  message?: string;
  context?: unknown;
} | null;

type ConnectionFailureInput = {
  data?: { error?: unknown } | null;
  error?: FunctionFailure;
  response?: Response;
};

const fallbackMessage = "ViaSetu could not authorize this store. Please try again or contact support.";

export async function getWooCommerceConnectErrorMessage({ data, error, response }: ConnectionFailureInput) {
  if (typeof data?.error === "string" && data.error.trim()) return data.error.trim();

  const errorResponse = response || (error?.context instanceof Response ? error.context : undefined);
  let backendMessage = "";
  if (errorResponse) {
    try {
      const payload = await errorResponse.clone().json() as { error?: unknown };
      if (typeof payload?.error === "string") backendMessage = payload.error.trim();
    } catch {
      // A gateway may return HTML or an empty body. The status-specific message below remains actionable.
    }
  }

  if (backendMessage) return backendMessage;
  if (errorResponse?.status === 404) {
    return "The WooCommerce connection service is not active yet. Please contact ViaSetu support before retrying.";
  }
  if (errorResponse?.status === 401) return "Your merchant session expired. Sign in again and restart the connection from WordPress.";
  if (errorResponse?.status === 403) return "Your merchant role is not allowed to connect WooCommerce stores.";
  if (errorResponse && errorResponse.status >= 500) {
    return "The WooCommerce connection service is temporarily unavailable. Please try again shortly.";
  }
  if (error?.name === "FunctionsFetchError") {
    return "The WooCommerce connection service could not be reached. Please contact ViaSetu support before retrying.";
  }
  if (error?.message && !/Edge Function/i.test(error.message)) return error.message;
  return fallbackMessage;
}
