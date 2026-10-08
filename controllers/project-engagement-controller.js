var MN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
  N = 18,
  B0 = 10,
  Y0 = 2026,
  KEY = 'alloc-board-v1',
  BOARD_ID = 'project-engagement',
  S, armed = false;
var view = OrgPlanner.Views.createDomView(document),
  teamAccess = OrgPlanner.Models.createTeamAccess(),
  stateModel;
var TL = {
  S: 'Short term',
  M: 'Mid term',
  L: 'Long term'
};
var STATUSES = ['Planned', 'Execution', 'Closed'];

function term(p) {
  var d = p.e - p.s + 1;
  return d < 3 ? 'S' : d <= 9 ? 'M' : 'L'
}

function ml(i) {
  var m = B0 + i;
  return MN[m % 12] + ' ' + (Y0 + Math.floor(m / 12))
}

function rid() {
  return 'x' + Math.random().toString(36).slice(2, 8)
}

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"]/g, function(c) {
    return {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;'
    } [c]
  })
}

function num(v) {
  v = parseFloat(v);
  return isNaN(v) ? 0 : v
}

function $(i) {
  return view.element(i)
}

function say(m) {
  view.text('msg', m)
}

function mk(id, n, r, a, x, sen, cc, cap, t, lead) {
  var p = {
    id: id,
    name: n,
    role: r,
    areas: a,
    type: t || 'int',
    sen: sen || 'Senior',
    lead: !!lead,
    cap: cap || 100,
    cost: t === 'ext' ? 9000 : 0,
    notes: ''
  };
  if (p.type === 'ext') p.fte = p.cap / 100;
  return p
}

function init() {
  var P = [{
    id: 'xjgvqu2',
    name: 'Dev1',
    role: 'Developer',
    areas: 'All',
    type: 'int',
    sen: 'Mid',
    lead: false,
    cap: 100,
    cost: 0,
    notes: ''
  }, {
    id: 'xj8qtsd',
    name: 'Dev2',
    role: 'Developer',
    areas: 'All',
    type: 'int',
    sen: 'Mid',
    lead: false,
    cap: 100,
    cost: 0,
    notes: ''
  }, {
    id: 'xp2q85j',
    name: 'Dev3',
    role: 'Developer',
    areas: 'All',
    type: 'int',
    sen: 'Mid',
    lead: false,
    cap: 100,
    cost: 0,
    notes: ''
  }, {
    id: 'xvd7jb8',
    name: 'Ext A',
    role: 'External team member',
    areas: 'HR',
    type: 'ext',
    sen: 'Senior',
    lead: false,
    cap: 100,
    cost: 0,
    notes: '',
    fte: 1
  }, {
    id: 'xfqe5kw',
    name: 'Ext B',
    role: 'External team member',
    areas: 'HR',
    type: 'ext',
    sen: 'Senior',
    lead: false,
    cap: 50,
    cost: 0,
    notes: '',
    fte: 0.5
  }, {
    id: 'x47gqp6',
    name: 'Ext C',
    role: 'External team member',
    areas: 'COPE, Cross-app',
    type: 'ext',
    sen: 'Senior',
    lead: false,
    cap: 100,
    cost: 0,
    notes: '',
    fte: 1
  }];
  var J = [
    ['fin', 'Finance enhancements', 'L', 0, 11, 3, 'FIN,Auth', ['core']],
    ['ewm', 'EWM wave rollout', 'L', 2, 13, 2.5, 'EWM,LE', []],
    ['qm', 'QM inspection app', 'M', 1, 6, 1.5, 'QM', []],
    ['hr', 'HR payroll interface', 'S', 3, 4, .5, 'HR', ['qm']],
    ['core', 'Clean core remediation', 'M', 0, 8, 1, 'FIN,SD', []],
    ['roll', 'Rolling releases standby', 'L', 0, 17, 1, '', []]
  ].map(function(j, i) {
    return {
      id: j[0],
      name: j[1],
      size: j[2],
      s: j[3],
      e: j[4],
      need: j[5],
      areas: j[6],
      dep: j[7],
      notes: '',
      x: 12 + (i % 3) * 285,
      y: 12 + Math.floor(i / 3) * 270,
      status: 'Planned'
    }
  });
  var A = [
    ['xjgvqu2', 'fin', 60],
    ['xjgvqu2', 'core', 40],
    ['xj8qtsd', 'ewm', 60],
    ['xj8qtsd', 'qm', 40],
    ['xp2q85j', 'qm', 30],
    ['xp2q85j', 'roll', 60],
    ['xvd7jb8', 'hr', 50],
    ['xvd7jb8', 'fin', 30],
    ['xfqe5kw', 'hr', 50],
    ['x47gqp6', 'roll', 40],
    ['x47gqp6', 'ewm', 40]
  ].map(function(a) {
    return {
      id: rid(),
      p: a[0],
      j: a[1],
      pct: a[2]
    }
  });
  return {
    view: 'board',
    zoom: 100,
    selP: null,
    selJ: null,
    propertiesOpen: true,
    open: {},
    people: P,
    projects: J,
    alloc: A
  }
}

function normalizeStatus(p) {
  if (STATUSES.indexOf(p.status) < 0) p.status = 'Planned'
}

