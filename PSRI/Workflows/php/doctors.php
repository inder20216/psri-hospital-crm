<?php
/**
 * doctors.php — direct PHP+MySQL Doctor/Specialty Lookup endpoints,
 * replacing the n8n psri-doctor-search / psri-specialty-search webhooks
 * (Google Sheets "Doctors" tab backed). The AI explanation in
 * specialty_search() still calls OpenAI directly (same credential as
 * support_ai.php's assistant — see psri_config()['support']) since that part
 * was never sheet data to begin with.
 *
 * Ported 1:1 from n8n_psri_doctor_lookup.json / n8n_psri_specialty_search.json,
 * including the substring-match-then-Levenshtein-fuzzy-fallback search.
 */
declare(strict_types=1);

require_once __DIR__ . '/db.php';
require_once __DIR__ . '/runner.php'; // wf_http

function doctors_row_to_api(array $r): array {
    return [
        'doctorName'          => $r['doctor_name']           ?? '',
        'specialty'            => $r['specialty']             ?? '',
        'education1'           => $r['education1']            ?? '',
        'education2'           => $r['education2']            ?? '',
        'education3'           => $r['education3']            ?? '',
        'otherQualifications'  => $r['other_qualifications']  ?? '',
        'experience'           => $r['experience']             ?? '',
        'languagesKnown'       => $r['languages_known']        ?? '',
        'centre'               => $r['centre']                 ?? '',
        'opdSchedule'          => $r['opd_schedule']           ?? '',
        'consultationCharges'  => $r['consultation_charges']   ?? '',
        'walkInProtocol'       => $r['walk_in_protocol']       ?? '',
        'walkInsAllowed'       => $r['walk_ins_allowed']       ?? '',
        'cghsProtocol'         => $r['cghs_protocol']          ?? '',
        'specificProtocol'     => $r['specific_protocol']      ?? '',
        'block'                => $r['block']                  ?? '',
        'status'               => $r['status']                 ?? '',
    ];
}

/** @return list<array> every doctor row, mapped to the frontend's camelCase shape. */
function doctors_all(): array {
    $pdo = psri_db();
    $st = $pdo->query('SELECT * FROM doctors ORDER BY sr_no');
    return array_map('doctors_row_to_api', $st->fetchAll());
}

/**
 * query empty -> every doctor. Otherwise: substring match on doctorName or
 * specialty (searchBy); no match -> Levenshtein fuzzy fallback over the same
 * field, same thresholding as the n8n version (maxDist = max(2, ceil(len*0.4))),
 * top 10 by distance.
 */
function doctors_search(array $b): array {
    $query    = trim((string) ($b['query']    ?? ''));
    $searchBy = strtolower(trim((string) ($b['searchBy'] ?? 'doctor')));
    $rows = doctors_all();

    if ($query === '') return ['success' => true, 'count' => count($rows), 'fuzzyMatch' => false, 'results' => $rows];

    $q = mb_strtolower($query);
    $field = $searchBy === 'specialty' ? 'specialty' : 'doctorName';

    $filtered = array_values(array_filter($rows, static fn (array $r): bool => mb_strpos(mb_strtolower($r[$field]), $q) !== false));
    $fuzzy = false;

    if (count($filtered) === 0 && mb_strlen($q) >= 3) {
        $maxDist = max(2, (int) ceil(mb_strlen($q) * 0.4));
        $scored = [];
        foreach ($rows as $r) {
            $dist = levenshtein($q, mb_strtolower($r[$field]));
            if ($dist <= $maxDist) $scored[] = ['row' => $r, 'dist' => $dist];
        }
        usort($scored, static fn (array $a, array $b): int => $a['dist'] <=> $b['dist']);
        $filtered = array_map(static fn (array $s): array => $s['row'], array_slice($scored, 0, 10));
        $fuzzy = count($filtered) > 0;
    }

    return ['success' => true, 'count' => count($filtered), 'fuzzyMatch' => $fuzzy, 'results' => $filtered];
}

/**
 * Substring match on Specialty; no match -> fuzzy fallback to the closest
 * distinct specialty name. Groups matched rows by their actual Specialty
 * value (a query can legitimately span several specialties). A single
 * resulting group gets a live bilingual AI explanation; multiple groups
 * don't (same as the n8n version — avoids an ambiguous combined summary).
 */
