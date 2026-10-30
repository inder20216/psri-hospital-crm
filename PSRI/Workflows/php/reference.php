<?php
/**
 * reference.php — direct PHP+MySQL endpoints for the two small read-only
 * reference tables, replacing the n8n psri-guidance / psri-specialty-summaries
 * webhooks (Google Sheets "Guidance" / "SpecialtySummaries" tabs).
 *
 * Ported 1:1 from n8n_psri_guidance_list.json / n8n_psri_specialty_summaries_list.json.
 * Neither has a write endpoint in the frontend — these are admin-edited
 * directly in the table.
 */
declare(strict_types=1);

require_once __DIR__ . '/db.php';

function guidance_list(): array {
    $pdo = psri_db();
    $st = $pdo->query('SELECT call_for, field, tip, script FROM guidance ORDER BY id');
    return array_map(static fn (array $r): array => [
        'callFor' => $r['call_for'],
        'field'   => $r['field'],
        'tip'     => $r['tip'],
        'script'  => $r['script'],
    ], $st->fetchAll());
}

function specialty_summaries_list(): array {
    $pdo = psri_db();
    $st = $pdo->query('SELECT specialty, summary_en, summary_hi FROM specialty_summaries ORDER BY specialty');
    return array_map(static fn (array $r): array => [
        'specialty' => $r['specialty'],
        'en'        => $r['summary_en'],
        'hi'        => $r['summary_hi'],
    ], $st->fetchAll());
}
