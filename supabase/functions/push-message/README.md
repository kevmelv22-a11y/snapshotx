# Push notification Edge Function — configured, device test pending

Version 3 is deployed on the live project. `verify_jwt=false` is intentional:
the `sx_message_push_webhook` database trigger sends a dedicated 256-bit token
from Supabase Vault in `x-snapshotx-job-key`. The function rejects missing or
incorrect tokens and reads the Expo robot token through a service-role-only
RPC. Neither token is in the mobile app or source control.

The trigger sends only message, thread, and sender IDs plus message kind; it
does not transmit chat text or media paths. A request without the job token
returned HTTP 401. A valid token with a nonexistent message returned HTTP 200
`no recipients`. No real message has been pushed to a device yet.

The Expo `snapshotx-push` Viewer robot was created and its access token stored
in Vault. Enhanced security for push notifications remains off in the Expo
team; native APNs/FCM credentials and a development build still need setup.
Once a device token exists, verify a real receipt and check that notification
content has no chat text. Expo acceptance is not proof of device delivery;
retries can duplicate a push if the delivery-record write fails afterward.
