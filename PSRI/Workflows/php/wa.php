<?php
/**
 * wa.php — WhatsApp chat inside the CRM (Meta WhatsApp Cloud API).
 *
 * The case form shows the department's WhatsApp conversation in-window and
 * lets the agent reply without leaving the CRM. Sending uses the Cloud API
 * (config.php → 'whatsapp'); receiving is driven by Meta's webhook.
 *
 * A conversation ("thread") is one of:
 *   group:<GROUP_ID>   a group created with Meta's Groups API (needs an
 *                      Official Business Account; up to 8 participants)
 *   wa:<PHONE>         a 1:1 chat with a number, e.g. a department desk
 *
 * Routes (api.php):
 *   GET  psri-wa-webhook            Meta verification (echoes hub.challenge)
 *   POST psri-wa-webhook            inbound messages + delivery statuses
 *   GET  psri-wa-threads?limit=     { success, threads:[…] }
 *   GET  psri-wa-thread?id=&title=&limit=  { success, thread, messages:[…] }
 *   POST psri-wa-send {threadId,message}   { success, message }
 *   GET  psri-wa-groups             { success, groups:[…] } (Groups API list)
 *
 * Message bodies are stored as-is; the webhook always answers 200 so Meta
 * never retry-storms us.
 */
declare(strict_types=1);

// ── Schema ────────────────────────────────────────────────────────────────

