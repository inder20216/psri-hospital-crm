<?php
/**
 * picklists.php — direct PHP+MySQL Picklists endpoints, replacing the n8n
 * psri-picklists / psri-picklist-add webhooks (Google Sheets backed).
 *
 * Ported 1:1 from n8n_psri_picklists_list.json / n8n_psri_picklist_add.json.
 * Duplicate-value checks rely on the table's utf8mb4_unicode_ci collation,
 * which compares case-insensitively — same as the n8n workflow's
 * toLowerCase() comparison.
 */
declare(strict_types=1);

require_once __DIR__ . '/db.php';

/** { listName: [values…] }, each list's values sorted A→Z. */
function picklists_list(): array {
    $pdo = psri_db();
    $st = $pdo->query('SELECT list_name, value FROM picklists ORDER BY list_name, value');
    $picklists = [];
    foreach ($st->fetchAll() as $row) {
        $picklists[$row['list_name']][] = $row['value'];
    }
    return $picklists;
}

/**
 * Ported 1:1 from n8n_psri_picklist_add.json. Returns either
 * ['error' => string] or ['listName' => …, 'value' => …, 'message' => …].
 */
function picklists_add(array $b): array {
    $listName = trim((string) ($b['listName'] ?? ''));
    $value    = trim((string) ($b['value']    ?? ''));

    if ($listName === '') return ['error' => 'listName is required'];
    if ($value === '')    return ['error' => 'value is required'];

    $pdo = psri_db();
    $st = $pdo->prepare('SELECT 1 FROM picklists WHERE list_name = ? AND value = ?');
    $st->execute([$listName, $value]);
    if ($st->fetch()) return ['error' => 'This value already exists in the list'];

    $ins = $pdo->prepare('INSERT INTO picklists (list_name, value) VALUES (?, ?)');
    $ins->execute([$listName, $value]);

    return ['listName' => $listName, 'value' => $value, 'message' => 'Value added'];
}
