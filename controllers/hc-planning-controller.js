var TYPES = {
  internal: 'Internal',
  planned: 'Planned',
  external: 'External'
};
var DEFAULT_TITLE = 'Organizational Planning';
var PH = ['Phase 1 · Q4 2026 to Q2 2027', 'Phase 2 · Q3 2027 to Q1 2028',
  'Phase 3 · Q2 2028 onward'];
var NOTES = ['Foundation and batch 1 (3 hires). Externals down about 20%.',
  'Pods formed, batch 2 (4 hires). Externals down about 55%.',
  'Batch 3 (3 hires), 10 FTEs total. Externals only for peaks and niche skills.'
];
var TOP = ['lead', 'gov'];
var TEAM_COLORS = ['#006b4f', '#00856a', '#2fa878', '#648c3b', '#2d7771', '#8aa83d', '#3d694c',
  '#77a789'
];
var PERSON_COLORS = ['#567a68', '#4f7978', '#5b7590', '#77718a', '#916f72', '#9a7658', '#74824e',
  '#707c82'
];
var OLD_TEAM_COLORS = ['#2f7f86', '#b26732', '#7563a8', '#45805a', '#b34f64', '#5275a8', '#947327',
  '#43829a'
];
var TEN = [
  ['NT', 'Head of ABAP dev', '', 1, 'lead'],
  ['LR', 'Clean core and quality gate', 'QM,FIN,SD', 0, 'gov'],
  ['BB', 'Design authority', 'EWM,LE,TMS,FIN', 0, 'gov'],
  ['KA', 'Domain owner', 'FIN,SD,Auth', 0, 'fin'],
  ['AP', 'Domain owner', 'QM,SD,PM', 0, 'sd'],
  ['MF', 'Domain owner', 'HR,SD,EHS,PM', 0, 'pm'],
  ['AA', 'Domain owner', 'EWM,FIN,Cross-app', 0, 'log'],
  ['NN', 'Platform owner (to confirm)', '', 0, 'plat']
];
var HIR = [
  [1, 'FIN senior', 'FIN', 'fin'],
  [2, 'FIN / Auth', 'FIN,Auth', 'fin'],
  [2, 'SD', 'SD', 'sd'],
  [2, 'QM', 'QM', 'sd'],
  [1, 'PM / EHS', 'PM,EHS', 'pm'],
  [3, 'HR', 'HR', 'pm'],
  [1, 'LE / TMS', 'LE,TMS', 'log'],
  [2, 'EWM', 'EWM', 'log'],
  [3, 'TMS', 'TMS', 'log'],
  [3, 'Cross-app, tooling', 'Cross-app', 'plat']
];
var KEY = 'abap-org-planner-v2',
  FRESH_SETUP_KEY = 'org-planner-setup-hc-v1',
  S, dragId = null,
  cpArmed = false,
  summaryView = false,
  expandedExternalTeams = {},
  viewFilters = {
    attr: '',
    value: '',
    area: '',
    team: ''
  };
var view = OrgPlanner.Views.createDomView(document),
  stateModel = OrgPlanner.Models.createStateStore(KEY);

function rid() {
  return 'p' + Math.random().toString(36).slice(2, 9)
}

function variantKeyPrefix(name) {
  var base = String(name || 'VAR').toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'VAR';
  return base.slice(0, 18)
}

function generateVariantKey(name) {
  return variantKeyPrefix(name) + '-' + Date.now().toString(36).toUpperCase() + '-' + Math.random().toString(36).slice(2, 8).toUpperCase();
}

function addVariantMetadata(data, name) {
  var payload = {};
  var key = data && data.variantKey ? data.variantKey : generateVariantKey(name || 'HC-PLANNING');
  payload.variantKey = key;
  payload.savedAt = new Date().toISOString();
  payload.boardId = name || 'HC-PLANNING';
  Object.keys(data || {}).forEach(function(k) {
    if (k !== 'variantKey' && k !== 'savedAt' && k !== 'boardId') payload[k] = data[k]
  });
  return payload
}

function promptForVariantKey(imported) {
  if (!imported || typeof imported !== 'object') throw new Error('This file is not a valid HC Planning Board JSON export.');
  if (typeof imported.variantKey !== 'string' || !imported.variantKey.trim()) throw new Error('This JSON file is missing a variant key. Save a new JSON variant from the board before loading it.');
  var value = window.prompt('Enter the variant key for this JSON file to load it:', '');
  if (value === null) throw new Error('JSON load cancelled.');
  if (String(value).trim() !== imported.variantKey.trim()) throw new Error('The entered variant key does not match this JSON file.');
  return imported
}

function downloadVariantFile(data, name, successMessage) {
  var payload = addVariantMetadata(data, name || 'HC-PLANNING');
  var fileName = 'variants/' + payload.variantKey + '.json';
  var blob = new Blob([JSON.stringify(payload, null, 1)], {
    type: 'application/json'
  });
  var url = window.URL.createObjectURL(blob);
  var link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.setTimeout(function() {
    window.URL.revokeObjectURL(url)
  }, 1000);
  say(successMessage || ('Saved JSON variant ' + payload.variantKey + '.'));
  return payload.variantKey
}

function colorize(zones) {
  zones.forEach(function(z, i) {
    var old = OLD_TEAM_COLORS.indexOf(z.color);
    if (!z.color) z.color = TEAM_COLORS[i % TEAM_COLORS.length];
    else if (old >= 0) z.color = TEAM_COLORS[old]
  });
  return zones
}

