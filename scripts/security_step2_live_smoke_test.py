"""Offline contract tests. Every HTTP call is replaced; no live requests."""
import contextlib
import io
import sys
import unittest
from unittest.mock import patch
import security_step2_live_smoke as smoke

REFERENCE = '653e6a5b-20ae-4dfa-96e9-f042f07f689c'

def fixture(path, body):
    message = ('Order not found. Check the order number and mobile number and try again.'
               if path == '/order-status' else 'Your admin session is invalid or expired.')
    return (404 if path == '/order-status' else 401,
            {'Access-Control-Allow-Origin': smoke.origin, 'Cache-Control': 'no-store'},
            {'success': False, 'reference': REFERENCE, 'message': message + ' Reference: ' + REFERENCE}, None)

class SmokeContractTests(unittest.TestCase):
    def run_fixture(self, change=None):
        def post(path, body):
            result = fixture(path, body)
            return change(result) if change else result
        with patch.object(smoke, 'post', side_effect=post), contextlib.redirect_stdout(io.StringIO()):
            return smoke.run()

    def test_current_safe_responses_pass(self):
        self.assertEqual(self.run_fixture(), 0)

    def test_invalid_or_missing_reference_fails(self):
        for ref in [None, 'bad', '<script>']:
            self.assertEqual(self.run_fixture(lambda r: (r[0], r[1], {**r[2], 'reference': ref}, None)), 1)

    def test_unexpected_message_and_extra_fields_fail(self):
        for extra in [{'message': 'private error'}, {'phone': 'private'}]:
            self.assertEqual(self.run_fixture(lambda r: (r[0], r[1], {**r[2], **extra}, None)), 1)

    def test_wrong_status_or_cors_fails(self):
        self.assertEqual(self.run_fixture(lambda r: (200, r[1], r[2], None)), 1)
        self.assertEqual(self.run_fixture(lambda r: (r[0], {}, r[2], None)), 1)

    def test_network_failure_fails(self):
        self.assertEqual(self.run_fixture(lambda r: (None, {}, None, 'offline')), 1)

    def test_default_invocation_does_not_probe(self):
        # Guard is checked before run(); import is network-free.
        import runpy
        with patch('urllib.request.urlopen', side_effect=AssertionError('Network forbidden')) as request, patch.object(sys, 'argv', ['security_step2_live_smoke.py']), contextlib.redirect_stdout(io.StringIO()):
            with self.assertRaises(SystemExit) as result:
                runpy.run_path(str(smoke.ROOT / 'scripts/security_step2_live_smoke.py'), run_name='__main__')
            self.assertEqual(result.exception.code, 2)
            request.assert_not_called()

if __name__ == '__main__':
    unittest.main()
