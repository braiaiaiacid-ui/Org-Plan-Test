(function(root) {
  var app = root.OrgPlanner = root.OrgPlanner || {};
  app.Models = app.Models || {};

  var DATABASE_KEY = 'org-planner-database-v1';
  var USER_KEY = 'org-planner-user-v1';
  var TEAM_KEY = 'org-planner-team-v1';
  var DEFAULT_DATABASE = {
    version: 1,
    users: [{
      id: 'planner-admin',
      name: 'Demo Admin',
      email: 'admin@example.test'
    }, {
      id: 'planner-member',
      name: 'Demo Member',
      email: 'member@example.test'
    }],
    teams: [{
      id: 'run-team',
      name: 'Run Team',
      members: [{
        userId: 'planner-admin',
        role: 'admin'
      }, {
        userId: 'planner-member',
        role: 'member'
      }],
      views: [{
        boardId: 'project-engagement',
        storageKey: 'alloc-board-v1:run-team'
      }]
    }]
  };

  function readJson(key) {
    try {
      var value = root.localStorage.getItem(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      return null;
    }
  }

  app.Models.createTeamAccess = function() {
    var database = readJson(DATABASE_KEY);
    if (!database || database.version !== 1 || !Array.isArray(database.users) || !Array.isArray(
        database.teams)) {
      database = JSON.parse(JSON.stringify(DEFAULT_DATABASE));
      try {
        root.localStorage.setItem(DATABASE_KEY, JSON.stringify(database));
      } catch (error) {}
    }

    function findUser(id) {
      return database.users.filter(function(user) {
        return user.id === id
      })[0] || null;
    }

    function teamsForUser(userId) {
      return database.teams.filter(function(team) {
        return team.members.some(function(member) {
          return member.userId === userId
        })
      });
    }

    function activeUser() {
      var selected = readJson(USER_KEY);
      return findUser(typeof selected === 'string' ? selected : 'planner-admin') || database.users[0];
    }

    function activeTeam() {
      var user = activeUser();
      if (!user) return null;
      var teams = teamsForUser(user.id),
        selected = readJson(TEAM_KEY),
        team = teams.filter(function(item) {
          return item.id === selected
        })[0];
      return team || teams[0] || null;
    }

    function roleFor(team, user) {
      if (!team || !user) return null;
      var member = team.members.filter(function(item) {
        return item.userId === user.id
      })[0];
      return member ? member.role : null;
    }

    return {
      users: function() {
        return database.users.slice();
      },
      activeUser: activeUser,
      activeTeam: activeTeam,
      role: function() {
        return roleFor(activeTeam(), activeUser());
      },
      canManage: function() {
        return this.role() === 'admin';
      },
      setUser: function(userId) {
        if (!findUser(userId)) return false;
        var teams = teamsForUser(userId);
        if (!teams.length) return false;
        try {
          root.localStorage.setItem(USER_KEY, JSON.stringify(userId));
          root.localStorage.setItem(TEAM_KEY, JSON.stringify(teams[0].id));
        } catch (error) {}
        return true;
      },
      boardKey: function(boardId) {
        var team = activeTeam();
        if (!team) return 'org-planner:' + boardId;
        var view = team.views.filter(function(item) {
          return item.boardId === boardId
        })[0];
        return view ? view.storageKey : 'org-planner:' + team.id + ':' + boardId;
      }
    };
  };
})(window);