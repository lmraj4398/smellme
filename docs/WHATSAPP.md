# WhatsApp messages (Gupshup)

SmellMe sends WhatsApp messages through Gupshup's **template** API. WhatsApp only allows a business to start a
conversation with a pre-approved template, so each message below needs a template approved in your Gupshup account
before anything is sent.

Until a template is configured, the message is recorded as **skipped** (see *Notifications* in the admin) and nothing is
sent. A missing **OTP** template means nobody can sign in, so set that one first.

## Setting up

1. In Gupshup, create and get approved one template per row in the table below. Use the parameters in the order shown:
   `{{1}}` is the first parameter, `{{2}}` the second, and so on.
2. Put each template's id in `environments/.env.production`:

   ```
   GUPSHUP_API_KEY=...
   GUPSHUP_APP_NAME=...
   GUPSHUP_SOURCE_NUMBER=...        # the business number, digits only
   GUPSHUP_WEBHOOK_TOKEN=...
   GUPSHUP_TEMPLATE_OTP=...
   GUPSHUP_TEMPLATE_ORDER_PLACED=...
   GUPSHUP_TEMPLATE_PAYMENT_APPROVED=...
   GUPSHUP_TEMPLATE_PAYMENT_REJECTED=...
   GUPSHUP_TEMPLATE_SHIPPED=...
   GUPSHUP_TEMPLATE_DELIVERED=...
   GUPSHUP_TEMPLATE_CANCELLED=...
   ```
3. Restart the API. Open **Notifications** in the admin to see each message and whether it was sent, failed or skipped.

In development (`NODE_ENV` other than production) with no Gupshup key set, messages are not sent: they are recorded
with the event name as the template id, and the OTP can be read from the API log.

## Templates

| Event (env suffix) | When it is sent | Parameters, in order | Suggested wording |
|---|---|---|---|
| `OTP` | Customer asks for a sign-in code | `{{1}}` code | `{{1}} is your SmellMe sign-in code. It expires in 5 minutes. Do not share it with anyone.` |
| `ORDER_PLACED` | Customer places an order | `{{1}}` name, `{{2}}` order no., `{{3}}` total | `Hi {{1}}, we have your order {{2}} for {{3}}. Please pay by UPI and upload the receipt so we can ship it.` |
| `PAYMENT_APPROVED` | Owner approves the payment | `{{1}}` name, `{{2}}` order no. | `Hi {{1}}, your payment for order {{2}} is confirmed. We are packing it now.` |
| `PAYMENT_REJECTED` | Owner rejects the payment | `{{1}}` name, `{{2}}` order no., `{{3}}` reason | `Hi {{1}}, we could not confirm the payment for order {{2}}: {{3}}. Please upload a new receipt.` |
| `SHIPPED` | Owner marks it shipped | `{{1}}` name, `{{2}}` order no., `{{3}}` carrier, `{{4}}` tracking no. | `Hi {{1}}, order {{2}} is on its way with {{3}}. Tracking: {{4}}.` |
| `DELIVERED` | Owner marks it delivered | `{{1}}` name, `{{2}}` order no. | `Hi {{1}}, order {{2}} has been delivered. We hope you love it. You can now review it on our site.` |
| `CANCELLED` | Order is cancelled | `{{1}}` name, `{{2}}` order no., `{{3}}` reason | `Hi {{1}}, order {{2}} was cancelled: {{3}}.` |

The wording is only a suggestion. What matters is that the **number and order of parameters** match, because the API
sends them positionally.

## What is stored

Phone numbers are stored masked (`••••••3210`) and the OTP itself is never written to the log.