function load() {
  stateModel = OrgPlanner.Models.createStateStore(teamAccess.boardKey(BOARD_ID));
  var o = stateModel.read();
  if (!o) {
    var legacy = OrgPlanner.Models.createStateStore(KEY).read();
    if (legacy) {
      o = legacy;
      if (teamAccess.canManage()) stateModel.write(o)
    }
  }
  if (o && o.people && o.projects) {
    o.selP = null;
    o.selJ = null;
    o.zoom = o.zoom || 100;
    if (typeof o.propertiesOpen !== 'boolean') o.propertiesOpen = true;
    o.people.forEach(function(p) {
      if (p.type === 'ext') {
        var fte = p.fte == null ? NaN : Number(p.fte);
        if (!isFinite(fte) || fte < 0) fte = p.cap == null ? 1 : Math.max(0, num(p.cap) / 100);
        p.fte = fte;
        p.cap = fte * 100
      }
    });
    o.projects.forEach(normalizeStatus);
    return o
  }
  return init()
}

function validBoard(o) {
  if (!o || !Array.isArray(o.people) || !Array.isArray(o.projects) || !Array.isArray(o.alloc))
    return false;
  var people = new Set(),
    projects = new Set();
  if (!o.people.every(function(p) {
      if (!p || typeof p.id !== 'string' || !p.id || typeof p.name !== 'string' || typeof p
        .role !== 'string' || typeof p.areas !== 'string' || ['int', 'ext'].indexOf(p.type) < 0 ||
        !isFinite(Number(p.cap)) || people.has(p.id)) return false;
      people.add(p.id);
      return true
    })) return false;
  if (!o.projects.every(function(p) {
      if (!p || typeof p.id !== 'string' || !p.id || typeof p.name !== 'string' || typeof p
        .areas !== 'string' || !Array.isArray(p.dep) || !['s', 'e', 'need', 'x', 'y'].every(
          function(k) {
            return isFinite(Number(p[k]))
          }) || projects.has(p.id)) return false;
      projects.add(p.id);
      normalizeStatus(p);
      return true
    })) return false;
  return o.alloc.every(function(a) {
    return a && typeof a.id === 'string' && people.has(a.p) && projects.has(a.j) && isFinite(
      Number(a.pct)) && Number(a.pct) >= 0
  })
}

function save() {
  if (teamAccess.canManage()) stateModel.write(S)
}

function canManage() {
  return teamAccess.canManage()
}

function per(id) {
  return S.people.filter(function(p) {
    return p.id === id
  })[0]
}

function prj(id) {
  return S.projects.filter(function(p) {
    return p.id === id
  })[0]
}

function ld(p, m) {
  return S.alloc.reduce(function(s, a) {
    var j = prj(a.j);
    return s + (a.p === p.id && j && j.s <= m && m <= j.e ? num(a.pct) : 0)
  }, 0)
}

function peak(p) {
  var b = 0,
    at = 0;
  for (var i = 0; i < N; i++) {
    var l = ld(p, i);
    if (l > b) {
      b = l;
      at = i
    }
  }
  return [b, at]
}

function covers(p, a) {
  var l = p.areas.toLowerCase().split(',').map(function(x) {
    return x.trim()
  });
  return l.indexOf('all') >= 0 || l.indexOf(a.toLowerCase()) >= 0
}

function sp(s) {
  return s ? s.split(',').map(function(x) {
    return x.trim()
  }).filter(Boolean) : []
}

function opts(l, v) {
  return l.map(function(o) {
    return '<option' + (o === v ? ' selected' : '') + '>' + o + '</option>'
  }).join('')
}

function pRow(p) {
  var pk = peak(p),
    o = S.open[p.id],
    h = '<div class="pr' + (S.selP === p.id ? ' on' : '') + '" draggable="' + canManage() + '" data-p="' + p.id +
    '"><div class="pt"><b>' + (p.lead ? '★ ' : '') + esc(p.name) + '</b><span class="ld' + (pk[0] >
      p.cap ? ' r' : '') + '" title="Peak project allocation vs capacity">' + pk[0] + '%/' + p.cap +
    '%</span><button data-tg="' + p.id + '" aria-label="Attributes">' + (o ? '▴' : '▾') +
    '</button><button class="delete-person" data-dp="' + p.id + '" aria-label="Delete ' + esc(p
      .name) + '" title="Delete person">x</button></div></div>';
  if (o) {
    var al = S.alloc.filter(function(a) {
      return a.p === p.id
    }).map(function(a) {
      return esc((prj(a.j) || {}).name) + ' ' + a.pct + '%'
    }).join(', ') || 'none';
    h += '<div class="pa"><div class="ps">Allocated: ' + al +
      '</div><label>Name</label><input data-f="name" data-i="' + p.id + '" value="' + esc(p.name) +
      '"><label>Role</label><input data-f="role" data-i="' + p.id + '" value="' + esc(p.role) +
      '"><label>Areas (comma separated, or All)</label><input data-f="areas" data-i="' + p.id +
      '" value="' + esc(p.areas) + '"><label>Seniority</label><select data-f="sen" data-i="' + p
      .id + '">' + opts(['Junior', 'Mid', 'Senior'], p.sen) +
      '</select><label class="sw"><input type="checkbox" data-lead="' + p.id + '"' + (p.lead ?
        ' checked' : '') + '> Lead role</label>' + (p.type === 'ext' ?
        '<label>Headcount (FTE)</label><input type="number" min="0" step="0.1" data-f="fte" data-i="' +
        p.id + '" value="' + p.fte + '">' :
        '<label>Capacity for projects %</label><input type="number" data-f="cap" data-i="' + p.id +
        '" value="' + p.cap + '">') + (p.type === 'ext' ?
        '<label>Cost per month</label><input type="number" data-f="cost" data-i="' + p.id +
        '" value="' + p.cost + '">' : '') +
      '<label>Notes</label><textarea rows="2" data-f="notes" data-i="' + p.id + '">' + esc(p
      .notes) + '</textarea><button data-dp="' + p.id +
      '" style="margin-top:8px">Delete person</button></div>'
  }
  return h
}