function safeColor(c) {
  return /^#[0-9a-f]{6}$/i.test(c || '') ? c : '#2f7f86'
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

function sp(s) {
  return s ? s.split(',').map(function(x) {
    return x.trim()
  }).filter(Boolean) : []
}

function seed(n) {
  var a = [];
  TEN.forEach(function(x, i) {
    a.push({
      id: rid(),
      k: 't' + i,
      name: x[0],
      role: x[1],
      areas: sp(x[2]),
      all: !!x[3],
      zone: x[4],
      type: 'internal',
      internalKind: 'baseline'
    })
  });
  HIR.forEach(function(h, i) {
    var on = h[0] <= n;
    a.push({
      id: rid(),
      k: 'h' + i,
      name: on ? 'New hire' : 'Open role',
      role: h[1] + ' dev',
      areas: sp(h[2]),
      all: false,
      zone: h[3],
      type: on ? 'internal' : 'planned',
      internalKind: on ? 'hire' : ''
    })
  });
  return a
}

function sampleVariant() {
  var pv = {};
  TEN.forEach(function(x, i) {
    pv['t' + i] = {
      Seniority: 'Senior'
    }
  });
  pv.h0 = {
    Seniority: 'Senior'
  };
  return {
    title: DEFAULT_TITLE,
    variant: 'Sample variant',
    sampleLoaded: true,
    financials: true,
    cur: 0,
    sel: null,
    areas: ['FIN', 'SD', 'QM', 'PM', 'EWM', 'LE', 'TMS', 'HR', 'EHS', 'Auth', 'Cross-app'],
    attrs: [{
      n: 'Seniority',
      t: 'choice',
      o: 'Junior,Mid,Senior'
    }, {
      n: 'Capacity %',
      t: 'number',
      o: ''
    }, {
      n: 'Management',
      t: 'checkbox',
      o: ''
    }, {
      n: 'Tech Lead',
      t: 'checkbox',
      o: ''
    }, {
      n: 'Strategy Person',
      t: 'strategy-person',
      o: ''
    }, {
      n: 'Annual cost',
      t: 'number',
      o: ''
    }, {
      n: 'Notes',
      t: 'text',
      o: ''
    }],
    pv: pv,
    cfg: {
      cur: 'USD',
      cap: 10,
      base: 10,
      ext: 120000,
      int: 80000,
      hire: 15000,
      ph: [{
        m: 9,
        t: 3,
        e: 8
      }, {
        m: 9,
        t: 7,
        e: 4.5
      }, {
        m: 12,
        t: 10,
        e: 1.5
      }]
    },
    fx: [{
      n: 'Internal functional upskilling',
      k: 'pct',
      v: 5,
      f: 2,
      note: 'Faster delivery from deeper functional knowledge'
    }],
    zones: colorize([{
      id: 'lead',
      t: 'Head of ABAP development'
    }, {
      id: 'gov',
      t: 'Governance and design authority'
    }, {
      id: 'fin',
      t: 'FIN and Auth'
    }, {
      id: 'sd',
      t: 'SD and QM'
    }, {
      id: 'pm',
      t: 'PM, EHS, HR'
    }, {
      id: 'log',
      t: 'Logistics (EWM, LE, TMS)'
    }, {
      id: 'plat',
      t: 'Platform and cross-app'
    }, {
      id: 'ext',
      t: 'Externals (phasing out)'
    }]),
    phases: [1, 2, 3].map(function(n, i) {
      return {
        title: PH[i],
        note: NOTES[i],
        people: seed(n)
      }
    })
  }
}

function init() {
  var areas = ['Func Area 1', 'Func Area 2', 'Func Area 3'];
  return {
    title: DEFAULT_TITLE,
    variant: 'New variant',
    sampleLoaded: false,
    financials: true,
    cur: 0,
    sel: null,
    areas: areas.slice(),
    attrs: [{
      n: 'Seniority',
      t: 'choice',
      o: 'Junior,Mid,Senior'
    }, {
      n: 'Capacity %',
      t: 'number',
      o: ''
    }, {
      n: 'Management',
      t: 'checkbox',
      o: ''
    }, {
      n: 'Tech Lead',
      t: 'checkbox',
      o: ''
    }, {
      n: 'Strategy Person',
      t: 'strategy-person',
      o: ''
    }, {
      n: 'Annual cost',
      t: 'number',
      o: ''
    }, {
      n: 'Notes',
      t: 'text',
      o: ''
    }],
    pv: {},
    cfg: {
      cur: 'EUR',
      cap: 0,
      base: 0,
      ext: 0,
      int: 0,
      hire: 0,
      ph: [1, 2, 3].map(function() {
        return {
          m: 12,
          t: 0,
          e: 0
        }
      })
    },
    fx: [],
    zones: colorize([{
      id: 'lead',
      t: 'Leadership'
    }, {
      id: 'gov',
      t: 'Governance'
    }, {
      id: 'func1',
      t: areas[0]
    }, {
      id: 'func2',
      t: areas[1]
    }, {
      id: 'func3',
      t: areas[2]
    }, {
      id: 'ext',
      t: 'External Pool'
    }, {
      id: 'vendor-a',
      t: 'Vendor A',
      tier: 'external'
    }, {
      id: 'vendor-b',
      t: 'Vendor B',
      tier: 'external'
    }]),
    phases: [1, 2, 3].map(function(n) {
      var people = areas.map(function(area, i) {
        var dev = i + 1;
        return {
          id: rid(),
          k: 'dev' + dev,
          name: 'Dev' + dev,
          role: 'ABAP developer',
          areas: [area],
          all: false,
          zone: 'func' + dev,
          type: 'internal',
          internalKind: 'baseline'
        }
      });
      return {
        title: 'Phase ' + n,
        note: '',
        people: people.concat([{
          id: rid(),
          k: 'vendor-a-1',
          name: 'Vendor A - External 1',
          role: 'External team member',
          areas: [],
          all: false,
          zone: 'vendor-a',
          type: 'external'
        }, {
          id: rid(),
          k: 'vendor-a-2',
          name: 'Vendor A - External 2',
          role: 'External team member',
          areas: [],
          all: false,
          zone: 'vendor-a',
          type: 'external'
        }, {
          id: rid(),
          k: 'vendor-b-1',
          name: 'Vendor B - External 1',
          role: 'External team member',
          areas: [],
          all: false,
          zone: 'vendor-b',
          type: 'external'
        }, {
          id: rid(),
          k: 'vendor-b-2',
          name: 'Vendor B - External 2',
          role: 'External team member',
          areas: [],
          all: false,
          zone: 'vendor-b',
          type: 'external'
        }])
      }
    })
  }
}

function template() {
  return init()
}

function starterSignature(s) {
  return JSON.stringify({
    title: s.title,
    variant: s.variant,
    financials: s.financials,
    areas: s.areas,
    attrs: s.attrs.map(function(a) {
      return {
        n: a.n,
        t: a.t,
        o: a.o
      }
    }),
    pv: s.pv,
    cfg: {
      cur: s.cfg.cur,
      cap: s.cfg.cap,
      base: s.cfg.base,
      ext: s.cfg.ext,
      int: s.cfg.int,
      hire: s.cfg.hire,
      ph: s.cfg.ph.map(function(p) {
        return {
          m: p.m,
          t: p.t,
          e: p.e
        }
      })
    },
    fx: s.fx.map(function(f) {
      return {
        n: f.n,
        k: f.k,
        v: f.v,
        f: f.f,
        note: f.note
      }
    }),
    zones: s.zones.map(function(z) {
      return {
        id: z.id,
        t: z.t,
        color: z.color
      }
    }),
    phases: s.phases.map(function(ph) {
      return {
        title: ph.title,
        note: ph.note,
        people: ph.people.map(function(p) {
          return {
            k: p.k,
            name: p.name,
            role: p.role,
            areas: p.areas,
            all: p.all,
            zone: p.zone,
            type: p.type,
            teamRole: p.teamRole,
            useSpecificCost: p.useSpecificCost,
            externalCost: p.externalCost
          }
        })
      }
    })
  })
}

function load() {
  var o = stateModel.read();
  if (o && o.phases && o.areas && o.attrs) {
    o.sel = null;
    var d = init();
    if (typeof o.financials !== 'boolean') o.financials = true;
    if (!o.title) o.title = d.title;
    if (!o.variant) o.variant = 'Sample variant';
    o.phases.forEach(function(p, i) {
      if (!p.title) p.title = PH[i] || ('Phase ' + (i + 1))
      p.people.forEach(function(person) {
        if (person.type === 'tenured' || person.type === 'hire') {
          person.internalKind = person.type === 'tenured' ? 'baseline' : 'hire';
          person.type = 'internal'
        } else if (person.type === 'internal' && !person.internalKind) {
          person.internalKind = 'hire'
        }
      })
    });
    if (!o.cfg) o.cfg = d.cfg;
    if (!Array.isArray(o.cfg.ph)) o.cfg.ph = d.cfg.ph;
    while (o.cfg.ph.length < o.phases.length) o.cfg.ph.push(JSON.parse(JSON.stringify(o.cfg.ph[o.cfg
      .ph.length - 1] || {
      m: 12,
      t: 0,
      e: 0
    })));
    if (!o.fx) o.fx = d.fx;
    if (!o.zones) o.zones = d.zones;
    colorize(o.zones);
    o.zones.forEach(function(z) {
      if (z.id === 'ext' && z.t === 'Notes') z.t = 'External Pool'
    });
    var managementAttr = null,
      techLeadAttr = null,
      strategyPersonAttr = null;
    o.attrs = o.attrs.filter(function(a) {
      if (a.n === 'Management') {
        managementAttr = a;
        return false
      }
      if (a.n === 'Tech Lead') {
        techLeadAttr = a;
        return false
      }
      if (a.n === 'Strategy Person') {
        strategyPersonAttr = a;
        return false
      }
      return a.n !== 'Clean core skill'
    });
    managementAttr = managementAttr || {
      n: 'Management',
      t: 'checkbox',
      o: ''
    };
    techLeadAttr = techLeadAttr || {
      n: 'Tech Lead',
      t: 'checkbox',
      o: ''
    };
    strategyPersonAttr = strategyPersonAttr || {
      n: 'Strategy Person',
      t: 'strategy-person',
      o: ''
    };
    managementAttr.t = 'checkbox';
    techLeadAttr.t = 'checkbox';
    strategyPersonAttr.t = 'strategy-person';
    var attrAt = o.attrs.length;
    for (var ai = 0; ai < o.attrs.length; ai++)
      if (o.attrs[ai].n === 'Flight risk') {
        attrAt = ai;
        break
      } if (attrAt === o.attrs.length)
      for (var ci = 0; ci < o.attrs.length; ci++)
        if (o.attrs[ci].n === 'Capacity %') {
          attrAt = ci + 1;
          break
        } o.attrs.splice(attrAt, 0, managementAttr, techLeadAttr, strategyPersonAttr);
    Object.keys(o.pv || {}).forEach(function(k) {
      var v = o.pv[k];
      if (!v || typeof v !== 'object') return;
      delete v['Clean core skill'];
      if (v.Management === undefined) v.Management = false;
      if (v['Tech Lead'] === undefined) v['Tech Lead'] = false
    });
    if (!o.attrs.some(function(a) {
        return a.n === 'Annual cost'
      })) o.attrs.splice(o.attrs.length - 1, 0, d.attrs[5]);
    if (!o.sampleLoaded && o.variant === 'Sample variant' && starterSignature(o) ===
      starterSignature(sampleVariant())) return d;
    return o
  }
  try {
    if (localStorage.getItem(FRESH_SETUP_KEY) === 'fresh') return sampleVariant()
  } catch (e) {}
  return init()
}

function save() {
  stateModel.write(S)
}

function say(m) {
  view.text('msg', m)
}

function P() {
  return S.phases[S.cur]
}

function hasSpecificExternalCost(p) {
  return !!p.useSpecificCost && p.externalCost !== '' && p.externalCost != null &&
    isFinite(Number(p.externalCost))
}

function externalAnnualCost(p) {
  if (hasSpecificExternalCost(p)) return Math.max(0, Number(p.externalCost));
  var capacity = gv(p, 'Capacity %'),
    fte = capacity == null || capacity === '' || !isFinite(Number(capacity)) ? 1 : Math.max(0,
      Number(capacity)) / 100;
  return fte * num(S.cfg.ext)
}

function deliveryHandoff() {
  var zones = S.zones.filter(isDeliveryTeam),
    byId = {};
  zones.forEach(function(z) {
    byId[z.id] = z
  });
  return P().people.filter(function(p) {
    return byId[p.zone] && (p.teamRole !== 'secondary' || p.externalAssignment)
  }).map(function(p) {
    var z = byId[p.zone],
      v = S.pv[p.k] || {},
      capacity = Number(v['Capacity %']),
      status = TYPES[p.type] || p.type,
      notes = 'HC Delivery · ' + z.t + ' · ' + status;
    if (v.Notes) notes += ' · ' + String(v.Notes).slice(0, 500);
    if (S.financials && p.type === 'external') notes += ' · cost currency: ' + S.cfg.cur;
    return {
      sourceRef: p.k + '@' + z.id,
      name: p.name,
      role: p.role || '',
      areas: p.all ? 'All' : p.areas.join(', '),
      type: p.type === 'external' ? 'ext' : 'int',
      status: status,
      sen: v.Seniority || 'Senior',
      cap: p.type === 'planned' ? 0 : (v['Capacity %'] === '' || v['Capacity %'] == null || !
        isFinite(capacity) ? 100 : Math.max(0, capacity)),
      cost: S.financials && p.type === 'external' ? (hasSpecificExternalCost(p) ?
        externalAnnualCost(p) : num(S.cfg.ext)) / 12 : 0,
      costCurrency: S.financials ? S.cfg.cur : '',
      notes: notes,
      team: z.t
    }
  })
}

function find(id) {
  return P().people.filter(function(p) {
    return p.id === id
  })[0]
}

function gv(p, n) {
  return (S.pv[p.k] || {})[n]
}

function isInternalPerson(p) {
  return p.type === 'internal'
}

function isHire(p) {
  return p.type === 'internal' && p.internalKind === 'hire'
}

function isSecondaryPlacement(p) {
  return p.teamRole === 'secondary'
}

function hasPrimaryInOtherTeam(p, name) {
  var key = String(name || '').trim().toLocaleLowerCase();
  if (!key || ['new person', 'new hire', 'open role'].indexOf(key) >= 0) return false;
  return P().people.some(function(x) {
    return x.id !== p.id && x.zone !== p.zone && isInternalPerson(x) && x.teamRole !==
      'secondary' && String(x.name || '').trim().toLocaleLowerCase() === key
  })
}

function internal() {
  return P().people.filter(function(p) {
    return isInternalPerson(p) && p.teamRole !== 'secondary'
  })
}

function card(p, prev) {
  var personColor = cardColorFor(p),
    linkedClass = personColor ? ' linked-strategy' : '',
    linkedStyle = personColor ? ' style="--person-color:' + safeColor(personColor) + '"' : '';
  if (isSecondaryPlacement(p)) return '<div class="c ' + p.type + ' secondary' + linkedClass +
    (S.sel === p.id ? ' on' : '') + '"' + linkedStyle + ' draggable="true" tabindex="0" data-id="' +
    p.id + '"><div class="nm">' +
    esc(p.name) + (p.role ? '<span class="secondary-label">- ' + esc(p.role) + '</span>' : '') +
    '</div>' + personColorSwatches(p) + '</div>';
  var b = '',
    techLead = gv(p, 'Tech Lead') === true ?
    '<span class="tech-lead" role="img" aria-label="Tech lead" title="Tech lead">&#9733;</span>' :
    '';
  if (prev) {
    var o = prev.filter(function(x) {
      return x.k === p.k
    })[0];
    if (!o) b = '<i class="tg">joins</i>';
    else if (o.zone !== p.zone) b = '<i class="tg">moved</i>';
    else if (o.type !== p.type) b = '<i class="tg">' + TYPES[o.type] + ' to ' + TYPES[p.type] +
      '</i>'
  }
  return '<div class="c ' + p.type + linkedClass + (S.sel === p.id ? ' on' : '') +
    '"' + linkedStyle + ' draggable="true" tabindex="0" data-id="' + p.id + '"><div class="nm">' + techLead + esc(p
      .name) + b + '</div><div class="rl">' + esc(p.role) + ' · ' + TYPES[p.type] +
    '</div><div class="ar">' + (p.all ? 'All areas' : esc(p.areas.join(', ')) || 'No areas set') +
    '</div>' + personColorSwatches(p) + '</div>'
}

function isLeadership(z) {
  return TOP.indexOf(z.id) >= 0 || z.tier === 'leadership'
}

function isExternalTeam(z) {
  return z.id === 'ext' || z.tier === 'external'
}

function isDeliveryTeam(z) {
  return !!z && !isLeadership(z) && !isExternalTeam(z)
}

function zoneById(id) {
  return S.zones.filter(function(zone) {
    return zone.id === id
  })[0]
}

function strategyPeople() {
  return P().people.filter(function(person) {
    var team = zoneById(person.zone);
    return !!team && person.teamRole !== 'secondary' && isLeadership(team)
  }).map(function(person) {
    return {
      person: person,
      team: zoneById(person.zone)
    }
  })
}

function strategyColorFor(person) {
  var key = gv(person, 'Strategy Person');
  if (!key) return '';
  var linked = strategyPeople().filter(function(entry) {
    return entry.person.k === key
  })[0];
  return linked ? strategyPersonColor(linked.person) : ''
}

function strategyPersonColor(person) {
  var stored = (S.pv[person.k] || {}).cardColor;
  if (/^#[0-9a-f]{6}$/i.test(stored || '')) return stored;
  var key = String(person.k || ''),
    hash = 0;
  for (var i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  return PERSON_COLORS[hash % PERSON_COLORS.length]
}

function externalTeamColor(team) {
  var stored = team.color;
  if (/^#[0-9a-f]{6}$/i.test(stored || '')) return stored;
  var teams = S.zones.filter(isExternalTeam),
    index = teams.map(function(entry) {
      return entry.id
    }).indexOf(team.id);
  return PERSON_COLORS[(index < 0 ? 0 : index) % PERSON_COLORS.length]
}

function cardColorFor(person) {
  if (person.type === 'external' && person.externalAssignment) {
    var source = P().people.filter(function(candidate) {
      return candidate.type === 'external' && candidate.k === person.k && !candidate.externalAssignment
    })[0],
      sourceTeam = source && zoneById(source.zone);
    if (sourceTeam && isExternalTeam(sourceTeam)) return externalTeamColor(sourceTeam)
  }
  var team = zoneById(person.zone);
  if (person.type === 'external' && team && isExternalTeam(team)) return externalTeamColor(team);
  if (strategyPeople().some(function(entry) {
      return entry.person.id === person.id
    })) return strategyPersonColor(person);
  return strategyColorFor(person)
}

function personColorSwatches(person) {
  if (!strategyPeople().some(function(entry) {
      return entry.person.id === person.id
    })) return '';
  var color = strategyPersonColor(person);
  return '<input type="color" class="color-picker person-color-picker" data-person-color="' + person.id +
    '" value="' + safeColor(color) + '" aria-label="Card color for ' + esc(person.name) + '">'
}

function externalTeamPicker(team) {
  if (!isExternalTeam(team)) return '';
  var color = externalTeamColor(team);
  return '<input type="color" class="color-picker" data-external-color="' + team.id +
    '" value="' + safeColor(color) + '" aria-label="Card color for ' + esc(team.t) + '">'
}

function zone(z, prev) {
  var ppl = P().people.filter(function(p) {
    return p.zone === z.id && matchesFilters(p)
  });
  var typePriority = {
    internal: 0,
    planned: 1,
    external: 2
  };
  ppl.sort(function(a, b) {
    var leadPriority = (gv(b, 'Tech Lead') === true ? 1 : 0) -
        (gv(a, 'Tech Lead') === true ? 1 : 0),
      typeOrder = (typePriority[a.type] === undefined ? 3 : typePriority[a.type]) -
        (typePriority[b.type] === undefined ? 3 : typePriority[b.type]),
      aAreas = a.all ? S.areas.length : (a.areas || []).length,
      bAreas = b.all ? S.areas.length : (b.areas || []).length;
    return leadPriority || typeOrder || bAreas - aAreas
  });
  if (hasActiveFilters() && !ppl.length) return '';
  var del = TOP.indexOf(z.id) < 0 && z.id !== 'ext' ? '<button data-dz="' + z.id +
    '" aria-label="Delete team">x</button>' : '';
  var collapsed = isExternalTeam(z) && ppl.length > 3 && !expandedExternalTeams[z.id];
  var toggle = isExternalTeam(z) && ppl.length > 3 ?
    '<button class="external-toggle" data-external-toggle="' + z.id + '" aria-expanded="' + (!
      collapsed) + '">' + (collapsed ? 'Show all ' + ppl.length : 'Show less') + '</button>' : '';
  return '<div class="z' + (collapsed ? ' collapsed' : '') + '" data-z="' + z.id +
    '"><div class="zh"><input class="zt" data-rn="' + z.id + '" value="' + esc(z.t) +
    '" aria-label="Team name">' + externalTeamPicker(z) + '<button data-add="' + z.id +
    '" aria-label="Add person">+</button>' + del + '</div>' + ppl.map(function(p) {
      return card(p, prev)
    }).join('') + toggle + '</div>'
}

function printTeamSections(prev) {
  var sections = [{
    name: 'Strategy',
    filter: isLeadership
  }, {
    name: 'Delivery',
    filter: isDeliveryTeam
  }, {
    name: 'External Pool',
    filter: isExternalTeam
  }];
  return sections.map(function(section) {
    var teams = S.zones.filter(section.filter).map(function(team) {
        return zone(team, prev)
      }).filter(Boolean),
      rows = [];
    for (var i = 0; i < teams.length; i += 2) {
      rows.push('<tr><td>' + teams[i] + '</td><td>' + (teams[i + 1] || '') + '</td></tr>')
    }
    if (!rows.length) rows.push('<tr><td colspan="2"></td></tr>');
    return '<table class="print-team-table"><thead><tr><th colspan="2">' + esc(section.name) +
      '</th></tr></thead><tbody>' + rows.join('') + '</tbody></table>'
  }).join('')
}

function uniqueByName(people) {
  var seen = {};
  return people.filter(function(p) {
    var key = String(p.name || '').trim().toLocaleLowerCase();
    if (!key) return true;
    if (seen[key]) return false;
    seen[key] = true;
    return true
  })
}

function areaInfo() {
  return S.areas.map(function(a) {
    var f = function(t) {
      return P().people.filter(function(p) {
        return p.type === t && !isSecondaryPlacement(p) && !p.all && p.areas.indexOf(a) >=
          0
      })
    };
    return {
      a: a,
      i: uniqueByName(f('internal')),
      pl: f('planned'),
      ex: f('external')
    }
  })
}

function names(people) {
  return people.map(function(person) {
    return person.name
  }).join(', ')
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

function addArea() {
  var input = document.getElementById('na'),
    v = input.value.trim();
  if (!v) return;
  if (S.areas.indexOf(v) >= 0) {
    say('That area already exists.');
    return
  }
  S.areas.push(v);
  input.value = '';
  render();
  side()
}

function hasActiveFilters() {
  return !!((viewFilters.attr && viewFilters.value) || viewFilters.area || viewFilters.team)
}

function matchesFilters(p) {
  if (viewFilters.area && !p.all && p.areas.indexOf(viewFilters.area) < 0) return false;
  if (viewFilters.team && p.zone !== viewFilters.team) return false;
  if (viewFilters.attr && viewFilters.value) {
    var a = S.attrs.filter(function(x) {
        return x.n === viewFilters.attr
      })[0],
      v = viewFilters.attr === 'Status' ? p.type : gv(p, viewFilters.attr);
    if (a && a.t === 'checkbox') v = !!v;
    if (v == null) v = '';
    if (String(v) !== viewFilters.value) return false
  }
  return true
}

function renderFilterControls() {
  var attrs = [{
    n: 'Status',
    t: 'status'
  }].concat(S.attrs.filter(function(a) {
    return S.financials || a.n !== 'Annual cost'
  }));
  if (!attrs.some(function(a) {
      return a.n === viewFilters.attr
    })) {
    viewFilters.attr = '';
    viewFilters.value = ''
  }
  if (viewFilters.area && S.areas.indexOf(viewFilters.area) < 0) viewFilters.area = '';
  if (viewFilters.team && !S.zones.some(function(z) {
      return z.id === viewFilters.team && isDeliveryTeam(z)
    })) viewFilters.team = '';
  var selected = attrs.filter(function(a) {
      return a.n === viewFilters.attr
    })[0],
    values = [];
  if (selected) {
    if (selected.t === 'status') values = Object.keys(TYPES).map(function(k) {
      return {
        v: k,
        l: TYPES[k]
      }
    });
    else if (selected.t === 'checkbox') values = [{
      v: 'true',
      l: 'Yes'
    }, {
      v: 'false',
      l: 'No'
    }];
    else if (selected.t === 'strategy-person') values = strategyPeople().map(function(entry) {
      return {
        v: entry.person.k,
        l: entry.person.name + ' (' + entry.team.t + ')'
      }
    });
    else P().people.forEach(function(p) {
      var v = gv(p, selected.n);
      if (v == null || v === '') return;
      v = String(v);
      if (!values.some(function(x) {
          return x.v === v
        })) values.push({
        v: v,
        l: v
      })
    });
    if (!values.some(function(x) {
        return x.v === viewFilters.value
      })) viewFilters.value = ''
  }
  var teams = S.zones.filter(isDeliveryTeam),
    visible = P().people.filter(matchesFilters).length;
  document.getElementById('boardFilters').innerHTML =
    '<label>Expert Attribute<select data-filter="attr"><option value="">Any attribute</option>' +
    attrs.map(function(a) {
      return '<option value="' + esc(a.n) + '"' + (a.n === viewFilters.attr ? ' selected' : '') +
        '>' + esc(a.n) + '</option>'
    }).join('') + '</select></label><label>Value<select data-filter="value"' + (!selected ?
      ' disabled' : '') + '><option value="">Any value</option>' + values.map(function(x) {
      return '<option value="' + esc(x.v) + '"' + (x.v === viewFilters.value ? ' selected' : '') +
        '>' + esc(x.l) + '</option>'
    }).join('') +
    '</select></label><label>Functional Area<select data-filter="area"><option value="">All areas</option>' +
    S.areas.map(function(a) {
      return '<option value="' + esc(a) + '"' + (a === viewFilters.area ? ' selected' : '') +
        '>' + esc(a) + '</option>'
    }).join('') +
    '</select></label><label>Delivery Team<select data-filter="team"><option value="">All delivery teams</option>' +
    teams.map(function(z) {
      return '<option value="' + esc(z.id) + '"' + (z.id === viewFilters.team ? ' selected' :
        '') + '>' + esc(z.t) + '</option>'
    }).join('') + '</select></label><button type="button" data-filter-clear' + (hasActiveFilters() ?
      '' : ' disabled') + '>Clear</button><span class="filter-count">Showing ' + visible + ' of ' +
    P().people.length + ' people</span>'
}

function num(v) {
  v = parseFloat(v);
  return isNaN(v) ? 0 : v
}

function fmt(n) {
  return (n < 0 ? '-' : '') + S.cfg.cur + ' ' + Math.round(Math.abs(n)).toLocaleString('en-US')
}

function currencyCodes() {
  var unsupported = ['CUC', 'KPW', 'SVC', 'XSU'],
    codes;
  try {
    if (Intl.supportedValuesOf) codes = Intl.supportedValuesOf('currency')
  } catch (e) {}
  if (!codes) codes = ['AUD', 'BRL', 'CAD', 'CHF', 'CNY', 'CZK', 'DKK', 'EUR', 'GBP', 'HKD', 'HUF',
    'IDR', 'ILS', 'INR', 'ISK', 'JPY', 'KRW', 'MXN', 'MYR', 'NOK', 'NZD', 'PHP', 'PLN', 'RON',
    'SAR', 'SEK', 'SGD', 'THB', 'TRY', 'TWD', 'USD', 'ZAR'
  ];
  return codes.filter(function(code) {
    return unsupported.indexOf(code) < 0
  })
}

function currencyLabel(code) {
  try {
    return new Intl.DisplayNames(['en'], {
      type: 'currency'
    }).of(code) + ' (' + code + ')'
  } catch (e) {
    return code
  }
}
var rateCache = {};

function ratesFrom(code) {
  if (rateCache[code]) return Promise.resolve(rateCache[code]);
  return fetch('https://open.er-api.com/v6/latest/' + encodeURIComponent(code)).then(function(r) {
    if (!r.ok) throw new Error('Rate service returned ' + r.status);
    return r.json()
  }).then(function(d) {
    if (d.result !== 'success' || !d.rates) throw new Error('Rate service returned no rates');
    rateCache[code] = {
      rates: d.rates,
      updated: d.time_last_update_utc
    };
    return rateCache[code]
  })
}

function hasMoneyValues() {
  var c = S.cfg;
  if ([c.ext, c.int, c.hire].some(function(v) {
      return isFinite(Number(v)) && Number(v) !== 0
    })) return true;
  if (Object.keys(S.pv || {}).some(function(k) {
      var v = (S.pv[k] || {})['Annual cost'];
      return v !== '' && v != null && isFinite(Number(v)) && Number(v) !== 0
    })) return true;
  if (S.phases.some(function(ph) {
      return ph.people.some(function(p) {
        return p.externalCost !== '' && p.externalCost != null && isFinite(Number(p
          .externalCost)) && Number(p.externalCost) !== 0
      })
    })) return true;
  return S.fx.some(function(f) {
    return f.k === 'amt' && isFinite(Number(f.v)) && Number(f.v) !== 0
  })
}

function convertMoney(factor) {
  var c = S.cfg;
  ['ext', 'int', 'hire'].forEach(function(k) {
    c[k] = Math.round((Number(c[k]) || 0) * factor * 100) / 100
  });
  Object.keys(S.pv || {}).forEach(function(k) {
    var v = (S.pv[k] || {})['Annual cost'];
    if (v !== '' && v != null && isFinite(Number(v))) S.pv[k]['Annual cost'] = Math.round(
      Number(v) * factor * 100) / 100
  });
  S.phases.forEach(function(ph) {
    ph.people.forEach(function(p) {
      if (p.externalCost !== '' && p.externalCost != null && isFinite(Number(p
          .externalCost))) p.externalCost = Math.round(Number(p.externalCost) * factor *
        100) / 100
    })
  });
  S.fx.forEach(function(f) {
    if (f.k === 'amt' && isFinite(Number(f.v))) f.v = Math.round(Number(f.v) * factor * 100) /
      100
  })
}

function changeCurrency(next, control) {
  var from = S.cfg.cur,
    state = S;
  if (next === from) return;

  function apply(rate, updated) {
    convertMoney(rate);
    S.cfg.cur = next;
    admin();
    render();
    side();
    say('Converted monetary values from ' + from + ' to ' + next +
      ' using the latest available rate' + (updated ? ' (' + updated + ')' : '') + '.')
  }
  if (!hasMoneyValues()) {
    S.cfg.cur = next;
    admin();
    render();
    side();
    say('Currency set to ' + next + '; no monetary values needed conversion.');
    return
  }
  control.disabled = true;
  say('Fetching latest exchange rate…');
  ratesFrom(from).then(function(data) {
    if (S !== state) return;
    var rate = Number(data.rates[next]);
    if (!isFinite(rate) || rate <= 0) throw new Error('Target currency rate unavailable');
    apply(rate, data.updated)
  }).catch(function() {
    if (S !== state) return;
    control.disabled = false;
    control.value = from;
    say('Currency unchanged; the exchange rate could not be retrieved.')
  })
}

function fin(i) {
  var c = S.cfg,
    ph = S.phases[i].people,
    pc = c.ph[i] || {
      m: 12,
      t: 0,
      e: 0
    },
    pr = i ? S.phases[i - 1].people : [];
  var hs = ph.filter(function(p) {
    return isHire(p) && p.teamRole !== 'secondary'
  });
  var hc = hs.reduce(function(s, p) {
    var a = gv(p, 'Annual cost');
    return s + ((a === undefined || a === '') ? num(c.int) : num(a))
  }, 0);
  var jn = hs.filter(function(p) {
    return !pr.some(function(x) {
      return x.k === p.k && isHire(x)
    })
  }).length;
  var specificExternalDelta = ph.filter(function(p) {
    return p.type === 'external' && !isSecondaryPlacement(p) && hasSpecificExternalCost(p)
  }).reduce(function(sum, p) {
    var capacity = gv(p, 'Capacity %'),
      fte = capacity == null || capacity === '' || !isFinite(Number(capacity)) ? 1 : Math.max(0,
        Number(capacity)) / 100;
    return sum + fte * num(c.ext) - externalAnnualCost(p)
  }, 0);
  var av = (num(c.base) - num(pc.e)) * num(c.ext) + specificExternalDelta,
    ni = ph.filter(function(p) {
      return isInternalPerson(p) && p.teamRole !== 'secondary'
    }).length;
  var ef = S.fx.filter(function(f) {
    return f.f <= i + 1
  }).reduce(function(s, f) {
    return s + (f.k === 'pct' ? num(f.v) / 100 * ni * num(c.int) : num(f.v))
  }, 0);
  var net = av - hc,
    tot = net + ef,
    one = jn * num(c.hire);
  return {
    hc: hc,
    avoided: av,
    net: net,
    eff: ef,
    tot: tot,
    one: one,
    val: tot * num(pc.m) / 12 - one,
    hires: hs.length
  }
}

function cum(i) {
  var s = 0;
  for (var j = 0; j <= i; j++) s += fin(j).val;
  return s
}

function finTable() {
  var F = S.phases.map(function(_, i) {
    var f = fin(i);
    f.cu = cum(i);
    return f
  });
  var R = [
    ['Months', function(f, i) {
      return S.cfg.ph[i].m
    }],
    ['External FTE remaining', function(f, i) {
      return S.cfg.ph[i].e
    }],
    ['Avoided external spend per year', function(f) {
      return fmt(f.avoided)
    }],
    ['New insourced cost per year', function(f) {
      return fmt(-f.hc)
    }],
    ['Abstract effects per year', function(f) {
      return fmt(f.eff)
    }],
    ['Net per year', function(f) {
      return fmt(f.tot)
    }],
    ['Hiring Costs', function(f) {
      return fmt(-f.one)
    }],
    ['Result in phase', function(f) {
      return fmt(f.val)
    }],
    ['Cumulative', function(f) {
      return fmt(f.cu)
    }]
  ];
  return '<table><tr><th></th>' + S.phases.map(function(p) {
    return '<th>' + esc(p.title) + '</th>'
  }).join('') + '</tr>' + R.map(function(r) {
    return '<tr><td>' + r[0] + '</td>' + F.map(function(f, i) {
      return '<td>' + r[1](f, i) + '</td>'
    }).join('') + '</tr>'
  }).join('') + '</table>'
}

function externalTeamCostSummary(openAll) {
  if (!S.financials) return '';
  var peopleByKey = {};
  P().people.filter(function(person) {
    return person.type === 'external'
  }).forEach(function(person) {
    var key = person.k == null ? person.id : person.k;
    (peopleByKey[key] = peopleByKey[key] || []).push(person)
  });
  var teams = {};
  Object.keys(peopleByKey).forEach(function(key) {
    var entries = peopleByKey[key],
      source = entries.filter(function(person) {
        return !person.externalAssignment
      })[0] || entries[0],
      assignments = entries.filter(function(person) {
        return person.externalAssignment
      }),
      teamAssignments = assignments.length ? assignments : [source],
      uniqueTeamAssignments = [];
    teamAssignments.forEach(function(person) {
      if (!uniqueTeamAssignments.some(function(existing) {
          return (existing.zone || '') === (person.zone || '')
        })) uniqueTeamAssignments.push(person)
    });
    uniqueTeamAssignments.forEach(function(person) {
      var teamId = person.zone || '',
        teamKey = teamId || '__unassigned';
      var team = zoneById(teamId),
        group = teams[teamKey] || (teams[teamKey] = {
          name: team ? team.t : 'Unassigned team',
          items: []
        });
      group.items.push({
        name: source.name || person.name || 'Unnamed external',
        cost: externalAnnualCost(source) / uniqueTeamAssignments.length
      })
    })
  });
  var teamKeys = Object.keys(teams).sort(function(a, b) {
    var aIndex = S.zones.map(function(team) {
        return team.id
      }).indexOf(a),
      bIndex = S.zones.map(function(team) {
        return team.id
      }).indexOf(b);
    return (aIndex < 0 ? S.zones.length : aIndex) - (bIndex < 0 ? S.zones.length : bIndex) ||
      teams[a].name.localeCompare(teams[b].name)
  });
  if (!teamKeys.length) return '';
  return '<div class="sec">Estimated annual external costs by team</div><p class="external-cost-note">' +
    'Person-specific annual costs are used when set; otherwise the financial projection estimate is used. Costs for developers assigned to multiple teams are split evenly.</p><div class="external-cost-grid">' +
    teamKeys.map(function(key) {
      var team = teams[key],
        total = team.items.reduce(function(sum, person) {
          return sum + person.cost
        }, 0);
      team.items.sort(function(a, b) {
        return a.name.localeCompare(b.name)
      });
      return '<details class="external-cost-card"' + (openAll ? ' open' : '') + '><summary><span class="external-cost-team"><strong>' +
        esc(team.name) + '</strong><small>' + team.items.length + ' developer' + (team.items.length ===
          1 ? '' : 's') + '</small></span><strong>' + fmt(total) + '</strong></summary><div class="external-cost-people">' +
        team.items.map(function(person) {
          return '<div class="external-cost-person"><span>' + esc(person.name) + '</span><span>' +
            fmt(person.cost) + '</span></div>'
        }).join('') + '</div></details>'
    }).join('') + '</div>'
}

function financialProjectionReport() {
  var c = S.cfg,
    settings = [
      ['Currency', currencyLabel(c.cur)],
      ['Internalization Target', num(c.cap).toLocaleString('en-US') + ' FTE'],
      ['Baseline external FTE today', num(c.base).toLocaleString('en-US') + ' FTE'],
      ['External cost per FTE per year', fmt(num(c.ext))],
      ['Internal cost per FTE per year', fmt(num(c.int))],
      ['One-time cost per hire', fmt(num(c.hire))]
    ];
  var h = '<h2>Financial Projection</h2>' + settings.map(function(item) {
    return '<p><strong>' + esc(item[0]) + ':</strong> ' + esc(item[1]) + '</p>'
  }).join('');
  h += '<h3>Per phase</h3>' + S.phases.map(function(phase, i) {
    var target = c.ph[i];
    return '<p><strong>' + esc(phase.title) + ':</strong> Months ' + esc(target.m) +
      '; Target hires on board ' + esc(target.t) + '; External FTE remaining ' + esc(target.e) +
      '.</p>'
  }).join('');
  if (S.fx.length) h += '<h3>Abstract effects (monetized estimates)</h3>' + S.fx.map(function(effect) {
    var phaseIndex = Math.max(0, Math.min(S.phases.length - 1, num(effect.f) - 1)),
      value = effect.k === 'pct' ? num(effect.v) + '% of internal cost' :
      fmt(num(effect.v)) + ' per year',
      line = '<strong>' + esc(effect.n) + ':</strong> ' + esc(value) + '; Phase ' +
      esc(S.phases[phaseIndex].title);
    if (String(effect.note || '').trim()) line += '; Note ' + esc(effect.note);
    return '<p>' + line + '.</p>'
  }).join('');
  return h
}

function messages() {
  var output = [],
    people = P().people,
    internalPeople = internal(),
    areas = areaInfo(),
    soleOwners = {};
  areas.forEach(function(area) {
    if (!area.i.length) output.push(['risk', area.a + ' has no internal coverage' + (area.ex.length ?
      ' (only externals: ' + names(area.ex) + ')' : area.pl.length ? ' (only planned hires)' :
      '') + '.']);
    else if (area.i.length === 1) {
      var person = area.i[0];
      (soleOwners[person.id] = soleOwners[person.id] || {
        p: person,
        a: []
      }).a.push(area.a);
      output.push(['watch', area.a + ' depends on ' + person.name + '.'])
    }
  });
  Object.keys(soleOwners).forEach(function(key) {
    var owner = soleOwners[key];
    if (owner.a.length > 1) output.push(['risk', owner.p.name + ' is the only internal holder of ' +
      owner.a.join(', ') + ': a key-person risk.'
    ])
  });
  internalPeople.forEach(function(person) {
    if (!person.all && person.areas.length >= 5) output.push(['watch', person.name + ' covers ' +
      person.areas.length + ' areas, which may be too many.'
    ]);
    var capacity = gv(person, 'Capacity %');
    if (capacity !== undefined && capacity !== '' && +capacity < 50) output.push(['watch', person.name +
      ' has only ' + capacity + '% capacity.'
    ])
  });
  var generalists = internalPeople.filter(function(person) {
    return person.all
  });
  if (generalists.length) output.push(['watch', names(generalists) +
    ' marked as covering all areas and not counted in coverage; keep them from becoming the default fixer.'
  ]);
  var fte = internalPeople.reduce(function(sum, person) {
    var capacity = gv(person, 'Capacity %');
    return sum + ((capacity === undefined || capacity === '') ? 100 : +capacity) / 100
  }, 0);
  output.push(['ok', 'Internal capacity: ' + fte.toFixed(1) + ' FTE across ' + internalPeople.length +
    ' people.'
  ]);
  S.zones.forEach(function(zone) {
    if (!isDeliveryTeam(zone)) return;
    var members = people.filter(function(person) {
        return person.zone === zone.id && person.type !== 'external'
      }),
      internalMembers = members.filter(function(person) {
        return isInternalPerson(person) && person.teamRole !== 'secondary'
      });
    if (!members.length) output.push(['watch', 'Team "' + zone.t + '" is empty.']);
    else {
      if (!internalMembers.length) output.push(['watch', 'Team "' + zone.t + '" has no internal lead.']);
      if (internalMembers.length && !internalMembers.some(function(person) {
          return gv(person, 'Seniority') === 'Senior'
        })) output.push(['watch', 'Team "' + zone.t + '" has no senior member.']);
      if (internalMembers.length && internalMembers.length < members.length / 2) output.push(['watch',
        'Team "' + zone.t + '" is mostly planned hires, so delivery still leans on others.'
      ])
    }
  });
  var plannedTotal = people.filter(function(person) {
    return person.type === 'planned' && person.teamRole !== 'secondary'
  }).length;
  output.push([plannedTotal > S.cfg.cap ? 'risk' : 'ok', 'Planned internalizations: ' + plannedTotal +
    ' of ' + S.cfg.cap + '.'
  ]);
  var externalCount = people.filter(function(person) {
    return person.type === 'external' && !isSecondaryPlacement(person)
  }).length;
  if (S.cur > 0) {
    var previousExternalCount = S.phases[S.cur - 1].people.filter(function(person) {
      return person.type === 'external' && !isSecondaryPlacement(person)
    }).length;
    if (externalCount && externalCount >= previousExternalCount) output.push(['watch',
      'Externals are not decreasing versus the previous phase (' + previousExternalCount + ' to ' +
      externalCount + ').'
    ])
  }
  var financial = fin(S.cur),
    phaseTarget = S.cfg.ph[S.cur] || {
      t: 0
    };
  if (S.financials) {
    output.push([financial.net < 0 ? 'risk' : 'ok', 'Run-rate: avoided external spend ' +
      fmt(financial.avoided) + ' minus new internal cost ' + fmt(financial.hc) + ' = ' +
      fmt(financial.net) + ' per year.'
    ]);
    if (financial.eff) output.push([financial.eff < 0 ? 'watch' : 'ok',
      'Abstract effects contribute ' + fmt(financial.eff) + ' per year, for ' + fmt(financial.tot) +
      ' in total.'
    ]);
    var cumulative = cum(S.cur);
    output.push([cumulative < 0 ? 'watch' : 'ok', 'Cumulative result through this phase, after ' +
      fmt(financial.one) + ' of one-time hiring cost in it: ' + fmt(cumulative) + '.'
    ]);
    if (num(S.cfg.int) >= num(S.cfg.ext)) output.push(['risk',
      'Internal cost per FTE is not below external cost, so internalization does not save money per head.'
    ])
  }
  if (financial.hires < num(phaseTarget.t)) output.push(['watch', 'Hires on board: ' + financial.hires +
    ' of ' + phaseTarget.t + ' targeted by the end of this phase.'
  ]);
  if (!output.some(function(message) {
      return message[0] === 'risk'
    })) output.unshift(['ok', 'No critical risks found in this configuration.']);
  return output
}

function render() {
  document.body.classList.toggle('financial-elements-on', !!S.financials);
  var printProjection = document.getElementById('printFinancialProjection');
  printProjection.hidden = !S.financials;
  printProjection.innerHTML = S.financials ? financialProjectionReport() : '';
  S.attrs = S.attrs.filter(function(a) {
    return a.n !== 'Flight risk'
  });
  Object.keys(S.pv || {}).forEach(function(k) {
    if (S.pv[k]) delete S.pv[k]['Flight risk']
  });
  var ph = P(),
    prev = S.cur ? S.phases[S.cur - 1].people : null,
    h = '';
  document.title = S.title + ' | Org Planner';
  var ti = document.getElementById('plannerTitle');
  if (document.activeElement !== ti) ti.value = S.title;
  document.getElementById('tabs').innerHTML = S.phases.map(function(p, i) {
      return '<div class="phase-tab ' + (!summaryView && i === S.cur ? 'active' : '') +
        '"><button data-ph="' + i + '" aria-label="Show phase ' + (i + 1) + '">' + ('0' + (i + 1))
        .slice(-2) + '</button><input data-phase-title="' + i + '" aria-label="Phase ' + (i + 1) +
        ' title" value="' + esc(p.title) + '"><button type="button" class="phase-delete" data-del-phase="' +
        i + '" aria-label="Delete phase ' + (i + 1) + '" title="Delete phase"' + (S.phases.length ===
          1 ? ' disabled' : '') + '>X</button></div>'
    }).join('') + '<div class="phase-tab summary-tab ' + (summaryView ? 'active' : '') +
    '" data-summary="1"><button aria-label="Show summary">99</button><span class="summary-title">Summary</span></div>';
  var nt = document.getElementById('note');
  if (document.activeElement !== nt) nt.value = ph.note;
  document.getElementById('printDescription').textContent = ph.note;
  renderFilterControls();
  var fi = S.financials ? fin(S.cur) : null;
  var c = {
    internal: 0,
    planned: 0,
    external: 0
  };
  ph.people.forEach(function(p) {
    if (isSecondaryPlacement(p)) return;
    c[p.type]++
  });
  var tot = ph.people.filter(function(p) {
    return p.type === 'planned' && p.teamRole !== 'secondary'
  }).length;
  document.getElementById('st').innerHTML = '<div><b>' + c.internal +
    '</b><span>Internal</span></div><div><b>' + c.planned +
    '</b><span>Planned</span></div><div class="' + (tot > S.cfg.cap ? 'warn' : '') + '"><b>' +
    tot + ' / ' + S.cfg.cap + '</b><span>Internalization Target</span></div><div><b>' + c.external +
    '</b><span>Externals tracked</span></div>' + (fi ? '<div class="' + (fi.tot < 0 ? 'warn' : '') +
      '"><b>' + fmt(fi.tot) + '</b><span>Net per year this phase</span></div>' : '');
  document.getElementById('financialOutlook').hidden = !summaryView;
  var zs = S.zones,
    f = function(fn) {
      return zs.filter(fn).map(function(z) {
        return zone(z, prev)
      }).join('')
    };
  h +=
    '<div class="orgchart"><div class="sec" style="margin-top:0">Strategy <button data-addz="leadership" style="margin-left:8px;padding:2px 8px;font-size:12px">Add team</button></div><div class="org-level grid g2">' +
    f(isLeadership) +
    '</div><div class="sec delivery-title">Delivery <button data-addz="strategy" style="margin-left:8px;padding:2px 8px;font-size:12px">Add team</button></div><div class="org-level org-level-teams grid">' +
    f(isDeliveryTeam) + '</div></div>';
  h +=
    '<div class="sec">External Pool <button data-addz="external" style="margin-left:8px;padding:2px 8px;font-size:12px">Add team</button></div><div class="grid g2">' +
    f(isExternalTeam) + '</div>';
  document.getElementById('app').innerHTML = h;
  document.getElementById('printTeams').innerHTML = printTeamSections(prev);
  document.getElementById('cv').innerHTML = areaInfo().map(function(x, i) {
    var n = x.i.length;
    return '<span class="ac ' + (n < 2 ? 'l' : n >= 3 ? 'h' : '') + '"><input data-ra="' + i +
      '" value="' + esc(x.a) + '" aria-label="Area name"><b>' + n + '</b><button data-da="' +
      i + '" aria-label="Remove area">x</button></span>'
  }).join('');
  var findings = sortMessages(messages());
  document.getElementById('ins').innerHTML = findings.map(function(message) {
    return '<li class="i ' + message[0] + '">' + esc(message[1]) + '</li>'
  }).join('');
  document.getElementById('insightCounts').innerHTML = [
    ['risk', 'Critical'],
    ['watch', 'Watch'],
    ['ok', 'Info']
  ].map(function(item) {
    return '<span class="insight-count ' + item[0] + '">' + item[1] + ' ' + findings.filter(function(
      message) {
      return message[0] === item[0]
    }).length + '</span>'
  }).join('');
  document.getElementById('fin').innerHTML = S.financials ? finTable() :
    '<p class="leg">Financial elements are off.</p>';
  document.getElementById('externalTeamCosts').innerHTML = externalTeamCostSummary();
  document.getElementById('printSummary').innerHTML = '<div class="sec">Summary</div>' + (S.financials ?
    '<div class="print-summary-table" style="overflow-x:auto">' + finTable() + '</div>' +
    externalTeamCostSummary(true) : '<p class="leg">Financial elements are off.</p>');
  save()
}

function fld(a, v) {
  v = v == null ? '' : v;
  var d = ' data-v="' + esc(a.n) + '"';
  if (a.t === 'strategy-person') return '<select' + d + '><option value="">Not linked</option>' +
    strategyPeople().map(function(entry) {
      return '<option value="' + esc(entry.person.k) + '"' + (entry.person.k === v ? ' selected' :
        '') + '>' + esc(entry.person.name) + ' (' + esc(entry.team.t) + ')</option>'
    }).join('') + '</select>';
  if (a.t === 'checkbox') return '<input type="checkbox"' + d + ((v === true || v === 'true') ?
    ' checked' : '') + '>';
  if (a.t === 'choice') return '<select' + d + '><option value="">Not set</option>' + sp(a.o).map(
    function(o) {
      return '<option' + (o === v ? ' selected' : '') + '>' + esc(o) + '</option>'
    }).join('') + '</select>';
  if (a.t === 'number') return '<input type="number"' + d + ' value="' + esc(v) + '">';
  return '<textarea' + d + ' rows="2">' + esc(v) + '</textarea>'
}

function side() {
  var p = S.sel ? find(S.sel) : null,
    h = '';
  if (p) {
    h += '<div class="side-heading"><h3>' + esc(p.name) +
      '</h3><div class="side-actions"><button type="button" class="side-icon" data-del="1" aria-label="Remove from this phase" title="Remove from this phase">&#128465;&#xfe0e;</button><button type="button" class="side-icon" data-cl="1" aria-label="Close" title="Close">X</button></div></div><label>Name</label><input data-f="name" value="' + esc(p
      .name) + '"><label>Role</label><input data-f="role" value="' + esc(p.role) + '">';
    if (isInternalPerson(p)) h +=
      '<fieldset class="role-toggle"><legend>Team assignment</legend><label><input type="radio" name="teamRole" data-f="teamRole" value="primary"' +
      (p.teamRole !== 'secondary' ? ' checked' : '') +
      '>Primary</label><label><input type="radio" name="teamRole" data-f="teamRole" value="secondary"' +
      (p.teamRole === 'secondary' ? ' checked' : '') + '>Secondary</label></fieldset>';
    h += '<label>Status</label><select data-f="type">' + Object.keys(TYPES).map(function(k) {
      return '<option value="' + k + '"' + (p.type === k ? ' selected' : '') + '>' + TYPES[k] +
        '</option>'
    }).join('') + '</select>';
    h += '<label>Team</label><select data-f="zone">' + S.zones.map(function(z) {
      return '<option value="' + z.id + '"' + (p.zone === z.id ? ' selected' : '') + '>' + esc(z
        .t) + '</option>'
    }).join('') + '</select>';
    h += '<label>Functional areas (opt in or out)</label><div class="ck">' + S.areas.map(function(
    a) {
      return '<label><input type="checkbox" data-a="' + esc(a) + '"' + (p.areas.indexOf(a) >=
        0 ? ' checked' : '') + (p.all ? ' disabled' : '') + '>' + esc(a) + '</label>'
    }).join('') + '</div>';
    h += '<div class="ck"><label><input type="checkbox" data-f="all"' + (p.all ? ' checked' : '') +
      '>Generalist: covers all areas</label></div>';
    var personAttrs = S.attrs.filter(function(a) {
        return (S.financials || a.n !== 'Annual cost') && !(p.type === 'external' && a.n ===
          'Annual cost') && (a.n !== 'Strategy Person' || isDeliveryTeam(zoneById(p.zone)))
      }),
      techStackAttrs = personAttrs.filter(function(a) {
        return a.n === 'ABAP' || a.n === 'BTP'
      });
    personAttrs = personAttrs.filter(function(a) {
      return a.n !== 'ABAP' && a.n !== 'BTP'
    });
    h += '<div class="sec">Properties (follow this person across phases)</div>' + personAttrs.map(function(a) {
      return a.t === 'checkbox' ? '<div class="ck"><label>' + fld(a, gv(p, a.n)) + esc(a.n) +
        '</label></div>' : '<label>' + esc(a.n) + '</label>' + fld(a, gv(p, a.n))
    }).join('');
    if (techStackAttrs.length) h += '<div class="sec">Tech Stacks</div><div class="ck">' +
      techStackAttrs.map(function(a) {
        return '<label>' + fld(a, gv(p, a.n)) + esc(a.n) + '</label>'
      }).join('') + '</div>';
    if (S.financials && p.type === 'external') {
      h +=
        '<div class="sec">External costing</div><div class="ck"><label><input type="checkbox" data-f="useSpecificCost"' +
        (p.useSpecificCost ? ' checked' : '') +
        '>Use person-specific cost instead of generic rate</label></div>';
      if (p.useSpecificCost) h += '<label>Annual external cost (' + esc(S.cfg.cur) +
        ')</label><input type="number" data-f="externalCost" min="0" step="any" value="' + esc(p
          .externalCost == null ? '' : p.externalCost) + '">'
    }
  } else h =
    '<h3>Expert Attributes</h3><p style="color:var(--mut);margin:0">Click a card to edit its details and focus-area assignments.</p>';
  h += '<details><summary>Property fields</summary>' + S.attrs.filter(function(a) {
      return S.financials || a.n !== 'Annual cost'
    }).map(function(a, i) {
      return '<div class="ac" style="margin:4px 4px 0 0">' + esc(a.n) + ' <small>' + a.t +
        '</small><button data-dattr="' + i + '" aria-label="Remove field">x</button></div>'
    }).join('') +
    '<label>New field name</label><input id="an"><label>Type</label><select id="at"><option>text</option><option>number</option><option>choice</option><option>checkbox</option></select><label>Choices (comma separated, for choice)</label><input id="ao"><div class="bar" style="margin-top:8px"><button id="aat">Add field</button></div></details>';
  document.getElementById('side').innerHTML = h
}

function sel(id) {
  S.sel = id;
  render();
  side()
}
var app = document.getElementById('app');
document.getElementById('plannerTitle').addEventListener('input', function(e) {
  S.title = e.target.value;
  document.title = (S.title || DEFAULT_TITLE) + ' | Org Planner';
  save()
});
var themeToggle = document.getElementById('themeToggle'),
  themeKey = 'abap-org-planner-theme';

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
document.getElementById('projectBoardLink').addEventListener('click', function(e) {
  e.preventDefault();
  var resources = deliveryHandoff(),
    next = new URL(e.currentTarget.href);
  if (resources.length && confirm('Carry over ' + resources.length +
      ' Delivery team resources from ' + P().title +
      ' into the Project Engagement Board? Choose OK to import them, or Cancel to continue without importing.'
      )) next.searchParams.set('hcResources', JSON.stringify({
    version: 1,
    sourceTitle: S.title,
    sourcePhase: P().title,
    currency: S.cfg.cur,
    people: resources
  }));
  window.location.href = next.href
});
document.getElementById('tabs').addEventListener('input', function(e) {
  var i = e.target.dataset.phaseTitle;
  if (i === undefined) return;
  S.phases[+i].title = e.target.value;
  document.getElementById('fin').innerHTML = finTable();
  var row = document.querySelector('[data-phase-row="' + i + '"]');
  if (row) row.textContent = e.target.value;
  document.querySelectorAll('[data-phase-option="' + (+i + 1) + '"]').forEach(function(o) {
    o.textContent = e.target.value
  });
  save()
});
app.addEventListener('click', function(e) {
  var t = e.target;
  var a = t.closest('[data-add]');
  if (a) {
    var z = a.dataset.add,
      team = S.zones.filter(function(x) {
        return x.id === z
      })[0],
      type = isExternalTeam(team) ? 'external' : 'internal',
      p = {
        id: rid(),
        k: 'n' + rid(),
        name: 'New person',
        role: '',
        areas: [],
        all: false,
        zone: z,
        type: type,
        internalKind: type === 'internal' ? 'hire' : '',
        teamRole: type === 'internal' ? 'primary' : ''
      };
    P().people.push(p);
    sel(p.id);
    return
  }
  var d = t.closest('[data-dz]');
  if (d) {
    var id = d.dataset.dz;
    if (S.phases.some(function(ph) {
        return ph.people.some(function(p) {
          return p.zone === id
        })
      })) {
      say('Move people out of this team in every phase before deleting it.');
      return
    }
    S.zones = S.zones.filter(function(z) {
      return z.id !== id
    });
    render();
    side();
    return
  }
  var x = t.closest('[data-external-toggle]');
  if (x) {
    var externalTeamId = x.dataset.externalToggle;
    expandedExternalTeams[externalTeamId] = !expandedExternalTeams[externalTeamId];
    render();
    return
  }
  if (t.closest('.color-picker')) return;
  var c = t.closest('.c');
  if (c) sel(c.dataset.id)
});
app.addEventListener('keydown', function(e) {
  if (e.key === 'Enter' && e.target.classList.contains('c')) sel(e.target.dataset.id)
});
app.addEventListener('change', function(e) {
  var externalColorPicker = e.target.closest('[data-external-color]');
  if (externalColorPicker) {
    var externalTeam = zoneById(externalColorPicker.dataset.externalColor);
    if (externalTeam && isExternalTeam(externalTeam)) {
      externalTeam.color = safeColor(externalColorPicker.value);
      save();
      render();
      side()
    }
    return
  }
  var personColorPicker = e.target.closest('[data-person-color]');
  if (personColorPicker) {
    var colorPerson = P().people.filter(function(person) {
      return person.id === personColorPicker.dataset.personColor
    })[0];
    if (colorPerson) {
      S.pv[colorPerson.k] = S.pv[colorPerson.k] || {};
      S.pv[colorPerson.k].cardColor = safeColor(personColorPicker.value);
      save();
      render();
      side()
    }
    return
  }
  var r = e.target.dataset.rn;
  if (r) {
    S.zones.filter(function(z) {
      return z.id === r
    })[0].t = e.target.value;
    render();
    side()
  }
});
app.addEventListener('dragstart', function(e) {
  var c = e.target.closest && e.target.closest('.c');
  if (c) {
    dragId = c.dataset.id;
    e.dataTransfer.setData('text/plain', dragId);
    e.dataTransfer.effectAllowed = 'move'
  }
});
app.addEventListener('dragover', function(e) {
  var z = e.target.closest('.z');
  if (z) {
    e.preventDefault();
    z.classList.add('over')
  }
});
app.addEventListener('dragleave', function(e) {
  var z = e.target.closest('.z');
  if (z) z.classList.remove('over')
});
app.addEventListener('drop', function(e) {
  var z = e.target.closest('.z');
  if (!z) return;
  e.preventDefault();
  var p = find(dragId),
    target = S.zones.filter(function(x) {
      return x.id === z.dataset.z
    })[0];
  if (p && target) {
    if (p.type === 'external' && !p.externalAssignment && isDeliveryTeam(target)) {
      var assignment = P().people.filter(function(x) {
        return x.externalAssignment && x.k === p.k && x.zone === target.id
      })[0];
      if (!assignment) {
        assignment = JSON.parse(JSON.stringify(p));
        assignment.id = rid();
        assignment.zone = target.id;
        assignment.teamRole = 'secondary';
        assignment.externalAssignment = true;
        P().people.push(assignment)
      }
      S.sel = assignment.id
    } else p.zone = target.id;
    render();
    side()
  }
  dragId = null
});
var cv = document.getElementById('cv');
document.getElementById('areaActions').addEventListener('click', function(e) {
  if (e.target.id === 'aa') addArea()
});
var boardFilters = document.getElementById('boardFilters');
boardFilters.addEventListener('change', function(e) {
  var key = e.target.dataset.filter;
  if (!key) return;
  viewFilters[key] = e.target.value;
  if (key === 'attr') viewFilters.value = '';
  render()
});
boardFilters.addEventListener('click', function(e) {
  if (!e.target.hasAttribute('data-filter-clear')) return;
  viewFilters = {
    attr: '',
    value: '',
    area: '',
    team: ''
  };
  render()
});
cv.addEventListener('click', function(e) {
  var t = e.target;
  if (t.dataset.da !== undefined) {
    var a = S.areas[+t.dataset.da];
    S.areas.splice(+t.dataset.da, 1);
    S.phases.forEach(function(ph) {
      ph.people.forEach(function(p) {
        p.areas = p.areas.filter(function(x) {
          return x !== a
        })
      })
    });
    render();
    side();
    say('Removed area ' + a + ' from everyone.')
  }
});
cv.addEventListener('change', function(e) {
  var i = e.target.dataset.ra;
  if (i === undefined) return;
  var o = S.areas[+i],
    n = e.target.value.trim();
  if (!n || (n !== o && S.areas.indexOf(n) >= 0)) {
    e.target.value = o;
    say('Area names must be unique and not empty.');
    return
  }
  S.areas[+i] = n;
  S.phases.forEach(function(ph) {
    ph.people.forEach(function(p) {
      p.areas = p.areas.map(function(x) {
        return x === o ? n : x
      })
    })
  });
  render();
  side()
});
var sd = document.getElementById('side');
sd.addEventListener('change', function(e) {
  var d = e.target.dataset,
    p = find(S.sel);
  if (!p) return;
  if (d.f) {
    var v = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    if (d.f === 'name') {
      p.name = v;
      if (isInternalPerson(p) && hasPrimaryInOtherTeam(p, v)) p.teamRole = 'secondary';
      else if (isInternalPerson(p) && !p.teamRole) p.teamRole = 'primary'
    } else p[d.f] = v;
    if (d.f === 'type' && isInternalPerson(p)) {
      if (hasPrimaryInOtherTeam(p, p.name)) p.teamRole = 'secondary';
      else if (!p.teamRole) p.teamRole = 'primary'
    }
    if (d.f === 'useSpecificCost' && v && (p.externalCost == null || p.externalCost === '')) {
      var capacity = gv(p, 'Capacity %'),
        pct = capacity == null || capacity === '' || !isFinite(Number(capacity)) ? 100 : Math
        .max(0, Number(capacity));
      p.externalCost = Math.round(num(S.cfg.ext) * pct) / 100
    }
    if (d.f === 'type' && v === 'internal' && !p.internalKind) p.internalKind = 'hire';
    if (d.f === 'type' && v !== 'planned' && p.name === 'Open role') p.name = 'New hire';
    render();
    side();
    return
  }
  if (d.a) {
    var i = p.areas.indexOf(d.a);
    if (e.target.checked && i < 0) p.areas.push(d.a);
    if (!e.target.checked && i >= 0) p.areas.splice(i, 1);
    render();
    return
  }
  if (d.v) {
    S.pv[p.k] = S.pv[p.k] || {};
    S.pv[p.k][d.v] = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    render()
  }
});
sd.addEventListener('change', function(e) {
  var field = e.target.dataset.f,
    p = find(S.sel);
  if (!p || p.type !== 'external' || field !== 'name') return;
  P().people.forEach(function(x) {
    if (x.type === 'external' && x.k === p.k) x.name = e.target.value
  });
  render()
});
sd.addEventListener('click', function(e) {
  var t = e.target;
  if (t.dataset.del) {
    var removed = find(S.sel);
    P().people = P().people.filter(function(p) {
      return p.id !== S.sel && !(removed && removed.type === 'external' && !removed
        .externalAssignment && p.externalAssignment && p.k === removed.k)
    });
    S.sel = null;
    render();
    side();
    say('Removed from this phase only.')
  }
  if (t.dataset.cl) {
    S.sel = null;
    render();
    side()
  }
  if (t.dataset.dattr !== undefined) {
    S.attrs.splice(+t.dataset.dattr, 1);
    render();
    side()
  }
  if (t.id === 'aat') {
    var n = document.getElementById('an').value.trim();
    if (!n || S.attrs.some(function(a) {
        return a.n === n
      })) return;
    S.attrs.push({
      n: n,
      t: document.getElementById('at').value,
      o: document.getElementById('ao').value
    });
    render();
    side()
  }
});
document.addEventListener('click', function(e) {
  var deletePhase = e.target.closest('[data-del-phase]');
  if (deletePhase && S.phases.length > 1) {
    var deleteIndex = +deletePhase.dataset.delPhase,
      deletedTitle = S.phases[deleteIndex].title || ('Phase ' + (deleteIndex + 1));
    if (!confirm('Delete "' + deletedTitle + '" and its phase settings? This cannot be undone.')) return;
    S.phases.splice(deleteIndex, 1);
    S.cfg.ph.splice(deleteIndex, 1);
    if (S.cur > deleteIndex) S.cur--;
    else if (S.cur === deleteIndex) S.cur = Math.min(deleteIndex, S.phases.length - 1);
    summaryView = false;
    document.body.classList.remove('summary-view');
    S.sel = null;
    admin();
    render();
    side();
    say('Deleted ' + deletedTitle + '.');
    return
  }
  if (e.target.dataset.addz) {
    var tier = e.target.dataset.addz,
      id = 'z' + rid(),
      leadership = tier === 'leadership',
      external = tier === 'external';
    S.zones.splice(S.zones.length - 1, 0, {
      id: id,
      t: leadership ? 'New leadership team' : external ? 'New external team' :
        'New strategy team',
      tier: leadership ? 'leadership' : external ? 'external' : 'strategy',
      color: TEAM_COLORS[S.zones.length % TEAM_COLORS.length]
    });
    render();
    side();
    return
  }
  if (e.target.closest('[data-summary]')) {
    summaryView = true;
    document.body.classList.add('summary-view');
    S.sel = null;
    render();
    side();
    return
  }
  if (e.target.dataset.ph) {
    summaryView = false;
    document.body.classList.remove('summary-view');
    S.cur = +e.target.dataset.ph;
    S.sel = null;
    render();
    side()
  }
});
document.getElementById('addPhase').addEventListener('click', function() {
  var i = S.phases.length,
    prev = S.phases[i - 1],
    last = S.cfg.ph[i - 1] || {
      m: 12,
      t: 0,
      e: 0
    };
  S.phases.push({
    title: 'Phase ' + (i + 1) + ' · New phase',
    note: '',
    people: JSON.parse(JSON.stringify(prev.people)).map(function(p) {
      p.id = rid();
      return p
    })
  });
  S.cfg.ph.push(JSON.parse(JSON.stringify(last)));
  S.cur = i;
  S.sel = null;
  admin();
  render();
  side();
  say('Added a phase based on the previous phase.')
});
document.getElementById('note').addEventListener('input', function(e) {
  P().note = e.target.value;
  document.getElementById('printDescription').textContent = e.target.value;
  save()
});

function copy(txt, ok) {
  try {
    navigator.clipboard.writeText(txt).then(function() {
      say(ok)
    }, function() {
      say('Clipboard blocked here. Select the text and copy it manually.')
    })
  } catch (e) {
    say('Clipboard blocked here. Select the text and copy it manually.')
  }
}
document.getElementById('saveVariant').onclick = function() {
  downloadVariantFile(S, 'HC-PLANNING', 'JSON variant saved to the variants folder.')
};
document.getElementById('ex').onclick = function() {
  copy(JSON.stringify(addVariantMetadata(S, 'HC-PLANNING'), null, 1), 'JSON copied with a variant key.')
};
document.getElementById('exportPdf').onclick = function() {
  window.print()
};
document.getElementById('loadJSON').onclick = function() {
  document.getElementById('jsonFile').click()
};
document.getElementById('jsonFile').addEventListener('change', function(e) {
  var file = e.target.files && e.target.files[0];
  if (!file) return;
  var reader = new FileReader();
  reader.onload = function() {
    var previous = localStorage.getItem(KEY);
    try {
      var imported = JSON.parse(String(reader.result || ''));
      if (!imported || !Array.isArray(imported.phases) || !imported.phases.length || !imported
        .phases.every(function(ph) {
          return ph && Array.isArray(ph.people) && ph.people.every(function(p) {
            return p && Array.isArray(p.areas)
          })
        }) || !Array.isArray(imported.areas) || !Array.isArray(imported.attrs) || !Array
        .isArray(imported.zones) || !imported.cfg || !Array.isArray(imported.cfg.ph) || !
        imported.pv || typeof imported.pv !== 'object' || !Array.isArray(imported.fx))
      throw new Error('This file is not a valid HC Planning Board JSON export.');
      promptForVariantKey(imported);
      if (!confirm('Load this JSON plan and replace the current plan?')) {
        say('JSON load cancelled.');
        return
      }
      if (!Number.isInteger(imported.cur) || imported.cur < 0 || imported.cur >= imported
        .phases.length) imported.cur = 0;
      imported.sel = null;
      localStorage.setItem(KEY, JSON.stringify(imported));
      S = load();
      viewFilters = {
        attr: '',
        value: '',
        area: '',
        team: ''
      };
      admin();
      render();
      side();
      say('Loaded plan from ' + file.name + '.')
    } catch (err) {
      if (previous === null) localStorage.removeItem(KEY);
      else localStorage.setItem(KEY, previous);
      S = load();
      admin();
      render();
      side();
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
document.getElementById('cp').onclick = function(e) {
  var b = e.target;
  if (S.cur >= S.phases.length - 1) {
    say(P().title + ' is the last phase.');
    return
  }
  if (!cpArmed) {
    cpArmed = true;
    b.textContent = 'Click again to overwrite the next phase';
    setTimeout(function() {
      cpArmed = false;
      b.textContent = 'Copy this phase to the next'
    }, 3000);
    return
  }
  cpArmed = false;
  b.textContent = 'Copy this phase to the next';
  S.phases[S.cur + 1].people = JSON.parse(JSON.stringify(P().people)).map(function(p) {
    p.id = rid();
    return p
  });
  say('Copied to ' + S.phases[S.cur + 1].title + '.')
};
document.getElementById('clearTemplate').onclick = function() {
  if (!confirm(
      'Replace all teams, people, properties, and phase notes with the generic defaults?'))
return;
  S = template();
  admin();
  render();
  side();
  say('Reset to generic defaults.')
};
document.getElementById('sampleVariant').onclick = function() {
  if (!confirm('Replace the current plan with the Sample Variant?')) return;
  S = sampleVariant();
  admin();
  render();
  side();
  if (S.cfg.cur === 'EUR') say('Loaded the Sample Variant.');
  else changeCurrency('EUR', document.getElementById('currencySelect'))
};

function admin() {
  var c = S.cfg,
    h =
    '<fieldset class="fin-toggle"><legend>Financial elements</legend><label><input type="radio" name="financialVisibility" data-financial-visibility="1" value="on"' +
    (S.financials ? ' checked' : '') +
    '>On</label><label><input type="radio" name="financialVisibility" data-financial-visibility="1" value="off"' +
    (!S.financials ? ' checked' : '') + '>Off</label></fieldset><div class="ag">';
  var settings = [
    ['cap', 'Internalization Target', 'number'],
    ['base', 'Baseline external FTE today', 'number']
  ];
  if (S.financials) {
    h +=
      '<div><label for="currencySelect">Currency</label><select id="currencySelect" data-c="cur">' +
      currencyCodes().map(function(code) {
        return '<option value="' + esc(code) + '"' + (code === c.cur ? ' selected' : '') + '>' +
          esc(currencyLabel(code)) + '</option>'
      }).join('') + '</select></div>';
    settings = settings.concat([
      ['ext', 'External cost per FTE per year', 'number'],
      ['int', 'Internal cost per FTE per year', 'number'],
      ['hire', 'One-time cost per hire', 'number']
    ])
  }
  settings.forEach(function(x) {
    h += '<div><label>' + x[1] + '</label><input data-c="' + x[0] + '" type="' + x[2] +
      '" step="any" value="' + esc(c[x[0]]) + '"></div>'
  });
  h +=
    '</div><div class="sec">Per phase</div><table><tr><th></th><th>Months</th><th>Target hires on board</th><th>External FTE remaining</th></tr>' +
    S.phases.map(function(ph, i) {
      var p = c.ph[i];
      return '<tr><td data-phase-row="' + i + '">' + esc(ph.title) + '</td>' + ['m', 't', 'e']
        .map(function(k) {
          return '<td><input data-pp="' + i + ':' + k + '" type="number" step="any" value="' +
            esc(p[k]) + '"></td>'
        }).join('') + '</tr>'
    }).join('') + '</table>';
  if (S.financials) h += '<div class="sec">Abstract effects (monetized estimates)</div>' + S.fx.map(
      function(f, i) {
        var d = ' data-ef="' + i + ':';
        return '<div class="fx"><input' + d + 'n" value="' + esc(f.n) +
          '" aria-label="Effect"><select' + d + 'k"><option value="pct"' + (f.k === 'pct' ?
            ' selected' : '') + '>% of internal cost</option><option value="amt"' + (f.k === 'amt' ?
            ' selected' : '') + '>Amount per year</option></select><input' + d +
          'v" type="number" step="any" value="' + esc(f.v) + '" aria-label="Value"><select' + d +
          'f">' + S.phases.map(function(ph, n) {
            return '<option data-phase-option="' + (n + 1) + '" value="' + (n + 1) + '"' + (+f
              .f === n + 1 ? ' selected' : '') + '>' + esc(ph.title) + '</option>'
          }).join('') + '</select><input' + d + 'note" value="' + esc(f.note) +
          '" placeholder="Note" aria-label="Note"><button data-dfx="' + i +
          '" aria-label="Remove effect">x</button></div>'
      }).join('') +
    '<button id="afx" style="margin-top:8px">Add effect</button><div class="leg">Starting numbers are placeholders; replace them with your own. Baseline internal salaries are excluded because they are already in budget. Use a negative amount for an effect that costs money.</div>';
  document.getElementById('admb').innerHTML = h
}
var adm = document.getElementById('admb');
adm.addEventListener('change', function(e) {
  var d = e.target.dataset,
    v = e.target.value;
  if (d.financialVisibility) {
    S.financials = v === 'on';
    admin();
    render();
    side();
    return
  }
  if (d.c === 'cur') {
    changeCurrency(v, e.target);
    return
  }
  if (d.c) S.cfg[d.c] = num(v);
  else if (d.pp) {
    var a = d.pp.split(':');
    S.cfg.ph[+a[0]][a[1]] = num(v)
  } else if (d.ef) {
    var b = d.ef.split(':'),
      x = S.fx[+b[0]];
    x[b[1]] = (b[1] === 'v' || b[1] === 'f') ? num(v) : v
  }
  render()
});
adm.addEventListener('click', function(e) {
  var t = e.target;
  if (t.dataset.dfx !== undefined) {
    S.fx.splice(+t.dataset.dfx, 1);
    admin();
    render()
  }
  if (t.id === 'afx') {
    S.fx.push({
      n: 'New effect',
      k: 'amt',
      v: 0,
      f: 1,
      note: ''
    });
    admin();
    render()
  }
});
var hasSavedPlan = !!stateModel.read(),
  hasFreshChoice = false;
try {
  hasFreshChoice = localStorage.getItem(FRESH_SETUP_KEY) === 'fresh'
} catch (e) {}
if (!hasSavedPlan && !hasFreshChoice) {
  window.location.replace('index.html?setup=hc')
} else {
  S = load();
  if (!hasSavedPlan) save();
  admin();
  render();
  side()
}
