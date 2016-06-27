// Define the app
var CLINIKO_APP = angular.module("cliniko-test", []);

// This is the creatively named 'helperService' which contains things that many of our
// components need to use like helper functions for getting names and displaying date
CLINIKO_APP.factory('helperService', function() {
  var service = this;

  // Gets the full name of any person, taking into account their title if they have one
  // Handles receiving an undefined person as a param so getFullNameByID fails gracefully
  service.getFullName = function(person) {
    var name = "";
    if (!angular.isUndefined(person)) {
      if (person.title) {
        name = name + person.title + " ";
      }
      name = name + person.first_name + " " + person.last_name;
    }
    return name;
  };

  // Standardizes date formatting throughout the app
  service.displayDate = function(date) {
    return moment(date).format("MMMM Do YYYY");
  };

  return service;
});

// Single "Main" controller
CLINIKO_APP.controller("Main", ["$scope", "$http", "$q", "$timeout", "helperService", 
  function ($scope, $http, $q, $timeout, helperService) {

  $scope.notice = {
    exists: false
    , message: ""
    , type: "error"
  };

  $scope.current_view = "Patients";
  $scope.views = [
    "Patients"
    , "Practitioners"
    , "Appointments"
  ];
  $scope.search = {
    searching: false
    , term: ""
    , timeout: false
    , results: []
  };
  $scope.selected_item = null;
  $scope.current_date = moment().format();
  $scope.new_appointment_practitioner = 1;

  // This takes the currently selected patient and the practitioner_id from the select element
  // We start by looking up the practitioner's full name and check to make sure it's defined
  // This is a good check to make sure our data is good before we try to post and we'll use
  // the name later. Then we post and get the response back to add into the currently selected
  // patient's appointments list. Finally we trigger a success notice at the top of the screen
  $scope.addAppointment = function(patient, practitioner_id) {
    $scope.getFullNameByID("practitioners", practitioner_id, function(name) {
      if (!angular.isUndefined(name)) {
        $http.post("http://localhost:3001/appointments/", {
          date: moment($scope.current_date).format()
          , practitioner_id: practitioner_id
          , patient_id: patient.id
        }).then(function(response) {
          response.data.practitioner_name = name;
          $scope.selected_item.appointments.push(response.data);
          $scope.triggerNotice("success", "New appointment added with " + name + " for " + helperService.getFullName(patient));
        }, function(data) {
          $scope.triggerNotice("error","There was an error adding new appointment. The endpoint doesn't exist.");
        });
      }
    });
  };

  // This loads up patient_name or practitioner_name for each appointment passed
  // Data is saved on each appointment itself so nothing is returned
  $scope.loadRelationalAppointmentData = function(appointments, path, key) {
    var query = {id: []};
    query.id = appointments.map(function(appointment) {
      return appointment[key];
    });
    $scope.loadCollection(path, query, function(people) {
      for (var a in appointments) {
        var person = _.findWhere(people, { id: appointments[a][key] });
        appointments[a][path.slice(0, -1) + "_name"] = helperService.getFullName(person);
      }
    });
  };

  // We need these two functions in the view, so we copy them from the service
  $scope.displayDate = helperService.displayDate;
  $scope.getFullName = helperService.getFullName;

  // Because the views share common objects for searching and selected_item
  // we reset them when we change the view
  $scope.changeView = function(name) {
    $scope.search.term = "";
    $scope.search.results = [];
    $scope.current_view = name;
    $scope.selected_item = null;
  };

  // Originally I was only using q, but that would fail if you typed in a person's
  // full name, so now if you have a space in your term, we search the first word
  // against first name and the second word against the last name  
  $scope.generateSearchQuery = function(term, query) {
    var terms = term.split(" ");
    query = query || {};

    if (terms.length > 1) {
      query.first_name_like = terms[0];
      query.last_name_like = terms[1];
    } else {
      query.q = term;
    }

    return query;
  };

  // The shared guts of the search logic
  // If the term is over 2 chars and it's been 500ms since the last search,
  // you can search again. At the end of 500s if the term has changed (i.e. someone
  // was typing during the timeout), perform another search to update the results
  // it also takes a function which is the specifics of each type of search
  $scope.genericSearch = function(closure) {
    if ($scope.search.term.length > 2 && !$scope.search.timeout) {
      
      // Only search every 500ms
      var search_term = $scope.search.term;
      $scope.search.timeout = true;
      $scope.search.searching = true;
      $timeout(function() {
        $scope.search.timeout = false;
        if (search_term !== $scope.search.term) {
          $scope.genericSearch(closure);
        }
      }, 500);

      closure();
    }
  };

  // Searching for a person uses the 'q' query property
  $scope.onPersonSearch = function(path) {
    $scope.genericSearch(function() {
      $scope.loadCollection(path, $scope.generateSearchQuery($scope.search.term), function(data) {
        $scope.search.results = data;
        $scope.search.searching = false;
      });
    });
  };

  // Ideally the query here would be relational, i.e. find all appointments WHERE
  // patient names = search term OR practitioner names = search term
  // But I couldn't get anything close to this query to work. Maybe I'm missing some
  // syntax? I tried using ?_expand and ?_embed but neither yielded any results
  //
  // So instead we have this monster of several queries
  // patients where names = search term + practitioners where name = search term
  // then plucking their respective IDs and search appointments twice for each list
  // then we combine the two arrays, getting rid of any duplicates
  // finally we grab the all the relational data from each appointment
  //
  // This is super nasty and while it works with not too much delay for the user
  // I would want to refactor this with a better grasp on the API before this code 
  // went out into production
  $scope.onAppointmentSearch = function() {
    $scope.genericSearch(function() {
      var practitioner_ids = [];
      var patient_ids = [];

      // Set up a promise concurrently with practitioners query
      // Don't reject anything, just resolve an empty array
      var patient_promise = $q(function(resolve, reject) {
        $scope.loadCollection('patients', $scope.generateSearchQuery($scope.search.term), function(patients_data) {
          if (patients_data.length > 0) {
            patient_ids = patients_data.map(function(p) { return p.id; });
            $scope.loadCollection('appointments', { patient_id: patient_ids, _sort: "date" }, function(patient_appointments) {
              resolve(patient_appointments);
            });
          } else {
            resolve([])
          }
        });
      });

      // Set up a promise concurrently with patients query
      // Don't reject anything, just resolve an empty array
      var practitioner_promise = $q(function(resolve, reject) {
        $scope.loadCollection('practitioners', $scope.generateSearchQuery($scope.search.term), function(practitioners_data) {
          if (practitioners_data.length > 0) {
            practitioner_ids = practitioners_data.map(function(p) { return p.id; });
            $scope.loadCollection('appointments', { practitioner_id: practitioner_ids, _sort: "date" }, function(practitioner_appointments) {
              resolve(practitioner_appointments);
            });
          } else {
            resolve([])
          }
        });
      });

      // Combine the data from the two promises
      // Don't have to worry about handling fail states, will always resolve
      patient_promise.then(function(patient_appointments) {
        practitioner_promise.then(function(practitioner_appointments) {
          $scope.search.results = _.union(patient_appointments, practitioner_appointments);

          if ($scope.search.results.length > 0) {
            $scope.loadRelationalAppointmentData($scope.search.results, "patients", "patient_id");
            $scope.loadRelationalAppointmentData($scope.search.results, "practitioners", "practitioner_id");
          }

          $scope.search.searching = false;
        });
      });
    });
  };


  // Selects a person for the detail view section
  $scope.selectPerson = function(person, query, relation_key) {
    $scope.selected_item = person;
    $scope.search.term = "";
    $scope.search.results = [];
    
    // Grab all appointments, all practitioners for each appointment
    $scope.loadCollection("appointments", query, function(appointments) {
      $scope.selected_item.appointments = appointments;
      if (appointments.length > 0) {
        $scope.loadRelationalAppointmentData($scope.selected_item.appointments, relation_key + "s", relation_key + "_id");
      }
    });
  };

  // Helper method for more modular view
  $scope.selectPatient = function(person) {
    $scope.selectPerson(person, { patient_id: person.id, _sort: "date" }, "practitioner");

    // Need a list of all practictioners for the add new appointment select element
    $scope.loadCollection('practitioners', undefined, function(data) {
      $scope.practitioners = data;
    });
  };

  // Helper method for more modular view
  $scope.selectPractitioner = function(person) {
    $scope.selectPerson(person, { practitioner_id: person.id, _sort: "date" }, "patient");
  };

  // Generic get object by ID. Takes an array and an ID to look it up
  // If nothing is found, undefined is returned
  $scope.getObjectbyID = function(path, id) {
    return $q(function(resolve, reject) {
      $http.get("http://localhost:3001/" + path + "/" + id).then(function(response) {
        resolve(response.data);
      }, function(data) {
        $scope.triggerNotice("error", "There was an error getting " + path + " data at id " + id + ".");
        reject();
      });
    });
  };

  // Shorthand helper method for returning a fullname by an array and id
  $scope.getFullNameByID = function(path, id, closure) {
    $scope.getObjectbyID(path, id).then(function(person) {
      closure($scope.getFullName(person));
    }, closure);
  };

  // Builds a query string given an object
  // Object property values can be strings, ints or arrays
  // If it's an array it will iterate over the values and compile multiple
  // values for the same property, e.g. "id=4&id=5&id=6"
  $scope.buildQueryURL = function(path, query) {
    var url = "http://localhost:3001/" + path;

    if (!angular.isUndefined(query)) {
      url = url + "?";
      for (var q in query) {
        if (!angular.isArray(query[q])) {
          query[q] = [query[q]];
        }
        for (var a in query[q]) {
          url = url + q + "=" + query[q][a] + "&";
        }
      }
      url = url.slice(0, -1);
    }

    return url;
  };

  // Loads data from the API based on path and query
  $scope.loadCollection = function(path, query, closure) {
    var url = $scope.buildQueryURL(path, query);

    $http.get(url).then(function(response) {
      closure(response.data);
    }, function(data) {
      $scope.triggerNotice("error", "There was an error getting patient data.");
    });
  };

  // Triggers notice for user in banner at the top of the page
  $scope.triggerNotice = function(type, message) {
    $scope.notice.type = type;
    $scope.notice.exists = true;
    $scope.notice.message = message;
  };

}]);