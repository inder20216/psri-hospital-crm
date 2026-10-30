<?php
/**
 * dependencies.php — direct PHP+MySQL Dependencies endpoints, replacing the
 * n8n psri-dependencies / psri-dependency-add webhooks (Google Sheets
 * backed). Feeds every dependent dropdown on the Cases form (e.g.
 * Specialty -> Doctor).
 *
 * Ported 1:1 from n8n_psri_dependencies_list.json / n8n_psri_dependency_add.json.
 */
declare(strict_types=1);

require_once __DIR__ . '/db.php';

function dependencies_list(): array {
    $pdo = psri_db();
    $st = $pdo->query('SELECT main_field, main_value, sub_field, sub_value FROM dependencies ORDER BY main_field, main_value, sub_field, sub_value');
    return array_map(static fn (array $r): array => [
        'mainField' => $r['main_field'],
        'mainValue' => $r['main_value'],
        'subField'  => $r['sub_field'],
        'subValue'  => $r['sub_value'],
    ], $st->fetchAll());
}

/**
 * Ported 1:1 from n8n_psri_dependency_add.json. Returns either
 * ['error' => string] or the saved pair + 'message'.
 */
function dependencies_add(array $b): array {
    $mainField = trim((string) ($b['mainField'] ?? ''));
    $mainValue = trim((string) ($b['mainValue'] ?? ''));
    $subField  = trim((string) ($b['subField']  ?? ''));
    $subValue  = trim((string) ($b['subValue']  ?? ''));

    if ($mainField === '') return ['error' => 'mainField is required'];
    if ($mainValue === '') return ['error' => 'mainValue is required'];
    if ($subField === '')  return ['error' => 'subField is required'];
    if ($subValue === '')  return ['error' => 'subValue is required'];

    $pdo = psri_db();
    $st = $pdo->prepare('SELECT 1 FROM dependencies WHERE main_field = ? AND main_value = ? AND sub_field = ? AND sub_value = ?');
    $st->execute([$mainField, $mainValue, $subField, $subValue]);
    if ($st->fetch()) return ['error' => 'This dependency pair already exists'];

    $ins = $pdo->prepare('INSERT INTO dependencies (main_field, main_value, sub_field, sub_value) VALUES (?, ?, ?, ?)');
    $ins->execute([$mainField, $mainValue, $subField, $subValue]);

    return ['mainField' => $mainField, 'mainValue' => $mainValue, 'subField' => $subField, 'subValue' => $subValue, 'message' => 'Dependency added'];
}
