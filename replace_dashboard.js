const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'dashboard.html');
let content = fs.readFileSync(filePath, 'utf8');

// We want to replace everything from "let adminFilter = 'all';" to the end of the script tag, just before "</script>"
const startMarker = "let adminFilter = 'all';";
const endMarker = "init();";

const startIndex = content.indexOf(startMarker);
const endIndex = content.indexOf(endMarker, startIndex);

if (startIndex === -1 || endIndex === -1) {
  console.error("Could not find start or end markers!");
  process.exit(1);
}

const replacement = `let adminFilter = 'all';

function setAdminFilter(f, el) {
  adminFilter = f;
  document.querySelectorAll('#page-admin .filter-chip').forEach(c => c.classList.remove('active'));
  el.classList.add('active');
  renderAdminPage();
}

async function banUser(username) {
  if (supabase) {
    try {
      const { error } = await supabase.from('gm_users').update({ banned: true }).eq('username', username);
      if (error) throw error;
    } catch (err) {
      console.error(err);
      toast('ล้มเหลวบนคลาวด์: ' + err.message, 'error');
      return;
    }
  }
  const banned = JSON.parse(localStorage.getItem('gm_banned') || '[]');
  if (!banned.includes(username)) banned.push(username);
  localStorage.setItem('gm_banned', JSON.stringify(banned));
  toast('บัน ' + username + ' แล้ว', 'success');
  renderAdminPage();
}

async function unbanUser(username) {
  if (supabase) {
    try {
      const { error } = await supabase.from('gm_users').update({ banned: false }).eq('username', username);
      if (error) throw error;
    } catch (err) {
      console.error(err);
      toast('ล้มเหลวบนคลาวด์: ' + err.message, 'error');
      return;
    }
  }
  let banned = JSON.parse(localStorage.getItem('gm_banned') || '[]');
  banned = banned.filter(u => u !== username);
  localStorage.setItem('gm_banned', JSON.stringify(banned));
  toast('ยกเลิกบัน ' + username + ' แล้ว', 'success');
  renderAdminPage();
}

async function deleteUser(username) {
  if (!confirm('ลบผู้ใช้ "' + username + '" ออกจากระบบ? ไม่สามารถกู้คืนได้')) return;

  if (supabase) {
    try {
      const { error } = await supabase.from('gm_users').delete().eq('username', username);
      if (error) throw error;
    } catch (err) {
      console.error(err);
      toast('ล้มเหลวบนคลาวด์: ' + err.message, 'error');
      return;
    }
  }

  let usersList = JSON.parse(localStorage.getItem('gold_users') || '[]');
  usersList = usersList.filter(u => u.username !== username);
  localStorage.setItem('gold_users', JSON.stringify(usersList));

  const k = userKeys(username);
  localStorage.removeItem(k.accs);
  localStorage.removeItem(k.txs);
  localStorage.removeItem('gm_fixed_exp_' + username);

  let banned = JSON.parse(localStorage.getItem('gm_banned') || '[]');
  banned = banned.filter(u => u !== username);
  localStorage.setItem('gm_banned', JSON.stringify(banned));

  if (viewingAs === username) adminExitView();
  buildAdminUserSwitcher();
  toast('ลบผู้ใช้ ' + username + ' และข้อมูลทั้งหมดแล้ว', 'success');
  renderAdminPage();
}

async function renderAdminPage() {
  if (session?.role !== 'admin') return;
  const search = (document.getElementById('admin-search')?.value || '').toLowerCase();
  
  let dbUsers = [];
  if (supabase) {
    try {
      const { data, error } = await supabase.from('gm_users').select('*');
      if (error) throw error;
      dbUsers = data || [];
    } catch (err) {
      console.error(err);
    }
  }

  const registered = JSON.parse(localStorage.getItem('gold_users') || '[]');
  const bannedList  = JSON.parse(localStorage.getItem('gm_banned') || '[]');
  const adminUser = { name: 'Sitthichok', username: 'sitthichok', role: 'admin', banned: false, isAdmin: true };
  
  let users = [];
  if (supabase && dbUsers.length > 0) {
    users = dbUsers.map(u => ({
      name: u.name,
      username: u.username,
      role: u.role,
      banned: u.banned,
      isAdmin: u.role === 'admin'
    }));
  } else {
    users = [adminUser, ...registered.map(u => ({
      ...u,
      role: 'user',
      banned: bannedList.includes(u.username),
      isAdmin: false
    }))];
  }

  let allAccs = [];
  let allTxs = [];
  if (supabase) {
    try {
      const { data: accs } = await supabase.from('gm_accounts').select('*');
      const { data: txs } = await supabase.from('gm_transactions').select('*');
      allAccs = accs || [];
      allTxs = txs || [];
    } catch (err) {
      console.error(err);
    }
  }

  let totalTx = 0, totalBal = 0;
  
  if (supabase && dbUsers.length > 0) {
    totalTx = allTxs.length;
    allAccs.forEach(acc => {
      const inc = allTxs.filter(t => t.type === 'income' && t.account_id === acc.id).reduce((s,t) => s + Number(t.amount || 0), 0);
      const exp = allTxs.filter(t => t.type === 'expense' && t.account_id === acc.id).reduce((s,t) => s + Number(t.amount || 0), 0);
      totalBal += Number(acc.initial_balance || 0) + inc - exp;
    });
  } else {
    const allRegistered = JSON.parse(localStorage.getItem('gold_users') || '[]');
    allRegistered.forEach(u => {
      const k = userKeys(u.username);
      const utx  = JSON.parse(localStorage.getItem(k.txs)  || '[]');
      const uacc = JSON.parse(localStorage.getItem(k.accs) || '[]');
      totalTx += utx.length;
      uacc.forEach(acc => {
        const inc = utx.filter(t=>t.type==='income'&&t.accountId===acc.id).reduce((s,t)=>s+t.amount,0);
        const exp = utx.filter(t=>t.type==='expense'&&t.accountId===acc.id).reduce((s,t)=>s+t.amount,0);
        totalBal += (acc.initialBalance||0) + inc - exp;
      });
    });
  }

  const total  = users.length;
  const banned = users.filter(u => u.banned).length;
  const active = total - banned;
  document.getElementById('adm-total-users').textContent  = total;
  document.getElementById('adm-active-users').textContent = active;
  document.getElementById('adm-banned-users').textContent = banned;
  document.getElementById('adm-total-tx').textContent     = totalTx;
  document.getElementById('adm-total-balance').textContent = fmtShort(totalBal);

  document.getElementById('user-count-badge').textContent = total;

  if (adminFilter === 'active') users = users.filter(u => !u.banned);
  if (adminFilter === 'banned') users = users.filter(u => u.banned);
  if (search) users = users.filter(u =>
    u.name?.toLowerCase().includes(search) || u.username?.toLowerCase().includes(search));

  const tbody = document.getElementById('admin-user-tbody');
  if (!users.length) {
    tbody.innerHTML = \`<tr><td colspan="7" style="text-align:center;padding:40px;color:var(--text-muted);"><div style="font-size:40px;margin-bottom:8px;">👤</div>ไม่พบผู้ใช้</td></tr>\`;
    return;
  }

  tbody.innerHTML = users.map(u => {
    const initials = (u.name || u.username || '?')[0].toUpperCase();
    const avatarBg = u.isAdmin
      ? 'linear-gradient(135deg,#c084fc,#a855f7)'
      : 'linear-gradient(135deg,#f0b90b,#d9a50a)';
    const roleBadge = u.isAdmin
      ? '<span class="role-badge role-admin">👑 Admin</span>'
      : '<span class="role-badge role-user">👤 User</span>';
    const statusBadge = u.banned
      ? '<span class="status-badge status-banned">🚫 บัน</span>'
      : '<span class="status-badge status-active">✅ ใช้งาน</span>';

    let userTxCount = '-', userAccCount = '-', userBal = '-';
    if (!u.isAdmin) {
      if (supabase && dbUsers.length > 0) {
        const uTxs = allTxs.filter(t => t.username === u.username);
        const uAccs = allAccs.filter(a => a.username === u.username);
        userTxCount = uTxs.length;
        userAccCount = uAccs.length;
        let bal = 0;
        uAccs.forEach(acc => {
          const inc = uTxs.filter(t => t.type === 'income' && t.account_id === acc.id).reduce((s,t) => s + Number(t.amount || 0), 0);
          const exp = uTxs.filter(t => t.type === 'expense' && t.account_id === acc.id).reduce((s,t) => s + Number(t.amount || 0), 0);
          bal += Number(acc.initial_balance || 0) + inc - exp;
        });
        userBal = fmtShort(bal);
      } else {
        const k = userKeys(u.username);
        const utx  = JSON.parse(localStorage.getItem(k.txs)  || '[]');
        const uacc = JSON.parse(localStorage.getItem(k.accs) || '[]');
        userTxCount  = utx.length;
        userAccCount = uacc.length;
        let bal = 0;
        uacc.forEach(acc => {
          const inc = utx.filter(t=>t.type==='income'&&t.accountId===acc.id).reduce((s,t)=>s+t.amount,0);
          const exp = utx.filter(t=>t.type==='expense'&&t.accountId===acc.id).reduce((s,t)=>s+t.amount,0);
          bal += (acc.initialBalance||0) + inc - exp;
        });
        userBal = fmtShort(bal);
      }
    }

    const isViewing = viewingAs === u.username;
    const actions = u.isAdmin ? '<span style="color:var(--text-muted);font-size:12px;">ไม่สามารถจัดการ</span>' : \`
      <div style="display:flex;gap:6px;justify-content:flex-end;flex-wrap:wrap;">
        <button class="action-btn view-tx \${isViewing?'active':''}" style="\${isViewing?'border-color:var(--accent);color:var(--accent);background:var(--accent-dim);':''}"
          onclick="adminSwitchUser('\${isViewing?'__self__':u.username}');document.getElementById('admin-user-switcher').value='\${isViewing?'__self__':u.username}';goPage('overview');">
          \${isViewing?'👁️ กำลังดู':'👁️ ดูข้อมูล'}
        </button>
        \${u.banned
          ? \\\`<button class="action-btn unban" onclick="unbanUser('\${u.username}')">✅ ยกเลิกบัน</button>\\\`
          : \\\`<button class="action-btn ban" onclick="banUser('\${u.username}')">🚫 บัน</button>\\\`
        }
        <button class="action-btn del" onclick="deleteUser('\${u.username}')">🗑️ ลบ</button>
      </div>\`;

    return \`<tr class="user-row">
      <td>
        <div style="display:flex;align-items:center;gap:10px;">
          <div class="user-avatar-sm" style="background:\${avatarBg};flex-shrink:0;">\${initials}</div>
          <div style="font-size:14px;font-weight:600;">\${u.name || u.username}</div>
        </div>
      </td>
      <td style="color:var(--text-secondary);font-size:13px;font-family:monospace;">\${u.username}</td>
      <td>\${roleBadge}</td>
      <td>\${statusBadge}</td>
      <td style="color:var(--text-secondary);">\${userTxCount}</td>
      <td style="color:var(--text-secondary);">\${userAccCount}</td>
      <td>\${actions}</td>
    </tr>\`;
  }).join('');
}

async function init() {
  initSupabase();
  await checkAuth();
  await loadUserData();

  const now = new Date();
  document.getElementById('topbar-date').textContent =
    now.toLocaleDateString('th-TH',{weekday:'long',day:'numeric',month:'long',year:'numeric'});

  document.getElementById('tx-date').value = now.toISOString().split('T')[0];

  populateAccountSelect();
  updateActiveAccount();
  renderOverview();
  updateBadge();
}

init();`;

// Replace from startIndex to endIndex + "init();".length
const partToReplace = content.substring(startIndex, endIndex + "init();".length);
content = content.replace(partToReplace, replacement);

fs.writeFileSync(filePath, content, 'utf8');
console.log("Successfully replaced Admin page logic and init!");
