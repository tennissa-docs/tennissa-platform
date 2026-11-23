import { serve } from "inngest/next";
import { inngest } from "@/lib/inngest/client";
import { functions } from "@/lib/inngest/functions";

// Inngest calls this endpoint to run jobs. Outside dev mode every request must carry Inngest's
// signature (INNGEST_SIGNING_KEY); the SDK rejects anything else.
export const { GET, POST, PUT } = serve({ client: inngest, functions });