function rail() {
  view.html('rail', '<div class="rail"><h3>Internal team</h3>' + S.people.filter(function(p) {
    return p.type === 'int'
  }).map(pRow).join('') + '</div><div class="rail ex"><h3>External team</h3>' + (S.people.some(
    function(p) {
      return p.type === 'ext'
    }) ? S.people.filter(function(p) {
    return p.type === 'ext'
  }).map(pRow).join('') : '<div class="ps">Empty. Use Add external.</div>') + '</div>')
}

function node(p) {
  var al = S.alloc.filter(function(a) {
      return a.j === p.id
    }),
    fte = al.reduce(function(s, a) {
      return s + num(a.pct)
    }, 0) / 100,
    r = p.need ? Math.min(100, fte / p.need * 100) : 100,
    status = p.status || 'Planned',
    statusClass = status === 'Execution' ? 'execution' : status === 'Closed' ? 'closed' : 'planned';
  var ch = al.map(function(a) {
    var q = per(a.p);
    return q ? '<span class="ch ' + q.type + '" draggable="' + canManage() + '" data-a="' + a.id + '">' + (q
        .lead ? '★ ' : '') + esc(q.name) + '<input type="number" min="0" step="5" data-ap="' + a
      .id + '" value="' + a.pct + '" aria-label="Percent">%<button data-da="' + a.id +
      '" aria-label="Remove">x</button></span>' : ''
  }).join('');
  var tg = sp(p.areas).map(function(a) {
    var ok = al.some(function(x) {
      var q = per(x.p);
      return q && covers(q, a)
    });
    return '<span class="tg' + (ok ? '' : ' w') + '">' + esc(a) + (ok ? '' : ' gap') + '</span>'
  }).join('');
  return '<div class="nd s' + term(p) + (S.selJ === p.id ? ' on' : '') + '" data-n="' + p.id +
    '" style="left:' + p.x + 'px;top:' + p.y + 'px"><div class="nh"><b>' + esc(p.name) +
    '</b><span class="bd">' + TL[term(p)] + '</span><span class="bd status ' + statusClass + '">' +
    esc(status) + '</span></div><div class="dt">' + ml(p.s) + ' to ' + ml(p.e) + ' · ' + (p.e - p
      .s + 1) + ' mo</div><div class="nb' + (fte < p.need ? ' u' : '') + '"><span style="width:' +
    r + '%"></span></div><div class="dt">' + fte.toFixed(1) + ' of ' + p.need +
    ' FTE</div><div class="chs">' + ch + '</div><div style="margin-top:6px">' + tg + '</div></div>'
}

function tl() {
  var h = '<div class="tr"><div></div>' + Array.from({
    length: N
  }, function(_, i) {
    var m = (B0 + i) % 12;
    return '<div class="mh">' + MN[m] + (i === 0 || m === 0 ? '<br>' + (Y0 + Math.floor((B0 +
      i) / 12)) : '') + '</div>'
  }).join('') + '</div><div class="sec">Projects</div>';
  S.projects.forEach(function(p) {
    var f = S.alloc.filter(function(a) {
      return a.j === p.id
    }).reduce(function(s, a) {
      return s + num(a.pct)
    }, 0) / 100;
    h += '<div class="tr"><div class="tl" data-sj="' + p.id + '" title="' + esc(p.name) + '">' +
      esc(p.name) + '</div><div class="bar2 s' + term(p) + '" style="grid-column:' + (p.s + 2) +
      '/' + (p.e + 3) + '">' + f.toFixed(1) + ' / ' + p.need + ' FTE</div></div>'
  });
  h +=
    '<div class="sec">Load per person or team (percent of one FTE; red means over capacity)</div>';
  S.people.forEach(function(p) {
    h += '<div class="tr"><div class="tl" data-sp="' + p.id + '">' + esc(p.name) + (p.type ===
      'ext' ? ' (ext)' : '') + '</div>' + Array.from({
      length: N
    }, function(_, i) {
      var l = ld(p, i);
      return '<div class="hc' + (l > p.cap ? ' r' : l > 0 ? (l >= p.cap * .8 ? ' a' :
          ' b') : '') + '" style="grid-column:' + (i + 2) + '" title="' + esc(p.name) +
        ' ' + ml(i) + '">' + (l || '') + '</div>'
    }).join('') + '</div>'
  });
  return '<div class="tlw">' + h + '</div>'
}