/** Creates the WhatsApp tables if missing (safe to re-run). */
function wa_ensure_tables(): array {
    static $done = false;
    if ($done) return ['wa_threads', 'wa_messages'];
    $pdo = psri_db();
    $pdo->exec("CREATE TABLE IF NOT EXISTS wa_threads (
        thread_id  VARCHAR(96)  NOT NULL PRIMARY KEY,
        kind       VARCHAR(12)  NOT NULL DEFAULT 'group',
        wa_id      VARCHAR(80)  NOT NULL DEFAULT '',
        title      VARCHAR(200) NOT NULL DEFAULT '',
        case_id    VARCHAR(20)  NOT NULL DEFAULT '',
        last_text  VARCHAR(280) NOT NULL DEFAULT '',
        last_at    TIMESTAMP    NULL,
        unread     INT UNSIGNED NOT NULL DEFAULT 0,
        created    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_wa_threads_last (last_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
    $pdo->exec("CREATE TABLE IF NOT EXISTS wa_messages (
        msg_id      BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
        thread_id   VARCHAR(96)  NOT NULL,
        wa_msg_id   VARCHAR(200) NULL DEFAULT NULL,
        direction   VARCHAR(4)   NOT NULL DEFAULT 'in',
        sender      VARCHAR(40)  NOT NULL DEFAULT '',
        sender_name VARCHAR(200) NOT NULL DEFAULT '',
        body        TEXT         NULL,
        msg_type    VARCHAR(20)  NOT NULL DEFAULT 'text',
        media_id    VARCHAR(200) NOT NULL DEFAULT '',
        status      VARCHAR(20)  NOT NULL DEFAULT '',
        case_id     VARCHAR(20)  NOT NULL DEFAULT '',
        sent_at     TIMESTAMP    NULL,
        created     TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uniq_wa_msg (wa_msg_id),
        INDEX idx_wa_msg_thread (thread_id, msg_id),
        INDEX idx_wa_msg_case (case_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
    $done = true;
    return ['wa_threads', 'wa_messages'];
}

// ── Threads ───────────────────────────────────────────────────────────────

/** Parses a thread id into ['kind','wa_id'] or null when unusable. */
function wa_parse_id(string $id): ?array {
    $id = trim($id);
    if (preg_match('/^group\s*:\s*(.+)$/i', $id, $m)) {
        $g = preg_replace('/\s+/', '', (string) $m[1]);
        return $g !== '' ? ['kind' => 'group', 'wa_id' => $g] : null;
    }
    $digits = preg_replace('/\D+/', '', str_starts_with($id, 'wa:') ? substr($id, 3) : $id);
    return strlen((string) $digits) >= 10 ? ['kind' => 'individual', 'wa_id' => (string) $digits] : null;
}

function wa_thread_row(string $id): ?array {
    $stmt = psri_db()->prepare('SELECT * FROM wa_threads WHERE thread_id = ?');
    $stmt->execute([$id]);
    $row = $stmt->fetch();
    return $row ?: null;
}

/** Creates the thread row if missing and fills in a title when one is known. */
function wa_thread_upsert(string $id, ?string $title = null, string $caseId = ''): ?array {
    $p = wa_parse_id($id);
    if ($p === null) return null;
    wa_ensure_tables();
    $row = wa_thread_row($id);
    if ($row) {
        $title = $title === null ? '' : trim($title);
        if ($title !== '' && (string) $row['title'] === '') {
            psri_db()->prepare('UPDATE wa_threads SET title = ? WHERE thread_id = ?')->execute([$title, $id]);
            $row['title'] = $title;
        }
        if ($caseId !== '' && (string) $row['case_id'] === '') {
            psri_db()->prepare('UPDATE wa_threads SET case_id = ? WHERE thread_id = ?')->execute([$caseId, $id]);
            $row['case_id'] = $caseId;
        }
        return $row;
    }
    $title = $title === null ? '' : trim($title);
    if ($title === '') $title = $p['kind'] === 'group' ? 'WhatsApp group' : $p['wa_id'];
    psri_db()->prepare('INSERT INTO wa_threads (thread_id, kind, wa_id, title, case_id) VALUES (?,?,?,?,?)')
        ->execute([$id, $p['kind'], $p['wa_id'], $title, $caseId]);
    return wa_thread_row($id);
}

function wa_thread_api(array $r): array {
    return [
        'id'       => (string) $r['thread_id'],
        'kind'     => (string) $r['kind'],
        'waId'     => (string) $r['wa_id'],
        'title'    => (string) $r['title'],
        'caseId'   => (string) $r['case_id'],
        'lastText' => (string) $r['last_text'],
        'lastAt'   => $r['last_at'] !== null ? (string) $r['last_at'] : '',
        'unread'   => (int) $r['unread'],
    ];
}

function wa_threads_list(int $limit = 50): array {
    wa_ensure_tables();
    $limit = max(1, min(200, $limit));
    $rows = psri_db()->query("SELECT * FROM wa_threads ORDER BY last_at IS NULL, last_at DESC, updated DESC LIMIT {$limit}")->fetchAll();
    return array_map('wa_thread_api', $rows);
}

function wa_thread_messages(string $threadId, int $limit = 100, int $beforeId = 0): array {
    wa_ensure_tables();
    $limit = max(1, min(200, $limit));
    $pdo = psri_db();
    if ($beforeId > 0) {
        $stmt = $pdo->prepare("SELECT * FROM wa_messages WHERE thread_id = ? AND msg_id < ? ORDER BY msg_id DESC LIMIT {$limit}");
        $stmt->execute([$threadId, $beforeId]);
    } else {
        $stmt = $pdo->prepare("SELECT * FROM wa_messages WHERE thread_id = ? ORDER BY msg_id DESC LIMIT {$limit}");
        $stmt->execute([$threadId]);
    }
    return array_map('wa_message_api', array_reverse($stmt->fetchAll()));
}

function wa_message_api(array $r): array {
    return [
        'id'         => (int) $r['msg_id'],
        'waId'       => (string) ($r['wa_msg_id'] ?? ''),
        'direction'  => (string) $r['direction'],
        'sender'     => (string) $r['sender'],
        'senderName' => (string) $r['sender_name'],
        'body'       => (string) $r['body'],
        'type'       => (string) $r['msg_type'],
        'status'     => (string) $r['status'],
        'at'         => ($r['sent_at'] ?? null) ? (string) $r['sent_at'] : (string) $r['created'],
    ];
}

/** Stores one message (ignores a duplicate wa_msg_id). Returns its row id. */
function wa_store_message(array $m): int {
    wa_ensure_tables();
    $direction = ($m['direction'] ?? 'in') === 'out' ? 'out' : 'in';
    $body = (string) ($m['body'] ?? '');
    $pdo = psri_db();
    $pdo->prepare('INSERT IGNORE INTO wa_messages
        (thread_id, wa_msg_id, direction, sender, sender_name, body, msg_type, media_id, status, case_id, sent_at)
        VALUES (?,?,?,?,?,?,?,?,?,?,?)')->execute([
        (string) $m['thread_id'],
        ($m['wa_msg_id'] ?? '') !== '' ? (string) $m['wa_msg_id'] : null,
        $direction,
        (string) ($m['sender'] ?? ''),
        (string) ($m['sender_name'] ?? ''),
        $body,
        (string) ($m['msg_type'] ?? 'text'),
        (string) ($m['media_id'] ?? ''),
        (string) ($m['status'] ?? ''),
        (string) ($m['case_id'] ?? ''),
        ($m['sent_at'] ?? null) ?: null,
    ]);
    $id = (int) $pdo->lastInsertId();
    if ($id > 0) {
        $summary = function_exists('mb_substr') ? mb_substr($body, 0, 280) : substr($body, 0, 280);
        $pdo->prepare('UPDATE wa_threads
            SET last_text = ?, last_at = COALESCE(?, last_at), unread = unread + ?
            WHERE thread_id = ?')->execute([$summary, ($m['sent_at'] ?? null) ?: null, $direction === 'in' ? 1 : 0, (string) $m['thread_id']]);
    }
    return $id;
}

function wa_message_by_row(int $msgId): ?array {
    $stmt = psri_db()->prepare('SELECT * FROM wa_messages WHERE msg_id = ?');
    $stmt->execute([$msgId]);
    $row = $stmt->fetch();
    return $row ? wa_message_api($row) : null;
}

function wa_mark_read(string $threadId): void {
    psri_db()->prepare('UPDATE wa_threads SET unread = 0 WHERE thread_id = ?')->execute([$threadId]);
}

// ── Send ──────────────────────────────────────────────────────────────────

/**
 * Sends one text into a thread ("group:<id>" or "<phone>") directly over the
 * Cloud API so the message id is captured for delivery statuses.
 * Returns [errorString, waMessageId].
 */
function wa_meta_send_text(string $to, string $text): array {
    $cfg = psri_config()['whatsapp'] ?? [];
    if (strtolower(trim((string) ($cfg['provider'] ?? ''))) !== 'meta') {
        // Generic provider: reuse the workflow sender — no message id available.
        return [wf_whatsapp_send($to, $text), ''];
    }
    $group = str_starts_with($to, 'group:');
    $body = [
        'messaging_product' => 'whatsapp',
        'recipient_type'    => $group ? 'group' : 'individual',
        'to'                => $group ? substr($to, 6) : $to,
        'type'              => 'text',
        'text'              => ['preview_url' => false, 'body' => $text],
    ];
    [, $res, $err] = wf_meta_api('POST', trim((string) ($cfg['phone_number_id'] ?? '')) . '/messages', $body);
    if ($err !== '') return [$err, ''];
    return ['', (string) ($res['messages'][0]['id'] ?? '')];
}

/** POST psri-wa-send body → stores the outbound message. */
function wa_send(array $in): array {
    $threadId = trim((string) ($in['threadId'] ?? ''));
    $text = trim((string) ($in['message'] ?? ''));
    if ($threadId === '') return ['error' => 'No conversation selected.'];
    if ($text === '') return ['error' => 'Please type a message first.'];
    $thread = wa_thread_row($threadId);
    if (!$thread) {
        $thread = wa_thread_upsert($threadId, trim((string) ($in['title'] ?? '')));
        if (!$thread) return ['error' => 'Unknown conversation.'];
    }
    $to = (string) $thread['kind'] === 'group' ? 'group:' . $thread['wa_id'] : (string) $thread['wa_id'];
    [$err, $waId] = wa_meta_send_text($to, $text);
    if ($err !== '') return ['error' => $err];
    $rowId = wa_store_message([
        'thread_id'  => $threadId,
        'wa_msg_id'  => $waId,
        'direction'  => 'out',
        'body'       => $text,
        'status'     => 'sent',
        'case_id'    => (string) $thread['case_id'],
        'sent_at'    => date('Y-m-d H:i:s'),
    ]);
    return ['message' => wa_message_by_row($rowId)];
}

// ── Groups API helper ─────────────────────────────────────────────────────

/** Lists the business number's groups (for Admin → mapping a desk to a group). */
function wa_groups(): array {
    $phoneId = trim((string) (psri_config()['whatsapp']['phone_number_id'] ?? ''));
    [$ok, $res] = wf_meta_api('GET', $phoneId . '/groups');
    if (!$ok) return [];
    $out = [];
    foreach (($res['data']['groups'] ?? []) as $g) {
        $id = (string) ($g['id'] ?? '');
        if ($id === '') continue;
        $out[] = ['id' => $id, 'subject' => (string) ($g['subject'] ?? ''), 'threadId' => 'group:' . $id];
    }
    return $out;
}

// ── Webhook ───────────────────────────────────────────────────────────────

/** GET psri-wa-webhook — Meta's subscription handshake. */
function wa_webhook_verify(): void {
    $mode = (string) ($_GET['hub_mode'] ?? '');
    $token = (string) ($_GET['hub_verify_token'] ?? '');
    $challenge = (string) ($_GET['hub_challenge'] ?? '');
    $expect = trim((string) (psri_config()['whatsapp']['verify_token'] ?? ''));
    if ($mode === 'subscribe' && $expect !== '' && hash_equals($expect, $token)) {
        header('Content-Type: text/plain');
        echo $challenge;
        exit;
    }
    error_log('[psri-wa] webhook verification failed');
    http_response_code(403);
    header('Content-Type: text/plain');
    echo 'forbidden';
    exit;
}

function wa_signature_ok(string $raw, string $secret): bool {
    $sent = (string) ($_SERVER['HTTP_X_HUB_SIGNATURE_256'] ?? '');
    if (!str_starts_with($sent, 'sha256=')) return false;
    return hash_equals('sha256=' . hash_hmac('sha256', $raw, $secret), $sent);
}

/** POST psri-wa-webhook — inbound messages and status updates from Meta. */
function wa_webhook_receive(): void {
    $raw = (string) file_get_contents('php://input');
    $secret = trim((string) (psri_config()['whatsapp']['app_secret'] ?? ''));
    if ($secret !== '' && !wa_signature_ok($raw, $secret)) {
        error_log('[psri-wa] rejected webhook with a bad signature');
        http_response_code(401);
        header('Content-Type: text/plain');
        echo 'invalid signature';
        exit;
    }
    try {
        $data = json_decode($raw, true) ?: [];
        foreach (($data['entry'] ?? []) as $entry) {
            foreach (($entry['changes'] ?? []) as $change) {
                $v = $change['value'] ?? null;
                if (!is_array($v)) continue;
                $names = [];
                foreach (($v['contacts'] ?? []) as $c) {
                    $wa = (string) ($c['wa_id'] ?? '');
                    if ($wa !== '') $names[$wa] = (string) ($c['profile']['name'] ?? '');
                }
                foreach (($v['messages'] ?? []) as $msg) {
                    if (is_array($msg)) wa_ingest_message($msg, $names);
                }
                foreach (($v['statuses'] ?? []) as $st) {
                    if (is_array($st)) wa_ingest_status($st);
                }
            }
        }
    } catch (Throwable $e) {
        error_log('[psri-wa] webhook: ' . $e->getMessage());
    }
    header('Content-Type: text/plain');
    echo 'ok';
    exit;
}

function wa_ingest_message(array $msg, array $names): void {
    $groupId = trim((string) ($msg['group_id'] ?? ''));
    $from = preg_replace('/\D+/', '', (string) ($msg['from'] ?? '')) ?: '';
    if ($groupId !== '') {
        $threadId = 'group:' . $groupId;
        $waId = $groupId;
        $kind = 'group';
        $title = '';
    } else {
        if ($from === '') return;
        $threadId = 'wa:' . $from;
        $waId = $from;
        $kind = 'individual';
        $title = (string) ($names[$from] ?? '');
    }
    wa_thread_upsert($threadId, $title);
    $type = (string) ($msg['type'] ?? 'text');
    if ($type === 'text') {
        $body = (string) ($msg['text']['body'] ?? '');
    } elseif (is_array($msg[$type] ?? null) && isset($msg[$type]['caption'])) {
        $body = (string) $msg[$type]['caption'];
    } else {
        $body = '[' . $type . ']';
    }
    $ts = !empty($msg['timestamp']) ? date('Y-m-d H:i:s', (int) $msg['timestamp']) : date('Y-m-d H:i:s');
    $rowId = wa_store_message([
        'thread_id'   => $threadId,
        'wa_msg_id'   => (string) ($msg['id'] ?? ''),
        'direction'   => 'in',
        'sender'      => $from,
        'sender_name' => (string) ($names[$from] ?? ''),
        'body'        => $body,
        'msg_type'    => $type,
        'media_id'    => (string) ($msg[$type]['id'] ?? ''),
        'sent_at'     => $ts,
    ]);
    psri_db()->prepare('UPDATE wa_threads SET kind = ?, wa_id = ? WHERE thread_id = ?')
        ->execute([$kind, $waId, $threadId]);
    // Run the designer's "WhatsApp Message" workflows. Text only, and only for
    // a newly stored row, so a Meta webhook retry never replies twice.
    if ($rowId > 0 && $type === 'text' && trim($body) !== '') {
        wa_fire_message_workflows($threadId, $from, (string) ($names[$from] ?? ''), $body);
    }
}

/**
 * Fires the "WhatsApp Message" workflows for a newly received message. The
 * matching CRM contact (when the number is known) and the message are handed to
 * the runner so the designer can branch on {{wa.*}} and reply.
 */
function wa_fire_message_workflows(string $threadId, string $from, string $senderName, string $body): void {
    if (!function_exists('wf_fire')) return;
    try {
        wf_fire('wa-message', wa_contact_for_phone($from) ?: [], [], ['wa' => [
            'text' => $body, 'from' => $from, 'senderName' => $senderName, 'threadId' => $threadId,
        ]]);
    } catch (Throwable $e) {
        error_log('[psri-wa] workflow: ' . $e->getMessage());
    }
}

/** Finds the CRM contact for a WhatsApp number (indexed lookups on the last 10 digits), or null. */
function wa_contact_for_phone(string $digits): ?array {
    $d = (string) preg_replace('/\D+/', '', $digits);
    if (strlen($d) < 10) return null;
    $last10 = substr($d, -10);
    $pdo = psri_db();
    foreach ([$last10, '91' . $last10, '0' . $last10] as $candidate) {
        $st = $pdo->prepare('SELECT * FROM contacts WHERE mobile = ? LIMIT 1');
        $st->execute([$candidate]);
        $row = $st->fetch();
        if ($row) return function_exists('wf_contact_from_row') ? wf_contact_from_row($row) : ['id' => (string) $row['contact_id'], 'mobile' => (string) $row['mobile']];
    }
    return null;
}

function wa_ingest_status(array $st): void {
    $waId = (string) ($st['id'] ?? '');
    $status = (string) ($st['status'] ?? '');
    if ($waId === '' || $status === '') return;
    psri_db()->prepare('UPDATE wa_messages SET status = ? WHERE wa_msg_id = ?')->execute([$status, $waId]);
}
