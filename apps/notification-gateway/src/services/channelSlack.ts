import type { UserPublic } from "../types.js";
import type { NotificationPayload } from "../types.js";

/**
 * Mocked Slack channel: validates inputs; real webhook deferred in design.
 */
export function sendSlackMock(
  user: UserPublic,
  payload: NotificationPayload
): void {
  if (!user.slack_channel || user.slack_channel.trim() === "") {
    throw new Error(`Slack channel requires slack_channel for user ${user.user_id}`);
  }
  if (!payload.headline) {
    throw new Error("Notification payload missing headline");
  }
}
