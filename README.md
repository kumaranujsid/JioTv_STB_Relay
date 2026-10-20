# Akindi

<?php

/**

 * jiostb.php — Local M3U proxy with 3-hour cache.

 *

 * Web:   http://localhost/jiostb.php              → auto-refresh when >3 h old

 *        http://localhost/jiostb.php?refresh=1    → force refresh

 *        http://localhost/jiostb.php?status=1     → JSON cache status

 * CLI:   php jiostb.php                           → force refresh (for cron)

 *

 * Requires PHP 7.4+ with cURL (recommended) or allow_url_fopen.

 */



error_reporting(E_ALL);

ini_set('display_errors', '0');   // never leak errors into the M3U body



const API_URL       = 'https://jiostbapiplugx.lovable.app/api/jiostb';

const CACHE_TTL     = 10800;      // 3 hours

const FETCH_TIMEOUT = 30;



/* ---------- paths (fall back to temp dir if __DIR__ is not writable) ---------- */

$cacheDir  = is_writable(__DIR__) ? __DIR__ : sys_get_temp_dir();

$cacheFile = $cacheDir . '/jiostb_cache.m3u';

$lockFile  = $cacheDir . '/jiostb_cache.lock';



$isCli        = (PHP_SAPI === 'cli');

$forceRefresh = $isCli || (isset($_GET['refresh']) && $_GET['refresh'] === '1');



/* ---------- decide whether we need to fetch ---------- */

clearstatcache(true, $cacheFile);

$needFetch = true;

if (!$forceRefresh && is_file($cacheFile) && filesize($cacheFile) > 0) {

    if ((time() - filemtime($cacheFile)) < CACHE_TTL) {

        $needFetch = false;

    }

}



/* ---------- refresh under a non-blocking lock ---------- */

if ($needFetch) {

    $lock = @fopen($lockFile, 'c');

    if ($lock !== false && @flock($lock, LOCK_EX | LOCK_NB)) {

        try {

            clearstatcache(true, $cacheFile);

            $stillFresh = !$forceRefresh

                && is_file($cacheFile)

                && filesize($cacheFile) > 0

                && (time() - filemtime($cacheFile)) < CACHE_TTL;



            if (!$stillFresh) {

                $data = fetchApi();

                if ($data !== false && strlen($data) > 20) {

                    $tmp = $cacheFile . '.tmp.' . getmypid();

                    if (@file_put_contents($tmp, $data) !== false) {

                        @rename($tmp, $cacheFile);   // atomic replace

                    } else {

                        @unlink($tmp);

                    }

                    if ($isCli) {

                        fwrite(STDOUT, sprintf("[%s] refreshed %d bytes\n", date('c'), strlen($data)));

                    }

                } else {

                    $msg = sprintf("[%s] API fetch failed; keeping stale cache\n", date('c'));

                    error_log(trim($msg));

                    if ($isCli) fwrite(STDERR, $msg);

                }

            } elseif ($isCli) {

                fwrite(STDOUT, sprintf("[%s] cache already fresh\n", date('c')));

            }

        } finally {

            @flock($lock, LOCK_UN);

            @fclose($lock);

        }

    } elseif ($lock !== false) {

        @fclose($lock);

        // Someone else is refreshing — serve whatever's on disk.

    }

}



/* ---------- CLI: refresh only, then exit ---------- */

if ($isCli) {

    exit(0);

}



/* ---------- JSON status endpoint (for debugging) ---------- */

if (isset($_GET['status'])) {

    header('Content-Type: application/json; charset=utf-8');

    $exists = is_file($cacheFile) && filesize($cacheFile) > 0;

    echo json_encode([

        'cache_file' => $cacheFile,

        'exists'     => $exists,

        'size'       => $exists ? filesize($cacheFile) : 0,

        'age_sec'    => $exists ? (time() - filemtime($cacheFile)) : null,

        'ttl_sec'    => CACHE_TTL,

        'next_fetch' => $exists ? max(0, CACHE_TTL - (time() - filemtime($cacheFile))) : 0,

    ], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);

    exit;

}



/* ---------- serve ---------- */

if (!is_file($cacheFile) || filesize($cacheFile) === 0) {

    http_response_code(503);

    header('Content-Type: text/plain; charset=utf-8');

    header('Retry-After: 300');

    echo "#EXTM3U\n# Upstream API unavailable and no cache yet. Retry shortly.\n";

    exit;

}



header('Content-Type: application/vnd.apple.mpegurl; charset=utf-8');

header('Content-Disposition: inline; filename="jiostb.m3u"');

header('Cache-Control: no-cache, must-revalidate');

header('Access-Control-Allow-Origin: *');

header('X-Cache-Age: ' . (time() - filemtime($cacheFile)));

header('Content-Length: ' . filesize($cacheFile));

readfile($cacheFile);



/* ---------- helper ---------- */

function fetchApi()

{

    if (function_exists('curl_init')) {

        $ch = curl_init(API_URL);

        curl_setopt_array($ch, [

            CURLOPT_RETURNTRANSFER => true,

            CURLOPT_FOLLOWLOCATION => true,

            CURLOPT_MAXREDIRS      => 5,

            CURLOPT_CONNECTTIMEOUT => 10,

            CURLOPT_TIMEOUT        => FETCH_TIMEOUT,

            CURLOPT_USERAGENT      => 'JioSTB-LocalProxy/1.0',

            CURLOPT_SSL_VERIFYPEER => true,

            CURLOPT_SSL_VERIFYHOST => 2,

            CURLOPT_ENCODING       => '',

        ]);

        $body = curl_exec($ch);

        $code = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);

        $err  = curl_error($ch);

        curl_close($ch);

        if ($body !== false && $code >= 200 && $code < 300) {

            return $body;

        }

        error_log(sprintf('[jiostb] cURL HTTP %d — %s', $code, $err));

    }



    $ctx = stream_context_create([

        'http' => [

            'method'        => 'GET',

            'timeout'       => FETCH_TIMEOUT,

            'user_agent'    => 'JioSTB-LocalProxy/1.0',

            'ignore_errors' => true,

        ],

    ]);

    $body = @file_get_contents(API_URL, false, $ctx);

    if (is_string($body) && strlen($body) > 0) {

        return $body;

    }

    return false;

}

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://akindi.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/f584cfad-8c76-49ea-9ed1-a32bb1828e08).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
