<?php
/**
 * users.php — direct PHP+MySQL Users endpoints, replacing the n8n
 * psri-users / psri-user-add / psri-user-update webhooks (Google Sheets
 * backed), which were a single point of failure for every agent's login —
 * AuthContext looks the signed-in Microsoft account's email up here.
 *
 * Ported 1:1 from the n8n workflows' validation + role-protection logic
 * (n8n_psri_users_list.json / n8n_psri_user_add.json / n8n_psri_user_update.json).
 */
declare(strict_types=1);

require_once __DIR__ . '/db.php';

/** Maps a users row to the camelCase shape the frontend expects. Password is never returned. */
function users_row_to_api(array $r): array {
    return [
        'id'               => $r['user_id']           ?? '',
        'name'             => $r['name']               ?? '',
        'contact'          => $r['contact']            ?? '',
        'email'            => $r['email']              ?? '',
        'role'             => $r['role']               ?: 'User',
        'sparktgExtension' => $r['sparktg_extension']  ?? '',
        'created'          => $r['created']            ?? '',
    ];
}

function users_list(): array {
    $pdo = psri_db();
    $st = $pdo->query('SELECT * FROM users ORDER BY created ASC');
    return array_map('users_row_to_api', $st->fetchAll());
}

const USERS_ROLES = ['Super Admin', 'Admin', 'User'];

/**
 * Ported 1:1 from n8n_psri_user_add.json. Returns either
 * ['error' => string] or ['id' => string, 'message' => string].
 */
function users_add(array $b): array {
    $name     = trim((string) ($b['name']     ?? ''));
    $contact  = trim((string) ($b['contact']  ?? ''));
    $email    = trim((string) ($b['email']    ?? ''));
    $password = (string) ($b['password'] ?? '');
    $role     = trim((string) ($b['role']     ?? 'User'));
    $ext      = trim((string) ($b['sparktgExtension'] ?? ''));

    if ($name === '') return ['error' => 'User Name is required'];
    if (!preg_match('/^\d{10}$/', $contact)) return ['error' => 'Valid 10-digit contact number is required'];
    if (!preg_match('/^\S+@\S+\.\S+$/', $email)) return ['error' => 'Valid official email is required'];
    if (strlen($password) < 6) return ['error' => 'Password must be at least 6 characters'];
    if (!in_array($role, USERS_ROLES, true)) return ['error' => 'Invalid role'];

    $pdo = psri_db();

    $st = $pdo->prepare('SELECT 1 FROM users WHERE LOWER(email) = LOWER(?)');
    $st->execute([$email]);
    if ($st->fetch()) return ['error' => 'A user with this email already exists'];

    $st = $pdo->query("SELECT user_id FROM users");
    $maxN = 0;
    foreach ($st->fetchAll() as $row) {
        $n = (int) preg_replace('/\D/', '', (string) $row['user_id']);
        if ($n > $maxN) $maxN = $n;
    }
    $newId = 'U-' . ($maxN + 1);

    $ins = $pdo->prepare(
        'INSERT INTO users (user_id, name, contact, email, password_hash, role, sparktg_extension)
         VALUES (?, ?, ?, ?, ?, ?, ?)'
    );
    $ins->execute([$newId, $name, $contact, $email, password_hash($password, PASSWORD_DEFAULT), $role, $ext]);

    return ['id' => $newId, 'message' => 'User created'];
}

/**
 * Ported 1:1 from n8n_psri_user_update.json, including the hard rule
 * (CLAUDE.md): cannot change a role if it would leave zero Super Admins.
 */
function users_update(array $b): array {
    $id = trim((string) ($b['id'] ?? ''));
    if ($id === '') return ['error' => 'User id is required'];

    $pdo = psri_db();
    $st = $pdo->prepare('SELECT * FROM users WHERE user_id = ?');
    $st->execute([$id]);
    $current = $st->fetch();
    if (!$current) return ['error' => 'User not found'];

    $name    = array_key_exists('name', $b)    ? trim((string) $b['name'])    : $current['name'];
    $contact = array_key_exists('contact', $b) ? trim((string) $b['contact']) : $current['contact'];
    $email   = array_key_exists('email', $b)   ? trim((string) $b['email'])   : $current['email'];
    $role    = array_key_exists('role', $b)    ? trim((string) $b['role'])    : $current['role'];
    $ext     = array_key_exists('sparktgExtension', $b) ? trim((string) $b['sparktgExtension']) : $current['sparktg_extension'];
    $newPassword = (string) ($b['password'] ?? '');
    $passwordHash = strlen(trim($newPassword)) >= 6 ? password_hash($newPassword, PASSWORD_DEFAULT) : $current['password_hash'];

    if ($name === '') return ['error' => 'User Name is required'];
    if (!preg_match('/^\d{10}$/', $contact)) return ['error' => 'Valid 10-digit contact number is required'];
    if (!preg_match('/^\S+@\S+\.\S+$/', $email)) return ['error' => 'Valid official email is required'];
    if (!in_array($role, USERS_ROLES, true)) return ['error' => 'Invalid role'];

    if ($current['role'] === 'Super Admin' && $role !== 'Super Admin') {
        $st = $pdo->prepare("SELECT COUNT(*) AS n FROM users WHERE role = 'Super Admin' AND user_id != ?");
        $st->execute([$id]);
        if ((int) $st->fetch()['n'] === 0) {
            return ['error' => 'Cannot change role — at least one Super Admin must remain'];
        }
    }

    if (strtolower($email) !== strtolower((string) $current['email'])) {
        $st = $pdo->prepare('SELECT 1 FROM users WHERE LOWER(email) = LOWER(?) AND user_id != ?');
        $st->execute([$email, $id]);
        if ($st->fetch()) return ['error' => 'A user with this email already exists'];
    }

    $upd = $pdo->prepare(
        'UPDATE users SET name = ?, contact = ?, email = ?, password_hash = ?, role = ?, sparktg_extension = ? WHERE user_id = ?'
    );
    $upd->execute([$name, $contact, $email, $passwordHash, $role, $ext, $id]);

    return ['id' => $id, 'message' => 'User updated'];
}
