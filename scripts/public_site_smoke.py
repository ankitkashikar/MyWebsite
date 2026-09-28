"""Read-only HTTP smoke checks for the deployed GitHub Pages site.

No login, order submissions, payment calls, or database access.
"""
from html.parser import HTMLParser
from urllib.parse import urljoin, urlsplit, urldefrag
from urllib.request import Request, build_opener, HTTPRedirectHandler
import sys

BASE = 'https://ankitkashikar.github.io/MyWebsite/'
PAGES = {
    '': 'The Chinese Bliss',
    'index.html': 'The Chinese Bliss',
    'menu.html': 'Menu | The Chinese Bliss',
    'bulk-order.html': 'Bulk Order | The Chinese Bliss',
    'order.html': 'Order Online | The Chinese Bliss',
    'our-story.html': 'Our Story | The Chinese Bliss',
    'orders.html': 'Order Console | The Chinese Bliss',
    'order-status.html': 'Track Order | The Chinese Bliss',
    'terms.html': 'Terms & Conditions | The Chinese Bliss',
    'privacy.html': 'Privacy Policy | The Chinese Bliss',
    'delivery-policy.html': 'Delivery Policy | The Chinese Bliss',
    'refund-policy.html': 'Cancellation & Refund Policy | The Chinese Bliss',
    'bulk-order-policy.html': 'Bulk Order Policy | The Chinese Bliss',
}


def allowed(url):
    parsed = urlsplit(url)
    return (parsed.scheme == 'https' and parsed.netloc == 'ankitkashikar.github.io'
            and parsed.path.startswith('/MyWebsite/')
            and '/..' not in parsed.path and '%' not in parsed.path)


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        raise ValueError('Unexpected redirect; check the deployed URL')


class Page(HTMLParser):
    def __init__(self):
        super().__init__()
        self.in_title = False
        self.title = ''
        self.assets = []
        self.links = []

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == 'a' and attrs.get('href'):
            self.links.append(attrs['href'])
        if tag == 'title':
            self.in_title = True
        if tag == 'script' and attrs.get('src'):
            self.assets.append(attrs['src'])
        if tag == 'link' and 'stylesheet' in attrs.get('rel', '').split():
            if attrs.get('href'):
                self.assets.append(attrs['href'])

    def handle_endtag(self, tag):
        if tag == 'title':
            self.in_title = False

    def handle_data(self, data):
        if self.in_title:
            self.title += data


def fetch(url):
    if not allowed(url):
        raise ValueError('URL outside the fixed production site')
    request = Request(url, headers={'User-Agent': 'TCB-Public-Site-Smoke/1.0'})
    with build_opener(NoRedirect()).open(request, timeout=15) as response:
        if response.status != 200 or response.geturl() != url:
            raise ValueError('Expected HTTP 200 at the exact requested URL')
        body = response.read(2_000_001)
        if not body or len(body) > 2_000_000:
            raise ValueError('Empty or unexpectedly large response')
        return response.headers.get_content_type(), body


def inspect_page(content_type, body, expected_title):
    if content_type != 'text/html':
        raise ValueError('Expected HTML content type')
    page = Page()
    page.feed(body.decode('utf-8'))
    if expected_title not in page.title or '404' in page.title:
        raise ValueError('Missing expected page title or soft 404')
    if 'style.css' not in page.assets:
        raise ValueError('Missing shared stylesheet reference')
    return page


def run(fetcher=fetch):
    failed = 0
    assets = {urljoin(BASE, 'images/tcb_logo.svg')}
    pending = list(PAGES.items())
    seen = {urljoin(BASE, path) for path in PAGES}
    for path, title in pending:
        url = urljoin(BASE, path)
        try:
            page = inspect_page(*fetcher(url), title)
            for ref in page.links:
                target = urldefrag(urljoin(url, ref))[0]
                parsed = urlsplit(target)
                if parsed.netloc != urlsplit(BASE).netloc:
                    continue
                if not allowed(target):
                    raise ValueError('Navigation leaves the project path: ' + target)
                if parsed.query:
                    raise ValueError('Navigation query requires manual review: ' + target)
                if target not in seen and (parsed.path.endswith('.html') or parsed.path.endswith('/')):
                    if len(seen) >= 40:
                        raise ValueError('Navigation exceeds the 40-page safety limit')
                    seen.add(target)
                    pending.append((target.removeprefix(BASE), 'The Chinese Bliss'))
            for ref in page.assets:
                asset = urljoin(url, ref)
                if urlsplit(asset).netloc == urlsplit(BASE).netloc:
                    if not allowed(asset):
                        raise ValueError('Local asset outside the project path')
                    assets.add(asset)
            print('PASS page:', path or '/')
        except Exception as error:
            failed += 1
            print('FAIL page:', path or '/', type(error).__name__, str(error))
    for url in sorted(assets):
        try:
            content_type, body = fetcher(url)
            if not body or content_type == 'text/html' or body.lstrip().lower().startswith((b'<!doctype html', b'<html')):
                raise ValueError('Asset returned empty content or an HTML fallback')
            expected = {'.css': ('text/css',), '.js': ('application/javascript', 'text/javascript'),
                        '.svg': ('image/svg+xml',)}
            extension = '.' + urlsplit(url).path.rsplit('.', 1)[-1]
            if extension in expected and content_type not in expected[extension]:
                raise ValueError('Unexpected asset content type')
            print('PASS asset:', url.removeprefix(BASE))
        except Exception as error:
            failed += 1
            print('FAIL asset:', url.removeprefix(BASE), type(error).__name__, str(error))
    print(f'{len(pending)} pages and {len(assets)} assets checked; {failed} failures.')
    print('HTTP availability only; this does not verify payment, API behavior, or release approval.')
    return 1 if failed else 0


if __name__ == '__main__':
    sys.exit(run())
