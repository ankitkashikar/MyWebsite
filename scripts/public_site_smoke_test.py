"""Offline failure-detection tests; no production network requests."""
import contextlib
import io
import unittest
from urllib.error import HTTPError
import public_site_smoke as smoke


def fixture(url):
    path = url.removeprefix(smoke.BASE)
    if path in smoke.PAGES:
        return 'text/html', (f'<title>{smoke.PAGES[path]}</title>'
                             '<link rel="stylesheet" href="style.css">'
                             '<script src="script.js"></script>').encode()
    if path == 'style.css':
        return 'text/css', b'body { color: black; }'
    if path == 'script.js':
        return 'text/javascript', b'"use strict";'
    return 'image/svg+xml', b'<svg xmlns="http://www.w3.org/2000/svg"/>'


class SmokeTests(unittest.TestCase):
    def run_check(self, fetcher):
        with contextlib.redirect_stdout(io.StringIO()):
            return smoke.run(fetcher)

    def test_good_site(self):
        self.assertEqual(self.run_check(fixture), 0)

    def test_soft_404(self):
        self.assertEqual(self.run_check(lambda url: ('text/html', b'<title>404</title>')), 1)

    def test_missing_page(self):
        def fetcher(url):
            if url.endswith('menu.html'):
                raise HTTPError(url, 404, 'Not Found', {}, None)
            return fixture(url)
        self.assertEqual(self.run_check(fetcher), 1)

    def test_explicit_index_missing(self):
        def fetcher(url):
            if url == smoke.BASE + 'index.html':
                raise HTTPError(url, 404, 'Not Found', {}, None)
            return fixture(url)
        self.assertEqual(self.run_check(fetcher), 1)

    def test_navigation_missing_target(self):
        requested = []
        def fetcher(url):
            requested.append(url)
            if url == smoke.BASE:
                mime, body = fixture(url)
                return mime, body + b'<a href="missing.html">Menu</a>'
            if url.endswith('missing.html'):
                raise HTTPError(url, 404, 'Not Found', {}, None)
            return fixture(url)
        self.assertEqual(self.run_check(fetcher), 1)
        self.assertIn(smoke.BASE + 'missing.html', requested)

    def test_navigation_wrong_project_path(self):
        def fetcher(url):
            mime, body = fixture(url)
            return mime, body + b'<a href="/menu.html">Menu</a>' if url == smoke.BASE else (mime, body)
        self.assertEqual(self.run_check(fetcher), 1)

    def test_fragments_external_and_contact_links_not_fetched(self):
        requested = []
        def fetcher(url):
            requested.append(url)
            mime, body = fixture(url)
            if url == smoke.BASE:
                body += b'<a href="index.html#contact">Contact</a><a href="https://example.com">External</a><a href="mailto:hello@example.com">Email</a><a href="tel:123">Call</a>'
            return mime, body
        self.assertEqual(self.run_check(fetcher), 0)
        self.assertEqual(len(requested), len(set(requested)))
        self.assertTrue(all(smoke.allowed(url) and '#' not in url for url in requested))

    def test_asset_html_fallback(self):
        self.assertEqual(self.run_check(lambda url: ('text/html', b'<html>Oops</html>')
                                       if url.endswith('.css') else fixture(url)), 1)

    def test_wrong_mime(self):
        self.assertEqual(self.run_check(lambda url: ('text/plain', b'body{}')
                                       if url.endswith('.css') else fixture(url)), 1)

    def test_host_and_project_boundary(self):
        self.assertTrue(smoke.allowed(smoke.BASE + 'menu.html'))
        for url in ['http://ankitkashikar.github.io/MyWebsite/',
                    'https://example.com/MyWebsite/',
                    'https://ankitkashikar.github.io/Other/',
                    smoke.BASE + '../Other/', smoke.BASE + '%2e%2e/Other/']:
            self.assertFalse(smoke.allowed(url))

    def test_redirect_rejected(self):
        with self.assertRaises(ValueError):
            smoke.NoRedirect().redirect_request(None, None, 302, '', {}, smoke.BASE)

    def test_timeout_fails(self):
        def fetcher(url):
            raise TimeoutError('Timed out')
        self.assertEqual(self.run_check(fetcher), 1)


if __name__ == '__main__':
    unittest.main()