function mid() {
  if (S.view === 'tl') {
    view.html('mid', tl());
    return
  }
  var old = $('cvs'),
    sl = old ? old.scrollLeft : 0,
    st = old ? old.scrollTop : 0,
    z = S.zoom / 100,
    xs = S.projects.map(function(p) {
      return p.x
    }),
    ys = S.projects.map(function(p) {
      return p.y
    }),
    W = Math.max(1300, Math.max.apply(null, xs.concat([0])) + 300),
    H = Math.max(800, Math.max.apply(null, ys.concat([0])) + 300);
  $('mid').innerHTML = '<div class="cvs" id="cvs"><div class="sz" style="width:' + W * z +
    'px;height:' + H * z + 'px"><div class="cvi" style="width:' + W + 'px;height:' + H +
    'px;transform:scale(' + z + ')">' + S.projects.map(node).join('') + '</div></div></div>';
  var c = $('cvs');
  c.scrollLeft = sl;
  c.scrollTop = st
}

function edp() {
  var p = S.selJ ? prj(S.selJ) : null,
    w = $('wrap'),
    panelOpen = !!p && (S.view !== 'board' || S.propertiesOpen);
  w.className = 'wrap' + (panelOpen ? ' ed' : '');
  if (!panelOpen) {
    $('ed').innerHTML = '';
    $('ed').hidden = true;
    return
  }
  $('ed').hidden = false;
  var d = ' data-j="';
  var mo = Array.from({
    length: N
  }, function(_, i) {
    return i
  });
  var so = function(v) {
    return mo.map(function(i) {
      return '<option value="' + i + '"' + (i === v ? ' selected' : '') + '>' + ml(i) +
        '</option>'
    }).join('')
  };
  $('ed').innerHTML = '<b>Project</b><label>Name</label><input' + d + 'name" value="' + esc(p
    .name) + '"><label>Status</label><select' + d + 'status">' + opts(STATUSES, p.status) +
    '</select><div class="dt" style="margin-top:8px">Term: <b>' + TL[term(p)] + '</b> (' + (p.e - p
      .s + 1) + ' months, set by start and end)</div><label>Start</label><select' + d + 's">' + so(p
      .s) + '</select><label>End</label><select' + d + 'e">' + so(p.e) +
    '</select><label>Needed FTE</label><input type="number" step="0.5"' + d + 'need" value="' + p
    .need + '"><label>Areas needed (comma separated)</label><input' + d + 'areas" value="' + esc(p
      .areas) + '"><label>Depends on</label><div class="dk">' + S.projects.filter(function(q) {
      return q.id !== p.id
    }).map(function(q) {
      return '<label><input type="checkbox" data-dep="' + q.id + '"' + (p.dep.indexOf(q.id) >= 0 ?
        ' checked' : '') + '>' + esc(q.name) + '</label>'
    }).join('') + '</div><label>Notes</label><textarea rows="3"' + d + 'notes">' + esc(p.notes) +
    '</textarea><div class="bar" style="margin-top:10px"><button data-dj="' + p.id +
    '">Delete project</button><button data-cj="1">Close</button></div>'
}

function lines() {
  var w = $('wrap').getBoundingClientRect(),
    h = '<defs><marker id="ar" viewBox="0 0 8 8" markerUnits="userSpaceOnUse" markerWidth="' + (11 *
      Math.max(.55, Math.min(1, S.zoom / 100))) + '" markerHeight="' + (11 * Math.max(.55, Math.min(
      1, S.zoom / 100))) +
    '" refX="7" refY="4" orient="auto"><path d="M0,0L8,4L0,8z" style="fill:var(--mut)"/></marker></defs>';

  function R(el) {
    var r = el.getBoundingClientRect();
    return {
      l: r.left - w.left,
      r: r.right - w.left,
      t: r.top - w.top,
      b: r.bottom - w.top
    }
  }

  function edge(ea, eb, st) {
    var A = R(ea),
      B = R(eb),
      acy = (A.t + A.b) / 2,
      bcy = (B.t + B.b) / 2,
      acx = (A.l + A.r) / 2,
      bcx = (B.l + B.r) / 2,
      p, q, d, e;
    if (A.r + 16 <= B.l) {
      p = [A.r, acy];
      d = [1, 0];
      q = [B.l, bcy];
      e = [-1, 0]
    } else if (B.r + 16 <= A.l) {
      p = [A.l, acy];
      d = [-1, 0];
      q = [B.r, bcy];
      e = [1, 0]
    } else if (B.t >= A.b) {
      p = [acx, A.b];
      d = [0, 1];
      q = [bcx, B.t];
      e = [0, -1]
    } else {
      p = [acx, A.t];
      d = [0, -1];
      q = [bcx, B.b];
      e = [0, 1]
    }
    var k = Math.max(40, Math.hypot(q[0] - p[0], q[1] - p[1]) / 2.5);
    return '<path d="M' + p + ' C' + (p[0] + d[0] * k) + ' ' + (p[1] + d[1] * k) + ' ' + (q[0] + e[
        0] * k) + ' ' + (q[1] + e[1] * k) + ' ' + q + '" fill="none" ' + st +
      ' marker-end="url(#ar)"/>'
  }
  if (S.view === 'board') {
    S.projects.forEach(function(p) {
      p.dep.forEach(function(d) {
        var a = document.querySelector('[data-n="' + d + '"]'),
          b = document.querySelector('[data-n="' + p.id + '"]');
        if (a && b) h += edge(a, b,
          'style="stroke:var(--mut)" stroke-width="2" stroke-dasharray="6 4"')
      })
    });
    if (S.selP) {
      var pe = document.querySelector('[data-p="' + S.selP + '"]');
      if (pe) S.alloc.filter(function(a) {
        return a.p === S.selP
      }).forEach(function(a) {
        var n = document.querySelector('[data-n="' + a.j + '"]');
        if (n) h += edge(pe, n, 'style="stroke:var(--acc)" stroke-width="2.5"')
      })
    }
  }
  var cs = $('cvs');
  if (cs && h.indexOf('<path') > 0) {
    var cr = cs.getBoundingClientRect();
    h = h.replace('</defs>', '<clipPath id="cp"><rect x="' + (cr.left - w.left) + '" y="' + (cr
        .top - w.top) + '" width="' + cr.width + '" height="' + cr.height +
      '"/></clipPath></defs><g clip-path="url(#cp)">') + '</g>'
  }
  $('ov').innerHTML = h
}

