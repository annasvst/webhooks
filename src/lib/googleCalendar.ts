import { google } from 'googleapis';
import type { calendar_v3 } from 'googleapis'; 
import type { JWT } from 'google-auth-library';

let authClient: JWT | undefined;
let calendar: calendar_v3.Calendar | undefined;

/**
 * Obtains and caches a Calendar client authenticated via a service account
 */
async function getCalendarClient(): Promise<calendar_v3.Calendar> {
  if (!authClient || !calendar) {
    const clientEmail = process.env.GOOGLE_CLIENT_EMAIL;
    const privateKey = process.env.GOOGLE_PRIVATE_KEY;

    if (!clientEmail || !privateKey) {
      throw new Error('Google service account credentials are not set in environment');
    }

    authClient = new google.auth.JWT({
      email: clientEmail,
      key: privateKey.replace(/\\n/g, '\n'),
      scopes: ['https://www.googleapis.com/auth/calendar'],
    });

    await authClient.authorize();

    calendar = google.calendar({ version: 'v3', auth: authClient });
  }

  return calendar;
}

/**
 * Adds a user's email to a specific Calendar event as an attendee.
 * @param eventId - The ID of the event to update
 * @param userEmail - The email address to add
 * @returns The updated Event resource
 */
export async function addAttendeeToEvent(
  eventId: string,
  userEmail: string
): Promise<calendar_v3.Schema$Event> {
  const cal = await getCalendarClient();
  const calendarId = process.env.GOOGLE_CALENDAR_ID;

  if (!calendarId) {
    throw new Error('GOOGLE_CALENDAR_ID is not set in environment');
  }

  try {
    const existingEvent = await cal.events.get({ calendarId, eventId });
    const attendees = existingEvent.data.attendees || [];

    if (!attendees.some((a) => a.email === userEmail)) {
      attendees.push({ email: userEmail });
    }

    const response = await cal.events.patch({
      calendarId,
      eventId,
      requestBody: {
        attendees,
      },
    });

    console.log('Updated event attendees:', response.data.attendees);
    return response.data;
  } catch (error) {
    console.error('Error adding attendee to event:', error);
    throw error;
  }
}
