<?php
/**
 * config.example.php — copy to config.php (gitignored) and fill in, or leave
 * the defaults blank and set the PSRI_* environment variables on the server.
 */
declare(strict_types=1);

$env = static fn (string $k, string $default): string =>
    (getenv($k) !== false && getenv($k) !== '') ? (string) getenv($k) : $default;

return [
    'db' => [
        'host' => $env('PSRI_DB_HOST', ''),
        'port' => $env('PSRI_DB_PORT', '3306'),
        'name' => $env('PSRI_DB_NAME', 'psri'),
        'user' => $env('PSRI_DB_USER', ''),
        'pass' => $env('PSRI_DB_PASS', ''),
    ],
    // Sender for "Send Notification → Email" nodes that leave From blank.
    'mail_from'   => $env('PSRI_MAIL_FROM', 'crm@psrihospital.com'),
    // SMTP server for email nodes. Leave host blank to use PHP mail() (needs
    // sendmail / postfix on the host). secure: tls (STARTTLS, port 587),
    // ssl (port 465) or none. tls / ssl need the PHP openssl extension.
    // Office 365: smtp.office365.com, 587, tls — the mailbox needs SMTP AUTH
    // enabled, and mail_from must be that mailbox (or one it may send as).
    'smtp' => [
        'host'   => $env('PSRI_SMTP_HOST', ''),
        'port'   => $env('PSRI_SMTP_PORT', '587'),
        'secure' => $env('PSRI_SMTP_SECURE', 'tls'),
        'user'   => $env('PSRI_SMTP_USER', ''),
        'pass'   => $env('PSRI_SMTP_PASS', ''),
    ],
    // "Send Notification → WhatsApp" provider.
    // provider 'meta' = Meta WhatsApp Cloud API: phone_number_id + token (a
    // permanent System User token with whatsapp_business_messaging) from the
    // app's WhatsApp → API Setup page. Nodes with an approved template name
    // send that template; others send plain text (only delivered inside the
    // 24-hour window after the recipient last messaged your number).
    // Any other provider: one POST per recipient to url, "Authorization:
    // Bearer <token>" when set, body = JSON template with {{to}} / {{message}}.
    // Check credentials: php api.php wa-test 9811000000   (sends hello_world)
    'whatsapp' => [
        'provider'        => $env('PSRI_WA_PROVIDER', 'meta'),
        'phone_number_id' => $env('PSRI_WA_PHONE_NUMBER_ID', ''),
        'token'           => $env('PSRI_WA_TOKEN', ''),
        'api_version'     => $env('PSRI_WA_API_VERSION', 'v25.0'),
        'url'             => $env('PSRI_WA_URL', ''),
        'body'            => $env('PSRI_WA_BODY', '{"to":"{{to}}","message":"{{message}}"}'),
        // In-CRM chat (wa.php): the Meta webhook at <api>/psri-wa-webhook needs a
        // verify token (any secret string, typed again in the Meta app) and the
        // app secret, used to check each webhook's X-Hub-Signature-256.
        'verify_token'    => $env('PSRI_WA_VERIFY_TOKEN', ''),
        'app_secret'      => $env('PSRI_WA_APP_SECRET', ''),
    ],
    // "Send Notification → Teams" default webhook.
    // A node's own "Teams webhook URL" wins; this is the fallback, so the URL can
    // live here (or in the PSRI_TEAMS_WEBHOOK_URL env var) instead of in every
    // workflow that posts to Teams.
    // In Teams: channel ▸ ⋯ ▸ Manage channel ▸ Workflows ▸ Add a workflow ▸ copy
    // the URL. Treat it as a secret — anyone holding it can post to the channel,
    // so it belongs in config.php (gitignored) and not in a workflow.
    'teams' => [
        'webhook_url' => $env('PSRI_TEAMS_WEBHOOK_URL', ''),
    ],
    // Origin allowed to call the API from the browser ('*' = any). Set this
    // to the CRM's origin in production, e.g. https://crm.example.com
    'cors_origin' => $env('PSRI_CORS_ORIGIN', '*'),
];