function insights() {
  var o = [],
    tot = 0,
    ext = 0,
    cost = 0;
  S.people.forEach(function(p) {
    var pk = peak(p);
    if (pk[0] > p.cap) o.push(['risk', p.name + ' peaks at ' + pk[0] + '% in ' + ml(pk[1]) +
      ' against a capacity of ' + p.cap + '%.'
    ]);
    if (p.type === 'int' && pk[0] === 0) o.push(['watch', p.name +
      ' is not allocated to any project.'
    ]);
    var m3 = 0;
    for (var i = 0; i < N; i++) {
      var c = S.alloc.filter(function(a) {
        var j = prj(a.j);
        return a.p === p.id && j && j.s <= i && i <= j.e
      }).length;
      if (c > m3) m3 = c
    }
    if (m3 >= 3) o.push(['watch', p.name + ' juggles ' + m3 +
      ' projects at the same time at peak.'
    ])
  });
  S.projects.forEach(function(p) {
    var al = S.alloc.filter(function(a) {
        return a.j === p.id
      }),
      f = al.reduce(function(s, a) {
        return s + num(a.pct)
      }, 0) / 100;
    if (!al.length) o.push(['risk', '"' + p.name + '" has nobody allocated.']);
    else if (f < p.need * .9) o.push([f < p.need * .6 ? 'risk' : 'watch', '"' + p.name +
      '" has ' + f.toFixed(1) + ' FTE allocated against ' + p.need + ' needed.'
    ]);
    var gaps = sp(p.areas).filter(function(a) {
      return !al.some(function(x) {
        var q = per(x.p);
        return q && covers(q, a)
      })
    });
    if (gaps.length) o.push(['watch', '"' + p.name + '" has no allocated person covering ' +
      gaps.join(', ') + '.'
    ]);
    if (al.length && !al.some(function(x) {
        var q = per(x.p);
        return q && q.lead
      })) o.push(['watch', '"' + p.name + '" has no lead allocated.']);
    al.forEach(function(a) {
      var q = per(a.p),
        mo = p.e - p.s + 1,
        e = num(a.pct) / 100 * mo;
      tot += e;
      if (q && q.type === 'ext') {
        ext += e;
        cost += e * num(q.cost)
      }
    })
  });
  if (ext) o.push(['watch', 'External team carries ' + Math.round(ext / tot * 100) +
    '% of allocated effort, an estimated ' + Math.round(cost).toLocaleString('en-US') +
    ' in cost over the horizon.'
  ]);
  var mc = 0;
  for (var i = 0; i < N; i++) {
    var c = S.projects.filter(function(p) {
      return p.s <= i && i <= p.e
    }).length;
    if (c > mc) mc = c
  }
  o.push(['ok', 'Up to ' + mc + ' projects run concurrently.']);
  if (!o.some(function(x) {
      return x[0] === 'risk'
    })) o.unshift(['ok', 'No critical allocation risks.']);
  return o
}

function sortMessages(messages) {
  var priority = {
    risk: 0,
    watch: 1,
    ok: 2
  };
  return messages.slice().sort(function(a, b) {
    var level = (priority[a[0]] === undefined ? 3 : priority[a[0]]) -
      (priority[b[0]] === undefined ? 3 : priority[b[0]]),
      textA = String(a[1]).replace(/^[^a-z0-9]+/i, ''),
      textB = String(b[1]).replace(/^[^a-z0-9]+/i, '');
    return level || textA.localeCompare(textB, undefined, {
      sensitivity: 'base'
    })
  })
}

