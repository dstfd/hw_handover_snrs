import type { UserPublic } from "../types.js";
import type { NotificationPayload } from "../types.js";

/**
 * Mocked email channel: validates inputs; real SMTP deferred in design.
 */
export function sendEmailMock(
  user: UserPublic,
  payload: NotificationPayload
): void {
  if (!user.email || user.email.trim() === "") {
    throw new Error(`Email channel requires email for user ${user.user_id}`);
  }
  if (!payload.headline) {
    throw new Error("Notification payload missing headline");
  }
}
