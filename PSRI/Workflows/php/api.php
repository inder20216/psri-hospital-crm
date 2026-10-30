<?php
/**
 * api.php — HTTP entry point for the PSRI workflow automation (replaces the
 * n8n psri-workflow-* webhooks). Routed by the last URL path segment, so it
 * works both as  .../api.php/psri-workflow-get  (Apache/nginx PATH_INFO)
 * and behind  php -S localhost:8000 api.php  (router mode, local dev).
 *
 *   GET  psri-users                → { success, users:[…] } (login lookup — AuthContext matches by email; no password check, Entra ID only)
 *   POST psri-user-add    {name,contact,email,password,role,sparktgExtension} → { success, id, message } (400 + error on invalid/duplicate email)
 *   POST psri-user-update {id,…}                                             → { success, id, message } (400 + error on invalid/not found/would leave zero Super Admins)
 *
 *   GET  psri-sparktg-poll?callId=   → { success, found, record? } (queries SparkTG's own API directly — see sparktg.php)
 *
 *   GET  psri-contacts?q=                      → { success, contacts:[…] } (list/search; q empty = 50 most recent)
 *   POST psri-contact-add    {name,mobile,contactType,…}  → { success, id, message } (400 + error on invalid/duplicate)
 *   POST psri-contact-update {id,…}                       → { success, id, message } (400 + error on invalid/not found)
 *   GET  psri-cases?q=|status=|callTxnIds=                → { success, cases:[…], count } (priority: callTxnIds > status > q > 50 most recent)
 *   GET  psri-contacts-export?from=&to=  → CSV download, every column, all rows (from/to = Y-m-d, optional)
 *   GET  psri-cases-export?from=&to=     → CSV download, every column, all rows (from/to = Y-m-d, optional)
 *   GET  psri-high-value-export?from=&to= → CSV download, cases WHERE is_high_value=1 only
 *   GET  psri-appreciation-list?status=   → { success, cases:[…] } (status: pending|approved|rejected, blank=all) — includes recordingUrl
 *   POST psri-appreciation-review {caseId,approved,reviewedBy} → { success, id, message } (400 + error on invalid)
 *   GET  psri-prospects?status=&limit=    → { success, prospects:[…], count } (status defaults to 'Followup')
 *   POST psri-prospect-update {id,callStatus,leadStatus,finalStatus,nextCallAt,remarks,assignedTo,agentId,agentName} → { success, id, message }
 *   POST psri-prospect-call-attempt {id,agentId,agentName} → { success, id, message }
 *   GET  psri-prospect-activity?prospectId= → { success, activity:[…] }
 *
 *   GET  psri-picklists                    → { success, picklists:{listName:[values…]} }
 *   POST psri-picklist-add {listName,value}            → { success, listName, value, message } (400 + error on duplicate)
 *   GET  psri-dependencies                 → { success, dependencies:[{mainField,mainValue,subField,subValue}], count }
 *   POST psri-dependency-add {mainField,mainValue,subField,subValue} → { success, …, message } (400 + error on duplicate)
 *   POST psri-doctor-search {query,searchBy}           → { success, count, fuzzyMatch, results:[…] } (searchBy: 'doctor'|'specialty'; substring match, Levenshtein fuzzy fallback)
 *   POST psri-specialty-search {specialty}             → { success, fuzzyMatch, groups:[{specialty,doctors:[…],summaryEn,summaryHi}] } (live OpenAI explanation when exactly one group matches)
 *   GET  psri-guidance                     → { success, guidance:[{callFor,field,tip,script}] }
 *   GET  psri-specialty-summaries          → { success, summaries:[{specialty,en,hi}] }
 *   POST psri-summary-polish {summary,callFor?,channel?,typeOfEnquiry?,specialty?} → { success, polished } (400 if summary missing; falls back to original text on AI failure)
 *   POST psri-case-validate {…case fields}             → { success, flags:[…], isHighValue, highValueReason, suggestNextCall, nextCallSuggestion } (never errors — a QA hint, not a save gate)
 *   POST psri-procedure-polish {value,existingValues?}  → { success, corrected, likelyDuplicateOf } (400 if value missing)
 *
 *   POST psri-picklist-suggest {listName,value,agentId,agentName,force?} → { success, id, message } OR
 *                                             { success:false, needsConfirmation:true, similar:[…] } (HTTP 200, not an error — ask the agent, then resend with force:true)
 *   GET  psri-picklist-suggestions?status= → { success, suggestions:[…] } (status: pending|approved|rejected, blank=all)
 *   POST psri-picklist-suggestion-review {id,approved,reviewerId,reviewerName} → { success, id, message, warning? }
 *
 *   Support assistant:
 *   POST psri-support-ask {question, history?}  (docs = server's support_kb.md)
 *                                             → { success, answer, documented }
 *                                             (documented:false = the docs don't
 *                                             cover it; success:false with error
 *                                             ai-not-configured/ai-unavailable
 *                                             is a server gap, not a user error)
 *
 *   WhatsApp chat (Cloud API) — see wa.php:
 *   GET  psri-wa-threads?limit=          → { success, threads:[…] }
 *   GET  psri-wa-thread?id=&title=&limit= → { success, thread, messages:[…] } (creates the thread if new)
 *   POST psri-wa-send {threadId,message}  → { success, message }   (threadId: "group:<id>" | "wa:<phone>")
 *   GET  psri-wa-groups                   → { success, groups:[…] } (Meta Groups API)
 *   POST psri-wa-followup {mobile,message,…} → fires "Follow-up Request" workflows
 *   GET  psri-wa-webhook                  → Meta verification handshake (raw)
 *   POST psri-wa-webhook                  → inbound messages + statuses (raw); fires "WhatsApp Message" workflows
 *
 *   GET  psri-workflow-get                    → { success, workflows:[…] }
 *   POST psri-workflow-save        {id?,name,trigger,status,config,updatedBy}
 *                                             → { success, workflow:{id,name,status} }
 *   GET  psri-workflow-runs?id=&limit=        → { success, runs:[…] }
 *   POST psri-contact-workflow-run {contact:{id,…}}        → { success, ran:[…] }
 *   POST psri-case-workflow-run    {case:{id,contactId,…}} → { success, ran:[…] }
 *   POST psri-workflow-test        {graph, trigger?, contact?, case?, wa?}
 *                                             → dry run: walks + evaluates, writes nothing
 *
 * CLI:
 *   php api.php migrate                         create the runner tables
 *   php api.php test <graph.json> [payload.json] dry-run a graph (payload: {contact,case})
 *
 * User-facing errors are always generic; details go to the PHP error log.
 */
