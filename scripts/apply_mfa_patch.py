from pathlib import Path
import re

# Admin API: require AAL2 after exact shared-account authorization.
p = Path('supabase/functions/admin-orders/index.ts')
s = p.read_text()
if 'Authenticator verification is required for TCB Order Console access.' not in s:
    pattern = r'(if \(!user\.email_confirmed_at \|\| !email \|\| email !== adminEmail\) \{.*?\n\s*\}\n)(\s*const admin = createClient)'
    insert = r'''\1
  const { data: aalData, error: aalError } = await userClient.auth.mfa.getAuthenticatorAssuranceLevel(token);
  if (aalError || aalData?.currentLevel !== "aal2") {
    return jsonResponse(req, { success: false, message: "Authenticator verification is required for TCB Order Console access." }, 403);
  }
\2'''
    s, n = re.subn(pattern, insert, s, count=1, flags=re.S)
    if n != 1:
        raise SystemExit('admin AAL2 insertion point not found')
    p.write_text(s)

# Order Console: mandatory TOTP enrollment/challenge and session-only storage.
p = Path('orders.html')
s = p.read_text()
if 'id="mfaShell"' not in s:
    note = '<p class="oc-login-note">The TCB operations account must exist in Supabase Auth and its email must exactly match the server-side TCB_ADMIN_EMAIL setting.</p>'
    mfa = '''<section class="oc-mfa-shell" id="mfaShell" hidden aria-live="polite">
        <div class="oc-mfa-head">
          <h2 id="mfaTitle">Authenticator Verification</h2>
          <p id="mfaHelp">Enter the 6-digit code from the authenticator app linked to the TCB operations account.</p>
        </div>
        <div class="oc-mfa-enroll" id="mfaEnrollPanel" hidden>
          <p><strong>First-time security setup</strong></p>
          <p>Scan this QR code with an authenticator app. Keep the setup secret private and under TCB owner control.</p>
          <img id="mfaQr" alt="TCB authenticator setup QR code" />
          <div class="oc-mfa-secret-wrap"><span>Manual setup secret</span><code id="mfaSecret"></code></div>
        </div>
        <form id="mfaForm" novalidate>
          <div class="oc-field">
            <label for="mfaCode">6-digit authenticator code</label>
            <input id="mfaCode" type="text" inputmode="numeric" autocomplete="one-time-code" maxlength="6" pattern="[0-9]{6}" required />
          </div>
          <button class="oc-primary oc-wide" id="mfaButton" type="submit">Verify &amp; Open Console</button>
          <p class="oc-login-error" id="mfaError" role="alert"></p>
        </form>
        <button class="oc-ghost oc-wide oc-mfa-signout" id="mfaSignOut" type="button">Sign Out</button>
      </section>
      <p class="oc-login-note">The TCB operations account must exist in Supabase Auth and its email must exactly match the server-side TCB_ADMIN_EMAIL setting. Authenticator-app MFA is mandatory before restaurant data can be read or changed.</p>'''
    if note not in s:
        raise SystemExit('login note not found')
    s = s.replace(note, mfa, 1)

if 'storage: window.sessionStorage' not in s:
    s, n = re.subn(
        r'auth:\s*\{\s*persistSession:\s*true,\s*autoRefreshToken:\s*true,\s*detectSessionInUrl:\s*true\s*\}',
        "auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storage: window.sessionStorage, storageKey: 'tcb-order-console-auth' }",
        s,
        count=1,
    )
    if n != 1:
        raise SystemExit('client auth config not found')

if 'mfaShell: document.getElementById' not in s:
    anchor = "loginEmail: document.getElementById('loginEmail'), loginPassword: document.getElementById('loginPassword'), loginError: document.getElementById('loginError'),"
    extra = anchor + "\n      mfaShell: document.getElementById('mfaShell'), mfaTitle: document.getElementById('mfaTitle'), mfaHelp: document.getElementById('mfaHelp'), mfaEnrollPanel: document.getElementById('mfaEnrollPanel'), mfaQr: document.getElementById('mfaQr'), mfaSecret: document.getElementById('mfaSecret'), mfaForm: document.getElementById('mfaForm'), mfaCode: document.getElementById('mfaCode'), mfaButton: document.getElementById('mfaButton'), mfaError: document.getElementById('mfaError'), mfaSignOut: document.getElementById('mfaSignOut'),"
    if anchor not in s:
        raise SystemExit('element map anchor not found')
    s = s.replace(anchor, extra, 1)

