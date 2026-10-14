<?php
/**
 * support_ai.php — the Support assistant's AI fallback.
 *
 * The assistant answers from a written knowledge base first
 * (supportContent.js, bundled with the app, so those answers are
 * instant and work offline). Anything that does not match a documented
 * topic comes here: the question plus that same knowledge base is sent
 * to an OpenAI-compatible chat API, grounded on the documentation so
 * the model can only answer from it.
 *
 * Security and cost notes:
 *  - The API key lives in config.php (gitignored) / the
 *    PSRI_OPENAI_API_KEY environment variable — never in the browser
 *    bundle, which is public on GitHub Pages.
 *  - This route is not authenticated, so the spend is bounded by
 *    design: the documentation is the server's own support_kb.md (never
 *    the caller's), the question is length-capped, the conversation
 *    is capped at 5 turns, and max_tokens is small. Set a spend limit
 *    on the account as well.
 *  - Upstream failures are logged to the PHP error log, never shown to
 *    the user (the raw upstream body can echo the request, and any
 *    header would be readable in the browser's network tab).
 */
declare(strict_types=1);

require_once __DIR__ . '/db.php';

// The model is instructed to reply with exactly this when the
// documentation does not cover the question. The prompt and the check
// below both use this constant, so they cannot drift apart.
const PS_SUPPORT_NOT_DOCUMENTED = 'NOT_DOCUMENTED';

/** Trims and caps one user-supplied string. */
function ps_support_clean(string $s, int $max): string {
    $s = trim($s);
    if ($s === '') return '';
    return wf_cut($s, $max); // runner.php — mbstring-safe
}

/**
 * Answers a question with the AI, grounded on the documentation the
 * caller sends.
 *
 * Returns one of:
 *   ['answer' => string, 'documented' => true]
 *   ['answer' => '',     'documented' => false]   (not in the docs)
 *   ['error' => 'question is required' | 'ai-not-configured' | 'ai-unavailable']
 *
 * An error here is a setup gap or an upstream failure, not a client
 * mistake, so the caller should degrade gracefully rather than treat it
 * as the user's fault.
 */
function ps_support_ask(array $b): array {
    $question = ps_support_clean((string) ($b['question'] ?? ''), 600);
    if ($question === '') return ['error' => 'question is required'];

    $cfg = psri_config()['support'] ?? [];
    $key = trim((string) ($cfg['api_key'] ?? ''));
    if ($key === '') return ['error' => 'ai-not-configured'];

    // The knowledge base the model is grounded on: support_kb.md, generated
    // from supportContent.js (the single source of truth) on every build.
    // It is read here rather than taken from the request — a caller-supplied
    // "documentation" would let anyone point this endpoint at any text and
    // use it as a free general-purpose AI.
    $context = @file_get_contents(__DIR__ . '/support_kb.md');
    if (!is_string($context) || trim($context) === '') {
        error_log('[psri-support] support_kb.md is missing — run npm run support-kb and deploy it');
        return ['error' => 'ai-not-configured'];
    }

    // The last few exchanges, so "and the second one?" works. Answers
    // are kept short, so a long chat cannot inflate the prompt.
    $history = [];
    foreach (array_slice(is_array($b['history'] ?? null) ? $b['history'] : [], -5) as $turn) {
        if (!is_array($turn)) continue;
        $q = ps_support_clean((string) ($turn['q'] ?? ''), 300);
        $a = ps_support_clean((string) ($turn['a'] ?? ''), 300);
        if ($q !== '' && $a !== '') $history[] = ['q' => $q, 'a' => $a];
    }

    $model   = trim((string) ($cfg['model'] ?? '')) ?: 'gpt-4.1-mini';
    $baseUrl = rtrim(trim((string) ($cfg['base_url'] ?? '')), '/') ?: 'https://api.openai.com/v1';

    $messages = [
        [
            'role' => 'system',
            'content' => "You are the support assistant inside the PSRI Hospital CRM, used by call-centre agents, team leaders and admins.\n"
                . "Answer questions about how the CRM works and what its words mean, using ONLY the CRM documentation below.\n\n"
                . "Rules:\n"
                . '- If the documentation does not cover it, reply with exactly: ' . PS_SUPPORT_NOT_DOCUMENTED . "\n"
                . "- Never invent policy, prices, phone numbers, names or hospital rules, and never ask for patient details.\n"
                . "- Do not quote or list the documentation itself; answer as one colleague helping another.\n"
                . '- Answer in the language of the question (Hindi or English), in under 150 words.\n'
                . '- Use " - " bullets for lists and put key names in **bold**.',
        ],
        [
            'role' => 'user',
            'content' => "CRM documentation:\n\n" . $context,
        ],
    ];
    foreach ($history as $turn) {
        $messages[] = ['role' => 'user', 'content' => $turn['q']];
        $messages[] = ['role' => 'assistant', 'content' => $turn['a']];
    }
    $messages[] = ['role' => 'user', 'content' => $question];

    [$code, , $resp] = wf_http('POST', $baseUrl . '/chat/completions', [
        'model'       => $model,
        'messages'    => $messages,
        'temperature' => 0.2,
        'max_tokens'  => 700,
    ], ['Authorization: Bearer ' . $key], 45);

    if ($code < 200 || $code >= 300) {
        error_log('[psri-support] upstream HTTP ' . $code . ': ' . wf_cut((string) $resp, 500));
        return ['error' => 'ai-unavailable'];
    }

    $json = json_decode((string) $resp, true);
    $answer = trim((string) ($json['choices'][0]['message']['content'] ?? ''));
    if ($answer === '') return ['error' => 'ai-unavailable'];

    // Not covered: hand back the marker so the app can say so honestly
    // instead of repeating the marker to the user.
    if (strcasecmp($answer, PS_SUPPORT_NOT_DOCUMENTED) === 0) {
        return ['answer' => '', 'documented' => false];
    }

    return ['answer' => $answer, 'documented' => true];
}
