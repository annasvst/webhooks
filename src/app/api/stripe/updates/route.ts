import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { addAttendeeToEvent } from '@/app/lib/googleCalendar';

export const runtime = 'nodejs'; 

export async function POST(req: NextRequest) {
  try {
    const STRIPE_PRIVATE_KEY = process.env.STRIPE_PRIVATE_KEY || '';
    const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;
    if (!STRIPE_WEBHOOK_SECRET) {
      throw new Error("STRIPE_WEBHOOK_SECRET is missing in environment variables");
    }

    const stripe = new Stripe(STRIPE_PRIVATE_KEY, {
      apiVersion: '2022-11-15',
    });

    const sig = req.headers.get('stripe-signature');
    if (!sig) {
      console.error("Missing stripe-signature header");
      return NextResponse.json({ error: "Missing stripe-signature header" }, { status: 400 });
    }

    const rawBody = await req.arrayBuffer();
    let event: Stripe.Event;

    try {
      event = stripe.webhooks.constructEvent(Buffer.from(rawBody), sig, STRIPE_WEBHOOK_SECRET);
    } catch (err: unknown) {
      if (err instanceof Error) {
        console.error('Error verifying Stripe webhook signature:', err.message);
        return NextResponse.json({ error: `Webhook Error: ${err.message}` }, { status: 400 });
      } else {
        console.error('Unknown error verifying Stripe webhook signature:', err);
        return NextResponse.json({ error: 'Webhook Error: Unknown error occurred' }, { status: 400 });
      }
    }

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        console.log("✅ Payment complete for session:", session.id, session);

        const eventId = session.metadata?.eventId;
        const userEmail = session.customer_details?.email;

        if (eventId && userEmail) {
          if (eventId && userEmail) {
            addAttendeeToEvent(eventId as string, userEmail as string)
              .then(() => {
              console.log(`Attendee ${userEmail} added to event ${eventId}`);
              })
              .catch((err: Error) => {
              console.error('Failed to update calendar event:', err);
              });
          }
        }
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true }, { status: 200 });
  } catch (err) {
    console.error('General error in webhook handler:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ message: 'Stripe Webhook Server is running!' }, { status: 200 });
}
