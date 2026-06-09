/* ============================================================================
   Config Studio — shared shell: toolbar, sidebar, scope helpers, toasts.
   Injects chrome into #tb / #sb based on <body data-view="...">.
   ============================================================================ */
(function () {
  "use strict";

  /* ---- Icon set (inline SVG, 16px stroke) -------------------------------- */
  var P = {
    search:'<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>',
    repo:'<line x1="6" y1="3" x2="6" y2="15"/><circle cx="18" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M18 9a9 9 0 0 1-9 9"/>',
    chevDown:'<path d="m6 9 6 6 6-6"/>',
    chevRight:'<path d="m9 18 6-6-6-6"/>',
    lock:'<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
    terminal:'<polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/>',
    laptop:'<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M2 20h20"/>',
    folder:'<path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/>',
    user:'<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
    eye:'<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>',
    check:'<polyline points="20 6 9 17 4 12"/>',
    alert:'<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12" y2="17"/>',
    xcircle:'<circle cx="12" cy="12" r="9"/><path d="m15 9-6 6M9 9l6 6"/>',
    circle:'<circle cx="12" cy="12" r="9"/>',
    layers:'<path d="m12 2 9 5-9 5-9-5 9-5Z"/><path d="m3 12 9 5 9-5"/><path d="m3 17 9 5 9-5"/>',
    sliders:'<line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/>',
    code:'<polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>',
    db:'<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5"/><path d="M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3"/>',
    file:'<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>',
    puzzle:'<path d="M19.4 13a2 2 0 0 1 0-4h.6V6a2 2 0 0 0-2-2h-3v-.6a2 2 0 1 0-4 0V4H8a2 2 0 0 0-2 2v3h-.6a2 2 0 1 0 0 4H6v3a2 2 0 0 0 2 2h3v.6a2 2 0 1 0 4 0V18h3a2 2 0 0 0 2-2v-3z"/>',
    grid:'<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
    info:'<circle cx="12" cy="12" r="9"/><line x1="12" y1="11" x2="12" y2="16"/><line x1="12" y1="8" x2="12" y2="8"/>',
    grip:'<circle cx="9" cy="6" r="1"/><circle cx="15" cy="6" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="9" cy="18" r="1"/><circle cx="15" cy="18" r="1"/>',
    moon:'<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z"/>',
    sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    panel:'<rect x="3" y="3" width="18" height="18" rx="2"/><line x1="15" y1="3" x2="15" y2="21"/>',
    arrow:'<line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>',
    plus:'<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>',
    trash:'<polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
    compare:'<circle cx="5" cy="6" r="3"/><path d="M5 9v6"/><circle cx="19" cy="18" r="3"/><path d="M19 15V9a4 4 0 0 0-4-4h-3"/><path d="M9 18H7a4 4 0 0 1-4-4"/>',
    eyeoff:'<path d="M9.9 4.2A9.1 9.1 0 0 1 12 4c6.5 0 10 7 10 7a13 13 0 0 1-2.2 3M6.6 6.6A13 13 0 0 0 2 11s3.5 7 10 7a9 9 0 0 0 3.4-.6"/><line x1="2" y1="2" x2="22" y2="22"/>',
    play:'<polygon points="6 4 20 12 6 20 6 4"/>',
    diff:'<path d="M12 3v18M5 8H2M5 16H2M22 8h-3M22 16h-3"/>',
    settings:'<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 0 1-4 0v-.1a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 0 1 0-4h.1a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H9a1.6 1.6 0 0 0 1-1.5V3a2 2 0 0 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V9a1.6 1.6 0 0 0 1.5 1H21a2 2 0 0 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1Z"/>',
    move:'<path d="M5 9l-3 3 3 3M9 5l3-3 3 3M15 19l-3 3-3-3M19 9l3 3-3 3M2 12h20M12 2v20"/>'
  };
  function svg(name, size) {
    size = size || 16;
    return '<svg width="'+size+'" height="'+size+'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">'+(P[name]||'')+'</svg>';
  }

  /* ---- Scope metadata ---------------------------------------------------- */
  var SCOPES = {
    managed: { label:'Managed', icon:'lock',     order:1 },
    cli:     { label:'CLI args',icon:'terminal', order:2 },
    local:   { label:'Local',   icon:'laptop',   order:3 },
    project: { label:'Project', icon:'folder',   order:4 },
    user:    { label:'User',    icon:'user',     order:5 }
  };
  function chip(scope, opts) {
    opts = opts || {};
    var m = SCOPES[scope]; if (!m) return '';
    var cls = 'chip' + (opts.solid?' solid':'') + (opts.ghosted?' ghosted':'');
    var card = '';
    if (opts.path) {
      card = '<span class="chip-card"><div class="cc-path">'+opts.path+'</div>'+
             (opts.meta?'<div class="cc-meta">'+opts.meta+'</div>':'')+'</span>';
    }
    return '<span class="'+cls+'" data-scope="'+scope+'"'+(opts.path?' data-path="1" tabindex="0"':'')+'>'+
           svg(m.icon,11)+m.label+card+'</span>';
  }

  /* ---- Nav model --------------------------------------------------------- */
  var NAV = [
    { group:'Visualise', icon:'layers', items:[
      { id:'dashboard',  label:'Dashboard',   href:'dashboard.html',  icon:'grid' },
      { id:'scope',      label:'Scope Stack', href:'scope-stack.html',icon:'layers', warn:true },
      { id:'permissions',label:'Permissions', href:'permissions.html',icon:'lock',  count:'10' },
      { id:'mcp',        label:'MCP Servers', href:'mcp-map.html',    icon:'db',    count:'4' },
      { id:'memory',     label:'Memory',      href:'memory-map.html', icon:'file',  warn:true },
      { id:'extensions', label:'Extensions',  href:'extensions.html', icon:'puzzle',count:'4' }
    ]},
    { group:'Guided Config', icon:'sliders', items:[
      { id:'g-perm',  label:'Permissions',  href:'guided-permissions.html', icon:'lock' },
      { id:'g-model', label:'Model & Effort',href:'guided-permissions.html', icon:'sliders' },
      { id:'g-env',   label:'Environment',  href:'guided-permissions.html', icon:'terminal' },
      { id:'g-mcp',   label:'MCP Servers',  href:'guided-permissions.html', icon:'db' },
      { id:'g-mem',   label:'Memory',       href:'guided-permissions.html', icon:'file' }
    ]},
    { group:'Raw Editor', icon:'code', items:[
      { id:'raw', label:'Files & Editor', href:'raw-editor.html', icon:'code' }
    ]}
  ];

  /* ---- Build toolbar ----------------------------------------------------- */
  function buildToolbar(tb) {
    tb.innerHTML =
      '<div class="traffic"><i></i><i></i><i></i></div>'+
      '<button class="proj-switch" id="projBtn" title="Switch project">'+
        '<span class="repo-dot">'+svg('repo',14)+'</span>'+
        '<span>config-studio</span>'+
        '<span class="path">~/Projects/config-studio</span>'+
        '<span class="chev">'+svg('chevDown',14)+'</span>'+
      '</button>'+
      '<div class="tb-search"><span>'+svg('search',15)+'</span>'+
        '<input id="globalSearch" type="text" placeholder="Search keys, rules, files, servers…" />'+
        '<kbd>⌘K</kbd></div>'+
      '<div class="tb-spacer"></div>'+
      '<div class="sync" title="File watcher heartbeat"><span class="pulse"></span>Watching · synced 2s ago</div>'+
      '<button class="tb-toggle" id="roToggle" title="Read-only mode">'+svg('eye',14)+'<span>Read-only</span><span class="sw"></span></button>'+
      '<button class="icon-btn" id="themeBtn" title="Toggle theme">'+svg('moon',16)+'</button>';

    tb.querySelector('#themeBtn').addEventListener('click', function(){
      var root = document.documentElement;
      var light = root.getAttribute('data-theme')==='light';
      root.setAttribute('data-theme', light?'dark':'light');
      this.innerHTML = svg(light?'moon':'sun',16);
      try { localStorage.setItem('cs:theme', light?'dark':'light'); } catch(e){}
    });
    var ro = tb.querySelector('#roToggle');
    ro.addEventListener('click', function(){
      this.classList.toggle('on');
      toast(this.classList.contains('on') ? 'Read-only mode on — writes are disabled' : 'Read-only mode off', this.classList.contains('on')?'eye':'check');
    });
    tb.querySelector('#projBtn').addEventListener('click', function(){ toast('Project switcher — recent: config-studio · claude-plugins · rzem-web','repo'); });
    tb.querySelector('#globalSearch').addEventListener('keydown', function(e){
      if (e.key==='Enter' && this.value.trim()) { window.location.href = 'dashboard.html?q='+encodeURIComponent(this.value.trim()); }
    });
  }

  /* ---- Build sidebar ----------------------------------------------------- */
  function buildSidebar(sb, view) {
    var html = '';
    NAV.forEach(function(g){
      html += '<div class="nav-group"><div class="nav-head"><span class="ws-ico">'+svg(g.icon,13)+'</span>'+g.group+'</div>';
      g.items.forEach(function(it){
        var active = it.id===view ? ' active' : '';
        var tail = it.count ? '<span class="count">'+it.count+'</span>' : (it.warn ? '<span class="warn-dot" title="needs attention"></span>' : '');
        html += '<a class="nav-item'+active+'" href="'+it.href+'"><span class="ni-ico">'+svg(it.icon,15)+'</span>'+it.label+tail+'</a>';
      });
      html += '</div>';
    });
    html += '<div class="grow"></div>'+
      '<div class="side-foot">'+svg('info',13)+'<span>Claude Code 2.1.144 · engine v0.9</span></div>';
    sb.innerHTML = html;
  }

  /* ---- Toast ------------------------------------------------------------- */
  var toastWrap;
  function toast(msg, icon, actionLabel, actionFn) {
    if (!toastWrap) { toastWrap = document.createElement('div'); toastWrap.className='toast-wrap'; document.body.appendChild(toastWrap); }
    var el = document.createElement('div'); el.className='toast';
    el.innerHTML = '<span class="t-ico">'+svg(icon||'check',15)+'</span><span>'+msg+'</span>'+(actionLabel?'<span class="t-act">'+actionLabel+'</span>':'');
    toastWrap.appendChild(el);
    if (actionLabel && actionFn) el.querySelector('.t-act').addEventListener('click', function(){ actionFn(); el.remove(); });
    setTimeout(function(){ el.style.transition='opacity .3s, transform .3s'; el.style.opacity='0'; el.style.transform='translateY(8px)'; setTimeout(function(){el.remove();},300); }, 4200);
  }

  /* ---- Inspector toggle helper ------------------------------------------ */
  function setInspector(open) {
    var main = document.getElementById('main');
    if (main) main.classList.toggle('show-inspector', !!open);
  }

  /* ---- Boot -------------------------------------------------------------- */
  function boot() {
    try { var th = localStorage.getItem('cs:theme'); if (th) document.documentElement.setAttribute('data-theme', th); } catch(e){}
    var view = document.body.getAttribute('data-view');
    var tb = document.getElementById('tb'); if (tb) buildToolbar(tb);
    var sb = document.getElementById('sb'); if (sb) buildSidebar(sb, view);
    if (document.documentElement.getAttribute('data-theme')==='light') {
      var b = document.getElementById('themeBtn'); if (b) b.innerHTML = svg('sun',16);
    }
    document.addEventListener('keydown', function(e){
      if ((e.metaKey||e.ctrlKey) && e.key.toLowerCase()==='k') { e.preventDefault(); var s=document.getElementById('globalSearch'); if(s) s.focus(); }
    });
  }

  /* expose */
  window.Shell = { svg:svg, chip:chip, SCOPES:SCOPES, toast:toast, setInspector:setInspector };
  if (document.readyState==='loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