function render() {
  var editable = canManage();
  $('identitySelect').innerHTML = teamAccess.users().map(function(user) {
    return '<option value="' + esc(user.id) + '">' + esc(user.name) + '</option>'
  }).join('');
  $('identitySelect').value = teamAccess.activeUser().id;
  $('roleBadge').textContent = teamAccess.role() || 'no access';
  document.querySelectorAll('[data-admin-only]').forEach(function(control) {
    control.disabled = !editable
  });
  $('zoomDock').style.display = S.view === 'board' ? 'flex' : 'none';
  $('zm').style.display = 'inline-flex';
  $('toggleProjectProperties').hidden = S.view !== 'board' || !S.selJ;
  $('toggleProjectProperties').textContent = S.propertiesOpen ? 'Hide properties' :
    'Show properties';
  $('toggleProjectProperties').setAttribute('aria-expanded', S.propertiesOpen ? 'true' : 'false');
  document.querySelectorAll('[data-z]').forEach(function(b) {
    b.className = +b.dataset.z === S.zoom ? 'on' : ''
  });
  document.querySelectorAll('[data-v]').forEach(function(b) {
    b.className = b.dataset.v === S.view ? 'on' : ''
  });
  rail();
  mid();
  edp();
  document.querySelectorAll('[data-f],[data-lead],[data-ap],[data-j],[data-dep],[data-dp],[data-da],[data-dj]').forEach(function(control) {
    if ('disabled' in control) control.disabled = !editable
  });
  var findings = sortMessages(insights());
  $('ins').innerHTML = findings.map(function(x) {
    return '<li class="i ' + x[0] + '">' + esc(x[1]) + '</li>'
  }).join('');
  $('insightCounts').innerHTML = [
    ['risk', 'Critical'],
    ['watch', 'Watch'],
    ['ok', 'Info']
  ].map(function(x) {
    return '<span class="insight-count ' + x[0] + '">' + x[1] + ' ' + findings.filter(function(
      f) {
      return f[0] === x[0]
    }).length + '</span>'
  }).join('');
  lines();
  save()
}

function receiveHCResources() {
  var params = new URLSearchParams(window.location.search),
    raw = params.get('hcResources');
  if (!raw) return null;

  function clearQuery() {
    try {
      params.delete('hcResources');
      var url = window.location.pathname + (params.toString() ? '?' + params.toString() : '') +
        window.location.hash;
      history.replaceState(null, '', url)
    } catch (e) {}
  }
  try {
    var payload = JSON.parse(raw);
    if (payload.version !== 1 || !Array.isArray(payload.people)) throw new Error(
      'Invalid HC handoff');
    var added = 0,
      updated = 0;
    payload.people.forEach(function(r) {
      if (!r || !r.sourceRef || !r.name) return;
      var existing = S.people.filter(function(p) {
        return p.sourceRef === r.sourceRef
      })[0];
      if (!existing) {
        var name = String(r.name).trim().toLocaleLowerCase(),
          role = String(r.role || '').trim().toLocaleLowerCase();
        existing = S.people.filter(function(p) {
          return p.name.trim().toLocaleLowerCase() === name && p.role.trim()
            .toLocaleLowerCase() === role
        })[0]
      }
      var person = existing || {
        id: rid(),
        name: '',
        role: '',
        areas: '',
        type: 'int',
        sen: 'Senior',
        lead: false,
        cap: 100,
        cost: 0,
        notes: ''
      };
      person.sourceRef = String(r.sourceRef);
      person.name = String(r.name).slice(0, 160);
      person.role = String(r.role || '').slice(0, 200);
      person.areas = String(r.areas || '').slice(0, 500);
      person.type = r.type === 'ext' ? 'ext' : 'int';
      person.sen = ['Junior', 'Mid', 'Senior'].indexOf(r.sen) >= 0 ? r.sen : 'Senior';
      person.cap = isFinite(Number(r.cap)) ? Math.max(0, Number(r.cap)) : 100;
      if (person.type === 'ext') person.fte = person.cap / 100;
      else delete person.fte;
      if (person.type === 'ext') person.cost = isFinite(Number(r.cost)) ? Math.max(0, Number(r
        .cost)) : 9000;
      if (!person.notes && r.notes) person.notes = String(r.notes).slice(0, 600);
      if (existing) updated++;
      else {
        S.people.push(person);
        added++
      }
    });
    clearQuery();
    return {
      added: added,
      updated: updated,
      sourcePhase: String(payload.sourcePhase || '')
    }
  } catch (e) {
    clearQuery();
    return {
      error: true
    }
  }
}
var themeToggle = $('themeToggle'),
  themeKey = 'alloc-board-theme';

function setTheme(theme, persist) {
  var dark = theme === 'dark';
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
  themeToggle.checked = dark;
  if (persist) {
    try {
      localStorage.setItem(themeKey, dark ? 'dark' : 'light')
    } catch (e) {}
  }
}
var savedTheme = 'light';
try {
  savedTheme = localStorage.getItem(themeKey) || 'light'
} catch (e) {}
setTheme(savedTheme, false);
themeToggle.addEventListener('change', function() {
  setTheme(themeToggle.checked ? 'dark' : 'light', true)
});
var drag = null,
  mv = null;
