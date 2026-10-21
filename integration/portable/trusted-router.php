<?php
// Fixed router; application files are never executed as routing configuration.
$root = '/app';
// The application requires the storage root writable. This whole directory is
// a bounded noexec tmpfs, separate from the read-only source volume.
foreach (['cache', 'logs', 'sessions', 'uploads'] as $directory) {
    $storage = $root . '/storage/' . $directory;
    if (!is_dir($storage) && !mkdir($storage, 0700)) {
        http_response_code(500);
        exit('Owned temporary storage initialization failed');
    }
}
$uri = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
$file = realpath($root . '/' . ltrim(str_replace('\\', '/', $uri), '/'));
$allowed = ['js'=>'application/javascript','css'=>'text/css','svg'=>'image/svg+xml','png'=>'image/png','gif'=>'image/gif','jpg'=>'image/jpeg','ico'=>'image/x-icon','woff'=>'font/woff','woff2'=>'font/woff2','ttf'=>'font/ttf'];
if ($file && str_starts_with($file, $root . '/') && is_file($file)) {
    $extension = strtolower(pathinfo($file, PATHINFO_EXTENSION));
    if (isset($allowed[$extension])) { header('Content-Type: ' . $allowed[$extension]); readfile($file); return true; }
}
require $root . '/index.php';
