import { z } from "zod";

// Shared by the give form (browser) and POST /api/give/intent (server). The server is the authority.
export const US_STATES = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","DC","FL","GA","HI","ID","IL","IN","IA","KS","KY","LA","ME","MD","MA","MI","MN",
  "MS","MO","MT","NE","NV","NH","NJ","NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT","VA","WA",
  "WV","WI","WY",
] as const;

export const giveInput = z
  .object({
    checkoutId: z.uuid(),
    filingStatus: z.enum(["single", "married_joint", "married_separate"]),
    amountCents: z.number().int().min(100, "The smallest gift is $1.00.").max(100_000_000),
    firstName: z.string().trim().min(1, "Enter your first name.").max(80),
    lastName: z.string().trim().min(1, "Enter your last name.").max(80),
    email: z.email("Enter an email address we can send your receipt to.").max(200),
    address: z.object({
      line1: z.string().trim().min(1, "Enter your street address.").max(200),
      line2: z.string().trim().max(200).optional().default(""),
      city: z.string().trim().min(1, "Enter your city.").max(100),
      state: z.enum(US_STATES, { error: "Choose your state." }),
      zip: z.string().trim().regex(/^\d{5}(-\d{4})?$/, "Enter a 5-digit ZIP code."),
    }),
    method: z.enum(["ach", "card"]),
    forTaxCredit: z.boolean(),
    attestUsPerson: z.boolean(),
    attestOwnMoney: z.boolean(),
    consentEmailStatements: z.boolean(),
  })
  .superRefine((v, ctx) => {
    if (v.forTaxCredit && !v.attestUsPerson)
      ctx.addIssue({ code: "custom", path: ["attestUsPerson"], message: "Confirm this to claim the credit, or make it a regular gift." });
    if (v.forTaxCredit && !v.attestOwnMoney)
      ctx.addIssue({ code: "custom", path: ["attestOwnMoney"], message: "Confirm this to claim the credit, or make it a regular gift." });
  });

export type GiveInput = z.infer<typeof giveInput>;

export const DISCLOSURE_VERSION = "give-2027-01";