function specialty_search(array $b): array {
    $specialty = trim((string) ($b['specialty'] ?? $b['query'] ?? ''));
    $rows = doctors_all();

    $q = mb_strtolower($specialty);
    $matched = array_values(array_filter($rows, static fn (array $r): bool => mb_strpos(mb_strtolower($r['specialty']), $q) !== false));
    $fuzzyMatch = false;

    if (count($matched) === 0 && mb_strlen($q) >= 3) {
        $distinct = array_values(array_unique(array_filter(array_map(static fn (array $r) => $r['specialty'], $rows))));
        $maxDist = max(2, (int) ceil(mb_strlen($q) * 0.4));
        $scored = [];
        foreach ($distinct as $s) {
            $dist = levenshtein($q, mb_strtolower($s));
            if ($dist <= $maxDist) $scored[] = ['specialty' => $s, 'dist' => $dist];
        }
        usort($scored, static fn (array $a, array $b): int => $a['dist'] <=> $b['dist']);
        if (count($scored) > 0) {
            $best = $scored[0]['specialty'];
            $matched = array_values(array_filter($rows, static fn (array $r): bool => $r['specialty'] === $best));
            $fuzzyMatch = true;
        }
    }

    $bySpecialty = [];
    foreach ($matched as $r) {
        $key = $r['specialty'] !== '' ? $r['specialty'] : $specialty;
        $bySpecialty[$key][] = $r;
    }
    $groups = [];
    foreach ($bySpecialty as $spec => $doctors) {
        $groups[] = ['specialty' => $spec, 'doctors' => $doctors];
    }
    if (count($groups) === 0) $groups = [['specialty' => $specialty, 'doctors' => []]];

    if (count($groups) === 1) {
        [$summaryEn, $summaryHi] = specialty_ai_summary($groups[0]['specialty']);
        $groups[0]['summaryEn'] = $summaryEn;
        $groups[0]['summaryHi'] = $summaryHi;
    } else {
        foreach ($groups as &$g) { $g['summaryEn'] = ''; $g['summaryHi'] = ''; }
        unset($g);
    }

    return ['success' => true, 'fuzzyMatch' => $fuzzyMatch, 'groups' => $groups];
}

/** Live bilingual patient-facing blurb for one specialty. [en, hi], both '' if AI isn't configured/available. */
function specialty_ai_summary(string $specialty): array {
    $cfg = psri_config()['support'] ?? [];
    $key = trim((string) ($cfg['api_key'] ?? ''));
    if ($key === '') return ['', ''];

    $model   = trim((string) ($cfg['model'] ?? '')) ?: 'gpt-4o-mini';
    $baseUrl = rtrim(trim((string) ($cfg['base_url'] ?? '')), '/') ?: 'https://api.openai.com/v1';

    $prompt = "You are a PSRI Hospital front desk assistant.\n\n"
        . "Explain the \"{$specialty}\" department in simple language for a patient.\n\n"
        . "Rules:\n"
        . "- Do not diagnose or suggest treatment.\n"
        . "- Do not mention medicines or tests.\n"
        . "- Do not make up information.\n"
        . "- Explain only what the department generally treats.\n"
        . "- Mention 3-5 common symptoms or conditions for which a patient may visit this department.\n"
        . "- Keep the response under 60 words.\n"
        . "- End by saying that the doctor will evaluate the patient's condition during the consultation.\n"
        . "- Return only valid JSON with no markdown and no extra text.\n\n"
        . '{"en": "", "hi": ""}';

    [$code, , $resp] = wf_http('POST', $baseUrl . '/chat/completions', [
        'model'       => $model,
        'messages'    => [['role' => 'user', 'content' => $prompt]],
        'temperature' => 0.3,
        'max_tokens'  => 300,
    ], ['Authorization: Bearer ' . $key], 30);

    if ($code < 200 || $code >= 300) {
        error_log('[psri-specialty-search] upstream HTTP ' . $code);
        return ['', ''];
    }

    $json = json_decode((string) $resp, true);
    $raw = trim((string) ($json['choices'][0]['message']['content'] ?? ''));
    $raw = (string) preg_replace('/^```json\s*|^```\s*|\s*```$/i', '', $raw);
    $parsed = json_decode($raw, true);
    if (!is_array($parsed)) return [$raw, ''];

    return [(string) ($parsed['en'] ?? ''), (string) ($parsed['hi'] ?? '')];
}