document.addEventListener('dragstart', function(e) {
  if (!canManage()) return;
  var c = e.target.closest && e.target.closest('[data-a],[data-p]');
  if (!c || e.target.tagName === 'INPUT') return;
  drag = c.dataset.a ? {
    t: 'a',
    id: c.dataset.a
  } : {
    t: 'p',
    id: c.dataset.p
  };
  e.dataTransfer.setData('text/plain', JSON.stringify(drag));
  e.dataTransfer.effectAllowed = 'move'
});
document.addEventListener('dragover', function(e) {
  var n = e.target.closest && e.target.closest('.nd,#rail');
  if (n) {
    e.preventDefault();
    if (n.classList.contains('nd')) n.classList.add('over')
  }
});
document.addEventListener('dragleave', function(e) {
  var n = e.target.closest && e.target.closest('.nd');
  if (n) n.classList.remove('over')
});
document.addEventListener('drop', function(e) {
  if (!canManage()) return;
  if (!drag) return;
  var n = e.target.closest('.nd'),
    r = e.target.closest('#rail');
  if (!n && !r) return;
  e.preventDefault();
  if (n) {
    var j = n.dataset.n;
    if (drag.t === 'p') {
      if (S.alloc.some(function(a) {
          return a.p === drag.id && a.j === j
        })) say('Already on that project.');
      else S.alloc.push({
        id: rid(),
        p: drag.id,
        j: j,
        pct: 50
      })
    } else {
      var a = S.alloc.filter(function(x) {
        return x.id === drag.id
      })[0];
      if (a && S.alloc.some(function(x) {
          return x.p === a.p && x.j === j && x !== a
        })) say('Already on that project.');
      else if (a) a.j = j
    }
  } else if (drag.t === 'a') S.alloc = S.alloc.filter(function(x) {
    return x.id !== drag.id
  });
  drag = null;
  render()
});
document.addEventListener('pointerdown', function(e) {
  if (!canManage()) return;
  var h = e.target.closest && e.target.closest('.nh');
  if (!h) return;
  var n = h.parentNode,
    p = prj(n.dataset.n);
  mv = {
    n: n,
    p: p,
    x: e.clientX,
    y: e.clientY,
    l: p.x,
    t: p.y,
    m: false
  }
});
document.addEventListener('pointermove', function(e) {
  if (!canManage() || !mv) return;
  var dx = e.clientX - mv.x,
    dy = e.clientY - mv.y;
  if (Math.abs(dx) + Math.abs(dy) > 4) mv.m = true;
  if (!mv.m) return;
  var zz = S.zoom / 100;
  mv.p.x = Math.max(0, mv.l + dx / zz);
  mv.p.y = Math.max(0, mv.t + dy / zz);
  mv.n.style.left = mv.p.x + 'px';
  mv.n.style.top = mv.p.y + 'px';
  lines()
});
document.addEventListener('pointerup', function() {
  if (mv && mv.m) {
    save();
    mid();
    lines()
  }
  mv = null
});
document.addEventListener('click', function(e) {
  var t = e.target,
    d = t.dataset;
  if (!canManage() && (d.da || d.dp || d.dj)) return;
  if (t.id === 'toggleProjectProperties') {
    S.propertiesOpen = !S.propertiesOpen;
    render();
    return
  }
  if (d.v) {
    S.view = d.v;
    render();
    return
  }
  if (d.z) {
    S.zoom = +d.z;
    render();
    return
  }
  if (d.tg) {
    S.open[d.tg] = !S.open[d.tg];
    render();
    return
  }
  if (d.da) {
    S.alloc = S.alloc.filter(function(a) {
      return a.id !== d.da
    });
    render();
    return
  }
  if (d.dp) {
    var person = per(d.dp);
    if (!person || !confirm('Delete ' + person.name +
        ' and remove all of their project allocations?')) return;
    S.people = S.people.filter(function(p) {
      return p.id !== d.dp
    });
    S.alloc = S.alloc.filter(function(a) {
      return a.p !== d.dp
    });
    if (S.selP === d.dp) S.selP = null;
    render();
    return
  }
  if (d.dj) {
    S.projects = S.projects.filter(function(p) {
      return p.id !== d.dj
    });
    S.projects.forEach(function(p) {
      p.dep = p.dep.filter(function(x) {
        return x !== d.dj
      })
    });
    S.alloc = S.alloc.filter(function(a) {
      return a.j !== d.dj
    });
    S.selJ = null;
    render();
    return
  }
  if (d.cj) {
    S.selJ = null;
    render();
    return
  }
  if (d.sj) {
    S.selJ = d.sj;
    render();
    return
  }
  if (d.sp) {
    S.selP = S.selP === d.sp ? null : d.sp;
    render();
    return
  }
  if (t.tagName === 'INPUT' || t.tagName === 'SELECT' || t.tagName === 'TEXTAREA' || t
    .tagName === 'BUTTON') return;
  var n = t.closest('.nd');
  if (n) {
    S.selJ = n.dataset.n;
    render();
    return
  }
  var r = t.closest('.pr');
  if (r) {
    S.selP = S.selP === r.dataset.p ? null : r.dataset.p;
    render()
  }
});
document.addEventListener('change', function(e) {
  if (!canManage()) return;
  var t = e.target,
    d = t.dataset;
  if (d.f) {
    var p = per(d.i);
    if (d.f === 'fte') {
      p.fte = Math.max(0, num(t.value));
      p.cap = p.fte * 100
    } else p[d.f] = (d.f === 'cap' || d.f === 'cost') ? num(t.value) : t.value;
    render();
    return
  }
  if (d.lead) {
    per(d.lead).lead = t.checked;
    render();
    return
  }
  if (d.ap) {
    var a = S.alloc.filter(function(x) {
      return x.id === d.ap
    })[0];
    a.pct = Math.max(0, num(t.value));
    render();
    return
  }
  if (d.j) {
    var q = prj(S.selJ),
      k = d.j;
    q[k] = (k === 's' || k === 'e' || k === 'need') ? num(t.value) : t.value;
    if (k === 'status') normalizeStatus(q);
    if (q.e < q.s) {
      if (k === 's') q.e = q.s;
      else q.s = q.e
    }
    render();
    return
  }
  if (d.dep) {
    var q2 = prj(S.selJ),
      i = q2.dep.indexOf(d.dep);
    if (t.checked && i < 0) q2.dep.push(d.dep);
    if (!t.checked && i >= 0) q2.dep.splice(i, 1);
    render()
  }
});
$('ap').onclick = function() {
  if (!canManage()) return;
  var y = Math.max.apply(null, S.projects.map(function(p) {
      return p.y
    }).concat([-258])) + 258,
    p = {
      id: rid(),
      name: 'New project',
      size: 'M',
      s: 0,
      e: 5,
      need: 1,
      areas: '',
      dep: [],
      notes: '',
      x: 12,
      y: y,
      status: 'Planned'
    };
  S.projects.push(p);
  S.selJ = p.id;
  render()
};

