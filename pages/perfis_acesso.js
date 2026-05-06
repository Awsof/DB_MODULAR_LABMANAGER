// pages/perfis_acesso.js — extraído da fase 4
// FIX: removido "as" solto na linha 256 que causava ReferenceError ao carregar
(function (global) {
  'use strict';
  var pages = global.pages || {};
  global.pages = pages;

pages.perfis_acesso = async function() {
  updateTopbar('Perfis de acesso e usuários', 'Gerencie permissões por perfil', '');

  let perfis = await dbAll('perfis_acesso');
  if(perfis.length === 0) {
    for(const p of PERFIS_DEFAULT){
      await dbPut('perfis_acesso', { ...p, permissoes: buildDefaultPerms() });
    }
    perfis = await dbAll('perfis_acesso');
  }

  let selectedId = perfis[0]?.id || 'supervisor';

  function renderSidebar() {
    return perfis.map(p => `
      <div class="acl-perfil-item ${p.id===selectedId?'selected':''}" data-pid="${p.id}">
        <div>
          <div class="acl-perfil-nome">${p.nome}</div>
          <div class="acl-perfil-tipo">${p.fullAccess?'Acesso Total':'Acesso Personalizado'}</div>
        </div>
        ${p.fullAccess ? '<span class="acl-full-badge">✓ TOTAL</span>' : ''}
      </div>`).join('');
  }

  function renderMatrix(perfil) {
    if(!perfil) return '';
    const perms = perfil.permissoes || {};
    const isSuper = perfil.fullAccess;

    const rows = ACL_STRUCTURE.map(cat => {
      const catPages = cat.pages;

      const pageRows = catPages.map(pg => {
        const pgEnabled = isSuper || perms[pg.key] !== false;

        const btnRows = pg.btns.map(btn => {
          const btnKey = `${pg.key}::${btn.key}`;
          const btnEnabled = isSuper || perms[btnKey] !== false;
          return `<div class="acl-btn-row">
            <span class="acl-btn-label">🔲 Botão: ${btn.label}</span>
            <label class="acl-toggle">
              <input type="checkbox" ${btnEnabled?'checked':''} ${isSuper?'disabled':''}
                data-perm="${btnKey}" onchange="window._aclToggle(this)">
              <span class="acl-toggle-slider"></span>
            </label>
          </div>`;
        }).join('');

        return `<div class="acl-page-row">
          <span class="acl-page-label">📄 ${pg.label}${pg.btns.length?`<small>(${pg.btns.length} botão/ões)</small>`:''}</span>
          <label class="acl-toggle">
            <input type="checkbox" ${pgEnabled?'checked':''} ${isSuper?'disabled':''}
              data-perm="${pg.key}" onchange="window._aclToggle(this)">
            <span class="acl-toggle-slider"></span>
          </label>
        </div>${btnRows}`;
      }).join('');

      return `<div class="acl-category">
        <div class="acl-cat-header">
          <span class="acl-cat-label">📁 ${cat.cat}</span>
          ${isSuper ? '<span style="font-size:10px;color:rgba(15,155,148,.8);font-weight:600">Acesso Total</span>' : ''}
        </div>
        ${pageRows}
      </div>`;
    }).join('');

    return `<div class="acl-matrix">
      <div class="acl-matrix-header">
        <div>
          <div class="acl-matrix-title">${perfil.nome}</div>
          <div class="acl-matrix-sub">${isSuper?'Acesso completo a todas as funcionalidades':'Defina as permissões abaixo'}</div>
        </div>
        ${isSuper ? '' : `<button class="btn secondary" style="font-size:12px;padding:5px 12px" onclick="window._aclResetPerfil()">↺ Redefinir para Total</button>`}
      </div>
      <div style="max-height:600px;overflow-y:auto">${rows}</div>
    </div>`;
  }

  function renderPage() {
    const perfil = perfis.find(p=>p.id===selectedId);
    document.getElementById('acl-sidebar-list').innerHTML = renderSidebar();
    document.getElementById('acl-matrix-wrap').innerHTML = renderMatrix(perfil);
    document.querySelectorAll('[data-pid]').forEach(el => {
      el.addEventListener('click', () => {
        selectedId = el.dataset.pid;
        renderPage();
      });
    });
  }

  const isAdminUser = currentUser?.isAdmin || false;

  document.getElementById('content').innerHTML = `
    <div class="acl-grid" style="margin-bottom:24px">
      <div>
        <div class="acl-sidebar">
          <div class="acl-sidebar-header">Perfis Disponíveis</div>
          <div id="acl-sidebar-list"></div>
        </div>
        <div style="margin-top:12px;padding:10px 14px;background:var(--bg2);border:1px solid var(--border);border-radius:var(--r2);font-size:11px;color:var(--text3);line-height:1.8">
          <strong style="color:var(--navy)">Como funciona:</strong><br>
          ✓ <strong>Supervisor</strong> tem acesso total (imutável)<br>
          ✓ Ative ou desative páginas e botões por perfil<br>
          ✓ Desativar uma página oculta ela do menu<br>
          ✓ As configurações são salvas automaticamente
        </div>
      </div>
      <div id="acl-matrix-wrap"></div>
    </div>

    ${isAdminUser ? `
    <div class="chart-card" style="margin-bottom:24px">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">
        <div class="chart-title" style="margin:0">Usuários do Sistema</div>
        <button class="btn" id="new-user-btn" style="font-size:12px;padding:6px 14px">+ Novo Usuário</button>
      </div>
      <div id="users-list"></div>
    </div>` : ''}

    <div class="chart-card">
      <div class="chart-title" style="margin-bottom:12px">Log de Auditoria</div>
      <div style="font-size:11px;color:var(--text3);margin-bottom:8px">Registro de todas as ações realizadas no sistema</div>
      <div style="max-height:400px;overflow-y:auto">
        <div class="audit-row" style="background:var(--navy);color:rgba(255,255,255,.7);font-weight:700;border-radius:var(--r) var(--r) 0 0">
          <span>Data / Hora</span><span>Usuário</span><span>Descrição</span><span>Ação</span>
        </div>
        <div id="audit-log-list"><div style="text-align:center;padding:30px;color:var(--text3)">Carregando...</div></div>
      </div>
    </div>
  `;

  renderPage();

  async function loadUsers() {
    const ul = document.getElementById('users-list');
    if(!ul) return;
    const users = await dbAll('usuarios');
    ul.innerHTML = users.length === 0
      ? `<div style="color:var(--text3);font-size:12px;padding:10px">Nenhum usuário cadastrado.</div>`
      : `<table style="width:100%;font-size:12px"><thead><tr>
          <th>Login</th><th>Nome</th><th>Perfil</th><th>Admin</th><th>Vínculo RLS</th><th></th>
        </tr></thead><tbody>
          ${users.map(u=>{
            const rlsLabel = u.entityType
              ? `<span style="font-size:10px;padding:2px 7px;border-radius:10px;background:rgba(15,155,148,.1);color:var(--accent2);border:1px solid rgba(15,155,148,.25)">${u.entityType}: ${u.entityNome||u.entityId||'?'}</span>`
              : `<span style="font-size:10px;color:var(--text3)">Global</span>`;
            return `<tr>
              <td style="font-family:var(--mono);color:var(--text3)">${u.login}</td>
              <td style="font-weight:600;color:var(--navy)">${u.nome||'—'}</td>
              <td><span class="badge tag">${u.perfilNome||u.perfilId}</span></td>
              <td style="text-align:center">${u.isAdmin?'<span style="color:var(--accent2);font-weight:700">✓</span>':'—'}</td>
              <td>${rlsLabel}</td>
              <td style="white-space:nowrap">
                <div style="display:flex;gap:5px">
                  ${u.login!=='admin'?`<button class="btn sm secondary" data-edit-user="${u.login}">Editar</button>
                  <button class="btn sm danger" data-del-user="${u.login}">×</button>`:'<span style="font-size:11px;color:var(--text3)">Protegido</span>'}
                </div>
              </td>
            </tr>`;
          }).join('')}
        </tbody></table>`;

    ul.querySelectorAll('[data-edit-user]').forEach(btn => {
      btn.addEventListener('click', () => openUserModal(btn.dataset.editUser, perfis, loadUsers));
    });
    ul.querySelectorAll('[data-del-user]').forEach(btn => {
      btn.addEventListener('click', async () => {
        if(!confirm(`Excluir usuário "${btn.dataset.delUser}"?`)) return;
        await dbDeleteLogged('usuarios', btn.dataset.delUser, `Excluiu usuário ${btn.dataset.delUser}`);
        toast('Usuário excluído.','info');
        loadUsers();
      });
    });
  }

  async function loadAuditLog() {
    const el = document.getElementById('audit-log-list');
    if(!el) return;
    const logs = (await dbAll('audit_log')).reverse().slice(0,200);
    if(!logs.length){
      el.innerHTML = `<div style="text-align:center;padding:30px;color:var(--text3)">Nenhuma ação registrada ainda.</div>`;
      return;
    }
    const actionClass = a => {
      if(a==='login'||a==='logout') return 'login';
      if(a.includes('Excluiu')||a.includes('excluiu')) return 'delete';
      if(a.includes('Criou')||a.includes('criou')||a.includes('import')) return 'create';
      return 'edit';
    };
    el.innerHTML = logs.map(l=>{
      const dt = new Date(l.ts);
      const dateFmt = dt.toLocaleDateString('pt-BR');
      const timeFmt = dt.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit',second:'2-digit'});
      const cls = actionClass(l.acao);
      return `<div class="audit-row">
        <span style="color:var(--text3)">${dateFmt} ${timeFmt}</span>
        <span style="font-weight:600;color:var(--navy)">${l.usuario}</span>
        <span style="color:var(--text2)">${l.detalhe||'—'}</span>
        <span><span class="audit-action-badge ${cls}">${l.acao}</span></span>
      </div>`;
    }).join('');
  }

  if(isAdminUser) {
    loadUsers();
    document.getElementById('new-user-btn')?.addEventListener('click', () => openUserModal(null, perfis, loadUsers));
  }
  loadAuditLog();

  window._aclToggle = async function(checkbox) {
    const perfil = perfis.find(p=>p.id===selectedId);
    if(!perfil || perfil.fullAccess) return;
    const key = checkbox.dataset.perm;
    const val = checkbox.checked;
    if(!perfil.permissoes) perfil.permissoes = buildDefaultPerms();
    perfil.permissoes[key] = val;
    if(!val && !key.includes('::')) {
      const pg = ACL_STRUCTURE.flatMap(c=>c.pages).find(p=>p.key===key);
      if(pg) for(const btn of pg.btns) perfil.permissoes[`${key}::${btn.key}`] = false;
    }
    await dbPut('perfis_acesso', perfil);
    await auditLog('Editou permissão', `Perfil ${perfil.nome}: ${key}=${val}`);
    toast('Permissão atualizada.','success', 1500);
    document.getElementById('acl-matrix-wrap').innerHTML = renderMatrix(perfil);
  };

  window._aclResetPerfil = async function() {
    const perfil = perfis.find(p=>p.id===selectedId);
    if(!perfil) return;
    if(!confirm(`Redefinir todas as permissões de "${perfil.nome}" para acesso total?`)) return;
    perfil.permissoes = buildDefaultPerms();
    await dbPut('perfis_acesso', perfil);
    toast('Permissões redefinidas.','success');
    renderPage();
  };
};

})(window);
