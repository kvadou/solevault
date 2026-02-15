import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { stripe } from "@/lib/stripe";

const TAG_PRODUCTS = {
  qr: { name: "QR Verification Sticker", priceCents: 200, type: "qr" },
  nfc: { name: "Premium NFC Tag", priceCents: 800, type: "nfc" },
} as const;

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { tagType, quantity } = body as { tagType: "qr" | "nfc"; quantity: number };

    if (!tagType || !TAG_PRODUCTS[tagType]) {
      return NextResponse.json({ error: "Invalid tag type" }, { status: 400 });
    }

    const qty = Math.min(Math.max(1, quantity || 1), 50);
    const product = TAG_PRODUCTS[tagType];

    const checkoutSession = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: product.name,
              description: tagType === "nfc"
                ? "Tamper-evident NFC sticker for shoe authentication"
                : "Printed QR code sticker for box/bag verification",
            },
            unit_amount: product.priceCents,
          },
          quantity: qty,
        },
      ],
      metadata: {
        userId: session.user.id,
        tagType,
        quantity: String(qty),
        type: "nfc_tag_purchase",
      },
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/nfc/register?purchased=true`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/nfc/purchase?cancelled=true`,
    });

    return NextResponse.json({ checkoutUrl: checkoutSession.url });
  } catch {
    return NextResponse.json({ error: "Failed to create checkout session" }, { status: 500 });
  }
}