function addp(t) {
  var p = mk(rid(), t === 'ext' ? 'New external' : 'New person', t === 'ext' ? 'Temp augmentation' :
    '', '', 0, 'Mid', 'Medium', 100, t);
  S.people.push(p);
  S.open[p.id] = true;
  render()
}
$('aint').onclick = function() {
  if (!canManage()) return;
  addp('int')
};
$('aext').onclick = function() {
  if (!canManage()) return;
  addp('ext')
};
$('cj').onclick = function() {
  try {
    navigator.clipboard.writeText(JSON.stringify(S, null, 1)).then(function() {
      say('JSON copied.')
    }, function() {
      say('Clipboard blocked here.')
    })
  } catch (e) {
    say('Clipboard blocked here.')
  }
};
$('lj').onclick = function() {
  if (!canManage()) return;
  $('jsonFile').click()
};
$('jsonFile').addEventListener('change', function(e) {
  if (!canManage()) return;
  var file = e.target.files && e.target.files[0];
  if (!file) return;
  var current = S,
    reader = new FileReader();
  reader.onload = function() {
    var replaced = false;
    try {
      var imported = JSON.parse(String(reader.result || ''));
      if (!validBoard(imported)) throw new Error(
        'This file is not a valid Project Engagement Board JSON export.');
      if (!confirm('Load this JSON and replace the current board?')) {
        say('JSON load cancelled.');
        return
      }
      imported.selP = null;
      imported.selJ = null;
      imported.open = imported.open && typeof imported.open === 'object' ? imported.open : {};
      imported.view = imported.view === 'tl' ? 'tl' : 'board';
      if (typeof imported.propertiesOpen !== 'boolean') imported.propertiesOpen = true;
      if (!isFinite(Number(imported.zoom)) || Number(imported.zoom) <= 0) imported.zoom = 100;
      imported.people.forEach(function(p) {
        if (p.type === 'ext') {
          var fte = p.fte == null ? NaN : Number(p.fte);
          if (!isFinite(fte) || fte < 0) fte = p.cap == null ? 1 : Math.max(0, num(p
            .cap) / 100);
          p.fte = fte;
          p.cap = fte * 100
        }
      });
      S = imported;
      replaced = true;
      render();
      say('Loaded board from ' + file.name + '.')
    } catch (err) {
      if (replaced) {
        S = current;
        render()
      }
      say('Could not load JSON: ' + err.message)
    } finally {
      e.target.value = ''
    }
  };
  reader.onerror = function() {
    say('Could not read the selected JSON file.');
    e.target.value = ''
  };
  reader.readAsText(file)
});
$('rs').onclick = function(e) {
  if (!canManage()) return;
  var b = e.target;
  if (!armed) {
    armed = true;
    b.textContent = 'Click again to reset';
    setTimeout(function() {
      armed = false;
      b.textContent = 'Reset'
    }, 3000);
    return
  }
  armed = false;
  b.textContent = 'Reset';
  S = init();
  render()
};
window.addEventListener('resize', lines);
document.addEventListener('scroll', lines, true);
 $('identitySelect').addEventListener('change', function() {
  if (!teamAccess.setUser(this.value)) return;
  S = load();
  render();
  say(canManage() ? 'Admin access enabled for this demo identity.' : 'Read-only member access enabled.');
});
var PROJECT_FRESH_SETUP_KEY = 'org-planner-setup-project-v1';
stateModel = OrgPlanner.Models.createStateStore(teamAccess.boardKey(BOARD_ID));
var hasSavedBoard = !!stateModel.read() || !!OrgPlanner.Models.createStateStore(KEY).read(),
  hasFreshChoice = false;
try {
  hasFreshChoice = localStorage.getItem(PROJECT_FRESH_SETUP_KEY) === 'fresh'
} catch (e) {}
if (!hasSavedBoard && !hasFreshChoice) {
  window.location.replace('index.html?setup=project')
} else {
  S = load();
  if (!stateModel.read() && hasFreshChoice) save();
  var hcImport = canManage() ? receiveHCResources() : null;
  render();
  if (hcImport) {
    if (hcImport.error) say('The HC resource handoff could not be read.');
    else say('HC resources from ' + (hcImport.sourcePhase || 'the selected phase') + ': ' + hcImport
      .added + ' added, ' + hcImport.updated +
      ' matched. Drag them from the left onto projects to allocate.')
  }
}
