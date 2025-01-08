import { createRestAPIClient } from "masto";

const masto = createRestAPIClient({
  url: process.env.MASTO_SERVER,
  accessToken: process.env.MASTO_TOKEN,
});

/**
 * @param {string} message - message to post
 */
export async function post(message) {
  try {
    const status = await masto.v1.statuses.create({
      status: message,
      visibility: "private",
    });
    console.info("mastodon post succeeded");
    return status;
  } catch (e) {
    console.error("mastodon posting failed with " + e.message);
  }
}
