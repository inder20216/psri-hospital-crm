<?php
/**
 * ai_polish.php — the three small AI helpers on the Cases form, replacing
 * the n8n psri-summary-polish / psri-case-validate / psri-procedure-polish
 * webhooks. These never read/write the sheets — they only ever called
 * OpenAI — so this is a logic port, not a data migration. Reuses the same
 * OpenAI credential as the Support assistant (see support_ai.php /
 * psri_config()['support']).
 *
 * Ported 1:1 from n8n_psri_summary_polish.json / n8n_psri_case_validate.json /
 * n8n_psri_procedure_polish.json.
 */
declare(strict_types=1);

require_once __DIR__ . '/db.php';
require_once __DIR__ . '/runner.php'; // wf_http

/** One-shot OpenAI chat call. Returns the trimmed reply, or null if unconfigured/unavailable. */
function ps_ai_chat(string $prompt, int $maxTokens = 500): ?string {
    $cfg = psri_config()['support'] ?? [];
    $key = trim((string) ($cfg['api_key'] ?? ''));
    if ($key === '') return null;

    $model   = trim((string) ($cfg['model'] ?? '')) ?: 'gpt-4o-mini';
    $baseUrl = rtrim(trim((string) ($cfg['base_url'] ?? '')), '/') ?: 'https://api.openai.com/v1';

    [$code, , $resp] = wf_http('POST', $baseUrl . '/chat/completions', [
        'model'       => $model,
        'messages'    => [['role' => 'user', 'content' => $prompt]],
        'temperature' => 0.2,
        'max_tokens'  => $maxTokens,
    ], ['Authorization: Bearer ' . $key], 30);

    if ($code < 200 || $code >= 300) { error_log('[psri-ai] upstream HTTP ' . $code); return null; }

    $json = json_decode((string) $resp, true);
    $content = trim((string) ($json['choices'][0]['message']['content'] ?? ''));
    return $content !== '' ? $content : null;
}

/** Returns ['error'=>…] or ['polished'=>…]. On AI failure, returns the original text unchanged (never blocks saving). */
function ps_summary_polish(array $b): array {
    $summary = trim((string) ($b['summary'] ?? ''));
    if ($summary === '') return ['error' => 'summary is required'];

    $context = implode(', ', array_filter([
        (string) ($b['callFor'] ?? ''), (string) ($b['channel'] ?? ''),
        (string) ($b['typeOfEnquiry'] ?? ''), (string) ($b['specialty'] ?? ''),
    ]));

    $prompt = "You are a professional CRM note editor for a hospital call center.\n"
        . "Correct the grammar, spelling, and clarity of the agent notes below.\n"
        . "Context: " . ($context !== '' ? $context : 'hospital call center case') . ".\n"
        . "Rules:\n"
        . "- Keep ALL facts exactly as the agent wrote them — do not add, remove, or assume any information.\n"
        . "- Fix grammar, spelling, and sentence structure only.\n"
        . "- Keep the tone professional and concise.\n"
        . "- Return only the corrected text, no explanation, no quotes.\n\n"
        . "Agent notes:\n{$summary}";

    return ['polished' => ps_ai_chat($prompt, 500) ?? $summary];
}

