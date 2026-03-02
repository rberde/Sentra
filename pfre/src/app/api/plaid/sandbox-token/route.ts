import { NextResponse } from "next/server";
import { Configuration, PlaidApi, PlaidEnvironments, Products } from "plaid";
import customUser from "../../../../../sandbox/plaid-custom-user.json";

const config = new Configuration({
  basePath: PlaidEnvironments[process.env.PLAID_ENV || "sandbox"],
  baseOptions: {
    headers: {
      "PLAID-CLIENT-ID": process.env.PLAID_CLIENT_ID,
      "PLAID-SECRET": process.env.PLAID_SECRET,
    },
  },
});

const plaidClient = new PlaidApi(config);

/**
 * Creates a Sandbox public token using /sandbox/public_token/create,
 * bypassing the Link UI entirely. Uses the custom user JSON config
 * to generate rich test data (checking, savings, credit card, investments, loans).
 *
 * After calling this, exchange the public_token via /api/plaid/exchange-token
 * just like a normal Link flow.
 */
export async function POST() {
  if (process.env.PLAID_ENV !== "sandbox") {
    return NextResponse.json(
      { error: "This endpoint is only available in Sandbox mode" },
      { status: 403 },
    );
  }

  try {
    const response = await plaidClient.sandboxPublicTokenCreate({
      institution_id: "ins_109508",
      initial_products: [
        Products.Auth,
        Products.Transactions,
        Products.Investments,
        Products.Liabilities,
        Products.Identity,
      ],
      options: {
        override_username: "user_custom",
        override_password: JSON.stringify(customUser),
      },
    });

    return NextResponse.json({
      public_token: response.data.public_token,
      message: "Sandbox token created with custom user data. Exchange via /api/plaid/exchange-token.",
    });
  } catch (error: unknown) {
    console.error("Sandbox token creation error:", error);
    const plaidError = (error as { response?: { data?: unknown } })?.response?.data;
    return NextResponse.json(
      { error: "Failed to create sandbox token", details: plaidError },
      { status: 500 },
    );
  }
}