if 'let mfaFactorId' not in s:
    anchor = '    let refreshing = false;'
    if anchor not in s:
        raise SystemExit('state anchor not found')
    s = s.replace(anchor, anchor + '\n    let mfaFactorId = null;\n    let mfaGateBusy = false;', 1)

s = s.replace('if (err.status === 401) await client.auth.signOut();', 'if (err.status === 401 || err.status === 403) await client.auth.signOut();')

if 'async function prepareMfa(session)' not in s:
    marker = '    function startPolling() {'
    if marker not in s:
        raise SystemExit('polling marker not found')
    block = r'''    function showPasswordLogin() {
      els.loginForm.hidden = false;
      els.mfaShell.hidden = true;
      els.mfaError.classList.remove('visible');
      els.mfaCode.value = '';
      mfaFactorId = null;
    }

    function showMfaScreen(enrollment = false) {
      els.loginForm.hidden = true;
      els.mfaShell.hidden = false;
      els.mfaEnrollPanel.hidden = !enrollment;
      els.mfaError.classList.remove('visible');
      els.mfaCode.value = '';
      requestAnimationFrame(() => els.mfaCode.focus());
    }

    async function prepareMfa(session) {
      if (!session || mfaGateBusy) return;
      mfaGateBusy = true;
      try {
        const { data: aalData, error: aalError } = await client.auth.mfa.getAuthenticatorAssuranceLevel();
        if (aalError) throw aalError;
        if (aalData?.currentLevel === 'aal2') {
          els.loginShell.style.display = 'none';
          els.mfaShell.hidden = true;
          els.loginForm.hidden = false;
          await showApp(session);
          return;
        }

        const { data: factorData, error: factorError } = await client.auth.mfa.listFactors();
        if (factorError) throw factorError;
        const verified = (factorData?.totp || []).find((factor) => factor.status === 'verified');
        els.loginShell.style.display = '';
        els.appShell.classList.remove('visible');
        clearInterval(pollTimer);
        clearInterval(alarmTimer);

        if (verified) {
          mfaFactorId = verified.id;
          els.mfaTitle.textContent = 'Authenticator Verification';
          els.mfaHelp.textContent = 'Enter the 6-digit code from the authenticator app linked to the TCB operations account.';
          showMfaScreen(false);
          return;
        }

        const { data: enrolled, error: enrollError } = await client.auth.mfa.enroll({ factorType:'totp', friendlyName:'TCB Order Console' });
        if (enrollError) throw enrollError;
        mfaFactorId = enrolled.id;
        els.mfaQr.src = enrolled.totp.qr_code;
        els.mfaSecret.textContent = enrolled.totp.secret;
        els.mfaTitle.textContent = 'Secure the TCB Account';
        els.mfaHelp.textContent = 'Authenticator-app MFA is required before this account can access restaurant orders.';
        showMfaScreen(true);
      } catch (err) {
        console.error('MFA setup/check failed', err);
        els.loginShell.style.display = '';
        els.appShell.classList.remove('visible');
        showPasswordLogin();
        els.loginError.textContent = err.message || 'Could not verify the security status of this account.';
        els.loginError.classList.add('visible');
        await client.auth.signOut();
      } finally {
        mfaGateBusy = false;
      }
    }

    els.mfaForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      const code = els.mfaCode.value.replace(/\D/g, '');
      els.mfaError.classList.remove('visible');
      if (!mfaFactorId || !/^\d{6}$/.test(code)) {
        els.mfaError.textContent = 'Enter the current 6-digit authenticator code.';
        els.mfaError.classList.add('visible');
        return;
      }
      els.mfaButton.disabled = true;
      try {
        const { error } = await client.auth.mfa.challengeAndVerify({ factorId:mfaFactorId, code });
        if (error) throw error;
        const { data } = await client.auth.getSession();
        if (!data.session) throw new Error('Security verification completed but the session could not be refreshed.');
        await prepareMfa(data.session);
      } catch (err) {
        els.mfaError.textContent = err.message || 'Authenticator verification failed.';
        els.mfaError.classList.add('visible');
        els.mfaCode.select();
      } finally {
        els.mfaButton.disabled = false;
      }
    });

    els.mfaSignOut.addEventListener('click', async () => {
      await client.auth.signOut();
      showPasswordLogin();
    });

'''
    s = s.replace(marker, block + marker, 1)