/** Always returns a result (never an error) — a QA hint, not a save-blocking validation. */
function ps_case_validate(array $b): array {
    $fieldLabels = [
        'channel' => 'Channel', 'typeOfCall' => 'Type of Call', 'callFor' => 'Call For',
        'typeOfEnquiry' => 'Type of Enquiry', 'specialty' => 'Specialty', 'doctorName' => 'Doctor',
        'priority' => 'Priority', 'status' => 'Status', 'appointmentDate' => 'Appointment Date',
        'appointmentStatus' => 'Appointment Status', 'isCallback' => 'Callback Arranged',
        'callbackDatetime' => 'Callback Date/Time', 'isHighValue' => 'Marked High Value', 'summary' => 'Summary',
    ];
    $lines = [];
    foreach ($fieldLabels as $key => $label) {
        if (!empty($b[$key])) $lines[] = "{$label}: {$b[$key]}";
    }
    $fields = implode("\n", $lines);

    $prompt = "You are a QA assistant for a hospital CRM call center.\n"
        . "Analyse the following case data and return a JSON object.\n\n"
        . "Case Data:\n{$fields}\n\n"
        . "Return ONLY valid JSON (no markdown, no code block) with exactly these keys:\n"
        . "- flags: array of strings — each is a specific actionable issue the agent should fix before closing the case (e.g. priority not set, appointment date missing for an Appointment case, status still open, callback date in the past). Empty array if the case looks complete.\n"
        . "- isHighValue: boolean — true if this looks like a high-value case (surgery, procedure, insurance query, international patient, high-cost treatment, VIP).\n"
        . "- highValueReason: string — brief reason (empty string if isHighValue is false).\n"
        . "- suggestNextCall: boolean — true if a follow-up call is recommended based on the case details.\n"
        . "- nextCallSuggestion: string — what to follow up on and roughly when (empty string if suggestNextCall is false).\n\n"
        . "JSON:";

    $fallback = [
        'flags' => ['AI could not analyse this case — please review manually.'],
        'isHighValue' => false, 'highValueReason' => '',
        'suggestNextCall' => false, 'nextCallSuggestion' => '',
    ];

    $raw = ps_ai_chat($prompt, 400);
    if ($raw === null) return $fallback;

    $clean = (string) preg_replace('/^```json\s*|^```\s*|\s*```$/i', '', trim($raw));
    $parsed = json_decode($clean, true);
    if (!is_array($parsed)) return $fallback;

    return [
        'flags'              => is_array($parsed['flags'] ?? null) ? $parsed['flags'] : [],
        'isHighValue'        => !empty($parsed['isHighValue']),
        'highValueReason'    => (string) ($parsed['highValueReason'] ?? ''),
        'suggestNextCall'    => !empty($parsed['suggestNextCall']),
        'nextCallSuggestion' => (string) ($parsed['nextCallSuggestion'] ?? ''),
    ];
}

/** Returns ['error'=>…] or ['corrected'=>…, 'likelyDuplicateOf'=>…] (both '' on AI failure). */
function ps_procedure_polish(array $b): array {
    $value = trim((string) ($b['value'] ?? ''));
    if ($value === '') return ['error' => 'value is required'];

    $existing = is_array($b['existingValues'] ?? null) ? array_slice(array_values(array_filter($b['existingValues'])), 0, 300) : [];
    $list = $existing ? implode("\n", array_map(static fn ($v) => "- {$v}", $existing)) : '(list is currently empty)';

    $prompt = "You are a medical terminology editor for a hospital CRM's \"Name of Procedure\" picklist.\n"
        . "An agent typed a new procedure name that doesn't exactly match any existing option. Your job:\n"
        . "1. Fix spelling and capitalize it properly as a medical procedure name (Title Case, correct medical terms/abbreviations — e.g. \"mri\" -> \"MRI\", \"ct guided byopsy\" -> \"CT Guided Biopsy\").\n"
        . "2. Check if it's very likely the SAME procedure as one already in the existing list below (different wording/spelling for the same thing) — if so, name that exact existing value. If it's genuinely a different/new procedure, leave this empty.\n\n"
        . "Existing values in this list:\n{$list}\n\n"
        . "Agent typed: \"{$value}\"\n\n"
        . "Return ONLY valid JSON, no markdown, no explanation:\n"
        . '{"corrected": "<spelling/formatting-corrected version>", "likelyDuplicateOf": "<exact existing value if it\'s probably the same procedure, else empty string>"}';

    $raw = ps_ai_chat($prompt, 200);
    if ($raw === null) return ['corrected' => '', 'likelyDuplicateOf' => ''];

    $parsed = preg_match('/\{[\s\S]*\}/', $raw, $m) ? json_decode($m[0], true) : null;

    return [
        'corrected'         => trim((string) ($parsed['corrected'] ?? '')),
        'likelyDuplicateOf' => trim((string) ($parsed['likelyDuplicateOf'] ?? '')),
    ];
}