declare(strict_types=1);

require_once __DIR__ . '/runner.php';
require_once __DIR__ . '/users.php';
require_once __DIR__ . '/contacts.php';
require_once __DIR__ . '/cases.php';
require_once __DIR__ . '/reports.php';
require_once __DIR__ . '/prospects.php';
require_once __DIR__ . '/picklists.php';
require_once __DIR__ . '/dependencies.php';
require_once __DIR__ . '/doctors.php';
require_once __DIR__ . '/reference.php';
require_once __DIR__ . '/ai_polish.php';
require_once __DIR__ . '/picklist_suggestions.php';
require_once __DIR__ . '/support_ai.php';
require_once __DIR__ . '/wa.php';
require_once __DIR__ . '/sparktg.php';

if (PHP_SAPI === 'cli') {
    $cmd = $argv[1] ?? '';
    if ($cmd === 'migrate') {
        echo json_encode(['tables' => array_values(array_unique(array_merge(psri_migrate(), wa_ensure_tables())))], JSON_PRETTY_PRINT) . "\n";
    } elseif ($cmd === 'test' && is_file($argv[2] ?? '')) {
        $graph = json_decode((string) file_get_contents($argv[2]), true);
        $payload = is_file($argv[3] ?? '') ? json_decode((string) file_get_contents($argv[3]), true) : [];
        $trigger = api_trigger_of($graph);
        [$contact, $case] = api_context($trigger, $payload['contact'] ?? [], $payload['case'] ?? []);
        echo json_encode(wf_fire($trigger, $contact, $case, ['graph' => $graph, 'dryRun' => true]), JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . "\n";
    } elseif ($cmd === 'support-ask' && ($argv[2] ?? '') !== '') {
        // Checks the Support assistant's AI connection.
        //   php api.php support-ask "what is a case?"
        // The documentation is the server's own support_kb.md
        // (generated from supportContent.js on every build), so a
        // question covered by the guides is the useful test — it
        // proves the whole round trip, key included.
        $res = ps_support_ask(['question' => $argv[2]]);
        if (isset($res['error'])) { fwrite(STDERR, $res['error'] . "\n"); exit(1); }
        echo ($res['documented'] ? '' : '(not in the documentation) ') . $res['answer'] . "\n";
        exit(0);
    } elseif ($cmd === 'wa-test' && ($argv[2] ?? '') !== '') {
        // Sends one real WhatsApp template (default: Meta's pre-approved hello_world) to check the credentials.
        $to = wf_wa_recipient($argv[2]);
        if ($to === '') { fwrite(STDERR, "invalid number or group\n"); exit(2); }
        $tpl = ['name' => $argv[3] ?? 'hello_world', 'language' => $argv[4] ?? 'en_US', 'params' => array_slice($argv, 5)];
        $err = wf_whatsapp_send($to, '', $tpl);
        echo $err === '' ? "sent {$tpl['name']} to {$to}\n" : "failed: {$err}\n";
        exit($err === '' ? 0 : 1);
    } elseif ($cmd === 'wa-group-create' && trim($argv[2] ?? '') !== '') {
        // Groups API: the new group's id arrives by webhook, so look it up in the group list afterwards.
        $phoneId = trim((string) (psri_config()['whatsapp']['phone_number_id'] ?? ''));
        $body = ['messaging_product' => 'whatsapp', 'subject' => trim($argv[2])];
        if (trim($argv[3] ?? '') !== '') $body['description'] = trim($argv[3]);
        [$ok, , $err] = wf_meta_api('POST', "{$phoneId}/groups", $body);
        echo $ok ? "group “{$body['subject']}” requested — run: php api.php wa-groups\n" : "failed: {$err}\n";
        exit($ok ? 0 : 1);
    } elseif ($cmd === 'wa-groups') {
        // Lists the business number's groups with the "To" value for a WhatsApp node and the invite link to share.
        $phoneId = trim((string) (psri_config()['whatsapp']['phone_number_id'] ?? ''));
        [$ok, $res, $err] = wf_meta_api('GET', "{$phoneId}/groups");
        if (!$ok) { echo "failed: {$err}\n"; exit(1); }
        $groups = $res['data']['groups'] ?? [];
        if (!$groups) echo "no groups yet — create one: php api.php wa-group-create \"Billing Desk\"\n";
        foreach ($groups as $g) {
            [, $link] = wf_meta_api('GET', rawurlencode((string) $g['id']) . '/invite_link');
            echo ($g['subject'] ?? '(no subject)'), "\n  To:     group:{$g['id']}\n  Invite: ", ($link['invite_link'] ?? '(could not fetch)'), "\n";
        }
        exit(0);
    } else {
        fwrite(STDERR, "usage: php api.php migrate | test <graph.json> [payload.json] | wa-test <number|group:ID> [template] [language] [values…]\n"
            . "       | wa-group-create \"<subject>\" [\"<description>\"] | wa-groups\n"
            . "       | support-ask \"<question>\"\n");
        exit(2);
    }
    exit(0);
}

// ── Meta WhatsApp webhook ─────────────────────────────────────────────────
// Handled before the JSON/CORS wrapper: Meta needs a raw challenge on GET and
// a plain "ok" on POST, and it only ever calls this one URL.
if (basename((string) parse_url($_SERVER['REQUEST_URI'] ?? '', PHP_URL_PATH)) === 'psri-wa-webhook') {
    if (strtoupper((string) ($_SERVER['REQUEST_METHOD'] ?? 'GET')) === 'GET') wa_webhook_verify();
    wa_webhook_receive();
}

function api_out(array $data, int $code = 200): void {
    http_response_code($code);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit(0);
}

function api_trigger_of(?array $graph): string {
    foreach (($graph['nodes'] ?? []) as $n) {
        $key = array_search($n['data']['actionType'] ?? '', WF_TRIGGER_NODE, true);
        if ($key !== false) return $key;
    }
    return 'contact-created';
}

/**
 * Builds the {contact, case} context. The stored contact row is the source of
 * truth (so a case trigger still sees the contact's email, city, …); payload
 * fields fill in anything the table doesn't hold.
 */
function api_context(string $trigger, array $contact, array $case): array {
    if ($case) {
        $case['caseId'] = $case['caseId'] ?? $case['id'] ?? '';
        $contact += array_filter([
            'id' => $case['contactId'] ?? '', 'name' => $case['contactName'] ?? '', 'mobile' => $case['contactMobile'] ?? '',
        ], fn ($v) => $v !== '');
    }
    $stored = wf_load_contact(wf_scalar($contact['id'] ?? ''));
    return [$stored ? array_merge($contact, $stored) : $contact, $case];
}

$origin = psri_config()['cors_origin'];
header('Access-Control-Allow-Origin: ' . $origin);
if ($origin !== '*') header('Vary: Origin');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') { http_response_code(204); exit(0); }

$route = basename((string) parse_url($_SERVER['REQUEST_URI'] ?? '', PHP_URL_PATH));
$body = json_decode((string) file_get_contents('php://input'), true);
if (!is_array($body)) $body = [];

try {
    switch ($route) {
        case 'psri-users':
            api_out(['success' => true, 'users' => users_list()]);

        case 'psri-user-add':
            $res = users_add($body);
            if (isset($res['error'])) api_out(['success' => false, 'error' => $res['error']], 400);
            api_out(['success' => true] + $res);

        case 'psri-user-update':
            $res = users_update($body);
            if (isset($res['error'])) api_out(['success' => false, 'error' => $res['error']], 400);
            api_out(['success' => true] + $res);

        case 'psri-sparktg-poll':
            api_out(['success' => true] + sparktg_poll((string) ($_GET['callId'] ?? '')));

        case 'psri-contacts':
            api_out(['success' => true, 'contacts' => contacts_list((string) ($_GET['q'] ?? ''))]);

        case 'psri-contact-add':
            $res = contacts_add($body);
            if (isset($res['error'])) api_out(['success' => false, 'error' => $res['error']], 400);
            api_out(['success' => true] + $res);

        case 'psri-contact-update':
            $res = contacts_update($body);
            if (isset($res['error'])) api_out(['success' => false, 'error' => $res['error']], 400);
            api_out(['success' => true] + $res);

        case 'psri-cases':
            $cases = cases_list($_GET);
            api_out(['success' => true, 'cases' => $cases, 'count' => count($cases)]);

        case 'psri-case-add':
            $res = cases_add($body);
            if (isset($res['error'])) api_out(['success' => false, 'error' => $res['error']], 400);
            api_out(['success' => true] + $res);

        case 'psri-case-update':
            $res = cases_update($body);
            if (isset($res['error'])) api_out(['success' => false, 'error' => $res['error']], 400);
            api_out(['success' => true] + $res);

        case 'psri-contacts-export':
            report_export_csv('contacts', (string) ($_GET['from'] ?? ''), (string) ($_GET['to'] ?? ''));
            exit(0);

        case 'psri-cases-export':
            report_export_csv('cases', (string) ($_GET['from'] ?? ''), (string) ($_GET['to'] ?? ''));
            exit(0);

        case 'psri-high-value-export':
            report_export_csv('cases', (string) ($_GET['from'] ?? ''), (string) ($_GET['to'] ?? ''), 'is_high_value = 1', 'high_value_cases');
            exit(0);

        case 'psri-appreciation-list':
            api_out(['success' => true, 'cases' => cases_appreciation_list((string) ($_GET['status'] ?? ''))]);

        case 'psri-appreciation-review':
            $res = cases_appreciation_review($body);
            if (isset($res['error'])) api_out(['success' => false, 'error' => $res['error']], 400);
            api_out(['success' => true] + $res);

        case 'psri-prospects':
            $prospects = prospects_list((string) ($_GET['status'] ?? ''), (int) ($_GET['limit'] ?? 0));
            api_out(['success' => true, 'prospects' => $prospects, 'count' => count($prospects)]);

        case 'psri-prospect-update':
            $res = prospects_update($body);
            if (isset($res['error'])) api_out(['success' => false, 'error' => $res['error']], 400);
            api_out(['success' => true] + $res);

        case 'psri-prospect-call-attempt':
            $res = prospects_call_attempt($body);
            if (isset($res['error'])) api_out(['success' => false, 'error' => $res['error']], 400);
            api_out(['success' => true] + $res);

        case 'psri-prospect-activity':
            api_out(['success' => true, 'activity' => prospects_activity_list((string) ($_GET['prospectId'] ?? ''))]);

        case 'psri-picklists':
            api_out(['success' => true, 'picklists' => picklists_list()]);

        case 'psri-picklist-add':
            $res = picklists_add($body);
            if (isset($res['error'])) api_out(['success' => false, 'error' => $res['error']], 400);
            api_out(['success' => true] + $res);

        case 'psri-dependencies':
            $deps = dependencies_list();
            api_out(['success' => true, 'dependencies' => $deps, 'count' => count($deps)]);

        case 'psri-dependency-add':
            $res = dependencies_add($body);
            if (isset($res['error'])) api_out(['success' => false, 'error' => $res['error']], 400);
            api_out(['success' => true] + $res);

        case 'psri-doctor-search':
            api_out(doctors_search($body));

        case 'psri-specialty-search':
            api_out(specialty_search($body));

        case 'psri-guidance':
            api_out(['success' => true, 'guidance' => guidance_list()]);

        case 'psri-specialty-summaries':
            api_out(['success' => true, 'summaries' => specialty_summaries_list()]);

        case 'psri-summary-polish':
            $res = ps_summary_polish($body);
            if (isset($res['error'])) api_out(['success' => false, 'error' => $res['error']], 400);
            api_out(['success' => true] + $res);

        case 'psri-case-validate':
            api_out(['success' => true] + ps_case_validate($body));

        case 'psri-procedure-polish':
            $res = ps_procedure_polish($body);
            if (isset($res['error'])) api_out(['success' => false, 'error' => $res['error']], 400);
            api_out(['success' => true] + $res);

        case 'psri-picklist-suggest':
            $res = ps_suggest($body);
            if (isset($res['error'])) api_out(['success' => false, 'error' => $res['error']], 400);
            if (!empty($res['needsConfirmation'])) api_out(['success' => false] + $res, 200);
            api_out(['success' => true] + $res);

        case 'psri-picklist-suggestions':
            api_out(['success' => true, 'suggestions' => ps_list((string) ($_GET['status'] ?? ''))]);

        case 'psri-picklist-suggestion-review':
            $res = ps_review($body);
            if (isset($res['error'])) api_out(['success' => false, 'error' => $res['error']], 400);
            api_out(['success' => true] + $res);

        case 'psri-support-ask':
            $res = ps_support_ask($body);
            if (isset($res['error'])) {
                // "question is required" is the caller's fault; the rest
                // are a setup gap or an upstream failure, so they are
                // answered 200 with success:false to degrade gracefully.
                if ($res['error'] === 'question is required') api_out(['success' => false, 'error' => $res['error']], 400);
                api_out(['success' => false, 'error' => $res['error']], 200);
            }
            api_out(['success' => true] + $res);

        case 'psri-workflow-get':
            api_out(['success' => true, 'workflows' => wf_list()]);

        case 'psri-workflow-save':
            $res = wf_save($body);
            if (isset($res['error'])) api_out(['success' => false, 'error' => $res['error']], 400);
            api_out(['success' => true] + $res);

        case 'psri-workflow-runs':
            api_out(['success' => true, 'runs' => wf_runs((string) ($_GET['id'] ?? ''), (int) ($_GET['limit'] ?? 40))]);

        case 'psri-contact-workflow-run':
        case 'psri-case-workflow-run':
            $trigger = $route === 'psri-case-workflow-run' ? 'case-created' : 'contact-created';
            $contact = is_array($body['contact'] ?? null) ? $body['contact'] : [];
            $case = is_array($body['case'] ?? null) ? $body['case'] : [];
            if ($trigger === 'contact-created' && empty($contact['id'])) api_out(['success' => false, 'error' => 'contact.id is required'], 400);
            if ($trigger === 'case-created' && empty($case['id']) && empty($case['caseId'])) api_out(['success' => false, 'error' => 'case.id is required'], 400);
            [$contact, $case] = api_context($trigger, $contact, $case);
            api_out(['success' => true] + wf_fire($trigger, $contact, $case));

        case 'psri-workflow-test':
            $graph = is_array($body['graph'] ?? null) ? $body['graph'] : null;
            if (!$graph || !is_array($graph['nodes'] ?? null)) api_out(['success' => false, 'error' => 'graph is required'], 400);
            $trigger = isset(WF_TRIGGER_NODE[$body['trigger'] ?? '']) ? $body['trigger'] : api_trigger_of($graph);
            [$contact, $case] = api_context($trigger, is_array($body['contact'] ?? null) ? $body['contact'] : [], is_array($body['case'] ?? null) ? $body['case'] : []);
            $opts = ['graph' => $graph, 'dryRun' => true];
            if (is_array($body['wa'] ?? null)) $opts['wa'] = $body['wa'];
            api_out(['success' => true] + wf_fire($trigger, $contact, $case, $opts));

        case 'psri-wa-threads':
            api_out(['success' => true, 'threads' => wa_threads_list((int) ($_GET['limit'] ?? 50))]);

        case 'psri-wa-thread': {
            $id = trim((string) ($_GET['id'] ?? ''));
            if ($id === '') api_out(['success' => false, 'error' => 'id is required'], 400);
            $thread = wa_thread_row($id) ?: wa_thread_upsert($id, trim((string) ($_GET['title'] ?? '')), trim((string) ($_GET['caseId'] ?? '')));
            if (!$thread) api_out(['success' => false, 'error' => 'Unknown conversation'], 400);
            wa_mark_read($id);
            api_out([
                'success'  => true,
                'thread'   => wa_thread_api($thread),
                'messages' => wa_thread_messages($id, (int) ($_GET['limit'] ?? 100), (int) ($_GET['before'] ?? 0)),
            ]);
        }

        case 'psri-wa-send':
            $res = wa_send($body);
            if (isset($res['error'])) api_out(['success' => false, 'error' => $res['error']], 400);
            api_out(['success' => true] + $res);

        case 'psri-wa-groups':
            api_out(['success' => true, 'groups' => wa_groups()]);

        case 'psri-wa-followup': {
            // Fires the "Follow-up Request" workflows — the complaint system
            // pushes a follow-up out to a customer. The whole body is available
            // to the graph as {{wa.*}} (plus mobile/message normalised to from/text).
            $from = trim((string) ($body['from'] ?? $body['mobile'] ?? ''));
            $text = trim((string) ($body['text'] ?? $body['message'] ?? ''));
            if ($from === '' || $text === '') api_out(['success' => false, 'error' => 'mobile and message are required'], 400);
            $wa = $body;
            $wa['from'] = $from;
            $wa['text'] = $text;
            api_out(['success' => true] + wf_fire('wa-followup', wa_contact_for_phone($from) ?: [], [], ['wa' => $wa]));
        }

        default:
            api_out(['success' => false, 'error' => 'Not found'], 404);
    }
} catch (Throwable $e) {
    error_log('[psri-workflow] ' . $route . ': ' . $e->getMessage());
    api_out(['success' => false, 'error' => 'Something went wrong. Please try again.'], 500);
}