no_session = """      if (!session) {
        els.loginShell.style.display = '';
        els.appShell.classList.remove('visible');
        clearInterval(pollTimer);
        clearInterval(alarmTimer);
        return;
      }"""
if no_session in s:
    s = s.replace(no_session, no_session.replace('        return;', '        showPasswordLogin();\n        return;'), 1)

old_auth = """    client.auth.onAuthStateChange((_event, session) => {
      setTimeout(() => showApp(session), 0);
    });

    const { data: initial } = await client.auth.getSession();
    await showApp(initial.session);"""
new_auth = """    client.auth.onAuthStateChange((_event, session) => {
      setTimeout(() => session ? prepareMfa(session) : showApp(null), 0);
    });

    const { data: initial } = await client.auth.getSession();
    if (initial.session) await prepareMfa(initial.session);
    else await showApp(null);"""
if old_auth in s:
    s = s.replace(old_auth, new_auth, 1)
elif new_auth not in s:
    raise SystemExit('auth state block not found')
p.write_text(s)

# MFA styling.
p = Path('orders-console.css')
s = p.read_text()
if '.oc-mfa-shell[hidden]' not in s:
    anchor = '.oc-login-note{font-size:.72rem!important;color:rgba(255,255,255,.4)!important;margin:18px 0 0!important}'
    css = anchor + '''
.oc-mfa-shell[hidden],.oc-mfa-enroll[hidden]{display:none!important}
.oc-mfa-head h2{font-family:var(--fh,Georgia,serif);font-size:1.45rem;margin:0 0 7px}
.oc-mfa-head p,.oc-mfa-enroll p{color:var(--oc-muted);font-size:.8rem;line-height:1.55;margin:0 0 14px}
.oc-mfa-enroll{margin:16px 0;padding:15px;border:1px solid var(--oc-border);border-radius:14px;background:#0f0f10}
.oc-mfa-enroll img{display:block;width:min(220px,100%);aspect-ratio:1;margin:12px auto;background:#fff;border-radius:12px;padding:8px}
.oc-mfa-secret-wrap{margin-top:12px}.oc-mfa-secret-wrap span{display:block;color:var(--oc-muted);font-size:.66rem;text-transform:uppercase;font-weight:700;letter-spacing:.04em;margin-bottom:5px}
.oc-mfa-secret-wrap code{display:block;padding:9px 10px;border-radius:9px;background:#080809;color:#fff;font-size:.72rem;line-height:1.5;overflow-wrap:anywhere;user-select:all}
.oc-mfa-signout{margin-top:9px}'''
    if anchor not in s:
        raise SystemExit('CSS anchor not found')
    s = s.replace(anchor, css, 1)
    p.write_text(s)

# Security QA: require MFA and tab-scoped auth.
p = Path('scripts/security_qa.py')
s = p.read_text()
if '("aal2", "mandatory MFA enforcement")' not in s:
    anchor = "    ('.eq(\"order_status\", currentStatus)', \"optimistic concurrency guard\"),"
    if anchor not in s:
        raise SystemExit('security QA admin anchor not found')
    s = s.replace(anchor, anchor + '\n    ("aal2", "mandatory MFA enforcement"),', 1)
if 'orders.html missing {label}' not in s:
    anchor = '# The public config may contain a publishable/legacy anon key, never a server key.'
    checks = '''orders_html = read("orders.html")
for token, label in [
    ("challengeAndVerify", "TOTP MFA challenge"),
    ("getAuthenticatorAssuranceLevel", "AAL gate"),
    ("storage: window.sessionStorage", "tab-scoped admin session storage"),
]:
    if token not in orders_html:
        errors.append(f"orders.html missing {label}")

'''
    if anchor not in s:
        raise SystemExit('security QA frontend anchor not found')
    s = s.replace(anchor, checks + anchor, 1)
p.write_text(s)

print('MFA hardening patch applied successfully.')
